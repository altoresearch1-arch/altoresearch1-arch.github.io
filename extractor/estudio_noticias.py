# -*- coding: utf-8 -*-
"""
🔬 ESTUDIO DE NOTICIAS — que el precio pasado diga qué titular importa.

EL PROBLEMA QUE RESUELVE
------------------------
fetch_noticias.py le pone un PESO a cada titular (cuánto puede explicar un
movimiento) con una lista de palabras que escribí a mano. Funciona, pero es mi
opinión disfrazada de dato: yo decidí que "recertificación" no mueve una acción
y que "antidumping" sí. Nadie lo comprobó.

Acá se comprueba. Hay un año de titulares fechados y 18 meses de cierres
diarios en el repo. Con eso se puede preguntar lo único que importa: cuando en
el pasado salió un titular con esta palabra, ¿la acción se movió más de lo que
suele moverse, o no pasó nada?

CÓMO SE MIDE (y por qué así)
----------------------------
Para cada titular viejo:
  · base  = el cierre del día del titular (o el hábil anterior si salió un
            domingo). Es lo que el mercado sabía ANTES.
  · luego = el cierre K ruedas después.
  · fuerza = ese retorno dividido por lo que ESA acción suele moverse en K
            ruedas (su volatilidad anual escalada con la raíz del tiempo,
            igual que el Radar). Sin normalizar, las mineras se comerían todo:
            un ±4% en BVN es un martes y en Backus es un terremoto.

Se mira |fuerza| —el valor absoluto— a propósito: la pregunta no es si la
noticia era buena o mala, es si MOVIÓ. Un derrame y un dividendo mueven en
direcciones opuestas y los dos merecen estar arriba en el Radar.

Después, palabra por palabra: la |fuerza| MEDIANA de los titulares que la
contienen, contra la mediana de todos. Mediana y no promedio porque con 40-80
casos por palabra un solo día loco arrastra el promedio y cuenta una película
que no pasó.

LOS LÍMITES, QUE SON GRANDES Y VAN EN PANTALLA
----------------------------------------------
1. ESTO NO PRUEBA CAUSA. Que la acción se moviera después del titular no
   significa que se moviera POR el titular. Pudo ser el cobre, el mercado
   entero, o nada. Lo único que se mide es coincidencia en el tiempo, contada
   muchas veces para que deje de ser casualidad.
2. UN AÑO, Y DE MERCADO AL ALZA. Un tramo de bajada daría otros números.
3. LA PALABRA NO ES LA NOTICIA. "utilidad" pesa por lo que suele acompañarla,
   no por sí misma. Es una pista estadística, no comprensión.
4. POCOS CASOS = NADA. Una palabra con 5 apariciones no dice nada por más
   linda que se vea su mediana; por eso hay un mínimo y se descarta lo demás.

Uso:
  python extractor/estudio_noticias.py --bajar   # 1 año de titulares (lento, cachea)
  python extractor/estudio_noticias.py --medir   # cruza con precios y escribe pesos
  python extractor/estudio_noticias.py           # las dos cosas
"""
import io, json, math, os, random, re, sys, time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

import requests

AQUI = os.path.dirname(os.path.abspath(__file__))
APP_DATA = os.path.normpath(os.path.join(AQUI, "..", "app", "src", "data"))
CACHE = os.path.join(AQUI, "cache", "noticias_historicas.json")
SALIDA = os.path.join(APP_DATA, "pesos_noticias.json")   # el estudio (fase 2)
FILTRO = os.path.join(APP_DATA, "filtro_noticias.json")  # el filtro (fase 3)

sys.path.insert(0, AQUI)
# OJO: importar fetch_noticias YA deja stdout en UTF-8 (lo hace al cargarse).
# Volver a envolverlo acá cierra el buffer de abajo y el script muere en el
# primer print con un emoji. No agregar un io.TextIOWrapper aquí.
import fetch_noticias as FN  # reutiliza consultas, coladores y normalización

