# 🔁 RETOMAR EL PROYECTO — Handoff (act. 01-jul-2026 por Fable)

Hola. Este archivo es el **punto de entrada**. Lo empezó Opus y lo actualizó Fable tras el
"pase premium" del 01-jul (detalle completo arriba de `ESTADO_DEL_PROYECTO.md`).
Lee esto primero y ya estás al día. La **fuente de verdad completa** es `ESTADO_DEL_PROYECTO.md`
(y la filosofía en `ALTO_PROYECTO_COMPLETO.md`). Los **enlaces** están todos en `extractor/FUENTES.md`.

---

## ⚡ NUEVO 10-jul ronda 9 (Fable): 3 PULIDOS DE UI (pedido de Jair)
> (1) **Advertencia de límites en Sentinel**: componente `AvisoLimitaciones` (Sentinel.jsx,
> en los 3 estados: espera/biblioteca/informe) + intent en Atlas — dice claro que NO lee
> gráficos/imágenes (son dibujos; pesca números sueltos pero no interpreta la curva), que las
> tablas SÍ, y recomienda leer el documento igual. (2) **Actualizaciones plegable**: la
> cabecera es botón, GUARDADA (colapsada) por defecto con contador "(8)", recuerda la
> elección en localStorage `alto-actualizaciones-abiertas`. (3) **Explorar aleatorio**: la 1ª
> empresa ya no es siempre Nexa — `mezcla` (Math.random por visita, useMemo []) desempata
> dentro de cada sector; sigue minas primero pero cambia cuál. Verificado en navegador
> (PPX→SCCO, Actualizaciones colapsa/despliega, aviso renderiza). Va DIRECTO a main (PR #1
> sigue aparte, solo con el "no encontré" matizado).

## ⚡ NUEVO 10-jul ronda 8 (Fable): 📚 LA BIBLIOTECA (multi-documento estilo NotebookLM)
> Pedido de Jair (prompt RAG profesional). **Diseño completo: `ARQUITECTURA_BIBLIOTECA.md`**
> (RAG 100% en el navegador — sin backend por cero-costos/privacidad; Qdrant si algún día hay
> presupuesto). `lib/lectores.js` (PDF/foto-OCR/DOCX/XLSX/PPTX/TXT — JSZip y SheetJS por CDN)
> + `lib/biblioteca.js` (12 docs máx, chunks con página/sección, BM25+sinónimos ES↔EN,
> métricas ingresos/EBITDA/utilidad/flujo/deuda con cita, comparación con delta % y
> contradicciones, cronología, riesgos, resumen para inversionistas). Citas: `Doc.pdf ·
> Página 12`. Si no está: "No encontré esa información en los documentos." Atlas: chips e
> intents nuevos; Sentinel: multi-archivo + panel 📚.
> **+ "NO ESTÁ" MATIZADO (mismo día)**: `sinDato()` en biblioteca.js distingue 3 casos —
> (a) biblioteca vacía / nada relevante → "No encontré esa información en los documentos."
> (seco); (b) pediste un INDICADOR que ningún doc trae → "Revisé tu documento y no menciona
> EBITDA con una cifra. Esa información no está presente…"; (c) hay menciones relacionadas
> pero no el dato puntual → lo dice con las pistas que sí vio. Reserva el "no encontré" seco
> solo para (a). Pedido de Jair: no dar un "no sé" genérico cuando SÍ revisó el documento.
> **+ 10 CAPACIDADES (mismo día, 3ª tanda de Jair)**: mapa completo en
> ARQUITECTURA_BIBLIOTECA.md §4 (módulos = agentes, justificado). Nuevo: 📏 CONFIANZA con
> motivos (lineaConfianza: nº fuentes/cobertura/contradicción/OCR/período), 🧾 "¿cómo lo
> supiste?" (explicarRazonamiento: docs revisados, fragmentos evaluados/descartados,
> relevancia), 🧠 MEMORIA CONVERSACIONAL ("¿y paga dividendos?" → última empresa; corre ANTES
> que la biblioteca), 🎛 formato corto/detallado (fijarFormato, localStorage, solo
> presentación), MÉTRICAS 5→22 (BPA, P/E, EV/EBITDA, márgenes, CAPEX, OPEX, caja, producción,
> reservas, cash cost, variación % — con TIPO de valor: monto/pct/ratio/cantidad).
> Verificado en Node vía esbuild (el navegador-extensión se desconectó; receta: bundle de
> los libs + fake File de texto). Límite honesto: gráficos-imagen no se interpretan (sin visión).
> **+ LA SUPERVISORA 🕵️ (mismo día)**: capa de verificación EN CÓDIGO (Atlas no es LLM, no
> lee prompts) sobre cada respuesta de la biblioteca: evidencia débil, período preguntado ≠
> período del doc, y contradicciones de cifras entre docs (misma métrica+período, >2% de
> diferencia) — con ambas fuentes citadas. `supervisar()` en biblioteca.js. Verificada con
> contradicción sintética (deuda 800 vs 850 mismo Q1) y sin falsos avisos.
> **PWA RESUELTO (mismo día)**: el tope de 4 MiB del precache es POR ARCHIVO y todo iba en un
> index.js de 2.9 MB que crecía a diario → `manualChunks` en vite.config.js parte los datos
> (datos-historicos / datos-lecturas / datos-hechos / datos): el mayor quedó en 0.98 MB y el
> código en 0.33 MB. Yapa: el usuario que vuelve solo re-descarga el trozo que cambió ese día.

