# 🌎 Empresas del extranjero — cómo traer su información

> Playbook para las empresas que **cotizan en la BVL pero NO presentan a la SMV**
> porque son **emisores extranjeros** (NYSE de EE.UU. o TSX-V de Canadá). La SMV
> no tiene sus estados financieros; hay que ir a **su regulador** o a **su web de
> inversionistas**. Verificado el 11-jul-2026 con las 4 primeras: AUNA, PPX, PML, Rio2.

## La idea en una línea

El proyecto **ya sabe LEER PDFs** (`gen_lecturas.py` / Sentinel, bilingüe ES+EN).
Para el extranjero lo único que falta —y lo 100 % confiable— es **LOCALIZAR el PDF
más reciente**. Eso hace `fetch_extranjero.py`. Los **números exactos** NO se
escriben solos (Regla #1: no inventar): se saca un *digest* "por revisar" y el
analista confirma el número final a mano en `empresas.json`.

## Orden de fuentes (siempre igual)

1. **Primero el REGULADOR del país** (el equivalente a la SMV) — es lo más estable:

   | Mercado | Regulador | Acceso | Qué presentan |
   |---|---|---|---|
   | EE.UU. (NYSE/Nasdaq) | **SEC EDGAR** | **API JSON pública** `data.sec.gov` | 20-F (anual), 6-K (interino) |
   | Canadá (TSX/TSX-V) | **SEDAR+** (sedarplus.ca) | Sin API limpia (búsqueda web) | MD&A + EE.FF. interinos (IFRS) |

   - SEC EDGAR es headless y regalado. Con el **CIK** de la empresa:
     `https://data.sec.gov/submissions/CIK{cik-10-dígitos}.json` → lista de filings.
     El CIK se busca en `https://www.sec.gov/files/company_tickers.json` o con la
     búsqueda de texto `https://efts.sec.gov/LATEST/search-index?q="Nombre"&forms=6-K`.
     ⚠ La SEC exige un `User-Agent` identificable (nombre + correo).

2. **Si no, la WEB de inversionistas**, detectando la plataforma para armar el link del PDF:

   | Pista en los enlaces | Plataforma | Estrategia |
   |---|---|---|
   | `q4cdn.com` | **Q4 Inc.** | CDN predecible `s{NN}.q4cdn.com/{id}/files/doc_financials/{año}/q{n}/...`. La lista de la página la pinta JS → `requests` casi no la ve; usar SEC o sembrar los links. |
   | nombre de archivo **fijo** (`ppx-financial-statements.pdf`) | sitio propio | **Lo más fácil**: la empresa reemplaza el mismo PDF cada trimestre. Se relee igual. |
   | `/site/assets/files/` | Concrete CMS | Raspar la página y tomar el que matchea `{ticker}_{año}_q{n}`. Suele ser JS. |
   | `_files/ugd/` | **Wix** | URLs opacas (hash) → mapear por el **TEXTO del enlace** ("Estados Financieros", "Discusión y Análisis"). |

3. **Los Hechos de Importancia (BVL)** ya llegan por el robot normal (`fetch_hechos.py`)
   — las que SÍ están en la BVL (AUNA/PPX/PML) fluyen igual. **Rio2 NO cotiza en BVL**, así
   que sus comunicados solo salen en su web → por eso el scraping de noticias (abajo) es su
   único feed.

## Noticias (titulares de su web) — auto, para las que no llegan por BVL

`fetch_extranjero.py` también scrapea los **titulares recientes** de la web de la empresa
→ `noticias_extranjero.json` → la ficha los muestra en "📰 Últimas noticias" (`NoticiasExtranjero.jsx`).
Config en el bloque `noticias` de cada empresa:

| Campo | Qué es |
|---|---|
| `url` | página de noticias / home con los comunicados |
| `linkPat` | regex que debe matchear el `href` del artículo (ej. `/post/` en Rio2, `/news/.+-(qm\|doc)-` en PPX) |
| `fecha` | de dónde sale la fecha: `url` (va en el enlace, lo más fiable — PPX), `orden` (por posición en la lista — Rio2), `texto` (en el HTML cercano) |
| `skipTitulos` | textos a ignorar (banners tipo "Leer comunicado") |

- **Rio2** (Wix, no BVL) y **PPX** (Concrete, fecha en la URL) se scrapean headless bien.
- **Panoro/AUNA**: su web de noticias es JS/desordenada, PERO cotizan en BVL → sus noticias ya
  llegan por Hechos de Importancia; no se scrapea su web (se evita ruido).
- El título se limpia (quita la fecha pegada al inicio y titulares repetidos); si el enlace no
  trae texto, se deriva del *slug* de la URL.

**Corre en el robot DIARIO** (`actualizar_todo.py`, tras los pasos rápidos), NO en el intradía de
30 min (las empresas sacan noticias ~cada semana, no hace falta más). Refresco manual/aislado:
`python extractor/fetch_extranjero.py --solo-noticias`. Con caché por empresa: si un sitio se cae,
conserva lo anterior.

## Cómo se agrega una empresa nueva

1. Averigua su **mercado** y **regulador** (¿NYSE→SEC? ¿TSX-V→SEDAR+?).
2. Abre su web de inversionistas y mira los enlaces de "Financials / Estados
   Financieros" → detecta la plataforma con la tabla de arriba.
   - Ayuda: usa el navegador (Claude in Chrome) para inspeccionar los `href` y la
     red; los sitios JS (Q4, Concrete) no muestran los PDF en el HTML crudo.
3. Añade un objeto a **`extractor/extranjero_config.json`** con su `estrategia`
   (`sec_edgar` | `urls_fijas` | `scrape_patron` | `scrape_texto_wix`), su `moneda`,
   y —si es JS— un `docsSeed` con los links actuales (semilla).
4. Corre `python extractor/fetch_extranjero.py TICKER` → escribe
   `documentos_extranjero.json` (la ficha ya los muestra) y `extranjero_digest.json`.
5. Con el *digest* + los PDF abiertos, **verifica y escribe a mano** los
   fundamentos en `app/src/data/empresas.json`:
   `fundamentos`, `metricas`, `balanceDestacado`, `monedaEstados`, `fundamentosFuente`.
   Deja `tesis` / `catalizadores` / `escenarios` pendientes (los llena Jair).

## Las 4 primeras (referencia)

| Ticker | Mercado | Moneda | Estrategia | Nota |
|---|---|---|---|---|
| **AUNA** | NYSE (+BVL) | **PEN** | `sec_edgar` (CIK 1799207) | Salud LatAm. Reporta en soles/IFRS, 6-K/20-F. Web Q4 (`s203.q4cdn.com/408268012`). |
| **PPX** | TSX-V (+BVL) | **CAD** | `urls_fijas` | Junior oro/plata (Igor, La Libertad). Exploration stage, going concern, ingreso vía Net Profit Interest del JV Callanquitas. |
| **PML** | TSX-V (+BVL/Frankfurt) | **USD** | `scrape_patron` | Explorador de cobre (Cotabambas). Pre-ingresos. Página JS → usa `docsSeed`. |
| **RIO** | TSX (no BVL) | **USD** | `scrape_texto_wix` | Oro Fenix (Chile) + compra de Cía. Minera Condestable (cobre, Perú). Ya factura. Sitio Wix. |

## Cadencia y dónde corre

Los reportes extranjeros salen **1 vez por trimestre**, no a diario. Por eso
`fetch_extranjero.py` corre **a mano / en PASOS_EPS**, NUNCA en el robot de 30 min.
Cada trimestre nuevo: actualiza `periodo` en el config, refresca los `docsSeed` de
los sitios JS (con el navegador) y vuelve a correr el script.

## Moneda — ojo

Cada una reporta en su moneda: **AUNA=PEN, PPX=CAD, PML=USD, RIO=USD**. El esquema
ya tiene `monedaEstados`; se muestra la moneda **nativa**, no se convierte a la
fuerza. Y como no hay `eps_anual` cargado para ellas, la app **no** calcula P/E ni
EV/EBITDA (evita valoraciones engañosas entre monedas/mercados distintos).

## Archivos

- `extractor/extranjero_config.json` — recetas por empresa (el único lugar a editar para agregar una): docs + `noticias`.
- `extractor/fetch_extranjero.py` — localizador de docs (4 estrategias) + digest de cifras + scraper de noticias.
- `app/src/data/documentos_extranjero.json` — links oficiales por empresa (lo muestra la ficha).
- `app/src/data/extranjero_digest.json` — cifras candidatas "por revisar" (NO se muestra; ayuda al analista).
- `app/src/data/noticias_extranjero.json` — titulares de su web (lo muestra la ficha, se refresca a diario).
- `app/src/components/DocumentosOficiales.jsx` — la ficha fusiona SMV + extranjero.
- `app/src/components/NoticiasExtranjero.jsx` — sección "📰 Últimas noticias" en la ficha.
