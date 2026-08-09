# -*- coding: utf-8 -*-
"""EL CEREBRO — versión 1, y su examen.

QUÉ APRENDIÓ ESTE LABORATORIO EN 19 MESES, y por qué el cerebro está hecho así:

  1. La DIRECCIÓN no se puede leer. 52-56% contra 49-51% de base, en todo lo que
     se probó. El cerebro no opina de dirección. Nunca.
  2. Todo efecto agregado resultó ser COMPOSICIÓN: decía en qué acción estabas
     parado, no qué iba a pasar. Por eso el cerebro compara cada acción CONSIGO
     MISMA y con nada más.
  3. Lo único que sobrevivió a esa prueba: dentro de una acción, su día más
     movido anticipa una semana ~24% más movida que su normal.
  4. Los días de precio repetido no son días quietos: son días sin dato. Se
     excluyen del aprendizaje.

CÓMO SE PUNTÚA, y es el cambio importante: **Brier**, no tasa de acierto.
Un lector honesto no es el que más acierta, es el que cuando dice 70% acierta
70%. El Brier castiga tanto al que se equivoca como al que dice 90% cuando
debería decir 60%. Y se descompone en las dos cosas que importan:

    Brier = incertidumbre − RESOLUCIÓN + CALIBRACIÓN
            (del mundo)     (cuánto     (cuánto miente
                             separa)     al decir su número)

VENTANA EXPANSIVA: para leer el día d, solo se usa historia ANTERIOR a d. El
cerebro nunca ve el futuro, ni siquiera el de otra acción.
"""
import json, sys, statistics as st

UMBRAL = 2.0        # "se movió" = |retorno de 5 ruedas| >= 2%
HORIZONTE = 5
MIN_HIST = 120      # ruedas de historia propia antes de opinar

# ── ARREGLO 1: DERIVA DE RÉGIMEN (8-ago-2026) ────────────────────────────
# La v1 aprendía de TODA la historia previa y salió con un sesgo sistemático de
# +8.3 puntos: decía 47.5% cuando la realidad era 55.9%. La causa no era el
# modelo, era el mercado: en 2025 el 42% de las semanas se movían 2%+ y en 2026
# el 56%. Aprender de un régimen y opinar en otro sesga TODO hacia abajo.
# Con ventana móvil el cerebro olvida el régimen viejo. El costo es menos casos
# para estimar; por eso VENTANA no baja de ~1 año de ruedas.
# El valor se eligió midiendo el SESGO en el segundo semestre de 2025 y sin
# mirar 2026: 90 ruedas daba +1.8 puntos, 120 daba +2.6, 250 daba +3.2. Con 90
# el sesgo en 2026 salió −0.2 puntos, o sea que transfirió. Ventanas de 60 o
# menos se quedan sin casos y no llegan a opinar.
VENTANA = 90        # ruedas hacia atrás de las que aprende. None = toda la historia

H = json.load(open('app/src/data/historicos.json', encoding='utf-8'))['historicos']
try:
    PRECIOS = json.load(open('app/src/data/precios.json', encoding='utf-8'))['precios']
except Exception:
    PRECIOS = {}

SERIES = {}
for t, h in H.items():
    v = [(f, c) for f, c in (h.get('valores') or []) if c and c > 0]
    if len(v) >= MIN_HIST + 40 and not h.get('pocoNegociada'):
        SERIES[t] = v


# ── ARREGLO 6: LA SERIE LLEGABA TARDE ─────────────────────────────────────
# `historicos.json` solo se rehace en la corrida de cierre y el cron es "mejor
# esfuerzo": el 8-ago el archivo llegaba al 5-ago mientras el precio ya era del
# 7. El cerebro estaba leyendo un mundo de dos ruedas atrás y la bitácora
# anotaba apuestas viejas con fecha de hoy.
#
# La regla es la de la app (app/src/lib/series.js): manda la fecha de la
# SESIÓN, no la de nuestra consulta.
#   · sesión posterior al último cierre -> se agrega una rueda
#   · sesión igual                      -> se reemplaza, es el mismo día más fresco
#   · sesión anterior o sin dato        -> NO SE TOCA NADA. La BVL repite el
#     último cierre cuando nadie operó, y estamparlo inventaría una rueda que
#     no existió (INVARIANTES #21).
def reparar():
    tocadas = 0
    for t, v in SERIES.items():
        px = PRECIOS.get(t) or {}
        precio = px.get('precio')
        if not (isinstance(precio, (int, float)) and precio > 0):
            continue
        sesion = (px.get('ultimaOperacion') or '')[:10] or px.get('fecha')
        if not sesion:
            continue
        ultima = v[-1][0]
        if sesion > ultima:
            v.append((sesion, precio)); tocadas += 1
        elif sesion == ultima and v[-1][1] != precio:
            v[-1] = (sesion, precio); tocadas += 1
    return tocadas


