# -*- coding: utf-8 -*-
"""
Conector de precios HISTÓRICOS BVL — ALTO Research.

Baja el histórico de cierres diarios (últimos ~12 meses) de cada empresa desde
el endpoint oficial de la Bolsa de Valores de Lima (el mismo que usa el gráfico
de su propia web):
    GET https://dataondemand.bvl.com.pe/v1/stock-quote/share-values/{NEMONICO}
        ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
Respuesta: {"nemonico": "BVN", "currencySymbol": "$",
            "values": [["2026-01-02","28.04"], ...]}  (solo días que negoció)

Genera app/src/data/historicos.json con, por ticker:
  - valores: [[fecha, cierre], ...] (cierres reales BVL, orden cronológico)
  - volatilidad: calculada de los retornos diarios REALES (anualizada, %),
    con etiqueta educativa (tranquila / se mueve / montaña rusa) y el
    rango 52 semanas (mín/máx). Cero datos inventados: si una empresa no
    tiene histórico, queda valores=[] y la app no muestra el gráfico.

Correr a diario junto con fetch_precios.py (robot). Descubierto el 01-jul-2026
inspeccionando main.js de bvl.com.pe (receta en extractor/FUENTES.md).
"""
import json, math, os, time
from datetime import date, timedelta

import requests

AQUI = os.path.dirname(os.path.abspath(__file__))
APP_DATA = os.path.normpath(os.path.join(AQUI, "..", "app", "src", "data"))
URL = "https://dataondemand.bvl.com.pe/v1/stock-quote/share-values/{nem}"

# Umbrales del termómetro (volatilidad anualizada de retornos diarios).
# Referencia clásica: un índice "tranquilo" ~15%, una acción típica 20-40%,
# más de 45% ya es una montaña rusa. Etiquetas educativas, no predicción.
UMBRAL_MEDIA = 22.0   # < 22%  -> "tranquila"
UMBRAL_ALTA = 45.0    # >= 45% -> "montaña rusa"

# La BVL RELLENA la serie: repite el último cierre en días sin negociación y
# manda 0.0 cuando no hay cotización. Los ceros se filtran (no son precios), y
# si la acción casi no negocia, la volatilidad calculada sobre la serie
# rellenada saldría artificialmente baja ("tranquila" una acción que en
# realidad NO SE PUEDE comprar/vender fácil). En ese caso la etiqueta honesta
# es "poco negociada" y NO se publica número de volatilidad.
MIN_FRACCION_NEGOCIADA = 0.35  # < 35% de días con cambio de precio -> ilíquida


def sesion():
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.bvl.com.pe",
        "Referer": "https://www.bvl.com.pe/",
    })
    return s


def volatilidad_anualizada(cierres):
    """Desviación estándar de retornos diarios (log), anualizada en %.
    Necesita al menos 20 observaciones para ser mínimamente seria."""
    rets = []
    for a, b in zip(cierres, cierres[1:]):
        if a and b and a > 0 and b > 0:
            rets.append(math.log(b / a))
    if len(rets) < 20:
        return None
    media = sum(rets) / len(rets)
    var = sum((r - media) ** 2 for r in rets) / (len(rets) - 1)
    return round(math.sqrt(var) * math.sqrt(252) * 100, 1)


def etiqueta_vol(vol):
    if vol is None:
        return None
    if vol < UMBRAL_MEDIA:
        return "tranquila"
    if vol < UMBRAL_ALTA:
        return "se mueve"
    return "montaña rusa"


def main():
    with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)

    hoy = date.today()
    # Desde el 1 de enero del AÑO PASADO: así la ficha puede mostrar el precio
    # real de la acción en la fecha de cada dividendo del año pasado completo.
    inicio = date(hoy.year - 1, 1, 1)
    corte_12m = (hoy - timedelta(days=365)).isoformat()
    s = sesion()

    historicos = {}
    for c in cfg["empresas"]:
        ticker, nem = c["ticker"], c.get("bvlNemonico")
        if not nem:
            historicos[ticker] = {"nemonico": None, "valores": [], "encontrado": False}
            continue
        try:
            r = s.get(URL.format(nem=nem),
                      params={"startDate": inicio.isoformat(), "endDate": hoy.isoformat()},
                      timeout=40)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            print(f"  {ticker:10} nem={nem:10} -> ERROR {e}")
            historicos[ticker] = {"nemonico": nem, "valores": [], "encontrado": False}
            continue

        crudos = data.get("values") or []
        valores = []
        for fila in crudos:
            try:
                fecha, cierre = fila[0], float(fila[1])
            except (ValueError, TypeError, IndexError):
                continue
            if cierre > 0:  # 0.0 = "sin cotización", no es un precio real
                valores.append([fecha, cierre])
        valores.sort(key=lambda x: x[0])

        # La volatilidad, el rango 52s y la liquidez se miden SOLO sobre los
        # últimos 12 meses (la serie completa llega hasta ene del año pasado,
        # pero eso es para mirar precios en fechas de dividendos, no para vol).
        cierres = [v[1] for v in valores if v[0] >= corte_12m]
        # Días en que el precio CAMBIÓ vs el día previo (negociación real).
        # La serie viene rellenada, así que repetido == no negoció (aprox).
        cambios = sum(1 for a, b in zip(cierres, cierres[1:]) if a != b)
        fraccion = (cambios / (len(cierres) - 1)) if len(cierres) > 1 else 0.0
        ilquida = fraccion < MIN_FRACCION_NEGOCIADA

        entry = {
            "nemonico": nem,
            "moneda": data.get("currencySymbol"),
            "valores": valores,
            "encontrado": bool(valores),
            "diasConCambio": cambios,
            "pocoNegociada": ilquida,
            "fuente": "BVL — histórico de cotizaciones (dataondemand.bvl.com.pe)",
        }
        if cierres:
            entry["min52"] = min(cierres)
            entry["max52"] = max(cierres)
        vol = None
        if ilquida:
            entry["volatilidadEtiqueta"] = "poco negociada"
        else:
            vol = volatilidad_anualizada(cierres)
            if vol is not None:
                entry["volatilidadAnualPct"] = vol
                entry["volatilidadEtiqueta"] = etiqueta_vol(vol)
                entry["volatilidadDias"] = len(cierres)
        historicos[ticker] = entry
        print(f"  {ticker:10} nem={nem:10} {len(valores):3} cierres  cambia {fraccion:4.0%} "
              f"de días  vol={vol if vol is not None else '—'}%  "
              f"({entry.get('volatilidadEtiqueta') or 'sin dato'})")
        time.sleep(0.6)  # cortesía con el API de la BVL

    doc = {
        "_comment": ("Histórico de cierres DIARIOS reales de la BVL (~12 meses) por ticker + "
                     "volatilidad anualizada calculada de esos cierres. Generado por "
                     "extractor/fetch_historicos.py. Correr a diario junto a fetch_precios.py."),
        "fuente": "https://dataondemand.bvl.com.pe/v1/stock-quote/share-values/{NEMONICO}",
        "generado": hoy.isoformat(),
        "historicos": historicos,
    }
    out = os.path.join(APP_DATA, "historicos.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    ok = sum(1 for h in historicos.values() if h.get("encontrado"))
    print(f"\nEscrito: {out}  ({ok}/{len(historicos)} con datos)")


if __name__ == "__main__":
    main()
