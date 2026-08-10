"""¿EL IPC DE EE.UU. MUEVE EL METAL? (10-ago-2026)

La idea de manual dice que sí: el oro no paga interés, así que cuando el dato
de inflación corre la expectativa de tasas, el oro se mueve. Es un mecanismo
correcto y muy citado — y por eso mismo entra acá antes de que nadie lo use.
El §6 del archivo dice que una explicación buena no es una medición.

LA PREGUNTA, que es de MAGNITUD y no de dirección:
¿el |movimiento| del metal es más grande los días de publicación del IPC que un
día cualquiera? La dirección NO se puede preguntar con estos datos: para eso
haría falta la SORPRESA (dato contra lo esperado), y el consenso no lo tenemos.
Un IPC que sale exactamente como se esperaba no mueve nada aunque sea alto.

LAS FECHAS SON REALES, NO INFERIDAS.
Salen del calendario oficial del BLS (bls.gov/schedule), incluidos los dos
huecos raros de 2025: el IPC de septiembre salió el 24-oct y en noviembre no
hubo publicación. Inventar «el IPC sale a mitad de mes» habría metido dos
fechas falsas justo en el tramo más movido del oro.

LA PRUEBA ES DE PERMUTACIÓN, como en `metal_manda.py` y `similares.py`.
Con 23 días de IPC contra ~480 días normales, comparar dos promedios no dice
nada: cualquier grupo de 23 días agarrado al azar tiene su propia suerte. Así
que se sortean 5,000 grupos del mismo tamaño y se mira en qué percentil cae el
grupo real. Si el IPC no fuera especial, caería cerca del 50.

TAMBIÉN SE MIDE EL DÍA SIGUIENTE, y no es un capricho: R8 lee el metal del día
D para operar la minera en D+1. Si el IPC agranda el movimiento del metal el
miércoles, lo que cambia es la lectura del jueves.
"""
import io
import json
import statistics as st
import sys
import random

_stdout, sys.stdout = sys.stdout, io.StringIO()
sys.path.insert(0, 'laboratorio')
import cerebro as C  # noqa: E402  (solo para no duplicar la carga; no se usa su panel)
sys.stdout = _stdout

SORTEOS = 5000
SEMILLA = 20260810      # fijo, para que la corrida se pueda repetir igual

# ── CALENDARIO OFICIAL DEL BLS ───────────────────────────────────────────
# bls.gov/schedule/news_release/cpi.htm + /schedule/2025/home.htm + /2024/
# Todas 08:30 ET. Los futuros del metal operan durante la publicación, así que
# el cierre de ESE día ya la contiene.
IPC = [
    # 2024
    '2024-08-14', '2024-09-11', '2024-10-10', '2024-11-13', '2024-12-11',
    # 2025 — ojo: el de septiembre salió el 24-oct y en noviembre NO hubo
    '2025-01-15', '2025-02-12', '2025-03-12', '2025-04-10', '2025-05-13',
    '2025-06-11', '2025-07-15', '2025-08-12', '2025-09-11', '2025-10-24',
    '2025-12-18',
    # 2026
    '2026-01-13', '2026-02-13', '2026-03-11', '2026-04-10', '2026-05-12',
    '2026-06-10', '2026-07-14',
    # '2026-08-12' es el de esta semana: todavía no ocurrió
]

M = json.load(open('app/src/data/metales_diarios.json', encoding='utf-8'))['metales']


def serie(nom):
    """[(fecha, variacion %)] del metal, en orden."""
    cs = sorted(M[nom]['cierres'].items())
    return [(f, (c / cs[i - 1][1] - 1) * 100) for i, (f, c) in enumerate(cs) if i > 0]


def percentil(real, sorteos):
    return 100 * sum(1 for x in sorteos if x < real) / len(sorteos)


def medir(nom, corrimiento, etiqueta):
    """corrimiento 0 = el día del IPC · 1 = la rueda siguiente."""
    s = serie(nom)
    idx = {f: i for i, (f, _v) in enumerate(s)}
    marcadas = set()
    for f in IPC:
        i = idx.get(f)
        if i is None:                    # el metal no operó ese día
            continue
        j = i + corrimiento
        if 0 <= j < len(s):
            marcadas.add(j)
    if len(marcadas) < 10:
        print(f'    {nom:8s} {etiqueta:16s} solo {len(marcadas)} fechas cruzadas — no se mide')
        return

    tam = [abs(v) for _f, v in s]
    dentro = [tam[j] for j in marcadas]
    fuera = [tam[j] for j in range(len(tam)) if j not in marcadas]

    rng = random.Random(SEMILLA)
    n = len(dentro)
    nulos = []
    for _ in range(SORTEOS):
        nulos.append(st.mean(rng.sample(tam, n)))
    p = percentil(st.mean(dentro), nulos)

    print(f'    {nom:8s} {etiqueta:16s} n={n:3d}   |mov| medio {st.mean(dentro):.3f}%'
          f'  vs {st.mean(fuera):.3f}% el resto   ·   mediana {st.median(dentro):.3f}'
          f'  ·  percentil {p:5.1f}')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print('=' * 92)
    print('  ¿EL IPC DE EE.UU. AGRANDA EL MOVIMIENTO DEL METAL?')
    print(f'  {len(IPC)} publicaciones del BLS ya ocurridas · {SORTEOS} sorteos por prueba')
    print('=' * 92)
    print('\n  El percentil dice dónde cae el grupo real entre grupos del mismo tamaño')
    print('  sacados al azar. Sin efecto -> cerca de 50. Con efecto -> arriba de 95.\n')

    for corr, et in ((0, 'DIA DEL IPC'), (1, 'la rueda D+1')):
        print(f'  ── {et} ' + '─' * (74 - len(et)))
        for nom in ('oro', 'plata', 'cobre', 'platino'):
            if nom in M:
                medir(nom, corr, et)
        print()
