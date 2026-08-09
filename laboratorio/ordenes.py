# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════════════════
📮 ÓRDENES LÍMITE — ¿la paciencia sale más barata que cruzar el spread?

    python laboratorio/ordenes.py            # NEXA, 24 ruedas de barras de 5 min
    python laboratorio/ordenes.py BVN

LA PREGUNTA QUE PUEDE TUMBAR TODO EL ARGUMENTO DE COSTOS. Medido en el libro
real de Nexa el 7-ago, CRUZAR el spread cuesta 1.07% a 2.86% de ida y vuelta
según el tamaño, y contra un rango diario de 2.78% eso mata cualquier operación
intradía. Pero ese cálculo asume órdenes A MERCADO. Con una orden LÍMITE no
pagas spread: pagas en riesgo de no ejecutar. Si la paciencia baja el costo a
~0.6% (solo comisión), hay que capturar 22% del rango en vez de 57%, y el
argumento se cae.

LA TRAMPA QUE HACE QUE ESTO NO SEA GRATIS —y que casi nadie mide—. Tu orden de
compra por debajo del mercado ejecuta **exactamente cuando el precio baja hasta
vos**, o sea cuando el que vende tenía razón. Es selección adversa: los fills
buenos son los que no querías. Por eso acá no se mide «¿ejecutó?» sino
**«¿ejecutó, y qué pasó después?»**, y las no ejecutadas no desaparecen: se les
cobra el precio de salir a buscar el papel más tarde.

TRES DEFINICIONES DE «EJECUTÓ», DE OPTIMISTA A HONESTA
  · tocó      — el mínimo de alguna barra llegó a tu precio. Es el techo
                teórico: en la práctica, que el precio toque no significa que
                tu orden —última de la cola— se llene.
  · persistió — el precio estuvo en tu nivel o mejor en 2+ barras.
  · con papel — además, el volumen negociado desde que pusiste la orden supera
                1.5× tu tamaño. Es la única de las tres que mira si había con
                qué llenarte.

