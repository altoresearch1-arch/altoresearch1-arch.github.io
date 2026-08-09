# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════════════════
🧠 MEMORIA DE MERCADO — «¿cuándo estuvo esta acción parada donde está hoy?»

Toma el estado de una acción en una rueda, busca en los 19 meses del panel las
ruedas más PARECIDAS, y muestra qué pasó después de aquellas. No predice: solo
sabe recordar.

EL PELIGRO, Y POR QUÉ EL DETECTOR VIVE EN ESTE MISMO ARCHIVO
Con 11,086 filas, cualquier estado tiene vecinos. Si pido «los 17 más
parecidos», SIEMPRE voy a recibir 17, y como el mercado sube más veces de las
que baja, un buen porcentaje va a salir positivo por pura aritmética. «11 de 17
subieron» suena a hallazgo y puede ser exactamente lo que da el azar.

Por eso ningún resultado sale de acá sin su PRUEBA NULA: se sortean cientos de
grupos de 17 ruedas al azar del mismo pozo y se mira dónde cae el grupo de
vecinos dentro de esa nube. Si cae en el montón, el veredicto es «indistinguible
del azar» — y esa es la respuesta más frecuente y la más valiosa.

LAS TRES PODAS QUE EVITAN HACER TRAMPA
  1. Sin futuro: al evaluar una rueda del pasado, solo se miran ruedas ANTERIORES.
  2. Sin ecos: los vecinos de la misma acción a menos de 20 ruedas del objetivo
     son el mismo episodio contado de nuevo. Se descartan.
  3. Sin repetir episodio: entre dos vecinos de la misma acción a menos de 10
     ruedas uno del otro, se queda solo el más parecido.

LO QUE NO ENTRA AL PARECIDO, Y POR QUÉ (frontera dura, no pereza)
  · noticias — `noticias.json` es una ventana móvil de 20 días. No existe la
    historia de titulares de la BVL: cualquier estadística sobre ellos sería
    inventada.
  · volumen  — `historicos.json` guarda [fecha, precio]. No hay volumen viejo.
  · fundamentales y metales — trimestrales y mensuales: 8 y 36 puntos. Sirven
    para ETIQUETAR el episodio, nunca para pesar en la distancia.
