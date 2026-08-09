# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════════════════
👁️ EL VIGÍA — se entera de que un emisor extranjero publicó, porque nadie más lo hace.

    python laboratorio/vigia.py            # revisa y avisa si hay algo nuevo
    python laboratorio/vigia.py --estado   # qué periodos conoce de cada uno

EL AGUJERO QUE TAPA, Y ES UN AGUJERO REAL. `hechos.json` tiene **cero** registros
de RIO, PPX y PML. No es un error del extractor: son emisores extranjeros
(TSX / TSX-V) que no presentan Hechos de Importancia a la SMV. Consecuencia
medida el 7-ago-2026: `ficha.py RIO` imprime «sin Hechos de Importancia en el
archivo para esta empresa», el aviso ⚠ de EEFF nunca salta, y el cerebro de
catalizadores queda ciego justo en la empresa donde el usuario está esperando
un trimestre.

EL DISPARADOR ES UNA CADENA DE TEXTO, NO UNA HEURÍSTICA. La página de
inversionistas de Rio2 lista sus documentos regulatorios por periodo:

    2026 →  Marzo 31, 2026        MDA  FS
    2025 →  Diciembre 31, 2025    AIF  MDA  FS
            Junio 30, 2025        MDA  FS
            ...

Cada año tiene sus cuatro trimestres; 2026 tiene uno solo. Cuando aparezca
«Junio 30, 2026» en esa lista, el trimestre salió. No hay que interpretar nada.

LO QUE ESTE ARCHIVO GUARDA Y POR QUÉ IMPORTA. La fecha de PRIMERA VEZ VISTA. No
es la fecha de publicación —si el robot corre una vez al día, la resolución es
de un día— pero es lo único honesto: es cuándo este sistema pudo saberlo. Sin
eso, dentro de seis meses nadie va a poder medir la reacción del precio, porque
no habrá con qué anclarla. Es la misma razón por la que `eventos.py` se pelea
con la hora del PDF.

