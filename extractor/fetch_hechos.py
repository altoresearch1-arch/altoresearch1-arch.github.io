# -*- coding: utf-8 -*-
"""
Hechos de Importancia por EMPRESA — vía API de la BVL (descubierto 02-jul-2026).

    POST https://dataondemand.bvl.com.pe/v1/corporate-actions
    body: {"rpjCode":"B20013","page":1,"size":40,"search":"",
           "startDate":"2025-07-01","endDate":"2026-07-02"}
    -> {"totalElements":38,"totalPages":1,"content":[{registerDate, observation,
        codes:[{descCodeHHII}], documents:[{path}], ...}]}

Los rpjCode de cada empresa están en empresas_config.json (campo bvlRpj,
mapeados desde GET /v1/issuers). Los PDF viven en
https://documents.bvl.com.pe<path>.

Genera app/src/data/hechos.json con los HI de los últimos ~12 meses por ticker.
Correr A DIARIO en el robot (reemplaza en la práctica al acumulador del portal
SMV `hechos_importancia.py`, que queda de respaldo).

Regla de Oro #1: solo lo que la BVL/SMV publica; cero datos inventados.
"""
import json, os, time
from datetime import date, timedelta

import requests

AQUI = os.path.dirname(os.path.abspath(__file__))
APP_DATA = os.path.normpath(os.path.join(AQUI, "..", "app", "src", "data"))
URL = "https://dataondemand.bvl.com.pe/v1/corporate-actions"
PDF_BASE = "https://documents.bvl.com.pe"
MAX_POR_EMPRESA = 15  # los más recientes; la ficha muestra 5 + "ver más" hasta 15.
# (Con 40 el JSON pesaba 602 KB dentro de la app; con 15 baja a menos de la mitad.
#  El historial completo siempre vive en la BVL — esto es solo la vitrina.)


def sesion():
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "Origin": "https://www.bvl.com.pe",
        "Referer": "https://www.bvl.com.pe/",
    })
    return s


def hechos_de(s, rpj, desde, hasta):
    r = s.post(URL, json={"rpjCode": rpj, "page": 1, "size": MAX_POR_EMPRESA,
                          "search": "", "startDate": desde, "endDate": hasta},
               timeout=40)
    r.raise_for_status()
    data = r.json()
    hechos = []
    for it in data.get("content") or []:
        fecha = (it.get("registerDate") or "")[:10]
        titulo = (it.get("observation") or "").strip()
        cods = it.get("codes") or []
        categoria = (cods[0].get("descCodeHHII") or "").strip() if cods else ""
        docs = it.get("documents") or []
        pdf = (PDF_BASE + docs[0]["path"]) if docs and docs[0].get("path") else None
        # OJO (bug cazado por Jair 09-jul): muchos HI llegan con observation EN BLANCO
        # (ej. "Posición Mensual en Derivados" de Nexa del 08-jul) — la categoría ES el
        # contenido. Antes se exigía titulo y se BOTABAN; ahora basta titulo O categoría.
        if fecha and (titulo or categoria):
            # sin claves nulas: cada byte cuenta dentro del bundle de la app
            h = {"fecha": fecha}
            if titulo:
                h["titulo"] = titulo
            if categoria:
                h["categoria"] = categoria
            if pdf:
                h["pdf"] = pdf
            hechos.append(h)
    hechos.sort(key=lambda h: h["fecha"], reverse=True)
    return hechos, data.get("totalElements") or len(hechos)


def main():
    with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    hoy = date.today()
    desde = (hoy - timedelta(days=365)).isoformat()
    s = sesion()

    salida = {}
    for c in cfg["empresas"]:
        ticker, rpj = c["ticker"], c.get("bvlRpj")
        if not rpj:
            salida[ticker] = {"rpj": None, "hechos": [], "encontrado": False}
            continue
        try:
            hechos, total = hechos_de(s, rpj, desde, hoy.isoformat())
        except Exception as e:
            print(f"  {ticker:10} rpj={rpj:8} -> ERROR {str(e)[:60]}")
            salida[ticker] = {"rpj": rpj, "hechos": [], "encontrado": False}
            continue
        salida[ticker] = {"rpj": rpj, "hechos": hechos, "total12m": total,
                          "encontrado": True}
        print(f"  {ticker:10} rpj={rpj:8} {len(hechos):3} HI (total 12m: {total})")
        time.sleep(0.5)

    doc = {
        "_comment": ("Hechos de Importancia de los últimos ~12 meses por empresa, del API "
                     "de la BVL (corporate-actions, por rpjCode). PDFs en documents.bvl.com.pe. "
                     "Generado por extractor/fetch_hechos.py — correr a diario en el robot."),
        "fuente": "https://dataondemand.bvl.com.pe/v1/corporate-actions",
        "generado": hoy.isoformat(),
        "hechos": salida,
    }
    out = os.path.join(APP_DATA, "hechos.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    ok = sum(1 for v in salida.values() if v.get("encontrado"))
    print(f"\nEscrito: {out}  ({ok}/{len(salida)} con datos)")


if __name__ == "__main__":
    main()
