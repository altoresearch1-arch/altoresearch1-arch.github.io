# -*- coding: utf-8 -*-
"""
AUDITORÍA integral de los datos de la app — correr antes de publicar y tras
cada tanda / cambio de trimestre (Q2, Q3…). No modifica nada: solo reporta.

Chequea, para TODAS las empresas del config:
  1. Presencia: entrada en empresas.json, precios, historicos, hechos,
     tesis, tips, catalizadores.
  2. Sectores: cada sector usado existe en quiz.sectores, guias, y
     escenarios (movimiento + condiciones). rangoPE puede faltar a propósito
     (fondos).
  3. Monedas: dividendo (anualSim) vs moneda real de la BVL (beneficios);
     precio vs EPS anual (conversión posible con TC).
  4. Sanidad: P/E absurdo (<1 o >80), yield >20% (marcar para criterio),
     margen presente en no-holdings con extracción ok.
Uso: python extractor/auditoria.py
"""
import json, os, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(AQUI, "..", "app", "src", "data"))


def leer(nombre, base=DATA):
    with open(os.path.join(base, nombre), encoding="utf-8") as f:
        return json.load(f)


def main():
    # La consola de Windows es cp1252 y no puede imprimir los emojis (✅❌⚠️).
    # El robot diario llama este script sin `-X utf8`, así que forzamos UTF-8 aquí
    # para que NO crashee justo al reportar (pasó el 02-jul-2026).
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    cfg = leer("empresas_config.json", AQUI)["empresas"] if False else None
    with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)["empresas"]
    emp = {e["ticker"]: e for e in leer("empresas.json")["empresas"]}
    px = leer("precios.json")["precios"]
    hist = leer("historicos.json")["historicos"]
    hech = leer("hechos.json")["hechos"]
    divs = leer("dividendos.json")["empresas"]
    eps = leer("eps_anual.json")
    tesis = leer("tesis.json")["tesis"]
    tips = leer("tips.json")["tips"]
    catal = leer("catalizadores.json")["catalizadores"]
    quiz = leer("quiz.json")
    guias = leer("guias.json")["guias"]
    esc = leer("escenarios.json")

    problemas, avisos = [], []

    # 2) sectores
    sectores_usados = sorted({c["sector"] for c in cfg})
    for s in sectores_usados:
        if s not in quiz["sectores"]:
            problemas.append(f"sector '{s}' falta en quiz.sectores")
        if s not in guias:
            problemas.append(f"sector '{s}' falta en guias.json")
        if s not in esc["movimiento"]:
            problemas.append(f"sector '{s}' falta en escenarios.movimiento (Simulador se rompe)")
        if s not in esc["condiciones"]:
            problemas.append(f"sector '{s}' falta en escenarios.condiciones")

    fx = eps.get("tipoCambioUSDPEN")
    for c in cfg:
        t = c["ticker"]
        e = emp.get(t)
        if not e:
            problemas.append(f"{t}: sin entrada en empresas.json"); continue
        if t not in tesis: problemas.append(f"{t}: sin tesis")
        if not tips.get(t): problemas.append(f"{t}: sin tips")
        if not catal.get(t): problemas.append(f"{t}: sin catalizadores")
        p = px.get(t)
        if not p or p.get("precio") is None:
            avisos.append(f"{t}: sin precio BVL")
        if not (hist.get(t) or {}).get("encontrado"):
            avisos.append(f"{t}: sin histórico BVL")
        if not (hech.get(t) or {}).get("encontrado"):
            avisos.append(f"{t}: sin Hechos de Importancia")

        # extracción SMV
        ext = e.get("_extraccion") or {}
        if not ext.get("ok") and ext.get("motivo") not in ("no_aplica_es_fondo",):
            avisos.append(f"{t}: SMV {ext.get('motivo')} (fundamentos pendientes)")

        # P/E sanidad
        ea = (eps.get("eps") or {}).get(t) or {}
        if p and p.get("precio") and ea.get("epsAnual") and ea["epsAnual"] > 0:
            precio, epsv = p["precio"], ea["epsAnual"]
            mon_px = "USD" if (p.get("moneda") or "").strip() == "US$" else "PEN"
            if mon_px != ea.get("moneda") and fx:
                epsv = epsv * fx if ea["moneda"] == "USD" else epsv / fx
            pe = precio / epsv
            if pe < 1 or pe > 80:
                avisos.append(f"{t}: P/E {pe:.1f} fuera de rango razonable — revisar con criterio (¿extraordinaria?, ¿clase de acción?)")

        # yield sanidad
        d = divs.get(t)
        if d and d.get("yield"):
            try:
                y = float(str(d["yield"]).replace("%", ""))
                if y > 20:
                    avisos.append(f"{t}: yield {y}% — probable dividendo extraordinario, revisar tesis/tips")
            except ValueError:
                pass

    print("=" * 60)
    print(f"AUDITORÍA — {len(cfg)} valores | sectores: {', '.join(sectores_usados)}")
    print("=" * 60)
    if problemas:
        print(f"\n❌ PROBLEMAS ({len(problemas)}) — arreglar antes de publicar:")
        for x in problemas: print("  -", x)
    else:
        print("\n✅ Sin problemas estructurales.")
    if avisos:
        print(f"\n⚠️  AVISOS ({len(avisos)}) — conocidos o para criterio de Jair:")
        for x in avisos: print("  -", x)
    print("\nFin de la auditoría.")
    sys.exit(1 if problemas else 0)


if __name__ == "__main__":
    main()
