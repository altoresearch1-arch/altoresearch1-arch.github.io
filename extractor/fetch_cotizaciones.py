# -*- coding: utf-8 -*-
"""
fetch_cotizaciones.py — El PRECIO DEL MOTOR de cada empresa (mejora #116).

Pedido de Jair (22-jul-2026): "en los precios de los metales pon así estuvieron
en ese año, y fueron subiendo cada año; a inicios de 2026 bajaron y subieron
mucho — y esto cambia el precio de la acción".

El driver #1 de media BVL no estaba en la app: una minera no vive de sus
decisiones, vive del precio de su metal. Lo mismo la pesquera (harina de
pescado), la azucarera (azúcar) y la refinería (petróleo).

Fuente: BCRP — "Cotizaciones de productos (promedio del periodo)", series
mensuales oficiales del Banco Central de Reserva del Perú. Gratis, sin llave,
en español y con historia larga (desde 2015 en esta descarga).
  https://estadisticas.bcrp.gob.pe/estadisticas/series/mensuales/cotizaciones-de-productos

Salida: app/src/data/cotizaciones.json
  - promedio ANUAL de cada año (así estuvo el precio ese año, y si subió o bajó
    respecto del anterior),
  - serie MENSUAL de los últimos 36 meses (para ver el vaivén de este año),
  - el último mes publicado, el promedio de los últimos 5 años y el máximo /
    mínimo de la serie anual.
El año en curso va marcado como PARCIAL: es el promedio de los meses que ya
salieron, no del año completo (Regla de Oro #1: el dato se explica, no se
disfraza).
"""
import json
import sys
import unicodedata
from datetime import date
from pathlib import Path

import requests

sys.stdout.reconfigure(encoding="utf-8")

BASE = Path(__file__).resolve().parent
SALIDA = BASE.parent / "app" / "src" / "data" / "cotizaciones.json"

API = "https://estadisticas.bcrp.gob.pe/estadisticas/series/api/{cod}/json/{ini}/{fin}"
PORTAL = "https://estadisticas.bcrp.gob.pe/estadisticas/series/mensuales/cotizaciones-de-productos"

ANIO_INICIO = 2015
MESES_SERIE = 36  # cuántos meses guarda la serie fina que dibuja la app

# Los productos que mueven a las empresas de la BVL. El nombre y la unidad NO se
# copian del BCRP tal cual: se escriben para que los lea alguien que nunca vio
# una cotización (el BCRP dice "¢US$ por libras"; aquí, "centavos de dólar por
# libra"). El campo `mercado` dice dónde se fija ese precio.
PRODUCTOS = {
    "cobre":    {"cod": "PN01652XM", "nombre": "Cobre",            "unidad": "¢US$/libra",  "unidadLarga": "centavos de dólar por libra", "mercado": "LME (Londres)", "icono": "🟠"},
    "oro":      {"cod": "PN01654XM", "nombre": "Oro",              "unidad": "US$/onza",    "unidadLarga": "dólares por onza troy",       "mercado": "LME (Londres)", "icono": "🥇"},
    "plata":    {"cod": "PN01655XM", "nombre": "Plata",            "unidad": "US$/onza",    "unidadLarga": "dólares por onza troy",       "mercado": "H. Harman",     "icono": "🥈"},
    "zinc":     {"cod": "PN01657XM", "nombre": "Zinc",             "unidad": "¢US$/libra",  "unidadLarga": "centavos de dólar por libra", "mercado": "LME (Londres)", "icono": "🛡️"},
    "plomo":    {"cod": "PN01656XM", "nombre": "Plomo",            "unidad": "¢US$/libra",  "unidadLarga": "centavos de dólar por libra", "mercado": "LME (Londres)", "icono": "🔋"},
    "estano":   {"cod": "PN01653XM", "nombre": "Estaño",           "unidad": "¢US$/libra",  "unidadLarga": "centavos de dólar por libra", "mercado": "LME (Londres)", "icono": "🥫"},
    "petroleo": {"cod": "PN01660XM", "nombre": "Petróleo WTI",     "unidad": "US$/barril",  "unidadLarga": "dólares por barril",          "mercado": "WTI",           "icono": "🛢️"},
    "harina":   {"cod": "PN01649XM", "nombre": "Harina de pescado","unidad": "US$/tonelada","unidadLarga": "dólares por tonelada",        "mercado": "Hamburgo",      "icono": "🐟"},
    "azucar":   {"cod": "PN01650XM", "nombre": "Azúcar",           "unidad": "US$/tonelada","unidadLarga": "dólares por tonelada",        "mercado": "Contrato 14",   "icono": "🍬"},
    "trigo":    {"cod": "PN01661XM", "nombre": "Trigo",            "unidad": "US$/tonelada","unidadLarga": "dólares por tonelada",        "mercado": "EE. UU.",       "icono": "🌾"},
    "maiz":     {"cod": "PN01662XM", "nombre": "Maíz",             "unidad": "US$/tonelada","unidadLarga": "dólares por tonelada",        "mercado": "EE. UU.",       "icono": "🌽"},
    "soya":     {"cod": "PN01664XM", "nombre": "Aceite de soya",   "unidad": "US$/tonelada","unidadLarga": "dólares por tonelada",        "mercado": "EE. UU.",       "icono": "🫒"},
}

