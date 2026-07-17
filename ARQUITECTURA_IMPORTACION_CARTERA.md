# Arquitectura de importación de cartera (Mi Cuaderno)

**Fecha:** 16-jul-2026 · **Estado:** diseño aprobado en mockup (prototipo funcional en el Artifact de Mi Cuaderno)

## Filosofía (decisión de Jair, 16-jul)

> La IA acelera el proceso. El usuario siempre tiene el control.
> **No usar IA para leer la tabla. OCR primero, diccionario después. La IA solo cuando algo falla.**

```
Imagen → OCR → Tabla → Extraer columnas → Buscar ticker en diccionario → Relacionar → Revisión → Guardar
                                                    ↑
                              (la IA solo entra aquí, como fallback, y su salida
                               TAMBIÉN pasa por el diccionario — nunca se le cree el ticker)
```

## 1. El pipeline determinista (el camino feliz, ya prototipado)

1. **Plantilla por broker.** Si el usuario eligió Magot SAB, ya sabemos las columnas:
   `Valor · Cantidad · PPC · Precio de Mercado · Valorización`. Ni IA ni adivinanza:
   columna 1 = ticker, columna 2 = cantidad, columna PPC = costo promedio.
2. **OCR en el navegador** (tesseract por CDN, el mismo que ya usa Sentinel para
   escaneados). Preprocesar la imagen ANTES del OCR (ver §4 — es la causa #1 de fallos).
3. **Diccionario de tickers** (implementado y probado en el mockup):
   - `normalizar(s)` = mayúsculas + quitar todo lo que no sea A-Z0-9.
   - **Búsqueda exacta** contra los 114 tickers de ALTO → ✔ 100%.
   - **Alias** (`GLORIA1→GLORIAI1`, `FERREYCORP→FERREYC1`, `MINSUR→MINSURI1`,
     `VOLCAN→VOLCABC1`, `BROCAL→BROCALC1`…) → ✔ 100%.
   - **Distancia de edición ≤ 2** (Levenshtein) contra tickers + alias →
     ✔ "corregido de OCR" con confianza 95%/85%. Casos reales verificados:
     `MINSURII→MINSURI1`, `MINSUR11→MINSURI1`, `BROCALI1→BROCALC1`.
   - **Lista de internacionales** (AAPL, MSFT, VOO, SPY, QQQ, NVDA…) → panel aparte:
     importar sin métricas / omitir / esperar (anota recordatorio).
   - **Nada coincide** → ⚠ desconocida: ○ Buscar empresa ○ Escribir manualmente ○ Omitir.
4. **ALTO completa el resto** (precio, ganancia, div. 12m) desde precios.json/dividendos.json.
5. **Revisión** con lenguaje de confianza ("✔ Coincidencia 100%", "✔ Corregido de
   «MINSURII» — error típico de OCR"), nunca de disculpa.

## 2. Por qué el LLM "falla en un doc tan sencillo" (diagnóstico)

1. **Resolución.** La captura típica es una pantalla completa donde la tabla es una
   franja chiquita (ej.: la captura de Magot es 1524×450 y la tabla ocupa una fila).
   Las APIs de visión reescalan la imagen por el lado largo: los dígitos pequeños
   "nadan" y 7610 se vuelve 7810. **Es la causa #1.** Fix en §4.
2. **Entrenado para ayudar = entrenado para interpretar.** Un LLM "corrige" solito
   MINSURII→"Minsur S.A." o completa la empresa que cree reconocer. Pedirle que no
   interprete ayuda, pero no lo elimina — por eso el ticker NUNCA se le cree: su
   salida pasa por nuestro diccionario igual que el OCR.
3. **JSON libre = JSON roto.** Pedir "solo JSON válido" por prompt es rogar. La forma
   correcta es **salida estructurada del API** (json_schema forzado): el modelo no
   puede responder otra cosa que el esquema. (En el API de Claude:
   `output_config.format` con `type: json_schema` — garantizado, sin parsear texto.)
4. **Deriva de atención en tablas repetitivas.** Filas que se fusionan o saltan.
   Fix: obligar a contar filas primero + verificar el conteo localmente (¡contra el
   conteo de líneas del OCR! — doble lectura barata, ver §5).

## 3. El prompt del fallback (versión endurecida del de Jair)

Cambio de marco: **no es un extractor, es una máquina de transcripción.** No se le
pide leer la cartera; se le pide copiar caracteres. En inglés (los modelos siguen
mejor instrucciones de formato en inglés) y SIEMPRE acompañado del esquema forzado:

```
You are a transcription machine, NOT an assistant.

TASK: Transcribe the holdings table in this image, character for character.

PROCESS (in order):
1. Locate the table whose header contains "Valor", "Cantidad" and "PPC" (or close variants).
2. Silently count the data rows. Your output array MUST contain exactly that many items.
3. For each row, copy these cells exactly as printed:
   - "Valor" column      -> "empresa"
   - "Cantidad" column   -> "acciones"
   - "PPC" column        -> "costo_promedio"

RULES:
- Copy characters EXACTLY as rendered. If a character is ambiguous (I vs 1, O vs 0,
  B vs 8), output the most visually similar character. NEVER replace a ticker with
  a company name you recognize. NEVER fix apparent typos.
- Do not skip, merge, reorder or invent rows.
- Numbers: digits and one decimal point only; strip thousands separators.
- Any unreadable cell -> null and "confidence":"low". Otherwise "confidence":"high".
- Ignore all other columns, totals, subtotals and headers.
- Include "raw_line": the entire row text verbatim, for audit.

OUTPUT: a JSON array only. One object per data row:
{"empresa":"FERREYC1","acciones":7610,"costo_promedio":2.3966,
 "raw_line":"FERREYC1 7,610 2.3966 4.2330 32,255.09","confidence":"high"}
```

Claves del endurecimiento frente a la v1:
- **"count rows first"** + validación local del conteo (mata filas fusionadas).
- **"most visually similar character"** (mata la autocorrección: queremos MINSURII
  crudo, porque NUESTRO diccionario lo corrige con evidencia).
- **`raw_line` por fila** — auditable, y el diccionario puede trabajar sobre el crudo.
- El "solo JSON" no se ruega: lo garantiza `output_config.format` (json_schema con
  `additionalProperties:false` y `required`). Cero fences, cero comentarios.

## 4. Preprocesado de imagen (la palanca más grande, cuesta 10 líneas de canvas)

Antes del OCR (y del LLM si algún día se usa):
1. **Recortar la región de la tabla** (detectable por el encabezado, o pedirle al
   usuario que encuadre — el dropzone puede mostrar "encuadra solo la tabla").
2. **Escalar ×2–×3** si el alto de línea es < 20 px (tesseract rinde ~30 px/línea).
3. **Escala de grises + contraste** (las plataformas de brokers son texto claro
   sobre fondo oscuro: invertir a negro-sobre-blanco mejora tesseract).
4. PNG, nunca JPEG recomprimido.

## 5. Validaciones locales baratas (sin IA)

- **Conteo cruzado:** nº de filas del OCR vs nº de items del fallback → si difieren, ⚠.
- **Sanidad del PPC:** si hay precio ALTO para el ticker, un PPC fuera de
  [0.2×, 5×] del precio actual se marca ⚠ "¿PPC bien leído?" (caza 2.3966→23.966).
- **Cantidad entera** y > 0; PPC con ≤ 4 decimales (formato BVL).
- **Duplicados** de ticker en el mismo documento → fusionar preguntando.

## 6. Restricción de ALTO: no hay backend

El pipeline principal (OCR + diccionario) corre 100% en el navegador — coherente con
la app (sin backend, sin cuentas, "tu documento nunca sale de tu equipo", Sentinel).
**El fallback con LLM requiere una llave de API que NO puede vivir en el navegador.**
Opciones, en orden de preferencia:

1. **No usar el fallback** (recomendado para lanzar): con plantillas por broker +
   diccionario + revisión manual, el flujo ya resuelve los 8/8 casos de la demo,
   incluidos 2 errores de OCR, 1 alias, 1 internacional y 1 desconocida.
2. **Función serverless mínima** (Cloudflare Worker / Vercel, gratis en estos
   volúmenes) que solo reenvía la imagen al API con la llave guardada allá y
   devuelve el JSON. Un archivo, sin base de datos.
3. Excel/CSV no necesita nada de esto: se parsea local con SheetJS (columnas por
   plantilla del broker, mismo diccionario).

## 7. Datos que este flujo necesita del proyecto (ya existen)

- `empresas.json` → ticker, nombre, sector, mercado, moneda (base del diccionario).
- `precios.json` → precio/previo para completar y para la sanidad del PPC.
- `dividendos.json` → div. 12m estimado en la revisión.
- Alias: arrancar con ~30 a mano (nombres comunes + variantes OCR de los 114) y
  crecer con lo que la revisión enseñe (cada corrección manual del usuario es un
  alias candidato).
