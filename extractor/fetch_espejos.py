# -*- coding: utf-8 -*-
"""🪞 LOS ESPEJOS — cuánto se despega Lima de la plaza que le hace el precio.

POR QUÉ EXISTE (13-ago-2026). Ese día RIO cayó 5.83% en Lima y PPX 5.39%, y
ninguna de las dos por el metal. RIO.TO cayó 6.69% por su reporte del Q2 y Lima
reimprimió el número; PPX no tuvo noticia ninguna y solo devolvió el premio que
cargaba sobre su cierre canadiense. Medido con CAD/USD = 0.7171, los dos días
dieron paridad al centavo.

De ahí salió el corte de R8 (REGLAS_CONGELADAS.md, 13-ago-2026): para estas dos
la beta contra el oro no mide a Lima reaccionando al metal, mide a Toronto
reaccionando y a Lima copiando. Salieron del universo.

Pero salir de un universo no es quedarse sin pregunta. Para un espejo la serie
que importa no es el metal: es **la desviación contra su plaza de origen**. Eso
es lo que este archivo guarda.

    desviación = precio de Lima (US$) / (cierre de Toronto CAD × CAD/USD) − 1

Positiva = Lima cotiza con premio. Negativa = con descuento.

LO QUE SE PUEDE CONTESTAR CON ESTO, y hoy no se puede con nada:
  · cuánto se desvía normalmente cada una, para saber si un 5% es mucho
  · cuánto tarda en volver, que es lo que decide si la desviación es operable
  · si el salto de RIO del 7-ago (+15.71%, abriendo en 2.28 desde 2.10) fue el
    metal entrando con retraso o el espejo alcanzando a Toronto

ESTE SÍ SE PUEDE RECONSTRUIR HACIA ATRÁS, y es la diferencia con
`fetch_metales.py`. Allá la serie diaria del metal no existía en ningún lado y
había que acumular desde cero. Acá los tres insumos son históricos y públicos:
Yahoo da 2 años de Toronto y del tipo de cambio, e `historicos.json` ya tiene el
lado de Lima desde enero-2025. Así que la primera corrida nace con historia.

LA RUEDA EN CURSO NO ENTRA. Mismo guardia que `fetch_metales.py` y por el mismo
motivo: Yahoo devuelve la fecha de hoy con el precio en vivo, y una fecha
guardada no se reescribe. Un intradía grabado como cierre queda para siempre —
así se envenenaron tres ruedas de oro y dos apuestas de la bitácora.

OJO CON EL DÍA SUELTO. Lima y Toronto no cierran a la misma hora ni tienen los
mismos feriados. Una desviación de un día aislado puede ser un desfase horario y
no un premio real. Lo que vale es la distribución, no la fila.

    python extractor/fetch_espejos.py
"""
import json
import os
import ssl
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

AQUI = os.path.dirname(os.path.abspath(__file__))
DATOS = os.path.join(AQUI, '..', 'app', 'src', 'data')
SALIDA = os.path.join(DATOS, 'espejos.json')
LIMA = timezone(timedelta(hours=-5))

# ticker en la BVL -> símbolo de su plaza de origen.
# Las dos cotizan en Lima en DÓLARES (`moneda: "US$"` en precios.json), así que
# el puente es CAD -> USD y no hay soles en el medio.
ESPEJOS = [
    ('RIO', 'RIO.TO', 'Rio2 Limited', 'Toronto'),
    ('PPX', 'PPX.V', 'PPX Mining Corp.', 'TSX Venture'),
]
FX = 'CADUSD=X'

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


def bajar(sym, rango='2y'):
    """Cierres diarios de Yahoo. Mismo molde que fetch_metales.bajar()."""
    url = (f'https://query1.finance.yahoo.com/v8/finance/chart/{sym}'
           f'?range={rango}&interval=1d')
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    d = json.load(urllib.request.urlopen(req, timeout=30, context=CTX))
    res = (d.get('chart') or {}).get('result')
    if not res:
        return {}
    r = res[0]
    ts = r.get('timestamp') or []
    q = (r.get('indicators') or {}).get('quote') or [{}]
    cierres = q[0].get('close') or []
    out = {}
    for t, c in zip(ts, cierres):
        if c:
            f = datetime.fromtimestamp(t, timezone.utc).strftime('%Y-%m-%d')
            out[f] = round(float(c), 6)
    return out


