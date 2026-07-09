# -*- coding: utf-8 -*-
"""
🗣 CHARLA DE LA GERENCIA — baja el "Análisis y Discusión de la Gerencia" (el
informe trimestral donde la propia gerencia CUENTA cómo le fue) de cada
empresa desde la SMV, extrae lo importante y lo deja en gerencia.json para
que Atlas lo use ("¿qué dice la gerencia de X?").

Sale: app/src/data/gerencia.json
  { ticker: { periodo, fechaPresentacion, expediente, frases[≤7], montos[≤6] } }

CACHÉ: si el expediente no cambió, no se re-descarga (la SMV publica por
trimestre). La SMV es LENTA y flaky desde la nube → este paso corre en el
modo COMPLETO local y en --trimestral, NO en el robot de 30 min (igual que
fetch_anual_eps). El PDF no se guarda, solo el extracto.
"""
import io, json, os, re, sys, time
import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from smv_extractor import nueva_sesion, _hidden, _form_base, BASE  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, ".."))
DATA = os.path.join(RAIZ, "app", "src", "data")
SALIDA = os.path.join(DATA, "gerencia.json")

# lo que un lector experto subraya en una charla de gerencia
CLAVES = [
    r"(?:S/|US\$|USD|\$)\s?\d", r"\d+(?:\.\d+)?\s?%",
    r"(ventas?|ingresos?)", r"(utilidad|ganancia|p[eé]rdida|resultado)",
    r"(margen|ebitda|flujo de caja|caja)", r"(producci[oó]n|volumen|toneladas|onzas)",
    r"(aument[oó]|creci[oó]|mejor[oó]|super[oó]|r[eé]cord)",
    r"(disminuy[oó]|cay[oó]|se redujo|menor|afectad)",
    r"(respecto (?:al|del)|comparaci[oó]n|a[ñn]o anterior|trimestre anterior)",
    r"(precio de[l]? (?:zinc|cobre|oro|plata|esta[ñn]o|plomo|az[uú]car|harina))",
    r"(deuda|financiamiento|inversi[oó]n|capex)", r"(dividendo)",
    r"(se espera|proyect|estima|perspectiv|plan(?:es)? de)",
]


def extraer_frases(texto):
    oraciones = [o.strip() for o in re.split(r"(?<=[.;])\s+|\n{2,}", texto)
                 if 50 <= len(o.strip()) <= 340]
    puntuadas = []
    for o in oraciones:
        p = sum(1 for k in CLAVES if re.search(k, o, re.I))
        # las frases con cifra Y explicación valen doble
        if re.search(r"(?:S/|US\$|USD|\$)\s?\d|\d+(?:\.\d+)?\s?%", o) and p >= 3:
            p += 2
        if p >= 3:
            puntuadas.append((p, o))
    puntuadas.sort(key=lambda x: -x[0])
    # sin frases casi repetidas (las gerencias se repiten mucho)
    frases, vistos = [], set()
    for _, o in puntuadas:
        firma = re.sub(r"\d", "", o.lower())[:80]
        if firma in vistos:
            continue
        vistos.add(firma)
        frases.append(re.sub(r"\s+", " ", o)[:300])
        if len(frases) >= 7:
            break
    return frases


def buscar_gerencia(s, smv_id, anio, trimestre):
    """Devuelve (url_pdf, expediente, fecha) del 'Análisis y Discusión de la Gerencia'."""
    soup = BeautifulSoup(s.get(BASE, timeout=45).text, "lxml")
    f = _form_base(_hidden(soup), smv_id, anio, trimestre)
    f["__EVENTTARGET"] = "ctl00$MainContent$cboDenominacionSocial"
    soup2 = BeautifulSoup(s.post(BASE, data=f, timeout=45).text, "lxml")
    f2 = _form_base(_hidden(soup2), smv_id, anio, trimestre)
    f2["ctl00$MainContent$cbBuscar"] = "Buscar"
    soup3 = BeautifulSoup(s.post(BASE, data=f2, timeout=45).text, "lxml")

    for tr in soup3.find_all("tr"):
        t = tr.get_text(" ", strip=True)
        if re.search(r"an[aá]lisis y discusi[oó]n de la gerencia", t, re.I):
            a = tr.find("a", title=re.compile(r"descargar", re.I))
            exp = re.search(r"\b(20\d{8})\b", t)
            fecha = re.search(r"(\d{2}/\d{2}/\d{4})", t)
            if a and a.get("href"):
                return (a["href"].strip(),
                        exp.group(1) if exp else None,
                        fecha.group(1) if fecha else None)
    return None, None, None


