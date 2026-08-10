"""EL LECTOR DIRECCIONAL — R8 convertido en probabilidad, con su examen.

El cerebro de `cerebro.py` pregunta MAGNITUD y sobre esa pregunta ya fallaron
ocho variables de día. Este pregunta lo otro, que es lo único que el
laboratorio tiene probado fuera de muestra: **¿la minera sube mañana?**, leído
del metal de hoy.

R8 ya está medido (71.8% con metal ≥1%). Eso NO es lo que se prueba acá. Una
tasa de acierto no es un lector: un lector dice un número y tiene que acertar
ESE número. Lo que se prueba es si sale una probabilidad calibrada que le gane
a la base propia de cada acción — que es el rival de verdad, no el 50%.

POR QUÉ EL RIVAL ES LA BASE PROPIA Y NO EL 50%
Ocho reglas del cementerio murieron por lo mismo: un efecto agregado que en
realidad decía en qué acción estabas parado. Una acción que sube el 58% de sus
ruedas hace pasar por vidente a cualquiera que diga "sube". Así que todo se
puntea como GANANCIA sobre esa base, igual que el examen v2 del cerebro.

CÓMO SE ESTIMA, y cada decisión es una piedra de tropiezo anterior
· El EFECTO del metal se estima dentro de cada acción y después se toma la
  MEDIANA entre acciones (regla 2). Juntar las 11 de una mezclaría "SCCO con
  el cobre volando" con "SCCO contra Cerro Verde", y gana la segunda.
· Todo en LOG-ODDS (regla 4): +13 puntos sobre 20% y sobre 80% no son lo mismo.
· ENCOGIMIENTO por evidencia (regla 5): peso = casos/(casos+25).
· El efecto se congela con datos ANTERIORES al examen y no se vuelve a tocar.
· La BASE de cada acción se recalcula día a día con su ventana previa: es lo
  propio y cambia con el régimen (regla 3).

EL SUPUESTO DE HORARIO, que decide si esto se puede usar
El metal cierra DESPUÉS que Lima. Así que la lectura del día D se hace de
noche, con el metal ya cerrado, para operar la rueda D+1. Es la forma en que R8
está medido. Lo que NO resuelve —y lo dice el §4 del archivo— es si el
movimiento se va en el hueco de apertura de D+1. Hasta que eso se sepa, esto
mide una ventaja que existe, no una que se pueda cobrar.
"""
import io
import json
import statistics as st
import sys
from math import comb, exp, log

_stdout, sys.stdout = sys.stdout, io.StringIO()
sys.path.insert(0, 'laboratorio')
import cerebro as C  # noqa: E402
sys.stdout = _stdout

CORTE = '2026-01-01'
# 120 al principio, y traía +3.6 puntos de sesgo él solo: la tasa propia de
# subida estimada con 120 ruedas venía de un tramo más alcista que 2026. Medido
# aparte: la base sola dice 56.6% cuando la realidad del examen es 53.1%, y el
# metal encima agrega +0.3. O sea el sesgo NO es de la señal, es del parámetro
# de estorbo. Se alinea al 90 de `cerebro.py`, que está puesto por esta misma
# razón y con esta misma cuenta (ARREGLO 3, arregló un sesgo de 8.3 puntos).
VENTANA_BASE = 90      # ruedas propias para la base de la acción
MIN_BASE = 60          # sin esto no se opina
# ── LOS DOS CORTES, Y EL ERROR QUE LOS PUSO MAL LA PRIMERA VEZ ───────────
# MIN_CELDA arrancó en 20 y se comía el lado de BAJADA entero. No por azar:
# 2025 fue un toro del metal, hay menos días de baja, y con 20 solo 3 acciones
# llegaban a votar contra las 5 que pide el balde. Se caían tres baldes que
# entre los tres tenían 374 casos y la mitad más fuerte de la escalera —el
# metal −≥2% deja la minera en 28.4% de subida contra 80.1% del +≥2%—. El
# estimador de acá no es la celda de una acción: es la MEDIANA entre acciones,
# que aguanta celdas flacas mucho mejor que un promedio. Por eso 10 alcanza.
MIN_CELDA = 10         # casos por balde y por acción para que esa acción vote
MIN_ACCIONES = 5       # acciones que tienen que votar para que el balde exista

