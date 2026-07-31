# -*- coding: utf-8 -*-
"""
fetch_pagos_dividendos.py — CUÁNDO y CUÁNTO se paga cada dividendo, leído del
acuerdo oficial que la empresa comunica a la SMV.

Por qué existe (bug cazado por Jair, 31-jul-2026 · Nexa):
    Nexa acordó el 15-may repartir US$ 0.07860968 por acción PERO EN DOS PARTES:
    US$ 0.0393048 el 16-jun-2026 y US$ 0.0393048 el 27-oct-2026.
    dividendos.json viene de stockanalysis, que estampa el dividendo declarado
    del año ENTERO en la fecha ex (1-jun). Resultado en el cuaderno: contaba como
    ya recibido el doble de lo que entró, y el pago de octubre —acordado, firmado
    y comunicado al regulador— no aparecía por ningún lado.

Este script lee el PDF del Hecho de Importancia (mismo lector que Sentinel y
fetch_produccion: pypdf) y saca los datos ESTRUCTURADOS que trae el formato
MVNet, que es idéntico en todas las empresas:

    Detalle de la Aplicación de Utilidades:
      "Se acordó pagar en dos partes … El 16 de junio de 2026 a razón de
       US$ 0.0393048419252725 por acción. El 27 de octubre de 2026 a razón …"
    Detalle de Dividendos por Acción
      Tipo Accion : NEXAPEC1 - ACCIONES COMUNES
      Monto del Dividendo por Acción : $0.07860968
    DATOS DE COMUNICACION DE FECHA DE REGISTRO Y ENTREGA …
      Tipo de Valor: NEXAPEC1 ACCIONES COMUNES
      F. de Entrega: 16/06/2026

Tres formas de armar un pago, en orden de confianza:
  1. TRAMOS: el texto del acuerdo dice fecha + monto de cada parte → un pago por
     tramo. Es el único caso donde el reparto en partes es explícito.
  2. MISMO DOCUMENTO: el PDF declara el monto por acción Y la fecha de entrega.
  3. DOCUMENTO PAREJA: el HI de "fechas de registro y entrega" (que casi nunca
     repite el monto) se casa con el acuerdo previo de la misma empresa, hasta
     180 días atrás, que sí lo declaró.

Regla de Oro #1 (cero datos inventados): una fecha sin monto —o un monto sin
fecha— NO produce un pago. Se registra en el log como "sin pareja" y se ignora.

Salida: app/src/data/pagos_dividendos.json
Caché:  cache_dividendos/leidos.json — lo YA LEÍDO de cada PDF, por URL. Es lo que
        viaja en el commit (unos KB); los PDF crudos (9 MB y subiendo) se quedan
        en la máquina, ignorados por git. Así el robot de cada 30 min solo baja
        los hechos NUEVOS en vez de re-descargar 76 PDF cada vez.
"""
import io
import json
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import requests
import pypdf

sys.stdout.reconfigure(encoding="utf-8")

BASE = Path(__file__).resolve().parent
DATA = BASE.parent / "app" / "src" / "data"
HECHOS = DATA / "hechos.json"
SALIDA = DATA / "pagos_dividendos.json"
CACHE = BASE / "cache_dividendos"
CACHE_LEIDOS = CACHE / "leidos.json"
CONFIG = BASE / "empresas_config.json"

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                         "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}

# Solo miramos HI que hablen de reparto: la categoría oficial o el título.
RE_ES_DIVIDENDO = re.compile(r"utilidades|dividendo", re.I)
# Ventana: los acuerdos del último año (el pago puede caer meses después).
DIAS_ATRAS = 400
# Cuánto puede separarse el HI de "fechas de entrega" del acuerdo que trae el monto.
DIAS_PAREJA = 180

MESES = {"enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
         "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
         "noviembre": 11, "diciembre": 12}

