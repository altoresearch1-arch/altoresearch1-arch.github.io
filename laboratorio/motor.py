# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════════════════
🔬 EL LABORATORIO — la parte de ALTO que NO es para la app.

QUÉ ES. Un banco de pruebas para una sola pregunta: «esta situación, ¿vino
seguida de algo distinto a un día cualquiera?». No predice y no recomienda:
toma una regla escrita por vos, la corre sobre los 19 meses de cierres que el
robot ya baja, y te dice si aguanta o si se cae.

POR QUÉ VIVE FUERA DE app/. La app tiene la Regla de Oro (#29: muestra, no
recomienda) y es pública. Esto es un instrumento personal de Jair, y su salida
—«esta acción está en la zona»— es exactamente lo que la app no debe decir.
Por eso no se importa desde app/src, no entra al bundle y no tiene pantalla.

LAS CUATRO REGLAS DE LA CASA (romper una es engañarse solo)
  1. Ninguna cuenta usa un dato posterior al día que evalúa.
  2. Se entrena hasta CORTE y se juzga DESPUÉS de CORTE. Lo que solo funciona
     antes del corte, no funciona.
  3. La vara no es ganar plata: es ganarle a comprar cualquier cosa cualquier
     día. Ese piso se calcula y se imprime siempre.
  4. Los costos entran siempre, y el spread también. Una ventaja de 0.3% con
     0.6% de comisión es una pérdida disfrazada.

LO QUE YA SE MIDIÓ ACÁ (6-ago-2026) — el detalle está en README.md:
  · 13 de 15 señales se INVIERTEN fuera de muestra. Entrenar en un tramo
    alcista le enseña a cualquier señal a decir «que suba».
  · Sobrevive una: la caída fuerte de corto plazo rebota. −5% en 3 ruedas →
    +2.49% neto a 10 ruedas, 63% de aciertos, en 37 acciones distintas, y
    funciona en los DOS tramos.
  · Y el EEFF va al revés: cuando la caída la causó el estado financiero, el
    precio SIGUE bajando (−6.47% a 15 ruedas, solo 13% recuperó). Por eso el
    motor excluye las ventanas pegadas a un EEFF.
