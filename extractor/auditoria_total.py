# -*- coding: utf-8 -*-
"""
AUDITORÍA TOTAL — revisión profunda de coherencia y calidad de TODA la data.
Va MÁS allá de auditoria.py: cruza contenido contra datos, busca contradicciones,
placeholders, duplicados, tips pobres, sectores rotos, monedas, etc.
No modifica nada: solo reporta. Correr: python extractor/auditoria_total.py
"""
import json, os, sys, re, unicodedata
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass
AQUI=os.path.dirname(os.path.abspath(__file__))
DATA=os.path.normpath(os.path.join(AQUI,"..","app","src","data"))
def load(f,base=DATA): return json.load(open(os.path.join(base,f),encoding='utf-8'))
def norm(s): return ''.join(c for c in unicodedata.normalize('NFD',s or '') if unicodedata.category(c)!='Mn').lower()

cfg=load("empresas_config.json",AQUI)["empresas"]
tickers=[c["ticker"] for c in cfg]
emp={e["ticker"]:e for e in load("empresas.json")["empresas"]}
px=load("precios.json")["precios"]; hist=load("historicos.json")["historicos"]
hech=load("hechos.json")["hechos"]; divs=load("dividendos.json")["empresas"]
eps=load("eps_anual.json"); epsd=eps.get("eps",{}); TC=eps.get("tipoCambioUSDPEN")
tesis=load("tesis.json")["tesis"]; tips=load("tips.json")["tips"]; catal=load("catalizadores.json")["catalizadores"]
quiz=load("quiz.json"); guias=load("guias.json")["guias"]; esc=load("escenarios.json")
term=load("terminos.json")["terminos"]

P=[]  # problemas serios
W=[]  # avisos
def p(x): P.append(x)
def w(x): W.append(x)

# 0) unicidad de tickers
if len(tickers)!=len(set(tickers)): p(f"TICKERS DUPLICADOS en config: {[t for t in tickers if tickers.count(t)>1]}")

# 1) sectores integrados
secs=sorted(set(c["sector"] for c in cfg))
for s in secs:
    if s not in quiz["sectores"]: p(f"sector '{s}' falta en quiz.sectores")
    if s not in guias: p(f"sector '{s}' falta en guias")
    if s not in esc["movimiento"]: p(f"sector '{s}' falta en escenarios.movimiento (Simulador se rompe)")
    if s not in esc["condiciones"]: p(f"sector '{s}' falta en escenarios.condiciones")
# opción de sector en el quiz
opsec=set()
for pr in quiz.get("preguntas",[]):
    for o in pr.get("opciones",[]):
        if o.get("valor"): opsec.add(o["valor"])
for s in secs:
    if s not in opsec: w(f"sector '{s}' no aparece como opción en el quiz (revisar pregunta de sector)")

