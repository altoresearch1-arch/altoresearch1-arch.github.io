# -*- coding: utf-8 -*-
"""
📝 NOTAS A LOS ESTADOS FINANCIEROS — el documento donde la empresa EXPLICA sus
números (deudas, juicios, partes relacionadas, políticas). El robot las baja de
la SMV, las digiere (extractivo) y las deja en notas.json para nutrir a Atlas.

Cobertura (pedido de Jair 09-jul):
  - TODAS las empresas: las Notas del trimestre ACTUAL (empresas_config.json).
  - Las MINAS (sector 'minas'): además los 4 trimestres de 2025 (Q1-Q4) para
    que Atlas conozca su historia reciente completa.

Sale: app/src/data/notas.json
  { ticker: { "actual":  {periodo, frases[≤6], montos[≤6], paginas},
              "2025-T1": {...}, ... (solo minas) } }

CACHÉ por expediente+periodo (si no cambió, no re-baja) + guardado INCREMENTAL.
La SMV es lenta/flaky desde la nube → corre en el modo COMPLETO local y en
--trimestral, NO en el robot de 30 min (igual que fetch_gerencia).
"""
import io, json, os, re, sys, time
from bs4 import BeautifulSoup
from pypdf import PdfReader

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from smv_extractor import nueva_sesion, _hidden, _form_base, BASE  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, ".."))
DATA = os.path.join(RAIZ, "app", "src", "data")
SALIDA = os.path.join(DATA, "notas.json")

# lo que un analista subraya en unas Notas (más "balance" que la gerencia)
CLAVES = [
    r"(?:S/|US\$|USD|\$)\s?\d", r"\d+(?:\.\d+)?\s?%",
    r"(deuda|obligacion|pr[eé]stamo|bono|financiamiento)",
    r"(juicio|litigio|demanda|contingencia|arbitraje|sunat|multa)",
    r"(partes? relacionada|vinculada|subsidiaria|matriz|principal accionista)",
    r"(dividendo|reparto|distribuci[oó]n de utilidades)",
    r"(utilidad|ganancia|p[eé]rdida|resultado)",
    r"(ventas?|ingresos?)", r"(inventario|existencias|cuentas por cobrar)",
    r"(aument[oó]|creci[oó]|disminuy[oó]|cay[oó]|se redujo)",
    r"(provisi[oó]n|deterioro|castigo)",
    r"(covenant|garant[ií]a|hipoteca|aval)",
    r"(continuidad|negocio en marcha|incertidumbre)",
]


def digerir(texto):
    oraciones = [o.strip() for o in re.split(r"(?<=[.;])\s+|\n{2,}", texto)
                 if 60 <= len(o.strip()) <= 340]
    puntuadas = []
    for o in oraciones:
        p = sum(1 for k in CLAVES if re.search(k, o, re.I))
        if re.search(r"(?:S/|US\$|USD|\$)\s?\d|\d+(?:\.\d+)?\s?%", o) and p >= 3:
            p += 2
        if p >= 4:  # las Notas son ENORMES: solo lo bien cargado de señal
            puntuadas.append((p, o))
    puntuadas.sort(key=lambda x: -x[0])
    frases, vistos = [], set()
    for _, o in puntuadas:
        firma = re.sub(r"\d", "", o.lower())[:80]
        if firma in vistos:
            continue
        vistos.add(firma)
        frases.append(re.sub(r"\s+", " ", o)[:300])
        if len(frases) >= 6:
            break
    montos = list(dict.fromkeys(
        m.strip() for m in re.findall(
            r"(?:S/\.?|US\$|USD|\$)\s?[\d][\d,.]*(?:\s?(?:millones|mill[oó]n|mil|MM|M)\b)?", texto)
    ))[:6]
    return frases, montos


