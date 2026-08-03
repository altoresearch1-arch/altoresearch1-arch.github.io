# -*- coding: utf-8 -*-
"""
Conector de precios BVL — ALTO Research.

Baja el último precio de CIERRE (del día anterior) de cada empresa desde el
endpoint público de la Bolsa de Valores de Lima:
    POST https://dataondemand.bvl.com.pe/v1/stock-quote/market
que devuelve todo el mercado con: nemonico, sell (último precio), previous
(cierre previo), previousDate (fecha de ese cierre), currency.

Genera app/src/data/precios.json keyado por ticker. La app muestra el precio
y SIEMPRE la fecha real, aclarando que es el cierre del día anterior (BVL).

Regla de Oro #1: si una acción no tiene cotización reciente, se muestra el
último cierre disponible CON su fecha (no se inventa un precio "de hoy").

────────────────────────────────────────────────────────────────────────────
LO QUE ESTE ENDPOINT SIEMPRE TRAJO Y NUNCA SE GUARDABA (visto 02-ago-2026)
────────────────────────────────────────────────────────────────────────────
Cada fila del mercado viene con MUCHO más que el precio, y se estaba tirando
entero en cada corrida — tres veces al día, todos los días:

    "lastDate": "2026-07-31T19:59:42"   la HORA exacta de la última operación
    "opening" / "minimun" / "maximun"   el rango del día, ya calculado
    "negotiatedAmount": 579085.0        el VOLUMEN negociado, en moneda
    "negotiatedQuantity": "262918"      cuántas acciones cambiaron de manos
    "operationsNumber": "69"            cuántas operaciones distintas
    "percentageChange"                  la variación del día

De todo eso, el código anterior usaba `lastDate` cortándole la hora con [:10]
y el monto convertido en un booleano (negoció sí/no). El resto se perdía.

POR QUÉ IMPORTA MÁS QUE CUALQUIER OTRA COSA QUE PODAMOS AGREGAR: el Radar
sabe CUÁNTO se movió una acción, pero no CON CUÁNTA PLATA. Un +3% con 69
operaciones y S/ 579,085 negociados es una cosa; el mismo +3% con 13
operaciones y S/ 13,818 (Siderperú ese mismo día) es otra completamente
distinta. Sin volumen, las dos se pintaban igual en el sonar.

Y el rango del día (apertura/mín/máx) es intradía REAL sin tener que consultar
cada 20 minutos: una acción que llegó a +5% y cerró en +1% cuenta una historia
que el cierre solo esconde.

Se escribe todo en precios.json y ADEMÁS se acumula por día en intradia.json,
porque un dato de mercado que no se guarda hoy no se puede recuperar mañana.
"""
import json, os, requests
from datetime import datetime, timedelta, timezone

AQUI = os.path.dirname(os.path.abspath(__file__))
APP_DATA = os.path.normpath(os.path.join(AQUI, "..", "app", "src", "data"))
URL = "https://dataondemand.bvl.com.pe/v1/stock-quote/market"

# La BVL sella sus horas en UTC ("2026-07-31T19:59:42" = 14:59:42 en Lima, el
# minuto del cierre). Perú es UTC-5 todo el año: no hay horario de verano.
LIMA = timezone(timedelta(hours=-5))
INTRADIA = os.path.join(APP_DATA, "intradia.json")
DIAS_INTRADIA = 45  # suficiente para construir un vaivén intradía honesto


def num(v):
    """Los números vienen a veces como texto ('262918', '69', '0 ')."""
    if v is None:
        return None
    try:
        return float(str(v).strip().replace(",", ""))
    except (ValueError, AttributeError):
        return None


def hora_lima(iso):
    """'2026-07-31T19:59:42' (UTC) -> '2026-07-31T14:59:42-05:00'."""
    if not iso or "T" not in iso:
        return None
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "")).replace(tzinfo=timezone.utc)
        return dt.astimezone(LIMA).isoformat()
    except ValueError:
        return None


