# -*- coding: utf-8 -*-
"""
Extractor SMV — ALTO Research.

Replica el formulario del Portal SMV (Información Financiera, Mercado Principal),
descarga el Archivo Estructurado XBRL (Individual / Intermedio / año / trimestre)
y parsea las cifras clave de los estados financieros.

Regla de Oro #1: si un dato no está en la fuente, queda en None (no se inventa).
Todo sale del XBRL oficial; el script ahorra el copiado, NO el criterio: Jair revisa
antes de publicar.

Uso:
    python smv_extractor.py            # corre el lote definido en empresas_config.json
    (o importar fetch_empresa() desde otro script)
"""
import time
import requests
from lxml import etree
from bs4 import BeautifulSoup

BASE = ("https://www.smv.gob.pe/SIMV/Frm_InformacionFinanciera"
        "?data=A70181B60967D74090DCD93C4920AA1D769614EC12")

HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"),
    "Origin": "https://www.smv.gob.pe",
    "Referer": BASE,
}

XBRLI = "http://www.xbrl.org/2003/instance"

# Conceptos IFRS que nos interesan (sin desglose dimensional).
# clave_app -> lista de nombres locales ifrs-full (se toma el primero que exista)
CONCEPTOS_INSTANTE = {
    "activos": ["Assets"],
    "pasivos": ["Liabilities"],
    "patrimonio": ["Equity"],
    "pasivoCorriente": ["CurrentLiabilities"],
    "pasivoNoCorriente": ["NoncurrentLiabilities"],
    "efectivo": ["CashAndCashEquivalents"],
    "resultadosAcumulados": ["RetainedEarnings"],
    "deudaFinCorriente": ["OtherCurrentFinancialLiabilities"],
    "deudaFinNoCorriente": ["OtherNoncurrentFinancialLiabilities"],
    "ctasPorCobrarRelacionadas": ["CurrentTradeReceivablesDueFromRelatedParties",
                                  "TradeAndOtherCurrentReceivablesDueFromRelatedParties"],
}
CONCEPTOS_DURACION = {
    "ingresos": ["Revenue", "RevenueFromContractsWithCustomers"],
    "costoVentas": ["CostOfSales"],
    "utilidadBruta": ["GrossProfit"],
    "utilidadOperativa": ["ProfitLossFromOperatingActivities"],
    "utilidadAntesImp": ["ProfitLossBeforeTax"],
    "utilidadNeta": ["ProfitLoss"],
    "epsBasico": ["BasicEarningsLossPerShare"],
    "epsDiluido": ["DilutedEarningsLossPerShare"],
    "flujoOperativo": ["CashFlowsFromUsedInOperatingActivities"],
    "capex": ["PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"],
    # OJO (verificado 11-jul-2026): ~70 de 94 empresas NO taguean la depreciación en el
    # XBRL estructurado de la SMV — ni con estos nombres ni con ningún otro. No es un bug
    # de nombre de campo: presentan el flujo de caja en forma ABREVIADA (reportan
    # CashFlowsFromUsedInOperations en una sola línea) y no desglosan la D&A, ni en el
    # trimestral ni en el anual (comprobado con BVN, Volcan, Minsur, El Brocal, Alicorp).
    # Cuando queda en None, la app cae a EV/EBIT en vez de EV/EBITDA (ver Valoracion.jsx).
    "dya": ["AdjustmentsForDepreciationAndAmortisationExpense",
            "DepreciationAndAmortisationExpense"],
}


def nueva_sesion():
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


def _hidden(soup):
    return {i.get("name"): (i.get("value") or "")
            for i in soup.find_all("input", {"type": "hidden"})}


