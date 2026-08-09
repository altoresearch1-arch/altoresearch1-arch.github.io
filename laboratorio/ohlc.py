# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════════════════
🗃️ EL ACUMULADOR — lo único que arregla los agujeros del repo, y solo hacia adelante.

    python laboratorio/ohlc.py                    # cosecha la rueda de hoy (auto)
    python laboratorio/ohlc.py NEXAPEC1 4.10 4.14 # anota el bid/ask que ves en la SAB
    python laboratorio/ohlc.py --estado           # cuánto llevamos acumulado

QUÉ RESUELVE. Tres cosas que el laboratorio no puede medir por falta de historia:
velas (no hay OHLC viejo), volumen (solo el de hoy) y —la más cara— el **spread**,
que es el supuesto más frágil de todo el laboratorio: con 3% de ida y vuelta, la
ventaja del rebote muere. Hacia atrás no se reconstruye. Hacia adelante sí, si se
guarda cada día.

LO QUE NO NECESITA MANO, Y ES CASI TODO. `precios.json` ya trae apertura, máximo,
mínimo, cierre, monto, cantidad y operaciones de ~50 tickers, y el robot lo
refresca a diario — pero lo SOBREESCRIBE. Así que esto no le pide nada al usuario:
cosecha las 50 solo. Lo único que ningún archivo tiene es la punta compradora y
vendedora, y eso sí hay que copiarlo de la pantalla de la SAB, cuando se pueda y
para las que importen.

