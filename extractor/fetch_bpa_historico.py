# -*- coding: utf-8 -*-
"""
Serie HISTÓRICA del BPA (utilidad básica por acción, EE.FF. INDIVIDUALES SMV)
para la gráfica "BPA" de la ficha (nivel 3): ANUAL año por año Y TRIMESTRAL
(mismo trimestre a través de los años / un año desglosado Q1→Q4).
Pedidos de Jair 21-jul-2026.

Cómo junta tanto con pocas descargas (cada XBRL trae su periodo Y el
comparativo del año anterior):
 - ANUAL (auditado, periodo "A") de 2025/2023/2021 → serie anual 2020-2025.
 - TRIMESTRAL (intermedio, periodo "T") T1-T4 de 2025/2023/2021 → los 24
   trimestres 2020-2025. El "Q4 intermedio" EXISTE (hallazgo de Jair: la SMV
   lo recibe en enero con la columna oct-dic separada + el año completo) —
   verificado con UNACEM 2023: Q4 0.097 / anual 0.202. Nada se deriva.
 - El trimestre EN CURSO (hoy Q1-2026) se siembra de empresas.json
   (epsTrimestreRaw, ya bajado por run_batch) sin descargar nada.

Caché en cache_bpa/ (un JSON por filing): los periodos viejos NUNCA cambian;
re-correr solo baja lo que falte. Cuando salga un periodo nuevo (ej. el anual
2026 en marzo-2027): agregar el año a ANIOS_XBRL/ANIOS_TRIM y correr de nuevo.

BANCOS: presentan detalle HTML (sin XBRL) con UN solo EPS por filing y sin
aclarar si es del trimestre o acumulado → solo serie ANUAL (honesto).

Reglas de Oro: #1 (periodo sin dato = hueco, no se inventa), #3 (moneda
original), #6 (fuente en cada serie). Los tickers de fix_eps.TICKERS se
EXCLUYEN: su EPS del XBRL individual no representa a la acción que cotiza.

Escribe app/src/data/bpa_historico.json (incremental: guarda tras cada empresa).
"""
import sys, json, os, time
sys.stdout.reconfigure(encoding="utf-8")
from smv_extractor import (nueva_sesion, buscar_documentos, descargar,
                           parsear_detalle_banco, _parse_root, XBRLI)
from fix_eps import TICKERS as DISTORSIONADOS

AQUI = os.path.dirname(os.path.abspath(__file__))
APP_DATA = os.path.normpath(os.path.join(AQUI, "..", "app", "src", "data"))
CACHE = os.path.join(AQUI, "cache_bpa")
os.makedirs(CACHE, exist_ok=True)
SALIDA = os.path.join(APP_DATA, "bpa_historico.json")

# Años de PRESENTACIÓN a pedir (cada filing trae su año + el comparativo).
ANIOS_XBRL = [2025, 2023, 2021]     # anual auditado (periodo "A")
ANIOS_TRIM = [2025, 2023, 2021]     # T1-T4 intermedios (periodo "T")
ANIOS_BANCO = [2025, 2024, 2023, 2022, 2021]  # bancos: solo anual, año por año

MOTIVO_EXCLUSION = ("El BPA del XBRL individual no representa a la acción que cotiza "
                    "(clase de acción/holding/moneda — mismo motivo que fix_eps.py); "
                    "graficarlo engañaría.")

# 22-jul (pedido de Jair): algunos de fix_eps SÍ reportan una utilidad por acción
# COHERENTE en la SMV y se pueden mostrar CON nota. Pero SOLO los verificados:
# - Volcan ✅: individual US$0.03 (2025), consolidado ~US$0.057 → la nota calza
#   (el consolidado es mayor, efecto holding; la serie 2020−0.01→2025 0.03 es limpia).
# - Minsur/Backus ❌: su individual va en OTRA base de acciones (Minsur S/21 con
#   acción a ~S/4 → P/E 0.2; Backus S/23 vs corregido S/2.6) → distorsionado de
#   verdad, la nota diría lo contrario. Siguen excluidos.
# Ampliar SOLO tras verificar que el individual es coherente con la acción que cotiza.
MOSTRAR_INDIVIDUAL = {"VOLCABC1"}
NOTA_INDIVIDUAL = ("Este BPA es el que la empresa reporta en sus estados INDIVIDUALES "
                   "(solo la matriz), en su moneda original. Como es un holding, el P/E "
                   "de «¿Barata o cara?» usa el resultado CONSOLIDADO (todo el grupo), "
                   "que suele ser mayor: por eso estas barras y ese P/E no calzan número "
                   "con número.")

