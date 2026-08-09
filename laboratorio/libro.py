# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════════════════
📕 EL LIBRO — cuánto cuesta de verdad entrar y salir, según el tamaño.

    python laboratorio/libro.py NEXAPEC1 "500@4.28,4599@4.25,1000@4.21,9273@4.20" \
                                          "6815@4.30,8985@4.33,400@4.35,746@4.37"
    python laboratorio/libro.py --estado

EL SUPUESTO MÁS FRÁGIL DEL LABORATORIO, Y AHORA TIENE FORMA. `motor.SPREAD` es
una constante de 1.00% ida y vuelta. Medido el 7-ago-2026 contra el libro real
de Nexa (Credicorp DMA, 13:03), la constante es correcta solo por casualidad y
solo en un tamaño:

    500 acciones  → 0.47%      2,000 → 0.99%      15,000 → 2.26%

El endpoint público de la BVL da la punta —bid 4.28 / ask 4.30, 0.47%— y esa
cifra es cierta para las 500 acciones que había detrás. La punta compradora
tenía 500 y la vendedora 6,815: 13.6 a 1. Quien mire solo la punta cree que
puede salir a 4.28 y en realidad, pasando de 500 acciones, sale a 4.25.

QUÉ SIGNIFICA PARA LA ÚNICA REGLA QUE AGUANTÓ. El rebote de «−5% en 3 ruedas
sin EEFF» da **+3.07% bruto** a 10 ruedas (n=143, examen). Neto de 0.6% de
comisión y del spread REAL:

    a S/8,600   → +1.48%   la ventaja existe
    a S/64,000  → +0.21%   la ventaja se evaporó por tamaño, no por estar mal

O sea: la pregunta «¿conviene?» no tiene una respuesta sola. Tiene una por cada
monto, y el punto donde se cruza a cero es el dato que faltaba.