LÍMITE QUE NO SE PUEDE TAPAR: la primera corrida no puede avisar de nada. Solo
registra lo que ya está y a partir de ahí compara. Lo que se publicó antes de
hoy, se perdió.
═══════════════════════════════════════════════════════════════════════════════
"""
import json, os, re, sys
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
ARCHIVO = os.path.join(AQUI, 'vigia.json')
CONFIG = os.path.join(RAIZ, 'extractor', 'extranjero_config.json')

MESES = ('enero|febrero|marzo|abril|mayo|junio|julio|agosto|se[tp]tiembre|octubre|'
         'noviembre|diciembre|january|february|march|april|may|june|july|august|'
         'september|october|november|december')
PERIODO = re.compile(rf'\b({MESES})\s+(\d{{1,2}})\s*,?\s*(20\d{{2}})\b', re.I)


def paginas():
    """De dónde mira cada emisor. Sale de extranjero_config.json para no tener
    dos listas de URLs que se desincronizan."""
    with open(CONFIG, encoding='utf-8') as f:
        cfg = json.load(f)
    out = {}
    for e in cfg['empresas']:
        url = e.get('docsPage') or e.get('sitioIR')
        if url:
            out[e['ticker']] = {'nombre': e.get('nombre', e['ticker']), 'url': url}
    # Rio2 lista los documentos regulatorios acá, no en la portada.
    if 'RIO' in out:
        out['RIO']['url'] = 'https://www.rio2.com.pe/inversionistas'
    return out


def abrir():
    if not os.path.exists(ARCHIVO):
        return {'_comment': ('Periodos vistos en las páginas de inversionistas de los '
                             'emisores extranjeros. Lo llena laboratorio/vigia.py. La '
                             'fecha es cuándo se vio por PRIMERA VEZ, no cuándo se '
                             'publicó.'), 'emisores': {}}
    with open(ARCHIVO, encoding='utf-8') as f:
        return json.load(f)


def guardar(d):
    with open(ARCHIVO, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)


def normalizar(m):
    mes, dia, anio = m.group(1).lower(), int(m.group(2)), m.group(3)
    n = {'enero': 1, 'january': 1, 'febrero': 2, 'february': 2, 'marzo': 3, 'march': 3,
         'abril': 4, 'april': 4, 'mayo': 5, 'may': 5, 'junio': 6, 'june': 6,
         'julio': 7, 'july': 7, 'agosto': 8, 'august': 8, 'setiembre': 9,
         'septiembre': 9, 'september': 9, 'octubre': 10, 'october': 10,
         'noviembre': 11, 'november': 11, 'diciembre': 12, 'december': 12}[mes]
    return f'{anio}-{n:02d}-{dia:02d}'


def bajar(url):
    import requests
    s = requests.Session()
    s.headers.update({'User-Agent': ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                                     'Chrome/120.0 Safari/537.36'),
                      'Accept-Language': 'es-PE,es;q=0.9'})
    r = s.get(url, timeout=30)
    r.raise_for_status()
    # Solo cierres de trimestre: los 31-mar, 30-jun, 30-sep y 31-dic. Sin esto
    # entra cualquier fecha suelta de la página (noticias, eventos, avisos) y el
    # vigía avisa todos los días de algo que no es un estado financiero.
    vistos = set()
    for m in PERIODO.finditer(r.text):
        f = normalizar(m)
        if f[5:] in ('03-31', '06-30', '09-30', '12-31'):
            vistos.add(f)
    return vistos


def revisar():
    libro = abrir()
    hoy = datetime.now().strftime('%Y-%m-%d %H:%M')
    novedades = []
    for tk, info in paginas().items():
        try:
            vistos = bajar(info['url'])
        except Exception as e:
            print(f'   {tk:<6} ⚠ no se pudo leer {info["url"]}: {type(e).__name__}')
            continue
        prev = libro['emisores'].setdefault(tk, {'url': info['url'], 'periodos': {}})
        prev['url'] = info['url']
        nuevos = sorted(p for p in vistos if p not in prev['periodos'])
        for p in nuevos:
            prev['periodos'][p] = hoy
        marca = f'  🔔 NUEVO: {", ".join(nuevos)}' if nuevos and libro.get('_arrancado') else ''
        if nuevos and not libro.get('_arrancado'):
            marca = f'  (primera corrida: registra {len(nuevos)}, no avisa)'
        print(f'   {tk:<6} {len(vistos):>2} periodos en la página{marca}')
        if nuevos and libro.get('_arrancado'):
            novedades.append((tk, info['nombre'], nuevos))
    libro['_arrancado'] = True
    guardar(libro)
    return novedades


def estado():
    libro = abrir()
    if not libro['emisores']:
        print('Vacío. Corre `python laboratorio/vigia.py` primero.')
        return
    for tk, d in sorted(libro['emisores'].items()):
        ps = sorted(d['periodos'], reverse=True)
        print(f'\n   {tk} — {len(ps)} periodos conocidos')
        for p in ps[:6]:
            print(f'      {p}   visto por primera vez: {d["periodos"][p]}')
        if ps:
            ultimo = ps[0]
            a, m = int(ultimo[:4]), int(ultimo[5:7])
            sig = f'{a}-06-30' if m == 3 else f'{a}-09-30' if m == 6 else \
                  f'{a}-12-31' if m == 9 else f'{a+1}-03-31'
            print(f'      → el que falta: {sig}')


if __name__ == '__main__':
    if '--estado' in sys.argv:
        estado()
    else:
        print('👁️  revisando emisores extranjeros...\n')
        nov = revisar()
        print()
        if nov:
            for tk, nombre, ps in nov:
                print(f'🔔 {tk} ({nombre}) PUBLICÓ: {", ".join(ps)}')
            print('\n   Anótalo en el cuaderno antes de mirar el precio:')
            print('   python laboratorio/etiquetas.py')
        else:
            print('   Sin novedades. Es lo normal y no hay que forzarlo.')
        estado()
