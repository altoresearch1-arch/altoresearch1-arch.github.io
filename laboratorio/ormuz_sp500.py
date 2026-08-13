"""¿EL S&P VENÍA VERDE Y TRUMP ANUNCIÓ ALGO DE IRÁN Y SE CAYÓ TODO? — 13-ago-2026

Jair lo planteó así: «cuántos días estuvimos verdes en el S&P y después Trump
anuncia algo con Irán y todo cae, porque así ha estado toda esta guerra».

Es una hipótesis con forma medible y este archivo la contrasta sin discutirla.
Dos cosas hay que separar, porque la frase junta tres afirmaciones distintas:

  1. ¿El S&P venía subiendo ANTES del anuncio?      (la racha previa)
  2. ¿Cayó EL DÍA del anuncio o el siguiente?       (la reacción)
  3. ¿Es distinto de un día cualquiera?              (el control)

Sin la tercera no hay estudio: en un mercado que sube el 55% de las ruedas,
«venía verde» describe casi cualquier fecha que elijas.

EL ARREGLO MÁS IMPORTANTE, Y ES DEL ARCHIVO ANTERIOR. `crudo_ormuz.py` tiene
anotado «2026-02-02 empieza la guerra (aproximada)». La fecha real es
**2026-02-28**: Operation Epic Fury, con el estrecho cerrado ese mismo día.
Cuatro semanas de error en el evento más importante de la serie, y estaba
marcado como aproximado justamente porque la fuente daba el mes y no el día.
Acá las fechas salen del timeline de Hormuz Strait Monitor y del artículo
«2026 Strait of Hormuz crisis» de Wikipedia, que coinciden en las grandes.

CÓMO SE CLASIFICA. Cada evento va como ESCALADA o DISTENSIÓN según lo que
significa para el riesgo, no según lo que hizo el precio — clasificar por el
resultado es cómo se fabrica un hallazgo. Y se marcan aparte los que son
ANUNCIOS DE TRUMP, que es lo que Jair preguntó.

    python laboratorio/ormuz_sp500.py
"""
import bisect
import io
import json
import statistics as st
import sys

_stdout, sys.stdout = sys.stdout, io.StringIO()
sys.path.insert(0, 'laboratorio')
import cerebro as C  # noqa: E402,F401
sys.stdout = _stdout

IDX = json.load(open('app/src/data/indices.json', encoding='utf-8'))['indices']
MET = json.load(open('app/src/data/metales_diarios.json', encoding='utf-8'))['metales']

# fecha, descripción, escalada(True)/distensión(False), ¿es anuncio de Trump?
EVENTOS = [
    ('2026-02-28', 'Operation Epic Fury; Irán cierra el estrecho', True, False),
    ('2026-03-02', 'la IRGC confirma el cierre del estrecho', True, False),
    ('2026-03-15', 'Trump pide buques aliados; todos se niegan', True, True),
    ('2026-03-19', 'EE.UU. inicia campaña aérea para reabrir', True, False),
    ('2026-03-21', 'Trump amenaza la infraestructura energética civil', True, True),
    ('2026-03-24', 'Trump anuncia un «regalo muy significativo» de Irán', False, True),
    ('2026-03-26', 'Trump da ultimátum de 10 días', True, True),
    ('2026-04-01', 'ataques fuertes en Teherán; Irán lanza misiles', True, False),
    ('2026-04-06', 'Trump extiende el plazo y amenaza infraestructura', True, True),
    ('2026-04-08', 'primer alto el fuego; Brent -15.9%', False, True),
    ('2026-04-13', 'EE.UU. bloquea puertos iraníes', True, False),
    ('2026-04-17', 'Irán declara el estrecho «totalmente abierto»', False, False),
    ('2026-04-18', 'se cae el alto el fuego; la IRGC dispara a buques', True, False),
    ('2026-04-22', 'Trump extiende el alto el fuego indefinidamente', False, True),
    ('2026-04-23', 'Trump ordena «disparar y matar» a los mineros', True, True),
    ('2026-05-04', 'lanza Project Freedom: escolta naval', True, True),
    ('2026-05-05', 'Irán ataca EAU; dron en Fujairah', True, False),
    ('2026-05-06', 'Trump pausa Project Freedom por «gran progreso»', False, True),
    ('2026-05-11', 'Irán rechaza la propuesta de EE.UU.', True, False),
    ('2026-05-13', 'Trump y Xi acuerdan que el estrecho siga abierto', False, True),
    ('2026-05-20', 'Trump cancela un «ataque muy importante»', False, True),
    ('2026-05-23', 'Trump dice que el acuerdo está «casi negociado»', False, True),
    ('2026-05-25', 'ataques de autodefensa a sitios de misiles', True, False),
    ('2026-05-27', 'Trump amenaza con «volar» Omán por los peajes', True, True),
    ('2026-06-11', 'Trump cancela ataques; «acuerdo este fin de semana»', False, True),
    ('2026-06-14', 'anuncia el acuerdo: «Ships of the World, start your engines»', False, True),
    ('2026-06-17', 'se firma el MOU de Islamabad en Versalles', False, True),
    ('2026-06-18', 'reabre el estrecho; 25 tránsitos', False, False),
    ('2026-06-19', 'Trump anuncia alto el fuego Israel-Hezbolá', False, True),
    ('2026-06-20', 'la IRGC vuelve a declarar cerrado el estrecho', True, False),
    ('2026-06-22', 'Trump amenaza con peajes de EE.UU.', True, True),
    ('2026-07-07', 'Irán ataca tres buques; 80+ ataques de CENTCOM', True, False),
    ('2026-07-08', 'Trump declara el alto el fuego «terminado» en Ankara', True, True),
    ('2026-07-11', 'CENTCOM 140 ataques; Irán declara cerrado el estrecho', True, False),
    ('2026-07-14', 'Trump elimina el peaje del 20%', False, True),
    ('2026-07-22', 'Trump anuncia «un puente destruido por cada buque»', True, True),
    ('2026-07-25', 'primera noche sin ataques en dos semanas', False, False),
    ('2026-08-01', 'Trump cancela el ataque a infraestructura energética', False, True),
    ('2026-08-04', 'mediadores proponen alto el fuego de 10 días', False, False),
    ('2026-08-07', 'Pacto de La Meca; Trump suspende la campaña', False, True),
    ('2026-08-12', 'se firma el segundo MOU en Versalles', False, True),
]


