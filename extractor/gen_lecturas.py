# -*- coding: utf-8 -*-
"""
🛰️ LECTURAS — el robot LEE los 2 últimos hechos de importancia de CADA empresa
(los PDF oficiales de la BVL) y les deja la "lectura de Sentinel" pre-hecha:
categoría, veredicto 🟢/🔴/🟡 con razones, montos, frases clave y detalles
(cobertura, dividendo por acción…). Sale a app/src/data/lecturas.json y con eso
se nutren Atlas y Sentinel SIN que el usuario tenga que subir nada.

Es el MISMO análisis extractivo de app/src/lib/sentinel.js portado a Python —
si cambias las reglas allá, cámbialas acá (y viceversa).

INCREMENTAL: lecturas.json es su propia caché (clave = URL del PDF). Solo se
descargan y leen los PDF que aún no tienen lectura → la primera corrida baja
~200 PDFs (unos minutos); las siguientes solo los hechos NUEVOS (segundos).
Los PDF NO se guardan (solo el análisis, ~0.5 KB c/u).

Corre en actualizar_todo.py tras fetch_hechos (modos --hechos y --rapido).
"""
import io, json, os, re, sys, time
import requests
from pypdf import PdfReader

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, ".."))
DATA = os.path.join(RAIZ, "app", "src", "data")
SALIDA = os.path.join(DATA, "lecturas.json")
POR_EMPRESA = 2          # los N hechos más recientes de cada una
MAX_TEXTO = 60000        # por si un PDF viene gigante

# ── las MISMAS reglas de app/src/lib/sentinel.js (mantener en espejo) ────────

CATEGORIAS = [
    ("derivados", r"(instrumentos financieros derivados|posici[oó]n mensual|hedging|cobertura)", 0, True,
     "Posición en derivados (reporte mensual rutinario)"),
    ("dividendo", r"(dividendo|distribuci[oó]n .{0,20}utilidades|reparto de utilidades|entrega de acciones liberadas)", 2, False,
     "Dividendos / reparto de utilidades"),
    ("legal", r"(demanda|arbitraje|sanci[oó]n|multa|proceso judicial|sunat|indecopi|litigio|medida cautelar)", -2, False,
     "Tema legal / regulatorio"),
    ("operacional", r"(suspensi[oó]n|paralizaci[oó]n|huelga|accidente|siniestro|interrupci[oó]n|fuerza mayor)", -2, False,
     "Evento operacional"),
    ("adquisicion", r"(adquisici[oó]n|compra de|venta de|fusi[oó]n|escisi[oó]n|opa\b|oferta p[uú]blica|toma de control|transferencia de acciones)", 1, False,
     "Compra / venta / reorganización"),
    ("directorio", r"(renuncia|designaci[oó]n|nombramiento|remoci[oó]n|nuevo gerente|nuevo director)", 0, False,
     "Cambios en directorio / gerencia"),
    ("junta", r"(convocatoria|junta (general|obligatoria|de accionistas)|jga|acuerdos de junta)", 0, False,
     "Junta de accionistas"),
    ("deuda", r"(emisi[oó]n de bonos|programa de bonos|financiamiento|pr[eé]stamo|refinanciaci[oó]n|l[ií]nea de cr[eé]dito)", 0, False,
     "Deuda / financiamiento"),
    ("resultados", r"(informaci[oó]n financiera|estados financieros|resultados (del|al) |memoria anual|eeff)", 0, False,
     "Resultados / información financiera"),
]

SENALES = [
    (r"(aprob[oó].{0,30}dividendo|acord[oó].{0,30}dividendo|pago de dividendo)", 3, "aprueba o paga dividendo"),
    (r"(utilidad|ganancia).{0,25}(creci[oó]|aument[oó]|super[oó]|r[eé]cord|mayor)", 3, "la ganancia crece"),
    (r"(r[eé]cord|hist[oó]ric[oa] m[aá]xim)", 2, "menciona cifras récord"),
    (r"(nuevo contrato|adjudicaci[oó]n|buena pro|expansi[oó]n|ampliaci[oó]n|inicio de (producci[oó]n|operaciones))", 2, "crecimiento u operación nueva"),
    (r"(reducci[oó]n de deuda|prepago|recompra de acciones)", 2, "reduce deuda o recompra acciones"),
    (r"(p[eé]rdida|resultado negativo)", -3, "menciona pérdidas"),
    (r"(utilidad|ganancia|ingresos?|ventas?).{0,25}(cay[oó]|disminuy[oó]|se redujo|menor)", -3, "la ganancia o ventas caen"),
    (r"(sanci[oó]n|multa|demanda|arbitraje|litigio|medida cautelar)", -3, "problema legal o sanción"),
    (r"(suspensi[oó]n|paralizaci[oó]n|huelga|interrupci[oó]n|fuerza mayor|siniestro|accidente)", -3, "operación afectada"),
    (r"(renuncia)", -1, "renuncia en la plana directiva"),
    # OJO: "liquidación" a secas NO — en derivados significa settlement del contrato
    (r"(incumplimiento|insolvencia|quiebra|(?:en|proceso de)\s+liquidaci[oó]n)", -4, "problema financiero serio"),
    (r"(no .{0,20}repartir[aá]?|sin dividendos)", -1, "no habrá reparto"),
]

