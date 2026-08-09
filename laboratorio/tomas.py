# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════════════════
⏱️ LAS TOMAS — la rueda por dentro. Lo único que se puede arreglar, y solo hacia adelante.

    python laboratorio/tomas.py                 # una foto del mercado, ahora
    python laboratorio/tomas.py --seguir        # una cada 10 min hasta las 15:10
    python laboratorio/tomas.py --seguir 5      # cada 5 min
    python laboratorio/tomas.py --estado        # cuánto llevamos

EL AGUJERO QUE TAPA. `intradia.json` tiene un campo `tomas` y está VACÍO en las
20 ruedas guardadas: nunca se tomó una sola foto dentro del día. El robot corre
3 veces y solo deja el resumen (apertura/máx/mín/cierre). Así que del interior
de una rueda —cómo llegó ahí el precio— no existe absolutamente nada.

POR QUÉ IMPORTA, MEDIDO. Con esos 20 resúmenes ya se puede ver que la apertura
no anticipa el resto del día: de las 30 acciones líquidas, abrir +1% o más dio
media +0.46% después (n=23) contra un piso de +0.32%. Indistinguible, y con
n=23 no se puede afirmar nada aunque hubiera salido distinto. Para preguntarlo
en serio —«la que va +3% a mediodía, ¿cierra arriba?»— hacen falta tomas, no
resúmenes. A 36 tomas por rueda, en ~30 ruedas hay con qué.

Y la respuesta bien puede ser QUE NO HAY NADA. Eso también sería un resultado:
13 de 15 señales de este repo se invirtieron fuera de muestra, y las que más
prometían fueron las que peor terminaron.

DOS TRAMPAS QUE YA SE PISARON EN ESTE REPO Y NO SE VUELVEN A PISAR
  1. LA HORA NO SALE DEL RELOJ DE LA PC. Sale del payload. Pero ojo: el mismo
     JSON trae `createdDate` en hora de Lima y `lastDate` en UTC (visto el
     7-ago-2026: createdDate 12:40 con lastDate 17:34 para el mismo instante).
     Se guardan los DOS crudos y además el reloj local, sin elegir por vos:
     elegir mal acá corre toda la serie cinco horas y no lo nota nadie.
  2. UNA TOMA SIN OPERACIONES NUEVAS NO ES UN PRECIO NUEVO. Si `ops` y `monto`
     no cambiaron desde la toma anterior, la acción no negoció: el precio es un
     eco. Se guarda igual —saber que estuvo muda 40 minutos es información de
     liquidez— pero marcado con `movio: false`, para que ninguna cuenta futura
     lo confunda con una observación independiente.