def main():
    with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    anio = cfg.get("anio", 2026)
    trimestre = cfg.get("trimestre", 1)

    viejas = {}
    if os.path.exists(SALIDA):
        with open(SALIDA, encoding="utf-8") as f:
            viejas = json.load(f).get("gerencia", {})

    def escribir(salida):
        doc = {
            "_comment": ("'Análisis y Discusión de la Gerencia' (la charla trimestral de la gerencia) por "
                         "empresa, extraído de la SMV por extractor/fetch_gerencia.py. Solo frases y montos "
                         "textuales del documento (extractivo, Regla #1). Se refresca en el modo completo "
                         "local o --trimestral (la SMV es flaky desde la nube)."),
            "gerencia": salida,
        }
        with open(SALIDA, "w", encoding="utf-8", newline="\n") as f:
            json.dump(doc, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write("\n")

    salida, nuevos, fallos = {}, 0, 0
    for c in cfg["empresas"]:
        ticker, smv_id = c["ticker"], c.get("smvId")
        if not smv_id or c.get("sin_documentos"):
            continue
        try:
            s = nueva_sesion()
            url, exp, fecha = buscar_gerencia(s, smv_id, anio, trimestre)
            if not url:
                print(f"  {ticker:10} -> sin 'Análisis y Discusión' en {anio}-T{trimestre}", flush=True)
                if ticker in viejas:
                    salida[ticker] = viejas[ticker]   # conservar la del trimestre anterior
                continue
            if ticker in viejas and viejas[ticker].get("expediente") == exp:
                salida[ticker] = viejas[ticker]       # mismo expediente: caché
                print(f"  {ticker:10} -> sin cambios (exp {exp})", flush=True)
                continue
            r = s.get(url, timeout=90)
            r.raise_for_status()
            lector = PdfReader(io.BytesIO(r.content))
            texto = "\n".join((p.extract_text() or "") for p in lector.pages)[:80000]
            texto = re.sub(r"[ \t]+", " ", texto)
            if len(texto.strip()) < 200:
                print(f"  {ticker:10} -> PDF escaneado (sin texto)", flush=True)
                continue
            frases = extraer_frases(texto)
            montos = list(dict.fromkeys(
                m.strip() for m in re.findall(
                    r"(?:S/\.?|US\$|USD|\$)\s?[\d][\d,.]*(?:\s?(?:millones|mill[oó]n|mil|MM|M)\b)?", texto)
            ))[:6]
            salida[ticker] = {
                "periodo": f"{anio}-T{trimestre}",
                "fechaPresentacion": fecha,
                "expediente": exp,
                "paginas": len(lector.pages),
                "frases": frases,
                "montos": montos,
            }
            nuevos += 1
            print(f"  {ticker:10} -> OK ({len(lector.pages)} pág., {len(frases)} frases)", flush=True)
            if nuevos % 10 == 0:
                escribir(salida)  # guardado INCREMENTAL: si el proceso muere, no se pierde nada
            time.sleep(1.0)  # la SMV se atora con ráfagas
        except Exception as e:
            fallos += 1
            if ticker in viejas:
                salida[ticker] = viejas[ticker]
            print(f"  {ticker:10} -> ERROR {str(e)[:70]}", flush=True)

    escribir(salida)
    print(f"\nEscrito: {SALIDA} ({len(salida)} empresas · {nuevos} nuevas · {fallos} fallos)")


if __name__ == "__main__":
    main()