with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
    CFG = json.load(f)


def eps_por_duracion(raw):
    """Del XBRL: TODAS las duraciones con EPS → {'inicio|fin': valor} + moneda.
    Preferencia de clase igual que smv_extractor: acción COMÚN (OrdinaryShares);
    si no hay, contexto sin dimensión; si no, el primer candidato."""
    root = _parse_root(raw)
    nsmap = {k: v for k, v in root.nsmap.items() if k}
    ifrs = nsmap.get("ifrs-full")

    contexts = {}   # id -> ('inicio|fin', miembro_dimensional)
    for ctx in root.findall(f"{{{XBRLI}}}context"):
        cid = ctx.get("id")
        period = ctx.find(f"{{{XBRLI}}}period")
        end = period.find(f"{{{XBRLI}}}endDate")
        start = period.find(f"{{{XBRLI}}}startDate")
        if end is None or start is None:
            continue
        miembros = []
        for cont in (ctx.find(f"{{{XBRLI}}}entity/{{{XBRLI}}}segment"),
                     ctx.find(f"{{{XBRLI}}}scenario")):
            if cont is not None:
                for m in cont:
                    miembros.append((m.text or "").strip())
        contexts[cid] = (f"{start.text}|{end.text}", " ".join(miembros))

    moneda = None
    for u in root.findall(f"{{{XBRLI}}}unit"):
        measure = u.find(f"{{{XBRLI}}}measure")
        if measure is not None and measure.text and "iso4217" in measure.text:
            moneda = measure.text.split(":")[-1].upper()
            break

    candidatos = {}  # 'inicio|fin' -> [(miembro, valor)]
    for el in root.iter():
        tag = el.tag
        if not isinstance(tag, str) or "}" not in tag:
            continue
        uri, local = tag[1:].split("}")
        if uri != ifrs or local != "BasicEarningsLossPerShare":
            continue
        c = contexts.get(el.get("contextRef"))
        txt = (el.text or "").strip()
        if not c or txt == "":
            continue
        try:
            v = float(txt)
        except ValueError:
            continue
        candidatos.setdefault(c[0], []).append((c[1], v))

    dur = {}
    for clave, cands in candidatos.items():
        elegido = None
        for miembro, v in cands:
            if "OrdinaryShares" in miembro:
                elegido = v
                break
        if elegido is None:
            for miembro, v in cands:
                if miembro == "":
                    elegido = v
                    break
        if elegido is None:
            elegido = cands[0][1]
        dur[clave] = elegido
    return dur, moneda


def periodo_de(clave):
    """'2023-10-01|2023-12-31' → ('2023','Q4') · año completo → ('2023','A') ·
    otras duraciones (6M/9M acumulados) → None."""
    ini, fin = clave.split("|")
    if ini[:4] != fin[:4]:
        return None
    a = fin[:4]
    tramo = (ini[5:10], fin[5:10])
    if tramo == ("01-01", "12-31"):
        return (a, "A")
    if tramo == ("01-01", "03-31"):
        return (a, "Q1")
    if tramo == ("04-01", "06-30"):
        return (a, "Q2")
    if tramo == ("07-01", "09-30"):
        return (a, "Q3")
    if tramo == ("10-01", "12-31"):
        return (a, "Q4")
    return None


def bajar_filing(s, c, anio, trimestre, periodo):
    """Baja y parsea UN filing. Cacheable: {'tipo', 'dur': {...}, 'moneda'}."""
    docs = buscar_documentos(s, c["smvId"], anio=anio, trimestre=trimestre, periodo=periodo)
    if docs.get("xbrl"):
        dur, moneda = eps_por_duracion(descargar(s, docs["xbrl"]))
        return {"tipo": "xbrl", "dur": dur, "moneda": moneda}
    if docs.get("detalle"):
        d = parsear_detalle_banco(descargar(s, docs["detalle"]))
        dur = {}
        if periodo == "A" and d.get("epsBasico") is not None:
            dur[f"{anio}-01-01|{anio}-12-31"] = d["epsBasico"]
        return {"tipo": "banco", "dur": dur, "moneda": d.get("moneda")}
    return {"tipo": "nada", "dur": {}, "moneda": None}