═══════════════════════════════════════════════════════════════════════════════
"""
import json, os, sys, statistics as st
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

RAIZ  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATOS = os.path.join(RAIZ, 'app', 'src', 'data')

# ── perillas ─────────────────────────────────────────────────────────────
CORTE  = '2026-01-31'   # entrena hasta acá; el resto es examen a ciegas
COSTO  = 0.60           # % ida y vuelta: comisión SAB + BVL + Cavali (retail)
SPREAD = 1.00           # % ida y vuelta que se come la punta. NO está en el
                        # archivo: los cierres mienten sobre a qué precio se
                        # compra de verdad una acción que acaba de caer 8%.
HORIZ  = 10             # ruedas que dura la posición (~2 semanas de calendario)


def cargar(nombre):
    with open(os.path.join(DATOS, nombre), encoding='utf-8') as f:
        return json.load(f)


def series_negociadas():
    """Solo las que SE NEGOCIAN. La BVL repite el último cierre cuando nadie
    operó: en las dormidas, el 'movimiento' es de un día viejo. El filtro no se
    inventa acá — fetch_historicos.py ya marca `pocoNegociada`."""
    hist = cargar('historicos.json')['historicos']
    out = {}
    for t, v in hist.items():
        if v.get('pocoNegociada') or not v.get('valores'):
            continue
        vals = sorted(v['valores'])
        if len(vals) >= 120:
            out[t] = vals
    return out


def series_frescas():
    """La serie oficial, y APARTE el precio de la punta del día.

    NO SE EMPALMAN, Y ESA ES TODA LA GRACIA. Los dos archivos vienen de dos
    endpoints distintos de la BVL que no miden lo mismo:

      · historicos.json ← /share-values : el CIERRE OFICIAL del día (la BVL lo
        calcula, no es la última operación). Publica con UN DÍA de atraso.
      · precios.json    ← /stock-quote/market : `last`, la ÚLTIMA OPERACIÓN
        realmente transada. Está al día.

    Medido el 7-ago-2026 sobre la misma fecha (2026-08-05) y las 44 acciones
    que negociaron: **43 de 44 dan distinto**, mediana 0.92% de diferencia y
    máximo 13.45% (RIO). No es ruido de redondeo, son dos cantidades distintas.

    Pegar el segundo al final del primero ponía la ÚLTIMA rueda —la única que
    mira quien va a decidir algo— en otra escala que las 300 anteriores. En
    Nexa el 5-ago eso inventó un +2.55% y un techo de 3 meses donde el cierre
    oficial dice +0.07% y −2.24% bajo el techo. Con una ventaja medida de
    +1.47% neto a 10 ruedas, un error de 0.92% en el precio de entrada no es un
    detalle: es la mitad de la ventaja.

    Devuelve (series, ultimos). `ultimos[t]` = el precio de la punta cuando es
    MÁS NUEVO que el último cierre oficial, para imprimirlo al lado, con su
    fuente y su fecha, y nunca dentro de la serie.
    """
    series = series_negociadas()
    precios = cargar('precios.json')['precios']
    ultimos = {}
    for t, vals in series.items():
        p = precios.get(t)
        if not p or not p.get('encontrado') or p.get('sinNegociacionReciente'):
            continue
        f, precio = p.get('fecha'), p.get('precio')
        if f and precio and f > vals[-1][0]:
            # La variación del día se calcula contra `previo`, que viene del
            # MISMO endpoint. Contra el cierre oficial daría un número mezclado
            # —para Nexa el 7-ago, +6.91% en vez de +4.34%— que es exactamente
            # el error que esta función existe para evitar.
            prev = p.get('previo')
            ultimos[t] = {'fecha': f, 'precio': precio, 'previo': prev,
                          'var': (precio / prev - 1) * 100 if prev else None,
                          'hora': (p.get('ultimaOperacion') or '')[11:16],
                          'oficial': vals[-1]}
    return series, ultimos


def familia(h):
    """A qué clase de evento pertenece un Hecho de Importancia.

    Vive acá y no en eventos.py porque `fechas_eeff()` necesita exactamente la
    misma respuesta: cuando eran dos listas de palabras separadas, un EEFF podía
    entrar al estudio de eventos y NO a la exclusión del panel.

    EL TÍTULO NO ES CONFIABLE EL DÍA DEL EVENTO. La SMV publica el Hecho con
    `titulo` vacío y lo completa horas o días después —el 5-ago-2026 los dos
    EEFF de Nexa y el de Atacocha eran los ÚNICOS 3 sin título de 421—. Con el
    título vacío el EEFF caía en «otros», familia cuya tasa base es POSITIVA
    (+1.15% a 15r, 58% en verde) cuando la del EEFF es negativa. O sea: el único
    día en que la ficha de verdad se usa, mostraba el signo cambiado.
    Por eso, cuando el título no dice nada, manda la CATEGORÍA."""
    t = (h.get('titulo') or '').lower()
    c = (h.get('categoria') or '').lower()
    if 'financiera intermedia' in t or 'estados financieros' in t or 'discusi' in t:
        return 'EEFF trimestral'
    # La «presentación corporativa sobre resultados del 2do. Trimestre» es el
    # mismo evento con otro nombre: la empresa contando su trimestre. Sin esta
    # línea caía en «otros» (n=194, tasa base positiva) y la ficha mostraba la
    # tasa base equivocada justo en el día que más importa.
    if 'resultados' in t and ('trimestre' in t or 'trimestral' in t):
        return 'EEFF trimestral'
    if 'financiera anual auditada' in t or 'memoria anual' in t:
        return 'EEFF anual'
    if 'dividendo' in t or 'utilidades' in c or 'dividendos' in c:
        return 'dividendo / utilidades'
    if 'producci' in t:
        return 'producción'
    if 'junta' in c or 'convocatoria' in t or 'acuerdos de j' in t:
        return 'junta de accionistas'
    if 'directorio' in c or 'gerencia' in c:
        return 'cambio en el directorio'
    if 'clasificaci' in c:
        return 'clasificación de riesgo'
    if 'huelga' in c or 'paraliza' in t:
        return 'huelga / paralización'
    if 'emisi' in c or 'valores por oferta' in c:
        return 'emisión de valores'
    # El Reporte de Buen Gobierno se presenta bajo la categoría de aprobación de
    # información financiera y no es un EEFF: se descarta antes del respaldo.
    if 'buen gobierno' in t:
        return 'otros'
    if 'aprobaci' in c and 'informaci' in c and 'financiera' in c:
        return 'EEFF anual' if ('auditad' in t or 'ejercicio' in t) else 'EEFF trimestral'
    return 'otros'


def fechas_eeff():
    """Cuándo publicó cada empresa un estado financiero. Se usa para EXCLUIR:
    una caída con EEFF de por medio es otra bestia y no rebota igual."""
    hechos = cargar('hechos.json')['hechos']
    out = {}
    for t, ficha in hechos.items():
        fs = {h['fecha'] for h in ficha.get('hechos', [])
              if familia(h) in ('EEFF trimestral', 'EEFF anual')}
        if fs:
            out[t] = sorted(fs)
    return out


pct = lambda a, b: (a / b - 1) * 100 if b else 0.0


def rsi(rets):
    g = sum(r for r in rets if r > 0) / len(rets)
    p = sum(-r for r in rets if r < 0) / len(rets)
    return 100 - 100 / (1 + g / p) if p else 100.0


def construir_panel(series=None, eeff=None, horiz=HORIZ, con_futuro=True):
    """Una fila por (acción, rueda). `con_futuro=False` deja también las ruedas
    del final que todavía no tienen desenlace — eso es lo que mira hoy.py."""
    series = series or series_negociadas()
    eeff   = eeff if eeff is not None else fechas_eeff()
    filas  = []
    for t, vals in series.items():
        precios = [p for _, p in vals]
        fechas  = [f for f, _ in vals]
        tope = len(vals) - horiz if con_futuro else len(vals)
        for i in range(60, tope):
            ventana, p = precios[i - 60:i + 1], precios[i]
            if not p or 0 in ventana[-21:]:
                continue
            rets20 = [pct(ventana[k], ventana[k - 1]) for k in range(41, 61)]
            cambios = sum(1 for r in rets20 if abs(r) > 1e-9)
            if cambios < 10:      # dormida: su precio es un eco, no un precio
                continue
            vol20 = st.pstdev(rets20) or 0.01
            # ¿hubo un EEFF en las últimas `horiz` ruedas? entonces la caída
            # no es ruido, es noticia — y la noticia no rebota.
            desde = fechas[max(0, i - horiz)]
            hay_eeff = any(desde <= f <= fechas[i] for f in eeff.get(t, []))
            hay_futuro = i + horiz < len(vals)
            filas.append({
                't': t, 'f': fechas[i], 'p': p,
                'mom1':  pct(p, precios[i - 1]),
                'mom3':  pct(p, precios[i - 3]),
                'mom5':  pct(p, precios[i - 5]),
                'mom10': pct(p, precios[i - 10]),
                'mom20': pct(p, precios[i - 20]),
                'vol20': vol20,
                'rsi14': rsi([pct(ventana[k], ventana[k - 1]) for k in range(47, 61)]),
                'dd60':  pct(p, max(ventana)),
                'liq':   cambios,
                'eeff':  hay_eeff,
                'fwd':   pct(precios[i + horiz], p) if hay_futuro else None,
                'fwd5':  pct(precios[i + 5], p) if i + 5 < len(vals) else None,
            })
    # lo que hizo la bolsa entera ese día: sin esto, una señal solo aprende a
    # decir «que suba» cuando el tramo de entrenamiento fue alcista
    pordia = defaultdict(list)
    for r in filas:
        pordia[r['f']].append(r)
    for rs in pordia.values():
        conf = [r['fwd'] for r in rs if r['fwd'] is not None]
        medf = st.median(conf) if conf else 0.0
        for r in rs:
            r['fwd_rel'] = (r['fwd'] - medf) if r['fwd'] is not None else None
    return filas


# ── operar una regla sin ventanas pisadas ────────────────────────────────
def operaciones(filas, series, regla, horiz=HORIZ):
    """Una posición a la vez por acción. Sin esto, la misma caída se cuenta
    tres veces y cualquier resultado se infla."""
    idxs = {t: [f for f, _ in v] for t, v in series.items()}
    ops, libre = [], defaultdict(str)
    for r in sorted(filas, key=lambda x: x['f']):
        if r['f'] < libre[r['t']] or r['fwd'] is None or not regla(r):
            continue
        ops.append(r)
        idx = idxs[r['t']]
        libre[r['t']] = idx[min(idx.index(r['f']) + horiz, len(idx) - 1)]
    return ops


def evaluar(nombre, ops, costo=COSTO, spread=SPREAD):
    if len(ops) < 15:
        return f'  {nombre:<34} {len(ops):>4} ops — muy pocas para decir nada'
    v = [o['fwd'] for o in ops]
    neto = st.mean(v) - costo - spread
    portk = defaultdict(list)
    for o in ops:
        portk[o['t']].append(o['fwd'])
    top1 = 100 * max(sum(x) for x in portk.values()) / sum(v) if sum(v) else 0
    return (f'  {nombre:<34} {len(ops):>4} ops  bruto {st.mean(v):+6.2f}%  '
            f'mediana {st.median(v):+6.2f}%  gana {100*sum(1 for x in v if x>0)/len(v):>3.0f}%  '
            f'NETO {neto:+6.2f}%  | {len(portk):>2} acciones, la mayor aporta {top1:>3.0f}%')


# ── las reglas que hay sobre la mesa ─────────────────────────────────────
REGLAS = {
    'piso: comprar cualquier cosa':   lambda r: True,
    'cayó −3% en 3 ruedas':           lambda r: r['mom3'] <= -3,
    'cayó −5% en 3 ruedas':           lambda r: r['mom3'] <= -5,
    'cayó −8% en 3 ruedas':           lambda r: r['mom3'] <= -8,
    'cayó −5%, SIN EEFF de por medio': lambda r: r['mom3'] <= -5 and not r['eeff'],
    'cayó −5%, CON EEFF de por medio': lambda r: r['mom3'] <= -5 and r['eeff'],
    'rsi14 < 30':                     lambda r: r['rsi14'] < 30,
    'subió +5% en 3 ruedas':          lambda r: r['mom3'] >= 5,
}


def informe():
    series = series_negociadas()
    filas  = construir_panel(series)
    tr = [r for r in filas if r['f'] <= CORTE]
    te = [r for r in filas if r['f'] > CORTE]
    print(f'PANEL  {len(filas)} filas · {len(series)} acciones · '
          f'{filas[0]["f"]} → {filas[-1]["f"]}')
    print(f'ENTRENA {len(tr)} (≤{CORTE})   EXAMEN {len(te)} (>{CORTE})')
    print(f'horizonte {HORIZ} ruedas · costo {COSTO}% · spread {SPREAD}%\n')
    for nombre, regla in REGLAS.items():
        print(f'── {nombre} ──')
        for tramo, rs in (('entrena', tr), ('EXAMEN ', te)):
            print(f'  {tramo}' + evaluar('', operaciones(rs, series, regla))[2:])
    print('\nLeer así: una regla vale cuando ENTRENA y EXAMEN dicen lo mismo, la')
    print('mediana acompaña a la media, y ninguna acción sola pone más del ~35%.')


if __name__ == '__main__':
    informe()