Van como contexto en la ficha, marcados «no medido». Un dato sin historia puede
acompañar una decisión; no puede respaldar una probabilidad.
═══════════════════════════════════════════════════════════════════════════════
"""
import sys, random, statistics as st
from collections import defaultdict

from motor import series_negociadas, fechas_eeff, construir_panel, HORIZ

sys.stdout.reconfigure(encoding='utf-8')

# El estado de una acción en una rueda. Solo cosas con historia diaria: es la
# única familia de datos que puede sostener una frecuencia.
RASGOS = {
    'mom1':  0.5,   # el golpe de ayer
    'mom3':  1.5,   # el tramo corto — es el que más pesó en las pruebas
    'mom5':  1.0,
    'mom10': 0.8,
    'mom20': 0.5,   # de dónde viene
    'rsi14': 0.8,
    'dd60':  0.8,   # cuánto le falta para su techo de 3 meses
    'volrel': 0.8,  # su volatilidad de ahora contra la suya de siempre
    'mercado': 0.7, # cómo venía la BVL entera esa rueda
}

SEMILLA = 20260806   # el sorteo de la prueba nula tiene que ser reproducible


def preparar(filas):
    """Añade los dos rasgos que necesitan mirar a todo el panel, y normaliza
    cada rasgo por su propia dispersión: sin esto, mom20 (que se mueve en
    decenas) aplastaría a mom1 (que se mueve en unidades)."""
    por_ticker = defaultdict(list)
    for r in filas:
        por_ticker[r['t']].append(r['vol20'])
    vol_tipica = {t: (st.median(v) or 0.01) for t, v in por_ticker.items()}

    por_dia = defaultdict(list)
    for r in filas:
        por_dia[r['f']].append(r)
    for rs in por_dia.values():
        med = st.median([x['mom5'] for x in rs])
        for r in rs:
            r['mercado'] = med

    for r in filas:
        r['volrel'] = r['vol20'] / vol_tipica[r['t']]

    escala = {}
    for k in RASGOS:
        v = [r[k] for r in filas]
        escala[k] = st.pstdev(v) or 1.0
    return escala


def distancia(a, b, escala):
    d = 0.0
    for k, peso in RASGOS.items():
        d += peso * ((a[k] - b[k]) / escala[k]) ** 2
    return d ** 0.5


def _indices(filas):
    idx = defaultdict(list)
    for i, r in enumerate(filas):
        idx[r['t']].append((r['f'], i))
    for t in idx:
        idx[t].sort()
    return {t: {f: n for n, (f, _) in enumerate(v)} for t, v in idx.items()}


def buscar(objetivo, filas, escala, k=20, solo_pasado=True, pos=None):
    """Los k vecinos más parecidos, ya podados."""
    pos = pos or _indices(filas)
    n_obj = pos[objetivo['t']].get(objetivo['f'], -999)
    cands = []
    for r in filas:
        if r['fwd'] is None:
            continue
        if solo_pasado and r['f'] >= objetivo['f']:
            continue                                   # poda 1: nada del futuro
        if r['t'] == objetivo['t']:
            n = pos[r['t']].get(r['f'], -999)
            if abs(n - n_obj) < 20:
                continue                               # poda 2: el mismo episodio
        cands.append((distancia(objetivo, r, escala), r))
    cands.sort(key=lambda x: x[0])

    vecinos, usados = [], defaultdict(list)
    for d, r in cands:                                 # poda 3: un episodio, un voto
        n = pos[r['t']].get(r['f'], -999)
        if any(abs(n - m) < 10 for m in usados[r['t']]):
            continue
        usados[r['t']].append(n)
        vecinos.append((d, r))
        if len(vecinos) >= k:
            break
    return vecinos


def prueba_nula(vecinos, pozo, sorteos=800):
    """¿Un grupo cualquiera de este tamaño habría dado lo mismo?
    Devuelve el percentil del resultado real dentro de la nube del azar."""
    if not vecinos or len(pozo) < len(vecinos) * 3:
        return None
    k = len(vecinos)
    real_med = st.median([r['fwd'] for _, r in vecinos])
    real_pos = sum(1 for _, r in vecinos if r['fwd'] > 0) / k
    rnd = random.Random(SEMILLA)
    meds, poss = [], []
    for _ in range(sorteos):
        m = rnd.sample(pozo, k)
        meds.append(st.median([r['fwd'] for r in m]))
        poss.append(sum(1 for r in m if r['fwd'] > 0) / k)
    return {
        'real_mediana': real_med, 'real_gana': 100 * real_pos,
        'azar_mediana': st.median(meds), 'azar_gana': 100 * st.mean(poss),
        'pct_mediana': 100 * sum(1 for x in meds if x < real_med) / sorteos,
        'pct_gana':    100 * sum(1 for x in poss if x < real_pos) / sorteos,
        'azar_p5':  sorted(meds)[int(sorteos * .05)],
        'azar_p95': sorted(meds)[int(sorteos * .95)],
    }


def veredicto(nula):
    """Un solo renglón, y que no se pueda leer de forma optimista."""
    if not nula:
        return 'sin pozo suficiente para juzgar'
    p = nula['pct_mediana']
    if p >= 95:  return f'mejor que el {p:.0f}% de los grupos al azar — señal candidata'
    if p >= 80:  return f'por encima del {p:.0f}% del azar — flojo, no alcanza'
    if p <= 5:   return f'peor que el {100-p:.0f}% del azar — la situación es MALA, no neutra'
    return f'percentil {p:.0f}: INDISTINGUIBLE DEL AZAR'


def analizar(ticker, fecha=None, k=20, filas=None, escala=None):
    """La memoria de una acción en una rueda. `fecha=None` = la última que hay."""
    if filas is None:
        series = series_negociadas()
        filas = construir_panel(series, fechas_eeff(), con_futuro=False)
        escala = preparar(filas)
    elif escala is None:
        escala = preparar(filas)

    dela = [r for r in filas if r['t'] == ticker]
    if not dela:
        return None
    objetivo = (max(dela, key=lambda r: r['f']) if fecha is None
                else next((r for r in dela if r['f'] == fecha), None))
    if not objetivo:
        return None

    vecinos = buscar(objetivo, filas, escala, k=k)
    pozo = [r for r in filas if r['fwd'] is not None and r['f'] < objetivo['f']]
    return {'objetivo': objetivo, 'vecinos': vecinos,
            'nula': prueba_nula(vecinos, pozo), 'pozo': len(pozo)}


# ── validación: la memoria, ¿sirvió alguna vez? ──────────────────────────
def grupo_de(ticker):
    """Local vs. extranjero. Los ETF y ADR del panel (QQQ, GDX, SMH, SPY, RIO,
    SCCO…) NO se negocian acá con la liquidez de Nueva York: se negocian EN LA
    BVL, con volumen de BVL. Así que separar no prueba «si funciona en activos
    líquidos» —esa liquidez no está en estos datos—; prueba si el hallazgo lo
    sostiene un subgrupo o los dos."""
    return 'extranjero' if ticker.isalpha() and len(ticker) <= 4 else 'local'


def validar(desde='2026-02-01', k=20, umbral=90, muestra=400, solo=None):
    """Fase 3 en chiquito: recorre ruedas del examen, pregunta a la memoria y
    compara lo que dijo con lo que pasó. Sin esto la memoria es un adorno.
    `solo='local'|'extranjero'` parte el panel para ver quién sostiene el hallazgo."""
    series = series_negociadas()
    filas = construir_panel(series)
    escala = preparar(filas)
    pos = _indices(filas)
    objetivos = [r for r in filas if r['f'] >= desde and r['fwd'] is not None]
    if solo:
        objetivos = [r for r in objetivos if grupo_de(r['t']) == solo]
    rnd = random.Random(SEMILLA)
    if len(objetivos) > muestra:
        objetivos = rnd.sample(objetivos, muestra)

    dicho_bien, dicho_mal, neutro = [], [], []
    casos_bien = []            # para el interrogatorio de abajo
    for o in objetivos:
        vec = buscar(o, filas, escala, k=k, pos=pos)
        if len(vec) < k:
            continue
        pozo = [r for r in filas if r['fwd'] is not None and r['f'] < o['f']]
        nula = prueba_nula(vec, pozo, sorteos=200)
        if not nula:
            continue
        if nula['pct_mediana'] >= umbral:
            dicho_bien.append(o['fwd']); casos_bien.append(o)
        elif nula['pct_mediana'] <= 100 - umbral:
            dicho_mal.append(o['fwd'])
        else:
            neutro.append(o['fwd'])

    print(f'── VALIDACIÓN DE LA MEMORIA (desde {desde}, k={k}, umbral p{umbral}) ──')
    print(f'   ruedas consultadas: {len(dicho_bien)+len(dicho_mal)+len(neutro)}')
    for nom, v in (('la memoria dijo BUENO', dicho_bien),
                   ('la memoria dijo MALO ', dicho_mal),
                   ('indistinguible       ', neutro)):
        if len(v) < 10:
            print(f'   {nom}  n={len(v):>4}  (pocas para juzgar)')
            continue
        print(f'   {nom}  n={len(v):>4}  media {st.mean(v):+6.2f}%  '
              f'mediana {st.median(v):+6.2f}%  gana {100*sum(1 for x in v if x>0)/len(v):>3.0f}%')
    todas = dicho_bien + dicho_mal + neutro
    if todas:
        print(f'   {"piso (todas)         "}  n={len(todas):>4}  media {st.mean(todas):+6.2f}%  '
              f'mediana {st.median(todas):+6.2f}%  gana {100*sum(1 for x in todas if x>0)/len(todas):>3.0f}%')
    print('\n   Vale solo si BUENO le gana al piso Y MALO le pierde. Que BUENO dé')
    print('   positivo no dice nada: en la BVL casi todo da positivo.')

    # ── ¿descubre algo, o redescubre «cayó −5%»? ─────────────────────────
    # Si cada vez que la memoria dice BUENO la acción viene de un derrumbe,
    # entonces no hay un cerebro nuevo: hay la regla simple con más pasos.
    if len(casos_bien) >= 10:
        simple = [o for o in casos_bien if o['mom3'] <= -3]
        propios = [o for o in casos_bien if o['mom3'] > -3]
        print(f'\n── ¿LA MEMORIA APORTA ALGO SOBRE LA REGLA SIMPLE? (n={len(casos_bien)}) ──')
        print(f'   estado típico cuando dice BUENO: 3r {st.median([o["mom3"] for o in casos_bien]):+.2f}%  '
              f'10r {st.median([o["mom10"] for o in casos_bien]):+.2f}%  '
              f'rsi {st.median([o["rsi14"] for o in casos_bien]):.0f}')
        print(f'   ya las agarraba la regla «cayó −3% en 3r»: {len(simple)} de {len(casos_bien)} '
              f'({100*len(simple)/len(casos_bien):.0f}%)')
        for nom, v in (('coinciden con la regla simple', simple),
                       ('SOLO las ve la memoria       ', propios)):
            if len(v) < 10:
                print(f'   {nom}  n={len(v):>3}  (pocas para juzgar)'); continue
            fw = [o['fwd'] for o in v]
            print(f'   {nom}  n={len(v):>3}  media {st.mean(fw):+6.2f}%  '
                  f'mediana {st.median(fw):+6.2f}%  gana {100*sum(1 for x in fw if x>0)/len(fw):>3.0f}%')


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'validar':
        validar()
    else:
        tk = sys.argv[1] if len(sys.argv) > 1 else 'VOLCABC1'
        res = analizar(tk)
        if not res:
            print(f'{tk}: sin datos suficientes'); sys.exit(1)
        o, n = res['objetivo'], res['nula']
        print(f'\n🧠 {tk}  rueda {o["f"]}  S/{o["p"]:.3f}')
        print(f'   3r {o["mom3"]:+.2f}%  5r {o["mom5"]:+.2f}%  10r {o["mom10"]:+.2f}%  '
              f'20r {o["mom20"]:+.2f}%  rsi {o["rsi14"]:.0f}  vol {o["vol20"]:.1f}%/día')
        print(f'\n   RUEDAS MÁS PARECIDAS (de {res["pozo"]} anteriores):')
        for d, r in res['vecinos'][:10]:
            print(f'     {r["t"]:<10} {r["f"]}  dist {d:.2f}  '
                  f'3r {r["mom3"]:+6.2f}%  →  {HORIZ}r después: {r["fwd"]:+6.2f}%')
        if n:
            print(f'\n   LO QUE PASÓ DESPUÉS (n={len(res["vecinos"])}):')
            print(f'     mediana {n["real_mediana"]:+.2f}%   ganó {n["real_gana"]:.0f}% de las veces')
            print(f'     al azar: mediana {n["azar_mediana"]:+.2f}%  (rango normal '
                  f'{n["azar_p5"]:+.2f}% a {n["azar_p95"]:+.2f}%)  ganó {n["azar_gana"]:.0f}%')
            print(f'\n   ⚖️  {veredicto(n)}')
