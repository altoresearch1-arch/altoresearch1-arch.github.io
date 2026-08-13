"""RESOLVER LA BITÁCORA DIRECCIONAL — 11-ago-2026

`direccional.py anotar` escribe la apuesta ANTES de la rueda. Este archivo la
puntúa DESPUÉS, y solo después. Es la mitad que faltaba: sin esto la bitácora
acumula predicciones que nadie contrasta, que es peor que no tenerla — da la
sensación de rigor sin el rigor.

TRES REGLAS QUE NO SE NEGOCIAN

1. NO SE REESCRIBE UNA APUESTA. Solo se rellena `subio`, que nació en null. Si
   una fila ya está resuelta, se saltea. Una apuesta editable después del
   resultado no es una apuesta.

2. SE PUNTÚA CON BRIER, NO CON TASA DE ACIERTO. Un lector honesto no es el que
   más acierta: es el que cuando dice 70% acierta 70%. La tasa de acierto
   premia al que siempre dice "sube" en un mercado alcista.

3. EL RIVAL ES LA BASE DE CADA ACCIÓN, no el 50%. Es la misma vara del examen
   de `direccional.py` y la razón por la que ocho reglas están en el cementerio.

DÍAS SIN NEGOCIAR: si el precio no se movió, la rueda no dejó dato y la fila
queda SIN RESOLVER, no como "no subió". Contar un día sin negociar como fallo
inventaría un resultado que nunca ocurrió.

DOS EXCLUSIONES, agregadas el 13-ago-2026. Se MARCAN en la fila y se saltean al
puntuar; no se borran ni se recalculan. Reescribir una apuesta vieja con datos
nuevos es exactamente lo que la regla 1 prohíbe, así que la fila mala se queda
donde está con su motivo escrito, igual que una regla del cementerio.

· `dato_malo`: la apuesta se calculó con un cierre de metal que resultó ser un
  precio intradía. `fetch_metales.py` grababa la rueda en curso como si fuera
  la settlement y el primer valor visto quedaba congelado. Afecta a las 15
  filas cuyo insumo fue el 10-ago (oro anotado +2.315%, real +0.486%) y el
  12-ago (oro anotado +1.962%, real +0.591%). Las dos se escribieron como si
  el metal hubiera pasado el corte de 1% y ninguna lo pasó.

· `fuera_universo`: RIO y PPX no hacen precio en Lima, lo copian de Toronto
  convertido a dólares. El corte está en REGLAS_CONGELADAS.md, sección R8 del
  13-ago-2026. Sus apuestas quedan como registro pero no puntúan.
"""
import io
import json
import os
import sys
from datetime import datetime, timedelta, timezone

_stdout, sys.stdout = sys.stdout, io.StringIO()
sys.path.insert(0, 'laboratorio')
import cerebro as C  # noqa: E402
sys.stdout = _stdout

RUTA = 'laboratorio/bitacora_direccional.jsonl'


def cargar():
    if not os.path.exists(RUTA):
        return []
    with open(RUTA, encoding='utf-8') as f:
        return [json.loads(l) for l in f if l.strip()]


def guardar(filas):
    with open(RUTA, 'w', encoding='utf-8') as f:
        for r in filas:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')


def movimiento(t, rueda):
    """El movimiento de esa acción EN esa rueda. None si no hay dato."""
    v = C.SERIES.get(t) or []
    for i in range(1, len(v)):
        if v[i][0] == rueda:
            m = C.mov(v, i)
            return None if m is None or abs(m) < 1e-9 else m
    return None


def brier(pares):
    return sum((p - (1 if s else 0)) ** 2 for p, s in pares) / len(pares)


