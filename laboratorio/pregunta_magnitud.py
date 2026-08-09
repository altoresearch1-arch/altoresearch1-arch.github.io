# -*- coding: utf-8 -*-
"""CAMBIAR LA PREGUNTA.

Todo lo que fallo predecia DIRECCION. Todo lo que sobrevivio describia
MAGNITUD. Asi que se cambia el objetivo:

   antes:  ¿sube o baja?                      -> 52-56%, nunca mas
   ahora:  ¿se va a mover mas de lo que       -> ¿cuanto?
           cuesta entrar y salir?

Por que podria funcionar donde lo otro no: la volatilidad se agrupa (los dias
movidos vienen juntos), y eso es un hecho mucho mas robusto que cualquier
patron direccional. Si algo se puede anticipar en estos datos, es esto.

OBJETIVO: |retorno de 5 ruedas| >= UMBRAL. Se prueban dos umbrales:
   2%  ~ el costo de ida y vuelta medido en la BVL (0.70-1.13%) con margen
   5%  ~ un movimiento que de verdad justifica la operacion

METODO: condiciones fijadas de antemano, entrenamiento 2025, prueba 2026,
universo completo de 46 acciones. Nada de elegir el corte despues.
"""
import json, sys, statistics as st
from math import comb
sys.stdout.reconfigure(encoding='utf-8')

H = json.load(open('app/src/data/historicos.json', encoding='utf-8'))['historicos']
S = {}
for t, h in H.items():
    v = [(f, c) for f, c in (h.get('valores') or []) if c and c > 0]
    if len(v) >= 120 and not h.get('pocoNegociada'):
        S[t] = v

def r(t, i): return None if i <= 0 else (S[t][i][1] / S[t][i - 1][1] - 1) * 100
def fw(t, i, n):
    v = S[t]
    return None if i + n >= len(v) else (v[i + n][1] / v[i][1] - 1) * 100
def vol_v(t, i, k):
    if i - k < 1: return None
    rs = [r(t, j) for j in range(i - k + 1, i + 1)]
    rs = [x for x in rs if x is not None]
    return st.pstdev(rs) if len(rs) >= k // 2 else None
def pval(k, n, p):
    """Binomial exacta si el n lo permite; normal con correccion de
    continuidad cuando el factorial se desborda (n grande)."""
    if n <= 900:
        return sum(comb(n, j) * p**j * (1 - p)**(n - j) for j in range(k, n + 1))
    from math import erfc, sqrt
    z = (k - 0.5 - n * p) / sqrt(n * p * (1 - p))
    return 0.5 * erfc(z / sqrt(2))

# ── LAS CONDICIONES, todas escritas antes de correr nada ──────────────────
def c_caida58(t, i):
    x = r(t, i)
    return x is not None and -8 <= x < -5
def c_explosion(t, i):
    x = r(t, i)
    return x is not None and abs(x) >= 10
def c_agitada(t, i):
    c, l = vol_v(t, i, 10), vol_v(t, i, 60)
    return c is not None and l and (c / l) >= 1.5
def c_quieta(t, i):
    c, l = vol_v(t, i, 10), vol_v(t, i, 60)
    return c is not None and l and (c / l) <= 0.7
def c_movio3(t, i):
    x = r(t, i)
    return x is not None and abs(x) >= 3
def c_dos_seguidos(t, i):
    a, b = r(t, i), r(t, i - 1) if i > 1 else None
    return a is not None and b is not None and abs(a) >= 3 and abs(b) >= 3

COND = [('cualquier rueda (BASE)', None),
        ('se movio 3% o mas hoy', c_movio3),
        ('dos ruedas seguidas de 3%+', c_dos_seguidos),
        ('cayo entre 5% y 8%', c_caida58),
        ('exploto (10%+ en un dia)', c_explosion),
        ('vol de 10r >= 1.5x la de 60r', c_agitada),
        ('vol de 10r <= 0.7x la de 60r', c_quieta)]

def medir(cond, anio, umbral, n=5):
    ok = tot = 0
    tams = []
    for t in S:
        for i in range(len(S[t])):
            if S[t][i][0][:4] != anio: continue
            if cond and not cond(t, i): continue
            f = fw(t, i, n)
            if f is None: continue
            tot += 1
            tams.append(abs(f))
            if abs(f) >= umbral: ok += 1
    return (ok, tot, st.median(tams) if tams else None)

for umbral in (2.0, 5.0):
    print('=' * 92)
    print(f'  ¿SE MUEVE MAS DE {umbral:.0f}% EN 5 RUEDAS?  (en cualquier direccion)')
    print('=' * 92)
    b25 = medir(None, '2025', umbral)
    b26 = medir(None, '2026', umbral)
    print(f'\n  BASE: 2025 {100*b25[0]/b25[1]:.0f}% (n={b25[1]})   '
          f'2026 {100*b26[0]/b26[1]:.0f}% (n={b26[1]})\n')
    print(f'  {"condicion":32s} {"2025":>16s} {"2026 (prueba)":>22s} {"|mov| mediano":>14s}')
    print('  ' + '-' * 88)
    for et, fn in COND:
        if fn is None: continue
        a = medir(fn, '2025', umbral)
        c = medir(fn, '2026', umbral)
        if a[1] < 15 or c[1] < 15:
            print(f'  {et:32s}  muestra chica (n={a[1]}, {c[1]})')
            continue
        p = pval(c[0], c[1], b26[0] / b26[1])
        print(f'  {et:32s} {100*a[0]/a[1]:6.0f}% (n={a[1]:4d}) '
              f'{100*c[0]/c[1]:9.0f}% (n={c[1]:4d}) p={p:.4f} {c[2]:9.2f}%')
    print()
