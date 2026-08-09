# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════════════════
🏷️ EL LIBRO DE ETIQUETAS — lo cualitativo, anotado de forma que algún día se
pueda medir.

EL PROBLEMA QUE RESUELVE. «Trimestre de transición: el costo subió por volumen,
no por ineficiencia» es la clase de lectura que ningún número del repo captura y
que probablemente sea la razón real por la que una acción se mueve. Pero escrita
suelta es una historia, y una historia nunca se equivoca: siempre se puede
reinterpretar después de ver el precio.

LA REGLA QUE LA CONVIERTE EN DATO: toda etiqueta se anota CON FECHA, CON FUENTE
y —si quien la escribe se atreve— CON UNA HIPÓTESIS FALSABLE (dirección +
horizonte). Después el libro se cierra. Cuando pasan las ruedas, `puntuar()`
compara contra el precio sin preguntarle a nadie. Una etiqueta que nunca se
puede equivocar no entra.

POR QUÉ ESTO NO TIENE (TODAVÍA) PESO ESTADÍSTICO. Hay ~61 EEFF trimestrales con
precio en todo el repo. Una etiqueta como «transición operativa» va a aparecer
2 o 3 veces al año. No existe forma de sacarle una tasa base hoy, y prometer una
sería inventarla. El libro existe para ACUMULAR: dentro de un año habrá 40 o 50
etiquetas puntuadas y ahí recién se podrá preguntar si sirven.