# Hasta donde LLEGAN LOS PRECIOS, que es el límite real: historicos.json arranca
# el 02-ene-2025. Bajar prensa más vieja que eso es bajar titulares que no se
# pueden cruzar con nada.
MESES_ATRAS = 19
PAUSA = 0.35
RUEDAS_EFECTO = 3      # a cuántas ruedas se mide el efecto del titular
RUEDAS_ANIO = 252
MIN_APARICIONES = 25   # menos que esto no es evidencia, es anécdota

# ── EL SESGO QUE CASI ME COME (y por qué todo se mide contra el propio ticker)
# La primera versión midió la |fuerza| cruda y coronó a la palabra «aenza» con
# lift 16.6. No era la palabra: era la ACCIÓN. AENZA se mueve 1.34× de base y
# AUNA 0.17×, así que cualquier palabra que solo aparezca en titulares de una
# empresa movida gana sin haber dicho nada. Es el error clásico de este tipo de
# estudio y se ve lindo mientras no lo revisas.
#
# Arreglo: cada titular se mide contra lo que ESA acción hace en un día
# CUALQUIERA (mediana de días al azar de su propio histórico, mismo plazo). Así
# 1.00 = "se movió como cualquier martes" y el nombre de la empresa deja de
# ser una ventaja.

# Palabras que no dicen nada de nada: pegan en todos lados y solo ensucian.
VACIAS = set("""
para por con los las del una uno unos unas que como más mas sobre entre desde
hasta este esta estos estas sus sus año años nuevo nueva nuevos nuevas ser son
fue han hay tras ante bajo cada todo toda todos todas otro otra otros otras
peru perú lima empresa empresas millones millón millon soles dolares dólares
sera será seran serán tiene tienen puede pueden hace hacen dice dijo segun según
qué cual cuales donde cuando quien quienes cómo como asi así ya no si sin
""".split())


# ═══ FASE 1: bajar un año de titulares ═════════════════════════════════════

def meses(n):
    """Los rangos [inicio, fin) mes a mes hacia atrás, en formato de Google."""
    hoy = datetime.now(timezone.utc).date().replace(day=1)
    bordes = []
    cur = hoy
    for _ in range(n + 1):
        bordes.append(cur)
        cur = (cur - timedelta(days=1)).replace(day=1)
    bordes.reverse()
    return list(zip(bordes, bordes[1:]))


def es_medio_robot(medio, url):
    """¿Lo escribió una máquina? (la lista negra de fetch_noticias, al revés)"""
    fuente = FN.norm((medio or "") + " " + (url or ""))
    return any(m in fuente for m in FN.MEDIOS_RUIDO)


