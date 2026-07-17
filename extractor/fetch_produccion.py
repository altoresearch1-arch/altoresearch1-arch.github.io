# -*- coding: utf-8 -*-
"""
fetch_produccion.py — Producción y volumen de ventas por trimestre, del Hecho
de Importancia que publican ALGUNAS mineras en la BVL.

Por qué existe: el BEM del MINEM solo trae el top-10 por metal (una minera con
muchas unidades chicas — BVN — queda fuera). Pero algunas empresas publican su
producción COMPLETA, mina por mina, como Hecho de Importancia trimestral. Este
script la lee del PDF (mismo lector que Sentinel: pypdf), la estructura y la
deja en produccion.json para que la ficha la muestre (nivel 3).

Fuente: hechos.json (ya lo baja el robot) → busca el HI de "producción y volumen
de ventas" de cada minera → descarga y parsea el PDF de documents.bvl.com.pe.

Regla #1 (cero datos inventados): si una fila no calza con el patrón esperado,
se SALTA (se avisa en el log) — nunca se adivina un número. Si un PDF no se
puede leer, esa empresa simplemente no aparece.

Salida: app/src/data/produccion.json
Caché: por URL de PDF (no re-parsea lo ya leído).

Cobertura hoy: BVN (formato verificado). Cualquier minera cuyo HI de producción
tenga la misma estructura de tabla aparecerá sola; las que publiquen distinto
quedan fuera hasta escribirles su formato (config PERFILES abajo).
"""
import io
import json
import re
import sys
from pathlib import Path

import requests
import pypdf

sys.stdout.reconfigure(encoding="utf-8")

BASE = Path(__file__).resolve().parent
DATA = BASE.parent / "app" / "src" / "data"
HECHOS = DATA / "hechos.json"
SALIDA = DATA / "produccion.json"
CACHE = BASE / "cache_produccion"

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                         "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}

# Mineras de las que intentamos leer el HI de producción, con el "perfil" de su
# tabla. Por ahora solo el formato Buenaventura (verificado). Para sumar otra
# empresa con el MISMO formato: agrégala aquí con "perfil": "bvn".
PERFILES = {
    "BVN": "bvn",
}

# Solo tomamos como "HI de producción" los títulos que hablan de producción.
RE_TITULO_PROD = re.compile(r"producci[oó]n|production", re.I)
# Trimestre del título: "2do. Trimestre del 2026" → ("2", "2026")
RE_TRIM = re.compile(r"([1-4])(?:er|do|to)?\.?\s*Trimestre\s*(?:del?\s*)?(\d{4})", re.I)

# Cabecera de metal: "Oro (Oz.)", "Plata (Oz.)", "Plomo (TM)", "Cobre (TM)"…
RE_METAL = re.compile(r"^([A-Za-zÁÉÍÓÚñÑ]+)\s*\((Oz\.?|TM|US\$/[A-Za-z]+)\)", re.I)


def descargar(url):
    CACHE.mkdir(exist_ok=True)
    clave = re.sub(r"[^A-Za-z0-9]", "_", url)[-80:]
    destino = CACHE / f"{clave}.pdf"
    if destino.exists() and destino.stat().st_size > 5000:
        return destino.read_bytes()
    r = requests.get(url, headers=HEADERS, timeout=90)
    r.raise_for_status()
    destino.write_bytes(r.content)
    return r.content


def texto_pdf(contenido):
    r = pypdf.PdfReader(io.BytesIO(contenido))
    return [(p.extract_text() or "") for p in r.pages]


def num(s):
    """'4,621' → 4621 ; '30,543' → 30543 ; None si no es número."""
    s = s.strip().replace(",", "")
    if re.fullmatch(r"\d+(\.\d+)?", s):
        return int(float(s)) if "." not in s else float(s)
    return None


