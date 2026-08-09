# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════════════════
📅 HOY — quién está parado en una situación que el laboratorio ya midió.

No dice comprar ni vender. Dice: «esta acción está hoy en la misma situación
que N veces antes; de esas N, tantas subieron y tantas bajaron». La tasa base
va pegada a cada nombre, y el número que manda es el NETO — el bruto es una
ilusión que no descuenta comisión ni punta.

Corre después del robot de precios:  python laboratorio/hoy.py
═══════════════════════════════════════════════════════════════════════════════
"""
import sys, statistics as st
from motor import (cargar, series_frescas, fechas_eeff, construir_panel,
                   operaciones, REGLAS, CORTE, COSTO, SPREAD, HORIZ)

sys.stdout.reconfigure(encoding='utf-8')

# `series_frescas()` vivía duplicada acá y en motor.py. Dos copias de la misma
# función es dos sitios donde arreglar el mismo error: el empalme de precios de
# dos endpoints distintos se arregló en motor.py y acá seguía intacto.


def tasas_base(filas, series):
    """La tasa base de cada regla, medida SOLO en el examen — el tramo que
    ninguna regla vio cuando se escribió."""
    te = [r for r in filas if r['f'] > CORTE and r['fwd'] is not None]
    out = {}
    for nombre, regla in REGLAS.items():
        ops = operaciones(te, series, regla)
        if len(ops) < 15:
            continue
        v = [o['fwd'] for o in ops]
        out[nombre] = {
            'n': len(ops), 'media': st.mean(v), 'mediana': st.median(v),
            'gana': 100 * sum(1 for x in v if x > 0) / len(v),
            'neto': st.mean(v) - COSTO - SPREAD,
        }
    return out


def main():
    series, ultimos = series_frescas()
    eeff = fechas_eeff()
    filas = construir_panel(series, eeff, con_futuro=False)
    base = tasas_base(filas, series)

    ultima = {}
    for r in filas:
        if r['t'] not in ultima or r['f'] > ultima[r['t']]['f']:
            ultima[r['t']] = r
    dia = max(r['f'] for r in ultima.values())

    print(f'╔{"═"*76}╗')
    print(f'║ 📅 ÚLTIMO CIERRE OFICIAL {dia}   ·   {len(ultima)} acciones negociadas'
          f'{" "*20}║')
    print(f'╚{"═"*76}╝')
    print(f'   costo {COSTO}% + spread supuesto {SPREAD}% · horizonte {HORIZ} ruedas '
          f'(~2 semanas)')
    if ultimos:
        f_nueva = max(u['fecha'] for u in ultimos.values())
        print(f'   ⓘ  la BVL ya transó el {f_nueva} en {len(ultimos)} acciones, pero ese')
        print(f'      precio es la ÚLTIMA OPERACIÓN y la serie son CIERRES OFICIALES:')
        print(f'      difieren en 43 de 44 casos (mediana 0.92%, máx 13.45%). No se')
        print(f'      mezclan. El escáner va una rueda atrás y es a propósito.')
    print()

    print('── LA TASA BASE, medida fuera de muestra (feb–jul 2026) ──')
    for nom, b in sorted(base.items(), key=lambda x: -x[1]['neto']):
        print(f'   {nom:<34} n={b["n"]:>3}  gana {b["gana"]:>3.0f}%  '
              f'mediana {b["mediana"]:+5.2f}%  NETO {b["neto"]:+5.2f}%')

    print(f'\n── QUIÉN ESTÁ HOY EN CADA SITUACIÓN ──')
    ZONAS = [
        ('cayó −8% en 3 ruedas', lambda r: r['mom3'] <= -8),
        ('cayó −5% en 3 ruedas', lambda r: -8 < r['mom3'] <= -5),
        ('cayó −3% en 3 ruedas', lambda r: -5 < r['mom3'] <= -3),
        ('rsi14 < 30',           lambda r: r['rsi14'] < 30 and r['mom3'] > -3),
        ('subió +5% en 3 ruedas', lambda r: r['mom3'] >= 5),
    ]
    vacio = True
    for nom, cond in ZONAS:
        dentro = sorted([r for r in ultima.values() if cond(r)], key=lambda r: r['mom3'])
        if not dentro:
            continue
        vacio = False
        b = base.get(nom)
        cabecera = (f'   ▸ {nom}   →   histórico: gana {b["gana"]:.0f}% de las veces, '
                    f'mediana {b["mediana"]:+.2f}%, neto {b["neto"]:+.2f}% (n={b["n"]})'
                    if b else f'   ▸ {nom}   →   sin tasa base medida')
        print(cabecera)
        for r in dentro:
            aviso = '  ⚠ EEFF reciente: acá el rebote NO aparece' if r['eeff'] else ''
            print(f'      {r["t"]:<10} S/{r["p"]:<7.3f} 3r {r["mom3"]:+6.2f}%  '
                  f'10r {r["mom10"]:+6.2f}%  rsi {r["rsi14"]:>3.0f}  '
                  f'vol diaria {r["vol20"]:.1f}%{aviso}')
        print()
    if vacio:
        print('   ninguna acción está hoy en una situación medida. '
              'Es el resultado más común y no hay que forzarlo.\n')

    print('─' * 78)
    print('Esto no es una recomendación: es la tasa base de situaciones parecidas.')
    print('La tasa base es del PROMEDIO de esas veces — ninguna operación suelta se')
    print('parece al promedio. Y el spread real de una acción que acaba de caer 8%')
    print(f'puede ser mayor que el {SPREAD}% supuesto acá; si pasa de ~3%, la ventaja muere.')


if __name__ == '__main__':
    main()