## ⚡ NUEVO 10-jul ronda 7 (Fable): 🧠 SENTINEL/ATLAS BILINGÜES + 📷 OCR (leen fotos)
> Reclamo de Jair: el HI de Nexa sobre BOLIDEN (02-jul) daba lectura VACÍA → estaba EN INGLÉS
> (matriz de Luxemburgo) y las reglas eran solo español. Fix en ESPEJO (sentinel.js ⇄
> gen_lecturas.py `VERSION_ANALISIS=2`): categorías/señales bilingües, categorías nuevas
> rating/auditoría, TÍTULO del doc, frases líder si nada puntúa, recorte del legalese inglés,
> oraciones que no se parten en "S.A.", extractores nuevos (partes de la negociación,
> enNegociacion, cambioControl, montos legal/deuda/operación, persona/cargo, utilidad).
> **OCR**: Sentinel ahora lee FOTOS (JPG/PNG) y PDF escaneados — tesseract.js 6 spa+eng 100%
> por CDN (cero bundle, precache PWA intacto 3.66 MiB), máx 8 págs, errores honestos, marca
> "📷 descifrado con OCR". La ficha donde sueltas el archivo sirve de PISTA de empresa.
> Atlas: resumen con título+frases+detalles, "¿quién compra y quién vende?", buscarEnDoc top-2.
> terminos 183→187. ⚠ Si subes VERSION_ANALISIS: correr gen_lecturas.py LOCAL antes de push.

## ⚡ NUEVO 09-jul ronda 5 (Fable): 🗣 CHARLA DE LA GERENCIA + REDACTOR
> `fetch_gerencia.py` baja el "Análisis y Discusión de la Gerencia" (SMV, grilla de
> Frm_InformacionFinanciera, link "Descargar Documento") → `gerencia.json` (92 empresas, 86 con
> frases textuales elegidas por scoring). Caché por expediente + guardado incremental; corre en
> PASOS_EPS (completo/--trimestral, NO robot 30 min). **`lib/redactor.js`**: párrafos naturales
> desde slots verificados (plantillas por categoría; slot vacío = frase que no se escribe) —
> SOLO en JS, la app compone al vuelo. Atlas: "¿qué dice la gerencia de X?" + línea 🗣 en el
> resumen. BUG cazado: porAccion truncaba "S/.20,000,000"→"S/.20" (Paramonga; real S/0.601124)
> → regex número completo + pegado a "por acción"; 211 hechos re-leídos.