# El encogimiento se aplica sobre la cantidad de ACCIONES que votaron, no de
# casos: el lift es una mediana entre acciones y su precisión sale de cuántas
# hay. El primer intento reusó el 25 de `cerebro.py`, que está calibrado para
# CASOS, y con 6 acciones daba peso 0.19 — aplastaba el lift a un quinto y el
# lector no se despegaba nunca de su base. Mismo error de unidades que la
# puerta imposible del cerebro, cometido en el archivo que la denunciaba.
ENCOGE = 4             # peso = acciones/(acciones+ENCOGE)

MAPA = {
    'RIO': 'oro', 'BVN': 'oro', 'PODERC1': 'oro', 'PPX': 'oro', 'GDX': 'oro',
    'VOLCABC1': 'plata', 'NEXAPEC1': 'plata', 'ATACOBC1': 'plata',
    'CVERDEC1': 'cobre', 'SCCO': 'cobre', 'BROCALC1': 'cobre',
}

M = json.load(open('app/src/data/metales_diarios.json', encoding='utf-8'))['metales']
MET = {}
for nom, d in M.items():
    cs = sorted(d['cierres'].items())
    MET[nom] = {f: (c / cs[i - 1][1] - 1) * 100 for i, (f, c) in enumerate(cs) if i > 0}


def balde(x):
    """El movimiento del metal, con signo y en cuatro tamaños.

    Los cortes NO se eligen acá: son los que ya usa la tabla de R8 (0.5%, 1%,
    2%), escritos antes de mirar este resultado. Elegirlos ahora sería buscar
    el corte que mejor queda, que es como se fabricó media tabla del
    cementerio.
    """
    a = abs(x)
    if a < 0.5:
        return None                      # ruido del metal: no es una lectura
    t = 1 if a < 1 else (2 if a < 2 else 3)
    return (1 if x > 0 else -1, t)


def lodds(p):
    p = max(1e-6, min(1 - 1e-6, p))
    return log(p / (1 - p))


def sig(z):
    return 1 / (1 + exp(-z))


def binom_p(k, n):
    if n == 0:
        return 1.0
    k = max(k, n - k)
    return min(1.0, 2 * sum(comb(n, j) for j in range(k, n + 1)) / 2 ** n)


def dias(t, metal):
    """(i, fecha, movimiento del metal ese día, subió la acción al día siguiente).

    El día i se lee con el metal de la fecha de i y se apuesta a la rueda i+1.
    Se saltean los días de precio repetido en los dos extremos: no son días
    quietos, son días sin dato, y contarlos como "no subió" inventaría una
    dirección que nunca hubo.
    """
    v = C.SERIES[t]
    met = MET.get(metal, {})
    out = []
    for i in range(len(v) - 1):
        x = met.get(v[i][0])
        if x is None:
            continue
        m = C.mov(v, i + 1)
        if m is None or abs(m) < 1e-9:
            continue
        out.append((i, v[i][0], x, m > 0))
    return out


def base_hasta(serie_dias, k):
    """La tasa propia de subida de esa acción con SU ventana previa, sin mirar hoy."""
    prev = [s for _i, _f, _x, s in serie_dias[max(0, k - VENTANA_BASE):k]]
    return None if len(prev) < MIN_BASE else sum(prev) / len(prev)


