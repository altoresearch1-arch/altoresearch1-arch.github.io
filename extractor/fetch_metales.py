# -*- coding: utf-8 -*-
"""🥇 EL PRECIO DIARIO DE LOS METALES — lo que faltaba para poder medir.

POR QUÉ EXISTE. `cotizaciones.json` trae los metales del BCRP, que los publica
MENSUALES. Con eso se puede contar la historia de un año pero no se puede
responder la pregunta que importa un viernes a las nueve: «el oro abrió
volando, ¿eso mueve a mis mineras hoy?».

Es el único canal con mecanismo DOCUMENTADO que este laboratorio nunca pudo
medir. Y no es teoría: el informe de discusión de gerencia de Volcan del
21-jul-2026 lo dice con todas las letras — «el margen bruto aumentó de 35% a
40% por el incremento en los precios de los metales, principalmente de la
plata». El ingreso de la empresa se mueve con el metal; lo que falta es la
serie diaria para medir si el precio de la acción lo sigue, cuándo y cuánto.

HACIA ADELANTE Y NADA MÁS. Igual que con el volumen y las puntas: lo que no se
guarda hoy no se recupera. El archivo acumula; no se rehace.

FUENTE: Yahoo Finance (futuros). Se eligió sobre el LME porque es gratis, no
pide clave y devuelve JSON. Los símbolos se verifican al correr: si uno deja de
contestar, se anota como faltante en vez de romper la corrida — el robot ya se
salta turnos y una excepción acá se lleva puesta la rueda entera.

    python extractor/fetch_metales.py
"""
import json, os, ssl, sys, urllib.request
from datetime import datetime, timezone, timedelta

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(AQUI, '..', 'app', 'src', 'data', 'metales_diarios.json')
LIMA = timezone(timedelta(hours=-5))

# El metal de cada acción está curado en app/src/lib/cotizacion.js. Estos son
# los cuatro que mueven a la BVL: oro y plata (preciosos, refugio) contra cobre
# y zinc (industriales, crecimiento). Se separan así porque un día de dato
# macro los manda para lados opuestos y ahí es donde el dato sirve.
METALES = [
    ('oro',    'GC=F', 'precioso'),
    ('plata',  'SI=F', 'precioso'),
    ('cobre',  'HG=F', 'industrial'),
    # Zinc: Yahoo no lo publica (ZINC=F, ZN=F y variantes devuelven 404). Queda
    # pendiente y hay que sacarlo del LME o de investing.com. Duele porque Nexa
    # y Atacocha son zinc; Volcan es plata segun su propia gerencia.
    ('platino', 'PL=F', 'precioso'),
    # ── EL PETRÓLEO (10-ago-2026) ────────────────────────────────────────
    # No es un metal y por eso hay que justificar que viva acá: es la misma
    # cañería —Yahoo, diario, acumula— y la pregunta que responde es de la
    # misma familia. Entra por dos canales de SIGNO OPUESTO y nadie midió cuál
    # pesa en la BVL:
    #   · como COSTO: la energía es insumo minero, un salto aprieta márgenes
    #   · como INFLACIÓN: crudo arriba -> expectativa de inflación -> oro arriba
    # Y hay un motivo del día: el estrecho de Ormuz está cerrado desde el
    # 19-jun-2026 y el crudo pasó de 117.63 a ~82 CON el estrecho cerrado. Esa
    # caída con el cierre vigente es el hecho a explicar, y sin la serie diaria
    # no se puede saber si cayó EN los altos el fuego o si venía cayendo igual.
    # Brent además de WTI porque el crudo de Medio Oriente cotiza contra Brent.
    ('petroleo_wti',   'CL=F', 'energia'),
    ('petroleo_brent', 'BZ=F', 'energia'),
]

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


def bajar(sym, rango='2y'):
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
            out[f] = round(float(c), 4)
    return out


def main():
    doc = {'_comment': '', 'metales': {}}
    if os.path.exists(SALIDA):
        try:
            with open(SALIDA, encoding='utf-8') as f:
                doc = json.load(f)
        except Exception:
            pass
    acum = doc.get('metales') or {}

    print('Metales diarios — Yahoo Finance')
    for nombre, sym, familia in METALES:
        try:
            serie = bajar(sym)
        except Exception as e:
            print(f'  {nombre:9} {sym:8} ERROR {type(e).__name__} — se salta')
            continue
        if not serie:
            print(f'  {nombre:9} {sym:8} sin datos — el símbolo no existe o no contestó')
            continue
        prev = acum.setdefault(nombre, {'simbolo': sym, 'familia': familia, 'cierres': {}})
        prev['simbolo'], prev['familia'] = sym, familia
        # Solo se AGREGAN fechas nuevas. Un cierre ya guardado no se reescribe:
        # el proveedor puede corregir hacia atrás y eso reescribiría la historia
        # con la que ya se midió.
        #
        # LA RUEDA DE HOY NO ENTRA (arreglado 13-ago-2026). Yahoo devuelve la
        # fecha de hoy con el precio EN VIVO, no con la settlement. Combinado con
        # la regla de arriba, el primer valor que se ve queda grabado COMO SI
        # fuera el cierre y ya nadie lo corrige. Así se envenenaron tres ruedas:
        # el 10-ago quedó en 4441.20 cuando cerró en 4361.80, y el 12-ago en
        # 4469.00 cuando cerró en 4408.90 — errores de +1.8% y +1.4% metidos
        # justo en la variable que R8 usa para llamar la dirección. La bitácora
        # del 13-ago decía «oro +1.96%» y el movimiento real fue +0.59%: por
        # debajo del corte de 1% donde la regla tiene su 71.8%.
        #
        # Se salta la fecha de hoy en Nueva York, que es donde settlean estos
        # futuros. Nada se pierde: la corrida siguiente pide 2 años de rango y
        # trae la rueda de ayer ya cerrada.
        hoy_ny = datetime.now(timezone(timedelta(hours=-4))).strftime('%Y-%m-%d')
        nuevas = 0
        for f, c in serie.items():
            if f >= hoy_ny:
                continue
            if f not in prev['cierres']:
                prev['cierres'][f] = c
                nuevas += 1
        # Se reporta la última rueda GUARDADA, no la última que devolvió Yahoo:
        # si se imprimiera la de hoy parecería que entró, y justo no entra.
        ult = max(prev['cierres']) if prev['cierres'] else None
        if ult is None:
            print(f'  {nombre:9} {sym:8} sin ruedas cerradas todavía')
            continue
        print(f'  {nombre:9} {sym:8} {prev["cierres"][ult]:>10.3f} al {ult}   '
              f'(+{nuevas} ruedas nuevas, {len(prev["cierres"])} en total)')

    doc['metales'] = acum
    doc['_comment'] = ('Cierres DIARIOS de los metales que mueven a la BVL. El BCRP '
                       '(cotizaciones.json) solo los publica mensuales, y con eso no se '
                       'puede medir si el metal de la mañana mueve a la minera del día. '
                       'Acumula hacia adelante: una fecha guardada no se reescribe. '
                       'Lo baja extractor/fetch_metales.py.')
    doc['generado'] = datetime.now(LIMA).isoformat(timespec='seconds')
    with open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    total = sum(len(m['cierres']) for m in acum.values())
    print(f'\nGuardado: {len(acum)} metales, {total} cierres en total')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
