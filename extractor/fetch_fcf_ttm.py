# -*- coding: utf-8 -*-
"""
FLUJO DE CAJA LIBRE DE 12 MESES REALES (TTM) para el semáforo "💸 ¿Se lo puede
pagar?" del dividendo. Pedido del 23-jul-2026.

EL PROBLEMA
El semáforo comparaba lo que la empresa reparte al año contra su flujo de caja
libre de UN trimestre × 4. En la mayoría funciona, pero un trimestre atípico
lo vuelve un veredicto falso y muy duro: Pacasmayo salía "reparte más de lo que
le entra" con un ratio de 442x solo porque su Q1 tuvo el flujo casi en cero
(estacionalidad de la construcción, no un problema de la empresa). Ese es el
error que cuesta credibilidad — y el semáforo está EN VIVO en todos los niveles.

LA SOLUCIÓN, CON DOS DESCARGAS POR EMPRESA
Los estados de flujo de efectivo de la SMV son ACUMULADOS del año (enero a la
fecha de cierre), y cada filing intermedio trae ADEMÁS la columna comparativa
del mismo periodo del año anterior. Con eso, la identidad de siempre:

    FCF 12 meses = FCF año pasado completo − acumulado del año pasado al mismo
                   corte + acumulado de este año

Ejemplo Q1-2026: FY2025 − (ene-mar 2025) + (ene-mar 2026) = abr 2025 → mar 2026.
Solo hacen falta el intermedio en curso (trae los dos acumulados) y el anual del
año pasado. Nada se estima, nada se anualiza.

DE PASO ARREGLA UNA BOMBA DE TIEMPO
El × 4 no solo era ruidoso: iba a ser DOBLE de grande apenas entre el Q2. Como
el flujo de efectivo se presenta acumulado, el filing de Q2 trae seis meses, y
multiplicarlo por 4 daría dos años de flujo. Con TTM el trimestre no importa.

REGLAS DE ORO
#1 si falta cualquiera de las tres piezas, la empresa NO sale en este archivo
   (la app cae sola al método viejo y lo dice) · #3 moneda original, sin
   convertir · #6 se guardan las tres piezas y las dos fechas de presentación
   para que cualquiera pueda rehacer la resta.

Caché en cache_fcf/ (un JSON por filing): el anual del año pasado no cambia
nunca; re-correr solo baja lo que falte.

Escribe app/src/data/fcf_ttm.json. Correr después de run_batch (cuando cambia
el trimestre vigente), no a diario: estos números se mueven una vez por trimestre.

Uso:
    python fetch_fcf_ttm.py                  # todas
    python fetch_fcf_ttm.py CPACASC1 BVN     # solo esas
"""
import sys, json, os, time
sys.stdout.reconfigure(encoding="utf-8")
from smv_extractor import (nueva_sesion, buscar_documentos, descargar,
                           _parse_root, XBRLI)

AQUI = os.path.dirname(os.path.abspath(__file__))
APP_DATA = os.path.normpath(os.path.join(AQUI, "..", "app", "src", "data"))
CACHE = os.path.join(AQUI, "cache_fcf")
os.makedirs(CACHE, exist_ok=True)
SALIDA = os.path.join(APP_DATA, "fcf_ttm.json")

OPERATIVO = ["CashFlowsFromUsedInOperatingActivities"]
CAPEX = ["PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"]

with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
    CFG = json.load(f)

ANIO = CFG["anio"]
TRIMESTRE = CFG["trimestre"]

# Bancos, aseguradoras, AFPs y fondos: su "flujo de caja libre" no significa lo
# mismo (su negocio ES mover plata) y la app ya no les muestra el semáforo.
# Se saltan aquí también para no gastar descargas.
SECTORES_FUERA = {"bancos", "seguros", "afp", "fondos"}


