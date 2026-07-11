# -*- coding: utf-8 -*-
"""
🌎 FETCH EXTRANJERO — localizador de documentos oficiales de empresas del
extranjero que cotizan en la BVL pero NO presentan a la SMV (AUNA/NYSE,
PPX/PML/RIO en TSX-V de Canadá).

FILOSOFÍA (ver extractor/FUENTES_EXTRANJERO.md):
  El proyecto YA tiene el "cerebro" que LEE PDFs (gen_lecturas.py / Sentinel,
  bilingüe ES+EN). Para el extranjero lo único que falta —y lo 100% confiable—
  es LOCALIZAR el PDF más reciente. Este script hace eso, por empresa, según su
  plataforma. Los NÚMEROS exactos NO se escriben solos en empresas.json: se
  extrae un digest "por revisar" (Regla #1: no inventar) para que el analista
  confirme; empresas.json es la fuente de verdad y se llena a mano/verificado.

ESTRATEGIAS (campo "estrategia" en extranjero_config.json):
  - sec_edgar        → API pública data.sec.gov (EE.UU.). 100% headless, links
                       oficiales permanentes. Regulador = equivalente a la SMV.
  - urls_fijas       → la empresa reemplaza el mismo PDF cada trimestre (PPX).
                       Lo más fácil: se releen tal cual. 100% headless.
  - scrape_patron    → raspa la página de financials y toma el PDF que matchea
                       {ticker}_{anio}_q{tri} (Panoro). Si es JS y requests no ve
                       nada, cae al docsSeed del config.
  - scrape_texto_wix → sitio Wix con URLs opacas: mapea por el TEXTO del enlace
                       ("Estados Financieros", "Discusión y Análisis") (Rio2).

SALIDAS:
  app/src/data/documentos_extranjero.json  → links por empresa (lo consume la
      ficha: DocumentosOficiales.jsx los muestra junto a los de la SMV).
  app/src/data/extranjero_digest.json      → cifras candidatas "por revisar"
      (best-effort, para el analista; NO se muestra en la app).

CADENCIA: los reportes extranjeros salen 1 vez por TRIMESTRE, no a diario. Este
script corre a mano / en PASOS_EPS, NUNCA en el robot de 30 min.

Uso:
  python extractor/fetch_extranjero.py            # todas
  python extractor/fetch_extranjero.py AUNA PPX   # solo esas
  python extractor/fetch_extranjero.py --solo-links   # sin digest de cifras
"""
import io, json, os, re, sys, time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

try:
    import requests
except ImportError:
    print("Falta 'requests' (pip install -r extractor/requirements.txt)"); sys.exit(1)
try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, ".."))
DATA = os.path.join(RAIZ, "app", "src", "data")
CONFIG = os.path.join(AQUI, "extranjero_config.json")
SALIDA_DOCS = os.path.join(DATA, "documentos_extranjero.json")
SALIDA_DIGEST = os.path.join(DATA, "extranjero_digest.json")
SALIDA_NOTICIAS = os.path.join(DATA, "noticias_extranjero.json")

UA = "ALTO Research (educativo; contacto altoresearch1@gmail.com)"
HDRS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
HDRS_SEC = {"User-Agent": UA}  # la SEC exige un UA identificable


def _get(url, headers=HDRS, timeout=45):
    return requests.get(url, headers=headers, timeout=timeout)


def _vive(url, headers=HDRS):
    """HEAD/GET liviano para confirmar que un PDF sigue publicado (200)."""
    try:
        r = requests.head(url, headers=headers, timeout=25, allow_redirects=True)
        if r.status_code >= 400 or "pdf" not in (r.headers.get("content-type", "").lower() + "pdf"):
            # algunos CDNs no responden bien a HEAD → probar GET de 1 byte
            r = requests.get(url, headers={**headers, "Range": "bytes=0-1024"}, timeout=25)
        return r.status_code in (200, 206)
    except Exception:
        return False


