"""¿EL CRUDO CAYÓ POR LOS ALTOS EL FUEGO, O VENÍA CAYENDO IGUAL? (10-ago-2026)

Jair preguntó por qué el petróleo bajó de 117 a 82 **con el estrecho de Ormuz
todavía cerrado**, y propuso que fue el alto el fuego. Es una hipótesis con
mecanismo y se puede contrastar sin discutirla: se ponen las fechas de los
eventos al lado de la serie y se mira si el precio se movió ESOS días.

La trampa que evita este archivo es la de siempre en este laboratorio: una
explicación que suena bien y que nadie fue a chequear contra el calendario. Si
el crudo cayó parejo durante meses, el alto el fuego es coincidencia por más
sentido que tenga.

LAS FECHAS ESTÁN VERIFICADAS HOY contra CNN, Al Jazeera, Britannica y Times of
Israel. Dos van marcadas como APROXIMADAS porque las fuentes dan el mes y no el
día: el inicio de la guerra (feb-2026) y la reanudación del conflicto (jul-2026).
Una fecha inventada al día exacto haría parecer preciso un dato que no lo es.
"""
import io
import json
import statistics as st
import sys

_stdout, sys.stdout = sys.stdout, io.StringIO()
sys.path.insert(0, 'laboratorio')
import cerebro as C  # noqa: E402,F401  (se importa por consistencia de entorno)
sys.stdout = _stdout

M = json.load(open('app/src/data/metales_diarios.json', encoding='utf-8'))['metales']

EVENTOS = [
    ('2026-02-02', 'empieza la guerra', True),
    ('2026-04-08', 'alto el fuego EE.UU.-Iran, paso seguro por Ormuz', False),
    ('2026-04-10', 'Trump cuestiona la efectividad del alto el fuego', False),
    ('2026-06-19', 'Iran designa ruta unica: el estrecho queda cerrado', False),
    ('2026-07-01', 'se reanuda el conflicto, ataques a buques', True),
    ('2026-08-02', 'Trump anuncia negociaciones para reabrir', False),
    ('2026-08-05', 'ataque huti a petrolero saudi', False),
    ('2026-08-09', 'Israel rechaza el plan; Iran pone condiciones', False),
]


def serie(nom):
    return sorted(M[nom]['cierres'].items())


def alrededor(s, fecha, off):
    """El cierre `off` ruedas desde la primera rueda >= fecha."""
    import bisect
    fs = [f for f, _c in s]
    i = bisect.bisect_left(fs, fecha)
    j = i + off
    return s[j] if 0 <= j < len(s) else None


def mensual(s):
    m = {}
    for f, c in s:
        m.setdefault(f[:7], []).append(c)
    return {k: st.mean(v) for k, v in sorted(m.items())}


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    s = serie('petroleo_wti')
    print('=' * 92)
    print(f'  WTI Y EL ESTRECHO DE ORMUZ — {len(s)} ruedas, {s[0][0]} a {s[-1][0]}')
    print('=' * 92)

    cl = [c for _f, c in s]
    pico = max(s, key=lambda x: x[1])
    print(f'\n  máximo de la serie: {pico[1]:.2f} el {pico[0]}')
    print(f'  hoy:                {s[-1][1]:.2f}   ->  {100*(s[-1][1]/pico[1]-1):+.1f}% desde el pico')

    print('\n  ── PROMEDIO MENSUAL, para ver si la caída fue de golpe o pareja ' + '─' * 20)
    mm = mensual(s)
    ks = [k for k in mm if k >= '2025-11']
    prev = None
    for k in ks:
        d = '' if prev is None else f'  {100*(mm[k]/prev-1):+6.1f}%'
        barra = '█' * int(mm[k] / 3)
        print(f'    {k}  {mm[k]:7.2f}{d:>9s}  {barra}')
        prev = mm[k]

    print('\n  ── QUÉ HIZO EL CRUDO EN CADA EVENTO ' + '─' * 48)
    print(f'    {"fecha":11s} {"D-1":>8s} {"D":>8s} {"D+1":>8s} {"D+5":>8s}   {"D-1→D":>7s} {"D-1→D+5":>8s}')
    for f, desc, aprox in EVENTOS:
        a, d0, d1, d5 = (alrededor(s, f, -1), alrededor(s, f, 0),
                         alrededor(s, f, 1), alrededor(s, f, 5))
        if not (a and d0):
            print(f'    {f}  sin datos')
            continue
        r1 = 100 * (d0[1] / a[1] - 1)
        r5 = 100 * (d5[1] / a[1] - 1) if d5 else None
        marca = ' ~' if aprox else '  '
        print(f'    {f}{marca}{a[1]:8.2f} {d0[1]:8.2f} '
              f'{(d1[1] if d1 else 0):8.2f} {(d5[1] if d5 else 0):8.2f}   '
              f'{r1:+6.2f}% {(f"{r5:+7.2f}%" if r5 is not None else "     —")}')
        print(f'{"":16s}{desc}')

    print('\n  ~ = fecha aproximada (la fuente da el mes, no el día)')

    print('\n  ── CONTRASTE: el movimiento típico de una rueda cualquiera ' + '─' * 24)
    movs = [abs(100 * (cl[i] / cl[i - 1] - 1)) for i in range(1, len(cl))]
    print(f'    |movimiento| diario: mediana {st.median(movs):.2f}%   promedio {st.mean(movs):.2f}%')
    g = sorted(movs, reverse=True)
    print(f'    para ser del 5% más movido hace falta {g[int(0.05*len(g))]:.2f}%')
