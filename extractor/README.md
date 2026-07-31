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

## Cuándo y cuánto se paga cada dividendo (el acuerdo, no el patrón)

```
python fetch_pagos_dividendos.py
```

Lee el **PDF del Hecho de Importancia** donde la empresa comunica la distribución
de utilidades y saca la **fecha de entrega** y el **monto por acción** de cada pago
→ `../app/src/data/pagos_dividendos.json`.

Existe porque `dividendos.json` (stockanalysis) estampa el dividendo declarado del
**año entero en la fecha ex**. Cuando la empresa paga **en partes** eso rompe dos
cosas en el cuaderno: cuenta como recibido lo que todavía no llega, y esconde el
pago pendiente. Caso real (Nexa, acuerdo del 15-may-2026): US$ 0.0786 por acción
pero en dos mitades, 16-jun y **27-oct**. Laredo igual: S/ 0.50 el 8-jul y S/ 0.50
el 5-ago.

Regla de Oro #1: un pago solo existe si el PDF dio **fecha Y monto**. Lo que llega
suelto se anota en el log como "sin pareja" y se ignora — nunca se completa a ojo.

La caché (`cache_dividendos/leidos.json`) guarda lo ya leído por URL: al repo viajan
unos KB, no los PDF. Los PDF crudos se quedan en la máquina (ignorados por git).

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
- **Estados financieros** (deuda, FCF, EPS, capex, margen, balance): el trimestre lo
  fija `empresas_config.json`. El global va en `trimestre`, pero **cada empresa puede
  adelantarse** con su propio `"trimestre"` — no todas presentan el mismo día. Para
  actualizar solo algunas: márcalas y corre `run_uno.py TICKER` para cada una.
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
Cambia `anio` y `trimestre` en `empresas_config.json` y vuelve a correr. Si solo
algunas empresas ya presentaron, ponles el `"trimestre"` a ellas (override por
empresa) en vez de mover el global: pedirle a la SMV un trimestre que una empresa
aún no presentó devuelve `sin_documentos` y le borra los fundamentos.

### Trimestre vs. acumulado (importante del Q2 en adelante)
Del Q2 en adelante el XBRL trae **dos periodos que terminan el mismo día**: el
trimestre (abr-jun) y el acumulado del año (ene-jun). No son intercambiables:

- El **estado de resultados** viene en los dos → el extractor toma el **trimestre**.
- El **flujo de caja** y la **depreciación (D&A)** casi siempre vienen **solo
  acumulados** → el extractor los toma de ahí y lo **anota** en `_periodos.origen`.

Por eso `fcf` trae `fcfMeses` (3 o 6) y la fuente dice cuál es, y el EBITDA se arma
con `ebitdaBase` — ganancia operativa y D&A del **mismo** tramo, con su `factorAnual`
(×4 si son 3 meses, ×2 si son 6). Sumar la ganancia de 3 meses con la depreciación de
6 y multiplicar por 4 infla el EBITDA y la empresa sale más barata de lo que es.

## Notas técnicas
- El XBRL declara UTF-8 pero emite **cp1252**; la página de detalle es **UTF-8**.
  El parser maneja ambos.
- El portal a veces falla; `run_batch.py` reintenta hasta 3 veces por empresa.
- Pesqueras: en el Mercado Principal solo **Austral Group** y **Pesquera Exalmar**
  presentan EE.FF.; por eso ese sector va con 2 (no 3).
