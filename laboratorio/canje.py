"""LA CALCULADORA DE CANJE — qué CUESTA cambiar una posición por otra. 13-ago-2026

Jair preguntó si vale la pena vender RIO y comprar PPX. Esa pregunta tiene dos
mitades y este archivo solo hace una.

**LO QUE ESTE ARCHIVO NO HACE, Y NO ES UN DESCUIDO.** No dice si conviene. No
puntúa empresas, no proyecta precios y no emite una recomendación. Un veredicto
de compra no deja de serlo porque lo imprima un script.

**LO QUE SÍ HACE.** Calcula el PEAJE del canje: cuánto se pierde en el camino
antes de que la tesis tenga siquiera oportunidad de funcionar, y cuánto tiene
que moverse cada pata para recuperarlo. Eso es aritmética sobre el libro y sobre
`espejos.json`, no opinión.

LAS TRES CAPAS DEL PEAJE, y la tercera es la que nadie mira:

  1. EL SPREAD. Se vende contra la punta de compra y se compra contra la de
     venta. En RIO eso fue 4.35% el 13-ago; en PPX, 0.63%.

  2. LA PROFUNDIDAD. El precio de pantalla es para la primera acción, no para
     las 2,880. El 13-ago la mejor compra de RIO tenía 941 títulos a las 09:35 y
     2,904 a las 13:09: el mismo libro, cuatro horas después, daba un promedio
     de ejecución distinto.

  3. LA PARIDAD. RIO y PPX no hacen precio en Lima, lo copian de Toronto (corte
     de R8 del 13-ago). Así que en cada momento cada una cotiza con premio o
     descuento contra su propia referencia. **Vender la pata que está barata
     contra Toronto y comprar la que está cara es destruir valor con
     independencia de qué se piense de las empresas.** Al cierre del 13-ago:
     RIO -0.7% (descuento) y PPX +3.5% (premio) → 4.2% de peaje solo por ahí.

Ese 4.2% no aparece en ninguna pantalla y es más grande que casi cualquier
comisión.

EL NÚMERO QUE DEVUELVE es el UMBRAL: cuánto tiene que rendir PPX POR ENCIMA de
RIO para que el canje empate. Debajo de ese umbral el canje pierde aunque se
acierte la dirección de las dos.

    python laboratorio/canje.py
    python laboratorio/canje.py --vender 2.23 --comprar 0.160 0.165
"""
import argparse
import bisect
import io
import json
import statistics as st
import sys

_stdout, sys.stdout = sys.stdout, io.StringIO()
sys.path.insert(0, 'laboratorio')
import cerebro as C  # noqa: E402,F401
sys.stdout = _stdout

PRECIOS = json.load(open('app/src/data/precios.json', encoding='utf-8'))['precios']
ESPEJOS = json.load(open('app/src/data/espejos.json', encoding='utf-8'))['espejos']

# Costo de ida y vuelta en la BVL para un retail: comisión de SAB + BVL + CAVALI
# + contribución SMV + IGV. Es un SUPUESTO y por eso está acá arriba y no
# escondido en una fórmula: la tarifa real está en el contrato de cada uno y
# cambia por SAB. Se declara para que se pueda discutir el número, no para
# fingir precisión.
COSTO_POR_LADO_PCT = 0.35


CASA = {'RIO': 'RIO.TO', 'PPX': 'PPX.V'}


def cotiza(sym):
    """Último precio EN VIVO de Yahoo. Devuelve None si no contesta."""
    import ssl
    import urllib.request
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    url = (f'https://query1.finance.yahoo.com/v8/finance/chart/{sym}'
           f'?range=1d&interval=1d')
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        d = json.load(urllib.request.urlopen(req, timeout=20, context=ctx))
        return float(d['chart']['result'][0]['meta']['regularMarketPrice'])
    except Exception:
        return None


_VISTO = {}


def _cache(sym):
    """Una sola llamada por símbolo: la paridad pide el mismo FX dos veces."""
    if sym not in _VISTO:
        _VISTO[sym] = cotiza(sym)
    return _VISTO[sym]


