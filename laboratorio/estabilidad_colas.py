# -*- coding: utf-8 -*-
"""P1 — ¿La tabla de capacidad de explosion tiene MEMORIA?

Se construye el ranking con 2025 y se pregunta si sirve para 2026. Spearman
sobre rangos, con el p por PERMUTACION (10,000 barajadas) para no depender de
scipy: el cron ya se salta turnos y una dependencia mas es un punto de rotura
mas (Regla de la casa #2).

LA VUELTA DE TUERCA QUE FALTABA EN LA PREGUNTA. La probabilidad de explosion
correlaciona 0.85 con la volatilidad anual, y la volatilidad es notoriamente
persistente. Entonces un rho alto en la cola NO prueba nada nuevo: probaria que
la volatilidad persiste, que ya se sabe. La pregunta que de verdad importa es
si persiste la ASIMETRIA — quien explota hacia arriba y quien hacia abajo —
DESPUES de sacarle lo que la volatilidad ya explica. Eso es lo unico que la
volatilidad no dice, y es lo unico que seria nuevo.
"""
import json, sys, random, statistics as st
sys.stdout.reconfigure(encoding='utf-8')
random.seed(20260807)

RUTA = 'app/src/data/historicos.json'
H = json.load(open(RUTA, encoding='utf-8'))['historicos']
E = json.load(open('app/src/data/empresas.json', encoding='utf-8'))['empresas']
NOM = {e['ticker']: (e.get('nombre') or '')[:20] for e in E}

S, VOL = {}, {}
for t, h in H.items():
    v = [(f, c) for f, c in (h.get('valores') or []) if c and c > 0]
    if len(v) >= 120 and not h.get('pocoNegociada'):
        S[t], VOL[t] = v, h.get('volatilidadAnualPct')


def vol_anual(t, anio):
    """Volatilidad DE ESE AÑO, calculada de la serie.

    `volatilidadAnualPct` del archivo es UN solo número por acción, de todo el
    periodo. Usarlo como control era correlacionar una variable consigo misma
    y daba rho = 1.000 — un control que no controla nada. Hay que recalcularla
    año por año para que el piso de comparación sea real.
    """
    v = S[t]
    rs = []
    for i in range(1, len(v)):
        if v[i][0][:4] != anio:
            continue
        if v[i - 1][1] > 0:
            rs.append((v[i][1] / v[i - 1][1] - 1) * 100)
    if len(rs) < 60:
        return None
    return st.pstdev(rs) * (252 ** 0.5)

def colas(t, anio, k=10, u=10):
    """prob de +u% y de -u% en k ruedas, dentro de ese año."""
    v = S[t]
    ups, dns, n = 0, 0, 0
    for i in range(len(v) - k - 1):
        if v[i][0][:4] != anio:
            continue
        x = (v[i + k][1] / v[i][1] - 1) * 100
        n += 1
        if x >= u: ups += 1
        if x <= -u: dns += 1
    if n < 60:          # menos de 60 ventanas en el año: no se mide
        return None
    return 100 * ups / n, 100 * dns / n, n

def rangos(xs):
    orden = sorted(range(len(xs)), key=lambda i: xs[i])
    r = [0.0] * len(xs)
    i = 0
    while i < len(orden):            # promedio en los empates
        j = i
        while j + 1 < len(orden) and xs[orden[j + 1]] == xs[orden[i]]:
            j += 1
        med = (i + j) / 2 + 1
        for k in range(i, j + 1):
            r[orden[k]] = med
        i = j + 1
    return r

def pearson(a, b):
    ma, mb = st.mean(a), st.mean(b)
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    da = sum((x - ma) ** 2 for x in a) ** 0.5
    db = sum((y - mb) ** 2 for y in b) ** 0.5
    return num / (da * db) if da and db else 0.0

def spearman(a, b, barajadas=10000):
    ra, rb = rangos(a), rangos(b)
    rho = pearson(ra, rb)
    peores = 0
    rb2 = list(rb)
    for _ in range(barajadas):
        random.shuffle(rb2)
        if abs(pearson(ra, rb2)) >= abs(rho):
            peores += 1
    return rho, peores / barajadas

