# -*- coding: utf-8 -*-
"""
Corre el extractor para todas las empresas de empresas_config.json y genera:
  - extractor/salida_smv.json          (volcado crudo, trazabilidad)
  - app/src/data/empresas.json         (formato que consume la app)

Regla de Oro #1: lo que el XBRL no trae queda en null -> la app lo muestra como
"Pendiente de verificar (SMV)". verificado=false en todo: Jair revisa antes de publicar.
"""
import json, os, time
from smv_extractor import nueva_sesion, fetch_empresa

AQUI = os.path.dirname(os.path.abspath(__file__))
APP_DATA = os.path.normpath(os.path.join(AQUI, "..", "app", "src", "data"))

SIMBOLO = {"USD": "US$", "PEN": "S/"}


def fmt_money(valor, moneda):
    """Formatea un monto en unidades a millones legibles. Ej: 1196589000 -> 'US$ 1,196.6 M'."""
    if valor is None:
        return None
    s = SIMBOLO.get(moneda, (moneda + " ") if moneda else "")
    millones = valor / 1_000_000
    return f"{s} {millones:,.1f} M"


def fmt_eps(valor, moneda):
    if valor is None:
        return None
    s = SIMBOLO.get(moneda, (moneda + " ") if moneda else "")
    return f"{s} {valor:,.4f}"


def fmt_pct(valor):
    if valor is None:
        return None
    return f"{valor*100:.1f}%"