def _form_base(h, empresa, anio, trimestre, periodo="T"):
    # periodo: "T" = Intermedio (trimestral), "A" = Anual
    return {
        "__EVENTTARGET": "", "__EVENTARGUMENT": "", "__LASTFOCUS": "",
        "__VIEWSTATE": h.get("__VIEWSTATE", ""),
        "__VIEWSTATEGENERATOR": h.get("__VIEWSTATEGENERATOR", ""),
        "__PREVIOUSPAGE": h.get("__PREVIOUSPAGE", ""),
        "__EVENTVALIDATION": h.get("__EVENTVALIDATION", ""),
        "ctl00$hdfArticulo": "",
        "ctl00$MainContent$cboDenominacionSocial": str(empresa),
        "ctl00$MainContent$cboTipo": "I",       # Individual
        "ctl00$MainContent$cboPeriodo": periodo,
        "ctl00$MainContent$cboAnio": str(anio),
        "ctl00$MainContent$cboTrimestre": str(trimestre),
    }


def buscar_xbrl_url(s, empresa, anio=2026, trimestre=1):
    """Devuelve (url_xbrl, fecha_presentacion) o (None, None) si no hay XBRL."""
    soup = BeautifulSoup(s.get(BASE, timeout=40).text, "lxml")
    h = _hidden(soup)

    # postback: seleccionar empresa (revela Tipo/Periodo y registra estado)
    f = _form_base(h, empresa, anio, trimestre)
    f["__EVENTTARGET"] = "ctl00$MainContent$cboDenominacionSocial"
    soup2 = BeautifulSoup(s.post(BASE, data=f, timeout=40).text, "lxml")
    h2 = _hidden(soup2)

    # Buscar
    f2 = _form_base(h2, empresa, anio, trimestre)
    f2["ctl00$MainContent$cbBuscar"] = "Buscar"
    soup3 = BeautifulSoup(s.post(BASE, data=f2, timeout=40).text, "lxml")

    # Localizar el enlace del XBRL en la grilla de resultados
    url_xbrl = None
    for a in soup3.find_all("a"):
        title = (a.get("title") or "").lower()
        if "xbrl" in title and "descargar" in title:
            url_xbrl = (a.get("href") or "").strip()
            break

    # Fecha de presentación (de la fila que menciona XBRL)
    fecha = None
    for tr in soup3.find_all("tr"):
        t = tr.get_text(" ", strip=True)
        if "xbrl" in t.lower() and "estructurad" in t.lower():
            import re
            m = re.search(r"(\d{2}/\d{2}/\d{4})", t)
            if m:
                fecha = m.group(1)
            break
    return url_xbrl, fecha


def buscar_documentos(s, empresa, anio=2026, trimestre=1, periodo="T"):
    """Devuelve dict con url del XBRL, url del detalle HTML y fecha de presentación."""
    from urllib.parse import urljoin
    soup = BeautifulSoup(s.get(BASE, timeout=40).text, "lxml")
    h = _hidden(soup)
    f = _form_base(h, empresa, anio, trimestre, periodo)
    f["__EVENTTARGET"] = "ctl00$MainContent$cboDenominacionSocial"
    soup2 = BeautifulSoup(s.post(BASE, data=f, timeout=40).text, "lxml")
    h2 = _hidden(soup2)
    f2 = _form_base(h2, empresa, anio, trimestre, periodo)
    f2["ctl00$MainContent$cbBuscar"] = "Buscar"
    soup3 = BeautifulSoup(s.post(BASE, data=f2, timeout=40).text, "lxml")

    url_xbrl = url_detalle = None
    for a in soup3.find_all("a"):
        title = (a.get("title") or "").lower()
        href = (a.get("href") or "").strip()
        if "xbrl" in title and "descargar" in title and not url_xbrl:
            url_xbrl = href
        if "ver detalle" in title and not url_detalle:
            url_detalle = urljoin("https://www.smv.gob.pe/SIMV/", href)

    fecha = None
    import re
    for tr in soup3.find_all("tr"):
        t = tr.get_text(" ", strip=True)
        if "estructurad" in t.lower() or "estados financieros" in t.lower():
            m = re.search(r"(\d{2}/\d{2}/\d{4})", t)
            if m:
                fecha = m.group(1)
                break
    return {"xbrl": url_xbrl, "detalle": url_detalle, "fecha": fecha}


