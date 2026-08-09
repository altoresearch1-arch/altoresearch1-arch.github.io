# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════════════════
🪙 SENSIBILIDAD A METALES — ¿de verdad la acción sigue al metal?

Es el único de los «módulos fundamentales» propuestos que los datos de ALTO
pueden contestar hoy, porque el metal tiene serie y el resto no.

EL LÍMITE MANDA SOBRE EL RESULTADO, así que va primero: `cotizaciones.json` trae
el promedio MENSUAL del BCRP. Con ~19 meses de precios de acciones, la muestra
son ~18 pares. Con n=18, una correlación tiene que ser enorme para significar
algo: por eso acá no se imprime un r a secas nunca. Cada r va contra una PRUEBA
DE PERMUTACIÓN —se barajan los meses 2,000 veces— que dice qué |r| alcanza una
serie sin ninguna relación. Si el real no le gana a esa nube, el veredicto es
«no se distingue del azar», por bonito que se vea el número.

POR QUÉ IGUAL VALE LA PENA. La afirmación «la plata es 47.3% de las ventas, así
que la acción sigue a la plata» tiene dos mitades: la primera es contable y sale
del informe; la segunda es del mercado y se puede medir. Que la plata sea la
mitad de las ventas no obliga a la acción a moverse con la plata — el mercado
puede estar mirando otra cosa. Esto separa esas dos mitades.
═══════════════════════════════════════════════════════════════════════════════
"""
import sys, random, statistics as st
from collections import defaultdict

from motor import cargar, series_negociadas

sys.stdout.reconfigure(encoding='utf-8')

METALES = ['plata', 'zinc', 'cobre', 'oro', 'plomo', 'estano']
SEMILLA = 20260806
MINIMO = 12          # menos de 12 meses en común: no se calcula, se dice


def _mensual_metales():
    prod = cargar('cotizaciones.json')['productos']
    out = {}
    for m in METALES:
        serie = prod.get(m, {}).get('mensual') or []
        out[m] = {f: v for f, v in serie}
    return out


def _mensual_acciones(series):
    """Último cierre de cada mes. Un mes con menos de 5 ruedas no cuenta:
    sería un cierre suelto disfrazado de mes."""
    out = {}
    for t, vals in series.items():
        por_mes = defaultdict(list)
        for f, p in vals:
            if p:
                por_mes[f[:7]].append((f, p))
        cierres = {m: max(v)[1] for m, v in por_mes.items() if len(v) >= 5}
        out[t] = cierres
    return out


def _correlacion(xs, ys):
    if len(xs) < 3:
        return 0.0
    mx, my = st.mean(xs), st.mean(ys)
    num = sum((a - mx) * (b - my) for a, b in zip(xs, ys))
    dx = sum((a - mx) ** 2 for a in xs) ** 0.5
    dy = sum((b - my) ** 2 for b in ys) ** 0.5
    return num / (dx * dy) if dx and dy else 0.0


def _prueba_permutacion(xs, ys, barajadas=2000):
    """¿Qué |r| alcanza una serie SIN relación, con esta misma cantidad de
    meses? Devuelve el percentil del r real dentro de esa nube."""
    real = abs(_correlacion(xs, ys))
    rnd = random.Random(SEMILLA)
    ys2 = list(ys)
    nube = []
    for _ in range(barajadas):
        rnd.shuffle(ys2)
        nube.append(abs(_correlacion(xs, ys2)))
    nube.sort()
    pct = 100 * sum(1 for x in nube if x < real) / len(nube)
    return {'r': _correlacion(xs, ys), 'abs_r': real, 'pct': pct,
            'azar_p95': nube[int(len(nube) * .95)], 'n': len(xs)}


def sensibilidad(ticker, series=None, metales=None, acciones=None):
    series = series or series_negociadas()
    metales = metales or _mensual_metales()
    acciones = acciones or _mensual_acciones(series)
    cierres = acciones.get(ticker) or {}
    meses = sorted(cierres)
    out = {}
    for m in METALES:
        serie = metales.get(m) or {}
        xs, ys = [], []
        for a, b in zip(meses, meses[1:]):
            if a in serie and b in serie and serie[a]:
                xs.append((serie[b] / serie[a] - 1) * 100)
                ys.append((cierres[b] / cierres[a] - 1) * 100)
        if len(xs) >= MINIMO:
            out[m] = _prueba_permutacion(xs, ys)
    return out


def informe(tickers=None):
    series = series_negociadas()
    metales = _mensual_metales()
    acciones = _mensual_acciones(series)

    fichas = {e['ticker']: e for e in cargar('empresas.json')['empresas'] if e.get('ticker')}
    if tickers is None:
        tickers = [t for t in series if fichas.get(t, {}).get('sector') == 'minas']

    print('🪙 SENSIBILIDAD A METALES — variación mensual de la acción contra la del metal')
    print(f'   fuente del metal: BCRP, promedio MENSUAL. Muestra por par: ~18 meses.')
    print(f'   nada se imprime con menos de {MINIMO} meses en común.\n')
    print(f'   {"acción":<11} ' + ' '.join(f'{m:>9}' for m in METALES) + '    lo que aguanta la permutación')
    for t in sorted(tickers):
        s = sensibilidad(t, series, metales, acciones)
        if not s:
            continue
        fila = f'   {t:<11} '
        vivos = []
        for m in METALES:
            d = s.get(m)
            if not d:
                fila += f'{"—":>9} '
                continue
            marca = '*' if d['pct'] >= 95 else ' '
            fila += f'{d["r"]:>+8.2f}{marca} '
            if d['pct'] >= 95:
                vivos.append(f'{m} (r={d["r"]:+.2f}, p{d["pct"]:.0f})')
        print(fila + '   ' + (', '.join(vivos) if vivos else 'ninguna'))

    ej = next((t for t in tickers if sensibilidad(t, series, metales, acciones)), None)
    if ej:
        d = sensibilidad(ej, series, metales, acciones)['plata']
        print(f'\n   Cómo leerlo: con n={d["n"]} meses, una serie SIN ninguna relación llega')
        print(f'   a |r|={d["azar_p95"]:.2f} el 5% de las veces solo por azar. Un r por debajo')
        print(f'   de eso no dice nada, aunque el signo sea el que uno esperaba. El * marca')
        print(f'   los que le ganan al 95% de las permutaciones.')
    print('\n   Y una correlación mensual no es una señal de 2 semanas: aunque salga *,')
    print('   no se puede operar con ella. Dice con qué se mueve la acción, no cuándo.')

    # ── ¿exposición propia, o todas las mineras se mueven juntas? ────────
    # El estaño sale significativo en acciones que no producen estaño: eso
    # delata un factor común (el humor por la minería) disfrazado de metal.
    # Se le resta a cada acción el movimiento de la mediana de SU sector; lo
    # que sobrevive a eso sí es exposición propia.
    print('\n' + '─' * 78)
    print('   MISMO CÁLCULO, PERO DESCONTANDO EL MOVIMIENTO DEL SECTOR')
    print('   (a cada mes se le resta la mediana de las mineras: queda lo PROPIO)\n')
    meses_com = sorted(set.intersection(*[set(acciones[t]) for t in tickers if acciones.get(t)]))
    varsec = {}
    for a, b in zip(meses_com, meses_com[1:]):
        vs = [(acciones[t][b] / acciones[t][a] - 1) * 100 for t in tickers
              if a in acciones.get(t, {}) and b in acciones.get(t, {})]
        if vs:
            varsec[b] = st.median(vs)

    print(f'   {"acción":<11} ' + ' '.join(f'{m:>9}' for m in METALES) + '    sobrevive')
    for t in sorted(tickers):
        cierres = acciones.get(t) or {}
        meses = sorted(cierres)
        fila, vivos = f'   {t:<11} ', []
        for m in METALES:
            serie = metales.get(m) or {}
            xs, ys = [], []
            for a, b in zip(meses, meses[1:]):
                if a in serie and b in serie and serie[a] and b in varsec:
                    xs.append((serie[b] / serie[a] - 1) * 100)
                    ys.append((cierres[b] / cierres[a] - 1) * 100 - varsec[b])
            if len(xs) < MINIMO:
                fila += f'{"—":>9} '
                continue
            d = _prueba_permutacion(xs, ys)
            marca = '*' if d['pct'] >= 95 else ' '
            fila += f'{d["r"]:>+8.2f}{marca} '
            if d['pct'] >= 95:
                vivos.append(m)
        print(fila + '   ' + (', '.join(vivos) if vivos else 'nada propio'))
    print('\n   «nada propio» no significa que la empresa sea inmune al metal: significa')
    print('   que se mueve con sus pares, y que apostar al metal es apostar al sector')
    print('   entero, no a esta acción.')


if __name__ == '__main__':
    informe([sys.argv[1]] if len(sys.argv) > 1 else None)
