# Guía rápida — App ALTO Research

App educativa de la BVL. Hecha con React + Vite. Esta guía es para **editar
datos y correr la app sin programar**.

## Cómo correr la app

Abre una terminal en la carpeta `app` y ejecuta:

```
npm install      (solo la primera vez)
npm run dev      (levanta la app en http://localhost:5173)
```

Para publicarla (genera la carpeta `dist/` que se sube a GitHub Pages / Netlify):

```
npm run build
```

## Dónde se editan los datos (NO hace falta tocar código)

Todo está en `src/data/`. Son archivos de texto (JSON). Reglas:

- **Cero datos inventados (Regla de Oro #1).** Si un dato no está verificado en
  la SMV, deja su `valor` en `null`. La app lo mostrará en rojo como
  "Pendiente de verificar (SMV)". Nunca pongas una cifra que no validaste.
- Cada cifra lleva su `fuente` y un `verificado` (true/false).
- Cuida las comas y las comillas: si rompes el formato, la app no carga.
  (Puedes pegar el archivo en jsonlint.com para revisar.)

### `empresas.json` — la tabla maestra y cada ficha
- `sector`: uno de `mineria`, `banca`, `consumo`, `construccion`.
- `perfiles`: lista entre `apuesta`, `dividendos`, `estable`, `mixto`.
  **Esto es criterio tuyo**, no un default.
- `tesis`: cuando la escribas, pon `"pendiente": false`.
- `fundamentos` (deuda, fcf, eps, margen): llena `valor`, `moneda`, `fuente` y
  pon `verificado: true` cuando lo confirmes contra la SMV.
- `balanceDestacado`, `catalizadores`, `escenarios`, `historico`, `riesgos`,
  `fuentes`: opcionales; mira la ficha de NEXAPEC1 como ejemplo completo.
- En `riesgos`, cada uno tiene `tipo`: `"documentado"` o `"rumor"` (no mezclar).

### `lentes.json` — CON QUÉ OJO se lee cada empresa (nuevo, 22-jul)
El lente decide el veredicto de la deuda, qué guía se muestra, la línea
"💰 Vive de:" y los avisos del Comparador. Tres partes:
- `porSector`: qué lente le toca por defecto a cada sector.
- `porTicker`: las excepciones (AUNA → salud, Petroperú → combustibles,
  Casa Grande → agro…). **Aquí es donde corriges si una empresa está mal
  leída: agrega su ticker y el lente que le corresponde.**
- `lentes`: el contenido de cada lente (`viveDe`, `motor` = la versión corta
  para los globos, `queManda`, `deudaComoSeLee`, `errorTipico`, `caso`).
  `flujo` (ciclico/intermedio/estable) elige los umbrales de deuda; con
  `deudaAplica: false` la app dice "no se mide así" y muestra
  `queMirarEnSuLugar` (bancos, seguros, AFP y fondos).
- `deudaManual`: para las que no presentan estados a la SMV (AUNA). La cifra
  va SIEMPRE con `fecha` y `fuente` — nunca un número suelto que envejezca.

### `guias.json` — cómo se leen los números, POR LENTE
Una entrada por lente (la clave debe coincidir con el lente). Cada métrica
tiene `k` (título), `v` (explicación), `metrica` (opcional: `eps`, `fcf`,
`capex`, `deuda`, `margen` — le dice a la app qué dato real inyectar) y
`err` (el "⚠ error común", una línea). La métrica llamada "Lo que más manda"
se muestra PRIMERO, aunque la escribas al final.

### `tips.json` — los 5-7 tips de cada empresa
Regla que nació de la auditoría del 22-jul: **nunca escribas una cifra que la
app calcula sola** (P/E, yield, FCF del trimestre). En 6 meses el tip diría
9.6 y la ficha 14, y el usuario deja de creerle a las dos. Si necesitas dar
un número, ponle la fecha ("al cierre de 2025").

### `quiz.json` — preguntas y perfiles
Las 4 preguntas, sus opciones y a qué perfil/sector suma cada una. La pregunta
de sector tiene `"tipo": "sector"`.

### `glosario.json` — el árbol de términos
Ramas → términos. Cada término: `t` (título), `d` (definición), `ej` (ejemplo,
opcional). Puedes dejar `ej` vacío `""`.

### `pildoras.json` — "¿Sabías que?"
Solo principios, no datos puntuales (un principio no caduca).

### `config.json` — marca y apoyo
Pon aquí el número de **Yape** y el enlace de **PayPal** reales.

## El extractor SMV (ya funciona)
Los fundamentos de cada empresa NO se cargan a mano: los baja el extractor de la
carpeta `extractor/` directo del Portal SMV (Individual, Q1 2026). Para regenerar:

```
cd ../extractor
python run_batch.py
```

Esto reescribe `app/src/data/empresas.json` con datos reales de la SMV
(XBRL para la mayoría; los bancos vienen de la página de detalle oficial).
Todo entra con `verificado: false`: **tú revisas antes de publicar.**
Para cambiar empresas o sector, edita `extractor/empresas_config.json`.

## Qué sigue siendo trabajo tuyo (no automatizable)
- **Revisar** cada cifra extraída antes de publicar (sobre todo NEXA y la línea
  sensible de cuentas por cobrar a relacionadas).
- El criterio: la tesis, qué empresa va en qué perfil (`perfilesTentativos`),
  los catalizadores, escenarios y qué riesgo es documentado vs rumor.
- El EPS queda vacío en las empresas que no lo etiquetan en la SMV: si lo quieres,
  se calcula aparte (utilidad ÷ acciones) y se valida.