def bajar():
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    previo, previo_ruido = {}, {}
    if os.path.exists(CACHE):
        try:
            with open(CACHE, encoding="utf-8") as f:
                guardado = json.load(f)
            previo = guardado.get("porEmpresa", {})
            previo_ruido = guardado.get("porEmpresaRobot", {})
        except Exception:
            pass

    with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    with open(os.path.join(APP_DATA, "historicos.json"), encoding="utf-8") as f:
        historicos = json.load(f).get("historicos", {})

    objetivo = []
    for e in cfg["empresas"]:
        t = e["ticker"]
        h = historicos.get(t)
        if not h or h.get("pocoNegociada"):
            continue
        consultas, debe = FN.consultas_de(t, e.get("nombre"))
        if consultas:
            objetivo.append((t, consultas, debe))

    ventanas = meses(MESES_ATRAS)
    s = FN.sesion()
    print(f"📥 {len(objetivo)} empresas × {len(ventanas)} meses "
          f"× {sum(len(c) for _, c, _ in objetivo) // len(objetivo)} consultas")

    por_empresa = dict(previo)
    # ── EL CONTROL NEGATIVO, y sale gratis ────────────────────────────────
    # Los medios prohibidos (TradingView, Investing, MSN…) publican páginas
    # generadas por máquina: "Desglose de los ingresos de Aenza SAA,
    # BVL:AENZAC1". No las escribió nadie y no informan de NADA — y por eso
    # mismo son oro para calibrar: son titulares de los que sabemos de
    # antemano que no dicen nada. Si el filtro los puntúa igual que a una
    # noticia de verdad, el filtro no sirve, y esa es una prueba que no se
    # puede hacer sin ellos. Salen de las MISMAS consultas: cero requests
    # extra, solo dejar de tirar lo que ya venía en la respuesta.
    ruido = dict((previo_ruido or {}))
    for i, (ticker, consultas, debe) in enumerate(objetivo, 1):
        vistos = {FN.clave_titular(n) for n in por_empresa.get(ticker, [])}
        vistos_r = {FN.clave_titular(n) for n in ruido.get(ticker, [])}
        acum = list(por_empresa.get(ticker, []))
        acum_r = list(ruido.get(ticker, []))
        nuevos = nuevos_r = 0
        for ini, fin in ventanas:
            for q in consultas:
                rango = f"{q} after:{ini.isoformat()} before:{fin.isoformat()}"
                items, err = FN.leer_items(s, FN.RSS, {"q": rango, **FN.PAIS})
                time.sleep(PAUSA)
                if items is None:
                    continue
                for bruto, url, dt in items:
                    titulo, medio = FN.partir_titular(bruto)
                    if debe and not FN.alguna(FN.norm(titulo), debe):
                        continue
                    n = FN.a_noticia(titulo, medio, url, dt)
                    k = FN.clave_titular(n)
                    if FN.util(titulo, medio, url):
                        if k in vistos:
                            continue
                        vistos.add(k)
                        acum.append(n)
                        nuevos += 1
                    elif es_medio_robot(medio, url):
                        if k in vistos_r:
                            continue
                        vistos_r.add(k)
                        acum_r.append(n)
                        nuevos_r += 1
        por_empresa[ticker] = acum
        ruido[ticker] = acum_r
        print(f"  [{i:2}/{len(objetivo)}] {ticker:10} +{nuevos:4} → {len(acum):4} titulares"
              f"  (+{nuevos_r:3} de medio-robot → {len(acum_r):4})")
        with open(CACHE, "w", encoding="utf-8") as f:
            json.dump({"generado": datetime.now(timezone.utc).isoformat(),
                       "mesesAtras": MESES_ATRAS,
                       "porEmpresa": por_empresa,
                       "porEmpresaRobot": ruido}, f, ensure_ascii=False, indent=1)

    tot = sum(len(v) for v in por_empresa.values())
    totr = sum(len(v) for v in ruido.values())
    print(f"\n✅ {CACHE} — {tot} titulares + {totr} de medio-robot (control)")
    return por_empresa


# ═══ FASE 2: cruzar con el precio y aprender ═══════════════════════════════

def mediana(l):
    l = sorted(x for x in l if x is not None)
    if not l:
        return None
    m = len(l) // 2
    return l[m] if len(l) % 2 else (l[m - 1] + l[m]) / 2


def fuerza_tras(valores, fecha, vol_anual, ruedas):
    """|movimiento| en 'vaivenes normales de esta acción' desde el cierre del
    día del titular. None si no hay historia suficiente a ambos lados."""
    if not vol_anual:
        return None
    i_base = None
    for i, (f, v) in enumerate(valores):
        if f > fecha:
            break
        if v > 0:
            i_base = i
    if i_base is None or i_base + ruedas >= len(valores):
        return None
    base = valores[i_base][1]
    luego = valores[i_base + ruedas][1]
    if not base or not luego:
        return None
    ret = (luego / base - 1) * 100
    normal = vol_anual * (ruedas / RUEDAS_ANIO) ** 0.5
    return abs(ret) / normal if normal else None