# "El 16 de junio de 2026 a razón de US$ 0.0393048419252725 por acción"
# Cada empresa lo escribe un poco distinto y hay que aguantarlo todo (visto en
# Laredo, que en la MISMA frase mezcla los dos estilos): "el día 08 de julio 2026
# a razón S/ 0.50 por acción y el 05 de agosto de 2026 a razón de S/ 0.50…".
# Por eso «día» y los dos «de» son opcionales.
RE_TRAMO = re.compile(
    r"\bel\s+(?:d[íi]a\s+)?(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+de)?\s+(\d{4})\s*,?\s*"
    r"a\s+raz[óo]n\s+(?:de\s+)?(US\$|S/\.?|\$)\s*([\d.,]+)\s*por\s+acci[óo]n", re.I)
# "Tipo Accion : NEXAPEC1 - ACCIONES COMUNES … Monto del Dividendo por Acción : $0.07860968"
RE_MONTO = re.compile(
    r"Tipo\s+Accion\s*:\s*([A-Z0-9]+)\s*-.{0,220}?"
    r"Monto\s+del\s+Dividendo\s+por\s+Acci[óo]n\s*:\s*(US\$|S/\.?|\$)\s*([\d.,]+)", re.S | re.I)
# "Tipo de Valor: NEXAPEC1 ACCIONES COMUNES\nF. de Entrega: 16/06/2026"
RE_ENTREGA = re.compile(
    r"Tipo\s+de\s+Valor\s*:\s*([A-Z0-9]+)[^\n]*\n\s*F\.\s*de\s+Entrega\s*:\s*(\d{2}/\d{2}/\d{4})", re.I)


# "Tipo de Valor: ACCIONES COMUNES" (sin ticker) también existe: esas palabras
# NO son un valor y no deben viajar como si lo fueran.
NO_SON_TICKER = {"ACCIONES", "COMUNES", "INVERSION", "INVERSIÓN", "VALOR", "TIPO"}


def es_ticker(t):
    # OJO: no exigir un dígito. Hay tickers sin número (IFS, BAP) y ese filtro
    # los borraba en silencio. Basta con descartar las palabras del formulario;
    # lo que no sea una empresa nuestra igual se cae al comparar con la lista.
    return 2 <= len(t) <= 12 and t.upper() not in NO_SON_TICKER


def moneda_de(simbolo):
    """'$' → US$ ; 'S/.' o 'S/' → S/ (así lo escribe el resto de la app)."""
    s = (simbolo or "").strip()
    return "US$" if s in ("$", "US$") else "S/"


def numero(txt):
    """'0.0393048419252725' → float ; '1,234.56' → 1234.56 ; None si no es número."""
    t = (txt or "").strip().replace(",", "")
    try:
        return float(t)
    except ValueError:
        return None


def leer_cache():
    if CACHE_LEIDOS.exists():
        try:
            return json.loads(CACHE_LEIDOS.read_text(encoding="utf-8-sig"))
        except Exception:
            pass
    return {}


def guardar_cache(cache):
    CACHE.mkdir(exist_ok=True)
    CACHE_LEIDOS.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")


def descargar(url):
    CACHE.mkdir(exist_ok=True)
    clave = re.sub(r"[^A-Za-z0-9]", "_", url)[-80:]
    destino = CACHE / f"{clave}.pdf"
    if destino.exists() and destino.stat().st_size > 3000:
        return destino.read_bytes()
    r = requests.get(url, headers=HEADERS, timeout=90)
    r.raise_for_status()
    destino.write_bytes(r.content)
    return r.content


def texto_pdf(contenido):
    # Algunos HI vienen con extensión .PDF pero son un ZIP (la SMV deja adjuntar
    # el archivo tal cual). No es un error nuestro: se avisa y se salta.
    if contenido[:2] == b"PK":
        raise ValueError("el archivo es un ZIP, no un PDF")
    lector = pypdf.PdfReader(io.BytesIO(contenido))
    return "\n".join((p.extract_text() or "") for p in lector.pages)