def buscar_notas(s, smv_id, anio, trimestre):
    """(url_pdf, expediente, fecha) de la fila 'Notas a los Estados Financieros'."""
    soup = BeautifulSoup(s.get(BASE, timeout=45).text, "lxml")
    f = _form_base(_hidden(soup), smv_id, anio, trimestre)
    f["__EVENTTARGET"] = "ctl00$MainContent$cboDenominacionSocial"
    soup2 = BeautifulSoup(s.post(BASE, data=f, timeout=45).text, "lxml")
    f2 = _form_base(_hidden(soup2), smv_id, anio, trimestre)
    f2["ctl00$MainContent$cbBuscar"] = "Buscar"
    soup3 = BeautifulSoup(s.post(BASE, data=f2, timeout=45).text, "lxml")
    for tr in soup3.find_all("tr"):
        t = tr.get_text(" ", strip=True)
        if re.search(r"notas a los estados financieros", t, re.I):
            a = tr.find("a", title=re.compile(r"descargar", re.I))
            exp = re.search(r"\b(20\d{8})\b", t)
            if a and a.get("href"):
                return a["href"].strip(), (exp.group(1) if exp else None)
    return None, None


def procesar(s, smv_id, anio, trimestre, cache_previa):
    url, exp = buscar_notas(s, smv_id, anio, trimestre)
    if not url:
        return None, "sin Notas en la SMV"
    if cache_previa and cache_previa.get("expediente") == exp:
        return cache_previa, "sin cambios"
    r = s.get(url, timeout=120)
    r.raise_for_status()
    try:
        lector = PdfReader(io.BytesIO(r.content))
        texto = "\n".join((p.extract_text() or "") for p in lector.pages)[:200000]
    except Exception:
        return None, "PDF ilegible"
    texto = re.sub(r"[ \t]+", " ", texto)
    if len(texto.strip()) < 300:
        return None, "PDF escaneado"
    frases, montos = digerir(texto)
    return {
        "periodo": f"{anio}-T{trimestre}",
        "expediente": exp,
        "paginas": len(lector.pages),
        "frases": frases,
        "montos": montos,
    }, "OK"


def main():
    with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    with open(os.path.join(DATA, "empresas.json"), encoding="utf-8") as f:
        sectores = {e["ticker"]: e["sector"] for e in json.load(f)["empresas"]}
    anio_actual = cfg.get("anio", 2026)
    tri_actual = cfg.get("trimestre", 1)

    viejas = {}
    if os.path.exists(SALIDA):
        with open(SALIDA, encoding="utf-8") as f:
            viejas = json.load(f).get("notas", {})

    def escribir(salida):
        doc = {
            "_comment": ("Notas a los Estados Financieros (SMV) digeridas por empresa: trimestre actual "
                         "para todas + Q1-Q4 2025 para las minas. Extractivo (frases y montos textuales, "
                         "Regla #1). Generado por extractor/fetch_notas.py — corre en el modo completo "
                         "local o --trimestral (la SMV es flaky desde la nube)."),
            "notas": salida,
        }
        with open(SALIDA, "w", encoding="utf-8", newline="\n") as f:
            json.dump(doc, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write("\n")

    salida, hechas = {}, 0
    for c in cfg["empresas"]:
        ticker, smv_id = c["ticker"], c.get("smvId")
        if not smv_id or c.get("sin_documentos"):
            continue
        es_mina = sectores.get(ticker) == "minas"
        # trimestre actual para TODAS + los 4 de 2025 solo para las minas
        objetivos = [("actual", anio_actual, tri_actual)]
        if es_mina:
            objetivos += [(f"2025-T{t}", 2025, t) for t in (1, 2, 3, 4)]
        registro = dict(viejas.get(ticker) or {})
        for clave, anio, tri in objetivos:
            # la historia 2025 NO cambia: si ya está en caché, ni consultar la SMV
            if clave != "actual" and registro.get(clave):
                continue
            try:
                s = nueva_sesion()
                nuevo, estado = procesar(s, smv_id, anio, tri, registro.get(clave))
                if nuevo:
                    registro[clave] = nuevo
                print(f"  {ticker:10} {clave:8} -> {estado}", flush=True)
                if estado == "OK":
                    hechas += 1
                    if hechas % 8 == 0:
                        salida_parcial = dict(salida)
                        salida_parcial[ticker] = registro
                        escribir(salida_parcial)  # incremental: no perder nada
                time.sleep(1.0)
            except Exception as e:
                print(f"  {ticker:10} {clave:8} -> ERROR {str(e)[:60]}", flush=True)
        if registro:
            salida[ticker] = registro

    escribir(salida)
    print(f"\nEscrito: {SALIDA} ({len(salida)} empresas · {hechas} descargas nuevas)")


if __name__ == "__main__":
    main()
