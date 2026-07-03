# -*- coding: utf-8 -*-
"""
Verificación COMPLETA de las 17 empresas: cruza nuestra extracción (XBRL/salida_smv.json)
contra la página de DETALLE oficial de la SMV (renderizado independiente). Compara
Total activos / pasivos / patrimonio / utilidad neta y revisa la moneda.

Heurística de moneda: si el XBRL dice USD pero la empresa NO es minera ni pesquera
exportadora, se marca para revisar (así se habría cazado el error de Alicorp).
"""
import sys, re, json, os
sys.stdout.reconfigure(encoding="utf-8")
from bs4 import BeautifulSoup
from smv_extractor import nueva_sesion, buscar_documentos, descargar

AQUI = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(AQUI, "salida_smv.json"), encoding="utf-8") as f:
    SALIDA = json.load(f)
with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
    CFG = json.load(f)

# sectores donde el USD es esperable
USD_OK = {"minas"}  # mineras; pesqueras exportadoras se validan aparte (Exalmar)

def num(s):
    s = (s or "").strip()
    neg = s.startswith("(") and s.endswith(")")
    s = s.strip("()").replace(",", "")
    try:
        v = float(s)
    except ValueError:
        return None
    return -v if neg else v

def detalle_valores(soup):
    """Extrae etiqueta->primer valor numérico (col del periodo actual) de todas las filas."""
    vals = {}
    for tr in soup.find_all("tr"):
        celdas = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
        if len(celdas) < 3:
            continue
        et = re.sub(r"\s+", " ", celdas[0]).strip().upper()
        v = num(celdas[2])
        if et and et not in vals and v is not None:
            vals[et] = v
    return vals

def buscar(vals, *claves):
    for k in claves:
        if k in vals:
            return vals[k]
    return None

s = nueva_sesion()
print(f"{'TICKER':10} {'SECTOR':10} {'MON':4} {'ACTIVOS (SMV detalle vs XBRL)':32} {'PASIVOS':10} {'PATRIM':10} {'ESTADO'}")
print("-" * 100)

problemas = []
for c in CFG["empresas"]:
    tk = c["ticker"]
    sector = c["sector"]
    sal = SALIDA.get(tk, {})
    datos = (sal.get("res") or {}).get("datos") or {}
    moneda_xbrl = datos.get("moneda")
    moneda_final = c.get("monedaForzada") or moneda_xbrl
    a_units = datos.get("activos")
    p_units = datos.get("pasivos")
    pat_units = datos.get("patrimonio")

    docs = buscar_documentos(s, c["smvId"])
    estado = "OK"
    smv_a = smv_p = smv_pat = None
    unidad = "?"
    if docs.get("detalle"):
        raw = descargar(s, docs["detalle"])
        try:
            txt = raw.decode("utf-8")
        except UnicodeDecodeError:
            txt = raw.decode("cp1252", errors="replace")
        soup = BeautifulSoup(txt, "lxml")
        full = soup.get_text(" ", strip=True).upper()
        unidad = "USD" if "MILES DE DOLAR" in full else ("PEN" if "MILES DE NUEVOS SOL" in full or "MILES DE SOL" in full else "?")
        vals = detalle_valores(soup)
        smv_a = buscar(vals, "TOTAL DE ACTIVOS", "TOTAL DEL ACTIVO", "TOTAL ACTIVO")
        smv_p = buscar(vals, "TOTAL DE PASIVOS", "TOTAL DEL PASIVO", "TOTAL PASIVOS")
        smv_pat = buscar(vals, "TOTAL PATRIMONIO", "TOTAL DE PATRIMONIO", "TOTAL DEL PATRIMONIO")

    # comparar (detalle en miles, XBRL en unidades -> /1000)
    def cmp(units, miles):
        if units is None or miles is None:
            return "?"
        return "✓" if abs(units / 1000 - miles) <= max(2, miles * 0.001) else "✗DIF"

    m_a = cmp(a_units, smv_a)
    if m_a == "✗DIF":
        estado = "REVISAR cifras"
        problemas.append(f"{tk}: activos XBRL {a_units} vs SMV {smv_a}")

    # heurística de moneda
    if moneda_final == "USD" and sector not in USD_OK and tk not in ("EXALMC1",):
        estado = "REVISAR moneda(USD?)"
        problemas.append(f"{tk}: moneda USD inesperada para sector {sector}")
    if unidad != "?" and unidad != moneda_xbrl and not c.get("monedaForzada"):
        estado = f"MON detalle={unidad}≠xbrl={moneda_xbrl}"

    av = f"{(a_units/1e6):,.1f} vs {(smv_a/1000/1e6):,.1f}M {m_a}" if (a_units and smv_a) else "—"
    print(f"{tk:10} {sector:10} {moneda_final or '?':4} {av:32} "
          f"{cmp(p_units,smv_p):10} {cmp(pat_units,smv_pat):10} {estado}")

print("\n" + ("Sin problemas: todas cuadran." if not problemas else "PROBLEMAS:"))
for p in problemas:
    print("  -", p)
