# Extractor SMV — ALTO Research

Conecta la app con el Portal SMV: descarga y parsea los estados financieros
**INDIVIDUALES** del **1er trimestre (I) de 2026** y genera el `empresas.json`
que consume la app.

## Cómo correr

```
pip install requests beautifulsoup4 lxml      (solo la primera vez)
python run_batch.py
```

Esto:
1. Lee `empresas_config.json` (qué empresas extraer, por sector).
2. Para cada empresa replica el formulario de la SMV (empresa → Individual →
   Intermedio → 2026 → Trimestre I → Buscar).
3. Descarga el **Archivo Estructurado XBRL** y lo parsea (taxonomía IFRS).
   - Los **bancos** no presentan XBRL (son SBS): cae a la **página de detalle
     oficial** (HTML) y la parsea. Sus importes vienen en miles.
4. Escribe:
   - `../app/src/data/empresas.json` — lo que usa la app.
   - `salida_smv.json` — volcado crudo para trazabilidad.

## Precios de la BVL (cierre del día anterior)

```
python fetch_precios.py
```

Baja el último precio de **cierre** de cada empresa desde el endpoint público de
la BVL (`POST dataondemand.bvl.com.pe/v1/stock-quote/market`, que devuelve todo el
mercado) y escribe `../app/src/data/precios.json`. La app muestra el precio con
su **fecha real** y la aclaración "Cierre del día anterior". Para acciones que se
negocian poco (Laive, Creditex, Filamentos), muestra el último cierre disponible
con su fecha (no inventa un precio de hoy — Regla #1).

Vuelve a correrlo cada día (o antes de cada deploy) para refrescar precios.
El nemónico BVL de cada empresa está en `empresas_config.json` (`bvlNemonico`).

## Dividendos de la BVL

```
python div_extractor.py
```

Baja la página "Entrega de Derechos" de la BVL (se actualiza al día) y escribe
`../app/src/data/dividendos.json` con el dividendo vigente por empresa: monto
(efectivo S//US$ o % en acciones), concepto y fechas (corte, registro, entrega).
Si una empresa no tiene derecho vigente, no aparece (la app muestra "sin dividendo
vigente ahora"). Vuelve a correrlo para refrescar.

## P/E (precio ÷ ganancia anual)

```
python fetch_anual_eps.py
```

Baja la **ganancia anual 2025** (individual) de la SMV de cada empresa y el **tipo de
cambio USD/PEN** de internet → `../app/src/data/eps_anual.json`. La app calcula el
P/E = precio de hoy (BVL) ÷ ganancia anual, convirtiendo con el tipo de cambio cuando
el precio está en soles y la ganancia en dólares (NEXA, Exalmar). Si la empresa tuvo
pérdida, la app dice "No aplica" (no inventa un P/E). Vuelve a correrlo para refrescar
el tipo de cambio o cuando salga el balance anual nuevo.

## Cómo se actualiza cada cosa
- **Estados financieros** (deuda, FCF, EPS, capex, margen, balance): son del Q1 2026.
  Cuando la SMV publique el Q2, cambia `trimestre` en `empresas_config.json` y corre `run_batch.py`.
- **Precio de cierre**: corre `fetch_precios.py` (cada día, tras el cierre).
- **Dividendos**: corre `div_extractor.py` (cuando quieras refrescar).

## Archivos
- `smv_extractor.py` — la lógica SMV: formulario, descarga, parseo XBRL y parseo HTML de bancos.
- `run_batch.py` — corre el lote SMV y arma el `empresas.json` de la app.
- `fetch_precios.py` — baja precios de cierre de la BVL → `precios.json`.
- `div_extractor.py` — baja dividendos de la BVL → `dividendos.json`.
- `empresas_config.json` — las 3 empresas por sector (editable). `smvId` = value del dropdown SMV.
- `empresas_smv.json` — las 203 empresas del dropdown SMV (referencia para hallar IDs).
- `salida_smv.json` — última salida cruda.

## Reglas de Oro respetadas
- **Cero datos inventados (#1):** lo que el XBRL/detalle no trae queda en `null`
  y la app lo muestra como "Pendiente de verificar (SMV)". El EPS, por ejemplo,
  queda vacío en las empresas que no lo etiquetan.
- **Estados INDIVIDUALES (#4):** el extractor siempre pide tipo = Individual.
- **El extractor ahorra el copiado, NO el criterio (#E.4):** `verificado: false`
  en todo. Jair revisa antes de publicar (sobre todo NEXA y la línea sensible de
  cuentas por cobrar a relacionadas).

## Para otro trimestre/año
Cambia `anio` y `trimestre` en `empresas_config.json` y vuelve a correr.

## Notas técnicas
- El XBRL declara UTF-8 pero emite **cp1252**; la página de detalle es **UTF-8**.
  El parser maneja ambos.
- El portal a veces falla; `run_batch.py` reintenta hasta 3 veces por empresa.
- Pesqueras: en el Mercado Principal solo **Austral Group** y **Pesquera Exalmar**
  presentan EE.FF.; por eso ese sector va con 2 (no 3).
