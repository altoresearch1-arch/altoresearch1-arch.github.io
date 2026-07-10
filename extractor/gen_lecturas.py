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
PDF_BASE = "https://documents.bvl.com.pe"
POR_EMPRESA = 2          # los N hechos más recientes de cada una
MAX_TEXTO = 60000        # por si un PDF viene gigante

# Versión de las REGLAS de análisis: al subirla, las lecturas cacheadas con
# versión vieja se re-analizan (re-descarga el PDF; correr LOCAL tras subirla
# para no reventar al robot de 30 min). escaneado/ilegible no dependen de las
# reglas y quedan cacheados para siempre.
VERSION_ANALISIS = 2

# ── las MISMAS reglas de app/src/lib/sentinel.js (mantener en espejo) ────────
# v2 (10-jul): BILINGÜES español+inglés (las matrices comunican en inglés —
# el HI de Nexa/Boliden salía vacío), categorías rating/auditoría, título,
# frases líder cuando no hay señales, recorte del legalese, extractores nuevos.

CATEGORIAS = [
    ("derivados", r"(instrumentos financieros derivados|posici[oó]n mensual|hedging|cobertura)", 0, True,
     "Posición en derivados (reporte mensual rutinario)"),
    ("dividendo", r"(dividendo|dividend\b|distribuci[oó]n .{0,20}utilidades|reparto de utilidades|entrega de acciones liberadas)", 2, False,
     "Dividendos / reparto de utilidades"),
    ("legal", r"(demanda|arbitraje|sanci[oó]n|multa|proceso judicial|sunat|indecopi|litigio|medida cautelar|lawsuit|arbitration|litigation|court ruling|\bfined\b|penalt(?:y|ies))", -2, False,
     "Tema legal / regulatorio"),
    ("operacional", r"(suspensi[oó]n|paralizaci[oó]n|huelga|accidente|siniestro|interrupci[oó]n|fuerza mayor|shutdown|stoppage|force majeure|work stoppage)", -2, False,
     "Evento operacional"),
    ("adquisicion", r"(adquisici[oó]n|compra de|venta de|fusi[oó]n|escisi[oó]n|opa\b|oferta p[uú]blica|toma de control|transferencia de acciones|negociaciones|acquisition|merger|takeover|tender offer|potential transaction|negotiations?\b|change of control|divestiture|spin-?off|sale of (?:a |its )?(?:stake|interest|shares))", 1, False,
     "Compra / venta / reorganización"),
    ("directorio", r"(renuncia|designaci[oó]n|nombramiento|remoci[oó]n|nuevo gerente|nuevo director|resignation|appointment of|appointed|new (?:ceo|cfo|chairman))", 0, False,
     "Cambios en directorio / gerencia"),
    ("junta", r"(convocatoria|junta (general|obligatoria|de accionistas)|jga|acuerdos de junta|shareholders'? meeting|annual general meeting|\bagm\b)", 0, False,
     "Junta de accionistas"),
    ("deuda", r"(emisi[oó]n de bonos|programa de bonos|financiamiento|pr[eé]stamo|refinanciaci[oó]n|l[ií]nea de cr[eé]dito|senior notes|notes offering|bond issuance|credit facility|loan agreement|refinanc)", 0, False,
     "Deuda / financiamiento"),
    ("rating", r"(clasificaci[oó]n de riesgo|clasificadora de riesgo|credit rating|rating action|moody'?s|fitch ratings|s&p global)", 0, False,
     "Informe de clasificación de riesgo"),
    ("auditoria", r"(trabajos de auditor[ií]a|sociedad de auditor[ií]a|auditor(?:es)? externos?|auditor[ií]a externa|external auditors?)", 0, False,
     "Auditoría externa"),
    ("resultados", r"(informaci[oó]n financiera|estados financieros|resultados (del|al) |memoria anual|eeff|financial statements|quarterly (?:results|report)|earnings (?:release|report)|annual report)", 0, False,
     "Resultados / información financiera"),
]