## ⚡ NUEVO 09-jul ronda 4 (Fable): el robot LEE los hechos de TODOS (lecturas.json)
> `extractor/gen_lecturas.py` = port Python del análisis de sentinel.js (MANTENER EN ESPEJO)
> con pypdf: lee los PDF de los 2 últimos hechos de cada empresa → `data/lecturas.json`
> (clave=URL del PDF, caché incremental; escaneados marcados honesto). Corre tras fetch_hechos
> en --hechos y --rapido. En la app: badge 🟢/🔴/🟡 en cada hecho (HechosImportancia) y Atlas
> suma su lectura en "últimas noticias de X". Nivel NotebookLM: extractores de derivados
> (collar/nocional/resultado acumulado) y dividendos (por acción/registro/entrega), preguntas
> sugeridas POR CATEGORÍA (chips), términos 176→183 (derivado, zero cost collar, nocional,
> valor razonable, forward, put, call).

## ⚡ NUEVO 09-jul ronda 3 (Fable): 🛰️ SENTINEL — lector de hechos (beta)
> Nombre elegido por Jair. En cada ficha, DEBAJO de los hechos 📰: el usuario descarga el PDF
> de un hecho (botón PDF ↗), lo suelta en Sentinel, este lo lee EN el navegador (pdf.js,
> import dinámico, cero servidores) y da veredicto 🟢/🔴/🟡 con razones (extractivo honesto;
> reportes rutinarios como derivados → forzados a neutra). Botón → abre Atlas que saluda YA
> con el contexto (sessionStorage; saludo PURO + marcar visto en useEffect por StrictMode) y
> responde repreguntas buscando dentro del texto. Cada hecho leído queda en localStorage →
> "¿qué hechos te he pasado?". Piezas: `lib/sentinel.js`, `components/Sentinel.jsx`, hooks en
> `cerebro.js`/`Atlas.jsx`. Verificado con PDF real de Nexa.

## ⚡ NUEVO 09-jul (Fable): 🧠 ATLAS (IA beta) + ROBOT INTRADÍA + AVISOS 🔔 + COMENTARIOS
> Pedido de Jair, en DOS rondas la misma noche. TODO sin backend (estática, cero costos):
> **ATLAS** (antes Yachay; Jair lo rebautizó) = IA local (`lib/cerebro.js` + `Atlas.jsx`, ruta
> `#/ia`) que ENSEÑA con nuestros datos (114 empresas, 176 términos, + `conocimiento.json` =
> hechos curados de los INFORMES de Jair, sin recomendaciones) y APRENDE: pregunta sin respuesta
> → botón "enviar al equipo" → pestaña **💬 Comentarios** (`#/comentarios`, mailto a
> altoresearch1@gmail.com, sin backend). "Cuéntame más de X" = intent de informes. NotebookLM se
> agregó y Jair lo hizo QUITAR (no volver a ponerlo). **"Actualizaciones"** reemplazó al "mensaje
> del día" (config.json → actualizaciones.items). **Robot intradía**: hechos+BEM cada 30 min
> (8:00-16:30 Perú, `--hechos`), precios ~12:15/15:15 (`--precios`), cierre ~22:23 (`--rapido`);
> modo por `github.event.schedule`; solo commitea/despliega SI HAY CAMBIOS. **Avisos 🔔**:
> `gen_novedades.py` → `app/public/novedades.json` (fuera del bundle y del precache SW); la app
> lo re-pide cada 5 min y avisa con sonido si una empresa ★ tiene HI nuevo (clic → ficha).
> **BUGS CAZADOS (reclamos reales de Jair):** (1) fetch_hechos BOTABA los HI con observación en
> blanco (el de Nexa 08-jul) → ahora basta categoría; (2) el celular quedaba "muerto": el tooltip
> centrado nunca se cerraba en iPhone (sin blur) + `.vista-anim` con fill-mode `both` dejaba un
> transform eterno que anclaba el tooltip FUERA de pantalla → Glosado cierra por pointerdown y
> fill-mode es `backwards`. Detalle completo arriba de ESTADO_DEL_PROYECTO.md.

