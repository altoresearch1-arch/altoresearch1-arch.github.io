# -*- coding: utf-8 -*-
"""
🔗 SINCRONIZAR UNIVERSO — que ninguna empresa del config se quede fuera de la app.

EL PROBLEMA QUE RESUELVE (detectado 02-ago-2026)
────────────────────────────────────────────────
`empresas_config.json` es la lista maestra: de ahí salen los precios, los
históricos y las noticias. Pero la app NO lee ese archivo — lee
`empresas.json`, que lo genera `run_batch.py`, que es el paso TRIMESTRAL de la
SMV (lento y flaky).

Resultado: cuando se agrega una empresa al config, baja precios e históricos
correctamente… y la app no la muestra, porque `filasRadar` busca el ticker en
`empresas.json` y no lo encuentra. Queda invisible hasta el próximo cambio de
trimestre — meses después.

Pasó con los 36 ETF y con nuam el mismo día que se agregaron. Y antes, en
silencio, con Rio2: cotizaba en la BVL con 393 cierres y la app decía "no
cotiza en BVL".

QUÉ HACE
────────
Recorre el config y, por cada ticker que NO esté en empresas.json, agrega una
entrada MÍNIMA: ticker, nombre, sector y nemónico. Lo justo para que el Radar,
el Sonar y el buscador la vean.

QUÉ NO HACE, Y ES DELIBERADO
────────────────────────────
NO toca ninguna empresa que ya exista. Los fundamentos de la SMV (activos,
utilidad, BPA, tesis, catalizadores) los pone `run_batch.py` y son la fuente
buena: este script jamás los pisa ni los inventa. Una empresa agregada acá
aparece SIN fundamentos —porque no los tiene todavía— y eso es honesto: mejor
un ETF con precio y volumen reales que un ETF con un balance inventado.

Va en el robot diario, después de fetch_historicos. Es idempotente: si no
falta nadie, no escribe.

Uso:  python extractor/sincronizar_universo.py
"""
import io, json, os, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

AQUI = os.path.dirname(os.path.abspath(__file__))
APP_DATA = os.path.normpath(os.path.join(AQUI, "..", "app", "src", "data"))
CONFIG = os.path.join(AQUI, "empresas_config.json")
EMPRESAS = os.path.join(APP_DATA, "empresas.json")


def main():
    with open(CONFIG, encoding="utf-8") as f:
        cfg = json.load(f)
    with open(EMPRESAS, encoding="utf-8") as f:
        doc = json.load(f)

    ya = {e["ticker"] for e in doc.get("empresas", [])}
    faltan = [c for c in cfg["empresas"] if c["ticker"] not in ya]
    if not faltan:
        print(f"Universo sincronizado: las {len(ya)} del config ya están en la app.")
        return

    for c in faltan:
        doc["empresas"].append({
            "ticker": c["ticker"],
            "nombre": c.get("nombre") or c["ticker"],
            "sector": c.get("sector") or "diversas",
            "bvlNemonico": c.get("bvlNemonico"),
            "smvId": c.get("smvId"),
            "tipoLectura": c.get("tipoLectura") or "industrial",
            "perfiles": c.get("perfiles") or [],
            "perfilesTentativos": True,
            # La marca honesta: esta entrada la puso el sincronizador, no la
            # SMV. La app puede usarla para no prometer una ficha completa.
            "sinFundamentos": True,
            "_origen": ("sincronizar_universo.py — está en empresas_config.json y "
                        "tiene precio real de la BVL, pero todavía no pasó por "
                        "run_batch (SMV). Sin fundamentos hasta el próximo "
                        "trimestral; eso es correcto, no un error."),
        })

    doc["empresas"].sort(key=lambda e: (e.get("sector") or "", e["ticker"]))
    with open(EMPRESAS, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)

    print(f"Agregadas {len(faltan)} a empresas.json (ahora {len(doc['empresas'])}):")
    for c in faltan:
        print(f"   {c['ticker']:10} {(c.get('nombre') or '')[:52]}")


if __name__ == "__main__":
    main()