def palabras(titulo):
    t = FN.norm(titulo)
    crudas = re.findall(r"[a-zñ]{4,}", t)
    return {p for p in crudas if p not in VACIAS}


def dia_cualquiera(vals, vol, ruedas):
    """El CONTROL: cuánto se mueve esta acción en un día sin nada de por medio.
    Sin esta línea de base el estudio entero no significa nada — «después del
    titular se movió 0.5× su vaivén» solo dice algo si sabés que un día
    cualquiera se mueve 0.4×."""
    l = [fuerza_tras(vals, f, vol, ruedas) for f, _ in vals[:-ruedas - 1]]
    return mediana([x for x in l if x is not None])


def medir():
    with open(CACHE, encoding="utf-8") as f:
        hist = json.load(f)["porEmpresa"]
    with open(os.path.join(APP_DATA, "historicos.json"), encoding="utf-8") as f:
        historicos = json.load(f)["historicos"]

    casos = []  # (titulo, tipo, veces_su_dia_normal)
    sin_precio = 0
    crudo_con, crudo_sin = [], []
    for ticker, items in hist.items():
        h = historicos.get(ticker) or {}
        vals = [(f, v) for f, v in (h.get("valores") or []) if v > 0]
        vol = h.get("volatilidadAnualPct")
        if not vals or not vol or len(vals) < RUEDAS_EFECTO + 40:
            sin_precio += len(items)
            continue
        suyo = dia_cualquiera(vals, vol, RUEDAS_EFECTO)
        if not suyo:
            sin_precio += len(items)
            continue
        crudo_sin.append(suyo)
        for n in items:
            fz = fuerza_tras(vals, n["fecha"], vol, RUEDAS_EFECTO)
            if fz is None:
                sin_precio += 1
                continue
            crudo_con.append(fz)
            casos.append((n["titulo"], n.get("tipo", "general"), fz / suyo))

    if len(casos) < 200:
        print(f"⚠ solo {len(casos)} titulares medibles: muy poco para aprender nada.")
        print("  Corre primero: python extractor/estudio_noticias.py --bajar")
        return

    base = mediana([c[2] for c in casos])
    print(f"📐 {len(casos)} titulares medidos ({sin_precio} sin precio a ambos lados)")
    print(f"   Cada uno contra el día CUALQUIERA de su propia acción (1.00 = un martes normal).")
    print(f"   👉 El titular típico va seguido de {base:.2f}× lo de un día sin noticia.")
    print(f"      Ese {base:.2f} es el techo de todo esto: haber salido en el diario mueve "
          f"POCO, y a 10 ruedas ya no mueve nada.\n")

    # ── Lo que el robot ya cree (tipo escrito a mano), puesto a prueba ─────
    por_tipo = {}
    for _, tipo, fz in casos:
        por_tipo.setdefault(tipo, []).append(fz)
    print("🏷️  LO QUE YA CREÍAMOS (tipo escrito a mano) contra el precio:")
    filas_tipo = []
    for tipo, l in sorted(por_tipo.items(), key=lambda x: -(mediana(x[1]) or 0)):
        m = mediana(l)
        filas_tipo.append({"tipo": tipo, "n": len(l), "mediana": round(m, 3),
                           "lift": round(m / base, 2)})
        marca = "✓" if (m / base) >= 1.05 else ("·" if (m / base) >= 0.95 else "✗")
        print(f"   {marca} {tipo:12} n={len(l):4}  {m:.2f}×  (lift {m/base:.2f})")

    # ── Palabra por palabra ───────────────────────────────────────────────
    por_palabra = {}
    for titulo, _, fz in casos:
        for p in palabras(titulo):
            por_palabra.setdefault(p, []).append(fz)

    puntajes = []
    for p, l in por_palabra.items():
        if len(l) < MIN_APARICIONES:
            continue
        m = mediana(l)
        puntajes.append({"palabra": p, "n": len(l), "mediana": round(m, 3),
                         "lift": round(m / base, 3)})
    puntajes.sort(key=lambda x: -x["lift"])

    print(f"\n🔥 LAS QUE SÍ (de {len(puntajes)} palabras con ≥{MIN_APARICIONES} casos):")
    for x in puntajes[:22]:
        print(f"   {x['palabra']:18} n={x['n']:4}  {x['mediana']:.2f}×  lift {x['lift']:.2f}")
    print("\n❄️  LAS QUE NO:")
    for x in puntajes[-18:]:
        print(f"   {x['palabra']:18} n={x['n']:4}  {x['mediana']:.2f}×  lift {x['lift']:.2f}")

    salida = {
        "_comment": (
            "ESTUDIO, NO FILTRO. Mide cuánto se movió el precio después de cada "
            "titular, contra lo que ESA MISMA acción hace un día cualquiera. "
            "Generado por extractor/estudio_noticias.py sobre un año de prensa y los "
            "cierres reales del repo. VEREDICTO: no alcanza para filtrar. Un día con "
            "titular se mueve ~1.2x un día sin titular, el efecto desaparece a las 10 "
            "ruedas, y ninguna palabra de CONTENIDO se separa del ruido — las que "
            "puntean son nombres propios de un hecho puntual (la operación "
            "Holcim/Pacasmayo) que no se repite. Por eso el peso que usa "
            "fetch_noticias.py sigue siendo un criterio EDITORIAL declarado y no un "
            "predictor: esto es lo que se probó para no fingir que lo era. NO PRUEBA "
            "CAUSA en ningún caso, y el periodo medido fue de mercado al alza."
        ),
        "generado": datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M"),
        "titularesMedidos": len(casos),
        "ruedasEfecto": RUEDAS_EFECTO,
        "minApariciones": MIN_APARICIONES,
        "vecesUnDiaCualquiera": round(base, 3),
        "fuerzaMedianaConTitular": round(mediana(crudo_con), 3),
        "fuerzaMedianaDiaCualquiera": round(mediana(crudo_sin), 3),
        "porTipo": filas_tipo,
        "palabras": puntajes,
    }
    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=1)
    print(f"\n✅ {SALIDA}")