## ⚡ 08-jul (Fable): ⛏️ PRODUCCIÓN MINERA (MINEM/BEM) + COMPARADOR V2 + GRÁFICAS
> Pedido de Jair. Gráficos de producción mensual POR METAL (ene-25→abr-26) en cada ficha minera +
> bloque "Sus minas / Participaciones" (%, cotiza, dividendos — todo VERIFICADO). Fuente nueva:
> **MINEM Boletín Estadístico Minero** (receta en `extractor/FUENTES.md`). Piezas: `fetch_bem.py`
> (→ `mineria.json` con `totalesPais` para el "% del Perú", caché en `cache_bem/` committeada, ya
> en `actualizar_todo.py --rapido`, auto-descubre ediciones nuevas, no commitea ruido si el BEM no
> publicó), `mineria_familia.json` (MANUAL: participaciones verificadas — BVN vendió Yanacocha
> 2022; Marcobre 60% de Minsur; Corona→Sierra Metals→Alpayana 2025; Shouxin 49% de Shougang),
> `ProduccionMinera.jsx` (chips con números + % del Perú, 🏆 si domina, ★ récord, hover).
> **COMPARADOR V2**: 🏁 carrera indexada a 100 (con "¿Qué es esto?"), 💰 duelo de dividendos,
> ⛏️ duelo minero con % del Perú, barras de magnitud, tesis lado a lado, ↗ compartir duelo.
> **TODAS las gráficas estilo BEM** (Sparkline del precio incluido: eje con precios, fechas,
> lectura al pasar el dedo). **P/E rescatado**: `peInfo()` en lib/finanzas — si el precio es
> viejo se muestra "⚠ referencial" (33 ilíquidas, ej. Santa Luisa 7.4); PODERC1 y SCCO al
> `fix_eps`. **FIX Glosado**: claves en MAYÚSCULAS (TMF/MINEM/OPA) nunca mostraban tooltip;
> y en celular el tooltip va CENTRADO en pantalla (antes se salía por los bordes).
> Detalle completo en ESTADO_DEL_PROYECTO.md.