def leer_documento(texto):
    """Saca del PDF los tres bloques que nos interesan, sin interpretarlos aún."""
    tramos = []
    for d, mes, anio, sim, monto in RE_TRAMO.findall(texto):
        m = MESES.get(mes.lower())
        val = numero(monto)
        if not m or val is None:
            continue
        try:
            f = date(int(anio), m, int(d))
        except ValueError:
            continue
        tramos.append({"fecha": f.isoformat(), "monto": val, "moneda": moneda_de(sim)})

    montos = {}
    for ticker, sim, monto in RE_MONTO.findall(texto):
        val = numero(monto)
        if val is not None and val > 0 and es_ticker(ticker):
            montos[ticker.upper()] = {"monto": val, "moneda": moneda_de(sim)}

    entregas = {}
    for ticker, f in RE_ENTREGA.findall(texto):
        if not es_ticker(ticker):
            continue
        try:
            iso = datetime.strptime(f, "%d/%m/%Y").date().isoformat()
        except ValueError:
            continue
        entregas.setdefault(ticker.upper(), [])
        if iso not in entregas[ticker.upper()]:
            entregas[ticker.upper()].append(iso)

    return {"tramos": tramos, "montos": montos, "entregas": entregas}


def hechos_de_dividendo(hechos, desde):
    """[(ticker_emisor, fecha_hi, titulo, url_pdf)] de HI que hablan de reparto."""
    salida = []
    for ticker, v in (hechos.get("hechos") or {}).items():
        for h in v.get("hechos") or []:
            texto = f"{h.get('categoria') or ''} {h.get('titulo') or ''}"
            if h.get("pdf") and h.get("fecha", "") >= desde and RE_ES_DIVIDENDO.search(texto):
                salida.append((ticker, h["fecha"], h.get("titulo") or "", h["pdf"]))
    # del más viejo al más nuevo: así, cuando toca casar una fecha de entrega con
    # un monto declarado antes, el monto ya fue leído.
    salida.sort(key=lambda x: x[1])
    return salida


