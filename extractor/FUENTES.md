# Fuentes de datos — ALTO Research (guardar SIEMPRE los enlaces)

> Cada vez que Jair pasa un enlace o se descubre uno útil, anotarlo aquí.

## SMV — Información Financiera (estados financieros, XBRL)
- Buscador (Mercado Principal): https://www.smv.gob.pe/SIMV/Frm_InformacionFinanciera
  - De ahí salen: XBRL estructurado (individual), página de detalle HTML (bancos), por trimestre/anual.
- Lo usa: `smv_extractor.py`, `run_batch.py`, `fetch_anual_eps.py`.

## BVL — Precio de cierre (movimientos diarios)
- Endpoint JSON: `POST https://dataondemand.bvl.com.pe/v1/stock-quote/market` (body `{}`) → todo el mercado.
- Página: https://www.bvl.com.pe/mercado/movimientos-diarios
- Lo usa: `fetch_precios.py`.

## BVL — Precios HISTÓRICOS diarios (descubierto 01-jul-2026) 🎯
- Endpoint JSON: `GET https://dataondemand.bvl.com.pe/v1/stock-quote/share-values/<NEMONICO>?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
  → `{"nemonico":"BVN","currencySymbol":"$","values":[["2026-01-02","28.04"],...]}` (cierres diarios del rango).
- Es el mismo API que usa el gráfico de la propia web de la BVL. Sin token, con headers de
  navegador (User-Agent + Origin/Referer bvl.com.pe). Descubierto inspeccionando `main.<hash>.js`
  de bvl.com.pe (ahí está el mapa completo de rutas `/v1/...`; a veces el CDN devuelve el index
  como fallback → reintentar con headers Sec-Fetch-Dest: script).
- QUIRKS: la serie viene RELLENADA (repite el último cierre los días sin negociación) y manda
  `0.0` cuando no hay cotización (se filtran). Por eso la volatilidad solo es confiable si la
  acción negocia seguido (ver `pocoNegociada` en el JSON).
- Otros endpoints útiles del mismo API: `/v1/stock-quote/daily?nemonico=X&today=YYYY-MM-DD`
  (ticks intradía de HOY), `/v1/issuers/search` (buscador de emisores con companyCode),
  `/v1/index-historical-data` (índices).
- Lo usa: `fetch_historicos.py` → `historicos.json` (sparkline + termómetro de volatilidad
  de la app). Correr A DIARIO junto a `fetch_precios.py` en el robot.
- El API acepta rangos largos: probado desde 2025-01-01 (~18 meses) sin problema. El script
  baja desde el 1 de enero del año pasado para poder mostrar el precio de la acción en la
  fecha de cada dividendo del año pasado (la vol/rango 52s se calculan solo con 12 meses).

## Dividendos
- **stockanalysis.com (PRINCIPAL, más completo que la BVL):**
  https://stockanalysis.com/quote/bvl/<NEMONICO>/dividend/
  - Trae historial completo por año, yield, payout, frecuencia. Incluye pagos que la BVL
    se salta (ej. Michell ene-2026, Cerro Verde). La data está en el HTML (Svelte SSR),
    se parsea con requests. Muestra el monto en la MONEDA en que cotiza (US$ o S/).
  - Lo usa: `div_stockanalysis.py` → genera `dividendos.json`. **Este es el que se usa hoy.**
- BVL "Entrega de Derechos" (vigente, fechas de entrega): https://documents.bvl.com.pe/empresas/entrder1.htm
  (lo usaba `div_extractor.py`; quedó de respaldo — la BVL omite pagos).
- BVL "Beneficios Distribuidos 2025": https://documents.bvl.com.pe/pubdif/infmen/202512e4.htm
  (respaldo; cambiar `202512` por `AAAAMM` de diciembre de otro año).

## BVL — Hechos de Importancia POR EMPRESA (descubierto 02-jul-2026) 🎯 **FUENTE PRINCIPAL**
- `GET https://dataondemand.bvl.com.pe/v1/issuers` → TODOS los emisores con `rpjCode` y
  `companyCode` (los 59 nuestros ya están mapeados en empresas_config.json → `bvlRpj`).
- `POST https://dataondemand.bvl.com.pe/v1/corporate-actions`
  body: `{"rpjCode":"B20013","page":1,"size":40,"search":"","startDate":"2025-07-01","endDate":"2026-07-02"}`
  → `{totalElements, totalPages, content:[{registerDate, observation, codes:[{descCodeHHII}],
  documents:[{path}]}]}`. HISTORIAL COMPLETO por empresa (no solo el día, como el portal SMV).