SENALES = [
    (r"(aprob[oó].{0,30}dividendo|acord[oó].{0,30}dividendo|pago de dividendo|declared? .{0,30}dividend|approved? .{0,30}dividend|dividend payment)", 3, "aprueba o paga dividendo"),
    (r"(utilidad|ganancia|net income|profit|revenue|earnings).{0,30}(creci[oó]|aument[oó]|super[oó]|r[eé]cord|mayor|increased|grew|rose|record|higher)", 3, "la ganancia crece"),
    (r"(r[eé]cord|hist[oó]ric[oa] m[aá]xim|all-?time high|record (?:production|revenue|earnings|results))", 2, "menciona cifras récord"),
    (r"(nuevo contrato|adjudicaci[oó]n|buena pro|expansi[oó]n|ampliaci[oó]n|inicio de (producci[oó]n|operaciones)|new contract|contract award|expansion project|started? (?:production|operations)|ramp-?up)", 2, "crecimiento u operación nueva"),
    (r"(reducci[oó]n de deuda|prepago|recompra de acciones|debt (?:reduction|repayment)|share (?:buyback|repurchase))", 2, "reduce deuda o recompra acciones"),
    (r"(p[eé]rdida|resultado negativo|net loss|impairment|write-?(?:off|down))", -3, "menciona pérdidas"),
    (r"(utilidad|ganancia|ingresos?|ventas?|net income|profit|revenue|earnings|production).{0,30}(cay[oó]|disminuy[oó]|se redujo|menor|fell|declined|decreased|dropped|lower)", -3, "la ganancia o ventas caen"),
    (r"(sanci[oó]n|multa|demanda|arbitraje|litigio|medida cautelar|lawsuit|litigation|penalt(?:y|ies)|\bfined\b)", -3, "problema legal o sanción"),
    (r"(suspensi[oó]n|paralizaci[oó]n|huelga|interrupci[oó]n|fuerza mayor|siniestro|accidente|shutdown|stoppage|force majeure)", -3, "operación afectada"),
    (r"(renuncia|resignation)", -1, "renuncia en la plana directiva"),
    # OJO: "liquidación" a secas NO — en derivados significa settlement del contrato
    (r"(incumplimiento|insolvencia|quiebra|(?:en|proceso de)\s+liquidaci[oó]n|default\b|insolvency|bankruptcy)", -4, "problema financiero serio"),
    (r"(no .{0,20}repartir[aá]?|sin dividendos|no dividend)", -1, "no habrá reparto"),
]

RE_MONTOS = r"(?:S/\.?|US\$|USD|\$)\s?[\d][\d,.]*(?:\s?(?:millones|mill[oó]n|mil|millions?|billions?|MM|M|bn)\b)?|[\d]+(?:\.\d+)?\s?%"
RE_FECHAS = (r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{1,2} de [a-záéíóú]+ de \d{4}\b"
             r"|\b(?:january|february|march|april|may|june|july|august|september|october|november|december) \d{1,2},? \d{4}\b"
             r"|\b\d{4}-\d{2}-\d{2}\b")

# frases que son puro formalismo o legalese: jamás valen como "frase clave"
RE_BOILERPLATE = r"(forward-?looking|cautionary|undertakes no obligation|de nuestra consideraci[oó]n|atentamente|further information|investor relations|www\.|@|s[ií]rvase|muy se[ñn]or|neither (?:the )?tsx venture exchange)"

# el punto de "S.A." / "Inc." NO cierra la oración (partía "Nexa Resources S.A." a la mitad)
RE_ABREV_FINAL = r"\b(?:S\.A\.A|S\.A\.C|S\.A|U\.S|Inc|Ltd|Corp|C[ií]a|No|Nro|Sr|Sra|Srta|Dr|Dra|Mr|Ms)\.$"