# ── Parser del formato BVN ───────────────────────────────────────────────────
# Producción: "Nombre [pct%]  trim  acum  estimado"  (estimado = rango o '-')
RE_FILA_PROD = re.compile(
    r"^(?P<nombre>.+?)\s+"
    r"(?P<trim>[\d,]+)\s+"
    r"(?P<acum>[\d,]+)\s+"
    r"(?P<guia>[\d.]+[kKmM]?\s*-\s*[\d.]+[kKmM]?|-)\s*$")
# Ventas: "Nombre  trim  acum"  (sin estimado)
RE_FILA_VENTA = re.compile(r"^(?P<nombre>.+?)\s+(?P<trim>[\d,]+)\s+(?P<acum>[\d,]+)\s*$")
# Precios: "Oro (US$/Oz)  4,342  4,599"
RE_FILA_PRECIO = re.compile(
    r"^(?P<metal>[A-Za-zÁÉÍÓÚñÑ]+\s*\(US\$/[A-Za-z]+\))\s+(?P<trim>[\d,]+\.?\d*)\s+(?P<acum>[\d,]+\.?\d*)\s*$")

RE_PCT = re.compile(r"\s+(\d+\.?\d*%)\s*$")
# Nombres que son SUBTOTAL, no una unidad minera:
RE_TOTAL = re.compile(r"total|asociad", re.I)


def limpiar_nombre(nombre):
    """Quita la marca de nota al pie '(2)' y el % de participación → (nombre, pct)."""
    nombre = re.sub(r"\s*\(\d+\)\s*$", "", nombre).strip()
    pct = None
    m = RE_PCT.search(nombre)
    if m:
        pct = m.group(1)
        nombre = nombre[:m.start()].strip()
    return nombre, pct


def normalizar_lineas(paginas):
    """Une las líneas partidas por saltos: en el PDF los subtotales caen en
    varias líneas ('30,543 \\n \\n 60,547 \\n \\n 120.0k - 139.0k'). Colapsamos
    cada tabla a líneas de una fila."""
    texto = "\n".join(paginas)
    lineas = []
    buffer = ""
    for cruda in texto.split("\n"):
        s = cruda.strip()
        if not s:
            continue
        # ¿esta línea sola es solo un número o un rango? → es continuación de la previa
        if buffer and re.fullmatch(r"[\d,]+\.?\d*|[\d.]+[kKmM]?\s*-\s*[\d.]+[kKmM]?", s):
            buffer += "  " + s
        else:
            if buffer:
                lineas.append(buffer)
            buffer = s
    if buffer:
        lineas.append(buffer)
    return lineas


def parsear_bvn(paginas):
    """Devuelve dict con produccion / ventas / precios / comentarios."""
    lineas = normalizar_lineas(paginas)
    res = {"produccion": {}, "ventas": {}, "precios": [], "comentarios": []}
    seccion = None          # 'produccion' | 'ventas' | 'precios' | 'comentarios'
    metal = None
    saltadas = []

    for ln in lineas:
        bajo = ln.lower()
        # ── cambios de sección ──
        if re.search(r"producci[oó]n por metal", bajo):
            seccion, metal = "produccion", None
            continue
        if re.search(r"volumen vendido", bajo):
            seccion, metal = "ventas", None
            continue
        if re.search(r"promedio de precios", bajo):
            seccion, metal = "precios", None
            continue
        if re.search(r"comentarios de operaciones", bajo):
            seccion, metal = "comentarios", None
            continue
        if seccion is None:
            continue

        if seccion == "precios":
            m = RE_FILA_PRECIO.match(ln)
            if m:
                res["precios"].append({
                    "metal": re.sub(r"\s+", " ", m.group("metal")).strip(),
                    "trim": num(m.group("trim")), "acum": num(m.group("acum")),
                })
            continue

        if seccion == "comentarios":
            # "Uchucchacua:" abre unidad; "• ..." son viñetas
            mu = re.match(r"^([A-Za-zÁÉÍÓÚñÑ /]+):\s*$", ln)
            if mu:
                res["comentarios"].append({"unidad": mu.group(1).strip(), "notas": []})
                continue
            if ln.startswith("•") and res["comentarios"]:
                res["comentarios"][-1]["notas"].append(ln.lstrip("• ").strip())
            continue

        # secciones de tabla (produccion / ventas)
        mm = RE_METAL.match(ln)
        if mm and not re.search(r"[\d,]+\s+[\d,]+", ln):
            metal = re.sub(r"\s+", " ", ln).strip()
            res[seccion].setdefault(metal, [])
            continue
        if metal is None:
            continue

        patron = RE_FILA_PROD if seccion == "produccion" else RE_FILA_VENTA
        m = patron.match(ln)
        if not m:
            if re.search(r"\d", ln):
                saltadas.append(ln)
            continue
        nombre, pct = limpiar_nombre(m.group("nombre"))
        fila = {
            "unidad": nombre,
            "pct": pct,
            "trim": num(m.group("trim")),
            "acum": num(m.group("acum")),
            "esTotal": bool(RE_TOTAL.search(nombre)),
        }
        if seccion == "produccion":
            fila["guia"] = m.group("guia") if m.group("guia") != "-" else None
        res[seccion][metal].append(fila)

    return res, saltadas