RE_MONTOS = r"(?:S/\.?|US\$|USD|\$)\s?[\d][\d,.]*(?:\s?(?:millones|mill[oó]n|mil|MM|M)\b)?|[\d]+(?:\.\d+)?\s?%"
RE_FECHAS = r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{1,2} de [a-záéíóú]+ de \d{4}\b|\b\d{4}-\d{2}-\d{2}\b"


def extraer_detalles(texto, clave):
    det = {}
    if clave == "derivados":
        # en orden de ESPECIFICIDAD (re.search devuelve lo primero del texto, no del patrón)
        if re.search(r"zero\s*cost\s*collar|collar", texto, re.I):
            det["instrumento"] = "Zero Cost Collar (banda de precios sin costo inicial)"
        elif re.search(r"forward", texto, re.I):
            det["instrumento"] = "forwards (precio pactado a futuro)"
        elif re.search(r"swap", texto, re.I):
            det["instrumento"] = "swaps"
        elif re.search(r"opcion(?:es)?", texto, re.I):
            det["instrumento"] = "opciones"
        # el metal puede venir ANTES (tabla: "Plata … 623,015 Onzas") o después
        con_metal = [f"{m.group(2)} {m.group(3)} de {m.group(1).lower()}"
                     for m in re.finditer(r"(plata|oro|zinc|cobre|plomo|esta[ñn]o)[^\d\n]{0,50}([\d][\d,]*(?:\.\d+)?)\s*(onzas|oz|toneladas|tm\b|tmf)", texto, re.I)]
        sin_metal = [f"{m.group(1)} {m.group(2)}{' de ' + m.group(3) if m.group(3) else ''}"
                     for m in re.finditer(r"([\d][\d,]*(?:\.\d+)?)\s*(onzas|oz|toneladas|tm\b|tmf)\s*(?:de\s*)?(plata|oro|zinc|cobre|plomo|estano|estaño)?", texto, re.I)]
        noc = (con_metal if con_metal else sin_metal)[:4]
        if noc:
            det["nocional"] = noc
        acum = (re.search(r"(?:acumulad[oa]s?|del\s+ano|del\s+año|anual(?:izado)?)[^.]{0,80}?((?:US\$|\$|S/)\s?[\d][\d,]*(?:\.\d+)?)", texto, re.I)
                or re.search(r"((?:US\$|\$|S/)\s?[\d][\d,]*(?:\.\d+)?)[^.]{0,60}(?:acumulad[oa]s?)", texto, re.I))
        if acum:
            det["resultadoAcumulado"] = acum.group(1)
    if clave == "dividendo":
        # número COMPLETO (con comas) y PEGADO a "por acción" — antes "S/.20,000,000 …
        # por acción" (el total) se truncaba a "S/.20" y salía como dividendo (bug real)
        pa = re.search(r"((?:US\$|\$|S/\.?)\s?[\d][\d,]*(?:\.\d+)?)\s*(?:brutos?|netos?|nominales?)?\s*por\s+acci[oó]n", texto, re.I)
        if pa:
            det["porAccion"] = pa.group(1)
        reg = re.search(r"fecha\s+de\s+registro[^\d]{0,20}(\d{1,2}[^\s,.]*(?:\s+de\s+[a-záéíóú]+\s+de(?:l)?\s+\d{4}|[/-]\d{1,2}[/-]\d{2,4}))", texto, re.I)
        if reg:
            det["fechaRegistro"] = reg.group(1)
        ent = re.search(r"fecha\s+de\s+(?:entrega|pago)[^\d]{0,20}(\d{1,2}[^\s,.]*(?:\s+de\s+[a-záéíóú]+\s+de(?:l)?\s+\d{4}|[/-]\d{1,2}[/-]\d{2,4}))", texto, re.I)
        if ent:
            det["fechaEntrega"] = ent.group(1)
    return det


