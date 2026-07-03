# -*- coding: utf-8 -*-
"""
Corre el extractor para UNA sola empresa (por ticker) y parcha su entrada en:
  - extractor/salida_smv.json
  - app/src/data/empresas.json
sin tocar las demás. Útil cuando el portal SMV falló solo para una
(timeout puntual) y no queremos arriesgar re-descargar las 48.

Uso:  python extractor/run_uno.py NEXAPEC1

Regla de Oro #1: si la SMV no da el dato, queda null -> "Pendiente de verificar (SMV)".
"""
import json, os, sys, time
from smv_extractor import nueva_sesion, fetch_empresa
from run_batch import construir_empresa, AQUI, APP_DATA

INTENTOS = 5


def main():
    if len(sys.argv) != 2:
        print("Uso: python run_uno.py <TICKER>")
        sys.exit(1)
    ticker = sys.argv[1].upper()

    with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)

    c = next((e for e in cfg["empresas"] if e["ticker"].upper() == ticker), None)
    if not c:
        print(f"Ticker {ticker} no está en empresas_config.json")
        sys.exit(1)

    s = nueva_sesion()
    print(f"[{c['sector']:10}] {c['ticker']:10} smvId={c['smvId']} ...", flush=True)
    res = {"ok": False, "motivo": "sin_intentos"}
    for intento in range(INTENTOS):
        try:
            res = fetch_empresa(s, c["smvId"], cfg["anio"], cfg["trimestre"])
            if res.get("ok"):
                break
        except Exception as e:
            res = {"ok": False, "motivo": f"error:{type(e).__name__}:{e}"}
        print(f"  intento {intento+1}/{INTENTOS} falló: {res.get('motivo')}")
        time.sleep(3)

    emp = construir_empresa(c, res)
    if res.get("ok"):
        d = res["datos"]
        print(f"OK  {d.get('moneda')}  activos={d.get('activos')}  cierre={d.get('fechaCierre')}")
    else:
        print(f"FALLO  {res.get('motivo')}")

    # Parchar salida_smv.json (volcado crudo)
    ruta_cruda = os.path.join(AQUI, "salida_smv.json")
    if os.path.exists(ruta_cruda):
        with open(ruta_cruda, encoding="utf-8") as f:
            salida_cruda = json.load(f)
    else:
        salida_cruda = {}
    salida_cruda[c["ticker"]] = {"cfg": c, "res": res}
    with open(ruta_cruda, "w", encoding="utf-8") as f:
        json.dump(salida_cruda, f, ensure_ascii=False, indent=2)

    # Parchar empresas.json de la app (solo la entrada de este ticker)
    ruta_app = os.path.join(APP_DATA, "empresas.json")
    with open(ruta_app, encoding="utf-8") as f:
        doc = json.load(f)
    idx = next((i for i, e in enumerate(doc["empresas"])
                if e["ticker"].upper() == ticker), None)
    if idx is None:
        print(f"OJO: {ticker} no estaba en empresas.json; lo agrego al final.")
        doc["empresas"].append(emp)
    else:
        doc["empresas"][idx] = emp
    doc["_generado"] = time.strftime("%Y-%m-%d %H:%M") + f" (parche {ticker} por run_uno.py)"
    with open(ruta_app, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    print(f"Parchado: {ruta_app}")


if __name__ == "__main__":
    main()