# ═══ FASE 3: EL FILTRO ═════════════════════════════════════════════════════
#
# Las tres cosas que le faltaban al estudio de la fase 2, que es por qué aquel
# no servía de filtro y este puede:
#
# 1. LA PREGUNTA CORRECTA. Antes medía "cuánto se movió después" (un número
#    continuo, ruidoso). Ahora pregunta lo que la app de verdad quiere saber:
#    ¿la acción CRUZÓ SU ANILLO? Es el mismo umbral que usa el Radar para decir
#    candente (|fuerza| ≥ 1). Un sí/no se estima mucho mejor con pocos datos, y
#    además el filtro queda apuntando a lo mismo que la app llama candente en
#    vez de a un proxy parecido.
#
# 2. MATAR LOS NOMBRES PROPIOS. Lo que hundió el primer intento: "aenza",
#    "holcim", "pacasmayo" ganaban por ser de una empresa movida, no por decir
#    algo. Acá se tira TODA palabra que se concentre en una sola empresa (más
#    del 60% de sus apariciones), automáticamente. Si una palabra solo aparece
#    cuando se habla de una empresa, es su nombre, no su noticia.
#
# 3. NO CREERLE A LOS POCOS CASOS. Una palabra con 8 apariciones y 5 aciertos
#    parece 62%. No lo es. Se encoge hacia el promedio general con un peso
#    ALPHA: con pocos casos la palabra dice casi nada, y solo se separa cuando
#    junta evidencia. Es lo que evita que el filtro persiga fantasmas.
#
# Y sobre todo: SE VALIDA FUERA DE MUESTRA. Se entrena con los meses viejos y
# se prueba con los nuevos, que es la única forma de saber si aprendió algo o
# se memorizó el pasado. Un filtro que no pasa esa prueba no se conecta.

