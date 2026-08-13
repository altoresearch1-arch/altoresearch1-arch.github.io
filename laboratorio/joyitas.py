"""LAS JOYITAS DE LA PLOMERÍA — 10-ago-2026, 09:33 en rueda.

El laboratorio nunca tuvo esto: las DOS PUNTAS de decenas de papeles al mismo
tiempo. `precios.json` guarda el cierre, y el §1.4 tuvo que medir el spread a
mano sobre seis nombres un solo día. Acá hay ~50 con punta compradora y
vendedora vivas, leídas de la pantalla de Credicorp durante la rueda.

QUÉ ES UNA JOYITA, Y NO ES "LA QUE VA A SUBIR"
El §1.4 dice que la plomería pesa más que cualquier señal, y el lector
direccional lo confirmó por el lado feo: R8 le pega el 75% de las veces a RIO y
RIO igual no aparece entre las que dejaron plata. Una joyita es un papel donde
un acierto SE PUEDE COBRAR:
  1. spread angosto — el costo de entrar y salir
  2. profundidad en LAS DOS puntas — que haya con quién, en los dos sentidos
  3. que además cargue una señal medida (R8), si se puede

El spread se mide contra el PUNTO MEDIO, no contra el último: el último queda
pegado a una de las dos puntas según de qué lado entró la orden.

CUIDADO CON LA MONEDA: los papeles locales cotizan en S/ y los que terminan en
US o son ADR, en US$. Por eso el ranking es por SPREAD, que no tiene unidades,
y la profundidad se informa al lado sin mezclarse en el orden.

UNA SOLA FOTO. Esto es un instante, no una distribución. El §1.4 ya se comió
ese error una vez: midió el spread de RIO en 0.81% el 7-ago y hoy el mismo
papel está en 10.08%. Sirve para descartar, no para prometer.
"""
import sys

# instrumento: (compra, venta, cant_compra, cant_venta, moneda)
LIBRO = {
    # ── página 1 ──
    'AENZAC1':  (0.408, 0.410, 24500, 39500, 'S/'),
    'ALICORC1': (12.750, 13.000, 1278, 815, 'S/'),
    'ATACOBC1': (0.353, 0.363, 8000, 5328, 'S/'),
    'AUNA':     (5.210, 5.250, 939, 1000, 'US$'),
    'BACKUSI1': (26.020, 26.200, 150, 1513, 'S/'),
    'BAMC1':    (2.280, 2.360, 10000, 10000, 'S/'),
    'BAP':      (384.100, 386.310, 12, 458, 'US$'),
    'BBVAC1':   (2.200, 2.210, 5322, 10000, 'S/'),
    'BROCALI1': (16.000, 16.500, 2700, 250, 'S/'),
    # ── página 2 ──
    'BVN':      (34.200, 34.500, 1515, 8, 'US$'),
    'CASAGRC1': (9.000, 9.100, 216, 500, 'S/'),
    'CORAREI1': (1.600, 1.620, 4161, 1830, 'S/'),
    'CPACASC1': (8.010, 8.130, 3962, 2000, 'S/'),
    'CREDITC1': (7.170, 7.190, 207, 1500, 'S/'),
    'CVERDEC1': (68.740, 69.820, 37, 192, 'US$'),
    'ENGIEC1':  (4.600, 4.650, 10171, 600, 'S/'),
    'ETFPERUD': (25.510, 25.540, 3, 4504, 'US$'),
    'ETFPESOV': (113.000, 113.200, 35, 1949, 'S/'),
    # ── página 3 ──
    'FERREYC1': (4.320, 4.330, 483, 2878, 'S/'),
    'FIBPRIME': (6.940, 6.950, 14, 4, 'S/'),
    'GDXUS':    (89.190, 89.360, 1000, 1000, 'US$'),
    'GOAUUS':   (44.350, 44.580, 2500, 2500, 'US$'),
    'HBMUS':    (27.010, 27.770, 1000, 1000, 'US$'),
    'HIDRA2C1': (1.220, 1.270, 3643, 4969, 'S/'),
    'HODLUS':   (18.280, 18.330, 2000, 2000, 'US$'),
    'IFS':      (58.100, 59.990, 9, 555, 'US$'),
    'INRETC1':  (37.000, 37.400, 6, 62, 'S/'),
    'INTERBC1': (2.030, 2.100, 150, 3912, 'S/'),
    # ── del Libro de Propuestas (09:16) ──
    'RIO':      (2.260, 2.500, 6570, 773, 'US$'),
    'NEXAPEC1': (4.290, 4.300, 2638, 5771, 'S/'),
    'VOLCABC1': (0.873, 0.883, 41000, 33455, 'S/'),
    'MINSURI1': (7.380, 7.390, 335, 2030, 'S/'),
    'SIDERC1':  (2.701, 2.800, 684, 5000, 'S/'),
    'PML':      (1.200, 1.235, 4946, 40000, 'US$'),
    'PPX':      (0.155, 0.160, 8760, 21320, 'S/'),
}

