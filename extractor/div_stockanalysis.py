# -*- coding: utf-8 -*-
"""
Dividendos desde stockanalysis.com (más completo que la BVL: incluye pagos que la
BVL se salta, ej. Michell y Cerro Verde de inicios de año).

Fuente por empresa: https://stockanalysis.com/quote/bvl/<NEMONICO>/dividend/
La tabla viene en el HTML (Svelte SSR), así que se parsea con requests + BeautifulSoup.

Escribe app/src/data/dividendos.json con, por ticker:
  - resumen: dividendo anual, yield %, payout %, frecuencia
  - porAnio: total pagado por año (2024/2025/2026...)
  - historial: filas (fecha ex-dividendo, monto, moneda)
"""
import sys, re, json, os, time, requests
sys.stdout.reconfigure(encoding="utf-8")
from bs4 import BeautifulSoup

AQUI = os.path.dirname(os.path.abspath(__file__))
APP_DATA = os.path.normpath(os.path.join(AQUI, "..", "app", "src", "data"))
with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
    CFG = json.load(f)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120 Safari/537.36")


def fmt_moneda(mon):
    return "US$" if mon in ("USD", "US$") else "S/"


def parse_empresa(html):
    soup = BeautifulSoup(html, "lxml")
    texto = soup.get_text(" ", strip=True)

    res = {}
    m = re.search(r"annual dividend of ([\d.]+)\s*(PEN|USD)", texto)
    if m:
        res["anual"] = f"{fmt_moneda(m.group(2))} {m.group(1)}"
        res["anualNum"] = float(m.group(1))
        res["anualSim"] = fmt_moneda(m.group(2))
    m = re.search(r"yield of ([\d.]+)%", texto)
    if m:
        res["yield"] = m.group(1) + "%"
    m = re.search(r"Payout Ratio\s*([\d.]+)%", texto)
    if m:
        res["payout"] = m.group(1) + "%"
    m = re.search(r"Payout Frequency\s*([A-Za-z]+)", texto)
    if m:
        res["frecuencia"] = m.group(1)

    # tabla de historial: filas con fecha + 'X PEN/USD'
    historial = []
    por_anio = {}
    for tr in soup.find_all("tr"):
        celdas = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
        if len(celdas) < 2:
            continue
        fecha = celdas[0]
        ma = re.match(r"([A-Za-z]{3})\s+\d{1,2},\s+(20\d\d)", fecha)
        cell1 = celdas[1].strip()
        mm = re.search(r"([\d.]+)", cell1)
        if not ma or not mm:
            continue
        anio = ma.group(2)
        monto = float(mm.group(1))
        # stockanalysis muestra el monto en la MONEDA en que cotiza: '$' = US$, 'PEN' = soles
        mon = "USD" if ("$" in cell1 or "USD" in cell1) else "PEN"
        historial.append({"fecha": fecha, "monto": monto, "moneda": fmt_moneda(mon)})
        por_anio.setdefault(anio, {}).setdefault(mon, 0.0)
        por_anio[anio][mon] += monto

    # formatear por año + contar pagos por año
    porAnioFmt = {}
    nPorAnio = {}
    for anio, porm in por_anio.items():
        partes = [f"{fmt_moneda(mon)} {v:.4f}".rstrip("0").rstrip(".") for mon, v in porm.items()]
        porAnioFmt[anio] = " + ".join(partes)
    for h in historial:
        a = re.search(r"(20\d\d)", h["fecha"])
        if a:
            nPorAnio[a.group(1)] = nPorAnio.get(a.group(1), 0) + 1

    # monto numérico por año (en la moneda principal de la empresa)
    mainmon = "USD" if res.get("anualSim") == "US$" else "PEN"
    porAnioNum = {a: round(porm.get(mainmon, sum(porm.values())), 5) for a, porm in por_anio.items()}

    res["porAnio"] = porAnioFmt
    res["porAnioNum"] = porAnioNum
    res["nPorAnio"] = nPorAnio
    res["historial"] = historial[:8]
    return res


def main():
    s = requests.Session()
    s.headers.update({"User-Agent": UA})
    out = {}
    for c in CFG["empresas"]:
        nem = c["bvlNemonico"]
        url = f"https://stockanalysis.com/quote/bvl/{nem}/dividend/"
        try:
            r = None
            for intento in range(3):
                r = s.get(url, timeout=30)
                if r.status_code == 200:
                    break
                time.sleep(1.5)
            if r.status_code != 200:
                print(f"  {c['ticker']:10} {nem:10} HTTP {r.status_code}")
                continue
            datos = parse_empresa(r.text)
            if datos.get("porAnio") or datos.get("anual"):
                out[c["ticker"]] = datos
                anios = " ".join(f"{a}:{v}" for a, v in sorted(datos.get("porAnio", {}).items()))
                print(f"  {c['ticker']:10} yield {datos.get('yield','-'):7} | {anios}")
            else:
                print(f"  {c['ticker']:10} {nem:10} sin datos de dividendo")
        except Exception as e:
            print(f"  {c['ticker']:10} ERROR {type(e).__name__}: {e}")
        time.sleep(0.8)

    doc = {
        "_comment": ("Dividendos de stockanalysis.com (https://stockanalysis.com/quote/bvl/<NEM>/dividend/). "
                     "Más completo que la BVL. Por ticker: 'anual' (dividendo por acción al año), 'yield', "
                     "'payout', 'frecuencia', 'porAnio' (total por año), 'historial'. "
                     "Correr div_stockanalysis.py para actualizar."),
        "fuente": "https://stockanalysis.com/quote/bvl/<NEMONICO>/dividend/",
        "empresas": out,
    }
    p = os.path.join(APP_DATA, "dividendos.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    print(f"\nEscrito: {p}  ({len(out)} empresas con dividendos)")


if __name__ == "__main__":
    main()
