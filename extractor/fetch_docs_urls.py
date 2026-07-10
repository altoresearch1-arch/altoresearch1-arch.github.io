# -*- coding: utf-8 -*-
"""
📚 DOCUMENTOS OFICIALES — recolecta los LINKS de descarga directa de la SMV
para que la ficha ofrezca el documento ORIGINAL con un clic (pedido de Jair
09-jul): "Análisis y Discusión de la Gerencia", "Estados Financieros" y
"Notas a los Estados Financieros".

Cobertura: trimestre ACTUAL para todas + Q1-Q4 2025 para las minas.
Los links (ConsultasP8/documento.aspx?vidDoc={GUID}) son PÚBLICOS y estables
(verificado: 200 + PDF sin sesión).

Sale: app/src/data/documentos.json
  { ticker: { "2026-T1": {gerencia, eeff, notas}, "2025-T1": {...} (minas) } }

Una consulta a la grilla por empresa-trimestre trae los 3 links juntos.
CACHÉ: los periodos 2025 no cambian (no se re-consultan); el actual se
refresca en cada corrida. Corre en PASOS_EPS (completo/--trimestral).
"""
import io, json, os, re, sys, time
from bs4 import BeautifulSoup

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from smv_extractor import nueva_sesion, _hidden, _form_base, BASE  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, ".."))
DATA = os.path.join(RAIZ, "app", "src", "data")
SALIDA = os.path.join(DATA, "documentos.json")

FILAS = [
    ("gerencia", r"an[aá]lisis y discusi[oó]n de la gerencia"),
    ("eeff", r"^ *[\w .]*estados financieros(?! .*notas)"),  # la fila "Estados Financieros" a secas
    ("notas", r"notas a los estados financieros"),
]


def links_de(s, smv_id, anio, trimestre):
    """{gerencia, eeff, notas} → url de descarga directa (los que existan)."""
    soup = BeautifulSoup(s.get(BASE, timeout=45).text, "lxml")
    f = _form_base(_hidden(soup), smv_id, anio, trimestre)
    f["__EVENTTARGET"] = "ctl00$MainContent$cboDenominacionSocial"
    soup2 = BeautifulSoup(s.post(BASE, data=f, timeout=45).text, "lxml")
    f2 = _form_base(_hidden(soup2), smv_id, anio, trimestre)
    f2["ctl00$MainContent$cbBuscar"] = "Buscar"
    soup3 = BeautifulSoup(s.post(BASE, data=f2, timeout=45).text, "lxml")

    from urllib.parse import urljoin
    encontrados = {}
    for tr in soup3.find_all("tr"):
        tl = tr.get_text(" ", strip=True).lower()
        a = tr.find("a", title=re.compile(r"^descargar documento$", re.I))
        if a and a.get("href"):
            if re.search(r"an[aá]lisis y discusi[oó]n de la gerencia", tl) and "gerencia" not in encontrados:
                encontrados["gerencia"] = a["href"].strip()
            elif re.search(r"notas a los estados financieros", tl) and "notas" not in encontrados:
                encontrados["notas"] = a["href"].strip()
        # los Estados Financieros no traen PDF directo: su original es la página
        # "Ver detalle" del visor oficial de la SMV
        det = tr.find("a", title=re.compile(r"ver detalle", re.I))
        if det and det.get("href") and "eeff" not in encontrados:
            encontrados["eeff"] = urljoin("https://www.smv.gob.pe/SIMV/", det["href"].strip())
    return encontrados


def main():
    with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    with open(os.path.join(DATA, "empresas.json"), encoding="utf-8") as f:
        sectores = {e["ticker"]: e["sector"] for e in json.load(f)["empresas"]}
    anio_actual = cfg.get("anio", 2026)
    tri_actual = cfg.get("trimestre", 1)
    clave_actual = f"{anio_actual}-T{tri_actual}"

    viejas = {}
    if os.path.exists(SALIDA):
        # utf-8-sig: tolera el BOM que deja PowerShell al crear stubs
        with open(SALIDA, encoding="utf-8-sig") as f:
            viejas = json.load(f).get("documentos", {})

    def escribir(salida):
        doc = {
            "_comment": ("Links de descarga DIRECTA de los documentos oficiales de la SMV por empresa y "
                         "trimestre (gerencia = Análisis y Discusión, eeff = Estados Financieros, notas). "
                         "Links públicos de ConsultasP8. Generado por extractor/fetch_docs_urls.py."),
            "documentos": salida,
        }
        with open(SALIDA, "w", encoding="utf-8", newline="\n") as f:
            json.dump(doc, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write("\n")

    salida, hechas = {}, 0
    for c in cfg["empresas"]:
        ticker, smv_id = c["ticker"], c.get("smvId")
        if not smv_id or c.get("sin_documentos"):
            continue
        objetivos = [(clave_actual, anio_actual, tri_actual)]
        if sectores.get(ticker) == "minas":
            objetivos += [(f"2025-T{t}", 2025, t) for t in (1, 2, 3, 4)]
        registro = dict(viejas.get(ticker) or {})
        for clave, anio, tri in objetivos:
            # la historia 2025 no cambia: si ya está, ni consultar
            if clave != clave_actual and registro.get(clave):
                continue
            try:
                s = nueva_sesion()
                links = links_de(s, smv_id, anio, tri)
                if links:
                    registro[clave] = links
                    hechas += 1
                print(f"  {ticker:10} {clave:8} -> {', '.join(links) if links else 'sin documentos'}", flush=True)
                if hechas % 10 == 0 and links:
                    parcial = dict(salida)
                    parcial[ticker] = registro
                    escribir(parcial)
                time.sleep(0.8)
            except Exception as e:
                print(f"  {ticker:10} {clave:8} -> ERROR {str(e)[:60]}", flush=True)
        if registro:
            salida[ticker] = registro

    escribir(salida)
    print(f"\nEscrito: {SALIDA} ({len(salida)} empresas · {hechas} consultas con links)")


if __name__ == "__main__":
    main()
