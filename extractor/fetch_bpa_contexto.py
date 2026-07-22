# -*- coding: utf-8 -*-
"""
CONTEXTO para la gráfica BPA de la ficha (pedido de Jair 21-jul-2026): por
periodo (año y trimestre, 2020→hoy):
 - PRECIO de la acción: último cierre del periodo — BVL dataondemand (misma
   receta que fetch_historicos.py; la BVL rellena con ceros → se filtran).
 - PRECIO de METALES: promedio del periodo — API pública del BCRP (series
   "Cotizaciones de productos", promedio mensual LME). Se eligió BCRP en vez
   de investing.com: oficial, JSON estable, sin scraping frágil.
Los DIVIDENDOS no van aquí: la app los deriva de dividendos.json (ya los tiene
con fecha y monto por pago).

Escribe app/src/data/bpa_contexto.json. Correr junto a fetch_bpa_historico.py
(tras cada trimestre nuevo); no está en el robot de 30 min.
"""
import sys, json, os, time
sys.stdout.reconfigure(encoding="utf-8")
from datetime import date

import requests

AQUI = os.path.dirname(os.path.abspath(__file__))
APP_DATA = os.path.normpath(os.path.join(AQUI, "..", "app", "src", "data"))
SALIDA = os.path.join(APP_DATA, "bpa_contexto.json")
DESDE = 2020

with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
    CFG = json.load(f)

# metal -> (serie BCRP mensual, unidad mostrada, factor de conversión)
# (cobre/zinc/plomo/estaño/níquel vienen en ¢US$ por libra → ×0.01 a US$/lb)
METALES = {
    "cobre":  ("PN01652XM", "US$/lb", 0.01),
    "oro":    ("PN01654XM", "US$/oz", 1),
    "plata":  ("PN01655XM", "US$/oz", 1),
    "zinc":   ("PN01657XM", "US$/lb", 0.01),
    "plomo":  ("PN01656XM", "US$/lb", 0.01),
    "estano": ("PN01653XM", "US$/lb", 0.01),
    "niquel": ("PN01658XM", "US$/lb", 0.01),
}
MES_ES = {"Ene": 1, "Feb": 2, "Mar": 3, "Abr": 4, "May": 5, "Jun": 6,
          "Jul": 7, "Ago": 8, "Set": 9, "Sep": 9, "Oct": 10, "Nov": 11, "Dic": 12}


def sesion_bvl():
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.bvl.com.pe",
        "Referer": "https://www.bvl.com.pe/",
    })
    return s


def precios_por_periodo(s, nem):
    """Último cierre REAL de cada año y trimestre (ceros de relleno filtrados)."""
    url = f"https://dataondemand.bvl.com.pe/v1/stock-quote/share-values/{nem}"
    r = s.get(url, params={"startDate": f"{DESDE}-01-01",
                           "endDate": date.today().isoformat()}, timeout=40)
    if r.status_code != 200:
        return None
    j = r.json()
    sim = "US$" if (j.get("currencySymbol") or "").strip() == "$" else "S/"
    anual, trim = {}, {}
    for fila in j.get("values") or []:
        try:
            fecha, cierre = fila[0], float(fila[1])
        except (ValueError, TypeError, IndexError):
            continue
        if cierre <= 0:
            continue  # relleno de la BVL, no es precio
        a, m = fecha[:4], int(fecha[5:7])
        anual[a] = cierre            # values viene cronológico: queda el último
        trim[f"{a}-Q{(m - 1) // 3 + 1}"] = cierre
    if not anual:
        return None
    return {"sim": sim, "anual": anual, "trimestral": trim}


def metal_por_periodo(cod, factor):
    """Promedios anual y trimestral desde la serie mensual del BCRP."""
    url = (f"https://estadisticas.bcrp.gob.pe/estadisticas/series/api/{cod}"
           f"/json/{DESDE}-1/{date.today().year}-12")
    r = requests.get(url, timeout=40, headers={"User-Agent": "Mozilla/5.0"})
    j = r.json()
    por_anual, por_trim = {}, {}
    for p in j.get("periods") or []:
        try:
            mes_txt, anio = p["name"].split(".")   # "Ene.2024"
            m = MES_ES[mes_txt[:3]]
            v = float(p["values"][0]) * factor
        except (KeyError, ValueError, IndexError):
            continue
        por_anual.setdefault(anio, []).append(v)
        por_trim.setdefault(f"{anio}-Q{(m - 1) // 3 + 1}", []).append(v)
    red = lambda xs: round(sum(xs) / len(xs), 2)
    return ({a: red(v) for a, v in por_anual.items()},
            {q: red(v) for q, v in por_trim.items()})


def main():
    doc = {
        "_comment": ("Contexto de la gráfica BPA: precio de la acción (último cierre del "
                     "periodo, BVL) y metales (promedio del periodo, BCRP/LME) por año y "
                     "trimestre desde 2020. Los dividendos salen de dividendos.json en la "
                     "app. Periodo en curso = lo que va de él (la app lo marca)."),
        "_generado": "extractor/fetch_bpa_contexto.py (correr tras cada trimestre nuevo)",
        "precios": {},
        "metales": {},
    }

    print("Metales (BCRP, promedio mensual LME):")
    for metal, (cod, unidad, factor) in METALES.items():
        try:
            anual, trim = metal_por_periodo(cod, factor)
            doc["metales"][metal] = {"unidad": unidad, "anual": anual, "trimestral": trim}
            print(f"  {metal:8} {unidad:7} {len(anual)} años, {len(trim)} trimestres "
                  f"(2025: {anual.get('2025')})")
        except Exception as e:
            print(f"  {metal:8} ERROR {type(e).__name__} — queda fuera")
        time.sleep(0.4)

    print("\nPrecios por periodo (BVL):")
    s = sesion_bvl()
    for c in CFG["empresas"]:
        nem = c.get("bvlNemonico")
        if not nem:
            continue
        try:
            p = precios_por_periodo(s, nem)
        except Exception as e:
            print(f"  {c['ticker']:10} ERROR {type(e).__name__}")
            p = None
        if p:
            doc["precios"][c["ticker"]] = p
            print(f"  {c['ticker']:10} {p['sim']} años:{len(p['anual'])}")
        time.sleep(0.25)

    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    print(f"\nEscrito: {SALIDA} — {len(doc['precios'])} tickers con precio, "
          f"{len(doc['metales'])} metales")


if __name__ == "__main__":
    main()