ALPHA = 25          # cuánta evidencia hace falta para separarse del promedio
MIN_TOKEN = 15      # apariciones mínimas para que una palabra tenga voz
CONCENTRACION = 0.60  # más de esto en una sola empresa = es un nombre propio
UMBRAL_CANDENTE = 1.0  # el mismo del Radar: cruzó su anillo
BARAJADAS = 40         # cuántas veces juega el azar antes de dejar pasar al filtro


def tokens(titulo):
    """Palabras y pares de palabras. Los pares importan: 'utilidad' sola es
    ambigua, 'cae utilidad' no."""
    ps = [p for p in re.findall(r"[a-zñ]{4,}", FN.norm(titulo)) if p not in VACIAS]
    return set(ps) | {f"{a} {b}" for a, b in zip(ps, ps[1:])}


def casos_medibles(hist, historicos, ruedas):
    """(ticker, fecha, titulo, tipo, cruzó_su_anillo) para todo lo cruzable."""
    out = []
    for ticker, items in hist.items():
        h = historicos.get(ticker) or {}
        vals = [(f, v) for f, v in (h.get("valores") or []) if v > 0]
        vol = h.get("volatilidadAnualPct")
        if not vals or not vol:
            continue
        for n in items:
            fz = fuerza_tras(vals, n["fecha"], vol, ruedas)
            if fz is None:
                continue
            out.append((ticker, n["fecha"], n["titulo"], n.get("tipo", "general"),
                        1 if fz >= UMBRAL_CANDENTE else 0))
    return out


def entrenar(casos):
    """De los casos a una tabla palabra -> cuánto sube (o baja) la probabilidad
    de que la acción haya cruzado su anillo."""
    p0 = sum(c[4] for c in casos) / len(casos)
    conteo, aciertos, duenos = {}, {}, {}
    for ticker, _, titulo, _, y in casos:
        for t in tokens(titulo):
            conteo[t] = conteo.get(t, 0) + 1
            aciertos[t] = aciertos.get(t, 0) + y
            duenos.setdefault(t, {})
            duenos[t][ticker] = duenos[t].get(ticker, 0) + 1

    tabla, descartadas_nombre = {}, 0
    for t, n in conteo.items():
        if n < MIN_TOKEN:
            continue
        # ¿es un nombre propio disfrazado de palabra?
        if max(duenos[t].values()) / n > CONCENTRACION:
            descartadas_nombre += 1
            continue
        p = (aciertos[t] + ALPHA * p0) / (n + ALPHA)
        tabla[t] = {"n": n, "p": round(p, 4), "lift": round(p / p0, 3)}
    return p0, tabla, descartadas_nombre


def puntuar(titulo, p0, tabla):
    """El puntaje del titular: el promedio (en logaritmo) de las 3 palabras que
    más se apartan del promedio. Promedio de las 3 y no la máxima, porque una
    sola palabra rara arrastra; y en logaritmo para que subir al doble y bajar
    a la mitad pesen igual."""
    ls = [math.log(tabla[t]["lift"]) for t in tokens(titulo) if t in tabla]
    if not ls:
        return 1.0  # no conozco ninguna palabra: no opino
    ls.sort(key=abs, reverse=True)
    top = ls[:3]
    return math.exp(sum(top) / len(top))


