# -*- coding: utf-8 -*-
"""📖 LAS PUNTAS — la mejor compra y la mejor venta, guardadas rueda por rueda.

POR QUÉ EXISTE (13-ago-2026). Ese día RIO cayó 10.42% y la punta de compra hizo
algo que ningún cierre puede contar: a las 09:35 tenía 941 títulos a 2.210, a
las 13:09 tenía 2,904 al mismo precio, y a las 15:00 había desaparecido — la
mejor compra estaba en 2.050. Entre las 13:09 y las 15:00 el valor de salida de
una posición de 2,880 acciones cayó US$473 **sin que se negociara una sola
acción**. El OHLC de esa rueda no registra nada de eso: abrió, tocó máximo y
mínimo, cerró. La liquidez que se evapora no deja huella en el precio.

Todo lo que se usó ese día se leyó a mano de una pantalla. Mañana no existía.

LA FUENTE YA ESTABA. `fetch_precios.py` golpea
`dataondemand.bvl.com.pe/v1/stock-quote/market` cada 10 minutos y ese endpoint
devuelve `buy` y `sell` en cada registro. El extractor los descartaba. No hace
falta fuente nueva, ni justificar look-ahead, ni pedir permisos: es el mismo
POST que ya corre 48 veces al día.

LO QUE ESTE ARCHIVO **NO** PUEDE DAR, y va arriba para que nadie lo asuma:
la BVL pública publica **solo el primer nivel** — la mejor compra y la mejor
venta, sin cantidades. Así que se puede medir el spread, su serie y su
comportamiento por hora, pero **NO la profundidad ni el costo de salida de un
tamaño dado**. Eso exige el libro completo, que solo se ve desde una plataforma
autenticada. Cualquier cálculo de slippage por tamaño que se apoye en este
archivo estaría inventando los niveles que no tiene.

FASE 1 ES INSTRUMENTACIÓN, NO PREDICCIÓN. Este archivo mide y guarda. No
alimenta ninguna señal, no toca `switch_rio_ppx.py` y no cambia el 0.35%
supuesto de `canje.py` hasta que haya muestra para reemplazarlo con algo medido.

APPEND-ONLY. Una captura por línea, un archivo por día, y nunca se reescribe:
`app/src/data/puntas/YYYY-MM-DD.jsonl`. Vive bajo `app/src/data` a propósito —
es la carpeta que el robot commitea, así que la serie se acumula sola en el
repo. Se descartan las capturas idénticas a la anterior del mismo papel: 48
líneas iguales por rueda no son datos, son ruido.

    python extractor/fetch_puntas.py
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

import requests

AQUI = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(AQUI, '..', 'app', 'src', 'data', 'puntas')
URL = 'https://dataondemand.bvl.com.pe/v1/stock-quote/market'
LIMA = timezone(timedelta(hours=-5))

# El universo que se sigue. No se guardan los 780 papeles: la mayoría no
# negocia y llenaría el repo de líneas muertas. Si mañana hace falta otro, se
# agrega acá y empieza a acumular desde ese día — hacia atrás no se puede.
SEGUIDOS = {
    'RIO', 'PPX', 'PML', 'BVN', 'VOLCABC1', 'NEXAPEC1', 'ATACOBC1',
    'MINSURI1', 'CVERDEC1', 'PODERC1', 'BROCALC1', 'SIDERC1', 'GDX', 'GLD',
    'SCCO', 'AENZAC1', 'CREDITC1', 'BAP', 'LUSURC1',
}

CAMPOS = ('buy', 'sell', 'last', 'minimun', 'maximun', 'opening', 'previous',
          'negotiatedAmount', 'negotiatedQuantity', 'operationsNumber',
          'percentageChange', 'currency', 'lastDate')


def bajar():
    s = requests.Session()
    s.headers.update({
        'Content-Type': 'application/json',
        'Origin': 'https://www.bvl.com.pe',
        'Referer': 'https://www.bvl.com.pe/mercado/movimientos-diarios',
        'User-Agent': 'Mozilla/5.0',
    })
    r = s.post(URL, data='{}', timeout=40)
    r.raise_for_status()
    d = r.json()
    return d.get('content') if isinstance(d, dict) else d


def firma(x):
    """Lo que tiene que cambiar para que la captura valga la pena guardarse."""
    return (x.get('buy'), x.get('sell'), x.get('last'),
            x.get('negotiatedQuantity'), x.get('lastDate'))


def ultimas(ruta):
    """Última firma vista de cada papel en el archivo del día."""
    if not os.path.exists(ruta):
        return {}
    out = {}
    with open(ruta, encoding='utf-8') as f:
        for l in f:
            if not l.strip():
                continue
            try:
                r = json.loads(l)
            except Exception:
                continue
            out[r['nemonico']] = (r.get('buy'), r.get('sell'), r.get('last'),
                                  r.get('negotiatedQuantity'), r.get('lastDate'))
    return out


def main():
    ahora = datetime.now(LIMA)
    os.makedirs(DIR, exist_ok=True)
    ruta = os.path.join(DIR, ahora.strftime('%Y-%m-%d') + '.jsonl')
    previas = ultimas(ruta)

    try:
        datos = bajar()
    except Exception as e:
        print(f'  ERROR {type(e).__name__} — no se guarda nada')
        return 1
    if not datos:
        print('  el endpoint no devolvió registros')
        return 1

    nuevas, sin_cambio, sin_punta = 0, 0, 0
    with open(ruta, 'a', encoding='utf-8') as f:
        for x in datos:
            tk = x.get('nemonico')
            if tk not in SEGUIDOS:
                continue
            b, v = x.get('buy'), x.get('sell')
            if b is None and v is None:
                sin_punta += 1
                continue
            if firma(x) == previas.get(tk):
                sin_cambio += 1
                continue
            fila = {'ts': ahora.isoformat(timespec='seconds'), 'nemonico': tk,
                    'plaza': 'BVL'}
            for c in CAMPOS:
                fila[c] = x.get(c)
            # El spread se guarda calculado además de las puntas: si mañana se
            # corrige la fórmula, el crudo sigue estando para rehacerlo.
            if b and v and b > 0 and v > 0:
                medio = (b + v) / 2
                fila['spread_abs'] = round(v - b, 6)
                fila['spread_pct'] = round(100 * (v - b) / medio, 4)
            f.write(json.dumps(fila, ensure_ascii=False) + '\n')
            nuevas += 1

    total = sum(1 for _ in open(ruta, encoding='utf-8'))
    print(f'Puntas BVL — {ahora.strftime("%Y-%m-%d %H:%M:%S")}')
    print(f'  guardadas {nuevas} · sin cambio {sin_cambio} · sin punta {sin_punta}')
    print(f'  archivo: {os.path.relpath(ruta, os.path.join(AQUI, ".."))}  '
          f'({total} capturas hoy)')
    return 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(main())