# ─────────────────────────────── ESTRATEGIAS ────────────────────────────────

def estrategia_sec_edgar(c, periodo):
    """EE.UU.: API de la SEC. Devuelve (docs, extra)."""
    cik = str(c["secCik"]).zfill(10)
    docs = dict(c.get("docsSeed") or {})
    # link estable a TODOS los filings de la empresa en EDGAR (el regulador)
    docs["regulador"] = (f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany"
                         f"&CIK={int(cik)}&type=6-K&dateb=&owner=include&count=40")
    try:
        j = _get(f"https://data.sec.gov/submissions/CIK{cik}.json", headers=HDRS_SEC).json()
        rec = j["filings"]["recent"]
        for i, form in enumerate(rec["form"]):
            if form in ("6-K", "20-F", "40-F"):
                docs["_reguladorUltimo"] = f"{form} · {rec['filingDate'][i]}"
                break
    except Exception as e:
        print(f"    (EDGAR falló, uso docsSeed): {str(e)[:70]}")
    return docs


def estrategia_urls_fijas(c, periodo):
    docs = dict(c.get("docsFijos") or {})
    return docs


def estrategia_scrape_patron(c, periodo):
    """Raspa la página; toma el PDF que matchea {ticker}_{anio}_q{tri}."""
    docs = dict(c.get("docsSeed") or {})
    anio, tri = _anio_tri(periodo)
    try:
        html = _get(c["docsPage"]).text
        pdfs = re.findall(r'href=["\']([^"\']+\.pdf[^"\']*)', html, re.I)
        pat = (c.get("patronPdf") or "").format(anio=anio, tri=tri)
        recientes = [p for p in pdfs if pat and pat.lower() in p.lower()]
        # el nombre trae fs/mda → mapear a eeff/gerencia
        for p in recientes:
            full = _abs(p, c["docsPage"])
            if re.search(r"_fs[_\.]|financial", p, re.I):
                docs["eeff"] = full
            elif re.search(r"_mda[_\.]|mda|md&a", p, re.I):
                docs["gerencia"] = full
        if recientes:
            print(f"    scrape_patron: {len(recientes)} PDF del período en la página")
        else:
            print("    scrape_patron: página JS (0 links) → uso docsSeed del config")
    except Exception as e:
        print(f"    (scrape falló, uso docsSeed): {str(e)[:70]}")
    return docs


def estrategia_scrape_texto_wix(c, periodo):
    """Sitio Wix: URLs opacas → mapear por el TEXTO del enlace."""
    docs = dict(c.get("docsSeed") or {})
    if not BeautifulSoup:
        print("    (sin bs4 → uso docsSeed)"); return docs
    try:
        soup = BeautifulSoup(_get(c["docsPage"]).text, "lxml")
        selectores = c.get("selectoresTexto") or {}
        for a in soup.find_all("a", href=True):
            txt = a.get_text(" ", strip=True).lower()
            href = a["href"]
            if ".pdf" not in href.lower():
                continue
            for clave, aguja in selectores.items():
                if aguja.lower() in txt:
                    docs[clave] = _abs(href, c["docsPage"])
        print(f"    scrape_texto_wix: mapeados {list(docs)}")
    except Exception as e:
        print(f"    (scrape wix falló, uso docsSeed): {str(e)[:70]}")
    return docs


ESTRATEGIAS = {
    "sec_edgar": estrategia_sec_edgar,
    "urls_fijas": estrategia_urls_fijas,
    "scrape_patron": estrategia_scrape_patron,
    "scrape_texto_wix": estrategia_scrape_texto_wix,
}


# ─────────────────────────────── DIGEST DE CIFRAS ───────────────────────────
# Best-effort: baja el PDF principal y pesca líneas con cifras clave. NO es
# preciso (layouts distintos) → SIEMPRE marcado revisar:true. El analista
# confirma y escribe el número final a mano en empresas.json (Regla #1).