def lima():
    """El lado peruano: historia de `historicos.json` + el precio de hoy."""
    with open(os.path.join(DATOS, 'historicos.json'), encoding='utf-8') as f:
        H = json.load(f)['historicos']
    out = {}
    for t, _sym, _n, _p in ESPEJOS:
        o = H.get(t) or {}
        out[t] = {fecha: precio for fecha, precio in (o.get('valores') or [])
                  if precio}
    return out


def ultimo_previo(serie, fechas, f):
    """El último valor de `serie` en o antes de `f`. None si no hay ninguno.

    Hace falta porque los calendarios no coinciden: Lima tiene feriados que
    Toronto no y al revés. Sin esto, cada feriado de un lado borraría una fila
    que sí tiene información.
    """
    import bisect
    i = bisect.bisect_right(fechas, f) - 1
    return serie[fechas[i]] if i >= 0 else None


def main():
    doc = {'_comment': '', 'espejos': {}}
    if os.path.exists(SALIDA):
        try:
            with open(SALIDA, encoding='utf-8') as f:
                doc = json.load(f)
        except Exception:
            pass
    acum = doc.get('espejos') or {}

    hoy_ny = datetime.now(timezone(timedelta(hours=-4))).strftime('%Y-%m-%d')
    print('Espejos — Lima contra su plaza de origen')

    try:
        fx = bajar(FX)
    except Exception as e:
        print(f'  {FX} ERROR {type(e).__name__} — sin tipo de cambio no hay nada que medir')
        return 1
    if not fx:
        print(f'  {FX} sin datos — se aborta')
        return 1
    fx_fechas = sorted(fx)

    PL = lima()
    for tk, sym, nombre, plaza in ESPEJOS:
        try:
            casa = bajar(sym)
        except Exception as e:
            print(f'  {tk:5} {sym:8} ERROR {type(e).__name__} — se salta')
            continue
        if not casa:
            print(f'  {tk:5} {sym:8} sin datos — el símbolo no contestó')
            continue

        prev = acum.setdefault(tk, {
            'simbolo': sym, 'nombre': nombre, 'plaza': plaza,
            'moneda_casa': 'CAD', 'moneda_lima': 'USD', 'ruedas': {},
        })
        prev['simbolo'], prev['nombre'], prev['plaza'] = sym, nombre, plaza

        lp = PL.get(tk) or {}
        nuevas = 0
        for f in sorted(set(casa) & set(lp)):
            if f >= hoy_ny or f in prev['ruedas']:
                continue
            tc = ultimo_previo(fx, fx_fechas, f)
            if not tc:
                continue
            implicito = casa[f] * tc
            if implicito <= 0:
                continue
            prev['ruedas'][f] = {
                'casa': casa[f],
                'fx': round(tc, 6),
                'implicito_usd': round(implicito, 4),
                'lima_usd': lp[f],
                'desviacion_pct': round((lp[f] / implicito - 1) * 100, 3),
            }
            nuevas += 1

        rs = prev['ruedas']
        if not rs:
            print(f'  {tk:5} {sym:8} sin ruedas con los dos lados')
            continue
        ult = max(rs)
        ds = sorted(r['desviacion_pct'] for r in rs.values())
        med = ds[len(ds) // 2]
        print(f'  {tk:5} {sym:8} {len(rs):4d} ruedas  ·  última {ult} '
              f'desv {rs[ult]["desviacion_pct"]:+6.2f}%  ·  mediana {med:+.2f}%  '
              f'(+{nuevas} nuevas)')

    doc['espejos'] = acum
    doc['_comment'] = (
        'Desviación diaria de Lima contra la plaza que le hace el precio a RIO y '
        'PPX: lima_usd / (casa_cad * fx) - 1. Positiva = Lima con premio. Nace '
        'del corte de R8 del 13-ago-2026, que sacó a las dos del universo por ser '
        'espejos de Toronto. Acumula hacia adelante y la rueda en curso no entra. '
        'Lo baja extractor/fetch_espejos.py.')
    doc['generado'] = datetime.now(LIMA).isoformat(timespec='seconds')
    with open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    total = sum(len(e['ruedas']) for e in acum.values())
    print(f'\nGuardado: {len(acum)} espejos, {total} ruedas en total')
    return 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(main())