def partir_oraciones(cuerpo):
    """Trocea en oraciones sin caer en la trampa de las abreviaturas."""
    oraciones, actual = [], ""
    for frag in re.split(r"(?<=[.;])\s+", cuerpo):
        frag = re.sub(r"^\d{1,3}\s+", "", frag.strip())  # número de página colado
        actual = (actual + " " + frag).strip() if actual else frag
        if re.search(RE_ABREV_FINAL, actual):
            continue  # terminó en abreviatura: la oración sigue
        if actual:
            oraciones.append(actual)
        actual = ""
    if actual:
        oraciones.append(actual)
    return oraciones


def texto_util_de(texto):
    """Recorta el legalese que TODOS los comunicados en inglés pegan al final
    (lleno de 'strikes/litigation/losses' que NO son noticia)."""
    m = re.search(r"cautionary statement|forward-?looking statements|safe harbor", texto, re.I)
    return texto[:m.start()] if m and m.start() > 200 else texto


def detectar_idioma(texto):
    t = " " + re.sub(r"\n", " ", texto[:4000].lower()) + " "
    en = len(re.findall(r" (the|and|of|to|with|for|that|this) ", t))
    es = len(re.findall(r" (el|la|los|las|de|del|que|con|para|una) ", t))
    return "en" if en > es * 1.5 else "es"


