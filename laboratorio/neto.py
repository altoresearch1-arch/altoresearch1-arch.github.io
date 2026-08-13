"""EL LECTOR QUE COBRA EL PEAJE ANTES DE HABLAR — 10-ago-2026

`direccional.py` dice hacia dónde. No dice si conviene. Hoy le puso 66.2% a RIO
y 65.2% a GDX —casi lo mismo— cuando entrar y salir de uno cuesta 0.81% y del
otro 0.19%. Con esa diferencia, la misma probabilidad es plata en un papel y
pérdida en el otro.

Ese hueco es el modelo del "entrar un día y salir": la estrategia de Jair es
correcta y está medida (R8, 71.8% con metal >=1%), pero de 438 operaciones la
ganancia se concentró en cuatro nombres y RIO no era uno. No falló la señal:
falló la cañería.

QUÉ AGREGA ESTE ARCHIVO
Tres piezas que `direccional.py` no tiene:

1. EL TAMAÑO ESPERADO. No alcanza con "sube": hay que saber cuánto. Se mide,
   dentro de cada acción y por balde, el movimiento medio cuando acierta y
   cuando falla. Una acción que sube 0.3% y baja 3% pierde plata acertando el
   70% de las veces.

2. EL COSTO REAL. Spread medido + comisión. Y va con una advertencia grabada
   hoy: a las 09:16 el libro de RIO daba 10.08% de spread y al cierre 0.81%.
   La foto de la primera hora no es el papel — es la primera hora. Por eso se
   usan spreads DE CIERRE, y por eso hace falta capturarlos a diario.

3. LA ABSTENCIÓN CON PLATA. El lector solo habla si la ganancia esperada supera
   el costo. Callarse cuando no conviene es la mitad del trabajo, y es la mitad
   que ningún modelo anterior de este laboratorio hizo bien.

LO QUE NO ES: no es una recomendación de comprar nada. Es la traducción de una
probabilidad a plata, que es lo único que faltaba para saber si una señal sirve.
"""
import io
import sys

_stdout, sys.stdout = sys.stdout, io.StringIO()
sys.path.insert(0, 'laboratorio')
import direccional as D  # noqa: E402
sys.stdout = _stdout

COMISION = 0.60          # % ida y vuelta

# Spreads AL CIERRE del 10-ago-2026, leídos del libro de Credicorp.
# Un solo día: alcanza para ordenar, no para prometer. Ver docstring.
SPREAD = {
    'MINSURI1': 0.01, 'VOLCABC1': 0.11, 'GDX': 0.19, 'BVN': 0.55,
    'RIO': 0.81, 'NEXAPEC1': 1.10, 'CVERDEC1': 1.11, 'PPX': 1.22,
    'ATACOBC1': 2.79, 'BROCALI1': 21.20,
    # SCCO y PODERC1 no se capturaron hoy; quedan fuera en vez de inventarse.
}


def tamanos(t, hasta):
    """Movimiento medio de la rueda siguiente, separando subidas de bajadas.

    Se mide DENTRO de la acción y solo con datos anteriores al examen. Sin esto
    el modelo asumiría que subir y bajar pesan igual, y en la BVL no es así.
    """
    d = [r for r in D.dias(t, D.MAPA[t]) if r[1] < hasta]
    sub = [r[3] for r in d]
    v = D.C.SERIES[t]
    ups, downs = [], []
    for i, (idx, f, _x, s) in enumerate(d):
        m = D.C.mov(v, idx + 1)
        if m is None:
            continue
        (ups if m > 0 else downs).append(abs(m))
    if len(ups) < 30 or len(downs) < 30:
        return None
    return sum(ups) / len(ups), sum(downs) / len(downs)


def esperado(p, gana, pierde, costo):
    """Ganancia esperada en % después del peaje."""
    return p * gana - (1 - p) * pierde - costo


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print('=' * 96)
    print('  EL LECTOR NETO — la misma probabilidad, traducida a plata')
    print(f'  costo = spread al cierre del 10-ago + {COMISION}% de comisión, ida y vuelta')
    print('=' * 96)

    T = {}
    for t in sorted(D.MAPA):
        if t in D.C.SERIES:
            r = tamanos(t, D.CORTE)
            if r:
                T[t] = r

    print(f'\n  {"acción":10s} {"sube":>7s} {"baja":>7s} {"spread":>8s} {"costo":>7s}'
          f'   {"P que hace falta":>17s}')
    print('  ' + '─' * 74)
    umbrales = {}
    for t in sorted(T):
        g, p_ = T[t]
        sp = SPREAD.get(t)
        if sp is None:
            print(f'  {t:10s} {g:6.2f}% {p_:6.2f}%   sin spread capturado')
            continue
        costo = sp + COMISION
        # p tal que p*g - (1-p)*p_ - costo = 0
        umbral = (p_ + costo) / (g + p_)
        umbrales[t] = (g, p_, costo, umbral)
        print(f'  {t:10s} {g:6.2f}% {p_:6.2f}% {sp:7.2f}% {costo:6.2f}%'
              f'   {100*umbral:16.1f}%')

    print('\n  "P que hace falta" = la probabilidad mínima de subida para no perder plata.')

    print('\n' + '=' * 96)
    print('  LO QUE DIRÍA MAÑANA — con el metal del cierre de hoy')
    print('=' * 96)
    metal_f = {m: sorted(D.MET[m])[-1] for m in D.MET}
    print(f'\n  {"acción":10s} {"metal":7s} {"mov":>7s} {"dice":>7s} {"hace falta":>11s}'
          f' {"esperado":>10s}   veredicto')
    print('  ' + '─' * 84)
    filas = []
    for t in sorted(D.MAPA):
        if t not in D.C.SERIES or t not in umbrales:
            continue
        met = D.MAPA[t]
        f_met = metal_f[met]
        x = D.MET[met][f_met]
        b = D.balde(x)
        lift = D.LIFT.get(b)
        d = D.dias(t, met)
        base = D.base_hasta(d, len(d))
        if base is None or lift is None:
            continue
        n = len(D.VOTOS.get(b, []))
        p = D.sig(D.lodds(base) + (n / (n + D.ENCOGE)) * lift)
        g, p_, costo, umbral = umbrales[t]
        e = esperado(p, g, p_, costo)
        filas.append((e, t, met, x, p, umbral, costo))
    for e, t, met, x, p, umbral, costo in sorted(filas, reverse=True):
        v = 'HABLA' if e > 0 else 'calla'
        print(f'  {t:10s} {met:7s} {x:+6.2f}% {100*p:6.1f}% {100*umbral:10.1f}%'
              f' {e:+9.2f}%   {v}')

    print('\n  "esperado" es la ganancia media por operación después del peaje, no una promesa.')
    print('  Una probabilidad alta con un spread ancho puede dar esperado NEGATIVO: ese es')
    print('  todo el punto de este archivo.')