REPARADAS = reparar()


def mov(v, i):
    return None if i <= 0 or not v[i - 1][1] else (v[i][1] / v[i - 1][1] - 1) * 100


# ── ARREGLO 3: EL ESTADO DEL MERCADO (8-ago-2026) ─────────────────────────
# Todo lo probado hasta acá era una propiedad DE LA ACCIÓN, y todo terminó
# siendo composición: decía en qué papel estabas parado, no qué venía. El
# estado del mercado es distinto: cambia día a día y es EL MISMO para las 46
# acciones a la vez. Si predice dentro de una acción, no puede ser composición.
#
# Medido antes de meterlo: mercado agitado contra mercado quieto da +13.1
# puntos de mediana, 29 de 36 acciones a favor, p=0.00016.
#
# Por qué funciona donde el movimiento propio no: el movimiento de UNA acción
# es una medición ruidosa del régimen; la amplitud del mercado promedia 40 y
# saca la misma señal sin el ruido.
#
# AMPLITUD = % de las acciones que se movieron 2% o más ese día.
ORDEN = sorted({f for v in SERIES.values() for f, _ in v})
POS = {t: {f: i for i, (f, _) in enumerate(v)} for t, v in SERIES.items()}

MERCADO = {}
for _f in ORDEN:
    _ms = []
    for _t, _v in SERIES.items():
        _i = POS[_t].get(_f)
        if _i is None:
            continue
        _m = mov(_v, _i)
        if _m is not None and abs(_m) > 1e-9:
            _ms.append(abs(_m))
    if len(_ms) >= 20:
        MERCADO[_f] = 100 * sum(1 for _x in _ms if _x >= UMBRAL) / len(_ms)