def extraer_titulo(texto):
    """El TÍTULO del comunicado (los HI suelen ponerlo EN MAYÚSCULAS al arranque)."""
    for linea in texto[:1200].split("\n"):
        l = re.sub(r"\s+", " ", linea).strip()
        if len(l) < 18 or len(l) > 150:
            continue
        if re.search(r"hecho de importancia|se[ñn]ores|superintendencia|smv\b|bolsa de valores|av\.|jr\.|calle |^ref\.?[.:]|^asunto|de nuestra consideraci[oó]n|^lima,|^luxembourg|^luxemburgo|registro p[uú]blico", l, re.I):
            continue
        letras = re.sub(r"[^A-Za-zÁÉÍÓÚÑáéíóúñ]", "", l)
        if len(letras) < 12:
            continue
        if len(re.sub(r"[a-záéíóúñ]", "", letras)) / len(letras) >= 0.7:
            return l
    return None


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
        pa = re.search(r"((?:US\$|\$|S/\.?)\s?[\d][\d,]*(?:\.\d+)?)\s*(?:brutos?|netos?|nominales?)?\s*(?:por\s+acci[oó]n|per\s+share)", texto, re.I)
        if pa:
            det["porAccion"] = pa.group(1)
        reg = re.search(r"fecha\s+de\s+registro[^\d]{0,20}(\d{1,2}[^\s,.]*(?:\s+de\s+[a-záéíóú]+\s+de(?:l)?\s+\d{4}|[/-]\d{1,2}[/-]\d{2,4}))", texto, re.I)
        if reg:
            det["fechaRegistro"] = reg.group(1)
        ent = re.search(r"fecha\s+de\s+(?:entrega|pago)[^\d]{0,20}(\d{1,2}[^\s,.]*(?:\s+de\s+[a-záéíóú]+\s+de(?:l)?\s+\d{4}|[/-]\d{1,2}[/-]\d{2,4}))", texto, re.I)
        if ent:
            det["fechaEntrega"] = ent.group(1)
    if clave == "adquisicion":
        # ¿entre quiénes es el trato? "negotiations between X and Y" / "entre X y Y"
        partes = re.search(r"(?:between|entre)\s+([A-ZÁÉÍÓÚ][\w.&\s-]{1,45}?)\s*(?:\([^)]{1,25}\))?\s*(?:and|y)\s+([A-ZÁÉÍÓÚ][\w.&\s-]{1,45}?)(?=\s+(?:regarding|respecto|sobre|para|relativ|to\b|in\b|on\b)|[.,;])", texto)
        if partes:
            det["partes"] = f"{partes.group(1).strip()} y {partes.group(2).strip()}"
        if re.search(r"no certainty|no assurances?|en negociaci[oó]n|conversaciones en curso|ongoing negotiations|potential transaction|sin (?:que exista )?acuerdo", texto, re.I):
            det["enNegociacion"] = True
        if re.search(r"change of control|toma de control|controlling (?:stake|interest)|participaci[oó]n de control|interest in the company", texto, re.I):
            det["cambioControl"] = True
        monto_op = re.search(r"((?:US\$|USD|\$|S/\.?)\s?[\d][\d,.]*\s?(?:millones|mill[oó]n|million|billion|MM|bn)\b)", texto, re.I)
        if monto_op:
            det["montoOperacion"] = monto_op.group(1)
    if clave == "legal":
        multa = re.search(r"(?:multa|sanci[oó]n|penalt(?:y|ies)|fined?|demanda|pretensi[oó]n)[^.]{0,60}?((?:S/\.?|US\$|USD|\$)\s?[\d][\d,.]*(?:\s?(?:millones|mill[oó]n|million|MM)\b)?|[\d][\d,.]*\s?UIT)", texto, re.I)
        if multa:
            det["montoLegal"] = multa.group(1)
    if clave == "deuda":
        monto = (re.search(r"((?:S/\.?|US\$|USD|\$)\s?[\d][\d,.]*\s?(?:millones|mill[oó]n|million|billion|MM|bn)?\b)[^.]{0,60}?(?:bonos|notes|emisi[oó]n|pr[eé]stamo|loan|credit|financiamiento)", texto, re.I)
                 or re.search(r"(?:bonos|notes|emisi[oó]n|pr[eé]stamo|loan|financiamiento)[^.]{0,60}?((?:S/\.?|US\$|USD|\$)\s?[\d][\d,.]*\s?(?:millones|mill[oó]n|million|billion|MM|bn)?\b)", texto, re.I))
        if monto:
            det["montoDeuda"] = monto.group(1)
        tasa = re.search(r"(\d+(?:\.\d+)?\s?%)\s?(?:anual|de inter[eé]s|per annum|interest)", texto, re.I)
        if tasa:
            det["tasa"] = tasa.group(1)
    if clave == "directorio":
        persona = re.search(r"(?:renuncia|designaci[oó]n|nombramiento|remoci[oó]n|resignation|appointment)[^.]{0,60}?(?:se[ñn]ora?|sr\.?|sra\.?|don|do[ñn]a|mr\.?|ms\.?)\s+([A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóúñ]+){1,3})", texto)
        if persona:
            det["persona"] = persona.group(1)
        cargo = re.search(r"(gerente general|presidente del directorio|director(?:a)? (?:titular|suplente|independiente)|gerente de [a-záéíóúñ]+|chief executive officer|chief financial officer|\bceo\b|\bcfo\b)", texto, re.I)
        if cargo:
            det["cargo"] = cargo.group(1)
    if clave == "resultados":
        utilidad = re.search(r"(?:utilidad neta|ganancia neta|net income|net profit)[^.]{0,60}?((?:S/\.?|US\$|USD|\$)\s?[\d][\d,.]*(?:\s?(?:millones|mill[oó]n|million|MM)\b)?)", texto, re.I)
        if utilidad:
            det["utilidad"] = utilidad.group(1)
        ingresos = re.search(r"(?:ingresos|ventas netas|revenues?|net sales)[^.]{0,60}?((?:S/\.?|US\$|USD|\$)\s?[\d][\d,.]*(?:\s?(?:millones|mill[oó]n|million|MM)\b)?)", texto, re.I)
        if ingresos:
            det["ingresos"] = ingresos.group(1)
    return det


