# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════════════════
🗂️ LA FICHA — los cuatro cerebros de una acción en una sola pantalla.

    python laboratorio/ficha.py VOLCABC1

REGLA DE LECTURA, Y ES LA QUE SOSTIENE TODO: cada bloque dice de qué tamaño es
su evidencia. Lo MEDIDO trae n y tasa base. Lo ETIQUETA trae el dato y ninguna
cifra de probabilidad. Lo SIN HISTORIA se imprime igual —porque para decidir
sirve— pero bajo un rótulo que dice que nunca se pudo contrastar contra el
precio. Mezclar los tres niveles con la misma tipografía es la forma más rápida
de que una corazonada parezca un cálculo (Invariante #30 del proyecto).

Lo que la ficha NO hace: sumar los bloques en un puntaje único. Un número
redondo esconde de dónde salió y quién manda; acá cada cerebro habla por su
cuenta y las contradicciones quedan a la vista, que es cuando más sirven.
═══════════════════════════════════════════════════════════════════════════════
"""
import sys, statistics as st
from collections import defaultdict

from motor import cargar, series_frescas, fechas_eeff, construir_panel, HORIZ
from eventos import por_familia, ultimo_de, HORIZONTES
from etiquetas import por_ticker
from similares import preparar, buscar, prueba_nula, veredicto, RASGOS

sys.stdout.reconfigure(encoding='utf-8')

LINEA = '─' * 78


_EMPRESAS = None


def fichas_empresas():
    """empresas.json pesa 480 KB. Se lee UNA vez: sin el caché esto se releía
    una vez por acción al calcular el sector."""
    global _EMPRESAS
    if _EMPRESAS is None:
        _EMPRESAS = {e['ticker']: e for e in cargar('empresas.json')['empresas']
                     if e.get('ticker')}
    return _EMPRESAS


def bloque(titulo, nivel):
    marca = {'medido': '📊 MEDIDO', 'etiqueta': '🏷️  ETIQUETA (sin peso estadístico)',
             'ciego': '⚠️  SIN HISTORIA — nunca contrastado contra el precio'}[nivel]
    print(f'\n{LINEA}\n{titulo}   ·   {marca}\n')


def flecha(x, umbral=0.5):
    return '↑' if x > umbral else ('↓' if x < -umbral else '→')


def main(ticker):
    series, ultimos = series_frescas()
    if ticker not in series:
        print(f'{ticker}: no está entre las {len(series)} acciones que se negocian '
              f'(o la BVL repite su último cierre).')
        return

    filas = construir_panel(series, fechas_eeff(), con_futuro=False)
    escala = preparar(filas)
    dela = [r for r in filas if r['t'] == ticker]
    o = max(dela, key=lambda r: r['f'])

    emp = fichas_empresas().get(ticker, {})
    sector = emp.get('sector', '—')
    print(f'\n╔{"═"*76}╗')
    print(f'║ {emp.get("nombre", ticker)[:60]:<60} {ticker:>14} ║')
    print(f'║ sector {sector:<20} cierre oficial {o["f"]}   S/{o["p"]:<8.3f}{"":>6}║')
    print(f'╚{"═"*76}╝')
    # El precio de la punta se muestra, pero FUERA de la serie: es otra medición
    # (última operación vs cierre oficial) y mezclarlas movía la última rueda.
    u = ultimos.get(ticker)
    if u:
        var = f'{u["var"]:+.2f}% en el día' if u['var'] is not None else 'sin previo'
        print(f'   ⓘ  última operación en la BVL: S/{u["precio"]:.3f} el {u["fecha"]}'
              f'{" a las " + u["hora"] if u["hora"] else ""}  ({var})')
        print(f'      Ese % sale del endpoint de mercado contra su propio previo. NO se')
        print(f'      compara con el cierre oficial: son dos mediciones distintas.')
        print(f'      Todo lo de abajo se calcula sobre el cierre oficial del {o["f"]}.')

    # ── 1. MERCADO ───────────────────────────────────────────────────────
    bloque('🧭 CEREBRO DE MERCADO', 'medido')
    hoy = [r for r in filas if r['f'] == o['f']]
    mkt = st.median([r['mom5'] for r in hoy])
    mismos = [r for r in hoy if fichas_empresas().get(r['t'], {}).get('sector') == sector]
    sec = st.median([r['mom5'] for r in mismos]) if len(mismos) >= 3 else None
    for et, v in (('1 rueda', o['mom1']), ('5 ruedas', o['mom5']),
                  ('10 ruedas', o['mom10']), ('20 ruedas', o['mom20'])):
        print(f'   tendencia {et:<10} {flecha(v)}  {v:+6.2f}%')
    print(f'   volatilidad          {o["vol20"]:.1f}%/día '
          f'({"alta" if o["vol20"] > 2.5 else "normal" if o["vol20"] > 1.2 else "baja"})')
    print(f'   rsi 14               {o["rsi14"]:.0f}')
    print(f'   desde su techo de 3 meses  {o["dd60"]:+.2f}%')
    print(f'   contra la BVL (5r)   {o["mom5"] - mkt:+.2f} pp   (la bolsa: {mkt:+.2f}%)')
    if sec is not None:
        print(f'   contra su sector (5r) {o["mom5"] - sec:+.2f} pp   ({sector}: {sec:+.2f}%)')
    print(f'   ruedas con cambio de precio en las últimas 20: {o["liq"]}/20')

    # ── 2. CATALIZADORES ─────────────────────────────────────────────────
    bloque('📄 CEREBRO DE CATALIZADORES', 'medido')
    ult = ultimo_de(ticker, hasta=o['f'])
    if not ult:
        print('   sin Hechos de Importancia en el archivo para esta empresa.')
    else:
        fechas = [f for f, _ in series[ticker]]
        antig = sum(1 for f in fechas if f > ult['fecha'])
        hora = f' {ult["hora"]:02d}h' if ult['hora'] is not None else ''
        print(f'   último hecho   {ult["fecha"]}{hora}  ({antig} ruedas atrás)')
        print(f'   familia        {ult["fam"]}')
        print(f'   título         {ult["titulo"]}')
        base = por_familia().get(ult['fam'])
        if base:
            print(f'\n   tasa base de «{ult["fam"]}» (n={base["n"]} eventos de toda la BVL):')
            for k in HORIZONTES:
                h = base['horizontes'][k]
                print(f'      {k:>2} ruedas: mediana {h["mediana"]:+5.2f}%   '
                      f'terminó en verde {h["gana"]:.0f}% de las veces')
        else:
            print(f'\n   sin tasa base: esa familia tiene menos de 10 eventos medidos.')
        if o['eeff']:
            print('\n   ⚠️  hubo un EEFF en las últimas 10 ruedas. Medido en este mismo')
            print('      repo, sobre los 15 EEFF que el mercado castigó (−2% o peor a 3')
            print('      ruedas): el precio SIGUE bajando —mediana −6.98% a 15 ruedas y')
            print('      1 de 15 recuperó—. El rebote de las caídas normales acá NO aplica.')
            print('      Ojo con la dirección: eso se midió en EEFF que YA cayeron. Si el')
            print('      precio no cayó con el EEFF, esta advertencia no describe el caso.')

    # ── 3. FUNDAMENTAL ───────────────────────────────────────────────────
    bloque('💰 CEREBRO FUNDAMENTAL', 'etiqueta')
    print('   Trimestral: 8 puntos por empresa. Sirve para entender el episodio,')
    print('   no para calcular una probabilidad. No entra a la búsqueda de parecidos.\n')
    bpa = cargar('bpa_historico.json')['empresas'].get(ticker)
    if bpa and bpa.get('trimestres'):
        tri = sorted(bpa['trimestres'].items())[-5:]
        print(f'   BPA por trimestre ({bpa.get("moneda", "?")}):  ' +
              '   '.join(f'{k} {v:+.3f}' for k, v in tri))
        ult_k, ult_v = tri[-1]
        anio, q = ult_k.split('-')
        previo = bpa['trimestres'].get(f'{int(anio)-1}-{q}')
        if previo is not None:
            d = ult_v - previo
            print(f'   contra el mismo trimestre del año anterior ({int(anio)-1}-{q} '
                  f'{previo:+.3f}): {d:+.3f}  {flecha(d, 0.0005)}')
    else:
        print('   BPA: la SMV no lo tiene para esta empresa (Regla #1: ausente ≠ cero).')
    fcf = cargar('fcf_ttm.json')['empresas'].get(ticker)
    if fcf and fcf.get('fcf') is not None:
        print(f'   FCF últimos 12 meses: {fcf["fcf"]/1e6:,.1f} M {fcf.get("monedaXbrl", "")}'
              f'   ({fcf.get("desde")} → {fcf.get("hasta")})')
    prod = cargar('produccion.json')['empresas'].get(ticker)
    if prod:
        print(f'   producción: {prod.get("trimestre")} — {(prod.get("titulo") or "")[:60]}')

    ets = por_ticker(ticker, hasta=o['f'])
    if ets:
        print(f'\n   📒 etiquetas del libro ({len(ets)}) — ✓ verificada, ? viene de un tercero:')
        for e in sorted(ets, key=lambda x: x['fecha'], reverse=True):
            print(f'      [{"✓" if e["verificado"] else "?"}] {e["fecha"]}  '
                  f'{e["tipo"]:<22} {e["texto"][:44]}')
            if e.get('nota'):
                print(f'          ↳ {e["nota"][:66]}')

    # ── 4. MEMORIA ───────────────────────────────────────────────────────
    bloque('🧠 MEMORIA DE MERCADO', 'medido')
    vec = buscar(o, filas, escala, k=20)
    pozo = [r for r in filas if r['fwd'] is not None and r['f'] < o['f']]
    nula = prueba_nula(vec, pozo)
    print(f'   parecido por: {", ".join(RASGOS)}')
    print(f'   pozo: {len(pozo)} ruedas anteriores  ·  vecinos: {len(vec)}\n')
    for d, r in vec[:6]:
        print(f'      {r["t"]:<10} {r["f"]}  dist {d:.2f}   →  {HORIZ}r después: {r["fwd"]:+6.2f}%')
    if nula:
        sube = sum(1 for _, r in vec if r['fwd'] > 0)
        print(f'\n   de {len(vec)} casos parecidos: {sube} subieron, {len(vec)-sube} bajaron')
        print(f'   mediana a {HORIZ} ruedas: {nula["real_mediana"]:+.2f}%')
        print(f'   un grupo AL AZAR del mismo pozo: mediana {nula["azar_mediana"]:+.2f}% '
              f'(normal entre {nula["azar_p5"]:+.2f}% y {nula["azar_p95"]:+.2f}%), '
              f'gana {nula["azar_gana"]:.0f}%')
        print(f'\n   ⚖️  {veredicto(nula)}')
        print('\n   La memoria acertó fuera de muestra solo cuando dijo BUENO '
              '(n=57: +2.53% mediana,\n   63% aciertos, vs piso +0.30%/53%). Cuando dice '
              'MALO no acierta: sirve para\n   encontrar, no para evitar.')

    # ── 5. LO QUE NO SE PUEDE MEDIR ──────────────────────────────────────
    bloque('📰 NOTICIAS Y VOLUMEN', 'ciego')
    print('   noticias.json es una ventana móvil de 20 días: la historia de titulares')
    print('   de la BVL no existe en ningún archivo. historicos.json guarda [fecha,')
    print('   precio] y nada más: tampoco hay volumen viejo. Ninguna frase del tipo')
    print('   «en N casos similares con volumen creciente…» se puede sostener hoy.\n')
    noti = cargar('noticias.json')['porEmpresa'].get(ticker) or []
    if noti:
        for n in noti[:4]:
            print(f'      {n.get("fecha")}  {(n.get("titulo") or "")[:66]}')
            print(f'                  {n.get("medio", "")}  ·  {n.get("tipo", "")}')
    else:
        print('      sin titulares de esta empresa en la ventana de 20 días.')
    pr = cargar('precios.json')['precios'].get(ticker) or {}
    if pr.get('montoNegociado'):
        print(f'\n      volumen de HOY: S/{pr["montoNegociado"]:,.0f}  ·  '
              f'{pr.get("operaciones", 0)} operaciones  ·  última {pr.get("ultimaOperacion", "")[11:16]}')
        print('      (sin serie histórica no hay con qué compararlo)')

    print(f'\n{LINEA}')
    print('Esto no es una recomendación. Son cuatro lecturas de distinto peso puestas')
    print('lado a lado; la decisión, y el riesgo, son tuyos.')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'VOLCABC1')
