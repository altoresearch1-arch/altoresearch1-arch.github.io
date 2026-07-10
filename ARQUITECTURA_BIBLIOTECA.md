# 📚 ARQUITECTURA — Sentinel Biblioteca (asistente de documentos estilo NotebookLM)

> Diseño primero, código después (pedido de Jair, 10-jul-2026). Este documento es la
> decisión de arquitectura COMPLETA del "asistente que analiza documentos" y cómo
> Atlas y Sentinel lo toman en cuenta.

## 1. La decisión grande: dónde corre

El pedido original habla de TypeScript + React + Node + base vectorial (LanceDB/Chroma/
Qdrant/pgvector) + embeddings + streaming. Ese es el stack correcto **si hay servidor**.
Pero este proyecto tiene 3 reglas de hierro que un backend rompería:

| Regla del proyecto | Qué pasaría con Node + vector DB + LLM |
|---|---|
| **Cero costos** (GitHub Pages, la PC no se prende) | Servidor + DB + API de embeddings/LLM = costo mensual y API keys |
| **Cero secretos en el repo** (app pública) | Las keys tendrían que vivir en algún lado |
| **Privacidad prometida en la UI** ("tu documento NO se sube a ningún lado") | Cada PDF del usuario viajaría a un servidor |

**Decisión: RAG 100% EN EL NAVEGADOR.** Mismo pipeline conceptual (leer → trocear →
indexar → recuperar → responder con citas), pero todo corre en el equipo del usuario.
La "generación" es EXTRACTIVA + plantillas del redactor — lo que garantiza de fábrica
el requisito más importante del pedido: **nunca inventa** (Regla de Oro #1). Un LLM
generativo puede alucinar; un sistema extractivo no puede decir nada que no esté en el
documento.

- **Base vectorial elegida: ninguna de las cuatro** — ninguna corre en una página
  estática. El equivalente en navegador es un índice léxico BM25 + expansión de
  sinónimos financieros (ES↔EN). Si algún día se aprueba la versión con servidor,
  la elección sería **Qdrant** (tier gratis gestionado, filtros por metadato, cliente
  TS de primera). Segunda capa futura sin servidor: embeddings reales en el navegador
  con transformers.js (modelo multilingüe ~30 MB por CDN, opcional y cacheado).
- **TypeScript**: el proyecto entero es JS + JSDoc (decisión previa); se mantiene JS
  por coherencia — módulos separados y contratos claros cumplen el mismo objetivo.
- **Streaming**: sin LLM no hay tokens que estrenar; Atlas ya simula el ritmo de
  respuesta. Se mantiene.

## 2. Módulos (cada componente separado)

```
app/src/lib/
├── sentinel.js     (ya existe) lectura PDF/foto + OCR + análisis de UN documento
├── lectores.js     (NUEVO) PDF·DOCX·XLSX·PPTX·TXT·imagen → texto con página/sección
├── biblioteca.js   (NUEVO) almacén multi-doc + chunks + índice + analista financiero
├── cerebro.js      (ya existe) Atlas — se le suman los intents de biblioteca
└── redactor.js     (ya existe) plantillas honestas por slots
app/src/components/
└── Sentinel.jsx    (se amplía) acepta VARIOS archivos → panel "Biblioteca"
```

### lectores.js — un lector por formato
| Formato | Cómo | Cita resultante |
|---|---|---|
| PDF (texto) | pdf.js por página (`hasEOL`) | `Doc.pdf · Página 12` |
| PDF escaneado / foto | pdf.js → canvas → tesseract.js (CDN) | `Doc.pdf · Página 3 (OCR)` |
| DOCX | JSZip (CDN) + DOMParser sobre `word/document.xml`; los estilos Heading parten secciones | `Doc.docx · Sección «Resultados»` |
| PPTX | JSZip + `ppt/slides/slideN.xml` | `Deck.pptx · Diapositiva 4` |
| XLSX | SheetJS (CDN) → CSV por hoja | `Libro.xlsx · Hoja «Estados»` |
| TXT/CSV | directo | `Notas.txt` |

Todas las librerías pesadas llegan por CDN con import dinámico → cero peso en el
bundle y en el precache de la PWA.

### biblioteca.js — el corazón
- **Almacén**: singleton en memoria + persistencia best-effort en sessionStorage
  (recarga de página) + historial de nombres en localStorage. El texto NUNCA sale
  del navegador.
- **Chunking inteligente**: por página/sección → oraciones completas (partirOraciones,
  respeta "S.A.") agrupadas a ~900 caracteres. Cada chunk conserva {documento, página,
  sección}.
- **Índice / búsqueda semántica ligera**: BM25 sobre los chunks + expansión con un
  diccionario de sinónimos financieros bilingüe (utilidad↔ganancia↔net income,
  ingresos↔ventas↔revenue, deuda↔debt, flujo de caja↔cash flow…). No es un embedding
  neuronal y la UI lo dice honesto; cubre el 90% del caso real (documentos financieros
  con vocabulario acotado).
- **Analista financiero** (extractores con cita):
  - métricas: ingresos, EBITDA, utilidad neta, flujo de caja, deuda (ES+EN, con
    moneda y magnitud para no pescar basura);
  - período del documento (Q1-Q4/trimestre/año) para ordenar;
  - comparación entre documentos: misma métrica → delta % + "cambio importante" si
    |Δ| ≥ 15%; misma métrica y mismo período con valores distintos → ⚠ contradicción;
  - cronología: fechas + su oración, ordenadas;
  - riesgos: oraciones con señales negativas (reutiliza las SENALES de Sentinel);
  - resumen para inversionistas: título/categoría/veredicto por doc (reutiliza
    `analizar()`) + métricas + cambios + riesgos, todo citado.

- **La Supervisora 🕵️ (capa de verificación)**: Atlas no es un LLM al que se le pueda dar
  un "prompt mental" — es código, así que la supervisión también es código que corre sobre
  cada respuesta ANTES de entregarla: (1) evidencia débil → "esto es lo MÁS CERCANO, puede
  no responder completa"; (2) período del documento ≠ período preguntado → "es OTRO período,
  tómalo con pinzas"; (3) misma métrica + mismo período + cifra distinta en dos documentos →
  ⚠ contradicción con ambas fuentes citadas. El resto del checklist clásico de supervisión
  (solo evidencia, citar todo, orden por relevancia, no alucinar, decir "No encontré…") ya
  está garantizado por construcción del sistema extractivo.

### Integración Atlas (cerebro.js)
- Intents nuevos (solo si hay documentos cargados): resumen para inversionistas,
  comparar documentos / contradicciones, cronología, riesgos, métricas puntuales.
- Pregunta libre → RAG: top-k chunks con cita `📎 Doc.pdf · pág. N`. Si hay varias
  respuestas posibles se muestran TODAS con su documento.
- Si el índice no encuentra nada: **"No encontré esa información en los documentos."**
  — literal, sin adornos.
- Memoria de conversación: el documento activo (sessionStorage, ya existía) + la
  biblioteca sobreviven navegación y recarga.

### Integración Sentinel (Sentinel.jsx)
- Un archivo → flujo clásico (informe + veredicto).
- Varios archivos (o ya hay biblioteca) → panel 📚: lista con formato/páginas/quitar,
  y botón "Analizar juntos con Atlas".

## 3. Contratos de datos

```js
// Documento en la biblioteca
{ id, nombre, tipo, paginas, ocr, agregado,      // metadatos
  chunks: [{ texto, pagina, seccion }],           // para RAG y citas
  metricas: [{ clave, nombre, valorTexto, valorNum, moneda, pagina, seccion, frase }],
  periodo,                                        // "2026-T1" | "2025" | null
  analisis: { titulo, categoria, veredicto, razones } } // de sentinel.analizar()

// Respuesta de búsqueda
{ texto, citas: ['Doc.pdf · Página 12', …] }      // o null → "No encontré…"
```

## 4. Escalabilidad y límites honestos
- ~10 documentos / ~200 páginas cómodos en un celular (todo en memoria; tope de
  60k caracteres por doc, chunks capados).
- sessionStorage con try/catch: si el doc es enorme sobrevive en memoria pero no a
  una recarga (se avisa en la UI).
- Camino de crecimiento SIN romper nada: (1) embeddings transformers.js opcionales,
  (2) versión servidor (Node + Qdrant + LLM) como producto PREMIUM separado si Jair
  algún día lo aprueba con presupuesto — este diseño deja los módulos listos para
  enchufarla (lectores y chunks son agnósticos de dónde corre el índice).