def descargar(s, url):
    r = s.get(url, timeout=90)
    r.raise_for_status()
    return r.content


# compat
def descargar_xbrl(s, url):
    return descargar(s, url)


def _num(s):
    """Parsea número estilo peruano: '16,589,023' -> 16589023.0 ; '(3,830)' -> -3830."""
    s = (s or "").strip().replace("\xa0", "")
    if not s or s in ("-",):
        return None
    neg = s.startswith("(") and s.endswith(")")
    s = s.strip("()").replace(",", "")
    try:
        v = float(s)
    except ValueError:
        return None
    return -v if neg else v


def parsear_detalle_banco(raw):
    """
    Parser de la página HTML 'Ver detalle' para BANCOS (no presentan XBRL).
    Los importes vienen EN MILES; se reescalan a unidades. Devuelve mismo formato
    que parsear_xbrl (claves compatibles) más banderas de banco.
    """
    # La página de detalle viene en UTF-8 (a diferencia del XBRL, que es cp1252).
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("cp1252", errors="replace")
    soup = BeautifulSoup(text, "lxml")
    full = soup.get_text(" ", strip=True).upper()

    moneda = "USD" if "DOLAR" in full else ("PEN" if "SOLES" in full else None)
    escala = 1000 if "EN MILES" in full else 1

    # mapa: etiqueta normalizada -> valor de la columna del periodo actual (cells[2])
    valores = {}
    import re
    fecha_cierre = None
    m = re.search(r"AL\s+(\d{1,2})\s+DE\s+(\w+)\s+DEL?\s+(\d{4})", full)
    # construir fecha aproximada de cierre desde "TRIMESTRE I AL 31 DE MARZO DEL 2026"
    if "TRIMESTRE I " in full or "31 DE MARZO" in full:
        fecha_cierre = "2026-03-31"

    for tr in soup.find_all("tr"):
        celdas = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
        if len(celdas) < 3:
            continue
        etiqueta = re.sub(r"\s+", " ", celdas[0]).strip().upper()
        if not etiqueta:
            continue
        val = _num(celdas[2])
        if etiqueta not in valores and val is not None:
            valores[etiqueta] = val

    import unicodedata
    def _sinacento(t):
        return "".join(c for c in unicodedata.normalize("NFD", t)
                       if unicodedata.category(c) != "Mn")
    valores_norm = {_sinacento(k): v for k, v in valores.items()}

    def g(*labels):
        for lb in labels:
            if lb in valores:
                return valores[lb]
        # fallback sin acentos / por substring
        for lb in labels:
            ln = _sinacento(lb)
            if ln in valores_norm:
                return valores_norm[ln]
            for k, v in valores_norm.items():
                if ln in k:
                    return v
        return None

    def esc(v):
        return v * escala if v is not None else None

    activos = esc(g("TOTAL DEL ACTIVO", "TOTAL ACTIVO"))
    pasivos = esc(g("TOTAL DEL PASIVO", "TOTAL PASIVO"))
    patrimonio = esc(g("TOTAL DEL PATRIMONIO", "TOTAL PATRIMONIO NETO"))
    disponible = esc(g("DISPONIBLE"))
    adeudos = esc(g("ADEUDOS Y OBLIGACIONES FINANCIERAS"))
    utilidad = esc(g("RESULTADO NETO DEL EJERCICIO"))
    ing_intereses = esc(g("TOTAL INGRESOS POR INTERESES"))
    margen_fin_bruto = esc(g("MARGEN FINANCIERO BRUTO"))
    margen_fin_neto = esc(g("MARGEN FINANCIERO NETO"))
    eps = g("UTILIDAD (PÉRDIDA) BÁSICA POR ACCIÓN",
            "UTILIDAD (PERDIDA) BASICA POR ACCION")

    out = {
        "fechaCierre": fecha_cierre, "fechaPeriodo": fecha_cierre, "moneda": moneda,
        "activos": activos, "pasivos": pasivos, "patrimonio": patrimonio,
        "efectivo": disponible, "resultadosAcumulados": None,
        "deudaFinanciera": adeudos, "deudaFinCorriente": None, "deudaFinNoCorriente": None,
        "ctasPorCobrarRelacionadas": None,
        "ingresos": ing_intereses, "utilidadNeta": utilidad,
        "utilidadBruta": margen_fin_bruto, "costoVentas": None,
        "epsBasico": eps, "fcf": None,
        "margenBruto": (margen_fin_bruto / ing_intereses) if (margen_fin_bruto and ing_intereses) else None,
        "margenNeto": (utilidad / ing_intereses) if (utilidad and ing_intereses) else None,
        "esBanco": True,
        "margenFinancieroNeto": margen_fin_neto,
    }
    return out