PATRONES_CIFRA = [
    ("ingresos", r"(?:revenue|revenues|ingresos|total revenue)[^\n]{0,60}?"
                 r"([$SU/€]{0,3}\s?[\d.,]{3,}\s?(?:million|millones|M|mil)?)"),
    ("utilidad", r"(?:net income|net \(?loss\)?|utilidad neta|net profit|net earnings)"
                 r"[^\n]{0,60}?([-(]?[$SU/€]{0,3}\s?[\d.,]{2,}\s?(?:million|millones|M)?\)?)"),
    ("ebitda", r"(?:adjusted ebitda|ebitda)[^\n]{0,50}?"
               r"([$SU/€]{0,3}\s?[\d.,]{2,}\s?(?:million|millones|M)?)"),
    ("caja", r"(?:cash and cash equivalents|cash, end|caja|efectivo)[^\n]{0,50}?"
             r"([$SU/€]{0,3}\s?[\d.,]{3,})"),
    ("activos", r"(?:total assets|activos totales|total activos)[^\n]{0,40}?"
                r"([$SU/€]{0,3}\s?[\d.,]{3,})"),
]


def digest_cifras(url):
    """Devuelve {campo: 'texto de la línea'} — pistas, no verdades."""
    try:
        import pypdf
        r = _get(url, timeout=90)
        if r.status_code != 200:
            return {"_error": f"HTTP {r.status_code}"}
        rd = pypdf.PdfReader(io.BytesIO(r.content))
        texto = "\n".join((pg.extract_text() or "") for pg in rd.pages[:20])
    except Exception as e:
        return {"_error": str(e)[:80]}
    texto = re.sub(r"[ \t]+", " ", texto)
    out = {}
    for campo, pat in PATRONES_CIFRA:
        m = re.search(pat, texto, re.I)
        if m:
            linea = m.group(0).strip()
            out[campo] = re.sub(r"\s+", " ", linea)[:120]
    return out


# ─────────────────────────────── NOTICIAS ───────────────────────────────────
# Titulares recientes de la web oficial de la empresa. Clave para las que NO
# cotizan en BVL (Rio2): sus noticias no llegan por Hechos de Importancia. Para
# las que SÍ (PPX/PML), es un complemento. Corre más seguido que los EEFF (las
# empresas sacan noticias cada semana) → puede ir en el robot diario.

_MES_EN = {m: i for i, m in enumerate(
    "jan feb mar apr may jun jul aug sep oct nov dec".split(), 1)}
_MES_ABR = "ene feb mar abr may jun jul ago set oct nov dic".split()


def _fmt_fecha(anio, mes, dia):
    try:
        m = _MES_ABR[int(mes) - 1]
        return f"{int(dia)}-{m}-{anio}" if anio else f"{int(dia)} {m}"
    except Exception:
        return None


def _fecha_en_texto(txt):
    """Pesca 'June 8, 2026' / 'Jun 8 2026' / 'Jun 23' en un texto corto."""
    m = re.search(r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z.]*\s+(\d{1,2})(?:,?\s+(\d{4}))?",
                  txt, re.I)
    if not m:
        return None
    mes = _MES_EN[m.group(1)[:3].lower()]
    return _fmt_fecha(m.group(3) or "", mes, m.group(2))


_DATE_PREFIX = re.compile(
    r"^\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z.]*\s+\d{1,2},?\s*\d{0,4}\s*", re.I)


def _limpia_titulo(t):
    t = re.sub(r"\s+", " ", t or "").strip()
    t = _DATE_PREFIX.sub("", t)                 # quita "July 6, 2026 " al inicio
    t = t.strip(" ›»>→→–-")
    # algunos CMS repiten el titular (título + resumen que arranca igual): cortar
    if len(t) > 40:
        cabeza = t[:32]
        i = t.find(cabeza, 12)
        if i > 12:
            t = t[:i].strip(" .–-")
    return t


