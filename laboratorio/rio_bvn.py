"""¿RIO Y BVN SUBEN JUNTOS? Y SI ES ASÍ, ¿ES PROPIO O ES EL ORO? (10-ago-2026)

La observación es de Jair y es buena: RIO y BVN parecen moverse juntos. Acá se
mide, y sobre todo se mide LA SEGUNDA MITAD de la pregunta, que es la que
decide si sirve para algo.

Dos cosas muy distintas pueden producir "suben juntos":
  · que compartan un factor —el oro— y cada una lo siga por su cuenta
  · que tengan algo propio entre ellas, más allá del oro

Solo la segunda sería información nueva. La primera ya la tenés en R8 y usarla
como si fuera un vínculo entre las dos empresas sería contarte el mismo dato
dos veces.

El método es el del §6 del README, el que desarmó el "Factor Plata" de Volcan:
Volcan seguía a la plata con r=+0.65 en crudo, pero descontando la mediana del
sector quedaba en +0.31 y encima seguía al ESTAÑO con +0.55 sin producir
estaño. Eso delataba un factor común, no una exposición propia.

Acá se hace lo mismo: primero la correlación cruda, después la correlación de
los RESIDUOS una vez que se le saca a cada acción lo que el oro explica.

DÍAS SIN DATO: se exigen movimientos reales en LAS DOS acciones el mismo día.
En la BVL un precio repetido no es un día quieto, es un día sin negociar, y
contar esos ceros como coincidencia infla cualquier correlación.
"""
import io
import json
import sys

_stdout, sys.stdout = sys.stdout, io.StringIO()
sys.path.insert(0, 'laboratorio')
import cerebro as C  # noqa: E402
sys.stdout = _stdout

MINERAS = ['RIO', 'BVN', 'GDX', 'SCCO', 'VOLCABC1', 'NEXAPEC1', 'ATACOBC1',
           'CVERDEC1', 'MINSURI1', 'PODERC1', 'PPX', 'BROCALC1']
CONTROL = ['ALICORC1', 'BACKUSI1', 'CREDITC1', 'FERREYC1', 'LUSURC1', 'UNACEMC1']

M = json.load(open('app/src/data/metales_diarios.json', encoding='utf-8'))['metales']
cs = sorted(M['oro']['cierres'].items())
ORO = {f: (c / cs[i - 1][1] - 1) * 100 for i, (f, c) in enumerate(cs) if i > 0}


def movs(t):
    """{fecha: movimiento} solo con días de negociación real."""
    if t not in C.SERIES:
        return {}
    v = C.SERIES[t]
    out = {}
    for i in range(1, len(v)):
        m = C.mov(v, i)
        if m is not None and abs(m) > 1e-9:
            out[v[i][0]] = m
    return out


def corr(xs, ys):
    n = len(xs)
    if n < 30:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sx = sum((x - mx) ** 2 for x in xs) ** 0.5
    sy = sum((y - my) ** 2 for y in ys) ** 0.5
    if not sx or not sy:
        return None
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / (sx * sy)


# ── EL ORO QUE CORRESPONDE ES EL DE AYER, NO EL DE HOY ───────────────────
# Primera versión de este archivo usaba ORO[f], el del MISMO día, y con eso
# "descontar el oro" no descontaba nada (bajaba 0.019). Lógico: el hallazgo
# central del laboratorio es que la BVL cotiza el metal con UN DÍA DE ATRASO
# —GLD contra oro D+0 da +0.021 y contra D−1 da +0.851—. Probar el mismo día
# es probar la alineación en la que R8 no existe.
_FECHAS_ORO = sorted(ORO)


def oro_previo(f):
    """El último cierre del oro ANTERIOR a la rueda f."""
    import bisect
    i = bisect.bisect_left(_FECHAS_ORO, f)
    return ORO[_FECHAS_ORO[i - 1]] if i > 0 else None


def beta_oro(serie):
    """Cuánto de esta acción explica el oro de AYER, que es como manda R8."""
    pares = [(oro_previo(f), m) for f, m in serie.items() if oro_previo(f) is not None]
    if len(pares) < 40:
        return None
    n = len(pares)
    mx = sum(x for x, _ in pares) / n
    my = sum(y for _, y in pares) / n
    var = sum((x - mx) ** 2 for x, _ in pares)
    if not var:
        return None
    return sum((x - mx) * (y - my) for x, y in pares) / var, mx, my


def residuos(t):
    """El movimiento de la acción con lo que el oro explica ya restado."""
    s = movs(t)
    b = beta_oro(s)
    if b is None:
        return {}
    beta, mx, my = b
    return {f: m - (my + beta * (oro_previo(f) - mx))
            for f, m in s.items() if oro_previo(f) is not None}


def par(a, b, fuente):
    sa, sb = fuente(a), fuente(b)
    com = sorted(set(sa) & set(sb))
    if len(com) < 30:
        return None, len(com)
    return corr([sa[f] for f in com], [sb[f] for f in com]), len(com)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print('=' * 88)
    print('  ¿RIO SUBE CON BVN? — y si sube, ¿por ellas o por el oro?')
    print('=' * 88)

    print('\n  ── 1. CRUDO: correlación de RIO con cada una ' + '─' * 34)
    filas = []
    for t in MINERAS + CONTROL:
        if t == 'RIO':
            continue
        r, n = par('RIO', t, movs)
        if r is not None:
            filas.append((r, t, n, t in MINERAS))
    for r, t, n, es_min in sorted(filas, reverse=True):
        print(f'    {t:10s} r = {r:+.3f}   (n={n:3d})  {"minera" if es_min else "CONTROL no-minera"}')

    print('\n  ── 2. RESIDUOS: lo mismo, pero sacándole a cada una lo que el oro explica ' + '─' * 4)
    filas2 = []
    for t in MINERAS + CONTROL:
        if t == 'RIO':
            continue
        r, n = par('RIO', t, residuos)
        if r is not None:
            filas2.append((r, t, n, t in MINERAS))
    for r, t, n, es_min in sorted(filas2, reverse=True):
        print(f'    {t:10s} r = {r:+.3f}   (n={n:3d})  {"minera" if es_min else "CONTROL no-minera"}')

    crudo = dict((t, r) for r, t, _n, _m in filas)
    resid = dict((t, r) for r, t, _n, _m in filas2)
    print('\n  ── 3. EL VEREDICTO SOBRE BVN ' + '─' * 50)
    if 'BVN' in crudo and 'BVN' in resid:
        print(f'    RIO-BVN en crudo    : {crudo["BVN"]:+.3f}')
        print(f'    RIO-BVN sin el oro  : {resid["BVN"]:+.3f}')
        cae = crudo['BVN'] - resid['BVN']
        print(f'    lo que aportaba el oro: {cae:+.3f}')
    print('\n    Referencia: si el residuo con las NO MINERAS queda parecido al de BVN,')
    print('    entonces "suben juntos" no dice nada de BVN — dice que es un día de bolsa.')
