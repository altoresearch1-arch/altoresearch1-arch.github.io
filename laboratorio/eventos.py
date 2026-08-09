# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════════════════
📄 CEREBRO DE CATALIZADORES — qué le pasó al precio DESPUÉS de cada Hecho.

Estudio de eventos, no de días: la unidad acá es «la BVL publicó algo», y la
pregunta es si el precio hizo después algo distinto a lo de siempre.

DOS DETALLES QUE DECIDEN EL RESULTADO Y NO SE VEN
  1. LA HORA. La BVL cierra ~15:00. Un Hecho publicado 19:12 NO está en el
     cierre de ese día: el precio que aún no sabe la noticia es el de ESA
     rueda, y la reacción empieza al día siguiente. La hora no viene en el JSON
     — está escondida en la ruta del PDF (.../20260721191201/...). Sin leerla,
     un tercio de los eventos quedan corridos una rueda y la reacción del día 1
     se mide al revés.
  2. EL FERIADO. Si el Hecho cae sábado o 28-jul, la rueda base es la anterior.

LÍMITE DURO DE COBERTURA: `hechos.json` guarda ~15 Hechos por empresa y el más
antiguo típico es 30-ene-2026. Son ~6 meses reales, no los 12 que dice el
comentario del archivo. Por eso las familias chicas se imprimen con su n al
lado y ninguna con n<10 pretende decir nada.
═══════════════════════════════════════════════════════════════════════════════
"""
import re, sys, statistics as st
from collections import defaultdict

from motor import cargar, series_negociadas, familia  # noqa: F401 (se re-exporta)

sys.stdout.reconfigure(encoding='utf-8')

HORIZONTES = [1, 3, 5, 10, 15]

# `familia()` vive en motor.py: la exclusión del panel y este estudio tienen que
# clasificar idéntico o miden dos universos distintos. Ver el docstring allá.


def hora_publicacion(h):
    """La hora real, sacada de la ruta del PDF. None = no se sabe."""
    m = re.search(r'/(\d{14})/', h.get('pdf') or '')
    return int(m.group(1)[8:10]) if m else None


def _rueda_base(vals, idx, fecha, hora):
    """Índice de la rueda cuyo cierre TODAVÍA no sabe la noticia."""
    i = idx.get(fecha)
    if i is None:
        previas = [j for j, (f, _) in enumerate(vals) if f < fecha]
        return previas[-1] if previas else None
    # publicado después del cierre → el cierre de hoy sigue siendo pre-noticia
    if hora is None or hora >= 15:
        return i
    return i - 1 if i > 0 else None


def _prioridad(h):
    """Cuál de los documentos del mismo trimestre se queda. Manda el INDIVIDUAL:
    es la base que lee todo ALTO (el BPA, el FCF), y mezclar bases es la trampa
    cara —Volcan 2T26 daba US$ 5.5 M individual contra ~US$ 46.9 M consolidado—.
    Después, el que al menos tiene título; el sin título va último."""
    t = (h.get('titulo') or '').lower()
    return (0 if 'individual' in t else 1 if 'consolidad' in t else 2, not t.strip())


EEFF = ('EEFF trimestral', 'EEFF anual')
VENTANA_EPISODIO = 5   # ruedas: dentro de esto, un EEFF más es el mismo trimestre


def estudio(series=None):
    """Todos los eventos con su camino de precios. `fwd[k]` = % a k ruedas.

    UN TRIMESTRE = UN EVENTO, Y EL EVENTO ES LA PRIMERA VEZ QUE SE SUPO. Un día
    de resultados no deja un Hecho, deja una pila: el EEFF individual, el
    consolidado, la presentación corporativa del día siguiente y a veces la
    convocatoria a junta con los EE.FF. auditados adentro. Son cuatro papeles,
    un episodio y UN camino de precios. Contados sueltos:
      · IFS, PML y BAP entraban dos veces cada uno (individual + consolidado
        del mismo día) — 17 «casos castigados» que eran 13;
      · Volcan entraba dos veces por el 2T26 (EEFF el 21-jul, presentación el
        22) porque caen en ruedas base distintas;
      · Atacocha entraba dos veces el 26-feb-2026, una como trimestral y otra
        como anual, con el mismo precio.
    El promedio terminaba pesado hacia las empresas que presentan más papeles,
    no hacia las que caen más. Es la poda que `similares.py` ya aplica: un
    episodio, un voto. Se queda el PRIMER aviso —es cuando el mercado se
    enteró— y, empatados en la misma rueda, el individual.
    """
    series = series or series_negociadas()
    hechos = cargar('hechos.json')['hechos']
    eventos = []
    for t, ficha in hechos.items():
        if t not in series:
            continue
        vals = series[t]
        idx = {f: i for i, (f, _) in enumerate(vals)}
        candidatos = []
        for h in ficha.get('hechos', []):
            b = _rueda_base(vals, idx, h['fecha'], hora_publicacion(h))
            if b is None or b < 5 or not vals[b][1]:
                continue
            candidatos.append((b, familia(h), h))
        unicos, ruedas_eeff = {}, []
        for b, fam, h in sorted(candidatos, key=lambda x: (x[0], _prioridad(x[2]))):
            if fam in EEFF:
                # trimestral y anual comparten cubo: el 26-feb de Atacocha es un
                # solo episodio aunque la SMV lo archive con dos nombres.
                if any(b - previo <= VENTANA_EPISODIO for previo in ruedas_eeff):
                    continue
                ruedas_eeff.append(b)
            unicos.setdefault((b, fam), h)
        for (b, fam), h in unicos.items():
            p0 = vals[b][1]
            camino = {k: (vals[b + k][1] / p0 - 1) * 100
                      for k in HORIZONTES if b + k < len(vals)}
            eventos.append({
                't': t, 'fecha': h['fecha'], 'fam': fam,
                'titulo': (h.get('titulo') or h.get('categoria') or '')[:80],
                'hora': hora_publicacion(h), 'p0': p0, 'camino': camino,
                'completo': len(camino) == len(HORIZONTES),
            })
    return eventos


def por_familia(eventos=None, minimo=10):
    """La tasa base de cada familia. Solo eventos con el camino completo."""
    eventos = eventos if eventos is not None else estudio()
    grupos = defaultdict(list)
    for e in eventos:
        if e['completo']:
            grupos[e['fam']].append(e)
    out = {}
    for fam, ev in grupos.items():
        if len(ev) < minimo:
            continue
        out[fam] = {'n': len(ev), 'horizontes': {
            k: {'mediana': st.median([e['camino'][k] for e in ev]),
                'media': st.mean([e['camino'][k] for e in ev]),
                'gana': 100 * sum(1 for e in ev if e['camino'][k] > 0) / len(ev)}
            for k in HORIZONTES}}
    return out


def ultimo_de(ticker, hasta=None):
    """El Hecho más reciente de una empresa, con su familia y su antigüedad.

    Un día de resultados no trae un Hecho, trae cinco: el EEFF individual, el
    consolidado y tres «Otros Hechos De Importancia». Empatados en fecha, el
    desempate por orden de archivo devolvía «otros» —tasa base positiva— el día
    del EEFF. Manda el que tiene tasa base propia, y el EEFF antes que nada."""
    hechos = cargar('hechos.json')['hechos'].get(ticker, {}).get('hechos', [])
    hs = [h for h in hechos if not hasta or h['fecha'] <= hasta]
    if not hs:
        return None
    ultima = max(x['fecha'] for x in hs)

    def rango(x):
        fam = familia(x)
        return (fam not in ('EEFF trimestral', 'EEFF anual'), fam == 'otros', _prioridad(x))

    h = min([x for x in hs if x['fecha'] == ultima], key=rango)
    # Sin esta distinción la ficha imprimía la CATEGORÍA como si fuera el título
    # —y la categoría de la SMV se llama «…Anual Auditada, Memoria Anual, E
    # Información Financiera Intermedia», así que se leía «anual» debajo de una
    # familia que dice trimestral.
    tit = (h.get('titulo') or '').strip()
    return {'fecha': h['fecha'], 'fam': familia(h),
            'titulo': tit[:90] if tit else
                      f'(la SMV aún no publica el título · categoría: '
                      f'{(h.get("categoria") or "?").strip()[:50]})',
            'hora': hora_publicacion(h), 'pdf': h.get('pdf')}


if __name__ == '__main__':
    ev = estudio()
    comp = [e for e in ev if e['completo']]
    con_hora = sum(1 for e in ev if e['hora'] is not None)
    print(f'EVENTOS {len(ev)}  ·  con camino completo (15 ruedas) {len(comp)}  ·  '
          f'con hora conocida {100*con_hora/len(ev):.0f}%\n')
    print(f'{"familia":<26} {"n":>4}  ' + '  '.join(f'{k:>2}r' + ' '*9 for k in HORIZONTES))
    for fam, d in sorted(por_familia(ev).items(), key=lambda x: -x[1]['n']):
        fila = f'{fam:<26} {d["n"]:>4}  '
        for k in HORIZONTES:
            h = d['horizontes'][k]
            fila += f'{h["mediana"]:+6.2f}%({h["gana"]:>3.0f}%) '
        print(fila)
    print('\nmediana(% de veces en verde). Una familia solo se imprime con n≥10.')