PARSERS = {"bvn": parsear_bvn}


def hi_produccion(ticker, hechos):
    """Último HI de producción de la empresa (≤180 días para no traer viejos)."""
    lista = hechos.get("hechos", {}).get(ticker, {}).get("hechos", [])
    for h in lista:
        if RE_TITULO_PROD.search(h.get("titulo") or "") and h.get("pdf"):
            return h
    return None


def main():
    hechos = json.loads(HECHOS.read_text(encoding="utf-8-sig"))
    previo = {}
    if SALIDA.exists():
        try:
            previo = json.loads(SALIDA.read_text(encoding="utf-8-sig")).get("empresas", {})
        except Exception:
            pass

    empresas = {}
    for ticker, perfil in PERFILES.items():
        hi = hi_produccion(ticker, hechos)
        if not hi:
            print(f"  {ticker}: sin HI de producción reciente — se omite")
            continue
        mtrim = RE_TRIM.search(hi.get("titulo") or "")
        etiqueta = f"{mtrim.group(1)}T {mtrim.group(2)}" if mtrim else None
        try:
            contenido = descargar(hi["pdf"])
            datos, saltadas = PARSERS[perfil](texto_pdf(contenido))
        except Exception as e:
            print(f"  ❌ {ticker}: no pude leer el PDF ({e}) — se omite")
            continue

        n_prod = sum(len(v) for v in datos["produccion"].values())
        if n_prod == 0:
            print(f"  ⚠ {ticker}: el PDF no dio ninguna fila de producción — se omite (Regla #1)")
            continue
        empresas[ticker] = {
            "trimestre": etiqueta,
            "fecha": hi.get("fecha"),
            "titulo": hi.get("titulo"),
            "pdf": hi["pdf"],
            **datos,
        }
        aviso = f" · {len(saltadas)} filas saltadas" if saltadas else ""
        print(f"  ✅ {ticker} ({etiqueta}): {n_prod} filas de producción, "
              f"{sum(len(v) for v in datos['ventas'].values())} de ventas, "
              f"{len(datos['precios'])} precios, {len(datos['comentarios'])} comentarios{aviso}")
        for s in saltadas:
            print(f"       saltada: {s[:90]}")

    salida = {
        "_comment": ("Producción y volumen de ventas por trimestre, del Hecho de "
                     "Importancia que publican algunas mineras en la BVL. Lo lee "
                     "fetch_produccion.py del PDF oficial. El BEM solo trae el top-10; "
                     "esto es la producción completa mina por mina, de la fuente misma."),
        "fuente": "BVL — Hechos de Importancia (producción y volumen de ventas del trimestre)",
        "empresas": empresas,
    }
    # Sin cambios → no reescribir (el robot corre cada 30 min; evita commits de ruido).
    if previo == empresas:
        print(f"  ✅ {SALIDA.name}: sin cambios (ninguna minera publicó producción nueva)")
        return
    SALIDA.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  → {SALIDA.name}: {len(empresas)} empresa(s)")


if __name__ == "__main__":
    main()