# 2) por empresa: presencia + placeholders + coherencia
for t in tickers:
    e=emp.get(t)
    if not e: p(f"{t}: sin entrada en empresas.json"); continue
    # placeholders
    def es_placeholder(s):
        s=norm(s)
        return ("jair escribe" in s or s.startswith("pendiente:") or "pendiente de verificar" in s
                or "pendiente: jair" in s or "por completar" in s)
    tx=tesis.get(t,"")
    if not tx: p(f"{t}: sin tesis")
    elif es_placeholder(tx): p(f"{t}: tesis con placeholder -> {tx[:50]}")
    tp=tips.get(t,[])
    if not tp: p(f"{t}: sin tips")
    else:
        if len(tp)<5: w(f"{t}: solo {len(tp)} tips (<5)")
        if any(es_placeholder(x) for x in tp): p(f"{t}: tip con placeholder")
        # duplicados exactos dentro de la empresa
        nn=[norm(x) for x in tp]
        if len(nn)!=len(set(nn)): w(f"{t}: tiene TIPS DUPLICADOS")
    if not catal.get(t): p(f"{t}: sin catalizadores")
    elif any(es_placeholder(c.get("texto","")) for c in catal[t]): w(f"{t}: catalizador con placeholder")
    # precio / historico / hechos
    pr=px.get(t) or {}
    if pr.get("precio") is None: w(f"{t}: sin precio BVL (no negocia)")
    if not (hist.get(t) or {}).get("encontrado"): w(f"{t}: sin histórico BVL")
    if not (hech.get(t) or {}).get("encontrado"): w(f"{t}: sin Hechos de Importancia")
    ext=e.get("_extraccion") or {}
    if not ext.get("ok") and ext.get("motivo") not in ("no_aplica_es_fondo",):
        w(f"{t}: SMV {ext.get('motivo')} (fundamentos pendientes)")

    # 3) COHERENCIA tesis/tips vs dividendos
    d=divs.get(t)
    paga = bool(d and (d.get("yield") or d.get("porAnio")))
    reciente = bool(d and (d.get("yield") or any(k>='2025' for k in (d.get("porAnio") or {}))))
    blob=norm(tx+" "+" ".join(tp)+" "+" ".join(c.get("texto","") for c in (catal.get(t) or [])))
    # afirmación de que PAGA: yield explícito, o 'paga/reparte dividendos' NO negado ni condicional
    afirma_paga = bool(re.search(r"rinde ~?\d", blob)) or bool(re.search(r"(?<!no )(paga|reparte) dividendos (altos|con regularidad|crecientes|regulares|grandes|peque|trimestral|\d)", blob))
    dice_nopaga = ("no reparte dividendo" in blob or "no paga dividendo" in blob or "no registra pago" in blob or "no ha registrado" in blob or "sin pagos" in blob or "no figuran dividendo" in blob)
    if afirma_paga and not paga:
        p(f"{t}: AFIRMA que paga dividendos pero NO hay data -> revisar")
    if reciente and dice_nopaga:
        w(f"{t}: dice que NO paga pero SÍ tiene dividendo reciente -> revisar")

    # 4) P/E sanidad (repite auditoria pero con criterio)
    ea=epsd.get(t,{}); precio=pr.get("precio"); epsA=ea.get("epsAnual")
    if precio and epsA and epsA>0:
        monpx="USD" if (pr.get("moneda") or "").strip()=="US$" else "PEN"
        ev=epsA
        if monpx!=ea.get("moneda") and TC: ev=epsA*TC if ea["moneda"]=="USD" else epsA/TC
        pe=precio/ev
        if pe<1 or pe>80: w(f"{t}: P/E {pe:.1f} fuera de rango (revisar con criterio)")

# 5) yields altos
for t in tickers:
    d=divs.get(t)
    if d and d.get("yield"):
        try:
            y=float(str(d["yield"]).replace("%",""))
            if y>20: w(f"{t}: yield {y}% (>20%: extraordinario o precio viejo — la app avisa sola)")
        except ValueError: pass

# 6) términos: definiciones vacías / muy cortas
for k,v in term.items():
    if not v or len(v)<15: p(f"término '{k}' con definición vacía o muy corta")

# 7) resumen
print("="*64)
print(f"AUDITORÍA TOTAL — {len(tickers)} valores | {len(secs)} sectores: {', '.join(secs)}")
print(f"terminos.json: {len(term)} | tips promedio: {round(sum(len(v) for v in tips.values() if isinstance(v,list))/max(1,len(tips)),1)}")
print("="*64)
if P:
    print(f"\n❌ PROBLEMAS SERIOS ({len(P)}):")
    for x in P: print("  -",x)
else:
    print("\n✅ Sin problemas serios de coherencia.")
print(f"\n⚠️  AVISOS ({len(W)}):")
for x in W: print("  -",x)
print(f"\nFin. Problemas: {len(P)} | Avisos: {len(W)}")
sys.exit(1 if P else 0)
