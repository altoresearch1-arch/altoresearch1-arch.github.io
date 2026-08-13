"""SWITCH LAB RIO2 -> PPX — 13-ago-2026

Pregunta congelada, escrita ANTES de correr nada:

    «Si RIO está cerca de US$2.23 y PPX se puede comprar entre 0.160 y 0.165,
     ¿hay evidencia de que el cambio RIO -> PPX tenga mejor relación
     oportunidad/riesgo?»

QUÉ DEVUELVE Y QUÉ NO. Devuelve, dimensión por dimensión, qué parte de la
tesis está respaldada por evidencia MEDIDA, cuál está respaldada solo por
hechos declarados, y cuál no tiene muestra. NO devuelve una instrucción de
operar. Esa frontera está acá arriba a propósito: es la única parte del pedido
de Jair que este archivo no cumple, y conviene que se sepa antes de leer el
resultado en vez de descubrirlo al final.

═══════════════════════════════════════════════════════════════════════════
LA REGLA CONGELADA — escrita antes de mirar el resultado
═══════════════════════════════════════════════════════════════════════════

R-SWITCH · congelada 13-ago-2026

  CONDICIÓN: el ratio RIO/PPX (los dos en US$, misma rueda) está en el
  quintil SUPERIOR de su propia ventana móvil de 90 ruedas previas.
  Interpretación: RIO cara contra PPX en términos de su propia historia.

  ACCIÓN SIMULADA: vender RIO y comprar PPX ese cierre.

  MEDICIÓN: retorno relativo (PPX menos RIO) a 1, 5, 10 y 20 ruedas.

  ENTRENAMIENTO: hasta 2025-12-31.   EXAMEN: 2026 en adelante.
  El corte del quintil se fija con el entrenamiento y NO se toca.

  RIVAL: no es el cero. Son las otras ruedas — el retorno relativo medio de
  una rueda cualquiera. Ocho reglas del cementerio murieron por comparar
  contra el 50% en vez de contra la base propia.

  CORTE DE ÉXITO, declarado antes: la regla se llama FAVORABLE solo si en el
  EXAMEN el retorno relativo mediano supera al del control por más de la
  fricción medida del canje (costos + peaje de paridad), en al menos tres de
  las cuatro ventanas, y si ningún episodio suelto aporta más del 35%.

═══════════════════════════════════════════════════════════════════════════

LO QUE ESTE ARCHIVO NO PUEDE MEDIR, Y VA DICHO ARRIBA
· Los fundamentales entran como HECHOS DECLARADOS con su fuente y fecha, no
  como serie. No hay panel de NPI mensual ni de producción trimestral en el
  repo, así que no se pueden puntuar contra una base histórica. Se listan
  para el lector; no entran al score.
· RIO y PPX no están en `hechos.json` (RIO) ni en `bpa_historico.json`
  (ninguna). El eje de eventos corporativos no se puede automatizar.
· n de episodios es chico por construcción: dos acciones, 400 ruedas
  comunes. Cualquier resultado acá es indicio.

    python laboratorio/switch_rio_ppx.py
"""
import io
import json
import statistics as st
import sys

_stdout, sys.stdout = sys.stdout, io.StringIO()
sys.path.insert(0, 'laboratorio')
import cerebro as C  # noqa: E402,F401
sys.stdout = _stdout

H = json.load(open('app/src/data/historicos.json', encoding='utf-8'))['historicos']
ESP = json.load(open('app/src/data/espejos.json', encoding='utf-8'))['espejos']

CORTE_TRAIN = '2025-12-31'
VENTANA = 90
QUINTIL = 0.80          # quintil superior
HORIZONTES = (1, 5, 10, 20)
ESCENARIO_RIO = 2.23
ESCENARIO_PPX = (0.160, 0.1625, 0.165)
COSTO_LADO = 0.35       # supuesto declarado, igual que canje.py

REGISTRO = []           # toda variante probada queda acá (regla 5 de Jair)


def series():
    r = {f: p for f, p in H['RIO']['valores'] if p}
    p = {f: q for f, q in H['PPX']['valores'] if q}
    fs = sorted(set(r) & set(p))
    return fs, r, p