POR QUÉ SE ANOTA A MANO Y NO SE RASPA. La profundidad no la publica la BVL:
sale de la pantalla de la SAB. Automatizarla obligaría a abrir el puerto de
depuración de Chrome, que no autentica a nadie y deja la sesión de e-trading
manejable por cualquier proceso local. No hace falta: el libro solo importa las
3 o 4 veces al año que vas a mover algo, y copiarlo son diez segundos. Lo caro
no es capturarlo, es no haberlo guardado nunca.
═══════════════════════════════════════════════════════════════════════════════
"""
import sys

from ohlc import abrir, guardar
from motor import COSTO

sys.stdout.reconfigure(encoding='utf-8')

# Bruto de la regla que sobrevivió entrena y examen (motor.py, tramo EXAMEN).
# Es BRUTO a propósito: acá abajo se le resta el costo real, no el supuesto.
BRUTO_REBOTE = 3.07


def parsear(txt):
    """'500@4.28,4599@4.25' → [(500, 4.28), (4599, 4.25)]. El orden es el de la
    pantalla: el primer nivel es la punta."""
    niveles = []
    for parte in txt.replace(' ', '').split(','):
        if not parte:
            continue
        q, p = parte.split('@')
        niveles.append((int(float(q)), float(p)))
    return niveles


def barrer(niveles, cantidad):
    """Precio medio de ejecutar `cantidad` contra el libro. None si el libro no
    alcanza — y eso también es información: significa que ese tamaño no cabe."""
    resta, costo = cantidad, 0.0
    for q, p in niveles:
        t = min(resta, q)
        costo += t * p
        resta -= t
        if resta <= 0:
            return costo / cantidad
    return None


def informe(ticker, compra, venta, fecha):
    top_bid, top_ask = compra[0][1], venta[0][1]
    medio = (top_bid + top_ask) / 2
    print(f'\n📕 {ticker} · libro del {fecha}')
    print(f'   punta   bid {top_bid:.3f} ({compra[0][0]:,} acc)  /  '
          f'ask {top_ask:.3f} ({venta[0][0]:,} acc)')
    print(f'   spread de punta {100*(top_ask-top_bid)/medio:.2f}%  —  '
          f'cierto solo para {min(compra[0][0], venta[0][0]):,} acciones')
    desb = venta[0][0] / compra[0][0] if compra[0][0] else 0
    print(f'   desbalance {desb:.1f} a 1 hacia la {"VENTA" if desb > 1 else "COMPRA"}'
          f'   (un desbalance NO está medido contra nada en este repo)')

    print(f'\n   {"tamaño":>8} {"S/":>10} {"compras a":>10} {"vendes a":>10} '
          f'{"ida+vuelta":>11} {"c/comisión":>11} {"rebote neto":>12}')
    hondo = sum(q for q, _ in compra)
    for n in (500, 1000, 2000, 5000, 10000, 15000, 25000):
        b, s = barrer(venta, n), barrer(compra, n)
        if b is None or s is None:
            print(f'   {n:>8,} — el libro visible no alcanza para este tamaño')
            continue
        spread = 100 * (1 - s / b)
        neto = BRUTO_REBOTE - COSTO - spread
        marca = '  ← se muere' if neto <= 0 else ''
        print(f'   {n:>8,} {n*medio:>10,.0f} {b:>10.4f} {s:>10.4f} '
              f'{-spread:>10.2f}% {-(spread+COSTO):>10.2f}% {neto:>11.2f}%{marca}')
    print(f'\n   El «rebote neto» es el +{BRUTO_REBOTE:.2f}% bruto de «cayó −5% en 3 '
          f'ruedas sin EEFF»\n   (n=143, examen) menos {COSTO}% de comisión y menos el '
          f'spread REAL de cada fila.\n   No es un pronóstico: es la tasa base de esa '
          f'regla, ya descontado lo que cuesta.')
    print(f'\n   Profundidad visible del lado comprador: {hondo:,} acciones '
          f'(S/{sum(q*p for q, p in compra):,.0f}).')
    print('   Más allá de eso no hay dato: la pantalla solo muestra los primeros niveles.')


def anotar(ticker, compra, venta, fecha=None):
    libro = abrir()
    if fecha is None:
        propias = [v['fecha'] for v in libro['ruedas'].values() if v['ticker'] == ticker]
        fecha = max(propias) if propias else None
    if fecha is None:
        print(f'{ticker}: no hay ninguna vela guardada. Corre primero '
              f'`python laboratorio/ohlc.py`.')
        return None
    clave = f'{ticker}|{fecha}'
    v = libro['ruedas'].get(clave) or {'ticker': ticker, 'fecha': fecha}
    v['libro'] = {'compra': [[q, p] for q, p in compra],
                  'venta': [[q, p] for q, p in venta],
                  'fuente': 'pantalla SAB (profundidad no publicada por la BVL)'}
    libro['ruedas'][clave] = v
    guardar(libro)
    return fecha


def estado():
    libro = abrir()
    con = [v for v in libro['ruedas'].values() if v.get('libro')]
    if not con:
        print('Ningún libro anotado todavía.')
        return
    print(f'📕 {len(con)} libros anotados:\n')
    for v in sorted(con, key=lambda x: (x['ticker'], x['fecha'])):
        c, s = v['libro']['compra'], v['libro']['venta']
        medio = (c[0][1] + s[0][1]) / 2
        print(f'   {v["ticker"]:<10} {v["fecha"]}  punta {c[0][1]:.3f}/{s[0][1]:.3f} '
              f'({100*(s[0][1]-c[0][1])/medio:.2f}%)  '
              f'compra {c[0][0]:,} vs venta {s[0][0]:,} en la punta')


if __name__ == '__main__':
    if '--estado' in sys.argv:
        estado()
    elif len(sys.argv) >= 4:
        tk, compra, venta = sys.argv[1], parsear(sys.argv[2]), parsear(sys.argv[3])
        f = sys.argv[4] if len(sys.argv) > 4 else None
        f = anotar(tk, compra, venta, f)
        if f:
            informe(tk, compra, venta, f)
            print(f'\n✅ guardado en ohlc_acumulado.json bajo {tk}|{f}')
    else:
        print(__doc__)