def flujos_por_periodo(raw):
    """Del XBRL: {(inicio, fin): {'operativo': v, 'capex': v}} para TODAS las
    duraciones sin dimensión. Devuelve además la moneda.

    Se recorren TODAS las duraciones a propósito (y no solo la que termina en la
    fecha de cierre, como hace smv_extractor): lo que buscamos justamente es la
    columna COMPARATIVA del año anterior, que vive en otra duración del mismo
    archivo."""
    root = _parse_root(raw)
    nsmap = {k: v for k, v in root.nsmap.items() if k}
    ifrs = nsmap.get("ifrs-full")
    if not ifrs:
        return {}, None

    # contextos de duración SIN dimensión: id -> (inicio, fin)
    ctx = {}
    for c in root.findall(f"{{{XBRLI}}}context"):
        period = c.find(f"{{{XBRLI}}}period")
        if period is None:
            continue
        ini = period.find(f"{{{XBRLI}}}startDate")
        fin = period.find(f"{{{XBRLI}}}endDate")
        if ini is None or fin is None:
            continue
        seg = c.find(f"{{{XBRLI}}}entity/{{{XBRLI}}}segment")
        scen = c.find(f"{{{XBRLI}}}scenario")
        if (seg is not None and len(seg)) or (scen is not None and len(scen)):
            continue  # con dimensión: es un segmento, no el total
        ctx[c.get("id")] = (ini.text, fin.text)

    # ⚠️ LA MONEDA DEL XBRL NO SE PUEDE CREER (verificado 23-jul-2026 con
    # Alicorp): su archivo declara UNA sola unidad monetaria, "iso4217:USD", y
    # las cifras son SOLES — su flujo operativo de 463,990,000 calza exacto con
    # el S/ 433.7 M de FCF que ya tiene la app. Se guarda como monedaXbrl solo
    # para dejar rastro, pero quien manda es `monedaEstados` de empresas.json,
    # que está curada a mano (Regla #3). La app NO lee este campo.
    unidades = {}
    for u in root.findall(f"{{{XBRLI}}}unit"):
        m = u.find(f"{{{XBRLI}}}measure")
        if m is not None and m.text and "iso4217" in m.text:
            unidades[u.get("id")] = m.text.split(":")[-1].upper()

    moneda = None
    out = {}
    for el in root.iter():
        tag = el.tag
        if not isinstance(tag, str) or "}" not in tag:
            continue
        uri, local = tag[1:].split("}")
        if uri != ifrs:
            continue
        campo = ("operativo" if local in OPERATIVO
                 else "capex" if local in CAPEX else None)
        if not campo:
            continue
        per = ctx.get(el.get("contextRef"))
        if not per:
            continue
        txt = (el.text or "").strip()
        if txt == "":
            continue
        try:
            v = float(txt)
        except ValueError:
            continue
        # El primero gana: mismo criterio que smv_extractor.valor()
        out.setdefault(per, {}).setdefault(campo, v)
        if moneda is None:
            moneda = unidades.get(el.get("unitRef"))
    return out, moneda


def fcf_de(periodos, inicio, fin):
    """FCF (operativo − capex) de una duración exacta. None si falta una pieza:
    un capex ausente NO es un cero (Regla #1)."""
    d = periodos.get((inicio, fin))
    if not d or d.get("operativo") is None or d.get("capex") is None:
        return None
    return d["operativo"] - d["capex"]


def acumulado_del_anio(periodos, anio, fin=None):
    """El acumulado que ARRANCA el 1 de enero de `anio`. Si se da `fin`, exige
    esa fecha de cierre; si no, devuelve el más largo (el del corte más nuevo).
    Devuelve (fcf, inicio, fin) o (None, None, None)."""
    cands = [(i, f) for (i, f) in periodos
             if i == f"{anio}-01-01" and (fin is None or f == fin)]
    if not cands:
        return None, None, None
    cands.sort(key=lambda p: p[1])
    i, f = cands[-1]
    return fcf_de(periodos, i, f), i, f


def bajar(smv_id, anio, trimestre, periodo, ticker):
    """XBRL de un filing, con caché en disco (los periodos viejos no cambian)."""
    nombre = f"{ticker}_{periodo}{anio}T{trimestre}.json"
    ruta = os.path.join(CACHE, nombre)
    if os.path.exists(ruta):
        with open(ruta, encoding="utf-8") as fh:
            g = json.load(fh)
        return {tuple(k.split("|")): v for k, v in g["periodos"].items()}, g["moneda"], g["fecha"]

    # ⚠️ Sesión NUEVA por filing. El buscador de la SMV es un formulario
    # ASP.NET con VIEWSTATE: si se reusa la sesión para otra empresa, el estado
    # de la anterior queda pegado y la búsqueda vuelve vacía (Alicorp daba "sin
    # XBRL anual" con sesión compartida y lo encontraba 3 de 3 veces con sesión
    # limpia). El costo son dos page loads extra por filing.
    s = nueva_sesion()
    docs = buscar_documentos(s, smv_id, anio, trimestre, periodo)
    if not docs.get("xbrl"):
        return None, None, None
    raw = descargar(s, docs["xbrl"])
    periodos, moneda = flujos_por_periodo(raw)
    time.sleep(0.8)
    with open(ruta, "w", encoding="utf-8") as fh:
        json.dump({"moneda": moneda, "fecha": docs.get("fecha"),
                   "periodos": {"|".join(k): v for k, v in periodos.items()}},
                  fh, ensure_ascii=False, indent=1)
    return periodos, moneda, docs.get("fecha")