def desviacion_hoy(tk):
    """Premio (+) o descuento (-) de Lima contra su plaza.

    EN VIVO, y no del archivo. `espejos.json` acumula solo ruedas CERRADAS —
    hoy no entra hasta mañana, por el mismo guardia que tiene fetch_metales. Si
    esta calculadora leyera el archivo, mediría la paridad de hace dos días y
    daría vuelta el signo del peaje: el 11-ago RIO tenía +2.18% de premio y el
    13-ago cerró con -0.7% de descuento. Con el dato viejo, el canje parecía
    favorable cuando no lo era.

    Si Yahoo no contesta, cae al archivo y lo dice, en vez de callarse.
    """
    fx = _cache('CADUSD=X')
    casa = _cache(CASA.get(tk, ''))
    lima = (PRECIOS.get(tk) or {}).get('precio')
    if fx and casa and lima:
        return 'EN VIVO', (lima / (casa * fx) - 1) * 100
    rs = (ESPEJOS.get(tk) or {}).get('ruedas') or {}
    if not rs:
        return None, None
    f = max(rs)
    return f + ' (del archivo: Yahoo no contestó)', rs[f]['desviacion_pct']


def percentil(tk, x):
    """En qué percentil histórico cae esa desviación, solo ruedas negociadas."""
    rs = (ESPEJOS.get(tk) or {}).get('ruedas') or {}
    fs = sorted(rs)
    vivos = [fs[i] for i in range(1, len(fs))
             if abs(rs[fs[i]]['lima_usd'] - rs[fs[i - 1]]['lima_usd']) > 1e-9]
    d = sorted(rs[f]['desviacion_pct'] for f in vivos)
    if not d:
        return None, 0
    return 100 * bisect.bisect_left(d, x) / len(d), len(d)


def linea(tk):
    p = PRECIOS.get(tk) or {}
    f, dv = desviacion_hoy(tk)
    pc, n = percentil(tk, dv) if dv is not None else (None, 0)
    return p, f, dv, pc, n


