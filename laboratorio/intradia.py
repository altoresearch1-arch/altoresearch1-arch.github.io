# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════════════════
🔬 INTRADÍA — ¿el estado de la acción a media rueda dice algo del resto del día?

    python laboratorio/intradia.py             # NEXA contra EPU, barreras ±1%
    python laboratorio/intradia.py BVN 1.5     # otra acción, otras barreras

DE DÓNDE SALE LA HISTORIA, Y POR QUÉ ES EL ADR. La BVL no publica historia
intradía y `intradia.json` nunca guardó una toma: hacia atrás no hay nada. Pero
Nexa cotiza también en NYSE como **NEXA**, y ahí sí existen **24 ruedas de barras
de 5 minutos**. No es el mismo instrumento —otra moneda, otra liquidez, otro
horario— y una señal que aparezca acá NO se transfiere sola a NEXAPEC1. Sirve
para otra cosa, que es la pregunta previa: **¿el método encuentra algo, en la
versión líquida de la misma empresa?** Si acá no hay nada, en la BVL —cinco
veces más ilíquida y con cinco veces más spread— hay menos.

LA PREGUNTA ESTÁ PLANTEADA COMO CAMINO, NO COMO PRECIO. Predecir el cierre es
la forma más frágil de preguntar: un punto contra una distribución que ya
sabemos que se amontona en los extremos. Acá se pregunta lo que un operador
realmente necesita: **desde este instante, ¿toca +X% antes que −X%?** Es una
barrera doble de primer paso, se resuelve sola dentro del día y no depende de
acertar un número.

LAS TRES TRAMPAS QUE ESTE ARCHIVO EVITA A PROPÓSITO
  1. EL MERCADO. Si la bolsa entera sube, sube todo. El estado se mide SIEMPRE
     relativo a un referente (`r_rel = r_acción − r_referente`), porque la
     partición absoluta solo reaprende el movimiento del mercado. Esta era la
     falla del test anterior de este repo y la corrigió una revisión externa.
  2. LA NULA POR DÍAS, NO POR OBSERVACIONES. Las barras de una misma rueda están
     autocorrelacionadas: sortear barras sueltas fabrica un azar mucho más
     estable que el real e infla cualquier percentil. Acá el sorteo toma
     **ruedas enteras** y recién adentro elige.
  3. SIN SOLAPE CON EL FUTURO. Cada barra se evalúa solo contra barras
     POSTERIORES del MISMO día. Nada cruza la noche.
