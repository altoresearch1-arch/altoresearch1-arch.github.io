# -*- coding: utf-8 -*-
"""
Beneficios (dividendos en efectivo) por VALOR — vía API de emisores de la BVL.

    GET https://dataondemand.bvl.com.pe/v1/issuers
    -> [{rpjCode, listValue: [{nemonico, listBenefit: [{benefitType:"DE",
        benefitValue, coin, dateAgreement, dateCut, dateDelivery, ...}]}]}]

Complementa Y CORRIGE a div_stockanalysis.py:
  1. Llena los tickers que stockanalysis no cubre (FIBRAs, chicas): FIBPRIME
     tiene 47 distribuciones desde 2019 y salía "no reparte".
  2. CORRIGE LA MONEDA: stockanalysis convierte el dividendo a la moneda en
     que COTIZA la acción; pero 14 empresas (Nexa, Minsur, Poderosa, Engie,
     Hermes, INDECO, …) DECLARAN en US$ aunque coticen en S/. La BVL trae la
     moneda REAL de cada pago (campo `coin`) → si difiere de lo que quedó en
     dividendos.json, se reconstruye la entrada desde la BVL (hallazgo de
     Jair, 02-jul-2026: "el dividendo de Nexa lo da en dólares").
El yield se convierte con el tipo de cambio (eps_anual.json) cuando la moneda
del dividendo difiere de la del precio.

Descubierto el 02-jul-2026 (mismo API /v1/issuers de los rpjCodes).
Correr a diario en el robot DESPUÉS de div_stockanalysis.py.
"""
import json, os
from datetime import date, timedelta

import requests

AQUI = os.path.dirname(os.path.abspath(__file__))
APP_DATA = os.path.normpath(os.path.join(AQUI, "..", "app", "src", "data"))
MESES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def fecha_en(iso):
    """'2026-06-26' -> 'Jun 26, 2026' (mismo formato que stockanalysis)."""
    a, m, d = iso[:10].split("-")
    return f"{MESES_EN[int(m)-1]} {int(d)}, {a}"


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def main():
    with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    pdiv = os.path.join(APP_DATA, "dividendos.json")
    with open(pdiv, encoding="utf-8") as f:
        divs = json.load(f)
    with open(os.path.join(APP_DATA, "precios.json"), encoding="utf-8") as f:
        precios = json.load(f)["precios"]
    try:
        with open(os.path.join(APP_DATA, "eps_anual.json"), encoding="utf-8") as f:
            fx = json.load(f).get("tipoCambioUSDPEN")
    except Exception:
        fx = None

    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.bvl.com.pe", "Referer": "https://www.bvl.com.pe/",
    })
    emisores = s.get("https://dataondemand.bvl.com.pe/v1/issuers", timeout=90).json()
    por_rpj = {e.get("rpjCode"): e for e in emisores}

    hoy = date.today()
    hace12m = (hoy - timedelta(days=365)).isoformat()
    parchados = 0
    for c in cfg["empresas"]:
        t, rpj, nem = c["ticker"], c.get("bvlRpj"), c.get("bvlNemonico")
        emisor = por_rpj.get(rpj)
        if not emisor:
            continue
        valor = next((v for v in emisor.get("listValue") or []
                      if v.get("nemonico") == nem), None)
        if not valor:
            continue
        # solo dividendos en EFECTIVO (DE); otros tipos (liberadas, etc.) no son plata
        bens = [b for b in valor.get("listBenefit") or []
                if b.get("benefitType") == "DE" and num(b.get("benefitValue"))]
        if not bens:
            continue
        bens.sort(key=lambda b: b.get("dateCut") or b.get("dateAgreement") or "", reverse=True)

        # moneda REAL: la más frecuente entre los últimos pagos (la BVL manda 'S/.' a veces)
        coins = [(b.get("coin") or "").strip().replace("S/.", "S/") for b in bens[:4]]
        moneda = max(set(coins), key=coins.count) if coins else "S/"
        if not moneda:
            moneda = "S/"

        ya = divs["empresas"].get(t)
        sim_app = (ya.get("anualSim") or "").strip() if ya else ""
        tiene_datos = bool(ya and (ya.get("historial") or ya.get("porAnio")))
        moneda_mal = tiene_datos and sim_app and sim_app != moneda and \
            not (sim_app in moneda or moneda in sim_app)
        if tiene_datos and not moneda_mal:
            continue  # stockanalysis está bien: no pisar
        motivo = "moneda corregida (BVL declara en " + moneda + ")" if moneda_mal else "sin datos en stockanalysis"
        historial = []
        por_anio_num, n_por_anio = {}, {}
        suma_12m = 0.0
        for b in bens:
            corte = (b.get("dateCut") or b.get("dateAgreement") or "")[:10]
            monto = num(b.get("benefitValue"))
            if not corte or monto is None:
                continue
            anio = corte[:4]
            por_anio_num[anio] = por_anio_num.get(anio, 0.0) + monto
            n_por_anio[anio] = n_por_anio.get(anio, 0) + 1
            if corte >= hace12m:
                suma_12m += monto
            if len(historial) < 12:
                historial.append({"fecha": fecha_en(corte), "monto": monto,
                                  "moneda": (b.get("coin") or moneda).strip() or moneda})

        px = precios.get(t) or {}
        yld = None
        mon_px = (px.get("moneda") or "").strip().replace("S/.", "S/")
        if suma_12m > 0 and px.get("precio"):
            if mon_px == moneda:
                yld = round(suma_12m / px["precio"] * 100, 2)
            elif fx and moneda == "US$" and mon_px == "S/":
                yld = round(suma_12m * fx / px["precio"] * 100, 2)
            elif fx and moneda == "S/" and mon_px == "US$":
                yld = round(suma_12m / fx / px["precio"] * 100, 2)

        n12 = sum(1 for b in bens if (b.get("dateCut") or "")[:10] >= hace12m)
        frecuencia = ("Mensual" if n12 >= 10 else "Trimestral" if n12 >= 3
                      else "Semi" if n12 == 2 else "Anual" if n12 == 1 else None)
        divs["empresas"][t] = {
            "anual": f"{moneda} {round(suma_12m, 4)}" if suma_12m > 0 else None,
            "anualNum": round(suma_12m, 6) if suma_12m > 0 else None,
            "anualSim": moneda,
            "yield": f"{yld}%" if yld is not None else None,
            "payout": None,
            "frecuencia": frecuencia,
            "porAnio": {a: f"{moneda} {round(v, 4)}" for a, v in sorted(por_anio_num.items(), reverse=True)},
            "porAnioNum": {a: round(v, 6) for a, v in sorted(por_anio_num.items(), reverse=True)},
            "nPorAnio": dict(sorted(n_por_anio.items(), reverse=True)),
            "historial": historial,
            "fuente": "BVL — beneficios del emisor (dataondemand /v1/issuers)",
            "_motivo": motivo,
        }
        parchados += 1
        print(f"  {t:10} {len(bens):3} pagos DE  últ.12m={moneda} {round(suma_12m,4)}"
              f"  yield={yld if yld is not None else '—'}%  frec={frecuencia}  [{motivo}]")

    with open(pdiv, "w", encoding="utf-8") as f:
        json.dump(divs, f, ensure_ascii=False, indent=2)
    print(f"\nParchados {parchados} tickers en dividendos.json (fuente BVL beneficios)")


if __name__ == "__main__":
    main()