def acumular_intradia(precios):
    """Guarda la foto del día por ticker. Se llama en CADA corrida (12:15,
    15:15 y el cierre), y por eso `tomas` va sumando: cada entrada es un
    [hora, precio] y solo se anota cuando el precio CAMBIÓ respecto de la toma
    anterior — si nadie operó, repetir el mismo número 15 veces no es un dato,
    es peso muerto.

    ESTO NO SE PUEDE RECUPERAR HACIA ATRÁS. El endpoint solo sabe de HOY: no
    hay forma de preguntarle cuánto se negoció el martes pasado. Cada corrida
    que no guarda es un día que no vamos a tener nunca."""
    doc = {"dias": {}}
    if os.path.exists(INTRADIA):
        try:
            with open(INTRADIA, encoding="utf-8") as f:
                doc = json.load(f)
        except Exception:
            pass
    dias = doc.get("dias") or {}
    ahora = datetime.now(LIMA)

    hoy = ahora.date().isoformat()
    for tk, p in precios.items():
        if p.get("precio") is None:
            continue
        # Sin operaciones no hubo rueda para esa acción: la BVL repite el
        # cierre viejo y guardarlo sería inventar un día que no existió.
        if not p.get("operaciones"):
            continue
        # LA SESIÓN se fecha con la HORA DE LA ÚLTIMA OPERACIÓN, no con
        # `fecha`. Y no es un detalle: cuando la BVL no expone `last` para una
        # acción, `fecha` cae al cierre ANTERIOR — Siderperú negoció el
        # viernes 31 (13 operaciones, S/ 13,818) y su volumen se archivaba en
        # el jueves 30. `ultimaOperacion` sí dice cuándo se transó de verdad.
        sesion = (p.get("ultimaOperacion") or "")[:10] or p.get("fecha")
        if not sesion:
            continue
        d = dias.setdefault(sesion, {})
        e = d.setdefault(tk, {"tomas": []})
        e.update({
            "apertura": p.get("apertura"), "min": p.get("minimo"),
            "max": p.get("maximo"), "cierre": p["precio"],
            "previo": p.get("previo"), "ops": p.get("operaciones"),
            "monto": p.get("montoNegociado"), "cantidad": p.get("cantidadNegociada"),
            "moneda": p.get("moneda"), "ultima": p.get("ultimaOperacion"),
        })
        # `tomas` solo se anota si la sesión es la de HOY. Estampar la hora de
        # nuestro reloj sobre una sesión de la semana pasada diría que esa
        # acción se transó a esta hora, y es mentira: lleva días sin negociar.
        if sesion == hoy and (not e["tomas"] or e["tomas"][-1][1] != p["precio"]):
            e["tomas"].append([ahora.strftime("%H:%M"), p["precio"]])

    # Se conservan los últimos DIAS_INTRADIA días de mercado y nada más.
    for viejo in sorted(dias)[:-DIAS_INTRADIA]:
        dias.pop(viejo, None)

    salida = {
        "_comment": ("Foto POR DÍA de lo que el endpoint de mercado de la BVL solo "
                     "sabe de hoy: apertura, mínimo, máximo, volumen (monto y "
                     "cantidad), número de operaciones y la hora de la última. "
                     "`tomas` son los [hora, precio] de cada corrida del robot, "
                     "anotados solo cuando el precio cambió. NO se puede reconstruir "
                     "hacia atrás: lo que no se guarda hoy se pierde. Lo genera "
                     f"extractor/fetch_precios.py y guarda {DIAS_INTRADIA} días."),
        "generado": ahora.strftime("%Y-%m-%d %H:%M"),
        "dias": dias,
    }
    with open(INTRADIA, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=1)
    hoy = dias.get(max(dias)) if dias else {}
    print(f"\nIntradía: {len(dias)} días guardados · {len(hoy)} acciones negociaron "
          f"el {max(dias) if dias else '—'}")