def episodios(fs, r, p, corte_quintil=None, solo=None):
    """Ruedas que cumplen la condición congelada. Devuelve (fechas, corte)."""
    rat = [r[f] / p[f] for f in fs]
    out = []
    cortes = []
    for i in range(VENTANA, len(fs)):
        vent = sorted(rat[i - VENTANA:i])
        c = vent[int(QUINTIL * (len(vent) - 1))]
        cortes.append(c)
        if solo and not solo(fs[i]):
            continue
        if rat[i] >= (corte_quintil if corte_quintil is not None else c):
            out.append(fs[i])
    return out, (st.median(cortes) if cortes else None)


def relativo(fs, r, p, f, h):
    """Retorno de PPX menos retorno de RIO, h ruedas después de f."""
    i = fs.index(f)
    if i + h >= len(fs):
        return None
    g = fs[i + h]
    return ((p[g] / p[f]) - (r[g] / r[f])) * 100


def resumen(fs, r, p, fechas, etiqueta, registrar=True):
    fila = {'variante': etiqueta, 'n': len(fechas)}
    print(f'\n  {etiqueta}  —  {len(fechas)} episodios')
    if not fechas:
        print('    sin episodios')
        return fila
    for h in HORIZONTES:
        v = [x for x in (relativo(fs, r, p, f, h) for f in fechas) if x is not None]
        if len(v) < 5:
            print(f'    {h:2d} ruedas:  muestra insuficiente (n={len(v)})')
            fila[f'h{h}'] = None
            continue
        pos = 100 * sum(1 for x in v if x > 0) / len(v)
        top = max(abs(x) for x in v) / sum(abs(x) for x in v) * 100
        print(f'    {h:2d} ruedas:  mediana {st.median(v):+7.2f}%   '
              f'a favor de PPX {pos:5.1f}%   n={len(v):3d}   '
              f'el mayor aporta {top:.0f}%')
        fila[f'h{h}'] = round(st.median(v), 3)
        fila[f'h{h}_pos'] = round(pos, 1)
    if registrar:
        REGISTRO.append(fila)
    return fila


def control_todas(fs, r, p, solo=None):
    return [f for f in fs[VENTANA:] if (solo is None or solo(f))]


