# -*- coding: utf-8 -*-
"""LA BITÁCORA — el cerebro empieza a apostar en público.

Por qué existe. Tres reglas quedaron congeladas esperando datos (R4 la U
invertida, R6 el techo del año, R7 el rango intradía) y el cerebro está en 2/5
sin forma de mejorar con lo que hay. Todo eso se destraba de una sola manera:
acumulando lecturas hacia adelante, con el criterio ya escrito.

Y hay una razón para empezar HOY y no cuando esté más pulido: el dato que no se
captura se pierde. Ya pasó con el volumen histórico — no existe y no se puede
reconstruir. Cada rueda sin bitácora es una rueda que no vuelve.

CÓMO FUNCIONA
  · `anotar`   guarda la lectura de cada acción para la rueda de hoy, y NO la
               vuelve a tocar nunca. Una apuesta escrita no se edita.
  · `resolver` cuando pasan 5 ruedas, busca qué pasó y lo escribe al lado.
  · `examen`   corre las mismas cinco pruebas sobre lo acumulado.

LO QUE HACE HONESTA A LA BITÁCORA: la lectura se escribe ANTES de que exista el
resultado. No hay forma de que el cerebro se acomode después, que es el error
que este laboratorio cometió tres veces con datos históricos.

    python laboratorio/bitacora.py anotar
    python laboratorio/bitacora.py resolver
    python laboratorio/bitacora.py examen
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cerebro as C

ARCHIVO = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bitacora.jsonl')


def cargar():
    if not os.path.exists(ARCHIVO):
        return []
    with open(ARCHIVO, encoding='utf-8') as f:
        return [json.loads(l) for l in f if l.strip()]


def guardar(filas):
    with open(ARCHIVO, 'w', encoding='utf-8') as f:
        for r in filas:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')


def ultima_rueda(t):
    return len(C.SERIES[t]) - 1


def anotar():
    """La lectura de la última rueda de cada acción. Nunca pisa una ya escrita."""
    C.LIFT, C.LIFT_ZONA = C.calcular_lift('9999-12-31')   # todo lo conocido hasta hoy
    filas = cargar()
    ya = {(r['fecha'], r['ticker']) for r in filas}
    nuevas = 0
    for t in C.SERIES:
        i = ultima_rueda(t)
        fecha = C.SERIES[t][i][0]
        if (fecha, t) in ya:
            continue
        L = C.leer(t, i)
        if L is None:
            continue
        v = C.SERIES[t]
        filas.append({
            'fecha': fecha, 'ticker': t, 'precio': v[i][1],
            'mov_dia': round(C.mov(v, i), 3) if C.mov(v, i) is not None else None,
            # la apuesta
            'p': round(L['p'], 4),
            'base': round(L['cruda'], 4),
            'rango': L.get('rango'),
            'clima': C.clima(fecha),
            'zona': C.zona(t, i),
            'cuartil': L['cuartil'],
            'habla': L['habla'],
            # las candidatas congeladas, anotadas aunque todavía no opinen
            'r6_techo': (C.posicion52(t, i) or 0) > 80,
            'pos52': round(C.posicion52(t, i), 1) if C.posicion52(t, i) is not None else None,
            'resultado': None, 'se_movio': None,
        })
        nuevas += 1
    guardar(filas)
    print(f'anotadas {nuevas} lecturas nuevas · bitácora: {len(filas)} en total')
    if nuevas:
        f = filas[-1]['fecha']
        hab = sum(1 for r in filas if r['fecha'] == f and r['habla'])
        print(f'  rueda {f}: el cerebro habla en {hab} de {nuevas}')


def resolver():
    """Escribe qué pasó, 5 ruedas después. Solo rellena lo que está vacío."""
    filas = cargar()
    n = 0
    for r in filas:
        if r['resultado'] is not None:
            continue
        v = C.SERIES.get(r['ticker'])
        if not v:
            continue
        idx = {f: k for k, (f, _) in enumerate(v)}.get(r['fecha'])
        if idx is None or idx + C.HORIZONTE >= len(v):
            continue
        ret = (v[idx + C.HORIZONTE][1] / v[idx][1] - 1) * 100
        r['resultado'] = round(ret, 3)
        r['se_movio'] = abs(ret) >= C.UMBRAL
        n += 1
    guardar(filas)
    pend = sum(1 for r in filas if r['resultado'] is None)
    print(f'resueltas {n} · quedan {pend} esperando sus 5 ruedas')


def examen():
    filas = [r for r in cargar() if r['resultado'] is not None]
    if len(filas) < 20:
        print(f'solo {len(filas)} lecturas resueltas. El examen se corre con 100+.')
        print('A ~46 lecturas por rueda, eso es una semana de bolsa.')
        return
    real = [(r['p'], r['se_movio']) for r in filas]
    clim = [(r['base'], r['se_movio']) for r in filas]
    b1, b2 = C.brier(real), C.brier(clim)
    inc, res, cal = C.descomponer(real)
    _, res2, _ = C.descomponer(clim)
    pm = sum(p for p, _ in real) / len(real)
    om = sum(1 for _, s in real if s) / len(real)
    print(f'BITÁCORA — {len(filas)} lecturas resueltas, '
          f'{filas[0]["fecha"]} a {filas[-1]["fecha"]}')
    print(f'  Brier {b1:.4f} vs base de la acción {b2:.4f}   ganancia {b2-b1:+.5f}')
    print(f'  resolución {res:.4f} vs {res2:.4f}   ({res-res2:+.5f})')
    print(f'  dice {100*pm:.1f}%, pasa {100*om:.1f}%   sesgo {100*(om-pm):+.1f} pts')
    hab = [r for r in filas if r['habla']]
    if hab:
        print(f'  cuando habla ({len(hab)}): acierta '
              f'{100*sum(1 for r in hab if r["se_movio"])/len(hab):.0f}%')
    # las candidatas congeladas
    for nom, cond in [('R6 pegada al techo', lambda r: r['r6_techo'])]:
        g = [r for r in filas if cond(r)]
        o = [r for r in filas if not cond(r)]
        if len(g) >= 15 and o:
            print(f'  {nom}: n={len(g)}  se movió {100*sum(1 for r in g if r["se_movio"])/len(g):.0f}%  '
                  f'contra {100*sum(1 for r in o if r["se_movio"])/len(o):.0f}% del resto')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'anotar'
    {'anotar': anotar, 'resolver': resolver, 'examen': examen}[cmd]()