def _titulo_de(a, href):
    """Título del enlace; si es genérico, se deriva del slug de la URL."""
    t = _limpia_titulo(a.get_text(" ", strip=True))
    if t and len(t) >= 12:
        return t
    slug = re.sub(r"[-/]+", " ", href.rstrip("/").rsplit("/", 1)[-1])
    slug = re.sub(r"\b(qm|doc|nr|20\d\d|\d{2})\b", " ", slug)  # quita ruido del slug
    slug = re.sub(r"\s+", " ", slug).strip()
    return slug[:1].upper() + slug[1:] if slug else None


def scrape_noticias(c):
    """Devuelve [{fecha, titulo, url}] recientes de la web de la empresa."""
    nc = c.get("noticias")
    if not nc or not BeautifulSoup:
        return None
    try:
        soup = BeautifulSoup(_get(nc["url"]).text, "lxml")
    except Exception as e:
        print(f"    (noticias falló): {str(e)[:70]}")
        return None
    modo = nc.get("fecha", "url")
    skip = set(s.lower() for s in nc.get("skipTitulos", []))
    fechas_orden = []
    if modo == "orden":
        fechas_orden = re.findall(
            r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z.]*\s+\d{1,2}(?:,?\s+\d{4})?",
            soup.get_text(" "), re.I)

    vistos, items, idx = set(), [], 0
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not re.search(nc["linkPat"], href, re.I):
            continue
        full = _abs(href, nc["url"])
        if full in vistos:
            continue
        titulo = _titulo_de(a, href)
        if not titulo or titulo.lower() in skip:
            continue
        vistos.add(full)
        # fecha
        fecha = None
        m = re.search(r"(\d{4})-(\d{2})-(\d{2})", href)     # en la URL (PPX)
        if m:
            fecha = _fmt_fecha(m.group(1), m.group(2), m.group(3))
        elif modo == "texto":                                # en ancestros (Panoro)
            node = a
            for _ in range(4):
                node = node.parent
                if node is None:
                    break
                t = node.get_text(" ", strip=True)
                if len(t) < 240:
                    fecha = _fecha_en_texto(t)
                    if fecha:
                        break
        elif modo == "orden":                                # por orden (Rio2)
            if idx < len(fechas_orden):
                fecha = _fecha_en_texto(fechas_orden[idx]) or fechas_orden[idx].strip()
        items.append({"fecha": fecha, "titulo": titulo, "url": full})
        idx += 1
        if len(items) >= 6:
            break
    return items


# ─────────────────────────────── HELPERS ────────────────────────────────────

def _anio_tri(periodo):
    m = re.match(r"(\d{4})-T(\d)", periodo or "")
    return (int(m.group(1)), int(m.group(2))) if m else (2026, 1)


def _abs(href, base):
    from urllib.parse import urljoin
    if href.startswith("//"):
        return "https:" + href
    return urljoin(base, href)


def _escribir(ruta, obj):
    with open(ruta, "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")