def resolver():
    filas = cargar()
    nuevas = 0
    pend = {}
    # LA RUEDA DE HOY NO SE RESUELVE (13-ago-2026). historicos.json se refresca
    # cada 10 minutos con el mercado abierto, así que resolver hoy puntúa contra
    # un precio de media rueda y lo deja grabado — `subio` nace null pero una vez
    # escrito no se vuelve a tocar. Es el mismo error que envenenó la serie del
    # metal, del otro lado del registro. Se espera al cierre.
    hoy = datetime.now(timezone(timedelta(hours=-5))).strftime('%Y-%m-%d')
    for r in filas:
        if r.get('subio') is not None:
            continue
        if r['rueda'] >= hoy:
            pend.setdefault(r['rueda'], []).append(r['ticker'] + ' (rueda en curso)')
            continue
        m = movimiento(r['ticker'], r['rueda'])
        if m is None:
            pend.setdefault(r['rueda'], []).append(r['ticker'])
            continue
        r['subio'] = m > 0
        r['mov'] = round(m, 3)
        nuevas += 1
    guardar(filas)
    print(f'  resueltas {nuevas} filas nuevas · {len(filas)} en la bitácora')
    for rueda, ts in sorted(pend.items()):
        print(f'  pendiente {rueda}: {len(ts)} sin dato — {", ".join(sorted(ts))}')
    return filas


def puntuable(r):
    """Se resuelve todo; se PUNTÚA solo lo limpio y dentro del universo de R8."""
    return not r.get('dato_malo') and not r.get('fuera_universo')


def examen(filas):
    resueltas = [r for r in filas if r.get('subio') is not None]
    hechas = [r for r in resueltas if puntuable(r)]
    fuera = len(resueltas) - len(hechas)
    if fuera:
        malo = sum(1 for r in resueltas if r.get('dato_malo'))
        esp = sum(1 for r in resueltas if r.get('fuera_universo') and not r.get('dato_malo'))
        print(f'\n  excluidas del puntaje: {fuera}'
              f'  ({malo} por dato_malo, {esp} por fuera_universo)')
    if not hechas:
        print('\n  todavía no hay filas resueltas y puntuables')
        return
    real = [(r['p'], r['subio']) for r in hechas]
    base = [(r['base'], r['subio']) for r in hechas]
    ac = sum(1 for r in hechas if (r['p'] > 0.5) == r['subio'])

    print('\n' + '=' * 72)
    print(f'  EXAMEN DE LA BITÁCORA — {len(hechas)} apuestas resueltas')
    print('=' * 72)
    print(f'\n  acierto de dirección : {ac}/{len(hechas)}  ({100*ac/len(hechas):.1f}%)')
    print(f'  Brier del lector     : {brier(real):.4f}')
    print(f'  Brier de la base     : {brier(base):.4f}   ← el rival')
    print(f'  ganancia             : {brier(base)-brier(real):+.5f}')

    hablo = [r for r in hechas if r.get('habla')]
    if hablo:
        a = sum(1 for r in hablo if (r['p'] > 0.5) == r['subio'])
        print(f'\n  cuando HABLA: {a}/{len(hablo)} ({100*a/len(hablo):.1f}%)')

    print('\n  ── por rueda ' + '─' * 56)
    for rueda in sorted({r['rueda'] for r in hechas}):
        g = [r for r in hechas if r['rueda'] == rueda]
        a = sum(1 for r in g if (r['p'] > 0.5) == r['subio'])
        print(f'    {rueda}:  {a}/{len(g)}')

    print('\n  ── detalle ' + '─' * 58)
    for r in sorted(hechas, key=lambda x: (x['rueda'], x['ticker'])):
        ok = '✓' if (r['p'] > 0.5) == r['subio'] else '✗'
        print(f'    {r["rueda"]}  {r["ticker"]:10s} dijo {100*r["p"]:5.1f}%'
              f'  movió {r.get("mov", 0):+6.2f}%   {ok}')

    print('\n  RECORDATORIO: con menos de ~100 apuestas esto es anécdota, no examen.')
    print('  El examen formal de direccional.py corre sobre 1,244 lecturas.')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    examen(resolver())