def aprender():
    with open(CACHE, encoding="utf-8") as f:
        guardado = json.load(f)
    with open(os.path.join(APP_DATA, "historicos.json"), encoding="utf-8") as f:
        historicos = json.load(f)["historicos"]

    casos = casos_medibles(guardado["porEmpresa"], historicos, RUEDAS_EFECTO)
    casos.sort(key=lambda c: c[1])  # por fecha: el corte de validación es TEMPORAL
    if len(casos) < 800:
        print(f"⚠ {len(casos)} casos: muy poco. Corre --bajar primero.")
        return

    corte = int(len(casos) * 0.70)
    fecha_corte = casos[corte][1]
    train, test = casos[:corte], casos[corte:]
    p0, tabla, desc = entrenar(train)
    p0_test = sum(c[4] for c in test) / len(test)

    print(f"📚 {len(casos)} titulares cruzables")
    print(f"   entreno con {len(train)} (hasta {fecha_corte}) · pruebo con {len(test)} (después)")
    print(f"   {len(tabla)} palabras con voz · {desc} descartadas por ser nombre propio")
    print(f"   De base, {p0*100:.1f}% de los titulares van seguidos de un cruce "
          f"de anillo (en la prueba, {p0_test*100:.1f}%)\n")

    # ── LA PRUEBA DE FUEGO: fuera de muestra ──────────────────────────────
    puntuados = [(puntuar(t, p0, tabla), y) for _, _, t, _, y in test]
    puntuados.sort(key=lambda x: -x[0])
    q = max(1, len(puntuados) // 4)
    alto = puntuados[:q]
    bajo = puntuados[-q:]
    r_alto = sum(y for _, y in alto) / len(alto)
    r_bajo = sum(y for _, y in bajo) / len(bajo)
    ventaja = r_alto - p0_test
    print("🎯 FUERA DE MUESTRA (meses que el filtro nunca vio):")
    print(f"   cuarto MEJOR puntuado : {r_alto*100:5.1f}% cruzó su anillo  (n={len(alto)})")
    print(f"   cuarto PEOR  puntuado : {r_bajo*100:5.1f}% cruzó su anillo  (n={len(bajo)})")
    print(f"   base                  : {p0_test*100:5.1f}%")
    print(f"   ventaja sobre la base : {ventaja*100:+.1f} puntos")

    # ── LA PRUEBA QUE DECIDE: barajar las etiquetas ───────────────────────
    # Ganarle a la base no basta. Con 3,400 titulares y cientos de palabras,
    # SIEMPRE aparece alguna combinación que parece funcionar — la primera
    # versión de esto sacó +5.2 puntos y se caía sola: barajando las etiquetas
    # (rompiendo a propósito toda relación entre titular y precio) el azar
    # llegaba a +6.0 y superaba al filtro 1 de cada 10 veces.
    # Así que el filtro tiene que ganarle al azar jugando el azar con las
    # mismas cartas: se rompe la relación, se reentrena, y la ventaja real
    # tiene que quedar por encima de TODAS las barajadas.
    print(f"\n🎲 Prueba del azar ({BARAJADAS} barajadas: mismos titulares, precios revueltos)")
    random.seed(4)
    nulos = []
    for _ in range(BARAJADAS):
        ys = [c[4] for c in casos]
        random.shuffle(ys)
        falsos = [(a, b, c, d, y) for (a, b, c, d, _), y in zip(casos, ys)]
        ftr, fte = falsos[:corte], falsos[corte:]
        fp0, ftabla, _ = entrenar(ftr)
        if not ftabla:
            continue
        fps = sorted(((puntuar(t, fp0, ftabla), y) for _, _, t, _, y in fte),
                     key=lambda x: -x[0])
        fq = max(1, len(fps) // 4)
        nulos.append(sum(y for _, y in fps[:fq]) / fq - sum(c[4] for c in fte) / len(fte))
    nulos.sort()
    superan = sum(1 for v in nulos if v >= ventaja)
    print(f"   el azar llega a: mediana {nulos[len(nulos)//2]*100:+.1f} · "
          f"tope {nulos[-1]*100:+.1f} puntos")
    print(f"   barajadas que igualan o superan al filtro: {superan} de {len(nulos)}")

    sirve = ventaja > 0 and superan == 0 and r_alto / max(r_bajo, 1e-9) >= 1.25
    print(f"\n   → {'✅ SE LO GANÓ: se conecta.' if sirve else '❌ NO SE DISTINGUE DEL AZAR: queda desconectado.'}\n")

    # ── El control negativo: los medios-robot ─────────────────────────────
    robot = casos_medibles(guardado.get("porEmpresaRobot", {}), historicos, RUEDAS_EFECTO)
    if robot:
        pr = [puntuar(t, p0, tabla) for _, _, t, _, _ in robot]
        pn = [puntuar(t, p0, tabla) for _, _, t, _, _ in test]
        print(f"🤖 CONTROL con {len(robot)} titulares de medio-robot (TradingView y compañía),")
        print(f"   que sabemos que no informan de nada:")
        print(f"   puntaje mediano robot  : {mediana(pr):.3f}")
        print(f"   puntaje mediano prensa : {mediana(pn):.3f}")
        print(f"   → el filtro {'los distingue' if mediana(pn) > mediana(pr) else 'NO los distingue'}\n")

    # ── El rival a batir: mi tabla escrita a mano ─────────────────────────
    print("🥊 CONTRA LA TABLA ESCRITA A MANO (mismo test):")
    for peso in sorted({FN.PESOS.get(c[3], 1) for c in test}, reverse=True):
        l = [c for c in test if FN.PESOS.get(c[3], 1) == peso]
        if l:
            print(f"   peso {peso}: {sum(c[4] for c in l)/len(l)*100:5.1f}% cruzó "
                  f"(n={len(l)})")

    puntas = sorted(tabla.items(), key=lambda x: -x[1]["lift"])
    print("\n🔥 LO QUE APRENDIÓ (arriba) / ❄️ LO QUE APAGA (abajo):")
    for t, d in puntas[:14]:
        print(f"   + {t:26} n={d['n']:4} {d['p']*100:5.1f}%  ×{d['lift']}")
    for t, d in puntas[-10:]:
        print(f"   - {t:26} n={d['n']:4} {d['p']*100:5.1f}%  ×{d['lift']}")

    salida = {
        "_comment": (
            "FILTRO APRENDIDO: cuánto sube o baja cada palabra la probabilidad de que "
            "la acción haya CRUZADO SU ANILLO (|fuerza| >= 1, el mismo umbral que el "
            "Radar llama candente) en las " + str(RUEDAS_EFECTO) + " ruedas siguientes. "
            "Entrenado por extractor/estudio_noticias.py con los meses viejos y "
            "VALIDADO con los nuevos, que el filtro nunca vio. Se tiran las palabras "
            "que se concentran en una sola empresa (son nombres propios, no noticias) "
            "y las de pocos casos se encogen hacia el promedio. NO PRUEBA CAUSA: mide "
            "con qué suele coincidir una palabra, no qué provoca."
        ),
        "generado": datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M"),
        "ruedas": RUEDAS_EFECTO, "umbralCandente": UMBRAL_CANDENTE,
        "baseCandente": round(p0, 4),
        "entrenadoCon": len(train), "probadoCon": len(test), "corteFecha": fecha_corte,
        "fueraDeMuestra": {"cuartoAlto": round(r_alto, 4), "cuartoBajo": round(r_bajo, 4),
                           "base": round(p0_test, 4), "ventaja": round(ventaja, 4),
                           "azarTope": round(nulos[-1], 4) if nulos else None,
                           "azarSupera": superan, "barajadas": len(nulos),
                           "separa": bool(sirve)},
        "palabras": {t: d["lift"] for t, d in tabla.items()},
        "detalle": tabla,
    }
    with open(FILTRO, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=1)
    print(f"\n✅ {FILTRO}")


def main():
    solo = {"--bajar", "--medir", "--aprender"} & set(sys.argv)
    if "--bajar" in sys.argv or not solo:
        bajar()
    if "--medir" in sys.argv or not solo:
        medir()
    if "--aprender" in sys.argv or not solo:
        aprender()


if __name__ == "__main__":
    main()