def _parse_root(raw):
    """El portal declara UTF-8 pero emite cp1252; recodificar y parsear tolerante."""
    text = raw.decode("cp1252", errors="replace")
    text = text.replace('encoding="UTF-8"', 'encoding="utf-8"')
    parser = etree.XMLParser(recover=True, huge_tree=True)
    return etree.fromstring(text.encode("utf-8"), parser=parser)


def parsear_xbrl(raw):
    """Parsea el XBRL y devuelve un dict con cifras del último periodo reportado."""
    root = _parse_root(raw)
    nsmap = {k: v for k, v in root.nsmap.items() if k}
    ifrs = nsmap.get("ifrs-full")

    # Contextos: id -> (tipo, fecha_clave, tiene_dimension)
    contexts = {}
    ctx_member = {}  # id -> texto de los miembros dimensionales (para EPS por clase de acción)
    for ctx in root.findall(f"{{{XBRLI}}}context"):
        cid = ctx.get("id")
        period = ctx.find(f"{{{XBRLI}}}period")
        instant = period.find(f"{{{XBRLI}}}instant")
        end = period.find(f"{{{XBRLI}}}endDate")
        seg = ctx.find(f"{{{XBRLI}}}entity/{{{XBRLI}}}segment")
        scen = ctx.find(f"{{{XBRLI}}}scenario")
        has_dim = (seg is not None and len(seg)) or (scen is not None and len(scen))
        miembros = []
        for cont in (seg, scen):
            if cont is not None:
                for m in cont:
                    miembros.append((m.text or "").strip())
        ctx_member[cid] = " ".join(miembros)
        if instant is not None:
            contexts[cid] = ("instant", instant.text, bool(has_dim))
        elif end is not None:
            start = period.find(f"{{{XBRLI}}}startDate")
            contexts[cid] = ("duration", end.text, bool(has_dim),
                             start.text if start is not None else None)

    # Determinar fecha de cierre principal = instante más reciente sin dimensión
    fechas_instante = sorted({c[1] for c in contexts.values()
                              if c[0] == "instant" and not c[2]})
    fecha_cierre = fechas_instante[-1] if fechas_instante else None
    # periodo de duración que termina en la fecha de cierre, sin dimensión
    fechas_dur = sorted({c[1] for c in contexts.values()
                         if c[0] == "duration" and not c[2]})
    fecha_dur = fechas_dur[-1] if fechas_dur else None

    # Moneda: leer unidad iso4217 de cualquier hecho monetario
    moneda = None
    for u in root.findall(f"{{{XBRLI}}}unit"):
        measure = u.find(f"{{{XBRLI}}}measure")
        if measure is not None and measure.text and "iso4217" in measure.text:
            moneda = measure.text.split(":")[-1].upper()
            break

    # Recolectar hechos sin dimensión
    def valor(locales, tipo, fecha):
        for el in root.iter():
            tag = el.tag
            if not isinstance(tag, str) or "}" not in tag:
                continue
            uri, local = tag[1:].split("}")
            if uri != ifrs or local not in locales:
                continue
            cref = el.get("contextRef")
            c = contexts.get(cref)
            if not c or c[2]:  # sin dimensión
                continue
            if c[0] != tipo or c[1] != fecha:
                continue
            txt = (el.text or "").strip()
            if txt == "":
                continue
            try:
                return float(txt)
            except ValueError:
                return txt
        return None

    # EPS básico: viene en contexto CON dimensión (por clase de acción: común vs inversión).
    # Las dos clases reportan el mismo EPS; tomamos la acción COMÚN (OrdinaryShares).
    def eps_basico(fecha):
        candidatos = []
        for el in root.iter():
            tag = el.tag
            if not isinstance(tag, str) or "}" not in tag:
                continue
            uri, local = tag[1:].split("}")
            if uri != ifrs or local != "BasicEarningsLossPerShare":
                continue
            cref = el.get("contextRef")
            c = contexts.get(cref)
            if not c or c[0] != "duration" or c[1] != fecha:
                continue
            txt = (el.text or "").strip()
            if txt == "":
                continue
            try:
                v = float(txt)
            except ValueError:
                continue
            candidatos.append((ctx_member.get(cref, ""), v))
        if not candidatos:
            return None
        for miembro, v in candidatos:
            if "OrdinaryShares" in miembro:  # acción común
                return v
        return candidatos[0][1]

    out = {"fechaCierre": fecha_cierre, "fechaPeriodo": fecha_dur, "moneda": moneda}
    for clave, locales in CONCEPTOS_INSTANTE.items():
        out[clave] = valor(locales, "instant", fecha_cierre)
    for clave, locales in CONCEPTOS_DURACION.items():
        out[clave] = valor(locales, "duration", fecha_dur)
    out["epsBasico"] = eps_basico(fecha_dur)

    # Derivados
    dfc = out.get("deudaFinCorriente") or 0
    dfnc = out.get("deudaFinNoCorriente") or 0
    out["deudaFinanciera"] = (dfc + dfnc) if (out.get("deudaFinCorriente") is not None
                                              or out.get("deudaFinNoCorriente") is not None) else None
    if out.get("flujoOperativo") is not None and out.get("capex") is not None:
        out["fcf"] = out["flujoOperativo"] - out["capex"]
    else:
        out["fcf"] = None
    if out.get("utilidadNeta") is not None and out.get("ingresos"):
        out["margenNeto"] = out["utilidadNeta"] / out["ingresos"]
    else:
        out["margenNeto"] = None
    if out.get("utilidadBruta") is not None and out.get("ingresos"):
        out["margenBruto"] = out["utilidadBruta"] / out["ingresos"]
    else:
        out["margenBruto"] = None
    return out


