# -*- coding: utf-8 -*-
"""
Corrige los EPS anuales DISTORSIONADOS parchando eps_anual.json con el
"EPS (ttm)" real de stockanalysis. Correr SIEMPRE después de fetch_anual_eps
(el extractor SMV pisa estas correcciones si no).

¿Por qué se distorsionan? Clases de acción (común vs inversión), holdings
(individual = dividendos de filiales) y monedas hacen que el EPS del XBRL no
corresponda a la acción que cotiza (ej.: Minsur daba P/E 0.1, InRetail 102).
stockanalysis calcula el EPS ttm de la ACCIÓN que cotiza en la BVL, en su
moneda de cotización.

Lista de tickers en TICKERS (agregar aquí los que la auditoría marque).
Regla de Oro #6: cada corrección guarda su fuente.
"""
import json, os, re, time

import requests

AQUI = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(AQUI, "..", "app", "src", "data"))

# Tickers cuyo EPS del XBRL individual NO representa a la acción que cotiza.
# (los 6 primeros ya se habían corregido el 26-jun; el rerun del extractor los pisó)
TICKERS = ["MINSURI1", "BACKUSI1", "INRETC1", "IFS", "VOLCABC1", "MINCORI1",
           "BAP", "COCESUI1"]


def eps_ttm(s, ticker):
    """EPS ttm implícito del overview de stockanalysis: Previous Close ÷ PE Ratio
    (ambos en la moneda en que cotiza la acción en la BVL)."""
    r = s.get(f"https://stockanalysis.com/quote/bvl/{ticker}/", timeout=30)
    if r.status_code != 200:
        return None
    datos = dict(re.findall(r'<td[^>]*>([A-Za-z ./%()&;#\d-]+?)</td><td[^>]*>([^<]+)</td>', r.text))
    try:
        pe = float(str(datos.get("PE Ratio", "")).replace(",", ""))
        cierre = float(str(datos.get("Previous Close", "")).replace(",", ""))
    except ValueError:
        return None
    if pe <= 0 or cierre <= 0:
        return None
    return round(cierre / pe, 4)


def main():
    with open(os.path.join(DATA, "eps_anual.json"), encoding="utf-8") as f:
        eps = json.load(f)
    with open(os.path.join(DATA, "precios.json"), encoding="utf-8") as f:
        precios = json.load(f)["precios"]

    s = requests.Session()
    s.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36"})

    for t in TICKERS:
        v = eps_ttm(s, t)
        if v is None or v == 0:
            print(f"  {t:10} sin EPS ttm en stockanalysis — queda el de la SMV (revisar a mano)")
            continue
        px = precios.get(t) or {}
        moneda = "USD" if (px.get("moneda") or "").strip() == "US$" else "PEN"
        eps["eps"][t] = {
            "epsAnual": v,
            "moneda": moneda,
            "anio": "ttm",
            "fuente": "stockanalysis — EPS (ttm) de la acción que cotiza en BVL "
                      "(el XBRL individual distorsiona por clase de acción/holding)",
        }
        pe = round(px["precio"] / v, 1) if px.get("precio") and v > 0 else None
        print(f"  {t:10} EPS ttm={v} {moneda}  -> P/E {pe}")
        time.sleep(0.7)

    with open(os.path.join(DATA, "eps_anual.json"), "w", encoding="utf-8") as f:
        json.dump(eps, f, ensure_ascii=False, indent=2)
    print("\neps_anual.json parchado. (Correr auditoria.py para confirmar.)")


if __name__ == "__main__":
    main()