LA BASE ES OBLIGATORIA, Y ES LA TRAMPA MÁS CARA. La SMV publica estados
INDIVIDUALES y CONSOLIDADOS. Para Volcan 2T26 la utilidad del trimestre es
US$ 5.5 M en el individual (lo que lee ALTO) y ~US$ 46.9 M en el consolidado
(lo que citan los informes de la gerencia): 8× de diferencia. Una etiqueta sin
`base` mezcla las dos y nadie se entera nunca.
═══════════════════════════════════════════════════════════════════════════════
"""
import json, os, sys, statistics as st
from collections import defaultdict

from motor import series_frescas, HORIZ

sys.stdout.reconfigure(encoding='utf-8')

LIBRO = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'etiquetas.json')

# Los únicos valores que acepta cada campo cerrado. Sin esto, en tres meses hay
# «transicion», «transición» y «Transición Operativa» como tres etiquetas.
TIPOS = ['transicion_operativa', 'costo_por_volumen', 'costo_estructural',
         'hito_produccion', 'rampa_produccion', 'validacion_externa',
         'guidance', 'cuello_de_botella', 'caja_fuerte', 'deuda', 'precio_metal',
         # el desglose del costo: importa la CAUSA, no el monto. Volumen y FX se
         # revierten solos; mano de obra y servicios se quedan.
         'coberturas', 'colocacion_deuda', 'pipeline_proyecto', 'eficiencia_preparacion']
BASES = ['individual', 'consolidado', 'no_aplica']
DIRECCIONES = ['sube', 'baja', 'ninguna']


def cargar_libro():
    if not os.path.exists(LIBRO):
        return {'_comment': 'Libro de etiquetas del laboratorio. Ver etiquetas.py.',
                'etiquetas': []}
    with open(LIBRO, encoding='utf-8') as f:
        return json.load(f)


def guardar_libro(libro):
    with open(LIBRO, 'w', encoding='utf-8') as f:
        json.dump(libro, f, ensure_ascii=False, indent=2)


def validar(e):
    """Una etiqueta mal formada no entra. Fallar acá es barato; fallar cuando
    ya hay 200 anotadas y ninguna se puede comparar, no."""
    faltan = [k for k in ('ticker', 'fecha', 'tipo', 'texto', 'fuente', 'base',
                          'verificado') if k not in e]
    if faltan:
        raise ValueError(f'faltan campos: {faltan}')
    if e['tipo'] not in TIPOS:
        raise ValueError(f'tipo «{e["tipo"]}» no está en TIPOS')
    if e['base'] not in BASES:
        raise ValueError(f'base «{e["base"]}» no está en BASES')
    h = e.get('hipotesis')
    if h:
        if h.get('direccion') not in DIRECCIONES:
            raise ValueError('hipótesis sin dirección válida')
        if not isinstance(h.get('ruedas'), int):
            raise ValueError('hipótesis sin horizonte en ruedas')
    return True


def anotar(**e):
    """Añade una etiqueta al libro. La fecha es la del DOCUMENTO, no la de hoy:
    lo que importa es cuándo el mercado pudo saberlo."""
    e.setdefault('verificado', False)
    validar(e)
    libro = cargar_libro()
    libro['etiquetas'].append(e)
    guardar_libro(libro)
    return e


def puntuar():
    """Compara cada hipótesis contra lo que hizo el precio. Sin opinión:
    la dirección se acertó o no."""
    series, _ = series_frescas()
    libro = cargar_libro()
    filas = []
    for e in libro['etiquetas']:
        h = e.get('hipotesis')
        if not h or h['direccion'] == 'ninguna':
            continue
        vals = series.get(e['ticker'])
        if not vals:
            filas.append((e, None, 'la acción no está entre las negociadas'))
            continue
        fechas = [f for f, _ in vals]
        previas = [i for i, f in enumerate(fechas) if f <= e['fecha']]
        if not previas:
            filas.append((e, None, 'sin precio en esa fecha'))
            continue
        b = previas[-1]
        n = h['ruedas']
        if b + n >= len(vals):
            faltan = b + n - len(vals) + 1
            filas.append((e, None, f'todavía no vence — faltan {faltan} ruedas'))
            continue
        ret = (vals[b + n][1] / vals[b][1] - 1) * 100
        acerto = (ret > 0) if h['direccion'] == 'sube' else (ret < 0)
        filas.append((e, ret, 'acertó' if acerto else 'falló'))
    return filas


def por_ticker(ticker, hasta=None):
    return [e for e in cargar_libro()['etiquetas']
            if e['ticker'] == ticker and (not hasta or e['fecha'] <= hasta)]


def informe():
    libro = cargar_libro()
    ets = libro['etiquetas']
    print(f'📒 LIBRO DE ETIQUETAS — {len(ets)} anotadas\n')
    porv = defaultdict(int)
    for e in ets:
        porv[('verificada contra el PDF' if e['verificado'] else
              'SIN verificar (viene de un tercero)')] += 1
    for k, v in porv.items():
        print(f'   {v:>3}  {k}')

    filas = puntuar()
    cerradas = [(e, r, v) for e, r, v in filas if r is not None]
    print(f'\n── HIPÓTESIS: {len(filas)} anotadas · {len(cerradas)} ya vencidas ──')
    for e, ret, veredicto in filas:
        h = e['hipotesis']
        marca = '✅' if veredicto == 'acertó' else '❌' if veredicto == 'falló' else '⏳'
        cola = f'{ret:+.2f}% → {veredicto}' if ret is not None else veredicto
        print(f'   {marca} {e["ticker"]:<9} {e["fecha"]}  {e["tipo"]:<20} '
              f'dice «{h["direccion"]}» a {h["ruedas"]}r   {cola}')
    if len(cerradas) >= 10:
        ok = sum(1 for _, _, v in cerradas if v == 'acertó')
        print(f'\n   marcador: {ok}/{len(cerradas)} ({100*ok/len(cerradas):.0f}%)  ·  '
              f'retorno medio {st.mean([r for _, r, _ in cerradas]):+.2f}%')
    else:
        print(f'\n   Con {len(cerradas)} hipótesis vencidas no hay marcador que valga.')
        print('   El libro sirve para ACUMULAR: se juzga cuando haya ~30.')

    print('\n── ETIQUETAS SIN HIPÓTESIS (contexto, no apuesta) ──')
    for e in ets:
        if not e.get('hipotesis') or e['hipotesis']['direccion'] == 'ninguna':
            v = '✓' if e['verificado'] else '?'
            print(f'   [{v}] {e["ticker"]:<9} {e["fecha"]}  {e["tipo"]:<20} '
                  f'{e["texto"][:52]}')


if __name__ == '__main__':
    informe()