def main():
    hechos = json.loads(HECHOS.read_text(encoding="utf-8-sig"))
    conocidos = set()
    try:
        cfg = json.loads(CONFIG.read_text(encoding="utf-8-sig"))
        conocidos = {e["ticker"].upper() for e in cfg.get("empresas", [])}
    except Exception:
        conocidos = {t.upper() for t in (hechos.get("hechos") or {})}

    previo = {}
    if SALIDA.exists():
        try:
            previo = json.loads(SALIDA.read_text(encoding="utf-8-sig")).get("empresas", {})
        except Exception:
            pass

    desde = (date.today() - timedelta(days=DIAS_ATRAS)).isoformat()
    pendientes = hechos_de_dividendo(hechos, desde)
    print(f"  {len(pendientes)} hechos de importancia sobre reparto de utilidades por leer")

    # ticker → [{monto, moneda, hecho, pdf}] declarados, para casar fechas sueltas
    declarados = {}
    empresas = {}
    sin_pareja = []

    def agrega(ticker, pago):
        if ticker not in conocidos:
            return
        lista = empresas.setdefault(ticker, [])
        # mismo día + mismo monto = el mismo pago comunicado dos veces (pasa con
        # las "aclaraciones" y las regularizaciones). Nos quedamos con uno.
        for p in lista:
            if p["fecha"] == pago["fecha"] and abs(p["monto"] - pago["monto"]) < 1e-9:
                return
        lista.append(pago)

    cache = leer_cache()
    urls_vivas = {u for _, _, _, u in pendientes}
    nuevos = 0

    for emisor, fecha_hi, titulo, url in pendientes:
        doc = cache.get(url)
        if doc is None:
            try:
                doc = leer_documento(texto_pdf(descargar(url)))
                nuevos += 1
            except Exception as e:
                print(f"  ❌ {emisor} {fecha_hi}: no pude leer el PDF ({str(e)[:60]})")
                # Se cachea el fracaso para no reintentar el mismo archivo roto
                # cada media hora (los ZIP disfrazados de PDF no van a sanar).
                cache[url] = {"tramos": [], "montos": {}, "entregas": {}, "error": str(e)[:80]}
                continue
            cache[url] = doc
        elif doc.get("error"):
            continue

        for ticker, m in doc["montos"].items():
            declarados.setdefault(ticker, []).append(
                {"hecho": fecha_hi, "pdf": url, **m})

        # 1) el acuerdo dice EN PARTES: cada tramo es un pago con fecha y monto propios
        if doc["tramos"]:
            objetivo = list(doc["montos"].keys()) or list(doc["entregas"].keys())
            total = sum(t["monto"] for t in doc["tramos"])
            for ticker in objetivo:
                declarado = doc["montos"].get(ticker, {}).get("monto")
                # el reparto en partes tiene que sumar lo declarado (±1%); si no
                # cuadra, no es un reparto en tramos y lo dejamos pasar (Regla #1)
                if declarado and abs(total - declarado) > declarado * 0.01:
                    sin_pareja.append(f"{ticker} {fecha_hi}: tramos suman {total:.6f} "
                                      f"≠ declarado {declarado:.6f}")
                    continue
                for i, t in enumerate(doc["tramos"], 1):
                    agrega(ticker, {**t, "hecho": fecha_hi, "pdf": url,
                                    "parte": i, "partes": len(doc["tramos"]),
                                    "total": declarado or total})
            continue

        # 2) mismo documento: monto declarado + fecha de entrega
        # 3) documento pareja: la fecha de entrega llega sola, el monto vino antes
        for ticker, fechas in doc["entregas"].items():
            m = doc["montos"].get(ticker)
            if not m:
                previos = [d for d in declarados.get(ticker, [])
                           if (datetime.fromisoformat(fecha_hi).date()
                               - datetime.fromisoformat(d["hecho"]).date()).days <= DIAS_PAREJA]
                m = previos[-1] if previos else None
            if not m:
                sin_pareja.append(f"{ticker} {fecha_hi}: fecha de entrega sin monto declarado")
                continue
            for f in fechas:
                agrega(ticker, {"fecha": f, "monto": m["monto"], "moneda": m["moneda"],
                                "hecho": fecha_hi, "pdf": url, "parte": 1, "partes": 1,
                                "total": m["monto"]})

    # La caché se poda con la ventana: lo que ya salió de los últimos 12 meses de
    # hechos.json no vuelve a hacer falta y no tiene por qué engordar el repo.
    guardar_cache({u: v for u, v in cache.items() if u in urls_vivas})
    print(f"  {nuevos} PDF nuevos leídos · {len(urls_vivas) - nuevos} de la caché")

    for lista in empresas.values():
        lista.sort(key=lambda p: p["fecha"], reverse=True)

    hoy = date.today().isoformat()
    futuros = sum(1 for l in empresas.values() for p in l if p["fecha"] >= hoy)
    partidos = sorted({t for t, l in empresas.items() for p in l if p["partes"] > 1})

    salida = {
        "_comment": ("CUÁNDO y CUÁNTO paga cada dividendo, leído del acuerdo oficial "
                     "(Hecho de Importancia, formato MVNet) por fetch_pagos_dividendos.py. "
                     "Existe porque stockanalysis estampa el dividendo del año entero en la "
                     "fecha ex: cuando la empresa paga EN PARTES (Nexa: mitad en junio, mitad "
                     "en octubre) eso contaba de más lo recibido y escondía el pago pendiente. "
                     "Aquí cada pago va con su fecha de entrega real y su monto por acción. "
                     "Un pago solo existe si el PDF dio fecha Y monto — nunca se adivina."),
        "fuente": "BVL/SMV — Hechos de Importancia (distribución o aplicación de utilidades)",
        "generado": hoy,
        "empresas": empresas,
    }

    if previo == empresas:
        print(f"  ✅ {SALIDA.name}: sin cambios ({len(empresas)} empresas, {futuros} pagos por venir)")
        return
    SALIDA.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  → {SALIDA.name}: {len(empresas)} empresas · "
          f"{sum(len(l) for l in empresas.values())} pagos · {futuros} aún por pagar")
    if partidos:
        print(f"     pagan en partes: {', '.join(partidos)}")
    for s in sin_pareja[:12]:
        print(f"     sin pareja: {s}")


if __name__ == "__main__":
    main()
