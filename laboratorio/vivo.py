# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════════════════
📡 EN VIVO — qué está pasando AHORA, y qué de eso está medido.

    python laboratorio/vivo.py              # el mercado: quién se mueve
    python laboratorio/vivo.py NEXAPEC1     # una acción, a fondo

POR QUÉ EXISTE. El resto del laboratorio corre sobre CIERRES OFICIALES, que la
BVL publica con un día de atraso. Eso es correcto para medir —y es la razón de
que `motor.series_frescas()` ya no empalme dos fuentes— pero deja al laboratorio
mirando siempre ayer. Esto es la otra mitad: la rueda de hoy, mientras pasa.

LA REGLA QUE LO SOSTIENE: TODO LO VIVO SALE DE UN SOLO ENDPOINT. Precio, previo,
variación, rango del día y punta vienen los cinco de `/stock-quote/market`, y se
comparan solo entre ellos. Lo que viene de la serie oficial —el movimiento
típico, el momento de los últimos días, el sector— se imprime en su propio
bloque, con la fecha de su último cierre al lado. Nunca se restan números de los
dos lados: medido el 7-ago-2026 sobre la misma fecha y 44 acciones, las dos
fuentes difieren en 43 casos, mediana 0.92% y máximo 13.45%.

LO QUE ESTO NO ES. No hay ningún modelo intradía en este repo, y no lo va a
haber por ahora: el horizonte más corto que se midió es 1 rueda y todo lo que
sobrevivió al examen está a 10–15. Así que esto DESCRIBE —dónde está el precio
dentro del día, cuánto es ese movimiento en días típicos, cuánto cuesta entrar
ahora mismo— y no pronostica el cierre de hoy. Cualquier número sobre «a cuánto
llega hoy» saldría de la nada.