LA FECHA VIENE DEL DATO, NUNCA DEL RELOJ. `precios.json` trae una `fecha` POR
TICKER y no todas coinciden: hoy conviven 2026-08-03, 04 y 05 en el mismo archivo
(la BVL repite el último cierre de las que no operaron). Sellar con `datetime.now()`
guardaría la rueda del lunes con fecha de miércoles y envenenaría la serie sin que
nadie se entere. Por eso la clave es (ticker, fecha del dato) y se reescribe en su
sitio si ya existía.
═══════════════════════════════════════════════════════════════════════════════
"""
import json, os, sys

from motor import cargar, series_negociadas

sys.stdout.reconfigure(encoding='utf-8')

AQUI = os.path.dirname(os.path.abspath(__file__))
ARCHIVO = os.path.join(AQUI, 'ohlc_acumulado.json')


def abrir():
    if not os.path.exists(ARCHIVO):
        return {'_comment': ('Acumulado diario de OHLC, volumen y —cuando se anota a '
                             'mano— punta compradora/vendedora. Lo llena '
                             'laboratorio/ohlc.py. Hacia atrás no se puede reconstruir: '
                             'lo que no se guarda hoy se pierde.'),
                'ruedas': {}}
    with open(ARCHIVO, encoding='utf-8') as f:
        return json.load(f)


def guardar(d):
    with open(ARCHIVO, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)


def cosechar():
    """Se lleva todo lo que precios.json tenga hoy. Idempotente: correrlo tres
    veces el mismo día no duplica nada, reescribe la misma clave."""
    libro = abrir()
    precios = cargar('precios.json')['precios']
    negociadas = set(series_negociadas())
    nuevas = actualizadas = 0

    for t, p in precios.items():
        f = p.get('fecha')
        if not f or not p.get('encontrado') or p.get('sinNegociacionReciente'):
            continue
        if not (p.get('apertura') and p.get('maximo') and p.get('minimo')):
            continue                       # sin OHLC completo no entra: media vela no es vela
        clave = f'{t}|{f}'
        vela = {
            'ticker': t, 'fecha': f,
            'o': p['apertura'], 'h': p['maximo'], 'l': p['minimo'], 'c': p.get('precio'),
            'previo': p.get('previo'),
            'monto': p.get('montoNegociado'), 'cantidad': p.get('cantidadNegociada'),
            'ops': p.get('operaciones'),
            'ultima': p.get('ultimaOperacion'),
            'negociada': t in negociadas,
        }
        anterior = libro['ruedas'].get(clave)
        if anterior:
            vela = {**anterior, **vela}    # nunca pisa un bid/ask anotado a mano
            actualizadas += 1
        else:
            nuevas += 1
        libro['ruedas'][clave] = vela

    guardar(libro)
    return nuevas, actualizadas


def anotar_punta(ticker, bid, ask, fecha=None):
    """La punta que se ve en la pantalla de la SAB. Es el único dato que ningún
    archivo del repo tiene y el que decide si el rebote del hallazgo 4.2 es
    operable o es un espejismo."""
    libro = abrir()
    if fecha is None:
        propias = [v['fecha'] for v in libro['ruedas'].values() if v['ticker'] == ticker]
        if not propias:
            return None
        fecha = max(propias)
    clave = f'{ticker}|{fecha}'
    v = libro['ruedas'].get(clave)
    if not v:
        return None
    medio = (bid + ask) / 2
    v['bid'], v['ask'] = bid, ask
    # Contra el punto medio, no contra el bid: lo que cuesta una ida y vuelta es
    # cruzar el spread entero, y medirlo sobre el bid lo subestima.
    v['spread_pct'] = round((ask - bid) / medio * 100, 3) if medio else None
    guardar(libro)
    return v


def vivo():
    """La punta, del MISMO endpoint público que el robot ya llama a diario.

    El hallazgo que ahorra todo un puente a la SAB: `fetch_precios.py:200` ya lo
    documentaba sin usarlo — «'sell' es la orden de venta (ask) parada en
    pantalla, NO el cierre → nunca usar 'sell'». Para el precio tenían razón en
    descartarla; para medir el spread es exactamente el dato que falta, y llega
    gratis en la misma respuesta.

    EL PAYLOAD CAMBIA CON LA HORA. Con el mercado cerrado el endpoint devuelve
    solo `previous`; durante la rueda agrega `last`, `buy`, `sell`, `opening`,
    `minimum`, `maximum`. Por eso esto hay que correrlo EN RUEDA (9:00–15:00 hora
    de Lima) y por eso, cuando no hay punta, lo dice en vez de guardar ceros.
    """
    import requests
    s = requests.Session()
    s.headers.update({
        'User-Agent': ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                       'Chrome/120.0 Safari/537.36'),
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.bvl.com.pe',
        'Referer': 'https://www.bvl.com.pe/mercado/movimientos-diarios',
    })
    r = s.post('https://dataondemand.bvl.com.pe/v1/stock-quote/market',
               data='{}', timeout=40)
    r.raise_for_status()
    filas = r.json().get('content', [])

    nem_a_ticker = {}
    for e in cargar('empresas.json')['empresas']:
        if e.get('ticker'):
            nem_a_ticker[e.get('bvlNemonico') or e['ticker']] = e['ticker']

    libro = abrir()
    puntas = con_punta = 0
    for row in filas:
        t = nem_a_ticker.get(row.get('nemonico'))
        if not t:
            continue
        bid, ask = row.get('buy'), row.get('sell')
        if not bid or not ask or bid <= 0 or ask <= 0:
            continue
        puntas += 1
        f = (row.get('lastDate') or row.get('previousDate') or '')[:10]
        if not f:
            continue
        clave = f'{t}|{f}'
        v = libro['ruedas'].get(clave) or {'ticker': t, 'fecha': f}
        medio = (bid + ask) / 2
        v.update({'bid': bid, 'ask': ask,
                  'spread_pct': round((ask - bid) / medio * 100, 3) if medio else None,
                  'punta_de': 'bvl'})
        libro['ruedas'][clave] = v
        con_punta += 1

    guardar(libro)
    if not puntas:
        print('⏸  El endpoint no está devolviendo punta ahora mismo.')
        print('   Con el mercado cerrado solo trae `previous`. Corre esto EN RUEDA')
        print('   (9:00–15:00 hora de Lima) y se llena solo, sin tocar la SAB.')
    else:
        print(f'✅ {con_punta} puntas guardadas del endpoint público de la BVL')
    return con_punta


def estado():
    libro = abrir()
    ruedas = list(libro['ruedas'].values())
    if not ruedas:
        print('Vacío. Corre `python laboratorio/ohlc.py` después de cada corrida del robot.')
        return
    fechas = sorted({v['fecha'] for v in ruedas})
    tickers = sorted({v['ticker'] for v in ruedas})
    con_punta = [v for v in ruedas if v.get('spread_pct') is not None]
    print(f'📦 {len(ruedas)} velas · {len(tickers)} tickers · '
          f'{len(fechas)} ruedas ({fechas[0]} → {fechas[-1]})')
    print(f'   con punta anotada: {len(con_punta)}')
    if con_punta:
        import statistics as st
        sp = [v['spread_pct'] for v in con_punta]
        print(f'   spread mediano: {st.median(sp):.2f}%  '
              f'(la ventaja del rebote muere sobre ~3% ida y vuelta)')
        por_t = {}
        for v in con_punta:
            por_t.setdefault(v['ticker'], []).append(v['spread_pct'])
        for t, sp in sorted(por_t.items(), key=lambda x: -st.median(x[1])):
            print(f'      {t:<10} n={len(sp):>2}  mediana {st.median(sp):.2f}%')
    faltan = 30 - len(fechas)
    print(f'\n   Para velas utilizables faltan ~{max(faltan,0)} ruedas más.')
    print('   Para el spread, basta con anotar la punta de las 3-4 acciones que operes.')


if __name__ == '__main__':
    if '--estado' in sys.argv:
        estado()
    elif '--vivo' in sys.argv:
        vivo()
        estado()
    elif len(sys.argv) >= 4:
        t, bid, ask = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
        f = sys.argv[4] if len(sys.argv) > 4 else None
        v = anotar_punta(t, bid, ask, f)
        if not v:
            print(f'{t}: no hay vela guardada de esa rueda. Corre primero '
                  f'`python laboratorio/ohlc.py` para cosecharla.')
        else:
            print(f'✅ {t} {v["fecha"]}  bid {bid} / ask {ask}  '
                  f'→ spread {v["spread_pct"]}% ida y vuelta')
            print(f'   sobre un rebote esperado de +2.25% (mediana del −5%), '
                  f'quedan {2.25 - 0.6 - v["spread_pct"]:+.2f}% netos')
    else:
        n, a = cosechar()
        print(f'✅ cosechadas {n} velas nuevas, {a} reescritas')
        estado()
