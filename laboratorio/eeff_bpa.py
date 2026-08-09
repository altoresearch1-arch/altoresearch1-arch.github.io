# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════════════════
📊 ¿IMPORTA SI EL TRIMESTRE SALIÓ BUENO? — el EEFF cruzado con el BPA que traía.

    python laboratorio/eeff_bpa.py

LA PREGUNTA. La tasa base del EEFF trimestral es negativa (35% en verde a 15
ruedas, n=40), pero mete en la misma bolsa los trimestres buenos y los malos.
Si el mercado premia el buen resultado y castiga el malo, esa mezcla estaría
tapando dos poblaciones distintas — y sería la primera vez en este repo que el
contenido de un Hecho, y no solo su existencia, se puede contrastar contra el
precio.

CÓMO SE DEFINE «BUENO» SIN INVENTAR NADA. No hay consenso de analistas en
ninguna parte del repo, así que la sorpresa contra lo esperado NO se puede
medir. Lo que sí hay es `bpa_historico.json`. Entonces «bueno» = el BPA del
trimestre reportado contra el MISMO trimestre del año anterior. Es una
definición pobre —el mercado ya sabía parte de eso— pero es falsable y es la
única que los datos aguantan.

LA TRAMPA DEL CALENDARIO. Un EEFF publicado en agosto reporta el trimestre
cerrado en junio, no el que corre. Asociarlo al trimestre equivocado invierte
la mitad de los casos sin que se note. El mapeo va explícito abajo y se imprime
para que se pueda auditar.

LO QUE ESTO NO PUEDE SER. Con ~40 episodios repartidos en dos o tres celdas,
cualquier resultado tiene n de un dígito o de dos bajos. Va con prueba nula por
sorteo y con el n al lado, y si sale «indistinguible» esa es la respuesta —no
un paso previo a buscar una partición que sí funcione, que es como se fabrican
los 13 hallazgos que ya se cayeron acá.
═══════════════════════════════════════════════════════════════════════════════
"""
import sys, random, statistics as st

from motor import cargar
from eventos import estudio, HORIZONTES, EEFF

sys.stdout.reconfigure(encoding='utf-8')
random.seed(7)
SORTEOS = 2000


def trimestre_reportado(fecha):
    """De la fecha de publicación al trimestre que reporta. Un EEFF de agosto
    trae el trimestre cerrado en junio."""
    a, m = int(fecha[:4]), int(fecha[5:7])
    if m in (4, 5, 6):
        return f'{a}-Q1'
    if m in (7, 8, 9):
        return f'{a}-Q2'
    if m in (10, 11, 12):
        return f'{a}-Q3'
    return f'{a-1}-Q4'          # ene-mar reporta el cierre del año anterior


def main():
    bpa = cargar('bpa_historico.json')['empresas']
    ev = [e for e in estudio() if e['completo'] and e['fam'] in EEFF]

    filas, sin_dato = [], 0
    for e in ev:
        q = trimestre_reportado(e['fecha'])
        tri = (bpa.get(e['t']) or {}).get('trimestres') or {}
        anio, qq = q.split('-')
        actual, previo = tri.get(q), tri.get(f'{int(anio)-1}-{qq}')
        if actual is None or previo is None:
            sin_dato += 1
            continue
        filas.append({**e, 'q': q, 'bpa': actual, 'bpa_ant': previo,
                      'delta': actual - previo})

    # UN TRIMESTRE REPORTADO = UN EPISODIO, aunque la empresa lo presente tres
    # veces. `estudio()` ya poda los duplicados que caen dentro de 5 ruedas,
    # pero acá aparecen separados por SEMANAS: individual en enero, auditado en
    # febrero, regularización en marzo — el mismo 2025-Q4 de Casa Grande, que
    # sin esta poda ponía 3 de 10 casos del grupo «malo» (5 de 10 sumando su
    # otro trimestre). Se queda la primera publicación: es cuando se supo.
    unicos = {}
    for f in sorted(filas, key=lambda x: x['fecha']):
        unicos.setdefault((f['t'], f['q']), f)
    antes = len(filas)
    filas = list(unicos.values())
    podados = antes - len(filas)

    print(f'\n📊 EEFF cruzado con el BPA del trimestre reportado')
    print(f'   {len(ev)} episodios de EEFF con camino completo')
    print(f'   {sin_dato} descartados: la SMV no tiene el BPA de uno de los dos '
          f'trimestres (Regla #1: ausente ≠ cero)')
    print(f'   {podados} podados: el MISMO trimestre presentado más de una vez')
    print(f'   {len(filas)} episodios únicos (empresa + trimestre reportado)\n')

    if len(filas) < 12:
        print('   Con menos de 12 casos no se parte nada. Fin.')
        return

    print(f'   {"empresa":<10} {"publicó":<12} {"trim":<9} {"BPA":>8} {"año ant":>9} '
          f'{"Δ":>8}   {"5r":>7} {"15r":>7}')
    for f in sorted(filas, key=lambda x: -x['delta']):
        print(f'   {f["t"]:<10} {f["fecha"]:<12} {f["q"]:<9} {f["bpa"]:>+8.3f} '
              f'{f["bpa_ant"]:>+9.3f} {f["delta"]:>+8.3f}   '
              f'{f["camino"][5]:>+6.2f}% {f["camino"][15]:>+6.2f}%')

    pozo = [f['camino'] for f in filas]

    def nula(sel, k):
        real = st.median([c[k] for c in sel])
        n = len(sel)
        peores = sum(1 for _ in range(SORTEOS)
                     if st.median([c[k] for c in random.sample(pozo, n)]) <= real)
        return real, 100 * peores / SORTEOS

    print(f'\n   ── ¿EL SIGNO DEL BPA CAMBIA EL CAMINO DEL PRECIO? ──\n')
    grupos = [('BPA MEJOR que el año anterior', lambda f: f['delta'] > 0),
              ('BPA PEOR que el año anterior', lambda f: f['delta'] < 0)]
    for nom, cond in grupos:
        sel = [f['camino'] for f in filas if cond(f)]
        if len(sel) < 5:
            print(f'   {nom:<32} n={len(sel)} — muy pocas para decir nada\n')
            continue
        print(f'   {nom}   n={len(sel)}')
        for k in HORIZONTES:
            real, pc = nula(sel, k)
            verde = 100 * sum(1 for c in sel if c[k] > 0) / len(sel)
            v = 'DISTINTO' if (pc <= 5 or pc >= 95) else 'indistinguible'
            print(f'      {k:>2}r  mediana {real:+6.2f}%  verde {verde:>3.0f}%  '
                  f'percentil {pc:>3.0f} de {SORTEOS} sorteos del mismo pozo  {v}')
        print()

    print('   La prueba nula sortea del pozo de LOS PROPIOS EEFF, no del mercado.')
    print('   Así la pregunta es la correcta: dentro de los EEFF, ¿el bueno se')
    print('   comporta distinto del malo? Un percentil entre 5 y 95 dice que no')
    print('   se puede distinguir, y con estos n eso es lo esperable.')


if __name__ == '__main__':
    main()