# El mapa de R8 (metal_manda.py). Fuera de esta lista, el metal no dice nada.
R8 = {
    'RIO': 'oro', 'BVN': 'oro', 'PODERC1': 'oro', 'PPX': 'oro', 'GDXUS': 'oro',
    'VOLCABC1': 'plata', 'NEXAPEC1': 'plata', 'ATACOBC1': 'plata',
    'CVERDEC1': 'cobre', 'SCCO': 'cobre', 'BROCALI1': 'cobre',
}

# Lo que el examen del lector direccional dejó por acción (ganancia de Brier).
# MINSURI1 no entrenó y aun así fue de las mejores: por eso figura.
LECTOR = {'RIO', 'BVN', 'GDXUS', 'PPX', 'VOLCABC1', 'NEXAPEC1', 'ATACOBC1',
          'CVERDEC1', 'BROCALI1', 'MINSURI1'}

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    filas = []
    for t, (c, v, qc, qv, mon) in LIBRO.items():
        if not c or not v or v < c:
            continue
        medio = (c + v) / 2
        spread = 100 * (v - c) / medio
        # el lado flaco manda: no podés operar más de lo que hay del otro lado
        fondo = min(qc * c, qv * v)
        filas.append((spread, t, c, v, fondo, mon, min(qc, qv)))
    filas.sort()

    print('=' * 96)
    print('  JOYITAS DE PLOMERÍA — spread real en rueda, 10-ago-2026 ~09:33')
    print('  "fondo" = el lado FLACO del libro: no se puede operar más que eso, ni entrando ni saliendo')
    print('=' * 96)
    print(f'\n  {"":2s} {"papel":10s} {"compra":>9s} {"venta":>9s} {"spread":>8s} {"fondo (lado flaco)":>22s}  señal')
    for i, (sp, t, c, v, fondo, mon, qmin) in enumerate(filas, 1):
        marca = '★' if (sp < 1.0 and t in LECTOR) else (' ' if sp < 1.0 else ' ')
        sen = ''
        if t in R8:
            sen = f'R8 {R8[t]}'
            if t in LECTOR:
                sen += ' + lector'
        elif t in LECTOR:
            sen = 'lector (fuera del mapa R8)'
        print(f'  {marca:2s} {t:10s} {c:9.3f} {v:9.3f} {sp:7.2f}% {mon:>4s} {fondo:12,.0f} ({qmin:,} tít.)  {sen}')

    print('\n  ── El cruce que importa: spread < 1% Y señal medida ' + '─' * 30)
    joyas = [f for f in filas if f[0] < 1.0 and f[1] in LECTOR]
    if not joyas:
        print('    ninguna')
    for sp, t, c, v, fondo, mon, qmin in joyas:
        print(f'    {t:10s} spread {sp:.2f}%   fondo {mon} {fondo:,.0f}   metal: {R8.get(t, "—")}')

    print('\n  ── Los que cargan señal pero la plomería se la come ' + '─' * 30)
    for sp, t, c, v, fondo, mon, qmin in filas:
        if t in LECTOR and sp >= 1.0:
            print(f'    {t:10s} spread {sp:6.2f}%   metal: {R8.get(t, "—")}')