def una_empresa(e):
    ticker = e["ticker"]
    # 1. El intermedio en curso: trae el acumulado de este año Y el comparativo.
    inter, moneda, fecha_inter = bajar(e["smvId"], ANIO, TRIMESTRE, "T", ticker)
    if not inter:
        return None, "sin XBRL intermedio"
    ytd_hoy, ini_hoy, fin_hoy = acumulado_del_anio(inter, ANIO)
    if ytd_hoy is None:
        return None, "sin acumulado de este año (o sin capex tagueado)"
    # El mismo corte, un año antes: 2026-03-31 -> 2025-03-31
    fin_previo = f"{ANIO - 1}{fin_hoy[4:]}"
    ytd_previo, _, _ = acumulado_del_anio(inter, ANIO - 1, fin_previo)
    if ytd_previo is None:
        return None, "el filing no trae la columna comparativa completa"

    # 2. El anual del año pasado (el trimestre 4 es el que la SMV usa para "A").
    anual, _, fecha_anual = bajar(e["smvId"], ANIO - 1, 4, "A", ticker)
    if not anual:
        return None, "sin XBRL anual del año pasado"
    fy, ini_fy, fin_fy = acumulado_del_anio(anual, ANIO - 1, f"{ANIO - 1}-12-31")
    if fy is None:
        return None, "el anual no trae el flujo completo"

    # ⚠️ Regla de Jair («si ves 0 revisa de nuevo»): hay emisoras que taguean el
    # flujo de efectivo en 0.000 en TODOS los periodos (IPCHBC1, un holding, lo
    # hace en los tres). Un cero tagueado NO es un flujo de cero: es un campo
    # sin llenar. Publicarlo haría que la app dijera "paga sin flujo libre"
    # sobre un dato que no existe → no sale, y cae al método viejo (Regla #1).
    if fy == 0 and ytd_previo == 0 and ytd_hoy == 0:
        return None, "el XBRL trae el flujo en 0.000 en los tres periodos (campo sin llenar)"

    ttm = fy - ytd_previo + ytd_hoy
    return {
        "fcf": ttm,
        "monedaXbrl": moneda,
        "desde": fin_previo, "hasta": fin_hoy,
        "piezas": {
            "anualPrevio": fy, "acumuladoPrevio": ytd_previo, "acumuladoActual": ytd_hoy,
            "anio": ANIO, "trimestre": TRIMESTRE,
        },
        "fuente": {
            "intermedio": f"EE.FF. intermedios {ANIO}-T{TRIMESTRE} (SMV, presentado {fecha_inter})",
            "anual": f"EE.FF. anuales {ANIO - 1} (SMV, presentado {fecha_anual})",
        },
    }, None


def main():
    pedidos = [a.upper() for a in sys.argv[1:]]
    empresas = [e for e in CFG["empresas"]
                if e.get("sector") not in SECTORES_FUERA
                and (not pedidos or e["ticker"] in pedidos)]
    print(f"FCF de 12 meses · {ANIO}-T{TRIMESTRE} · {len(empresas)} empresas")

    salida = {}
    if os.path.exists(SALIDA):
        with open(SALIDA, encoding="utf-8") as fh:
            salida = json.load(fh).get("empresas", {})

    ok = fallo = 0
    for i, e in enumerate(empresas, 1):
        t = e["ticker"]
        try:
            dato, motivo = una_empresa(e)
        except Exception as ex:
            dato, motivo = None, f"{type(ex).__name__}: {ex}"
        if dato:
            salida[t] = dato
            ok += 1
            print(f"[{i}/{len(empresas)}] {t:10s} FCF 12m = {dato['fcf']:,.0f}"
                  f"  ({dato['desde']} → {dato['hasta']})")
        else:
            salida.pop(t, None)  # que no quede un TTM viejo de otro trimestre
            fallo += 1
            print(f"[{i}/{len(empresas)}] {t:10s} — {motivo}")
        # Guardado incremental: si se corta la corrida, no se pierde lo bajado.
        with open(SALIDA, "w", encoding="utf-8") as fh:
            json.dump({
                "_comment": ("Flujo de caja libre de los ÚLTIMOS 12 MESES (TTM) por "
                             "empresa: anual del año pasado − su acumulado al mismo "
                             "corte + el acumulado de este año. Generado por "
                             "extractor/fetch_fcf_ttm.py — no editar a mano. Las "
                             "empresas que no están aquí es porque les faltaba alguna "
                             "pieza: la app cae sola al trimestre × 4 y lo dice."),
                "generado": time.strftime("%Y-%m-%d"),
                "periodo": {"anio": ANIO, "trimestre": TRIMESTRE},
                "fuente": "SMV — EE.FF. individuales (XBRL estructurado)",
                "empresas": salida,
            }, fh, ensure_ascii=False, indent=1)

    print(f"\nListo: {ok} con 12 meses reales · {fallo} sin las tres piezas → {SALIDA}")


if __name__ == "__main__":
    main()