def analizar(texto):
    texto_util = texto_util_de(texto)   # sin el legalese del final
    idioma = detectar_idioma(texto)
    titulo = extraer_titulo(texto)

    categoria = None
    for clave, patron, prior, rutinario, nombre in CATEGORIAS:
        if re.search(patron, texto_util, re.I):
            categoria = {"clave": clave, "prior": prior, "rutinario": rutinario, "nombre": nombre, "re": patron}
            break

    montos = list(dict.fromkeys(m.strip() for m in re.findall(RE_MONTOS, texto_util) if len(m.strip()) >= 3))[:6]
    fechas = list(dict.fromkeys(re.findall(RE_FECHAS, texto_util, re.I)))[:4]

    detalles = extraer_detalles(texto_util, categoria["clave"] if categoria else None)

    puntaje = categoria["prior"] if categoria else 0
    razones = []
    if categoria and categoria["prior"] >= 2:
        razones.append(f"categoría favorable ({categoria['nombre'].lower()})")
    if categoria and categoria["prior"] <= -2:
        razones.append(f"categoría delicada ({categoria['nombre'].lower()})")
    for patron, peso, txt in SENALES:
        if re.search(patron, texto_util, re.I):
            puntaje += peso
            razones.append(("🟢 " if peso > 0 else "🔴 ") + txt)
    if detalles.get("enNegociacion"):
        razones.append("🟡 negociación EN CURSO: todavía no hay acuerdo cerrado ni términos definidos")
    if detalles.get("cambioControl"):
        razones.append("👀 podría cambiar quién CONTROLA la empresa — de esas noticias que hay que seguir")

    veredicto = "buena" if puntaje >= 2 else "mala" if puntaje <= -2 else "neutra"
    # RUTINARIOS: siempre neutra — sus tablas dicen "pérdidas/liquidación" y
    # daban falsos 🔴 (Minsur, cazado el 09-jul). Es información, no noticia.
    if categoria and categoria["rutinario"]:
        veredicto = "neutra"
        razones = ["es un reporte periódico rutinario (informativo, no una noticia)"]

    # frases clave: los saltos de línea del PDF parten oraciones → se pegan antes
    cuerpo = texto_util.replace(titulo, " ") if titulo else texto_util
    cuerpo = re.sub(r"\n+", " ", cuerpo)
    oraciones = [o for o in partir_oraciones(cuerpo)
                 if 40 <= len(o) <= 500 and not re.search(RE_BOILERPLATE, o, re.I)]
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
        if re.search(r"(acuerd|aprob|inform|comunic|anunci|confirm|announce|agree|decision|decidi)", o, re.I):
            p += 1
        if p >= 2:
            puntuadas.append((p, o))
    puntuadas.sort(key=lambda x: -x[0])
    frases = [o[:300] for _, o in puntuadas[:2]]
    # sin frases con puntaje: el LEAD (primeras oraciones sustanciosas) es el
    # mejor resumen honesto — antes quedaba VACÍO (caso Nexa-Boliden 02-jul)
    if not frases:
        frases = [o[:300] for o in oraciones if len(o) >= 60][:2]

    return {
        "v": VERSION_ANALISIS,
        "categoria": categoria["nombre"] if categoria else "Comunicado al mercado (sin categoría clara)",
        "categoriaClave": categoria["clave"] if categoria else None,
        "idioma": idioma,
        "titulo": titulo,
        "veredicto": veredicto,
        "razones": razones[:4],
        "montos": montos,
        "fechas": fechas,
        "frases": frases,
        "detalles": detalles,
    }


class PdfIlegible(Exception):
    """PDF roto o que no es PDF (Word disfrazado, stream cortado): error PERMANENTE."""


def leer_pdf(sesion, url):
    r = sesion.get(url, timeout=45)
    r.raise_for_status()
    try:
        lector = PdfReader(io.BytesIO(r.content))
        texto = "\n".join((pag.extract_text() or "") for pag in lector.pages)
    except Exception as e:
        raise PdfIlegible(str(e)[:60])
    texto = re.sub(r"[ \t]+", " ", texto).strip()
    # números que el PDF parte con espacios o saltos ("623 , 015 Onzas") se re-pegan
    texto = re.sub(r"(\d)\s*,\s*(?=\d)", r"\1,", texto)
    return texto[:MAX_TEXTO], len(lector.pages)


