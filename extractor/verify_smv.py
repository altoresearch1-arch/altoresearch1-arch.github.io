# -*- coding: utf-8 -*-
"""
Verificación: cruza la página de DETALLE oficial de la SMV (como la ve un humano)
contra lo que parseamos. Una empresa por sector. Confirma que las cifras coinciden
y muestra cómo se llama cada línea en su sector (el documento ES distinto por sector).
"""
import sys, re
sys.stdout.reconfigure(encoding="utf-8")
from bs4 import BeautifulSoup
from smv_extractor import nueva_sesion, buscar_documentos, descargar

# una empresa representativa por sector
MUESTRA = [
    ("minas", 59, "NEXA RESOURCES PERU"),
    ("bancos", 24, "BANCO BBVA PERU"),
    ("alimentos", 73, "ALICORP"),
    ("textil", 198, "CREDITEX"),
    ("acereras", 43173, "ACEROS AREQUIPA"),
    ("pesqueras", 112995, "PESQUERA EXALMAR"),
]

# etiquetas clave a buscar (varían por sector)
CLAVES = [
    "TOTAL DE ACTIVOS", "TOTAL ACTIVOS", "TOTAL DEL ACTIVO",
    "TOTAL DE PASIVOS", "TOTAL PASIVOS", "TOTAL DEL PASIVO",
    "TOTAL PATRIMONIO", "TOTAL DE PATRIMONIO", "TOTAL DEL PATRIMONIO",
    "INGRESOS DE ACTIVIDADES ORDINARIAS", "VENTAS NETAS", "VENTAS",
    "TOTAL INGRESOS POR INTERESES", "INGRESOS POR INTERESES",
    "MARGEN FINANCIERO BRUTO", "GANANCIA BRUTA", "UTILIDAD BRUTA",
    "GANANCIA (PERDIDA) NETA", "RESULTADO NETO DEL EJERCICIO",
    "GANANCIA (PÉRDIDA) NETA DEL EJERCICIO",
    "GANANCIAS (PERDIDA) POR ACCION", "UTILIDAD (PERDIDA) BASICA POR ACCION",
    "GANANCIAS POR ACCIÓN BÁSICAS", "RESULTADO POR ACCION",
]

def num_cells(celdas):
    out = []
    for c in celdas:
        c2 = c.strip()
        if re.fullmatch(r"\(?-?[\d.,]+\)?", c2) and any(ch.isdigit() for ch in c2):
            out.append(c2)
    return out

s = nueva_sesion()
for sector, smvid, nombre in MUESTRA:
    print("\n" + "=" * 70)
    print(f"SECTOR: {sector.upper()}  |  {nombre} (smvId={smvid})")
    docs = buscar_documentos(s, smvid)
    if not docs.get("detalle"):
        print("  (sin página de detalle)")
        continue
    raw = descargar(s, docs["detalle"])
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("cp1252", errors="replace")
    soup = BeautifulSoup(text, "lxml")

    # encabezado (moneda/unidad)
    full = soup.get_text(" ", strip=True)
    m = re.search(r"\(\s*EN MILES DE [^)]+\)", full, re.I)
    print("  Unidad:", m.group(0) if m else "?")

    vistos = set()
    for tr in soup.find_all("tr"):
        celdas = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
        if len(celdas) < 3:
            continue
        etiqueta = re.sub(r"\s+", " ", celdas[0]).strip()
        eU = etiqueta.upper()
        for clave in CLAVES:
            if eU == clave or (clave in eU and len(eU) < len(clave) + 18):
                nums = num_cells(celdas[1:])
                key = (etiqueta, tuple(nums[:1]))
                if key in vistos:
                    continue
                vistos.add(key)
                print(f"   {etiqueta[:48]:48} -> {nums[:2]}")
                break