def filing_cacheado(s, c, anio, trimestre=4, periodo="A"):
    """bajar_filing con caché en disco. Nombres: TK_2023.json (anual) /
    TK_T2_2023.json (trimestral). Migra el formato viejo del caché anual
    ({'eps': {'2023': v}}) al nuevo ({'dur': {...}}) sin re-bajar nada."""
    nombre = (f"{c['ticker']}_{anio}.json" if periodo == "A"
              else f"{c['ticker']}_T{trimestre}_{anio}.json")
    ruta = os.path.join(CACHE, nombre)
    if os.path.exists(ruta):
        with open(ruta, encoding="utf-8") as f:
            r = json.load(f)
        if "dur" not in r:  # caché de la v1 (solo anuales)
            r["dur"] = {f"{a}-01-01|{a}-12-31": v for a, v in (r.get("eps") or {}).items()}
        return r
    ultimo_error = None
    for intento in range(2):
        try:
            r = bajar_filing(s, c, anio, trimestre, periodo)
            with open(ruta, "w", encoding="utf-8") as f:
                json.dump(r, f, ensure_ascii=False)
            time.sleep(0.4)
            return r
        except Exception as e:
            ultimo_error = e
            print(f"   {c['ticker']} {periodo}{trimestre}-{anio} intento {intento}: {type(e).__name__}")
            time.sleep(2)
    # NO se cachea el fallo (puede ser el SMV caído): se reintenta en otra corrida
    print(f"   {c['ticker']} {periodo}{trimestre}-{anio}: SIN RESPUESTA ({type(ultimo_error).__name__})")
    return None


def curar_trimestres(serie, trimestres):
    """El XBRL trimestral tiene calidad de tagueo DISPAREJA (hallazgo 21-jul):
    UNACEM taggea el trimestre suelto; Gloria taggea ACUMULADOS en las columnas
    de trimestre (su 'oct-dic' = el año entero, exacto). Cura en tres pasos:
    1. ¿Empresa acumuladora? — algún año con Q4 etiquetado == anual (a 0.5%).
    2. Si lo es, destejer TODOS sus años: Qn real = etiquetado(n) − etiquetado(n−1)
       (aritmética sobre cifras oficiales del MISMO filing, nada inventado;
       eslabón faltante → ese trimestre se descarta, no se adivina).
    3. PRUEBA DE FUEGO POR AÑO: si el año tiene los 4 trimestres y no suman el
       anual auditado (±5%), ESE año pierde sus trimestres (Regla #1: mejor
       hueco que dato engañoso). Ej.: Gloria 2020-21 trae un 'Q4' basura
       (= al Q3 acumulado) y cae aquí; su 2024-25 se desteje y queda.
    Devuelve (trimestres_curados, nota | None)."""
    t = dict(trimestres)
    # ¿ACUMULADORA? Se comparan las DOS hipótesis año por año y gana la que
    # explica mejor los datos (criterio independiente de la MAGNITUD del EPS):
    #   sueltos    → Q1+Q2+Q3+Q4 ≈ anual
    #   acumulados → Q4 (el "oct-dic" etiquetado) ≈ anual
    # BUG CAZADO 22-jul (pregunta de Jair «¿por qué el Q2 de Volcan está vacío?»):
    # el umbral viejo era ABSOLUTO (|Q4−anual| ≤ 0.005), y para una empresa de
    # centavos eso es la MITAD de su BPA anual → a Volcan le bastó UN año de
    # coincidencia (2021: Q4 0.006 vs anual 0.010) para marcarla acumuladora y
    # destejer TODOS sus años, inventando un Q3-2025 en pérdida (−0.004) cuando
    # la SMV reportaba +0.003. Sus trimestres ya venían SUELTOS y cuadraban exacto.
    votos_sueltos = votos_acum = 0
    for a, anual in serie.items():
        qs = [t.get(f"{a}-Q{i}") for i in (1, 2, 3, 4)]
        if anual is None or any(v is None for v in qs):
            continue
        err_sueltos = abs(sum(qs) - anual)
        err_acum = abs(qs[3] - anual)
        if err_sueltos < err_acum:
            votos_sueltos += 1
        elif err_acum < err_sueltos:
            votos_acum += 1
    # empate o sin años completos → NO destejer (preservar la fuente tal cual;
    # la prueba de fuego de abajo igual bota los años que no cuadren)
    acumuladora = votos_acum > votos_sueltos
    if acumuladora:
        for a in sorted({k[:4] for k in t}):
            prev = 0.0  # acumulado del eslabón anterior; None = cadena rota
            for i in (1, 2, 3, 4):
                v = t.get(f"{a}-Q{i}")
                if v is None:
                    prev = None
                    continue
                if prev is None:
                    t.pop(f"{a}-Q{i}")  # sin el eslabón previo no se puede restar
                else:
                    t[f"{a}-Q{i}"] = round(v - prev, 4)
                prev = v
    descartados = []
    for a, anual in serie.items():
        qs = [t.get(f"{a}-Q{i}") for i in (1, 2, 3, 4)]
        # tolerancia: 5% del anual, con piso por REDONDEO del XBRL (3 decimales:
        # 4 trimestres + el anual ≈ ±0.0025), no el 0.02 fijo de antes — que era
        # MAYOR que el BPA anual entero de las empresas de centavos y las dejaba
        # pasar sin control (Volcan 2025: suma 0.013 vs anual 0.03 y no se botaba).
        if all(v is not None for v in qs) and abs(sum(qs) - anual) > max(0.003, abs(anual) * 0.05):
            for i in (1, 2, 3, 4):
                t.pop(f"{a}-Q{i}", None)
            descartados.append(a)
    nota = None
    if descartados:
        nota = ("Trimestres de " + "/".join(sorted(descartados)) + " omitidos: no "
                "cuadran con el anual auditado (re-expresión por acciones liberadas "
                "o tagueo XBRL inconsistente). Mejor hueco que dato engañoso.")
    return t, nota


