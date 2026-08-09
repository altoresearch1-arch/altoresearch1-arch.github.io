# -*- coding: utf-8 -*-
"""¿EL METAL MUEVE A LA MINERA? La prueba que nunca se pudo correr.

Es el único canal con mecanismo documentado por la propia empresa. El informe
de discusión de gerencia de Volcan (21-jul-2026) lo dice: «el margen bruto
aumentó de 35% a 40% por el incremento en los precios de los metales,
principalmente de la plata». Si el ingreso se mueve con el metal, la pregunta
es si el precio de la acción lo sigue, cuándo y cuánto.

Nunca se pudo medir porque el BCRP publica los metales MENSUALES. Con la serie
diaria de Yahoo (extractor/fetch_metales.py) recién ahora se puede.

DOS PREGUNTAS DISTINTAS, y solo una sirve para operar:

  1. MISMO DÍA — ¿la minera se mueve con su metal ese día? Establece si el
     canal existe. No sirve para decidir nada: los dos precios se hacen a la
     vez.
  2. DÍA SIGUIENTE — ¿el metal de HOY anticipa a la minera de MAÑANA? Ésta sí
     es operable, y es la que responde la pregunta del viernes.

Todo se mide DENTRO de cada acción y con prueba de signo entre acciones: es la
vara que dejó sin efecto a los seis ángulos anteriores.
"""
import json, os, sys, statistics as st
from math import comb

sys.stdout.reconfigure(encoding='utf-8')
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

H = json.load(open(os.path.join(RAIZ, 'app/src/data/historicos.json'), encoding='utf-8'))['historicos']
try:
    M = json.load(open(os.path.join(RAIZ, 'app/src/data/metales_diarios.json'), encoding='utf-8'))['metales']
except FileNotFoundError:
    print('Todavía no existe metales_diarios.json. Corré extractor/fetch_metales.py primero.')
    sys.exit()

# El metal de cada acción. Sale de app/src/lib/cotizacion.js (curado a mano
# contra sus propias minas) más lo que la gerencia de Volcan dijo por escrito:
# su margen lo explica LA PLATA, no el zinc. Sin zinc en la fuente, Nexa y
# Atacocha van con plata, que es su subproducto principal — y queda anotado
# que es un reemplazo, no el metal correcto.
MAPA = {
    'RIO': 'oro', 'BVN': 'oro', 'PODERC1': 'oro', 'PPX': 'oro', 'GDX': 'oro',
    'VOLCABC1': 'plata', 'NEXAPEC1': 'plata', 'ATACOBC1': 'plata',
    'CVERDEC1': 'cobre', 'SCCO': 'cobre', 'BROCALC1': 'cobre',
}

S = {}
for t, h in H.items():
    v = [(f, c) for f, c in (h.get('valores') or []) if c and c > 0]
    if len(v) >= 150 and not h.get('pocoNegociada') and t in MAPA:
        S[t] = v

MET = {}
for nom, d in M.items():
    cs = sorted(d['cierres'].items())
    MET[nom] = {f: ((c / cs[i - 1][1] - 1) * 100) for i, (f, c) in enumerate(cs) if i > 0}

print('DATOS')
for nom, d in M.items():
    cs = sorted(d['cierres'])
    print(f'  {nom:9} {len(cs):4d} cierres   {cs[0]} → {cs[-1]}')
print(f'  acciones con metal asignado y serie usable: {len(S)}')


def spear_simple(pares):
    """Correlación de rangos. Devuelve rho."""
    if len(pares) < 30:
        return None
    def rangos(xs):
        o = sorted(range(len(xs)), key=lambda i: xs[i])
        r = [0.0] * len(xs); i = 0
        while i < len(o):
            j = i
            while j + 1 < len(o) and xs[o[j + 1]] == xs[o[i]]:
                j += 1
            m = (i + j) / 2 + 1
            for k in range(i, j + 1):
                r[o[k]] = m
            i = j + 1
        return r
    a = rangos([p[0] for p in pares]); b = rangos([p[1] for p in pares])
    ma, mb = st.mean(a), st.mean(b)
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    da = sum((x - ma) ** 2 for x in a) ** .5
    db = sum((y - mb) ** 2 for y in b) ** .5
    return num / (da * db) if da and db else None


def correr(desfase, etiqueta):
    """desfase 0 = mismo día · desfase 1 = el metal de ayer contra la acción de hoy."""
    print('\n' + '=' * 76)
    print(f'  {etiqueta}')
    print('=' * 76)
    rhos = []
    print(f'\n  {"acción":10s} {"metal":8s} {"n":>5s} {"rho":>7s}   {"señal grande del metal → mediana de la acción"}')
    print('  ' + '-' * 74)
    for t, v in sorted(S.items()):
        metal = MAPA[t]
        if metal not in MET:
            continue
        pares, sube, baja = [], [], []
        for i in range(1, len(v)):
            fecha = v[i][0]
            rm = MET[metal].get(fecha) if desfase == 0 else MET[metal].get(v[i - desfase][0])
            if rm is None or not v[i - 1][1]:
                continue
            ra = (v[i][1] / v[i - 1][1] - 1) * 100
            pares.append((rm, ra))
            if rm >= 1.0:
                sube.append(ra)
            elif rm <= -1.0:
                baja.append(ra)
        rho = spear_simple(pares)
        if rho is None:
            continue
        rhos.append(rho)
        extra = ''
        if len(sube) >= 10 and len(baja) >= 10:
            extra = (f'metal +1%↑: {st.median(sube):+5.2f}%   '
                     f'metal −1%↓: {st.median(baja):+5.2f}%   (n {len(sube)}/{len(baja)})')
        print(f'  {t:10s} {metal:8s} {len(pares):5d} {rho:+7.3f}   {extra}')
    if len(rhos) >= 6:
        k = sum(1 for r in rhos if r > 0); n = len(rhos)
        p = sum(comb(n, j) * 0.5 ** n for j in range(k, n + 1))
        print(f'\n  rho MEDIANO: {st.median(rhos):+.3f}   ·   '
              f'{k} de {n} acciones con rho positivo   ·   p={p:.5f}')


correr(0, '1. MISMO DÍA — ¿existe el canal? (no sirve para operar)')
correr(1, '2. DÍA SIGUIENTE — el metal de ayer contra la acción de hoy (ésta SÍ opera)')