def main(vender, rango, acciones, costo_pct):
    print('=' * 92)
    print('  CALCULADORA DE CANJE — RIO -> PPX')
    print('=' * 92)
    print('\n  Este archivo NO dice si conviene. Calcula cuánto cuesta y qué')
    print('  tiene que pasar para empatar. El veredicto no es suyo.\n')

    pr, fr, dr, pcr, nr = linea('RIO')
    pp, fp, dp, pcp, npp = linea('PPX')

    # El lado de Lima sale de precios.json, que lo refresca el robot cada 10
    # minutos EN GITHUB. Si la copia local está atrasada, la paridad sale mal y
    # sin ruido: con RIO en 2.2 (dato viejo) el peaje daba +1.34%, y con el
    # cierre real de 2.15 da +4.23%. Tres veces más, y el mismo signo por
    # casualidad. Por eso se avisa la hora del dato en vez de asumirla.
    for tk in ('RIO', 'PPX'):
        u = (PRECIOS.get(tk) or {}).get('ultimaOperacion')
        print(f'  [dato de Lima para {tk}: última operación {u}  ·  si esto no es'
              f' de hoy, corré `git pull`]')

    print('\n  ── DÓNDE ESTÁ CADA PATA CONTRA SU PLAZA DE ORIGEN ' + '─' * 40)
    for tk, p, f, dv, pc, n in (('RIO', pr, fr, dr, pcr, nr), ('PPX', pp, fp, dp, pcp, npp)):
        if dv is None:
            print(f'    {tk:5s} sin dato de paridad')
            continue
        que = 'PREMIO  (Lima cara)' if dv > 0 else 'descuento (Lima barata)'
        print(f'    {tk:5s} último {p.get("precio")}   desviación {dv:+6.2f}%  {que}'
              f'   · percentil {pc:.0f} de {n} ruedas   [al {f}]')

    # EL PEAJE SE MIDE A LOS PRECIOS QUE VAS A OPERAR, NO A LOS DE PANTALLA.
    # La primera versión mezclaba las dos cosas: calculaba la paridad con el
    # último precio y la ejecución con el límite, y devolvía un umbral que no
    # correspondía a ninguna operación real. Con RIO a mercado el peaje da
    # +4.87%; vendiéndola a 2.23 da -3.1%. Ocho puntos de diferencia, y el
    # número equivocado era el que se imprimía.
    imp_r = pr.get('precio') / (1 + dr / 100) if dr is not None else None
    imp_p = pp.get('precio') / (1 + dp / 100) if dp is not None else None
    dv_venta = (vender / imp_r - 1) * 100 if imp_r else None
    peor = max(rango)   # comprar más caro es el caso adverso
    dv_compra = (peor / imp_p - 1) * 100 if imp_p else None

    print(f'\n    implícito de Toronto ahora:  RIO {imp_r:.4f}   PPX {imp_p:.4f}')
    print(f'    A TUS PRECIOS: vendes a {vender:.3f} ({dv_venta:+.2f}% vs Toronto)'
          f'  ·  compras a {peor:.3f} ({dv_compra:+.2f}%)')
    peaje_par = (dv_compra - dv_venta) if (dv_compra is not None and dv_venta is not None) else 0.0
    print(f'    PEAJE DE PARIDAD DE LA OPERACIÓN: {peaje_par:+.2f}%')
    if peaje_par > 0:
        print('    (positivo = en contra tuya: sales de la barata y entras a la cara)')
    else:
        print('    (negativo = a favor tuyo: vendes con premio y compras con descuento)')

    print('\n  ── LA EJECUCIÓN ' + '─' * 74)
    bruto = acciones * vender
    costo_venta = bruto * costo_pct / 100
    neto = bruto - costo_venta
    print(f'    vendes {acciones:,} RIO a {vender:.3f}  ->  US$ {bruto:,.2f}')
    print(f'    menos costos ({costo_pct:.2f}%)          ->  US$ {neto:,.2f}')

    print()
    for compra in rango:
        titulos = int(neto / (compra * (1 + costo_pct / 100)))
        invertido = titulos * compra * (1 + costo_pct / 100)
        print(f'    con eso compras {titulos:,} PPX a {compra:.3f}   (US$ {invertido:,.2f})')

    print('\n  ── EL UMBRAL ' + '─' * 77)
    friccion = 2 * costo_pct + max(0.0, peaje_par)
    print(f'    costos de las dos patas : {2*costo_pct:.2f}%')
    print(f'    peaje de paridad        : {max(0.0, peaje_par):.2f}%')
    print(f'    ' + '-' * 40)
    print(f'    PPX tiene que rendir {friccion:.2f}% MÁS que RIO solo para empatar.')
    print('\n    Debajo de ese umbral el canje pierde aunque aciertes la dirección')
    print('    de las dos acciones. Es el piso, no el objetivo.')

    print('\n  ── LO QUE EL LABORATORIO SÍ TIENE MEDIDO, Y NO ES UN CONSEJO ' + '─' * 29)
    print('    · Las dos son espejos de Toronto: su precio se hace allá (corte R8).')
    print('    · La desviación contra Toronto se muere en menos de una rueda:')
    print('      RIO vida media 0.4 ruedas, PPX 0.3. El premio de hoy no dura.')
    print('    · Beta contra el oro: RIO +1.048 (r=0.276) · PPX +0.677 (r=0.203).')
    print('      PPX es la menos atada al metal de todo el tablero.')
    print('    · Castigados tras EEFF, panel de 61 casos: -6.47% a 15 ruedas y')
    print('      solo 13% recupera. RIO no está en ese panel.')
    print('    · Fechas duras: PPX resultados 27-ago · RIO producción Q3 ~noviembre.')
    print('      La planta de Igor NO tiene fecha desde el 11-may.')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser()
    ap.add_argument('--vender', type=float, default=2.23)
    ap.add_argument('--comprar', type=float, nargs='+', default=[0.160, 0.165])
    ap.add_argument('--acciones', type=int, default=2880)
    ap.add_argument('--costo', type=float, default=COSTO_POR_LADO_PCT)
    a = ap.parse_args()
    main(a.vender, a.comprar, a.acciones, a.costo)