def construir_empresa(cfg, res):
    """Mapea la salida del extractor al esquema de empresa de la app."""
    moneda = None
    datos = res.get("datos") if res.get("ok") else None
    if datos:
        # monedaForzada: corrige casos donde el XBRL de la SMV etiqueta mal la moneda
        # (verificado contra los estados auditados oficiales). Ver _notaMoneda en el config.
        moneda = cfg.get("monedaForzada") or datos.get("moneda")

    via = res.get("via")
    if via == "detalle":
        fuente_base = "SMV — Estados Financieros (detalle oficial), Estados INDIVIDUALES, Q1 2026"
    else:
        fuente_base = "SMV — Archivo Estructurado XBRL, Estados INDIVIDUALES, Q1 2026"
    if res.get("ok"):
        fuente_base += f" (presentado {res.get('fechaPresentacion')})"

    def fund(valor_fmt, extra=None):
        f = {"valor": valor_fmt, "moneda": moneda, "fuente": fuente_base,
             "verificado": False}
        if extra:
            f["valor"] = extra
        return f

    emp = {
        "ticker": cfg["ticker"],
        "nombre": cfg["nombre"],
        "sector": cfg["sector"],
        "perfiles": cfg["perfiles"],
        "smvId": cfg["smvId"],
        "bvlNemonico": cfg.get("bvlNemonico"),
        "tipoLectura": cfg["tipoLectura"],
        "tesis": {"texto": "Pendiente: Jair escribe la tesis en una línea.", "pendiente": True},
        "precio": {"valor": None, "moneda": "PEN", "fuente": "BVL (en vivo)"},
        "perfilesTentativos": True,
        "urlXbrl": res.get("urlXbrl"),
    }

    if not res.get("ok"):
        emp["fundamentos"] = None
        emp["_extraccion"] = {"ok": False, "motivo": res.get("motivo")}
        return emp

    d = datos
    # Deuda financiera con desglose
    deuda_str = None
    if d.get("deudaFinanciera") is not None:
        deuda_str = fmt_money(d["deudaFinanciera"], moneda)
        dc, dnc = d.get("deudaFinCorriente"), d.get("deudaFinNoCorriente")
        if dc is not None and dnc is not None:
            deuda_str += f" (corr. {fmt_money(dc, moneda)} + no corr. {fmt_money(dnc, moneda)})"

    # En una HOLDING el estado individual no tiene "ventas" reales: sus ingresos son
    # dividendos de subsidiarias, así que el margen sale distorsionado (cerca de 100% o más).
    # No lo mostramos como número; ponemos una nota honesta (el negocio está en el consolidado).
    es_holding = bool(cfg.get("esHolding"))
    mn = d.get("margenNeto")
    # Margen inverosímil (|margen neto| > 300%): la empresa tuvo ingresos casi nulos en el
    # trimestre, así que el % se dispara y no dice nada. Lo tratamos como no representativo.
    margen_disparado = (mn is not None and abs(mn) > 3) and not es_holding
    margen_no_rep = es_holding or margen_disparado
    margen_str = None
    if es_holding:
        margen_str = "No representativo (holding): sus ingresos individuales son dividendos de subsidiarias, no ventas. El margen del negocio está en el consolidado del grupo."
    elif margen_disparado:
        margen_str = "No representativo: la empresa tuvo ingresos casi nulos este trimestre, así que el margen % se dispara y no dice nada útil. Mira el resultado en cifras absolutas (balance)."
    elif mn is not None:
        margen_str = f"{fmt_pct(mn)} neto"
        if d.get("margenBruto") is not None:
            margen_str += f" · {fmt_pct(d['margenBruto'])} bruto"

    es_banco = bool(d.get("esBanco"))
    deuda_fuente = fuente_base
    if es_banco:
        deuda_fuente += " — 'Adeudos y obligaciones financieras' (los depósitos NO son deuda; ver glosario)"

    emp["fundamentos"] = {
        "deuda": {"valor": deuda_str, "moneda": moneda, "fuente": deuda_fuente, "verificado": False},
        "fcf": ({"valor": ("No aplica en bancos: un banco no genera 'flujo de caja libre' como "
                           "una fábrica (su materia prima es el dinero). Se mide por su CAPITAL "
                           "(colchón CET1) y su rentabilidad (ROE), no por FCF/capex."),
                 "moneda": None, "fuente": fuente_base, "verificado": False}
                if es_banco else
                {"valor": fmt_money(d.get("fcf"), moneda), "moneda": moneda,
                 "fuente": fuente_base + " — flujo operativo − capex", "verificado": False}),
        "eps": {"valor": fmt_eps(d.get("epsBasico"), moneda), "moneda": moneda,
                "fuente": fuente_base + " — utilidad básica por acción común, del trimestre",
                "verificado": False},
        "margen": {"valor": margen_str, "moneda": moneda, "fuente": fuente_base, "verificado": False},
    }

    # Métricas reales de ESTA empresa para inyectar en la guía "cómo leer estos números".
    # Todo de la SMV (Q1 2026). El P/E y dividendos no se calculan aquí (ver nota en la app).
    emp["metricas"] = {
        "eps": fmt_eps(d.get("epsBasico"), moneda),
        "fcf": fmt_money(d.get("fcf"), moneda),
        "capex": fmt_money(d.get("capex"), moneda),
        "deuda": deuda_str,
        "margen": None if margen_no_rep else margen_str,
    }
    # Datos crudos para el simulador de escenarios (BPA del trimestre, su moneda).
    emp["epsTrimestreRaw"] = d.get("epsBasico")
    emp["monedaEstados"] = moneda
    # Piezas crudas para EV/EBITDA (todo del trimestre, SMV).
    emp["evEbitdaRaw"] = {
        "utilidadOperativa": d.get("utilidadOperativa"),
        "dya": d.get("dya"),
        "utilidadNeta": d.get("utilidadNeta"),
        "eps": d.get("epsBasico"),
        "deudaFinanciera": d.get("deudaFinanciera"),
        "efectivo": d.get("efectivo"),
    }

    # Balance destacado
    bd = []
    def add(k, v, nota=None):
        if v is not None:
            item = {"k": k, "v": fmt_money(v, moneda)}
            if nota:
                item["nota"] = nota
            bd.append(item)
    add("Total activos", d.get("activos"), f"al {d.get('fechaCierre')}")
    add("Total pasivos", d.get("pasivos"),
        ("incluye los depósitos del público (su materia prima)" if es_banco
         else f"al {d.get('fechaCierre')}"))
    add("Total patrimonio", d.get("patrimonio"), f"al {d.get('fechaCierre')}")
    if es_banco:
        # En un banco las etiquetas son distintas: no es "efectivo" ni "ventas".
        add("Disponible (caja, BCR, bancos)", d.get("efectivo"),
            "el 'disponible' de un banco: caja + depósitos en el Banco Central")
        add("Ingresos por intereses", d.get("ingresos"),
            f"NO son 'ventas': es lo que cobra por prestar · periodo a {d.get('fechaPeriodo')}")
        add("Utilidad neta del trimestre", d.get("utilidadNeta"))
    else:
        add("Efectivo y equivalentes", d.get("efectivo"))
        nota_ing = (f"periodo a {d.get('fechaPeriodo')}" if not es_holding
                    else "HOLDING: son dividendos de subsidiarias, NO ventas operativas")
        add("Ingresos del trimestre", d.get("ingresos"), nota_ing)
        add("Utilidad neta del trimestre", d.get("utilidadNeta"))
    if d.get("ctasPorCobrarRelacionadas") is not None:
        nota = "al " + str(d.get("fechaCierre"))
        if cfg["smvId"] == 59:
            nota = "LÍNEA SENSIBLE: mostrar tal cual, sin inferir (error histórico US$40–45M vs US$407M)"
        bd.append({"k": "Cuentas por cobrar a relacionadas (corriente)",
                   "v": fmt_money(d["ctasPorCobrarRelacionadas"], moneda), "nota": nota})
    emp["balanceDestacado"] = bd

    # Secciones que requieren CRITERIO de Jair: quedan pendientes (no se inventan)
    emp["catalizadores"] = [{"texto": "Pendiente: catalizadores documentados.", "pendiente": True}]
    emp["escenarios"] = {"favorable": "Pendiente", "neutral": "Pendiente",
                          "presion": "Pendiente", "riesgo": "Pendiente"}
    emp["riesgos"] = []
    enlace_doc = res.get("urlXbrl") or res.get("urlDetalle") or ""
    emp["fuentes"] = [
        fuente_base,
        ("Descarga XBRL: " if via != "detalle" else "Detalle SMV: ") + enlace_doc,
        "Portal: https://www.smv.gob.pe/SIMV/Frm_InformacionFinanciera",
    ]
    emp["_extraccion"] = {"ok": True, "fechaCierre": d.get("fechaCierre"),
                          "moneda": moneda}
    return emp


