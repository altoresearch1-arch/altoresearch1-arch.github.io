"""¿EL TAMAÑO DEL METAL ANTICIPA EL TAMAÑO DEL MOVIMIENTO? (9-ago-2026)

R8 está probado en DIRECCIÓN: el metal sube el día D, la minera sube el D+1,
71.8% de las veces con metal ≥1%. El cerebro no pregunta eso. Pregunta
MAGNITUD: ¿se va a mover |≥2%| en las próximas 5 ruedas, para dónde sea?

Son primos, no la misma cosa, y confundirlos es exactamente el error que el §6
del archivo dice que ya se cometió dos veces: dar por probada una regla en un
terreno donde no se midió. Así que se mide acá, aparte, antes de tocar el
cerebro.

Hipótesis: los días en que el metal se movió fuerte, la minera entra a una
semana más movida.

CÓMO SE MIDE, y cada decisión es una piedra de tropiezo anterior:

· DENTRO DE CADA ACCIÓN (regla 1). Comparar el pool entero contestaría "¿en qué
  acción estás parado?", que es lo que mató ocho reglas del cementerio: SCCO se
  mueve más que Cerro Verde con metal quieto o agitado.

· EN LOG-ODDS (regla 4), y la mediana entre acciones, no la media: con 11
  acciones una sola con celda flaca arrastra la media.

· PRUEBA DE SIGNOS. Cuántas acciones dan el efecto en la misma dirección
  importa más que el tamaño promedio — es lo que distingue un efecto del sector
  de tres acciones tirando del número.

· ENTRENA vs EXAMEN. El corte es 2026-01-01, el mismo del cerebro, así que si
  esto entra después no le regala nada al examen que ya está escrito.

· CONTROL. Las no-mineras reciben el oro asignado a la fuerza. Si el efecto
  también aparece ahí, no es el metal: es que los días agitados del mundo son
  agitados para todos, y eso el cerebro ya lo tiene en la variable `clima`.
  Ese control es el que decide si esto agrega algo o repite lo que ya sabe.
"""
import io
import json
import sys
from math import log

# cerebro imprime al importarse (repara la serie); se silencia sin tocarlo.
_stdout, sys.stdout = sys.stdout, io.StringIO()
sys.path.insert(0, 'laboratorio')
import cerebro as C  # noqa: E402
sys.stdout = _stdout

CORTE = '2026-01-01'
METAL_FUERTE = 1.0      # el mismo corte con el que R8 da 71.8%
MIN_CELDA = 20          # por acción y por celda; debajo de eso no se opina

# El mismo mapa de `metal_manda.py`. Nexa y Atacocha van con plata (su
# subproducto principal) porque el zinc no se consigue — ver §4 del archivo.
MAPA = {
    'RIO': 'oro', 'BVN': 'oro', 'PODERC1': 'oro', 'PPX': 'oro', 'GDX': 'oro',
    'VOLCABC1': 'plata', 'NEXAPEC1': 'plata', 'ATACOBC1': 'plata',
    'CVERDEC1': 'cobre', 'SCCO': 'cobre', 'BROCALC1': 'cobre',
}

M = json.load(open('app/src/data/metales_diarios.json', encoding='utf-8'))['metales']
MET = {}
for nom, d in M.items():
    cs = sorted(d['cierres'].items())
    MET[nom] = {f: (c / cs[i - 1][1] - 1) * 100 for i, (f, c) in enumerate(cs) if i > 0}


def lodds(k, n):
    p = max(1e-6, min(1 - 1e-6, k / n))
    return log(p / (1 - p))


def binom_p(k, n):
    """Prueba de signos de dos colas: ¿k de n del mismo lado es raro con p=0.5?"""
    if n == 0:
        return 1.0
    from math import comb
    k = max(k, n - k)
    cola = sum(comb(n, j) for j in range(k, n + 1)) / 2 ** n
    return min(1.0, 2 * cola)


def celdas(t, metal, desde, hasta):
    """(altos, bajos) para una acción: [aciertos, casos] con el metal fuerte y quieto.

    El día i se lee con el movimiento del metal de ESE día y se apuesta al
    |retorno| de las 5 ruedas siguientes — la misma ventana que `adelante()`
    del cerebro. El metal cierra después que Lima, así que la lectura se hace
    de noche para la rueda siguiente: es la forma en que R8 ya está medido.
    """
    v = C.SERIES[t]
    alto, bajo = [0, 0], [0, 0]
    for i in range(len(v)):
        f_dia = v[i][0]
        if not (desde <= f_dia < hasta):
            continue
        x = MET.get(metal, {}).get(f_dia)
        if x is None:
            continue
        m = C.mov(v, i)
        if m is None or abs(m) < 1e-9:   # precio repetido = día sin dato
            continue
        f = C.adelante(v, i)
        if f is None:
            continue
        d = alto if abs(x) >= METAL_FUERTE else bajo
        d[1] += 1
        d[0] += abs(f) >= C.UMBRAL
    return alto, bajo


def tramo(nombre, mapa, desde, hasta):
    print(f'\n  ── {nombre} ' + '─' * (66 - len(nombre)))
    filas, lifts = [], []
    for t in sorted(mapa):
        if t not in C.SERIES:
            continue
        alto, bajo = celdas(t, mapa[t], desde, hasta)
        if alto[1] < MIN_CELDA or bajo[1] < MIN_CELDA:
            continue
        lift = lodds(*alto) - lodds(*bajo)
        lifts.append(lift)
        filas.append((t, mapa[t], alto, bajo, lift))
    if not filas:
        print('    sin acciones con las dos celdas llenas — no se puede medir')
        return None
    print(f'    {"acción":10s} {"metal":7s} {"metal fuerte":>16s} {"metal quieto":>16s} {"lift":>8s}')
    for t, met, a, b, lift in filas:
        print(f'    {t:10s} {met:7s} {100*a[0]/a[1]:9.1f}% (n={a[1]:3d}) '
              f'{100*b[0]/b[1]:9.1f}% (n={b[1]:3d}) {lift:+8.3f}')
    import statistics as st
    k = sum(1 for x in lifts if x > 0)
    n = len(lifts)
    p = binom_p(k, n)
    print(f'\n    mediana del lift (log-odds): {st.median(lifts):+.3f}')
    print(f'    acciones con el efecto a favor: {k} de {n}   ·   prueba de signos p={p:.4f}')
    return st.median(lifts), k, n, p


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print('=' * 84)
    print('  ¿EL |MOVIMIENTO DEL METAL| ANTICIPA UNA SEMANA MOVIDA?')
    print(f'  objetivo: |retorno de 5 ruedas| >= {C.UMBRAL}%   ·   metal fuerte = |mov| >= {METAL_FUERTE}%')
    print('=' * 84)

    tramo('MINERAS · entrenamiento (hasta 2026-01-01)', MAPA, '0000', CORTE)
    tramo('MINERAS · EXAMEN (2026 en adelante)', MAPA, CORTE, '9999')

    # El control: las que no tocan metal, con el oro puesto a la fuerza.
    control = {t: 'oro' for t in C.SERIES if t not in MAPA}
    tramo('CONTROL · no-mineras con oro asignado · EXAMEN', control, CORTE, '9999')
