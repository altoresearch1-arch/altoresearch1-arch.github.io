# -*- coding: utf-8 -*-
"""
Conector de precios BVL — ALTO Research.

Baja el último precio de CIERRE (del día anterior) de cada empresa desde el
endpoint público de la Bolsa de Valores de Lima:
    POST https://dataondemand.bvl.com.pe/v1/stock-quote/market
que devuelve todo el mercado con: nemonico, sell (último precio), previous
(cierre previo), previousDate (fecha de ese cierre), currency.

Genera app/src/data/precios.json keyado por ticker. La app muestra el precio
y SIEMPRE la fecha real, aclarando que es el cierre del día anterior (BVL).

Regla de Oro #1: si una acción no tiene cotización reciente, se muestra el
último cierre disponible CON su fecha (no se inventa un precio "de hoy").
"""
import json, os, requests

AQUI = os.path.dirname(os.path.abspath(__file__))
APP_DATA = os.path.normpath(os.path.join(AQUI, "..", "app", "src", "data"))
URL = "https://dataondemand.bvl.com.pe/v1/stock-quote/market"


def bajar_mercado():
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36",
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.bvl.com.pe",
        "Referer": "https://www.bvl.com.pe/mercado/movimientos-diarios",
    })
    r = s.post(URL, data="{}", timeout=40)
    r.raise_for_status()
    return r.json().get("content", [])


def main():
    with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)

    mercado = bajar_mercado()
    por_nem = {row.get("nemonico"): row for row in mercado}
    print(f"Mercado BVL: {len(mercado)} cotizaciones")

    precios = {}
    for c in cfg["empresas"]:
        nem = c.get("bvlNemonico")
        row = por_nem.get(nem)
        if not row:
            print(f"  {c['ticker']:10} nem={nem!s:10} -> NO encontrado en BVL")
            precios[c["ticker"]] = {"nemonico": nem, "precio": None, "fecha": None,
                                    "moneda": None, "encontrado": False}
            continue
        # 'last' = último precio REALMENTE transado (el cierre del día). 'sell' es la
        # orden de venta (ask) parada en pantalla, NO el cierre -> nunca usar 'sell'.
        # Si no hay 'last' (la acción no negoció hoy o la BVL no lo expone), caemos al
        # último cierre oficial: 'previous' + 'previousDate'.
        last = row.get("last")
        last_dt = row.get("lastDate")
        previo = row.get("previous")
        prev_dt = row.get("previousDate")
        neg_amt = row.get("negotiatedAmount") or 0
        ops = row.get("operationsNumber")
        nego_hoy = (neg_amt and neg_amt > 0) or (ops not in (None, "0", "0 "))

        if last is not None:
            precio = last
            fecha = (last_dt or "")[:10] or prev_dt
        else:
            precio = previo
            fecha = prev_dt

        precios[c["ticker"]] = {
            "nemonico": nem,
            "precio": precio,
            "previo": previo,
            "moneda": row.get("currency"),
            "fecha": fecha,
            "sinNegociacionReciente": not nego_hoy,
            "fuente": "BVL — movimientos diarios (dataondemand.bvl.com.pe)",
            "encontrado": True,
        }
        flag = "" if nego_hoy else "  (sin neg. reciente, usa último cierre)"
        print(f"  {c['ticker']:10} nem={nem:10} {row.get('currency')} {precio} "
              f"@ {fecha}{flag}")

    doc = {
        "_comment": ("Precios de CIERRE de la BVL (movimientos diarios). 'precio' es el "
                     "último precio de cierre; 'fecha' es el día de ese cierre (normalmente "
                     "el día hábil anterior). Generado por extractor/fetch_precios.py. "
                     "Volver a correr para actualizar."),
        "fuente": "https://www.bvl.com.pe/mercado/movimientos-diarios",
        "precios": precios,
    }
    out = os.path.join(APP_DATA, "precios.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    print(f"\nEscrito: {out}")


if __name__ == "__main__":
    main()