## ⚡ ÚLTIMO ESTADO (08-jul-2026, Opus) — YA ESTÁ LANZADA + fixes
> **La app está EN VIVO:** **https://altoresearch1-arch.github.io/** (HTTPS, GitHub Pages).
> **Cuenta GitHub:** `altoresearch1-arch`. **Repo (público):** `altoresearch1-arch/altoresearch1-arch.github.io`.
> Esta PC ya tiene `origin` + credencial (GCM) e identidad de git configurada en el repo → `git push` funciona.
>
> **ROBOT DIARIO** (`.github/workflows/deploy.yml`, cron `0 3 * * 2-6` UTC ≈ Lun–Vie noche Perú; GitHub a veces
> lo corre en la mañana — igual toma el ÚLTIMO CIERRE completo). Dos jobs: `actualizar-datos` corre
> `actualizar_todo.py --rapido` (baja precios/históricos/dividendos/hechos de BVL+stockanalysis, ~9 min, commitea
> con `[skip ci]`) y `desplegar` (build PWA + Pages). En `push` solo despliega. Botón **Actions → Run workflow**
> para dispararlo a mano. La PC NO se prende.
>   - **`--rapido` SALTA el SMV** (`fetch_anual_eps`+`fix_eps`): el EPS anual 2025 es estático y el SMV es
>     lento/flaky desde la nube (el run completo se colgaba 20+ min ahí). El EPS se refresca con `--trimestral`
>     o el comando completo local.
>   - **El paso de commit hace `git pull --rebase -X theirs origin main` ANTES del push** (arreglado 05-jul:
>     antes fallaba con "fetch first" cuando otro commit llegaba primero).
>
> **ANALÍTICA de visitas:** GoatCounter (script en `app/index.html`), panel en **altoresearch.goatcounter.com**
> (cuenta de Jair, correo `altoresearch1@gmail.com`). Privada, sin cookies, gratis. Cuenta a los visitantes reales.
>
> **NEXA — catalizador nuevo (verificado):** Boliden confirmó (02-jul) que está en CONVERSACIONES para comprarle
> a Votorantim su participación de control (~65%) en Nexa (~US$1,300M). SIN acuerdo/precio/fecha. Agregado en
> `catalizadores.json` (NEXAPEC1) redactado con honestidad (Regla #7). Si cierran o rompen, actualizar ese texto.
>
> **⚠️ GOTCHA IMPORTANTE — "la web no se actualiza":** casi siempre es la **caché del Service Worker (PWA)**, NO
> el pipeline (el servidor SIEMPRE tiene lo último; verificar con `curl` del bundle, no confiar en el navegador
> cacheado). **Arreglado 08-jul:** `app/src/main.jsx` ahora registra el SW con chequeo de versión al cargar / al
> volver a la pestaña / cada 5 min → se auto-refresca (antes quedaba "una recarga atrás"). Para un navegador que
> ya tiene la versión vieja pegada: **Ctrl+Shift+R** una vez (o incógnito/celular).
>
> **PENDIENTES de Jair:** (a) **número de Yape** para el botón "copiar número" (`config.json` → `apoyo.yapeNumero`,
> vacío; el QR ya está). (b) **Video promo TikTok** (quedó a medias: se iba a generar un QR con Python `qrcode` +
> una placa final vertical con PIL, y guion cuadro-por-cuadro sin voz con "GRATIS" claro). (c) Agregar **ETFs/más
> empresas** cuando lo pida (verificar datos primero, sector "fondos" para ETFs). (d) `mensajeDia` lo edita él en
> `config.json` (hoy sigue "La constancia supera al talento." del 3-jul — NO es dato viejo, es manual).
>
> **Comando estrella:** `python extractor/actualizar_todo.py` (completo local) | `--rapido` (lo que usa el robot) |
> `--trimestral` (Q nuevo) | `--con-build`. Auditorías: `python extractor/auditoria.py` y `auditoria_total.py`.

---

## 1. Qué es (en 3 líneas)
App web **educativa** de la Bolsa de Valores de Lima (BVL). El usuario hace un quiz (perfil × sector)
y descubre **empresas para estudiar** — NUNCA se recomienda comprar. Producto = **credibilidad**.
Negro y dorado (#D4AF37). React+Vite en `app/`. Datos en `app/src/data/*.json`, generados por `extractor/`.

## 2. Las 9 Reglas de Oro (innegociables) — resumen
1. **Cero datos inventados** (lo que falta queda vacío/"pendiente"). 2. Jerarquía de fuentes.
3. EPS en moneda original. 4. Estados **INDIVIDUALES** SMV. 5. Lenguaje simple. 6. Verificar contra la
fuente. 7. No mezclar rumor con hecho (etiqueta documentado/rumor). 8. **Nunca prometer rendimientos.**
9. La app **educa, NO recomienda**. (Detalle en `ALTO_PROYECTO_COMPLETO.md`.)

## 3. Estado hoy: **114 valores** (tandas 7-10 + AUNA/PPX: 02-03-jul-2026, Opus — ver ESTADO_DEL_PROYECTO.md)
> AUNA = piloto mercado americano (NYSE, datos consolidados). PPX = junior oro/plata. UI pulida: el LOGO
> del inicio es una moneda anti-estrés (clic → salta/gira/suena, guiño a TF2); header transparente; gráfico
> de dividendos sin choques. Auditorías (estructural + total) en 0 problemas. PRÓXIMA SESIÓN: bugs→seguridad→lanzar (§7).
**Tanda 10 (11):** estatales Petroperú/SEDAPAL/COFIDE, Red Vial 5 (peaje), Paramonga, IEQSA,
Electrosur, Electro Sur Este, Inca Rail, Compartamos, La Positiva Vida. **Mercado peruano relevante YA
agotado** (resto = liquidaciones/subs extranjeras/agro en crisis). **Tips enriquecidos ~7-9 c/u**
(`enrich_tips.py`, datos confirmados). **Términos 112→160**. **Nuevo `auditoria_total.py`** (coherencia):
0 problemas serios, 55 avisos legítimos; estructural 0 problemas; consola limpia.
**Tanda 9 (13):** SECTOR NUEVO "afp" (Prima/Integra/Profuturo/Habitat) + 4 bancos (Mibanco, BanBif,
B. Falabella, B. Ripley) + Interseguro + 3 eléctricas (Electroperú, Electro Dunas, San Gabán) + Los
Portales. Casi todas sin precio (no negocian) pero pagan dividendos. Insight verificado: **retiros de
AFP → la BVL/mineras caen** (riesgo en AFP + aviso en mineras grandes). Términos 102→112. Contexto web
en Quimpac/Electroperú/Hidrostal/Mibanco/Interseguro/Eternit.
**Tanda 8 (4):** Financiera Proempresa (bancos), Inverfal Perú (holding Falabella, diversas),
Futura Consorcio Inmobiliario e Inmobiliaria IDE (diversas). **Tanda 7 (7):** Mapfre + Pacífico
(aseguradoras, diversas), Banco Pichincha (bancos), Quimpac + Hidrostal + Eternit (industriales,
diversas), Perubar (minas). Todas ilíquidas, datos SMV/BVL confirmados, con tesis/tips/catalizadores
/escenarios. **Tooltips ampliados**: tesis+tips ahora pasan por `Glosado`; `terminos.json` 57→91
(holding, streaming, siniestralidad, penny stock, junior, etc.). **Propiedad entre empresas**:
investigado + reporte a Jair, PENDIENTE su OK (diseño: `relaciones.json` + bloque "🧬 Familia
empresarial" bidireccional; 2 modelos A dividendos / B intercompañía). Fix: `auditoria.py` UTF-8.
Sigue lo de las tandas 4-6 abajo:
### Tandas 4-6 (02-jul-2026; sector nuevo "fondos")
Tanda 5: FIBRAs y ETFs (sector "fondos"), BAP (XBRL OK), SCCO/PML (tipo AUNA). Tanda 6:
Saga, La Positiva, Hermes, INDECO, Grupo BVL, Cervesur, Concesu, FOSSAL, Andex, Credicorp
Capital, Pucalá (sin_documentos). **Dividendos BVL**: `fetch_beneficios.py` parcha lo que
stockanalysis no cubre Y CORRIGE la moneda (14 empresas declaran en US$ aunque coticen en S/
— hallazgo de Jair con Nexa; stockanalysis convierte y engaña). **EPS distorsionados**:
`fix_eps.py` SIEMPRE tras fetch_anual_eps (si no, se pisan las correcciones — pasó una vez).
**TODO EN UNO**: `python extractor/actualizar_todo.py` (diario) / `--trimestral` (Q2: antes
cambiar "trimestre" en empresas_config.json) / `--con-build`. Cierra con `auditoria.py`
(0 problemas estructurales al 02-jul; 12 avisos legítimos documentados en ESTADO).
Cada una tiene: fundamentos SMV + precio BVL + dividendos + P/E verificado + tesis + tips + catalizadores.
Sectores: minas 10, alimentos 8, diversas 7, eléctricas 5, bancos 4 (BBVA, BCP, Interbank, Scotiabank),
textil 3, acereras 3, cemento 3, retail 3, pesqueras 2.
Config maestro: `extractor/empresas_config.json` (smvId, bvlNemonico, perfiles, monedaForzada, esHolding).

## 4. FUENTES / LINKS (todo en `extractor/FUENTES.md`; los críticos aquí)
- **SMV — estados financieros (XBRL individual):** https://www.smv.gob.pe/SIMV/Frm_InformacionFinanciera
  Lo usan `smv_extractor.py` / `run_batch.py` / `fetch_anual_eps.py`. Bancos: página de detalle HTML.
- **BVL — precio de cierre:** `POST https://dataondemand.bvl.com.pe/v1/stock-quote/market` (body `{}`).
  Campo correcto = `last` (cierre real) con `lastDate`; NO usar `sell` (es oferta). Lo usa `fetch_precios.py`.
- **BVL — precios HISTÓRICOS (RESUELTO 01-jul):** `GET https://dataondemand.bvl.com.pe/v1/stock-quote/share-values/<NEM>?startDate=&endDate=`
  → cierres diarios del rango. Lo usa `fetch_historicos.py` → `historicos.json` (sparkline +
  termómetro de volatilidad). Quirks: serie rellenada + ceros (se filtran); receta en FUENTES.md.
- **Dividendos (principal): stockanalysis.com/quote/bvl/<NEMONICO>/dividend/** → `div_stockanalysis.py`.
  Fechas de entrega vigentes: BVL https://documents.bvl.com.pe/empresas/entrder1.htm (`div_extractor.py`, respaldo).
- **P/E y perfiles de empresa reales:** stockanalysis.com/quote/bvl/<NEM>/statistics/ y /quote/bvl/<NEM>/.
- **Tipo de cambio USD/PEN:** https://open.er-api.com/v6/latest/USD → `fetch_anual_eps.py`.
- **SMV — Hechos de Importancia:** https://www.smv.gob.pe/SIMV/ → "Ir a Hechos de importancia general".
  Token de sesión que EXPIRA (se saca fresco de /SIMV/); form ASP.NET de 2 postbacks; usar `requests`
  (NO Chrome). Lo usa `extractor/hechos_importancia.py`. (Receta completa en FUENTES.md.)
- **Informes propios de Jair (su criterio):** `C:\Users\User\Desktop\INFORMES REALIZADOS ALTO RESEARCH`
  (NEXA, MINSUR, BVN, VOLCAN, CVERDE, BACKUS, BROCAL, CORONA + DATOS_VERIFICADOS.md). Base de tesis/escenarios.

## 5. Cómo correr todo (comandos exactos)
- **App (dev):** `npm --prefix app run dev` → puerto 5173 (o usa el preview; había un 5174 de sesión paralela).
- **Regenerar datos (cuando salga el Q2 o para refrescar):**
  - Fundamentos SMV: `python extractor/run_batch.py`  → `empresas.json` (regenera TODO).
  - Precios BVL: `python extractor/fetch_precios.py`  → `precios.json` (correr tras el cierre; los ilíquidos
    muestran su último cierre con fecha real).
  - Históricos + volatilidad: `python extractor/fetch_historicos.py` → `historicos.json` (a diario,
    junto al precio; alimenta el gráfico y el termómetro de la ficha).
  - Dividendos: `python extractor/div_stockanalysis.py` → `dividendos.json`.
  - EPS anual + TC: `python extractor/fetch_anual_eps.py` → `eps_anual.json`.
  - Hechos de Importancia POR EMPRESA (12 meses, BVL): `python extractor/fetch_hechos.py` → `hechos.json`
    (se muestra en la ficha 📰). El del SMV (`hechos_importancia.py`) queda de respaldo.
- **Agregar una empresa:** añadir línea a `empresas_config.json` (smvId del catálogo `empresas_smv.json`,
  bvlNemonico del mercado BVL) y correr los 4 scripts. Luego escribir a mano tesis/tips/catalizadores.
- **Datos manuales (editables, no los pisa el extractor):** tesis.json, tips.json, catalizadores.json,
  escenarios.json, guias.json, quiz.json, terminos.json, glosario.json, pildoras.json, config.json.

## 6. Hallazgos / quirks importantes (NO re-descubrir)
- **Bug de precios (RESUELTO):** `fetch_precios.py` usaba `sell` (oferta) como cierre; ahora usa `last`.
- **EPS distorsionados (RESUELTOS con stockanalysis):** Minsur, Backus, InRetail, IFS, Volcan, Corona
  daban P/E absurdos por clase de acción/moneda/holding. Corregidos en `eps_anual.json` (anotado en cada uno).
- **Holdings** (GR Holding, Ferreycorp, InRetail, IFS, UNACEM, Inv. Portuarias Chancay): `esHolding:true` en
  config → su estado individual son dividendos de subsidiarias, no ventas; `run_batch` pone nota en margen/ingresos.
- **Margen inverosímil (>300%):** `run_batch` lo suprime con nota (ej. Bosques Amazónicos, ingresos casi nulos).
- **AUNA:** no presenta EE.FF. individuales a la SMV (cotiza en NYSE) → solo precio, fundamentos pendientes.
- **Bancos:** FCF muestra nota "no aplica, se mide por CAPITAL/CET1 y ROE"; usan detalle HTML SMV (sin XBRL).
- **UI reciente:** se eliminó "Histórico trimestral"; dividendos muestran pagos INDIVIDUALES con fecha + mini-gráfica
  2025 vs 2026 (`DividendoGrafico.jsx`) con flecha ▲ solo si 2026 ya superó a 2025 (honesto); empresas sin dividendos
  muestran aviso arriba y solo el simulador de precio.
- **Pase premium (01-jul):** PWA instalable (vite-plugin-pwa, íconos en `app/public/iconos/`),
  sparkline + termómetro de volatilidad en la ficha (leen `historicos.json`), vista **Explorar**
  (buscador/filtros) + **Comparador** de 2 empresas, micro-animaciones sin dependencias
  (`lib/anim.jsx`: CountUp, Reveal; respetan prefers-reduced-motion), reveal del quiz.
  Ilíquidas: etiqueta "poco negociada" SIN número de volatilidad (sería falso — la BVL rellena
  la serie). NEXAPEC1 con fundamentos null → RESUELTO con `extractor/run_uno.py <TICKER>`.
- **Actualización 2 (01-jul):** rutas por hash (#/empresa/BVN — links compartibles + botón
  atrás), inicio con "Así cerró la BVL" (top subidas/bajadas del cierre, de precios.json),
  favoritos ★ "Mi lista" (localStorage: ficha + Explorar + inicio), Empresa del día
  (determinística por fecha), rango de 12 meses en el sparkline, botón ↗ Compartir,
  buscador en el glosario. Detalle en ESTADO_DEL_PROYECTO.md.
- **Chrome (claude-in-chrome) es INESTABLE** para el SMV (SPA/tokens): para SMV/stockanalysis usar `requests`.

## 7. PENDIENTE — PRÓXIMA SESIÓN de Jair: BUGS → SEGURIDAD → LANZAR (03-jul)
> Jair enfocará la próxima sesión en estos 3 pasos. Detalle completo en la sección
> "🎯 PRÓXIMA SESIÓN" al inicio de `ESTADO_DEL_PROYECTO.md`.
1. **CAZAR BUGS / QA final:** revisar las **114 fichas** + responsive móvil (375px) + flujo del quiz.
   Los errores `[hmr] Failed to reload…` del dev server NO son bugs (salen al escribir JSON mientras Vite
   recarga; se limpian reiniciando el server). Correr `auditoria.py` + `auditoria_total.py` (0 problemas al 03-jul).
2. **REFORZAR SEGURIDAD:** app estática sin backend/login/datos de usuario/secretos. Cerrar: sin tokens en
   el repo (extractor usa solo APIs públicas), hosting HTTPS, `GITHUB_TOKEN` con permisos mínimos, CSP del hosting.
3. **LANZAR:** hosting estático (GitHub Pages/Netlify/Cloudflare, gratis) + **robot diario con GitHub Actions**
   (corre todos los fetch_* + `npm run build` + redeploy; la PC de Jair NO se prende). Probar que los scripts
   corran desde los runners de EE.UU. (BVL/stockanalysis OK; SMV trimestral a mano si falla).
   Falta de Jair: **cuenta GitHub + elegir hosting + número de Yape** (`config.json`, para "copiar número").
4. Opcional/después: mapa "🧬 Familia empresarial" (investigado, espera OK), fundamentos consolidados de AUNA,
   contexto web del resto de empresas nuevas.

## 8. Anti-amnesia
La verdad vive en los ARCHIVOS: `ESTADO_DEL_PROYECTO.md` (estado), `ALTO_PROYECTO_COMPLETO.md` (filosofía),
`extractor/FUENTES.md` (links), este `PARA_FABLE_RETOMAR.md` (handoff), el código y los JSON. Mientras existan,
nada se pierde aunque se resuma la conversación. También hay memoria persistente de Claude en
`~/.claude/projects/.../memory/` (se carga sola).