def bajar_mercado():
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36",
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.bvl.com.pe",
        "Referer": "https://www.bvl.com.pe/mercado/movimientos-diarios",
    })
    r = s.post(URL, data="{}", timeout=40)
    r.raise_for_status()
    return r.json().get("content", [])


def main():
    with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)

    mercado = bajar_mercado()
    por_nem = {row.get("nemonico"): row for row in mercado}
    print(f"Mercado BVL: {len(mercado)} cotizaciones")

    precios = {}
    for c in cfg["empresas"]:
        nem = c.get("bvlNemonico")
        row = por_nem.get(nem)
        if not row:
            print(f"  {c['ticker']:10} nem={nem!s:10} -> NO encontrado en BVL")
            precios[c["ticker"]] = {"nemonico": nem, "precio": None, "fecha": None,
                                    "moneda": None, "encontrado": False}
            continue
        # 'last' = último precio REALMENTE transado (el cierre del día). 'sell' es la
        # orden de venta (ask) parada en pantalla, NO el cierre -> nunca usar 'sell'.
        # Si no hay 'last' (la acción no negoció hoy o la BVL no lo expone), caemos al
        # último cierre oficial: 'previous' + 'previousDate'.
        last = row.get("last")
        last_dt = row.get("lastDate")
        previo = row.get("previous")
        prev_dt = row.get("previousDate")
        neg_amt = row.get("negotiatedAmount") or 0
        ops = row.get("operationsNumber")
        nego_hoy = (neg_amt and neg_amt > 0) or (ops not in (None, "0", "0 "))

        if last is not None:
            precio = last
            fecha = (last_dt or "")[:10] or prev_dt
        else:
            precio = previo
            fecha = prev_dt

        precios[c["ticker"]] = {
            "nemonico": nem,
            "precio": precio,
            "previo": previo,
            "moneda": row.get("currency"),
            "fecha": fecha,
            "sinNegociacionReciente": not nego_hoy,
            # ── Lo que el endpoint siempre trajo y nunca se guardaba ──────
            # La hora REAL de la última operación, no la de nuestra consulta:
            # dice si la acción negoció hasta el cierre o se quedó muda a las
            # 11 de la mañana, que es información distinta y valiosa.
            "ultimaOperacion": hora_lima(last_dt),
            "apertura": row.get("opening"),
            "minimo": row.get("minimun"),
            "maximo": row.get("maximun"),
            # CUÁNTA PLATA se movió. Sin esto, un +3% con 69 operaciones y un
            # +3% con 13 se pintaban idénticos.
            "operaciones": int(num(ops) or 0),
            "montoNegociado": num(neg_amt),
            "cantidadNegociada": num(row.get("negotiatedQuantity")),
            "variacionPct": row.get("percentageChange"),
            "fuente": "BVL — movimientos diarios (dataondemand.bvl.com.pe)",
            "encontrado": True,
        }
        flag = "" if nego_hoy else "  (sin neg. reciente, usa último cierre)"
        vol = f" · {int(num(ops) or 0):>3} ops" if nego_hoy else ""
        print(f"  {c['ticker']:10} nem={nem:10} {row.get('currency')} {precio} "
              f"@ {fecha}{vol}{flag}")

    doc = {
        "_comment": ("Precios de CIERRE de la BVL (movimientos diarios). 'precio' es el "
                     "último precio de cierre; 'fecha' es el día de ese cierre (normalmente "
                     "el día hábil anterior). Trae además el rango del día "
                     "(apertura/minimo/maximo), el VOLUMEN (montoNegociado, "
                     "cantidadNegociada, operaciones) y 'ultimaOperacion' con la HORA real "
                     "de la última transacción en hora de Lima. Generado por "
                     "extractor/fetch_precios.py. Volver a correr para actualizar."),
        "fuente": "https://www.bvl.com.pe/mercado/movimientos-diarios",
        "precios": precios,
    }
    out = os.path.join(APP_DATA, "precios.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    print(f"\nEscrito: {out}")

    # El archivo que solo se puede construir hacia adelante.
    acumular_intradia(precios)


if __name__ == "__main__":
    main()