def analizar(texto):
    categoria = None
    for clave, patron, prior, rutinario, nombre in CATEGORIAS:
        if re.search(patron, texto, re.I):
            categoria = {"clave": clave, "prior": prior, "rutinario": rutinario, "nombre": nombre, "re": patron}
            break

    montos = list(dict.fromkeys(m.strip() for m in re.findall(RE_MONTOS, texto) if len(m.strip()) >= 3))[:6]
    fechas = list(dict.fromkeys(re.findall(RE_FECHAS, texto, re.I)))[:4]

    puntaje = categoria["prior"] if categoria else 0
    razones = []
    if categoria and categoria["prior"] >= 2:
        razones.append(f"categoría favorable ({categoria['nombre'].lower()})")
    if categoria and categoria["prior"] <= -2:
        razones.append(f"categoría delicada ({categoria['nombre'].lower()})")
    for patron, peso, txt in SENALES:
        if re.search(patron, texto, re.I):
            puntaje += peso
            razones.append(("🟢 " if peso > 0 else "🔴 ") + txt)

    veredicto = "buena" if puntaje >= 2 else "mala" if puntaje <= -2 else "neutra"
    # RUTINARIOS: siempre neutra — sus tablas dicen "pérdidas/liquidación" y
    # daban falsos 🔴 (Minsur, cazado el 09-jul). Es información, no noticia.
    if categoria and categoria["rutinario"]:
        veredicto = "neutra"
        razones = ["es un reporte periódico rutinario (informativo, no una noticia)"]

    oraciones = [o.strip() for o in re.split(r"(?<=[.;])\s+|\n+", texto) if 40 <= len(o.strip()) <= 320]
    puntuadas = []
    for o in oraciones:
        p = 0
        if re.search(r"(?:S/|US\$|USD|\$)\s?\d|%", o):
            p += 2
        for patron, _, _ in SENALES:
            if re.search(patron, o, re.I):
                p += 2
        if categoria and re.search(categoria["re"], o, re.I):
            p += 1
        if re.search(r"(acuerd|aprob|inform|comunic)", o, re.I):
            p += 1
        if p >= 2:
            puntuadas.append((p, o))
    puntuadas.sort(key=lambda x: -x[0])
    frases = [o[:240] for _, o in puntuadas[:2]]

    return {
        "categoria": categoria["nombre"] if categoria else "Sin categoría clara",
        "categoriaClave": categoria["clave"] if categoria else None,
        "veredicto": veredicto,
        "razones": razones[:4],
        "montos": montos,
        "fechas": fechas,
        "frases": frases,
        "detalles": extraer_detalles(texto, categoria["clave"] if categoria else None),
    }


def leer_pdf(sesion, url):
    r = sesion.get(url, timeout=45)
    r.raise_for_status()
    lector = PdfReader(io.BytesIO(r.content))
    texto = "\n".join((pag.extract_text() or "") for pag in lector.pages)
    texto = re.sub(r"[ \t]+", " ", texto).strip()
    return texto[:MAX_TEXTO], len(lector.pages)


def main():
    with open(os.path.join(DATA, "hechos.json"), encoding="utf-8") as f:
        hechos = json.load(f)["hechos"]

    viejas = {}
    if os.path.exists(SALIDA):
        with open(SALIDA, encoding="utf-8") as f:
            viejas = json.load(f).get("lecturas", {})

    s = requests.Session()
    s.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36"})

    lecturas, nuevos, fallos = {}, 0, 0
    for ticker, info in hechos.items():
        for h in (info.get("hechos") or [])[:POR_EMPRESA]:
            url = h.get("pdf")
            if not url:
                continue
            if url in viejas:               # caché: ya leído en una corrida anterior
                lecturas[url] = viejas[url]
                continue
            try:
                texto, paginas = leer_pdf(s, url)
                if len(texto) < 120:        # escaneado sin capa de texto: sin OCR, honesto
                    lecturas[url] = {"ticker": ticker, "fecha": h.get("fecha"), "escaneado": True}
                else:
                    lec = analizar(texto)
                    lec.update({"ticker": ticker, "fecha": h.get("fecha"), "paginas": paginas})
                    lecturas[url] = lec
                nuevos += 1
                print(f"  {ticker:10} {h.get('fecha')} -> {lecturas[url].get('veredicto', 'escaneado')}", flush=True)
                time.sleep(0.3)
            except Exception as e:
                fallos += 1
                print(f"  {ticker:10} {h.get('fecha')} -> ERROR {str(e)[:70]}", flush=True)

    doc = {
        "_comment": ("Lectura automática (estilo Sentinel) de los 2 últimos hechos de importancia de cada "
                     "empresa, hecha por el robot con los PDF oficiales de la BVL. Clave = URL del PDF "
                     "(sirve de caché incremental). Generado por extractor/gen_lecturas.py — mismas reglas "
                     "que app/src/lib/sentinel.js (mantener en espejo)."),
        "lecturas": lecturas,
    }
    nuevo_json = json.dumps(doc, ensure_ascii=False, indent=1, sort_keys=True)
    viejo_json = None
    if os.path.exists(SALIDA):
        with open(SALIDA, encoding="utf-8") as f:
            viejo_json = f.read()
    if nuevo_json == viejo_json:
        print(f"\nlecturas.json sin cambios ({len(lecturas)} lecturas).")
        return
    with open(SALIDA, "w", encoding="utf-8", newline="\n") as f:
        f.write(nuevo_json)
    print(f"\nEscrito: {SALIDA} ({len(lecturas)} lecturas · {nuevos} nuevas · {fallos} fallos)")


if __name__ == "__main__":
    main()