def serie(d):
    return sorted(d.items())


def idx(fs, f):
    return bisect.bisect_left(fs, f)


def ret(cs, fs, i):
    return None if i <= 0 or i >= len(cs) else (cs[i][1] / cs[i - 1][1] - 1) * 100


def racha(cs, fs, i, n=3):
    """El retorno acumulado de las n ruedas ANTERIORES al evento."""
    if i - n - 1 < 0 or i > len(cs):
        return None
    j = min(i, len(cs) - 1)
    return (cs[j - 1][1] / cs[j - 1 - n][1] - 1) * 100


def tabla(nombre, cs, filtro=None, titulo=''):
    fs = [f for f, _ in cs]
    rs = [r for r in (ret(cs, fs, i) for i in range(1, len(cs))) if r is not None]
    base_verde = 100 * sum(1 for r in rs if r > 0) / len(rs)
    base_med = st.median(rs)

    ev = [e for e in EVENTOS if filtro is None or filtro(e)]
    print(f'\n{"=" * 94}')
    print(f'  {nombre}{titulo}  —  {len(ev)} eventos')
    print('=' * 94)
    print(f'    {"fecha":11s} {"3 previas":>10s} {"día D":>8s} {"D+1":>8s}  tipo  descripción')
    prev, dia, sig = [], [], []
    for f, desc, esc, _t in ev:
        i = idx(fs, f)
        if i >= len(cs):
            continue
        p = racha(cs, fs, i)
        d0 = ret(cs, fs, i) if fs[i] == f else None
        d1 = ret(cs, fs, i + 1) if i + 1 < len(cs) else None
        if p is not None:
            prev.append(p)
        if d0 is not None:
            dia.append(d0)
        if d1 is not None:
            sig.append(d1)
        fmt = lambda x: f'{x:+7.2f}%' if x is not None else '      —'  # noqa: E731
        print(f'    {f}  {fmt(p)}  {fmt(d0)} {fmt(d1)}  {"ESC " if esc else "dist"}  {desc[:44]}')

    print(f'\n    {"":11s} {"3 previas":>10s} {"día D":>8s} {"D+1":>8s}')
    for et, xs in (('mediana', None), ('% verdes', None)):
        vals = []
        for xs2 in (prev, dia, sig):
            if not xs2:
                vals.append('     —')
            elif et == 'mediana':
                vals.append(f'{st.median(xs2):+7.2f}%')
            else:
                vals.append(f'{100*sum(1 for x in xs2 if x>0)/len(xs2):6.1f}%')
        print(f'    {et:11s} {vals[0]:>10s}  {vals[1]:>8s} {vals[2]:>8s}')
    print(f'\n    CONTROL — una rueda cualquiera: mediana {base_med:+.2f}%,'
          f' verde el {base_verde:.1f}% de las veces  (n={len(rs)})')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sp = serie(IDX['sp500']['cierres'])
    print(f'  S&P 500 — {len(sp)} ruedas, {sp[0][0]} a {sp[-1][0]}')

    tabla('S&P 500 EN CADA EVENTO DE ORMUZ', sp)
    tabla('S&P 500', sp, lambda e: e[3], titulo=' — SOLO ANUNCIOS DE TRUMP')
    tabla('S&P 500', sp, lambda e: e[2] and e[3],
          titulo=' — SOLO ANUNCIOS DE TRUMP QUE ESCALAN')

    for nom in ('oro', 'petroleo_wti'):
        if nom in MET:
            tabla(nom.upper(), serie(MET[nom]['cierres']), lambda e: e[3],
                  titulo=' — SOLO ANUNCIOS DE TRUMP')
