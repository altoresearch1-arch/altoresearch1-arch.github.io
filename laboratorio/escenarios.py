"""ESCENARIOS EN PRECIO, NO EN PORCENTAJE — 10-ago-2026

Jair pidió qué pasa con RIO y PPX bajo distintos escenarios —Ormuz, EE.UU.,
tasas— y pidió el resultado en dólares por acción, no en porcentajes.

QUÉ ES ESTO Y QUÉ NO ES
No es un pronóstico. Es una TRADUCCIÓN MECÁNICA: se toma un movimiento del oro
(o del crudo) como supuesto y se lo pasa por la beta MEDIDA de cada acción para
sacar el precio implícito. La beta sale de los datos; el escenario lo pone uno.

Por eso cada fila muestra su `r` y su `n`: una beta con r bajo es una traducción
floja y el número que sale se merece poca confianza. Sin eso, un precio con dos
decimales parecería una certeza.

LO QUE EL LABORATORIO **NO** PUEDE SOSTENER, y va dicho arriba de todo:
· El puente de MACRO a ORO no está medido acá. Que un IPC caliente baje el oro
  es teoría de manual — y hoy mismo medimos que **el día del IPC el metal se
  mueve MENOS que un día cualquiera** (oro percentil 27.5 de 5,000 sorteos).
· El puente de ORMUZ a CRUDO tampoco: el 19-jun el estrecho se cerró y el crudo
  BAJÓ 2.32% ese día y 7.64% en cinco ruedas.
Así que los escenarios de arriba de la cadena son supuestos de Jair, no
resultados del laboratorio. Lo único medido es el último tramo: metal -> acción.
"""
import io
import json
import sys

_stdout, sys.stdout = sys.stdout, io.StringIO()
sys.path.insert(0, 'laboratorio')
import cerebro as C  # noqa: E402
sys.stdout = _stdout

M = json.load(open('app/src/data/metales_diarios.json', encoding='utf-8'))['metales']
PRECIO_HOY = {'RIO': 2.460, 'PPX': 0.165, 'BVN': 34.700, 'NEXAPEC1': 4.359,
              'VOLCABC1': 0.890, 'MINSURI1': 7.400, 'GDX': None}


def var_diaria(nom):
    cs = sorted(M[nom]['cierres'].items())
    return {f: (c / cs[i - 1][1] - 1) * 100 for i, (f, c) in enumerate(cs) if i > 0}


def previo(dic, fechas, f):
    import bisect
    i = bisect.bisect_left(fechas, f)
    return dic[fechas[i - 1]] if i > 0 else None


def movs(t):
    v = C.SERIES.get(t) or []
    out = {}
    for i in range(1, len(v)):
        m = C.mov(v, i)
        if m is not None and abs(m) > 1e-9:
            out[v[i][0]] = m
    return out


def beta(t, factor):
    """Beta y r de la acción contra el factor del día ANTERIOR (la forma de R8)."""
    d = var_diaria(factor)
    fs = sorted(d)
    s = movs(t)
    pares = [(previo(d, fs, f), m) for f, m in s.items() if previo(d, fs, f) is not None]
    n = len(pares)
    if n < 60:
        return None
    mx = sum(x for x, _ in pares) / n
    my = sum(y for _, y in pares) / n
    sxx = sum((x - mx) ** 2 for x, _ in pares)
    syy = sum((y - my) ** 2 for _, y in pares)
    sxy = sum((x - mx) * (y - my) for x, y in pares)
    if not sxx or not syy:
        return None
    return sxy / sxx, sxy / (sxx * syy) ** 0.5, n


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print('=' * 90)
    print('  BETAS MEDIDAS — cuánto se mueve la acción MAÑANA por 1% del factor HOY')
    print('=' * 90)
    B = {}
    for factor in ('oro', 'petroleo_wti'):
        print(f'\n  ── factor: {factor} ' + '─' * (66 - len(factor)))
        for t in ('RIO', 'PPX', 'BVN', 'NEXAPEC1', 'VOLCABC1', 'MINSURI1', 'GDX'):
            r = beta(t, factor)
            if r is None:
                print(f'    {t:10s} sin muestra suficiente')
                continue
            b, rr, n = r
            B[(t, factor)] = b
            fuerza = 'fuerte' if abs(rr) >= 0.35 else ('débil' if abs(rr) >= 0.15 else 'NULA')
            print(f'    {t:10s} beta {b:+.3f}   r {rr:+.3f}   n={n:3d}   -> traducción {fuerza}')

    print('\n' + '=' * 90)
    print('  PRECIO IMPLÍCITO PARA LA RUEDA SIGUIENTE, en dólares')
    print('  (parte del cierre de hoy: RIO 2.460 · PPX 0.165)')
    print('=' * 90)
    ESC = [
        ('oro −5%  · Ormuz reabre, riesgo se descuenta', 'oro', -5),
        ('oro −2%  · datos de EE.UU. fuertes, tasas arriba', 'oro', -2),
        ('oro  0%  · sin novedad', 'oro', 0),
        ('oro +2%  · datos débiles, tasas abajo', 'oro', +2),
        ('oro +5%  · escalada en Medio Oriente', 'oro', +5),
    ]
    print(f'\n  {"escenario":48s} {"RIO":>10s} {"PPX":>10s}')
    for desc, fac, mv in ESC:
        fila = ''
        for t in ('RIO', 'PPX'):
            b = B.get((t, fac))
            p = PRECIO_HOY[t]
            fila += f'{p*(1+b*mv/100):>10.3f}' if b is not None else f'{"—":>10s}'
        print(f'  {desc:48s} {fila}')

    print('\n  ── el crudo, que es el canal de Ormuz ' + '─' * 46)
    print(f'  {"escenario":48s} {"RIO":>10s} {"PPX":>10s}')
    for desc, mv in [('crudo +10% · cierre se prolonga', 10),
                     ('crudo  −10% · Ormuz reabre de verdad', -10)]:
        fila = ''
        for t in ('RIO', 'PPX'):
            b = B.get((t, 'petroleo_wti'))
            p = PRECIO_HOY[t]
            fila += f'{p*(1+b*mv/100):>10.3f}' if b is not None else f'{"—":>10s}'
        print(f'  {desc:48s} {fila}')