def aprender():
    """El lift de cada balde: dentro de cada acción, y la mediana entre acciones."""
    porAccion = {}
    for t in MAPA:
        if t not in C.SERIES:
            continue
        d = [r for r in dias(t, MAPA[t]) if r[1] < CORTE]
        if len(d) < MIN_BASE:
            continue
        base = sum(s for _i, _f, _x, s in d) / len(d)
        celdas = {}
        for _i, _f, x, s in d:
            b = balde(x)
            if b:
                c = celdas.setdefault(b, [0, 0]); c[1] += 1; c[0] += s
        for b, (k, n) in celdas.items():
            if n >= MIN_CELDA:
                porAccion.setdefault(b, []).append(lodds(k / n) - lodds(base))
    return {b: st.median(xs) for b, xs in porAccion.items() if len(xs) >= MIN_ACCIONES}, porAccion


LIFT, VOTOS = aprender()


def leer(t, serie_dias, k):
    """La lectura del día k: probabilidad de que la acción suba la rueda siguiente."""
    base = base_hasta(serie_dias, k)
    if base is None:
        return None
    x = serie_dias[k][2]
    b = balde(x)
    lift = LIFT.get(b)
    if b is None or lift is None:
        return {'p': base, 'base': base, 'balde': b, 'habla': False,
                'motivo': 'el metal no dijo nada' if b is None else 'balde sin evidencia'}
    n = len(VOTOS.get(b, []))
    peso = n / (n + ENCOGE)
    p = sig(lodds(base) + peso * lift)
    return {'p': p, 'base': base, 'balde': b, 'lift': lift,
            'habla': abs(p - base) >= 0.05,
            'motivo': f'metal {"+" if b[0] > 0 else "-"} tamaño {b[1]}'}


def brier(pares):
    return sum((p - (1 if s else 0)) ** 2 for p, s in pares) / len(pares)


def examen(mapa, titulo):
    real, base_, hablo, callo = [], [], [], []
    porAccion = {}
    for t in sorted(mapa):
        if t not in C.SERIES:
            continue
        d = dias(t, mapa[t])
        for k in range(len(d)):
            if d[k][1] < CORTE:
                continue
            L = leer(t, d, k)
            if L is None:
                continue
            s = d[k][3]
            real.append((L['p'], s))
            base_.append((L['base'], s))
            (hablo if L['habla'] else callo).append((L['p'], s))
            porAccion.setdefault(t, []).append((L['p'], L['base'], s))

    print('\n' + '=' * 84)
    print(f'  {titulo} — {CORTE} en adelante, {len(real)} lecturas')
    print('=' * 84)

    b_real, b_base = brier(real), brier(base_)
    print(f'\n  Brier del lector:        {b_real:.4f}   (más bajo es mejor)')
    print(f'  Brier de la base propia: {b_base:.4f}   ← el rival de verdad')
    print(f'  ganancia:                {b_base - b_real:+.5f}')

    print('\n  ── Calibración ' + '─' * 56)
    g = {}
    for p, s in real:
        g.setdefault(min(9, int(p * 10)), []).append(s)
    for kk in sorted(g):
        if len(g[kk]) >= 20:
            print(f'    dice {kk*10:3d}-{kk*10+10:3d}%  ->  subió {100*sum(g[kk])/len(g[kk]):5.1f}%   (n={len(g[kk])})')

    print('\n  ── Las pruebas ' + '─' * 56)
    p1 = (b_base - b_real) > 0.002
    print(f'    1. ¿Le gana a la base de la acción?   {"SÍ" if p1 else "NO"}'
          f'   {b_base - b_real:+.5f}  (hace falta > 0.002)')
    ah = 100 * sum(1 for p, s in hablo if (p > 0.5) == s) / len(hablo) if hablo else 0
    ac = 100 * sum(1 for p, s in callo if (p > 0.5) == s) / len(callo) if callo else 0
    p2 = bool(hablo) and (ah - ac) > 5
    print(f'    2. ¿Sabe cuándo hablar?               {"SÍ" if p2 else "NO"}'
          f'   habla {len(hablo)} y acierta {ah:.1f}%, calla {len(callo)} y acierta {ac:.1f}%  (hace falta +5)')
    pm = sum(p for p, _ in real) / len(real)
    om = sum(1 for _, s in real if s) / len(real)
    p3 = abs(om - pm) < 0.02
    print(f'    3. ¿Sin sesgo?                        {"SÍ" if p3 else "NO"}'
          f'   dice {100*pm:.1f}%, subió {100*om:.1f}%  ({100*abs(om-pm):.1f} pts)')
    # ── LA PRUEBA 4, v2 ──────────────────────────────────────────────────
    # La v1 contaba acciones con acierto > 50% y era regalada por la misma
    # razón que el examen v1 del cerebro: una acción que sube el 55% de sus
    # ruedas saca >50% diciendo siempre "sube". El control de peruanas no
    # mineras la pasaba 15 de 17 con ganancia CERO. Ahora cada acción se
    # compara contra SU PROPIA base, con el mismo Brier de la prueba 1.
    ganan = {t: (brier([(p, s) for p, _b, s in xs]),
                 brier([(b, s) for _p, b, s in xs]), len(xs))
             for t, xs in porAccion.items() if len(xs) >= 30}
    k = sum(1 for br, bb, _n in ganan.values() if bb - br > 0)
    n = len(ganan)
    p4 = n >= 8 and binom_p(k, n) < 0.05
    print(f'    4. ¿En TODAS, no en tres?             {"SÍ" if p4 else "NO"}'
          f'   {k} de {n} acciones le ganan a su propia base  ·  p={binom_p(k, n):.4f}')
    print()
    for t in sorted(ganan):
        br, bb, nn = ganan[t]
        print(f'      {t:10s} n={nn:4d}   Brier {br:.4f} vs base {bb:.4f}   {bb - br:+.4f}')
    n_ok = sum([p1, p2, p3, p4])
    print(f'\n  RESULTADO: {n_ok}/4')
    print('  ' + ('LEE LA DIRECCIÓN. Falta saber si el hueco de apertura deja tomarla.'
                  if n_ok == 4 else 'TODAVÍA NO. Se anota qué falló y se sigue.'))