═══════════════════════════════════════════════════════════════════════════════
"""
import sys, random, statistics as st
from collections import defaultdict
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

random.seed(20260807)
BARRERAS = 1.0          # % arriba y abajo
REFERENTE = 'EPU'       # ETF de Perú: el referente natural de una minera peruana
SORTEOS = 2000


def bajar(simbolo, rango='1mo', intervalo='5m'):
    """Barras del ADR. Devuelve {fecha: [(hora, cierre), ...]} en orden."""
    import requests
    s = requests.Session()
    s.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0'})
    r = s.get(f'https://query1.finance.yahoo.com/v8/finance/chart/{simbolo}',
              params={'interval': intervalo, 'range': rango}, timeout=30)
    r.raise_for_status()
    j = r.json()['chart']['result'][0]
    ts, q = j['timestamp'], j['indicators']['quote'][0]
    dias = defaultdict(list)
    for i, t in enumerate(ts):
        c = q['close'][i]
        if c is None:
            continue
        d = datetime.fromtimestamp(t)
        dias[d.strftime('%Y-%m-%d')].append((d.strftime('%H:%M'), c))
    return {f: sorted(v) for f, v in dias.items()}


def primer_paso(precios, i, barrera):
    """Desde la barra i, ¿toca +barrera antes que −barrera, dentro del día?

    Devuelve 1 (arriba primero), 0 (abajo primero) o None (ninguna, cerró el
    día). El None NO se convierte en 0: no tocar ninguna barrera es un desenlace
    distinto de perder, y meterlos en la misma bolsa infla la tasa de acierto."""
    p0 = precios[i]
    arriba, abajo = p0 * (1 + barrera / 100), p0 * (1 - barrera / 100)
    for p in precios[i + 1:]:
        if p >= arriba:
            return 1
        if p <= abajo:
            return 0
    return None


def construir(sim, ref, barrera):
    """Una fila por barra: estado relativo al referente y desenlace del camino."""
    dref = bajar(ref)
    dsim = bajar(sim)
    filas = []
    for f, barras in dsim.items():
        rb = dref.get(f)
        if not rb or len(barras) < 12:
            continue
        precios = [p for _, p in barras]
        apert = precios[0]
        rp = {h: p for h, p in rb}
        apert_ref = rb[0][1]
        for i, (h, p) in enumerate(barras):
            if i < 3 or i > len(barras) - 6:   # ni el arranque ni el final del día
                continue
            pr = rp.get(h)
            if not pr:
                continue
            r_abs = (p / apert - 1) * 100
            r_ref = (pr / apert_ref - 1) * 100
            filas.append({'f': f, 'h': h, 'r_abs': r_abs, 'r_rel': r_abs - r_ref,
                          'y': primer_paso(precios, i, barrera)})
    return filas


def nula(sel, pozo_por_dia, n, veces=SORTEOS):
    """Sorteo de RUEDAS ENTERAS, no de barras sueltas. Cada grupo al azar se
    arma tomando días completos con reemplazo hasta juntar n barras."""
    dias = list(pozo_por_dia)
    real = tasa(sel)
    if real is None:
        return None
    mejores = 0
    for _ in range(veces):
        bolsa = []
        while len(bolsa) < n:
            bolsa.extend(pozo_por_dia[random.choice(dias)])
        t = tasa(bolsa[:n])
        if t is not None and t >= real:
            mejores += 1
    return real, 100 * mejores / veces


def tasa(filas):
    """P(toca arriba antes que abajo), contando SOLO las que resolvieron."""
    r = [x['y'] for x in filas if x['y'] is not None]
    return 100 * sum(r) / len(r) if len(r) >= 10 else None


def main(sim='NEXA', barrera=BARRERAS, ref=REFERENTE):
    filas = construir(sim, ref, barrera)
    dias = sorted({x['f'] for x in filas})
    pozo = defaultdict(list)
    for x in filas:
        pozo[x['f']].append(x)

    resueltas = [x for x in filas if x['y'] is not None]
    print(f'\n🔬 {sim} contra {ref} · barreras ±{barrera}% · barras de 5 min')
    print(f'   {len(filas)} barras · {len(dias)} ruedas ({dias[0]} → {dias[-1]})')
    print(f'   resolvieron dentro del día: {len(resueltas)} ({100*len(resueltas)/len(filas):.0f}%)  '
          f'— el resto cerró sin tocar ninguna barrera\n')

    piso = tasa(filas)
    print(f'   PISO — cualquier barra, cualquier rueda:  toca +{barrera}% antes '
          f'que −{barrera}% el {piso:.0f}% de las veces\n')

    print(f'   {"estado relativo al referente":<32} {"n":>5} {"resuelt":>8} '
          f'{"P(arriba 1º)":>13} {"percentil vs 2000 al azar":>26}')
    CORTES = [('muy fuerte  r_rel >= +1.5%', lambda o: o['r_rel'] >= 1.5),
              ('fuerte      +0.5 a +1.5%',   lambda o: 0.5 <= o['r_rel'] < 1.5),
              ('plano       −0.5 a +0.5%',   lambda o: -0.5 < o['r_rel'] < 0.5),
              ('débil       −1.5 a −0.5%',   lambda o: -1.5 < o['r_rel'] <= -0.5),
              ('muy débil   r_rel <= −1.5%', lambda o: o['r_rel'] <= -1.5)]
    for nom, cond in CORTES:
        sel = [x for x in filas if cond(x)]
        res = [x for x in sel if x['y'] is not None]
        if len(res) < 10:
            print(f'   {nom:<32} {len(sel):>5} {len(res):>8}   — muy pocas resueltas')
            continue
        out = nula(sel, pozo, len(sel))
        if out is None:
            continue
        real, p = out
        pc = 100 - p
        veredicto = 'DISTINTO DEL AZAR' if (pc >= 95 or pc <= 5) else 'indistinguible'
        print(f'   {nom:<32} {len(sel):>5} {len(res):>8} {real:>12.0f}% '
              f'{f"percentil {pc:.0f}":>18}  {veredicto}')

    print(f'\n   Leer así: el percentil compara contra 2000 grupos armados sorteando')
    print(f'   RUEDAS ENTERAS del mismo pozo. Solo por debajo de 5 o por encima de 95')
    print(f'   hay algo que el azar no explique. Con {len(dias)} ruedas, un percentil')
    print(f'   intermedio significa «no se sabe», no «no existe».')
    print(f'\n   Y aunque salga distinto: esto es el ADR en NYSE. NEXAPEC1 en la BVL')
    print(f'   tiene otro spread (0.47%–2.86% según tamaño, medido hoy) y otra')
    print(f'   liquidez. Nada de acá se opera allá sin volver a medirlo.')


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('-')]
    main(a[0] if a else 'NEXA',
         float(a[1]) if len(a) > 1 else BARRERAS,
         a[2] if len(a) > 2 else REFERENTE)
