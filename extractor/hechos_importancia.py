# -*- coding: utf-8 -*-
"""
Hechos de Importancia (HI) de la SMV — ALTO Research.

El portal público de HI vive en el SIMV (ASP.NET):
    https://www.smv.gob.pe/SIMV/  -> enlace "Ir a Hechos de importancia general"
    -> Frm_hechosdeImportanciaAll?data=<TOKEN>

DESCUBRIMIENTOS (30-jun-2026), para no volver a pelear con esto:
- El portal usa un TOKEN de sesión (?data=...) que se genera en /SIMV/ y EXPIRA.
  -> Este script lo saca fresco leyendo /SIMV/ (no lo hardcodees).
- La búsqueda es un formulario ASP.NET de DOS POSTBACKS (igual que smv_extractor.py):
    POST 1: __EVENTTARGET = ctl00$MainContent$cboDenominacionSocial  (autopostback)
    POST 2: btnBuscar con rango de fechas (txtFechDesde/txtFechHasta dd/mm/aaaa).
- El filtro por empresa (cboDenominacionSocial / cboTipoEmpresa+cboSector) es en
  CASCADA y no se logró aislar por empresa en una sola pasada: por eso este script
  trae TODOS los HI del rango y los FILTRA por el nombre de nuestras empresas.
- requests funciona (con el token vivo); Chrome NO hace falta y es inestable para esto.

PENDIENTE (para dejarlo redondo): paginación de la grilla (trae solo la 1ª página) y,
si se quiere, el filtro por empresa vía la cascada de dropdowns. Con eso quedaría un
extractor de HI completo. Genera app/src/data/hechos_importancia.json.
"""
import json, os, re, sys, requests
sys.stdout.reconfigure(encoding="utf-8")
from bs4 import BeautifulSoup

AQUI = os.path.dirname(os.path.abspath(__file__))
APP_DATA = os.path.normpath(os.path.join(AQUI, "..", "app", "src", "data"))
SIMV = "https://www.smv.gob.pe/SIMV/"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36"


def token_fresco(s):
    """Lee /SIMV/ y saca el ?data=<TOKEN> del enlace de Hechos de Importancia."""
    html = s.get(SIMV, timeout=30).text
    m = re.search(r'Frm_hechosdeImportancia\w*\?data=([0-9A-F]+)', html)
    return m.group(1) if m else None


def hidden(soup):
    d = {}
    for n in ("__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION",
              "__PREVIOUSPAGE", "__LASTFOCUS"):
        e = soup.find("input", {"name": n})
        d[n] = e.get("value", "") if e else ""
    return d


def buscar_hi(s, url, desde, hasta):
    """Dos postbacks: (1) activar la búsqueda de HI, (2) Buscar por rango de fechas."""
    soup = BeautifulSoup(s.get(url, timeout=30).text, "lxml")
    f = hidden(soup)
    f.update({"__EVENTTARGET": "ctl00$MainContent$cboDenominacionSocial",
              "__EVENTARGUMENT": "", "ctl00$MainContent$Tipo": "HI",
              "ctl00$MainContent$TextBox1": "TODOS", "ctl00$MainContent$TextBox2": "TODOS"})
    soup2 = BeautifulSoup(s.post(url, data=f, timeout=40).text, "lxml")
    f2 = hidden(soup2)
    f2.update({"__EVENTTARGET": "", "__EVENTARGUMENT": "",
               "ctl00$MainContent$Tipo": "HI",
               "ctl00$MainContent$TextBox1": "TODOS", "ctl00$MainContent$TextBox2": "TODOS",
               "ctl00$MainContent$txtFechDesde": desde, "ctl00$MainContent$txtFechHasta": hasta,
               "ctl00$MainContent$btnBuscar": "Buscar"})
    return BeautifulSoup(s.post(url, data=f2, timeout=40).text, "lxml")


def parse_filas(soup):
    """Extrae (exp, fecha, empresa, detalle) de la grilla de resultados."""
    out = []
    for tr in soup.find_all("tr"):
        t = tr.get_text(" ", strip=True)
        m = re.search(r"EXP\.\s*(\d+)\s*DEL\s*(\d{2}/\d{2}/20\d\d)\s*[\d:]*\s*\d*\s*-\s*(.+)", t)
        if not m:
            continue
        emp = t.split("EXP.")[0].strip()[:80]
        out.append({"exp": m.group(1), "fecha": m.group(2), "empresa": emp,
                    "detalle": re.sub(r"\s+", " ", m.group(3))[:220]})
    return out


def main():
    with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    # nombres clave para filtrar (primera palabra distintiva del nombre)
    nombres = {c["ticker"]: c["nombre"].upper() for c in cfg["empresas"]}

    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Referer": SIMV})
    tok = token_fresco(s)
    if not tok:
        print("No se pudo obtener token del SIMV (¿portal caído?).")
        return
    print("Token:", tok[:16], "...")
    url = f"{SIMV}Frm_hechosdeImportanciaAll?data={tok}"

    # El buscador devuelve los HI del DÍA (el filtro de fechas del form ASP.NET no aplica).
    # Estrategia: correr a diario (junto al robot de precios) y ACUMULAR -> se arma el
    # historial por empresa solo, con dedup por número de expediente (EXP).
    filas = parse_filas(buscar_hi(s, url, "", ""))
    print(f"HI del día leídos: {len(filas)}")

    nuestros = {}
    for tk, nom in nombres.items():
        clave = nom.upper().split(" S.A")[0].split(",")[0].strip()
        for hi in filas:
            if clave and clave in hi["empresa"]:
                nuestros.setdefault(tk, []).append(hi)

    out = os.path.join(APP_DATA, "hechos_importancia.json")
    prev = {}
    if os.path.exists(out):
        try:
            prev = json.load(open(out, encoding="utf-8")).get("hechos", {})
        except Exception:
            prev = {}

    nuevos = 0
    for tk, hs in nuestros.items():
        vistos = {h.get("exp") for h in prev.get(tk, [])}
        for h in hs:
            if h["exp"] not in vistos:
                prev.setdefault(tk, []).insert(0, h)  # el más nuevo primero
                vistos.add(h["exp"])
                nuevos += 1

    doc = {"_comment": ("Hechos de Importancia de la SMV, ACUMULADO por empresa (dedup por EXP). "
                        "El buscador solo da los HI del DÍA, así que este archivo crece corriendo "
                        "hechos_importancia.py a diario (ideal con el robot de precios). "
                        "tipo del detalle: '13. POLÍTICA DE DIVIDENDOS', 'HUELGAS...', etc. (Regla #7: es 'documentado')."),
           "fuente": "https://www.smv.gob.pe/SIMV/ -> Hechos de importancia general",
           "hechos": prev}
    with open(out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    print(f"Escrito: {out}  (+{nuevos} HI nuevos hoy; {len(prev)} empresas con historial)")
    for tk, hs in nuestros.items():
        print(f"  {tk}: hoy {len(hs)} -> {hs[0]['detalle'][:60]}")


if __name__ == "__main__":
    main()
