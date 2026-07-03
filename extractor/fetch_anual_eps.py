# -*- coding: utf-8 -*-
"""
Baja la GANANCIA POR ACCIÓN ANUAL 2025 (individual) de la SMV para cada empresa,
y el tipo de cambio USD/PEN de internet. Sirve para calcular el P/E
(P/E = precio actual ÷ EPS anual, en la misma moneda).

Escribe app/src/data/eps_anual.json.
"""
import sys, json, os, requests
sys.stdout.reconfigure(encoding="utf-8")
from smv_extractor import (nueva_sesion, buscar_documentos, descargar,
                           parsear_xbrl, parsear_detalle_banco)

AQUI = os.path.dirname(os.path.abspath(__file__))
APP_DATA = os.path.normpath(os.path.join(AQUI, "..", "app", "src", "data"))
with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
    CFG = json.load(f)


def tipo_cambio_usdpen():
    """Tipo de cambio USD->PEN (soles por dólar) de internet."""
    for url in ("https://open.er-api.com/v6/latest/USD",
                "https://api.exchangerate.host/latest?base=USD&symbols=PEN"):
        try:
            r = requests.get(url, timeout=20)
            j = r.json()
            rate = (j.get("rates") or {}).get("PEN")
            if rate:
                return round(float(rate), 4), url
        except Exception:
            continue
    return None, None


def main():
    s = nueva_sesion()
    eps_anual = {}
    for c in CFG["empresas"]:
        tk = c["ticker"]
        eps = moneda = None
        for intento in range(2):
            try:
                docs = buscar_documentos(s, c["smvId"], anio=2025, trimestre=4, periodo="A")
                if docs.get("xbrl"):
                    d = parsear_xbrl(descargar(s, docs["xbrl"]))
                    eps = d.get("epsBasico")
                    moneda = c.get("monedaForzada") or d.get("moneda")
                elif docs.get("detalle"):
                    d = parsear_detalle_banco(descargar(s, docs["detalle"]))
                    eps = d.get("epsBasico")
                    moneda = d.get("moneda")
                if eps is not None:
                    break
            except Exception as e:
                print(f"   {tk} intento {intento}: {type(e).__name__}")
        eps_anual[tk] = {"epsAnual": eps, "moneda": moneda, "anio": 2025,
                         "fuente": "SMV — EE.FF. individuales anuales 2025, utilidad básica por acción"}
        print(f"  {tk:10} EPS anual 2025: {moneda} {eps}")

    tc, tc_url = tipo_cambio_usdpen()
    print(f"\nTipo de cambio USD/PEN: {tc}  ({tc_url})")

    doc = {
        "_comment": ("EPS ANUAL 2025 (individual, SMV) para calcular el P/E = precio ÷ EPS anual. "
                     "tipoCambioUSDPEN: soles por dólar, de internet, para convertir cuando el "
                     "precio y el EPS están en distinta moneda (NEXA, Exalmar)."),
        "tipoCambioUSDPEN": tc,
        "tipoCambioFuente": tc_url,
        "eps": eps_anual,
    }
    out = os.path.join(APP_DATA, "eps_anual.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    print(f"\nEscrito: {out}")


if __name__ == "__main__":
    main()