# ── armar la tabla de los dos años ────────────────────────────────────────
filas = []
for t in S:
    a, b = colas(t, '2025'), colas(t, '2026')
    v25, v26 = vol_anual(t, '2025'), vol_anual(t, '2026')
    if a and b and v25 and v26:
        filas.append({'t': t, 'up25': a[0], 'dn25': a[1], 'up26': b[0], 'dn26': b[1],
                      'asim25': a[0] - a[1], 'asim26': b[0] - b[1],
                      'vol25': v25, 'vol26': v26, 'vol': v25})

print('=' * 88)
print(f'  P1 — MEMORIA DE LA COLA.  {len(filas)} acciones con ambos años medibles')
print('=' * 88)

def prueba(et, k1, k2):
    a = [f[k1] for f in filas]
    b = [f[k2] for f in filas]
    rho, p = spearman(a, b)
    marca = 'TIENE MEMORIA' if (rho > 0.3 and p < 0.05) else ('debil' if p < 0.05 else 'ES RUIDO')
    print(f'  {et:46s} rho = {rho:+.3f}   p = {p:.4f}   -> {marca}')
    return rho, p

print()
prueba('volatilidad 2025 -> volatilidad 2026 (control)', 'vol25', 'vol26')
print('     ^ este es el piso: si la cola no le gana a esto, no aporta nada.\n')
prueba('prob. de SUBIR 10%  2025 -> 2026', 'up25', 'up26')
prueba('prob. de BAJAR 10%  2025 -> 2026', 'dn25', 'dn26')
prueba('ASIMETRIA (sube - baja)  2025 -> 2026', 'asim25', 'asim26')

# ── lo que la volatilidad NO explica ──────────────────────────────────────
print('\n' + '=' * 88)
print('  LA PRUEBA DURA: la asimetria DESPUES de sacarle la volatilidad')
print('=' * 88)
vol = [f['vol'] for f in filas]
for anio in ('25', '26'):
    a = [f['asim' + anio] for f in filas]
    print(f'    asimetria 20{anio} vs volatilidad: r = {pearson(a, vol):+.3f}')

def residuo(clave):
    """Lo que queda de la asimetria despues de la recta contra la volatilidad."""
    y = [f[clave] for f in filas]
    mv, my = st.mean(vol), st.mean(y)
    sxx = sum((x - mv) ** 2 for x in vol)
    b1 = sum((x - mv) * (t - my) for x, t in zip(vol, y)) / sxx if sxx else 0
    b0 = my - b1 * mv
    return [t - (b0 + b1 * x) for x, t in zip(vol, y)]

r25, r26 = residuo('asim25'), residuo('asim26')
rho, p = spearman(r25, r26)
print(f'\n    RESIDUO de asimetria 2025 -> 2026:   rho = {rho:+.3f}   p = {p:.4f}')
print('    (si esto es ruido, la tabla entera es volatilidad con otro nombre)')

# ── quien se sostuvo y quien se dio vuelta ────────────────────────────────
print('\n' + '=' * 88)
print('  LAS QUE MAS SE MOVIERON DE UN AÑO A OTRO')
print('=' * 88)
filas.sort(key=lambda f: -abs(f['asim26'] - f['asim25']))
print(f'\n  {"accion":11s} {"empresa":20s} {"asim 2025":>10s} {"asim 2026":>10s} {"cambio":>9s}')
print('  ' + '-' * 64)
for f in filas[:8]:
    print(f'  {f["t"]:11s} {NOM.get(f["t"], ""):20s} {f["asim25"]:+9.1f}% {f["asim26"]:+9.1f}% '
          f'{f["asim26"]-f["asim25"]:+8.1f}%')
print('\n  Las mas estables:')
for f in filas[-5:]:
    print(f'  {f["t"]:11s} {NOM.get(f["t"], ""):20s} {f["asim25"]:+9.1f}% {f["asim26"]:+9.1f}% '
          f'{f["asim26"]-f["asim25"]:+8.1f}%')