POR QUÉ SE MIDE SOBRE EL ADR Y QUÉ SIGNIFICA ESO. La BVL no tiene historia
intradía. NEXA en NYSE sí: 24 ruedas de 5 minutos. Pero NEXA negocia miles de
veces al día y NEXAPEC1 hizo **98 operaciones en toda la rueda de hoy**. La
probabilidad de que te llenen depende del papel que pase por tu precio, y en la
BVL pasa muchísimo menos. Entonces esto NO es una estimación para NEXAPEC1: es
un **TECHO**. Si la paciencia no gana acá, en la BVL gana menos. Si gana acá,
no se puede concluir nada para allá sin volver a medir — y para eso están las
tomas que empezaron el 7-ago.
═══════════════════════════════════════════════════════════════════════════════
"""
import sys, statistics as st
from collections import defaultdict
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

DESCUENTOS = [0.10, 0.25, 0.50, 1.00]   # % por debajo del precio al que pones el límite
SPREAD_CRUZAR = 0.47                     # % de ida: la punta de Nexa medida hoy (top del libro)
TAMANO = 5000                            # acciones de la orden virtual


def bajar(simbolo, rango='1mo', intervalo='5m'):
    """Barras con OHLC y volumen. El mínimo de la barra es lo que decide si un
    límite de compra se tocó; el cierre solo no alcanza."""
    import requests
    s = requests.Session()
    s.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0'})
    r = s.get(f'https://query1.finance.yahoo.com/v8/finance/chart/{simbolo}',
              params={'interval': intervalo, 'range': rango}, timeout=30)
    r.raise_for_status()
    j = r.json()['chart']['result'][0]
    ts, q = j['timestamp'], j['indicators']['quote'][0]
    dias = defaultdict(list)
    for i, t in enumerate(ts):
        c, lo, v = q['close'][i], q['low'][i], q['volume'][i]
        if c is None or lo is None:
            continue
        dias[datetime.fromtimestamp(t).strftime('%Y-%m-%d')].append(
            {'h': datetime.fromtimestamp(t).strftime('%H:%M'), 'c': c,
             'lo': lo, 'hi': q['high'][i] or c, 'v': v or 0})
    return dict(dias)


def simular(barras, i, desc, tamano):
    """Pone un límite de compra a −desc% del precio de la barra i y camina el
    resto del día. Devuelve qué escenario ejecutó y a qué precio se termina
    entrando bajo cada uno."""
    p0 = barras[i]['c']
    limite = p0 * (1 - desc / 100)
    tocadas = vol = 0
    res = {'toco': None, 'persistio': None, 'con_papel': None}
    for b in barras[i + 1:]:
        vol += b['v']
        if b['lo'] <= limite:
            tocadas += 1
            if res['toco'] is None:
                res['toco'] = limite
            if tocadas >= 2 and res['persistio'] is None:
                res['persistio'] = limite
            if vol >= tamano * 1.5 and res['con_papel'] is None:
                res['con_papel'] = limite
    # El que NO ejecutó tiene que salir a buscar el papel al final del día,
    # cruzando el spread. Ignorar eso es la forma más fácil de que la paciencia
    # parezca gratis.
    cierre = barras[-1]['c'] * (1 + SPREAD_CRUZAR / 100)
    return res, p0, cierre


def main(sim='NEXA'):
    dias = bajar(sim)
    dias = {f: b for f, b in dias.items() if len(b) >= 20}
    print(f'\n📮 {sim} · {len(dias)} ruedas · barras de 5 min · orden de {TAMANO:,} acciones')
    print(f'   comparación: cruzar el spread AHORA cuesta +{SPREAD_CRUZAR:.2f}% de ida\n')

    print(f'   {"límite":>8} {"escenario":<12} {"ejecutó":>9} {"entrada media":>15} '
          f'{"incl. los que NO":>18} {"ahorro":>11}')
    for desc in DESCUENTOS:
        for esc in ('toco', 'persistio', 'con_papel'):
            entradas, todas, n = [], [], 0
            for f, barras in dias.items():
                for i in range(3, len(barras) - 6):
                    res, p0, cierre = simular(barras, i, desc, TAMANO)
                    n += 1
                    if res[esc] is not None:
                        entradas.append(res[esc] / p0)
                        todas.append(res[esc] / p0)
                    else:
                        todas.append(cierre / p0)      # tuvo que perseguir
            if not n:
                continue
            fill = 100 * len(entradas) / n
            e_fill = (st.mean(entradas) - 1) * 100 if entradas else None
            e_todo = (st.mean(todas) - 1) * 100
            # El ahorro es contra CRUZAR, no contra cero. Comparar contra cero
            # hacía ver como derrota lo que en realidad es ahorro.
            ahorro = SPREAD_CRUZAR - e_todo
            marca = ('  ← ahorra' if ahorro > 0.05 else
                     '  ← igual que cruzar' if ahorro > -0.05 else '  ← peor')
            print(f'   {-desc:>7.2f}% {esc:<12} {fill:>8.0f}% '
                  f'{e_fill if e_fill is not None else 0:>14.2f}% '
                  f'{e_todo:>17.2f}% {ahorro:>+8.2f} pp{marca}')
        print()

    print('   COLUMNAS. «entrada media» es a qué precio entraste cuando ejecutó,')
    print('   contra el precio del momento en que decidiste. «incl. los que NO» es la')
    print('   que importa: promedia TODOS los intentos, cobrándole al que no ejecutó')
    print(f'   el precio de salir a buscar el papel al cierre. «ahorro» la compara')
    print(f'   contra cruzar ({SPREAD_CRUZAR:.2f}%), que es la alternativa real.')
    seleccion(dias)


def seleccion(dias):
    """La selección adversa, medida: entre las que SÍ ejecutaron, ¿qué hizo el
    precio después? Si ejecutar es una mala noticia, se ve acá."""
    print(f'\n   ── SELECCIÓN ADVERSA: qué pasó DESPUÉS de que te ejecutaran ──')
    for desc in (0.25, 0.50):
        despues_fill, despues_nofill = [], []
        for f, barras in dias.items():
            cierre = barras[-1]['c']
            for i in range(3, len(barras) - 6):
                res, p0, _ = simular(barras, i, desc, TAMANO)
                r = (cierre / p0 - 1) * 100
                (despues_fill if res['con_papel'] is not None else despues_nofill).append(r)
        if len(despues_fill) < 20 or len(despues_nofill) < 20:
            continue
        print(f'   límite a −{desc:.2f}%  ·  ejecutadas n={len(despues_fill):>4}: '
              f'el precio al cierre quedó {st.mean(despues_fill):+.2f}% vs tu referencia')
        print(f'   {"":>18}   NO ejecutadas n={len(despues_nofill):>4}: '
              f'{st.mean(despues_nofill):+.2f}%')
        d = st.mean(despues_fill) - st.mean(despues_nofill)
        print(f'   {"":>18}   diferencia {d:+.2f} pp '
              f'{"← ejecutar fue MALA noticia" if d < -0.1 else "← sin castigo visible"}\n')


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('-')]
    main(a[0] if a else 'NEXA')