def fetch_empresa(s, empresa, anio=2026, trimestre=1, pausa=1.0):
    """
    Flujo completo. Prefiere el XBRL (Regla #D.4). Si la empresa no presenta XBRL
    (típico en bancos, regulados por SBS), cae a la página de detalle HTML.
    """
    docs = buscar_documentos(s, empresa, anio, trimestre)
    fecha_pres = docs.get("fecha")
    if docs.get("xbrl"):
        raw = descargar(s, docs["xbrl"])
        datos = parsear_xbrl(raw)
        time.sleep(pausa)
        return {"ok": True, "via": "xbrl", "urlXbrl": docs["xbrl"],
                "urlDetalle": docs.get("detalle"), "fechaPresentacion": fecha_pres,
                "datos": datos}
    if docs.get("detalle"):
        raw = descargar(s, docs["detalle"])
        datos = parsear_detalle_banco(raw)
        time.sleep(pausa)
        return {"ok": True, "via": "detalle", "urlXbrl": None,
                "urlDetalle": docs["detalle"], "fechaPresentacion": fecha_pres,
                "datos": datos}
    return {"ok": False, "motivo": "sin_documentos", "urlXbrl": None}


if __name__ == "__main__":
    import json
    s = nueva_sesion()
    # prueba rápida con NEXA
    res = fetch_empresa(s, 59)
    print(json.dumps(res, ensure_ascii=False, indent=2))