def friccion():
    """Peaje real del canje: costos + paridad, con lo medido en espejos.json."""
    def ult(tk):
        rs = ESP[tk]['ruedas']
        f = max(rs)
        return rs[f]['desviacion_pct'], f
    dr, fr = ult('RIO')
    dp, fp = ult('PPX')
    return 2 * COSTO_LADO, dp - dr, fr, fp


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    fs, r, p = series()
    print('=' * 94)
    print('  SWITCH LAB RIO -> PPX   ·   regla congelada 13-ago-2026, corte escrito antes')
    print('=' * 94)
    print(f'  {len(fs)} ruedas comunes, {fs[0]} a {fs[-1]}')

    # ── 1. EL CORTE SE FIJA CON EL ENTRENAMIENTO Y NO SE TOCA ──────────────
    tr = [f for f in fs if f <= CORTE_TRAIN]
    rat_tr = sorted(r[f] / p[f] for f in tr)
    corte = rat_tr[int(QUINTIL * (len(rat_tr) - 1))]
    print(f'\n  CORTE fijado con el entrenamiento ({len(tr)} ruedas hasta {CORTE_TRAIN}):'
          f'  ratio >= {corte:.2f}')
    print(f'  ratio hoy: {r[fs[-1]]/p[fs[-1]]:.2f}   ->  '
          f'{"CUMPLE la condición" if r[fs[-1]]/p[fs[-1]] >= corte else "NO cumple"}')

    print('\n' + '─' * 94)
    print('  ENTRENAMIENTO (hasta 2025-12-31) — acá la regla no puede fallar, se la construyó')
    print('─' * 94)
    ep_tr, _ = episodios(fs, r, p, corte, lambda f: f <= CORTE_TRAIN)
    resumen(fs, r, p, ep_tr, 'REGLA · entrenamiento')
    resumen(fs, r, p, control_todas(fs, r, p, lambda f: f <= CORTE_TRAIN),
            'CONTROL · todas las ruedas del entrenamiento')

    print('\n' + '─' * 94)
    print('  EXAMEN (2026) — el único tramo que cuenta')
    print('─' * 94)
    ep_te, _ = episodios(fs, r, p, corte, lambda f: f > CORTE_TRAIN)
    r_regla = resumen(fs, r, p, ep_te, 'REGLA · examen 2026')
    r_ctrl = resumen(fs, r, p, control_todas(fs, r, p, lambda f: f > CORTE_TRAIN),
                     'CONTROL · todas las ruedas de 2026')

    print('\n' + '─' * 94)
    print('  CONTROLES QUE INTENTAN MATAR LA TESIS')
    print('─' * 94)
    if ep_te:
        for h in HORIZONTES:
            v = [(f, relativo(fs, r, p, f, h)) for f in ep_te]
            v = [(f, x) for f, x in v if x is not None]
            if len(v) < 6:
                continue
            sv = sorted(v, key=lambda t: t[1])
            sin_mej = [x for _f, x in sv[:-1]]
            sin_peo = [x for _f, x in sv[1:]]
            print(f'    {h:2d} ruedas · sin el mejor caso: mediana {st.median(sin_mej):+.2f}%'
                  f'   · sin el peor: {st.median(sin_peo):+.2f}%')
        REGISTRO.append({'variante': 'sin mejor / sin peor', 'n': len(ep_te)})

    # placebo: mismas cantidades de episodios, fechas corridas
    print()
    # El placebo se corre HACIA ATRÁS. La primera versión lo corría hacia
    # adelante y devolvía cero episodios en las tres variantes: los del examen
    # están al final de la serie y sumarles ruedas se sale del archivo. Un
    # control que no corre no es un control que pasa — queda anotado porque la
    # regla 6 dice que las pruebas que fallan se muestran.
    for desp in (7, 23, 61):
        idx = [fs.index(f) for f in ep_te]
        pl = [fs[i - desp] for i in idx if i - desp >= VENTANA]
        resumen(fs, r, p, pl, f'PLACEBO · las mismas fechas corridas -{desp} ruedas')

    # ── 2. LA FRICCIÓN REAL, QUE ES EL RIVAL VERDADERO ─────────────────────
    costos, peaje, fr, fp = friccion()
    print('\n' + '─' * 94)
    print('  LA FRICCIÓN DEL CANJE — el número que la regla tiene que superar')
    print('─' * 94)
    print(f'    costos de las dos patas (supuesto {COSTO_LADO}%/lado): {costos:.2f}%')
    print(f'    peaje de paridad al último dato guardado ({fr}): {peaje:+.2f}%')
    print(f'    umbral a superar: {costos + max(0.0, peaje):.2f}%')

    # ── 3. EL ESCENARIO DE JAIR ────────────────────────────────────────────
    print('\n' + '─' * 94)
    print(f'  ESCENARIO: vender RIO a {ESCENARIO_RIO} · comprar PPX en el rango')
    print('─' * 94)
    print(f'    {"PPX":>8s} {"PPX por RIO":>12s} {"indiferencia":>13s}   '
          f'{"PPX debe rendir más que RIO":>28s}')
    for pp in ESCENARIO_PPX:
        ratio = ESCENARIO_RIO / pp
        umbral = costos + max(0.0, peaje)
        indif = pp * (1 + umbral / 100)
        print(f'    {pp:8.4f} {ratio:12.2f} {indif:13.4f}   {umbral:27.2f}%')
    print('\n    «Indiferencia» = a qué precio tiene que estar PPX para que el canje')
    print('    empate, si RIO se queda quieta. No es un objetivo, es el punto muerto.')

    # ── 4. REGISTRO REPRODUCIBLE ───────────────────────────────────────────
    print('\n' + '─' * 94)
    print('  REGISTRO DE VARIANTES PROBADAS (regla 5: nada de cherry-picking)')
    print('─' * 94)
    for f in REGISTRO:
        print('   ', json.dumps(f, ensure_ascii=False))
    print(f'\n  Total de variantes corridas: {len(REGISTRO)}.'
          f'  Bonferroni sobre {len(REGISTRO)} pruebas: un p de 0.05 pasa a '
          f'{0.05/max(1,len(REGISTRO)):.4f}.')