LO QUE SÍ ADELANTA. La única regla que aguantó el examen necesita momento de
varios días —«cayó −5% en 3 ruedas, sin EEFF»—. Acá se muestra el momento hasta
el último cierre oficial Y lo que va del día, por separado y etiquetados, para
ver quién se está ACERCANDO a una situación medida. Acercarse no es estar: la
tasa base se midió sobre cierres, no sobre precios de las 12:40.
═══════════════════════════════════════════════════════════════════════════════
"""
import sys, statistics as st
from datetime import datetime, timedelta

from motor import (cargar, series_negociadas, series_frescas, fechas_eeff,
                   pct, COSTO, SPREAD, HORIZ)
from eventos import familia, por_familia, HORIZONTES
from ohlc import vivo as guardar_puntas

sys.stdout.reconfigure(encoding='utf-8')

LINEA = '─' * 78


def snapshot():
    """La foto del mercado, ahora. Devuelve {ticker: fila cruda del endpoint}.

    El payload CAMBIA CON LA HORA: con el mercado cerrado solo trae `previous`;
    en rueda agrega `last`, `buy`, `sell`, `opening`, `minimun`, `maximun`. Por
    eso cada lector de acá abajo comprueba el campo antes de usarlo en vez de
    asumir que está."""
    import requests
    s = requests.Session()
    s.headers.update({
        'User-Agent': ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                       'Chrome/120.0 Safari/537.36'),
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.bvl.com.pe',
        'Referer': 'https://www.bvl.com.pe/mercado/movimientos-diarios',
    })
    r = s.post('https://dataondemand.bvl.com.pe/v1/stock-quote/market',
               data='{}', timeout=40)
    r.raise_for_status()
    nem = {}
    for e in cargar('empresas.json')['empresas']:
        if e.get('ticker'):
            nem[e.get('bvlNemonico') or e['ticker']] = e['ticker']
    out = {}
    for row in r.json().get('content', []):
        t = nem.get(row.get('nemonico'))
        if t and row.get('last') is not None:
            out[t] = row
    return out


def contexto_oficial(series):
    """Lo que trae la serie de cierres: movimiento típico y momento de los
    últimos días. Va SIEMPRE etiquetado con la fecha de su último cierre —es de
    otra medición y de otro día, y confundirlo con lo vivo es el error que este
    módulo existe para no repetir."""
    ctx = {}
    for t, vals in series.items():
        if len(vals) < 25:
            continue
        p = [x for _, x in vals]
        rets = [pct(p[k], p[k - 1]) for k in range(len(p) - 20, len(p))]
        ctx[t] = {
            'fecha': vals[-1][0], 'cierre': p[-1],
            'tipico': st.pstdev(rets) or 0.01,
            'mom3': pct(p[-1], p[-4]) if len(p) > 3 else None,
            'mom5': pct(p[-1], p[-6]) if len(p) > 5 else None,
        }
    return ctx


def hora_lima(iso):
    """`lastDate` viene en UTC y sin zona; `createdDate`, en el mismo payload,
    viene en hora de Lima. Restar 5 no es cosmético: sin esto la ficha decía que
    la última operación fue a las 17:53 con el mercado cerrado desde las 15:00."""
    if not iso or 'T' not in iso:
        return ''
    try:
        return (datetime.fromisoformat(iso.replace('Z', '')) - timedelta(hours=5)).strftime('%H:%M')
    except ValueError:
        return ''


def spread_de(row):
    b, a = row.get('buy'), row.get('sell')
    if not b or not a or b <= 0 or a <= 0 or a < b:
        return None, None, None
    return b, a, (a - b) / ((a + b) / 2) * 100


def hechos_de_hoy(fecha):
    """Quién publicó algo HOY. Es lo único del bloque de catalizadores que se
    puede saber en vivo: hechos.json lo refresca el robot cada 10 minutos."""
    out = {}
    for t, ficha in cargar('hechos.json')['hechos'].items():
        hs = [h for h in ficha.get('hechos', []) if h.get('fecha') == fecha]
        if hs:
            fams = {familia(h) for h in hs}
            # si publicó un EEFF y tres «otros» el mismo día, manda el EEFF:
            # es el que tiene tasa base propia y es negativa.
            fam = next((f for f in ('EEFF trimestral', 'EEFF anual') if f in fams),
                       sorted(fams)[0])
            out[t] = {'n': len(hs), 'fam': fam}
    return out


def barra(row, ancho=22):
    """Dónde está el precio dentro del rango del día. Un rango es un hecho del
    endpoint; que el precio esté arriba o abajo del rango NO está medido contra
    nada — se dibuja porque orienta, no porque prediga."""
    lo, hi, c = row.get('minimun'), row.get('maximun'), row.get('last')
    if not lo or not hi or hi <= lo or c is None:
        return None
    i = round((c - lo) / (hi - lo) * (ancho - 1))
    return f'{lo:.3f} [' + '·' * i + '●' + '·' * (ancho - 1 - i) + f'] {hi:.3f}'


def linea_mercado(fecha_hoy, foto):
    vs = [r.get('percentageChange') or 0 for r in foto.values()]
    return st.median(vs) if vs else 0.0


def main(ticker=None):
    foto = snapshot()
    if not foto:
        print('⏸  El endpoint no devuelve `last` ahora mismo: el mercado está')
        print('   cerrado. Esto se corre EN RUEDA (9:00–15:00 hora de Lima).')
        return

    series = series_negociadas()
    ctx = contexto_oficial(series)
    fecha_hoy = max((r.get('lastDate') or '')[:10] for r in foto.values())
    hechos = hechos_de_hoy(fecha_hoy)
    mkt = linea_mercado(fecha_hoy, foto)
    empresas = {e['ticker']: e for e in cargar('empresas.json')['empresas']
                if e.get('ticker')}

    print(f'\n╔{"═"*76}╗')
    print(f'║ 📡 EN VIVO · rueda {fecha_hoy} · {len(foto)} acciones con operaciones'
          f'{"":>16}║')
    print(f'╚{"═"*76}╝')
    print(f'   la bolsa hoy: mediana {mkt:+.2f}%')
    print(f'   ⓘ  todo lo de esta pantalla sale del endpoint de mercado. El contexto')
    print(f'      de días previos viene de los cierres oficiales y va marcado aparte.')

    if ticker:
        ficha_viva(ticker, foto, ctx, hechos, mkt, empresas)
    else:
        tablero(foto, ctx, hechos, mkt, empresas)

    # Mirar y acumular es la misma corrida: la punta de este instante no existe
    # en ningún archivo y mañana ya no se puede reconstruir.
    print(f'\n{LINEA}')
    guardar_puntas()


def ficha_viva(ticker, foto, ctx, hechos, mkt, empresas):
    row = foto.get(ticker)
    if not row:
        print(f'\n   {ticker}: no registra operaciones en esta rueda.')
        return
    c = row['last']
    var = row.get('percentageChange') or 0
    emp = empresas.get(ticker, {})
    sector = emp.get('sector', '—')

    print(f'\n{LINEA}')
    print(f'{emp.get("nombre", ticker)[:52]}   ·   {ticker}\n')
    print(f'   precio ahora      S/{c:<10.3f} {var:+.2f}% en el día')
    h = hora_lima(row.get('lastDate'))
    quieta = ''
    if h:
        mudo = (datetime.now() - datetime.now().replace(
            hour=int(h[:2]), minute=int(h[3:]), second=0, microsecond=0))
        if mudo.total_seconds() > 900:
            quieta = f'   ⚠ sin operar hace {int(mudo.total_seconds()//60)} min'
    print(f'   última operación  {h} (Lima)   ·   '
          f'{row.get("operationsNumber", "?")} operaciones   ·   '
          f'S/{(row.get("negotiatedAmount") or 0):,.0f}{quieta}')
    mo, ca = row.get('negotiatedAmount') or 0, float(row.get('negotiatedQuantity') or 0)
    if ca:
        print(f'   VWAP del día      S/{mo/ca:.4f}   (monto ÷ cantidad — '
              f'el endpoint ya traía los dos y nadie lo calculaba)')
    b = barra(row)
    if b:
        print(f'   rango del día     {b}')
        print(f'                     abrió en {row.get("opening")}')

    bid, ask, sp = spread_de(row)
    if sp is not None:
        neto = 2.25 - COSTO - sp
        print(f'\n   punta ahora       bid {bid:.3f} / ask {ask:.3f}   '
              f'spread {sp:.2f}% ida y vuelta')
        print(f'                     el motor supone {SPREAD:.2f}%; sobre el rebote '
              f'medido de +2.25% quedan {neto:+.2f}% netos')
    else:
        print(f'\n   punta ahora       el endpoint no la devuelve en este instante')

    o = ctx.get(ticker)
    if o:
        dias = abs(var) / o['tipico'] if o['tipico'] else 0
        print(f'\n   ── contexto, de los CIERRES OFICIALES (último: {o["fecha"]}) ──')
        print(f'   movimiento típico     ±{o["tipico"]:.2f}%/día  →  hoy va '
              f'{dias:.1f}× un día normal')
        if o['mom3'] is not None:
            print(f'   momento a 3 ruedas    {o["mom3"]:+.2f}%   '
                  f'(hasta el cierre del {o["fecha"]}, sin lo de hoy)')
        if o['mom5'] is not None:
            print(f'   momento a 5 ruedas    {o["mom5"]:+.2f}%')
        print(f'   contra la bolsa hoy   {var - mkt:+.2f} pp')
        mism = [r.get('percentageChange') or 0 for t, r in foto.items()
                if empresas.get(t, {}).get('sector') == sector]
        if len(mism) >= 3:
            print(f'   contra su sector hoy  {var - st.median(mism):+.2f} pp   '
                  f'({sector}: {st.median(mism):+.2f}%, n={len(mism)})')

    h = hechos.get(ticker)
    if h:
        base = por_familia().get(h['fam'])
        print(f'\n   ── publicó HOY ──')
        print(f'   {h["n"]} hecho(s)  ·  familia: {h["fam"]}')
        if base:
            print(f'   tasa base (n={base["n"]} episodios de toda la BVL):')
            for k in HORIZONTES:
                d = base['horizontes'][k]
                print(f'      {k:>2}r  mediana {d["mediana"]:+5.2f}%  '
                      f'verde {d["gana"]:.0f}%')
            print(f'   Esa tasa se midió sobre CIERRES y a {HORIZONTES[-1]} ruedas. '
                  f'No dice nada del cierre de hoy.')
    else:
        print(f'\n   sin Hechos de Importancia publicados hoy.')

    print(f'\n   ⚖️  Lo que esta pantalla NO tiene: un modelo intradía. No existe en')
    print(f'      el repo y no se puede improvisar. Para la dirección a {HORIZ} ruedas,')
    print(f'      la ficha completa:  python laboratorio/ficha.py {ticker}')


def tablero(foto, ctx, hechos, mkt, empresas):
    filas = []
    for t, row in foto.items():
        var = row.get('percentageChange')
        if var is None:
            continue
        o = ctx.get(t)
        _, _, sp = spread_de(row)
        filas.append({'t': t, 'var': var, 'sp': sp,
                      'dias': abs(var) / o['tipico'] if o and o['tipico'] else None,
                      'mom3': o['mom3'] if o else None,
                      'hecho': hechos.get(t)})
    filas.sort(key=lambda x: -abs(x['var']))

    print(f'\n{LINEA}')
    print('LOS QUE SE MUEVEN HOY   ·   ordenado por tamaño del movimiento\n')
    print(f'   {"ticker":<10} {"hoy":>7} {"días típ":>9} {"3r previo":>10} '
          f'{"spread":>7}   hecho de hoy')
    for f in filas[:15]:
        dias = f'{f["dias"]:.1f}×' if f['dias'] is not None else '—'
        m3 = f'{f["mom3"]:+.2f}%' if f['mom3'] is not None else '—'
        sp = f'{f["sp"]:.2f}%' if f['sp'] is not None else '—'
        hec = f['hecho']['fam'] if f['hecho'] else ''
        print(f'   {f["t"]:<10} {f["var"]:>+6.2f}% {dias:>9} {m3:>10} {sp:>7}   {hec}')

    # La única regla que aguantó entrena/examen. Se muestra quién ESTÁ (por
    # cierres) y quién se ACERCA (sumándole lo de hoy), separado, porque la tasa
    # base se midió sobre cierres y un precio de las 12:40 no es un cierre.
    eeff = fechas_eeff()
    print(f'\n{LINEA}')
    print('CERCA DE LA ÚNICA REGLA QUE AGUANTÓ EL EXAMEN')
    print('   «cayó −5% en 3 ruedas, sin EEFF» → +1.47% neto a 10r, 64% (n=143)\n')
    hay = False
    for f in sorted(filas, key=lambda x: (x['mom3'] if x['mom3'] is not None else 99)):
        if f['mom3'] is None or f['mom3'] > 0:
            continue
        proy = f['mom3'] + f['var']
        if min(f['mom3'], proy) > -3:
            continue
        hay = True
        marca = '⚠ EEFF reciente' if eeff.get(f['t']) and any(
            d >= ctx[f['t']]['fecha'] for d in eeff[f['t']][-3:]) else ''
        print(f'   {f["t"]:<10} cierres {f["mom3"]:+6.2f}%  ·  hoy {f["var"]:+6.2f}%  '
              f'·  sumado {proy:+6.2f}%   {marca}')
    if not hay:
        print('   nadie. Es el resultado más común y no hay que forzarlo.')
    print('\n   «sumado» NO es la señal: mezcla tres cierres oficiales con un precio')
    print('   de media rueda. Sirve para ver quién se acerca, no para disparar.')


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    main(args[0] if args else None)