def clima(fecha, ventana=VENTANA):
    """En qué tercio de amplitud cae hoy, contra los últimos `ventana` días.

    Los cortes salen SOLO de días anteriores: si se calcularan con toda la
    historia, el cerebro estaría usando el futuro para saber si hoy fue un día
    agitado — y ese es justo el error que este archivo lleva cuatro secciones
    tratando de no cometer.
    """
    hoy = MERCADO.get(fecha)
    if hoy is None:
        return None
    k = ORDEN.index(fecha)
    previos = [MERCADO[f] for f in ORDEN[max(0, k - ventana):k] if f in MERCADO]
    if len(previos) < 40:
        return None
    previos.sort()
    c1, c2 = previos[len(previos) // 3], previos[2 * len(previos) // 3]
    return 'quieto' if hoy <= c1 else ('agitado' if hoy > c2 else 'medio')


def adelante(v, i, n=HORIZONTE):
    return None if i + n >= len(v) else (v[i + n][1] / v[i][1] - 1) * 100


# ── ARREGLO 5: LA POSICIÓN, que no es volatilidad disfrazada ─────────────
# Los cinco ángulos anteriores medían todos LO MISMO con distinto disfraz —
# cuánto se ha estado moviendo— y por eso ninguno le agregaba nada a la base
# móvil, que ya lo contiene. Éste mide otra cosa: DÓNDE ESTÁ EL PRECIO.
#
# Medido antes de meterlo, dentro de cada acción y descontando lo que la base
# ya predecía: pegada al techo del año (>80% de su rango de 52 semanas) contra
# el medio da +3.3 puntos, 23 de 35 acciones, p=0.045. Contra el piso da +10.6.
#
# El piso NO funciona (−5.2 pts, 5 de 11): en la BVL la volatilidad vive en el
# techo, que es lo contrario del efecto apalancamiento de Black (1976) —
# probado acá y no aparece: caída contra subida del mismo tamaño da p=0.42.
# El mecanismo que sí encaja es el de Della Vedova (2021): la cercanía al
# máximo de 52 semanas cambia el desacuerdo entre inversores y la liquidez.
def posicion52(t, i):
    """Dónde está el precio dentro de su rango del último año, 0 a 100."""
    v = SERIES[t]
    if i < 120:
        return None
    h = [c for _, c in v[max(0, i - 252):i + 1]]
    lo, hi = min(h), max(h)
    return None if hi <= lo else 100 * (v[i][1] - lo) / (hi - lo)


def zona(t, i):
    p = posicion52(t, i)
    return None if p is None else ('techo' if p > 80 else ('piso' if p < 20 else 'medio'))


def calcular_lift(hasta):
    """Cuánto corre el clima las probabilidades, en log-odds, juntando las 46.

    Se estima SOLO con ruedas anteriores a `hasta`: el cerebro nunca conoce el
    efecto del clima de un día usando ese mismo día ni los que vienen después.
    """
    from math import log
    def lodds(k, n):
        p = max(1e-6, min(1 - 1e-6, k / n))
        return log(p / (1 - p))

    # ── CLIMA: es una variable de la FECHA y le pega igual a las 46 a la vez,
    #    así que juntarlas está bien: no hay comparación entre papeles distintos.
    acum = {}
    # ── ZONA: es una variable DE LA ACCIÓN. Juntar las 46 mezcla "esta acción
    #    en su techo contra esta acción en su medio" con "una acción cara
    #    contra otra barata", y gana la segunda. El primer intento así dio
    #    techo −0.035, al revés de lo medido dentro de cada acción (+3.3 pts).
    #    Se estima acción por acción y recién después se promedia.
    porAccion = {}
    for t, v in SERIES.items():
        for j in range(1, len(v)):
            if v[j][0] >= hasta:
                break
            m, f = mov(v, j), adelante(v, j)
            if m is None or f is None or abs(m) < 1e-9:
                continue
            ok = abs(f) >= UMBRAL
            c = clima(v[j][0])
            if c:
                d = acum.setdefault(c, [0, 0]); d[1] += 1; d[0] += ok
            z = zona(t, j)
            if z:
                d = porAccion.setdefault(t, {}).setdefault(z, [0, 0]); d[1] += 1; d[0] += ok

    lift_clima = {}
    if 'medio' in acum and acum['medio'][1] >= 200:
        ref = lodds(*acum['medio'])
        lift_clima = {c: lodds(k, n) - ref for c, (k, n) in acum.items() if n >= 200}

    difs = {'techo': [], 'piso': []}
    for t, zs in porAccion.items():
        if 'medio' not in zs or zs['medio'][1] < 40:
            continue
        ref = lodds(*zs['medio'])
        for z in ('techo', 'piso'):
            if z in zs and zs[z][1] >= 25:
                difs[z].append(lodds(*zs[z]) - ref)
    lift_zona = {'medio': 0.0}
    for z, xs in difs.items():
        if len(xs) >= 8:
            lift_zona[z] = st.median(xs)
    return lift_clima, lift_zona


LIFT, LIFT_ZONA = {}, {}


def rango_de(pasado, cuartil, c75):
    """El rango probable del |movimiento| a 5 ruedas, en percentiles.

    Una probabilidad sola no le sirve a nadie parado frente a la pantalla:
    "72% de que se mueva 2%+" no dice si hablamos de 3% o de 15%. Los
    percentiles salen de los MISMOS días parecidos de esa acción, así que el
    rango y la probabilidad no se pueden contradecir.

    Se devuelve p10-p90 y no el mínimo-máximo: los extremos de una muestra
    chica son el caso más raro que le tocó vivir, no lo que cabe esperar.
    """
    tams = ([] if c75 is None else
            sorted(t for x, _s, _c, t in pasado if (x > c75) == (cuartil == 4)))
    if len(tams) < 20:
        tams = sorted(t for _x, _s, _c, t in pasado)
    if len(tams) < 20:
        return None
    q = lambda f: tams[min(len(tams) - 1, int(f * len(tams)))]
    return {'p10': round(q(.10), 2), 'mediana': round(q(.50), 2), 'p90': round(q(.90), 2)}


def leer(ticker, i):
    """La lectura del día i para esa acción, usando SOLO historia previa.

    Devuelve la probabilidad de que se mueva más del umbral en 5 ruedas, y de
    dónde salió ese número. `None` si no hay historia suficiente para opinar —
    abstenerse es una respuesta válida y es la que más cuesta programar.
    """
    v = SERIES[ticker]
    if i < MIN_HIST:
        return None

    # ── su historia hasta AYER, sin días de precio repetido ──────────────
    pasado = []
    desde_j = 1 if VENTANA is None else max(1, i - VENTANA)
    for j in range(desde_j, i):
        m = mov(v, j)
        f = adelante(v, j)
        if m is None or f is None:
            continue
        if abs(m) < 1e-9:      # precio repetido: no es un día quieto, es un día sin dato
            continue
        pasado.append((abs(m), abs(f) >= UMBRAL, clima(v[j][0]), abs(f)))
    if len(pasado) < 60:
        return None

    # `cruda` es lo que sabe de la acción SIN mirar el día: es el rival contra
    # el que se puntea el cerebro y por eso no se le toca nunca. (La v3 metía
    # el clima acá adentro y el examen terminaba comparando al cerebro consigo
    # mismo: daba ganancia 0.0000 y parecía que el mercado no servía.)
    cruda = sum(1 for _, s, _c, _t in pasado if s) / len(pasado)
    base = cruda

    # ── el estado del mercado de HOY, y qué le pasó a ESTA acción los otros
    #    días de ese mismo clima. Es lo único que varía en el tiempo y no
    #    depende de qué acción sea.
    # ── ARREGLO 4: SEPARAR EL NIVEL DEL EFECTO ───────────────────────────
    # El primer intento estimaba el efecto del clima con la historia de la
    # PROPIA acción dentro de la ventana de 90: quedaban ~30 días por tercio y
    # el número salía puro ruido. Empeoró el Brier (−0.0007 de resolución).
    #
    # Son dos cosas distintas y hay que estimarlas distinto:
    #   · el NIVEL (cuánto se mueve esta acción) es propio y cambia con el
    #     régimen -> ventana corta, solo esta acción.
    #   · el EFECTO del clima (cuánto corre las probabilidades un día agitado)
    #     es del mercado, es el mismo para todas y es estable -> se estima
    #     juntando las 46 acciones y toda la historia previa.
    # Se aplica en log-odds y no restando puntos, porque +13 puntos sobre una
    # base de 20% y sobre una de 80% no son lo mismo: en log-odds el
    # desplazamiento es proporcional y nunca se sale de 0-1.
    from math import log, exp
    ajuste = (LIFT.get(clima(v[i][0])) or 0.0) + (LIFT_ZONA.get(zona(ticker, i)) or 0.0)
    if ajuste:
        o = max(1e-6, min(1 - 1e-6, cruda))
        base = 1 / (1 + exp(-(log(o / (1 - o)) + ajuste)))

    hoy = mov(v, i)
    if hoy is None or abs(hoy) < 1e-9:
        # el día no dejó dato: se devuelve la base de la acción y se dice así
        return {'p': base, 'motivo': 'sin dato del día (precio repetido)',
                'base': base, 'cruda': cruda, 'rango': rango_de(pasado, None, None),
                'n': len(pasado), 'cuartil': None, 'habla': False}

    # ── ¿en qué cuartil de SU PROPIA historia cae el movimiento de hoy? ──
    tam = sorted(x for x, _s, _c, _t in pasado)
    c75 = tam[int(0.75 * len(tam))]
    cuartil = 4 if abs(hoy) > c75 else (1 if abs(hoy) <= tam[int(0.25 * len(tam))] else 2)

    # ── qué pasó las otras veces que ESTA acción tuvo un día así ─────────
    # ── ARREGLO 7: LA PUERTA ERA INALCANZABLE (8-ago-2026) ───────────────
    # Acá pedía `>= 25` y eso NUNCA se podía cumplir en el cuartil alto. Es
    # aritmética, no mala suerte: `pasado` tope 90 (VENTANA), el cuartil alto
    # es su 25% -> el grupo tope es 22. Medido sobre el examen: 978 lecturas
    # caen en cuartil 4 y **las 978** salían por acá, con grupo de mediana 19 y
    # máximo 22. O sea el cerebro corría su lógica de días parecidos SOLO sobre
    # los días normales y se abstenía en los días grandes — al revés de para lo
    # que se escribió. Y como `habla` exige cuartil 4, hablaba 0 de 4626 veces.
    #
    # La puerta se baja, no se saca: sigue haciendo falta un piso. Pero el que
    # protege de un grupo chico es el ENCOGIMIENTO de abajo, que es gradual —
    # con 13 casos el número propio pesa 34% y con 22 pesa 47%. Una puerta dura
    # encima de eso duplica la protección, y puesta por arriba del techo
    # estructural no protege: apaga.
    MIN_GRUPO = 12
    grupo = [s for x, s, _c, _t in pasado if (x > c75) == (cuartil == 4)]
    if len(grupo) < MIN_GRUPO:
        return {'p': base, 'motivo': 'pocos días parecidos en su historia',
                'base': base, 'cruda': cruda, 'rango': rango_de(pasado, cuartil, c75),
                'n': len(pasado), 'cuartil': cuartil, 'habla': False}
    p = sum(1 for s in grupo if s) / len(grupo)

    # Se encoge hacia la base según cuántos casos parecidos hay. Con 25 casos
    # el número propio pesa la mitad; con 200, el 89%. Sin esto, una acción con
    # 26 casos gritaría 85% con la misma seguridad que una con 300.
    peso = len(grupo) / (len(grupo) + 25)
    p = peso * p + (1 - peso) * base

    return {'p': p, 'base': base, 'cruda': cruda, 'rango': rango_de(pasado, cuartil, c75),
            'n': len(pasado), 'nGrupo': len(grupo),
            'cuartil': cuartil, 'habla': cuartil == 4 and abs(p - base) >= 0.05,
            'motivo': ('día del cuartil alto de esta acción' if cuartil == 4
                       else 'día normal para esta acción')}


# ══════════════════════════════════════════════════════════════════════════
#  EL EXAMEN — cinco pruebas, con la nota mínima escrita de antemano
# ══════════════════════════════════════════════════════════════════════════
def brier(pares):
    return sum((p - (1 if s else 0)) ** 2 for p, s in pares) / len(pares)


def descomponer(pares, bins=10):
    """Brier = incertidumbre − resolución + calibración (Murphy 1973)."""
    n = len(pares)
    tasa = sum(1 for _, s in pares if s) / n
    inc = tasa * (1 - tasa)
    grupos = {}
    for p, s in pares:
        k = min(bins - 1, int(p * bins))
        grupos.setdefault(k, []).append((p, s))
    res = cal = 0.0
    for g in grupos.values():
        nk = len(g)
        pk = sum(x for x, _ in g) / nk
        ok = sum(1 for _, s in g if s) / nk
        res += nk * (ok - tasa) ** 2
        cal += nk * (pk - ok) ** 2
    return inc, res / n, cal / n


def correr(desde='2026-01-01'):
    # El efecto del clima se estima con TODO lo anterior al periodo de examen
    # y no se vuelve a tocar: es un parametro aprendido, no un ajuste diario.
    global LIFT, LIFT_ZONA
    LIFT, LIFT_ZONA = calcular_lift(desde)
    print(f'  clima del mercado (log-odds): ' + ', '.join(f'{k} {v:+.3f}' for k, v in sorted(LIFT.items())))
    print(f'  zona del precio  (log-odds): ' + ', '.join(f'{k} {v:+.3f}' for k, v in sorted(LIFT_ZONA.items())))
    real, climat, global_ = [], [], []
    hablo, callo = [], []
    total_dias = 0
    for t, v in SERIES.items():
        for i in range(len(v)):
            if v[i][0] < desde:
                continue
            f = adelante(v, i)
            if f is None:
                continue
            L = leer(t, i)
            if L is None:
                continue
            total_dias += 1
            s = abs(f) >= UMBRAL
            real.append((L['p'], s))
            climat.append((L['cruda'], s))         # rival: su base SIN mirar el día
            (hablo if L['habla'] else callo).append((L['p'], s))
    glob = sum(1 for _, s in real if s) / len(real)
    global_ = [(glob, s) for _, s in real]

    print('=' * 84)
    print(f'  EXAMEN DEL CEREBRO — {desde} en adelante, {len(SERIES)} acciones, {total_dias} lecturas')
    print('=' * 84)
    b_real, b_clim, b_glob = brier(real), brier(climat), brier(global_)
    print(f'\n  Brier del cerebro:            {b_real:.4f}   (más bajo es mejor)')
    print(f'  Brier de su propia base:      {b_clim:.4f}   ← el rival de verdad')
    print(f'  Brier de la base del mercado: {b_glob:.4f}')
    inc, res, cal = descomponer(real)
    print(f'\n  Descomposición: incertidumbre {inc:.4f} − resolución {res:.4f} + calibración {cal:.4f}')
    print(f'    resolución  = cuánto separa las semanas movidas de las quietas (más alto, mejor)')
    print(f'    calibración = cuánto miente al decir su número (más bajo, mejor)')

    print('\n  ── Calibración, tramo por tramo ' + '─' * 40)
    grupos = {}
    for p, s in real:
        k = min(9, int(p * 10))
        grupos.setdefault(k, []).append(s)
    for k in sorted(grupos):
        g = grupos[k]
        if len(g) < 20:
            continue
        print(f'    dice {k*10:3d}-{k*10+10:3d}%  ->  pasó {100*sum(g)/len(g):5.1f}%   (n={len(g)})')

    # ── ARREGLO 2: EL EXAMEN v1 ERA REGALADO ─────────────────────────────
    # Ponía cortes ABSOLUTOS (calibración < 0.010, resolución > 0.005) y los
    # aprobaba un modelo cuya única habilidad era saber en qué acción estaba:
    # su propia base sola ya daba resolución 0.0380 de las 0.0383 del cerebro.
    # Ahora TODO se mide como ganancia sobre esa base. Si el cerebro no le
    # agrega nada a "esta acción se mueve así", no sabe leer nada.
    inc2, res2, cal2 = descomponer(climat)
    print('\n  ── Las cinco pruebas (v2: todo contra su propia base) ' + '─' * 18)
    g_brier = b_clim - b_real
    p1 = g_brier > 0.002
    print(f'    1. ¿Le gana a la base de la acción por algo?    {"SÍ" if p1 else "NO"}'
          f'   ganancia {g_brier:+.5f}  (hace falta > 0.002)')
    g_res = res - res2
    p2 = g_res > 0.002
    print(f'    2. ¿Distingue DÍAS, no solo acciones?           {"SÍ" if p2 else "NO"}'
          f'   resolución {res:.4f} vs {res2:.4f}  ({g_res:+.5f})')
    p_med = sum(p for p, _ in real) / len(real)
    o_med = sum(1 for _, s in real if s) / len(real)
    sesgo = abs(o_med - p_med)
    p3 = sesgo < 0.02
    print(f'    3. ¿Sin sesgo? (dice {100*p_med:.1f}%, pasa {100*o_med:.1f}%)      '
          f'{"SÍ" if p3 else "NO"}   sesgo {100*sesgo:.1f} pts  (hace falta < 2)')
    ah = 100 * sum(1 for _, s in hablo if s) / len(hablo) if hablo else 0
    ac = 100 * sum(1 for _, s in callo if s) / len(callo) if callo else 0
    p4 = bool(hablo) and (ah - ac) > 5
    print(f'    4. ¿Sabe cuándo hablar? (habla {len(hablo)}, calla {len(callo)})      '
          f'{"SÍ" if p4 else "NO"}   {ah:.0f}% vs {ac:.0f}%  (hace falta +5)')
    p5 = len(real) >= 100
    print(f'    5. ¿Muestra suficiente? (>= 100 lecturas)       {"SÍ" if p5 else "NO"}   ({len(real)})')
    print()
    n_ok = sum([p1, p2, p3, p4, p5])
    print(f'  RESULTADO: {n_ok}/5')
    print('  ' + ('SABE LEER EL MERCADO (en la única pregunta que se le permite).'
                  if n_ok == 5 else 'TODAVÍA NO. Se anota qué falló y se sigue.'))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    correr()