# ─────────────────────────────────────────────────────────────────────────
# 🏛️ EL MOTOR DE LOS QUE NO VENDEN MATERIA PRIMA (23-jul-2026)
# El bloque de arriba solo alcanza a ~25 empresas (mineras, pesqueras,
# azucareras y Petroperú). Pero el motor de los OTROS lentes también lo
# publica el BCRP, en la misma API y con el mismo formato mensual:
#   · la TASA DE REFERENCIA manda en bancos e inmobiliarias (el precio del
#     dinero es su materia prima),
#   · el TIPO DE CAMBIO manda en quien DEBE en dólares y VENDE en soles
#     (el caso Petroperú del plan educativo, #49),
#   · la INFLACIÓN manda en retail y consumo (sube el ticket, pero también
#     el costo — y el sueldo del cliente no sube igual de rápido).
# Van en el MISMO archivo que las cotizaciones, bajo "macro": es la misma
# fuente, el mismo formato y lo consume el mismo componente.
# `sentidoSube` dice qué significa que ese número SUBA — sin eso, un número
# macro es solo un número.
MACRO = {
    "tasa": {
        "cod": "PD04722MM", "nombre": "Tasa de referencia del BCRP",
        "unidad": "%", "unidadLarga": "por ciento anual",
        "mercado": "BCRP (la fija el Directorio del Banco Central)", "icono": "🏛️",
        "decimales": 2,
        "queEs": "el precio al que los bancos se prestan entre ellos de un día para otro. "
                 "Todo lo demás — tu tarjeta, un préstamo vehicular, un crédito hipotecario, "
                 "el plazo fijo — se cuelga de esta tasa.",
    },
    "tc": {
        "cod": "PN01207PM", "nombre": "Tipo de cambio (S/ por US$)",
        "unidad": "S/ por US$", "unidadLarga": "soles por dólar",
        "mercado": "mercado interbancario", "icono": "💵",
        "decimales": 3,
        "queEs": "cuántos soles cuesta un dólar, en promedio del mes. Importa cuando una "
                 "empresa cobra en una moneda y debe en la otra.",
    },
    "inflacion": {
        "cod": "PN01273PM", "nombre": "Inflación (Lima, últimos 12 meses)",
        "unidad": "%", "unidadLarga": "por ciento en los últimos 12 meses",
        "mercado": "INEI, Lima Metropolitana", "icono": "🛒",
        "decimales": 2,
        "queEs": "cuánto subieron los precios en Lima en un año. Es el número que decide "
                 "si el sueldo de tu cliente le alcanza igual que el año pasado.",
    },
}

MESES_BCRP = {
    "ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6,
    "jul": 7, "ago": 8, "set": 9, "sep": 9, "oct": 10, "nov": 11, "dic": 12,
}