def main():
    with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)

    s = nueva_sesion()
    salida_cruda = {}
    empresas_app = []

    for c in cfg["empresas"]:
        print(f"[{c['sector']:10}] {c['ticker']:10} smvId={c['smvId']} ...", end=" ", flush=True)
        res = {"ok": False, "motivo": "sin_intentos"}
        for intento in range(3):
            try:
                res = fetch_empresa(s, c["smvId"], cfg["anio"], cfg["trimestre"])
                if res.get("ok"):
                    break
            except Exception as e:
                res = {"ok": False, "motivo": f"error:{type(e).__name__}:{e}"}
            time.sleep(2)  # el portal SMV a veces falla; reintentar
        salida_cruda[c["ticker"]] = {"cfg": c, "res": res}
        emp = construir_empresa(c, res)
        empresas_app.append(emp)
        if res.get("ok"):
            d = res["datos"]
            print(f"OK  {d.get('moneda')}  activos={d.get('activos')}  cierre={d.get('fechaCierre')}")
        else:
            print(f"FALLO  {res.get('motivo')}")
        time.sleep(0.5)

    # Volcado crudo
    with open(os.path.join(AQUI, "salida_smv.json"), "w", encoding="utf-8") as f:
        json.dump(salida_cruda, f, ensure_ascii=False, indent=2)

    # empresas.json para la app
    doc = {
        "_comment": ("Generado por extractor/run_batch.py desde el XBRL oficial de la SMV "
                     "(Individual, Q1 2026). verificado=false: Jair revisa antes de publicar. "
                     "Lo que el XBRL no trae queda en null y la app lo marca como pendiente. "
                     "perfilesTentativos: la clasificación por perfil la confirma Jair."),
        "_generado": time.strftime("%Y-%m-%d %H:%M"),
        "empresas": empresas_app,
    }
    out = os.path.join(APP_DATA, "empresas.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    print(f"\nEscrito: {out}  ({len(empresas_app)} empresas)")

    ok = sum(1 for e in empresas_app if e.get("_extraccion", {}).get("ok"))
    print(f"Extracción OK: {ok}/{len(empresas_app)}")


if __name__ == "__main__":
    main()