def cargar_salida():
    if os.path.exists(SALIDA):
        with open(SALIDA, encoding="utf-8") as f:
            d = json.load(f)
        if "empresas" in d and "excluidas" in d:
            return d
    return {}


def main():
    salida = cargar_salida() or {"empresas": {}, "excluidas": {}}
    salida.update({
        "_comment": ("BPA histórico (utilidad básica por acción, EE.FF. INDIVIDUALES SMV) "
                     "para la gráfica 'BPA' de la ficha: serie ANUAL (auditada) + "
                     "trimestres Q1-Q4 (intermedios; el Q4 intermedio existe — la SMV lo "
                     "recibe en enero con oct-dic separado, hallazgo de Jair). Moneda "
                     "ORIGINAL (Regla #3). Periodo ausente = la SMV no lo tiene (Regla #1). "
                     "Bancos: solo anual (su detalle HTML no separa el trimestre). "
                     "excluidas: su XBRL individual distorsiona (ver fix_eps.py)."),
        "_generado": "extractor/fetch_bpa_historico.py (caché en cache_bpa/)",
    })
    try:
        with open(os.path.join(APP_DATA, "eps_anual.json"), encoding="utf-8") as f:
            EPS_ANUAL = json.load(f)["eps"]
    except Exception:
        EPS_ANUAL = {}
    # Trimestre EN CURSO ya bajado por run_batch (no se descarga de nuevo)
    try:
        with open(os.path.join(APP_DATA, "empresas.json"), encoding="utf-8") as f:
            EMPRESAS = {e["ticker"]: e for e in json.load(f)["empresas"]}
    except Exception:
        EMPRESAS = {}
    q_vivo = f"{CFG.get('anio')}-Q{CFG.get('trimestre')}"

    s = nueva_sesion()
    for i, c in enumerate(CFG["empresas"]):
        tk = c["ticker"]
        # fix_eps: se excluye SALVO los verificados en MOSTRAR_INDIVIDUAL (Volcan),
        # que se bajan y se marcan con NOTA_INDIVIDUAL (pedido de Jair 22-jul).
        if tk in DISTORSIONADOS and tk not in MOSTRAR_INDIVIDUAL:
            salida["excluidas"][tk] = MOTIVO_EXCLUSION
            salida["empresas"].pop(tk, None)
            continue
        mostrar_nota = tk in MOSTRAR_INDIVIDUAL
        salida.get("excluidas", {}).pop(tk, None)

        serie, trimestres, moneda, tipo_visto, fallo = {}, {}, None, None, False

        def absorber(r, solo_anual=False):
            nonlocal moneda
            for clave, v in r["dur"].items():
                p = periodo_de(clave)
                if not p:
                    continue
                if p[1] == "A":
                    serie[p[0]] = v
                elif not solo_anual:
                    trimestres[f"{p[0]}-{p[1]}"] = v
            moneda = moneda or r["moneda"]

        # 1º filing: descubre si la empresa es XBRL o banco (detalle)
        r = filing_cacheado(s, c, ANIOS_XBRL[0])
        if r is None:
            continue   # SMV no respondió: otra corrida la completará
        tipo_visto = r["tipo"]
        absorber(r)

        if tipo_visto == "banco":
            for anio in ANIOS_BANCO[1:]:
                r = filing_cacheado(s, c, anio)
                if r:
                    absorber(r)
                else:
                    fallo = True
        elif tipo_visto == "xbrl":
            for anio in ANIOS_XBRL[1:]:
                r = filing_cacheado(s, c, anio)
                if r:
                    absorber(r)
                else:
                    fallo = True
            for anio in ANIOS_TRIM:
                for t in (1, 2, 3, 4):
                    r = filing_cacheado(s, c, anio, trimestre=t, periodo="T")
                    if r:
                        # el año completo del Q4 intermedio rellena anuales
                        # que falten (el auditado manda si ya está)
                        for clave, v in r["dur"].items():
                            p = periodo_de(clave)
                            if not p:
                                continue
                            if p[1] == "A":
                                serie.setdefault(p[0], v)
                            else:
                                trimestres[f"{p[0]}-{p[1]}"] = v
                        moneda = moneda or r["moneda"]
                    else:
                        fallo = True

        if not serie and not trimestres:
            print(f"  {tk:10} sin anuales en la SMV (extranjera/sin documentos) — queda fuera, honesto")
            continue

        # siembra del trimestre en curso (Q1-2026) desde empresas.json
        e_app = EMPRESAS.get(tk) or {}
        if (tipo_visto == "xbrl" and e_app.get("epsTrimestreRaw") is not None
                and q_vivo not in trimestres):
            trimestres[q_vivo] = e_app["epsTrimestreRaw"]

        trimestres, nota_q = curar_trimestres(serie, trimestres)
        moneda = c.get("monedaForzada") or moneda
        fuente = ("SMV — EE.FF. individuales, utilidad básica por acción: anual auditado "
                  "+ trimestrales intermedios (XBRL)" if tipo_visto == "xbrl" else
                  "SMV — EE.FF. individuales anuales, utilidad básica por acción "
                  "(detalle HTML de bancos; sin desglose trimestral)")
        salida["empresas"][tk] = {
            "moneda": moneda,
            "serie": {a: serie[a] for a in sorted(serie)},
            "trimestres": {q: trimestres[q] for q in sorted(trimestres)},
            "fuente": fuente,
        }
        if mostrar_nota:
            salida["empresas"][tk]["notaBpa"] = NOTA_INDIVIDUAL
        if nota_q:
            salida["empresas"][tk]["notaTrimestres"] = nota_q
            print(f"    {tk}: {nota_q}")
        if fallo:
            salida["empresas"][tk]["incompleta"] = True  # otra corrida la completa

        # aviso si el 2025 no cuadra con eps_anual.json (fuente SMV, no ttm)
        ref = EPS_ANUAL.get(tk) or {}
        if (ref.get("anio") == 2025 and ref.get("epsAnual") is not None
                and serie.get("2025") is not None):
            a, b = float(ref["epsAnual"]), float(serie["2025"])
            if abs(a - b) > max(0.01, abs(a) * 0.01):
                print(f"  ⚠ {tk}: 2025 de la serie ({b}) ≠ eps_anual.json ({a}) — revisar")

        with open(SALIDA, "w", encoding="utf-8") as f:
            json.dump(salida, f, ensure_ascii=False, indent=1)
        print(f"  [{i+1}/{len(CFG['empresas'])}] {tk:10} {moneda} "
              f"anual:{len(serie)} trimestres:{len(trimestres)}"
              + (" ⚠incompleta" if fallo else ""), flush=True)

    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=1)
    n = len(salida["empresas"])
    inc = sum(1 for v in salida["empresas"].values() if v.get("incompleta"))
    print(f"\nEscrito: {SALIDA} — {n} empresas ({inc} incompletas), "
          f"{len(salida['excluidas'])} excluidas (fix_eps)", flush=True)


if __name__ == "__main__":
    main()