def sin_tildes(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def mes_iso(nombre):
    """'Ene.2024' -> '2024-01' (el BCRP escribe el mes abreviado en español)."""
    txt = sin_tildes(str(nombre)).lower().replace(".", " ").strip()
    partes = txt.split()
    if len(partes) < 2:
        return None
    m = MESES_BCRP.get(partes[0][:3])
    if not m or not partes[-1].isdigit():
        return None
    return f"{partes[-1]}-{m:02d}"


def bajar(cod, ini, fin):
    url = API.format(cod=cod, ini=ini, fin=fin)
    r = requests.get(url, timeout=40)
    r.raise_for_status()
    return r.json()


def serie_mensual(cod):
    """[(YYYY-MM, valor)] ordenada, sin los meses que el BCRP deja vacíos."""
    hoy = date.today()
    datos = bajar(cod, f"{ANIO_INICIO}-1", f"{hoy.year}-12")
    filas = []
    for p in datos.get("periods", []):
        iso = mes_iso(p.get("name"))
        vals = p.get("values") or []
        if not iso or not vals:
            continue
        try:
            v = float(vals[0])
        except (TypeError, ValueError):
            continue  # el BCRP marca 'n.d.' cuando el mes todavía no salió
        filas.append((iso, round(v, 2)))
    filas.sort()
    return filas


def resumir(filas):
    """De la serie mensual saca lo que la app va a contar."""
    if not filas:
        return None
    por_anio = {}
    for iso, v in filas:
        por_anio.setdefault(iso[:4], []).append(v)

    anual = {a: round(sum(vs) / len(vs), 2) for a, vs in por_anio.items()}
    anio_actual = filas[-1][0][:4]
    meses_actual = len(por_anio[anio_actual])

    # Los últimos 5 años CERRADOS (el año en curso no entra: su promedio es
    # parcial y compararse contra sí mismo no dice nada).
    cerrados = sorted(a for a in anual if a != anio_actual)[-5:]
    promedio5 = round(sum(anual[a] for a in cerrados) / len(cerrados), 2) if cerrados else None

    del_anio = [(iso, v) for iso, v in filas if iso.startswith(anio_actual)]
    minimo = min(del_anio, key=lambda x: x[1])
    maximo = max(del_anio, key=lambda x: x[1])

    return {
        "anual": anual,
        "anioParcial": anio_actual,
        "mesesDelAnioParcial": meses_actual,
        "mensual": [[iso, v] for iso, v in filas[-MESES_SERIE:]],
        "ultimo": {"mes": filas[-1][0], "valor": filas[-1][1]},
        "promedio5a": promedio5,
        "aniosPromedio5a": cerrados,
        "minDelAnio": {"mes": minimo[0], "valor": minimo[1]},
        "maxDelAnio": {"mes": maximo[0], "valor": maximo[1]},
    }


def main():
    salida = {
        "_comment": "Cotizaciones mensuales oficiales del BCRP. El promedio del año EN CURSO es "
                    "parcial (solo los meses publicados) y va marcado como tal. Generado por "
                    "extractor/fetch_cotizaciones.py — no editar a mano.",
        "actualizado": date.today().isoformat(),
        "fuente": "BCRP — Cotizaciones de productos (promedio del periodo), series mensuales",
        "fuenteUrl": PORTAL,
        "productos": {},
        "macro": {},
    }

    for clave, info in PRODUCTOS.items():
        try:
            filas = serie_mensual(info["cod"])
            resumen = resumir(filas)
            if not resumen:
                print(f"  ⚠ {clave}: sin datos, se omite")
                continue
            salida["productos"][clave] = {
                **{k: v for k, v in info.items() if k != "cod"},
                "serieBCRP": info["cod"],
                **resumen,
            }
            u = resumen["ultimo"]
            print(f"  ✔ {info['nombre']:<18} {u['mes']}: {u['valor']} {info['unidad']}"
                  f"  ({len(resumen['anual'])} años)")
        except Exception as e:
            print(f"  ✘ {clave}: {e}")

    for clave, info in MACRO.items():
        try:
            filas = serie_mensual(info["cod"])
            resumen = resumir(filas)
            if not resumen:
                print(f"  ⚠ macro/{clave}: sin datos, se omite")
                continue
            salida["macro"][clave] = {
                **{k: v for k, v in info.items() if k != "cod"},
                "serieBCRP": info["cod"],
                **resumen,
            }
            u = resumen["ultimo"]
            print(f"  ✔ {info['nombre']:<34} {u['mes']}: {u['valor']} {info['unidad']}")
        except Exception as e:
            print(f"  ✘ macro/{clave}: {e}")

    if not salida["productos"]:
        print("FALLÓ: no se pudo bajar ninguna serie (¿sin internet?). No se toca el JSON.")
        return 1

    SALIDA.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nOK -> {SALIDA} ({len(salida['productos'])} productos)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