def anotar(rueda):
    """Escribe la apuesta direccional de una rueda ANTES de que se sepa el resultado.

    Archivo aparte de `bitacora.jsonl` a propósito: esa bitácora tiene el
    esquema del cerebro de MAGNITUD (`p`, `cuartil`, `zona`, `se_movio`) y
    mezclar dos preguntas distintas en el mismo registro es cómo se termina
    puntuando una con la vara de la otra.

    El insumo es el ÚLTIMO cierre del metal que ya ocurrió — para la rueda del
    lunes, el oro del viernes. No se anota nada si esa rueda ya está escrita:
    una apuesta que se puede reescribir después del resultado no es una
    apuesta.
    """
    ruta = 'laboratorio/bitacora_direccional.jsonl'
    try:
        filas = [json.loads(l) for l in open(ruta, encoding='utf-8') if l.strip()]
    except FileNotFoundError:
        filas = []
    ya = {(r['rueda'], r['ticker']) for r in filas}

    metal_f = {m: sorted(MET[m])[-1] for m in MET}
    nuevas = 0
    for t in sorted(MAPA):
        if t not in C.SERIES or (rueda, t) in ya:
            continue
        met = MAPA[t]
        f_met = metal_f[met]
        if f_met >= rueda:          # el metal tiene que ser ANTERIOR a la rueda
            continue
        x = MET[met][f_met]
        d = dias(t, met)
        base = base_hasta(d, len(d))
        b = balde(x)
        lift = LIFT.get(b)
        if base is None or lift is None:
            continue
        n = len(VOTOS.get(b, []))
        p = sig(lodds(base) + (n / (n + ENCOGE)) * lift)
        filas.append({
            'rueda': rueda, 'ticker': t, 'metal': met,
            'metal_fecha': f_met, 'metal_mov': round(x, 3),
            'balde': list(b), 'base': round(base, 4), 'p': round(p, 4),
            'habla': abs(p - base) >= 0.05,
            'precio_previo': C.SERIES[t][-1][1], 'fecha_previa': C.SERIES[t][-1][0],
            'subio': None,          # lo llena `resolver` cuando exista la rueda
        })
        nuevas += 1
    with open(ruta, 'w', encoding='utf-8') as f:
        for r in filas:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(f'  rueda {rueda}: anotadas {nuevas} · archivo: {len(filas)} en total')
    for r in filas[-nuevas:] if nuevas else []:
        print(f'    {r["ticker"]:10s} {r["metal"]:6s} {r["metal_mov"]:+6.2f}% el {r["metal_fecha"]}'
              f'  ->  base {100*r["base"]:.1f}%  dice {100*r["p"]:.1f}%'
              f'  {"HABLA" if r["habla"] else "calla"}')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if len(sys.argv) > 2 and sys.argv[1] == 'anotar':
        anotar(sys.argv[2])
        sys.exit()
    print('  Baldes aprendidos con el entrenamiento (log-odds, mediana entre acciones):')
    for b in sorted(LIFT):
        print(f'    metal {"sube" if b[0] > 0 else "baja"} tamaño {b[1]}:'
              f' {LIFT[b]:+.3f}   ({len(VOTOS[b])} acciones votaron)')
    faltan = [b for b in VOTOS if b not in LIFT]
    if faltan:
        print(f'    sin evidencia suficiente: {sorted(faltan)}')

    examen(MAPA, 'EXAMEN DEL LECTOR DIRECCIONAL · MINERAS')

    # ── LOS CONTROLES, que son los que deciden si esto es el metal o el mundo ─
    # Se les aplica el MISMO lift aprendido con las mineras. Si a una de estas
    # también le gana a su base, el balde no está midiendo el metal.
    #
    # El primer intento metió las 36 en una bolsa sola y pasaba 4 de 4 — pero
    # adentro estaban GLD (que TIENE oro), Minsur (que es minera) y ocho ETF
    # globales que son el mercado mundial mismo. Un control que contiene lo que
    # quiere controlar no controla nada. El §1.1 del archivo usa el control que
    # corresponde: peruanas no mineras (Luz del Sur, −0.001).
    #
    # El corte es por qué NEGOCIA la empresa, no por cómo se llama el ticker.
    # El archivo ya avisaba que el balde "extranjero" junta ETF globales con
    # ADR de empresas peruanas y que separarlos faltaba: se separa acá.
    LOCALES_NO_MINERAS = [
        'AENZAC1', 'ALICORC1', 'BACKUSI1', 'BBVAC1', 'CASAGRC1', 'CORAREI1',
        'CPACASC1', 'CREDITC1', 'ENGIEC1', 'FERREYC1', 'INRETC1', 'IPCHBC1',
        'LUSURC1', 'ORYGENC1', 'PLUZENC1', 'SIDERC1', 'UNACEMC1',
    ]
    GLOBALES = ['QQQ', 'SPY', 'VOO', 'EFA', 'EEM', 'XLK', 'SMH', 'IBIT', 'GLD',
                'EPU', 'ETFPERUD', 'ETFPESOV', 'PML', 'LQDA', 'FIBPRIME']
    ADR_PERUANOS = ['BAP', 'IFS', 'AUNA']
    OTRA_MINERA = ['MINSURI1']          # estaño y plata; no está en MAPA

    for nombre, lista in [
        ('CONTROL 1 · PERUANAS NO MINERAS — el control que vale', LOCALES_NO_MINERAS),
        ('CONTROL 2 · globales (ETF y GLD) — deberían moverse con el metal', GLOBALES),
        ('CONTROL 3 · ADR peruanos', ADR_PERUANOS),
        ('CONTROL 4 · Minsur, minera fuera del mapa', OTRA_MINERA),
    ]:
        examen({t: 'oro' for t in lista if t in C.SERIES}, nombre)