def main():
    with open(os.path.join(DATA, "hechos.json"), encoding="utf-8") as f:
        hechos = json.load(f)["hechos"]

    viejas = {}
    if os.path.exists(SALIDA):
        with open(SALIDA, encoding="utf-8") as f:
            viejas = json.load(f).get("lecturas", {})

    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36",
        "Origin": "https://www.bvl.com.pe",
        "Referer": "https://www.bvl.com.pe/",
    })

    lecturas, nuevos, fallos = {}, 0, 0

    def guardar_parcial():
        with open(SALIDA, "w", encoding="utf-8", newline="\n") as f:
            json.dump({"_comment": "parcial en curso (gen_lecturas.py)", "lecturas": {**viejas, **lecturas}},
                      f, ensure_ascii=False, indent=1, sort_keys=True)

    def procesar_url(ticker, fecha, url):
        nonlocal nuevos, fallos
        if url in viejas:
            vieja = viejas[url]
            # caché válida: escaneado/ilegible no dependen de las reglas;
            # las lecturas normales solo si son de la VERSIÓN actual del análisis
            if vieja.get("escaneado") or vieja.get("ilegible") or vieja.get("v") == VERSION_ANALISIS:
                lecturas[url] = vieja
                return
        if url in lecturas:
            return
        try:
            texto, paginas = leer_pdf(s, url)
            if len(texto) < 120:            # escaneado sin capa de texto: sin OCR, honesto
                lecturas[url] = {"ticker": ticker, "fecha": fecha, "escaneado": True}
            else:
                lec = analizar(texto)
                lec.update({"ticker": ticker, "fecha": fecha, "paginas": paginas})
                lecturas[url] = lec
            nuevos += 1
            print(f"  {ticker:10} {fecha} -> {lecturas[url].get('veredicto', 'escaneado')}", flush=True)
            if nuevos % 25 == 0:
                guardar_parcial()  # el 2025 minero son cientos de PDFs: no perder avance
            time.sleep(0.3)
        except PdfIlegible as e:
            # roto PARA SIEMPRE (Word disfrazado, stream cortado): se cachea
            # como ilegible para no re-descargarlo cada 30 minutos
            lecturas[url] = {"ticker": ticker, "fecha": fecha, "ilegible": True}
            print(f"  {ticker:10} {fecha} -> ilegible ({e})", flush=True)
        except Exception as e:
            # error de RED (transitorio): NO se cachea, se reintenta la próxima
            fallos += 1
            print(f"  {ticker:10} {fecha} -> ERROR {str(e)[:70]}", flush=True)

    for ticker, info in hechos.items():
        for h in (info.get("hechos") or [])[:POR_EMPRESA]:
            if h.get("pdf"):
                procesar_url(ticker, h.get("fecha"), h["pdf"])

    # ⛏ MINAS: además TODOS sus hechos de 2025 (historia completa para Atlas,
    # pedido de Jair 09-jul). Con la caché por URL solo se baja lo nuevo.
    with open(os.path.join(DATA, "empresas.json"), encoding="utf-8") as f:
        sectores = {e["ticker"]: e["sector"] for e in json.load(f)["empresas"]}
    with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    for c in cfg["empresas"]:
        ticker = c["ticker"]
        if sectores.get(ticker) != "minas" or not c.get("bvlRpj"):
            continue
        try:
            r = s.post("https://dataondemand.bvl.com.pe/v1/corporate-actions",
                       json={"rpjCode": c["bvlRpj"], "page": 1, "size": 100, "search": "",
                             "startDate": "2025-01-01", "endDate": "2025-12-31"},
                       timeout=45)
            r.raise_for_status()
            items = r.json().get("content") or []
        except Exception as e:
            fallos += 1
            print(f"  {ticker:10} 2025 -> ERROR en el listado: {str(e)[:60]}", flush=True)
            continue
        for it in items:
            docs = it.get("documents") or []
            path = docs[0].get("path") if docs and docs[0].get("path") else None
            if path:
                procesar_url(ticker, (it.get("registerDate") or "")[:10], PDF_BASE + path)

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
