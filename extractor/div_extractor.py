# -*- coding: utf-8 -*-
"""
Extractor de dividendos — ALTO Research.
Fuente: BVL, "Entrega de Derechos" (https://documents.bvl.com.pe/empresas/entrder1.htm),
que se actualiza al día. Lista los dividendos vigentes por nemónico: monto, tipo
(efectivo S//US$ o acciones %), concepto y fechas.

Genera app/src/data/dividendos.json keyado por ticker.
Regla #1: solo lo que la BVL publica; si una empresa no tiene derecho vigente, no aparece.
"""
import sys, re, json, os, requests
sys.stdout.reconfigure(encoding="utf-8")
from bs4 import BeautifulSoup

URL = "https://documents.bvl.com.pe/empresas/entrder1.htm"
URL_2025 = "https://documents.bvl.com.pe/pubdif/infmen/202512e4.htm"  # Beneficios Distribuidos 2025
AQUI = os.path.dirname(os.path.abspath(__file__))
APP_DATA = os.path.normpath(os.path.join(AQUI, "..", "app", "src", "data"))

CONCEPTO = {"20": "Distribución de utilidades", "2": "Capitalización (en acciones)",
            "90": "Otros"}


def cargar_config_nems():
    with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    return {c["bvlNemonico"]: c["ticker"] for c in cfg["empresas"]}


def parse_valor(cel):
    """'US$ 0.07860968 Efe.' -> (monto, moneda, tipo) ; '9.91 % Accs.' -> (9.91, '%', 'acciones')"""
    cel = cel.strip()
    if "%" in cel:
        m = re.search(r"([\d.,]+)\s*%", cel)
        monto = float(m.group(1).replace(",", "")) if m else None
        return monto, "%", "acciones"
    m = re.match(r"(S/|US\$)\s*([\d.,]+)", cel)
    if m:
        moneda = m.group(1)
        monto = float(m.group(2).replace(",", ""))
        return monto, moneda, "efectivo"
    return None, None, None


def fmt_monto(monto, moneda, tipo):
    if monto is None:
        return None
    if tipo == "acciones":
        return f"{monto:.2f}% en acciones"
    # efectivo: mostrar con hasta 4 decimales significativos
    s = "US$" if moneda == "US$" else "S/"
    return f"{s} {monto:,.4f}".rstrip("0").rstrip(".")


def main():
    nem2ticker = cargar_config_nems()
    s = requests.Session()
    s.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36"})
    r = s.get(URL, timeout=40)
    r.encoding = r.apparent_encoding or "latin-1"
    soup = BeautifulSoup(r.text, "lxml")

    # fecha de actualización
    actualizado = None
    m = re.search(r"Actualizado al ([\d]+\s+de\s+\w+\s+de\s+\d{4})", soup.get_text(" ", strip=True))
    if m:
        actualizado = re.sub(r"\s+", " ", m.group(1))

    grande = max(soup.find_all("table"), key=lambda t: len(t.find_all("tr")))
    divs = {}
    for tr in grande.find_all("tr"):
        celdas = [td.get_text(" ", strip=True) for td in tr.find_all(["td", "th"])]
        if len(celdas) < 7:
            continue
        nem = celdas[0].strip()
        if nem not in nem2ticker:
            continue
        ticker = nem2ticker[nem]
        monto, moneda, tipo = parse_valor(celdas[1])
        # concepto: "(20) 2019,2021-2022"
        cm = re.match(r"\((\d+)\)\s*(.*)", celdas[2])
        cod = cm.group(1) if cm else ""
        ejercicio = cm.group(2).strip() if cm else celdas[2]
        registro = {
            "montoFmt": fmt_monto(monto, moneda, tipo),
            "monto": monto, "moneda": moneda, "tipo": tipo,
            "concepto": CONCEPTO.get(cod, "Dividendo"),
            "ejercicio": ejercicio,
            "fechaCorte": celdas[4],      # ex-dividendo aprox = corte
            "fechaRegistro": celdas[5],
            "fechaEntrega": celdas[6],
            "fuente": f"BVL — Entrega de Derechos (actualizado al {actualizado})",
        }
        divs.setdefault(ticker, []).append(registro)
        print(f"  {ticker:10} {registro['montoFmt']:22} {registro['concepto']:28} entrega {registro['fechaEntrega']}")

    # ---- Dividendos del AÑO 2025 (Beneficios Distribuidos ene-dic 2025) ----
    # Una empresa puede tener varios pagos en el año: se SUMAN por moneda.
    div2025 = {}
    try:
        r2 = s.get(URL_2025, timeout=40)
        r2.encoding = r2.apparent_encoding or "latin-1"
        soup2 = BeautifulSoup(r2.text, "lxml")
        g2 = max(soup2.find_all("table"), key=lambda t: len(t.find_all("tr")))
        acum = {}  # ticker -> {moneda: suma}
        for tr in g2.find_all("tr"):
            celdas = [td.get_text(" ", strip=True) for td in tr.find_all(["td", "th"])]
            if len(celdas) < 3:
                continue
            nem = celdas[0].strip()
            if nem not in nem2ticker:
                continue
            # buscar 'S/ X' o 'US$ X' (efectivo) en las celdas
            fila = " ".join(celdas)
            m = re.search(r"(S/|US\$)\s*([\d.,]+)", fila)
            if not m:
                continue
            moneda = m.group(1)
            monto = float(m.group(2).replace(",", ""))
            tk = nem2ticker[nem]
            acum.setdefault(tk, {}).setdefault(moneda, 0.0)
            acum[tk][moneda] += monto
        for tk, porm in acum.items():
            partes = [fmt_monto(v, mon, "efectivo") for mon, v in porm.items()]
            div2025[tk] = " + ".join(p for p in partes if p)
            print(f"  2025  {tk:10} {div2025[tk]}")
    except Exception as e:
        print("  (no se pudo bajar dividendos 2025:", type(e).__name__, e, ")")

    doc = {
        "_comment": ("Dividendos por empresa, de la BVL. 'dividendos' = derecho vigente (Entrega de "
                     "Derechos, ~2026). 'y2025' = total pagado en efectivo durante 2025 (sumado). "
                     "Si una empresa no aparece, no repartió (no significa que nunca pague). "
                     "Se actualiza al re-correr div_extractor.py."),
        "actualizado": actualizado,
        "fuente": URL,
        "fuente2025": URL_2025,
        "dividendos": divs,
        "y2025": div2025,
    }
    out = os.path.join(APP_DATA, "dividendos.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    print(f"\nEscrito: {out}  ({len(divs)} empresas con dividendo vigente)")


if __name__ == "__main__":
    main()