═══════════════════════════════════════════════════════════════════════════════
"""
import json, os, sys, time
from datetime import datetime

from motor import cargar

sys.stdout.reconfigure(encoding='utf-8')

AQUI = os.path.dirname(os.path.abspath(__file__))
ARCHIVO = os.path.join(AQUI, 'tomas.json')
CIERRE = (15, 10)          # hasta cuándo sigue el bucle (la BVL cierra ~15:00)


def abrir():
    if not os.path.exists(ARCHIVO):
        return {'_comment': ('Tomas intradía del endpoint público de la BVL, una '
                             'cada N minutos. Lo llena laboratorio/tomas.py. Hacia '
                             'atrás no se reconstruye: lo que no se toma, se pierde.'),
                'dias': {}}
    with open(ARCHIVO, encoding='utf-8') as f:
        return json.load(f)


def guardar(d):
    with open(ARCHIVO, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, separators=(',', ':'))


def bajar():
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
    return r.json().get('content', [])


_NEM = None


def nem_a_ticker():
    global _NEM
    if _NEM is None:
        _NEM = {}
        for e in cargar('empresas.json')['empresas']:
            if e.get('ticker'):
                _NEM[e.get('bvlNemonico') or e['ticker']] = e['ticker']
    return _NEM


def tomar():
    """Una foto. Devuelve (guardadas, con_punta, fecha, hora)."""
    filas = bajar()
    mapa = nem_a_ticker()
    libro = abrir()
    local = datetime.now()
    guardadas = con_punta = 0
    fecha = hora = None

    for row in filas:
        t = mapa.get(row.get('nemonico'))
        if not t or row.get('last') is None:
            continue
        # La fecha del DATO, no la del reloj: una acción que no negoció hoy trae
        # la rueda vieja y guardarla como de hoy envenena la serie.
        f = (row.get('lastDate') or '')[:10]
        if not f:
            continue
        monto = row.get('negotiatedAmount') or 0
        cant = float(row.get('negotiatedQuantity') or 0)
        toma = {
            'hl': local.strftime('%H:%M:%S'),          # reloj de esta PC
            'hs': (row.get('createdDate') or '')[11:19],  # sello del servidor
            'hu': (row.get('lastDate') or '')[11:19],     # última operación (UTC)
            'p': row.get('last'),
            'prev': row.get('previous'),
            'o': row.get('opening'), 'mn': row.get('minimun'), 'mx': row.get('maximun'),
            'bid': row.get('buy'), 'ask': row.get('sell'),
            'monto': monto, 'cant': cant,
            'ops': int(float(row.get('operationsNumber') or 0)),
            'vwap': round(monto / cant, 4) if cant else None,
        }
        dia = libro['dias'].setdefault(f, {})
        serie = dia.setdefault(t, [])
        if serie:
            ult = serie[-1]
            toma['movio'] = (toma['ops'] != ult.get('ops')
                             or toma['monto'] != ult.get('monto'))
            if ult['hl'] == toma['hl']:      # misma toma repetida: no duplica
                continue
        else:
            toma['movio'] = True
        serie.append(toma)
        guardadas += 1
        if toma['bid'] and toma['ask']:
            con_punta += 1
        fecha, hora = f, toma['hl']

    guardar(libro)
    return guardadas, con_punta, fecha, hora


def estado():
    libro = abrir()
    dias = libro['dias']
    if not dias:
        print('Vacío. Corre `python laboratorio/tomas.py --seguir` en rueda.')
        return
    total = sum(len(s) for d in dias.values() for s in d.values())
    print(f'⏱️  {total:,} tomas · {len(dias)} ruedas · '
          f'{len({t for d in dias.values() for t in d})} tickers')
    for f in sorted(dias):
        d = dias[f]
        n = sum(len(s) for s in d.values())
        horas = sorted({x['hl'][:5] for s in d.values() for x in s})
        movidas = sum(1 for s in d.values() for x in s if x.get('movio'))
        print(f'   {f}  {n:>5} tomas · {len(d):>3} tickers · {len(horas):>2} '
              f'momentos ({horas[0]}→{horas[-1]}) · {movidas} con operación nueva')
    faltan = 30 - len(dias)
    if faltan > 0:
        print(f'\n   Faltan ~{faltan} ruedas para poder preguntar algo intradía en serio.')
    else:
        print(f'\n   Ya hay {len(dias)} ruedas: se puede empezar a medir.')


def seguir(minutos=10):
    print(f'⏱️  tomando cada {minutos} min hasta las {CIERRE[0]:02d}:{CIERRE[1]:02d}. '
          f'Ctrl-C para cortar.\n')
    while True:
        ahora = datetime.now()
        if (ahora.hour, ahora.minute) >= CIERRE:
            print(f'\n🔔 {ahora:%H:%M} — cerrado. Fin del bucle.')
            estado()
            return
        try:
            g, cp, f, h = tomar()
            print(f'   {ahora:%H:%M:%S}  {g:>3} tomas · {cp:>3} con punta · rueda {f}')
        except Exception as e:
            # Una caída del endpoint no puede matar la acumulación del día.
            print(f'   {ahora:%H:%M:%S}  ⚠ {type(e).__name__}: {e}')
        time.sleep(minutos * 60)


if __name__ == '__main__':
    if '--estado' in sys.argv:
        estado()
    elif '--seguir' in sys.argv:
        i = sys.argv.index('--seguir')
        m = int(sys.argv[i + 1]) if len(sys.argv) > i + 1 else 10
        seguir(m)
    else:
        g, cp, f, h = tomar()
        print(f'✅ {g} tomas guardadas ({cp} con punta) · rueda {f} · {h}')
        estado()
