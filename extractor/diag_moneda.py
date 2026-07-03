# -*- coding: utf-8 -*-
"""Diagnóstico de moneda: ¿en qué moneda está realmente cada XBRL?"""
import sys, re
sys.stdout.reconfigure(encoding="utf-8")
from collections import Counter
from lxml import etree
from bs4 import BeautifulSoup
from smv_extractor import nueva_sesion, buscar_documentos, descargar, _parse_root, XBRLI

REVISAR = [(59, "NEXA"), (73, "ALICORP"), (117, "GLORIA"), (112995, "EXALMAR"),
           (43173, "ACEROS AREQUIPA")]

s = nueva_sesion()
for smvid, nombre in REVISAR:
    print("\n" + "=" * 60)
    print(f"{nombre} (smvId={smvid})")
    docs = buscar_documentos(s, smvid)
    if not docs.get("xbrl"):
        print("  sin XBRL (banco?)"); continue
    raw = descargar(s, docs["xbrl"])
    root = _parse_root(raw)
    nsmap = {k: v for k, v in root.nsmap.items() if k}
    ifrs = nsmap.get("ifrs-full")

    # 1) unidades declaradas y su measure
    unidades = {}
    for u in root.findall(f"{{{XBRLI}}}unit"):
        meas = u.find(f"{{{XBRLI}}}measure")
        if meas is not None and meas.text and "iso4217" in meas.text:
            unidades[u.get("id")] = meas.text.split(":")[-1].upper()
    print("  Unidades iso4217 declaradas:", set(unidades.values()))

    # 2) moneda del hecho 'Assets' (concepto núcleo)
    def unidad_de(local):
        for el in root.iter():
            tag = el.tag
            if not isinstance(tag, str) or "}" not in tag:
                continue
            uri, lc = tag[1:].split("}")
            if uri == ifrs and lc == local:
                uref = el.get("unitRef")
                if uref:
                    return unidades.get(uref)
        return None
    print("  Moneda de 'Assets'  :", unidad_de("Assets"))
    print("  Moneda de 'Revenue' :", unidad_de("Revenue"))
    print("  Moneda de 'Equity'  :", unidad_de("Equity"))

    # 3) conteo de unidades usadas por hechos monetarios ifrs (mayoría = moneda real)
    cont = Counter()
    for el in root.iter():
        tag = el.tag
        if not isinstance(tag, str) or "}" not in tag:
            continue
        uri, lc = tag[1:].split("}")
        if uri != ifrs:
            continue
        uref = el.get("unitRef")
        if uref and uref in unidades:
            cont[unidades[uref]] += 1
    print("  Conteo de hechos por moneda:", dict(cont))

    # 4) lo que dice la primera línea del XBRL como referencia textual
    txt = raw.decode("cp1252", errors="replace")
    m = re.search(r"(MILES DE [A-ZÁÉ ]+)", txt.upper())
    print("  Texto 'MILES DE...':", m.group(1) if m else "?")
