# -*- coding: utf-8 -*-
"""¿EL VOLUMEN DE LA PLAZA EXTRANJERA MEJORA LA SEÑAL LOCAL?

Propuesta de un tercero: en un papel ilíquido local, el shock de información se
ve primero en la plaza líquida. Si el volumen de afuera confirma la caída de
acá, la señal debería fallar menos.

CRITERIO CONGELADO ANTES DE MIRAR UN SOLO DATO. Esto es lo único que hace que
la prueba valga algo:
  · eventos    = caída de 5% a 8% en la plaza LOCAL (BVL)
  · acciones   = RIO, PPX, BVN, y solo estas. Son las únicas donde el mapeo
                 local↔exterior es directo. NEXA en NYSE es la MATRIZ (Nexa
                 Resources S.A.), no Nexa Perú (ex-Milpo): otra empresa, otros
                 estados financieros. Volcan no tiene listado exterior.
  · "confirma" = volumen de la plaza extranjera ≥ 1.5× su promedio de las 20
                 ruedas previas, en la fecha del evento (o la última rueda
                 extranjera anterior si esa plaza no abrió ese día)
  · resultado  = retorno local del cierre de t+1 al de t+6, la regla congelada
  · aprueba si = el grupo confirmado le gana a la base Y p < 0.05

El p se calcula barajando QUIÉN estaba confirmado, no los retornos: así se
mantiene la estructura de los eventos y solo se rompe la relación que se prueba.

Los datos están en eventos_adr.csv (volumen exterior de Yahoo Finance:
RIO.TO, PPX.V, BVN). El archivo se deja fijo a propósito — la prueba tiene que
poder repetirse sin depender de que la red conteste igual.
"""
import csv, random, statistics as st, sys
sys.stdout.reconfigure(encoding='utf-8')
random.seed(20260808)

UMBRAL = 1.5
BARAJADAS = 10000

with open('laboratorio/eventos_adr.csv', encoding='utf-8') as f:
    ev = [{'tk': r['ticker'], 'fecha': r['fecha'],
           'caida': float(r['caida_local_pct']),
           'ratio': float(r['ratio_volumen_exterior']),
           'res': float(r['retorno_5r_pct'])} for r in csv.DictReader(f)]

for e in ev:
    e['confirma'] = e['ratio'] >= UMBRAL
    e['acierto'] = e['res'] > 0          # el resultado 0.00 cuenta como fallo

def resumen(sub):
    if not sub:
        return None
    res = [e['res'] for e in sub]
    k = sum(1 for e in sub if e['acierto'])
    return {'n': len(sub), 'aciertos': k, 'fallos': len(sub) - k,
            'tasa': 100 * k / len(sub), 'error': 100 * (len(sub) - k) / len(sub),
            'mediana': st.median(res), 'media': st.mean(res)}

base = resumen(ev)
conf = resumen([e for e in ev if e['confirma']])
nocf = resumen([e for e in ev if not e['confirma']])

print('=' * 78)
print('  FILTRO DE VOLUMEN EXTRANJERO — criterio congelado antes de mirar')
print('=' * 78)
print(f'\n  {"grupo":24s} {"n":>3s} {"acierto":>8s} {"error":>7s} {"mediana":>9s} {"media":>8s}')
print('  ' + '-' * 62)
for et, d in [('TODAS (base)', base), ('el exterior CONFIRMA', conf), ('el exterior NO confirma', nocf)]:
    print(f'  {et:24s} {d["n"]:3d} {d["tasa"]:7.1f}% {d["error"]:6.1f}% '
          f'{d["mediana"]:+8.2f}% {d["media"]:+7.2f}%')

real = conf['tasa'] - base['tasa']
etiquetas = [e['confirma'] for e in ev]
aciertos = [e['acierto'] for e in ev]
peores = 0
for _ in range(BARAJADAS):
    random.shuffle(etiquetas)
    sel = [a for a, c in zip(aciertos, etiquetas) if c]
    if (100 * sum(sel) / len(sel) - base['tasa']) >= real:
        peores += 1
p = peores / BARAJADAS

print(f'\n  Mejora del grupo confirmado sobre la base: {real:+.1f} puntos de acierto')
print(f'  p por permutación ({BARAJADAS:,} barajadas):      {p:.4f}')
print('\n  ' + '-' * 62)
if real > 0 and p < 0.05:
    print('  VEREDICTO: APROBADO. El volumen de afuera separa las señales.')
else:
    print('  VEREDICTO: RECHAZADO. La mejora no supera al azar.')
    print('  Se archiva y NO entra al cerebro.')

print('\n  Por acción (cuántos eventos confirmó el exterior):')
for tk in ('RIO', 'PPX', 'BVN'):
    sub = [e for e in ev if e['tk'] == tk]
    c = [e for e in sub if e['confirma']]
    r = resumen(c)
    linea = f'    {tk:4s} {len(sub):2d} eventos, {len(c):2d} confirmados'
    if r:
        linea += f' -> acierto {r["tasa"]:.0f}%  mediana {r["mediana"]:+.2f}%'
    print(linea)
    print(f'         ratio de volumen exterior: mediana {st.median([e["ratio"] for e in sub]):.2f}x')