# ─────────────────────────────── MAIN ───────────────────────────────────────

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    solo_links = "--solo-links" in sys.argv
    solo_noticias = "--solo-noticias" in sys.argv   # solo refresca titulares (robot diario)
    with open(CONFIG, encoding="utf-8") as f:
        cfg = json.load(f)
    periodo = cfg.get("periodo", "2026-T1")
    empresas = [c for c in cfg["empresas"] if (not args or c["ticker"] in args)]

    # arrancar de lo ya escrito (filtrar por ticker NO debe borrar a las demás)
    def _cargar(ruta, clave):
        if os.path.exists(ruta):
            with open(ruta, encoding="utf-8-sig") as f:
                return dict(json.load(f).get(clave, {}))
        return {}
    docs_out = _cargar(SALIDA_DOCS, "documentos")
    digest_out = _cargar(SALIDA_DIGEST, "digest")
    noticias_out = _cargar(SALIDA_NOTICIAS, "noticias")

    def escribir_noticias():
        _escribir(SALIDA_NOTICIAS, {
            "_comment": ("Titulares recientes de la web oficial de empresas extranjeras (los recolecta "
                         "extractor/fetch_extranjero.py). Clave para las que NO cotizan en BVL (Rio2): "
                         "su noticia no llega por Hechos de Importancia. Lo muestra la ficha "
                         "(NoticiasExtranjero.jsx)."),
            "noticias": noticias_out,
        })

    # --solo-noticias: refresca titulares y sale (sin tocar docs/digest)
    if solo_noticias:
        for c in empresas:
            its = scrape_noticias(c)
            if its:
                noticias_out[c["ticker"]] = {"sitio": c.get("sitioIR") or c["noticias"]["url"], "items": its}
                print(f"■ {c['ticker']}: {len(its)} noticias")
        escribir_noticias()
        print(f"\n✔ Escrito {SALIDA_NOTICIAS} ({len(noticias_out)} empresas)")
        return
    for c in empresas:
        t = c["ticker"]
        estr = c.get("estrategia")
        print(f"\n■ {t} ({c.get('mercado')}) · estrategia={estr} · moneda={c.get('moneda')}")
        fn = ESTRATEGIAS.get(estr)
        if not fn:
            print(f"    estrategia desconocida: {estr}"); continue
        docs = fn(c, periodo) or {}

        # verificar que los PDFs sigan vivos (no rompe si falla; solo avisa)
        vivos = {}
        for k, url in docs.items():
            if k.startswith("_") or k == "regulador" or not isinstance(url, str):
                vivos[k] = url; continue
            ok = _vive(url)
            vivos[k] = url
            print(f"    {k:12} {'✓' if ok else '✗ (revisar)'} {url[:80]}")

        docs_out[t] = {
            "fuente": c.get("regulador") or c.get("mercado"),
            "mercado": c.get("mercado"),
            "moneda": c.get("moneda"),
            "periodo": c.get("periodo") or periodo,
            "sitioIR": c.get("sitioIR"),
            "docs": vivos,
        }

        # titulares recientes de su web (para la ficha)
        its = scrape_noticias(c)
        if its:
            noticias_out[t] = {"sitio": c.get("sitioIR") or c["noticias"]["url"], "items": its}
            print(f"    noticias: {len(its)} titulares")

        if not solo_links:
            # digest del documento con las cifras (release para AUNA, EEFF para minas)
            fuente_cifras = vivos.get("release") or vivos.get("eeff")
            if fuente_cifras:
                d = digest_cifras(fuente_cifras)
                d["_fuente"] = fuente_cifras
                d["revisar"] = True
                digest_out[t] = d
                print(f"    digest: {', '.join(k for k in d if not k.startswith('_') and k!='revisar') or 'sin match'}")
            time.sleep(0.5)

    _escribir(SALIDA_DOCS, {
        "_comment": ("Links a los documentos oficiales de empresas EXTRANJERAS que cotizan en BVL "
                     "pero reportan en su país (SEC/SEDAR+), no a la SMV. Generado por "
                     "extractor/fetch_extranjero.py. Lo muestra la ficha (DocumentosOficiales.jsx)."),
        "documentos": docs_out,
    })
    print(f"\n✔ Escrito {SALIDA_DOCS} ({len(docs_out)} empresas)")

    escribir_noticias()
    print(f"✔ Escrito {SALIDA_NOTICIAS} ({len(noticias_out)} empresas)")

    if not solo_links:
        _escribir(SALIDA_DIGEST, {
            "_comment": ("Cifras CANDIDATAS extraídas de los PDF (best-effort, layouts distintos). "
                         "revisar:true SIEMPRE — son pistas para el analista, NO se muestran en la "
                         "app. El número final va a mano/verificado en empresas.json (Regla #1)."),
            "digest": digest_out,
        })
        print(f"✔ Escrito {SALIDA_DIGEST} ({len(digest_out)} empresas)")


if __name__ == "__main__":
    main()