- PDFs: `https://documents.bvl.com.pe<path>`.
- Descubierto interceptando el XHR de la pestaña "Hechos de importancia" de
  bvl.com.pe/emisores/detalle con Chrome (el body exige TODOS los campos; sin `search` da
  "Regex string must not be null").
- Lo usa: `fetch_hechos.py` → `hechos.json` (sección 📰 de la ficha). Correr A DIARIO.

## BVL — BENEFICIOS (dividendos en efectivo) por valor (descubierto 02-jul-2026) 🎯
- El MISMO `GET https://dataondemand.bvl.com.pe/v1/issuers` trae, por emisor,
  `listValue[].listBenefit`: historial completo de beneficios por nemonico con
  `benefitType` ("DE" = dividendo en efectivo), `benefitValue`, `coin` (S/ o US$) y fechas
  `dateAgreement/dateCut/dateRegistry/dateDelivery`. FIBPRIME tiene 47 desde 2019.
- Lo usa: `fetch_beneficios.py` → PARCHA `dividendos.json` solo para tickers sin datos de
  stockanalysis (FIBRAs, chicas). Correr a diario DESPUÉS de `div_stockanalysis.py`.

## SMV — Hechos de Importancia (HI) — descifrado 30-jun-2026 (RESPALDO)
- Portal: https://www.smv.gob.pe/SIMV/ → "Ir a Hechos de importancia general" →
  `Frm_hechosdeImportanciaAll?data=<TOKEN>`.
- Usa TOKEN de sesión (`?data=`) que EXPIRA; se saca fresco de /SIMV/ (no hardcodear).
- Búsqueda = formulario ASP.NET de DOS POSTBACKS (como el portal financiero): postback para
  activar HI (__EVENTTARGET=cboDenominacionSocial) y luego `btnBuscar` con rango de fechas.
- `requests` funciona con el token vivo; **Chrome NO hace falta** (y es inestable para esto).
- Lo usa: `hechos_importancia.py` → `hechos_importancia.json`. PARCIAL: trae solo la 1ª página
  del rango (falta paginación para historial completo por empresa).

## Tipo de cambio USD/PEN
- https://open.er-api.com/v6/latest/USD (campo rates.PEN). Lo usa: `fetch_anual_eps.py`.

## Informes propios de ALTO (criterio de Jair)
- Carpeta: `C:\Users\User\Desktop\INFORMES REALIZADOS ALTO RESEARCH`
  - Reportes Q1 2026 (NEXA, MINSUR, BVN, VOLCAN, CVERDE, BACKUS, BROCAL), DATOS_VERIFICADOS.md,
    plan de compra, manual educativo. Base de las tesis y escenarios.

## MINEM — Boletín Estadístico Minero (BEM): producción mensual por empresa (08-jul-2026)
- Colección (la pasó Jair): https://www.gob.pe/institucion/minem/colecciones/6-boletin-estadistico-minero
- Lo que sirve: **"Cuadros Estadísticos Mineros – Prepublicación del BEM <MES>"** → Excel
  `s01-produccion-minera-metalica-*.xlsx`, hoja **S01.C02** = producción POR EMPRESA (top ~10
  por metal + "OTROS"). Para may/jun-2025 (sin prepublicación) → el "Excel de anexos" del
  Boletín, hoja "2. PRODUCCIÓN EMPRESAS" (mismo cuadro).
- **Truco clave:** la edición del mes M año Y trae ese mes para Y **y para Y-1** → con las
  ediciones jul-2025→hoy se arma la serie mensual desde ene-2025.
- Quirks: gob.pe devuelve **418 sin User-Agent de navegador** (mandar UA Chrome); nombres de
  archivo varían (`ed-4`, `ed-04`, `-vf`, `%282%29`); "N/D" = sin dato; nombres de empresa con
  `*`/nota al pie (limpiar); solo aparecen los TOP por metal → si una empresa no sale un mes,
  produjo poco (NO es cero: la app lo explica, Regla #1).
- Lo usa: `fetch_bem.py` → `mineria.json` (caché de Excels en `extractor/cache_bem/`, committeada;
  auto-descubre ediciones nuevas en la colección). Familia minera (participaciones VERIFICADAS,
  manual): `app/src/data/mineria_familia.json`. UI: `ProduccionMinera.jsx` (fichas de minas).
