# ESTADO DEL PROYECTO — ALTO Research (app educativa BVL)

> **Documento maestro vivo.** Captura TODO lo construido para que nada se pierda, sin
> importar la ventana de contexto. Si retomas el proyecto (tú, yo en otra sesión, u otra
> herramienta), lee esto primero. Última actualización: **23 jul 2026**. Estado: **EN VIVO (beta pública)**.

## 🚪 23-jul: LA ENTRADA CON SALIDAS — cerrar, volver y retomar (pedido de Jair)
La entrada del #135 (bienvenida + Lección Exprés) se armó el 23-jul de madrugada y era de
UNA SOLA DIRECCIÓN: se entraba, pero no se salía ni se volvía atrás. Cuatro salidas nuevas:
- **✕ y Esc en la Lección Exprés** (`.leccion-cerrar`, 36 px para el pulgar). **No es lo
  mismo que «Saltar»** y por eso conviven: Saltar = *no la quiero leer, entro ya* (la marca
  vista); la ✕ = *me salgo*, y **lo leído queda guardado**.
- **Se retoma donde la dejó** (`CLAVE_PASO = 'alto-leccion-paso'`): si la cerró en la 3, el
  🐣 de la bienvenida cambia a **«Sigue donde te quedaste — dejaste la lección en la tarjeta
  3 de 5»**. Asomarse dejó de costar empezar de nuevo. Al terminarla el marcador se borra, y
  en el **repaso desde el ☰** no se guarda nada (ahí no hay nada que retomar) ni aparece
  «Saltar»: solo la ✕.
- **«← Atrás» en la tarjeta 1 vuelve a la bienvenida** (antes quedaba muerto) y el selector
  de niveles recibió **«← Volver»** (`onVolver` opcional en SelectorNivel: solo se pinta
  cuando se llega desde la bienvenida, no cuando se abre desde el 🎚️).
- **«Solo quiero mirar la app →»** en la bienvenida: el que no quiere contestar NADA entra en
  nivel 2 y cambia con el 🎚️ cuando quiera. Discreto a propósito — no compite con los dos
  caminos.
- Verificado en el navegador con localStorage limpio (🐣 → 3 de 5 → Esc → «Sigue donde te
  quedaste» → retoma en 3 → Atrás → bienvenida → niveles → Volver → mirar), móvil 375 px sin
  desbordes, consola limpia y build PWA OK (3715.92 KiB).

## 🥇 22-jul: EL PRECIO DEL METAL — el driver #1 que faltaba (#116, pedido de Jair)
Pedido textual: *"en los precios de los metales pon así estuvieron en ese año y fueron subiendo
cada año; a inicios de 2026 bajaron y subieron mucho — y esto cambia el precio de la acción"*.
- **Fuente nueva: el BCRP.** `extractor/fetch_cotizaciones.py` baja las "Cotizaciones de
  productos (promedio del periodo)" del Banco Central — series MENSUALES oficiales desde 2015,
  gratis y sin llave → `app/src/data/cotizaciones.json` (30 KB). 12 productos: cobre, oro,
  plata, zinc, plomo, estaño, petróleo WTI, harina de pescado, azúcar, trigo, maíz y aceite de
  soya. Ya está enganchado en `actualizar_todo.py` (modo rápido) — **no se tocó deploy.yml**.
- **`PrecioDelMotor.jsx` (nivel 2):** tres bloques en el orden en que Jair lo contó. (1) **Año
  por año**: barra por año con el promedio y su ▲/▼ contra el anterior; el año en curso va
  PUNTEADO y se dice que es parcial. (2) **Este año**: arrancó en X, su mes más alto, su mes más
  bajo, dónde está hoy, y el **vaivén** entre el mejor y el peor mes (lo que el promedio anual
  esconde). (3) **¿Y la acción?**: las dos restas lado a lado a 12 meses — en BVN, *oro +26% vs
  acción +86%* — con la cadena explicada (sube el metal → cobra más por lo mismo → la ganancia
  sube MÁS que el precio → sube la acción) y el aviso de que no es una regla de tres.
- **Contexto de ciclo (#53):** "el oro está 86% por encima de su promedio de los últimos 5 años
  → zona ALTA de su ciclo; es el momento en que un P/E bajo engaña más".
- **Caso especial resuelto:** en Petroperú el crudo es su COSTO y a la vez la referencia de lo
  que vende, así que la cadena no aplica: la ficha lo dice y manda a mirar el margen. Shougang
  queda sin bloque a propósito (el BCRP no publica el hierro; no se le pone el precio de otro).
- **Los combos se enriquecen solos:** el de "pico de ciclo" ahora cierra con la zona del ciclo,
  y el de producción del BEM ya tiene sus dos mitades — *"produce 11% menos zinc, pero el zinc
  subió 34%: van en sentidos opuestos, mira cuál pesa más"*. Antes eso era un condicional.
- Paso nuevo del tour (nivel 2) "🥇 El precio que de verdad manda". Móvil: 6 años en vez de 8.

## 🧠 22-jul: SESIÓN 3 DEL PLAN EDUCATIVO — LOS COMBOS DEL ANALISTA (implementada)
Tercera sesión del `ANALISIS_EDUCATIVO_Y_TOUR_POR_NIVELES.md` (§5 y §9: mejoras #43, #47 y
#50). La regla de Jair —**nunca se evalúa un indicador solo**— por fin es código.
- **`lib/analista.js` (nuevo):** el motor de combos, con el patrón de `redactor.js` (slots
  verificados: si falta un dato, la frase no se escribe). Cruza lo que YA tenemos —P/E,
  margen, deuda por lente, FCF, dividendos, capex, catalizadores y producción del MINEM— y
  devuelve solo los cruces completos. **93 de las 115 empresas** tienen al menos uno.
- **`LecturaAnalista.jsx` (#43):** sección "🧠 Lectura de analista" en **nivel 3**, entre los
  riesgos y el checklist de cierre. Cada tarjeta trae el cruce, su semáforo (🟠 ojo / 🟢 a
  favor / 🟡 cómo se lee) y **"📌 La regla que te llevas"** — la lección general, que es lo
  que el usuario se lleva a la siguiente ficha. Combos implementados: pico de ciclo (P/E bajo
  + margen sobre la mediana de su sector + cíclica), barata-pero-ilíquida, dividendo vs FCF
  (las 4 variantes), yield extraordinario de un solo pago, deuda cíclica con la prueba del
  fondo, deuda alta con flujo estable (el caso AUNA), deuda "gigante" de banco = materia
  prima, FCF negativo con o sin proyecto documentado, y producción del BEM como adelanto del
  próximo trimestre.
- **`sostenibilidadDividendo` (#47):** lo repartido al año (dividendos.json × acciones del
  XBRL) frente al **flujo de caja libre** anualizado → semáforo **"💸 ¿Se lo puede pagar?"**
  dentro del resumen de dividendos, visible en **TODOS los niveles** (es una advertencia, y
  las advertencias no se filtran por nivel — regla E1). Zonas anchas a propósito (≤70% holgado
  · ≤110% justo · más, forzado) porque el FCF es de un trimestre × 4, y el método se declara.
  En banco/seguro/AFP el FCF no significa lo mismo y se dice, no se calcula.
- **`peEstresado` (#50):** dentro del aviso de cíclica en "¿Barata o cara?" — "este P/E de
  10.4 se calcula con la ganancia de HOY; con la ganancia a la mitad sería 20.7, sin que la
  acción se mueva un centavo", más la trampa fina (los costos no bajan con el metal, así que
  una caída de 25-30% del precio puede llevarse media ganancia). Misma aritmética que la
  prueba del ciclo de la deuda, para que el usuario reconozca el gesto.
- **Enganches:** paso nuevo del tour "🧠 Y ahora, todo junto" (nivel 3, nombra el primer combo
  real de esa empresa), séptima casilla en "¿Estás listo para decidir?" (solo si la empresa
  tiene cruces) y "🧠 Lectura de analista" en lo que promete el nivel 3.
- **Decisiones de honestidad (no re-discutir):** el combo 9 de §5 (margen que se aprieta) NO
  se implementó — necesita la SERIE de márgenes y hoy solo hay el último trimestre. En la
  producción del BEM solo entran los **metales principales** (cobre, oro, zinc, plata, estaño,
  hierro): con los subproductos, BVN salía titulada por su arsénico y Cerro Verde por su
  molibdeno. El metal que se destaca es aquel donde la empresa pesa más en el total del país
  (número sin unidades, comparable entre metales), y solo se habla si el cambio es ≥8%.
- Cero dependencias nuevas, sin tocar los robots. Verificado en build de producción.

## 🚶 22-jul: SESIÓN 2 DEL PLAN EDUCATIVO — EL TOUR POR NIVELES (implementada)
Segunda sesión del `ANALISIS_EDUCATIVO_Y_TOUR_POR_NIVELES.md` (§7 y §9). El tour dejó de
explicar INTERFAZ y pasó a enseñar la EMPRESA, en el orden en que la cabeza pregunta.
- **`lib/guiontour.js` (#1, #3, #101):** los pasos de la ficha ya no viven en TourGuia.jsx —
  se ARMAN por empresa y por nivel. Cada paso declara en qué nivel nace (`n`) y los textos
  se componen con los datos reales: el lente ("BVN vive de vender metal, aquí manda el precio
  del metal"), el precio del último cierre, el % de 6 meses, el dividendo con su yield, los
  AÑOS de deuda con el umbral de su lente y la prueba del ciclo, el P/E con su ⚠ de cíclica.
  El orden es el de **la escalera** (#101), no el del DOM: vistazo → 1️⃣ qué hace → 2️⃣ de qué
  vive → 3️⃣ por qué le fue así → 4️⃣ deuda y riesgos → 5️⃣ recién ahí "¿está barata?" → 6️⃣ ¿ya
  puedes decidir tú? Verificado: BVN en N2 = 15 pasos, BAP en N4 = 21, y en un banco el paso
  de la deuda enseña que **no se mide así**.
- **Tour de DESBLOQUEO (#2) — `OfertaDesbloqueo.jsx`:** al subir de nivel DENTRO de una ficha
  (desde la CTA o desde el badge 🎚️, porque escucha el estado y no el botón — eso cubre #17),
  aparece "✨ Acabas de desbloquear 5 secciones nuevas en BVN — ¿te las presento?" y el
  mini-tour recorre SOLO lo nuevo. Cuenta lo que existe de verdad en ESA ficha; si no hay nada
  nuevo visible, no ofrece nada.
- **Tours nuevos de pantalla:** Comparador (#4, 7 pasos — la pantalla más densa y hasta hoy la
  única sin tour; incluye el paso "ojo: no se leen igual") y Resultados del quiz (#5, 6 pasos:
  qué es tu perfil, la trampa de tu perfil, POR QUÉ salieron esas empresas y que no son
  recomendación). Con sus saludos en la burbuja ❓.
- **`ListoParaDecidir.jsx` (#104, el escalón 6):** checklist de cierre "¿Estás listo para
  decidir?" con 6 casillas (de qué vive · por qué le fue así · su riesgo #1 · si su deuda es
  del tipo peligroso para SU sector · por qué su P/E dice lo que dice · qué vigilar el próximo
  trimestre). Compatible con la Regla #9: no responde si comprar, responde si YA PUEDES
  decidirlo tú. Las casillas en blanco enlazan a su sección; si la sección es de un nivel
  superior, invitan a subir. Se guardan por empresa en el navegador.
- **Fix generalizable:** TourGuia ahora exige que el elemento del paso OCUPE espacio (no basta
  con existir): los envoltorios `Reveal` vacíos —producción minera en un banco— ya no capturan
  un paso. `Reveal` reenvía props (`data-tour`) para poder anclar pasos sin capas nuevas.
- Cero dependencias nuevas, sin tocar los robots. Verificado en el navegador los 5 tours.

## 🔍 22-jul: SESIÓN 1 DEL PLAN EDUCATIVO — EL LENTE Y LA DEUDA (implementada)
Primera sesión de código del `ANALISIS_EDUCATIVO_Y_TOUR_POR_NIVELES.md` (§9). Responde el
ejemplo ácido de Jair: la MISMA deuda es peligro en una minera, normal en una eléctrica,
manejable en salud y un ERROR DE CATEGORÍA en un banco.
- **`lentes.json` + `lib/lente.js` (#21):** 19 lentes con `viveDe`, `motor`, `queManda`,
  cómo se lee su deuda, error típico y caso peruano. El lente HEREDA del sector y lo refina
  por ticker — el sector NO se toca (Explorar, quiz y escenarios siguen igual). Con eso
  "diversas" deja de ser cajón ciego: seguros (6), salud (AUNA), concesiones (4), telecom,
  inmobiliaria (4), agro/azúcar (7), combustibles (Petroperú) e industria salen del saco;
  Shougang pasa a leerse como minera, Aenza como construcción, IFS como banco.
- **`PuedePagarDeuda.jsx` (#41/#42):** deuda neta ÷ ganancia operativa anual = AÑOS de caja,
  con umbrales POR LENTE (cíclico <2 · intermedio <3 · estable <4) y **globo nuevo "¿Debe
  mucho?"** en la radiografía que ven TODOS. En banco/seguro/AFP/fondo el veredicto es "NO SE
  MIDE ASÍ" + qué mirar en su lugar. Honestidad: sin la D&A (58 empresas la presentan
  resumida) el número es un **TECHO**, así que solo se afirma cuando el techo ya es cómodo —
  si no, "no se puede afirmar" (15 casos). Para cíclicas, **la prueba del ciclo**: qué pasa
  con la misma deuda si la ganancia se parte a la mitad.
- **7 guías nuevas por lente (#22-#28)** en guias.json (seguros, salud, concesiones, telecom,
  inmobiliaria, agro, combustibles + industria) y **"⚠ Error común" en TODAS las métricas de
  TODAS las guías** (#30, 71 líneas nuevas). "Lo que más manda" ahora ABRE la guía (#29).
- **Escalera de aprendizaje:** línea **"💰 Vive de:"** junto a la tesis (#102) y tarjeta
  **"🗣 ¿Por qué le fue así este trimestre?"** con las frases textuales de gerencia.json, que
  vivían enterradas en N4 y ahora entran en N2 (#103, el mejor valor/esfuerzo del plan).
- **Fixes de honestidad (errores ACTIVOS del catálogo §14):** E1/#113 las advertencias ya no
  se esconden por nivel (el "P/E referencial" y el "poco negociada" se ven en N1-2 aunque el
  anzuelo tape el resto); **#44 asterisco de ciclo en el globo "Barata"**; E2 fuera el damp
  0.4 del simulador — en ilíquidas el riesgo no es el % sino no encontrar comprador; E4 el
  quiz ya no enseña "cero sustos → dividendos" (+ vacuna en Resultados); E5/#114 auditados
  **176 tips** con cifras congeladas (P/E, yield y FCF que envejecían y contradecían al
  cálculo vivo) y E6/#24 el tip de deuda con lente minero en 10 bancos; E7 frecuencias en
  inglés traducidas; E12/E13 el rango del sector dice de dónde sale y admite que el de
  "diversas" es el veredicto más flojo de la app; #31 el aviso del Comparador ahora da la
  razón CONCRETA del par (banco vs minera: depósitos ≠ deuda).
- Cero dependencias nuevas, cero backend, sin tocar los robots. `deuda` y `gerencia` entran
  como secciones de nivel 2 en `NIVEL_SECCION`.

## 🧭 21-jul: EL PLAN EDUCATIVO MAESTRO (sesión de ANÁLISIS, sin código — pedido de Jair)
Sesión completa de análisis antes de la renovación de Fable (Jair tiene US$100 de la oferta).
**TODO vive en `ANALISIS_EDUCATIVO_Y_TOUR_POR_NIVELES.md` (leerlo ANTES de tocar tour/guías/
valoración/quiz) + maqueta navegable `MAQUETA_MENTOR_ALTO.html`.** 5 partes, 151 mejoras
priorizadas [P0-P3]:
- **I.** Lentes por sector (deuda de AUNA ≠ minera ≠ banco; "diversas" es cajón ciego), tour por
  niveles en 3 capas (hoy el tour no cubre nada de N3-4 y explica interfaz, no números),
  playbook de 16 lentes con casos peruanos, 10 "combos de analista" (nunca un indicador solo).
- **II.** La escalera de aprendizaje (¿qué hace? → ¿cómo gana? → ¿por qué este año? → riesgos →
  ¿barata? → ¿listo para decidir?) — hallazgo: la ficha responde la 5 antes que la 1; regla de
  los 5 segundos auditada número por número. gerencia.json ya responde "¿por qué este año?" y
  está enterrada en N4 (mejor valor/esfuerzo del plan).
- **III.** 20 errores educativos ACTIVOS verificados en código (top: el anzuelo de niveles OCULTA
  el aviso "P/E referencial"; damp 0.4 del simulador enseña ilíquida=segura; tips con cifras
  congeladas que envejecen; tip de deuda de BCP contradice su guía; "cero sustos→dividendos" en
  el quiz). Matriz vs 10 plataformas mundiales; 12 sesgos con vacuna; carga cognitiva (la subida
  2→3 mete ~14 conceptos de golpe); comité Buffett/Damodaran/Marks/Lynch/profesor peruano.
- **IV.** Laboratorio UX del usuario cero: 9 personas, 30 segundos en 11 empresas, ~500 preguntas
  en ~60 familias, 14 preguntas invisibles, 10 momentos de abandono (top: la puerta de niveles
  al usuario cero; el plazo-fijista que lee el yield como TEA), los primeros 5 minutos
  rediseñados (botón 🐣 "nunca he invertido" + Lección Exprés).
- **V. EL MENTOR ALTO (idea de JAIR, #151, P0):** botón flotante contextual único que unifica
  todo — modo "toca cualquier cosa", tarjetas con analogía por nivel/lente (mentor.json),
  "🤔 No entendí" contextual, progreso honesto ✔/✔✔, absorbe la ❓ del tour. Maqueta aprobada.
**Orden de implementación acordado:** S1 lentes+deuda ("¿puede pagarla?" en años)+fixes de
honestidad → S2 tour por niveles + cáscara del Mentor → S3 combos/lectura de analista →
S4 guiones y tarjetas del Mentor → S5 feed de hechos del día + precio de los metales.

## 📈 21-jul (2): GRÁFICA BPA HISTÓRICO — 3 modos, nivel 3 (pedidos de Jair)
En la ficha, debajo de "¿Barata o cara?" (`GraficaBPA.jsx`, gate `bpaHistorico: 3` en
nivel.js): **Año vs año** (serie anual auditada 2020-2025) · **Mismo trimestre** (los Q1 —o
Q2/Q3/Q4— a través de los años; esquiva la estacionalidad, término nuevo en terminos.json) ·
**Un solo año** (Q1→Q4; default = último año COMPLETO). Pérdidas en rojo, hueco "s/d"
punteado (Regla #1), moneda original (Regla #3), pastillas `.spark-rango` reusadas.
- **Datos: `bpa_historico.json` (72 KB)** de `extractor/fetch_bpa_historico.py`: XBRL
  anuales (A) + trimestrales (T1-T4) de 2025/2023/2021 — cada filing trae su periodo Y el
  comparativo → serie completa con la mitad de descargas. Caché eterno en `cache_bpa/`
  (~1000 filings; los periodos viejos nunca cambian). Bancos: solo anual (detalle HTML sin
  desglose). Excluidos los 10 de fix_eps (su XBRL individual distorsiona). El trimestre EN
  CURSO se siembra de empresas.json (epsTrimestreRaw) — el Q2, cuando se corra
  `--trimestral`, entrará solo re-corriendo este script.
- **HALLAZGO DE JAIR:** el "Q4 intermedio" EXISTE en la SMV (se presenta en enero con la
  columna oct-dic separada + el año completo) — el Q4 sale de la fuente, nada derivado.
- **CALIDAD XBRL DISPAREJA (curada en `curar_trimestres`)**: UNACEM taggea el trimestre
  suelto; Gloria taggea ACUMULADOS en las columnas de trimestre (detector: Q4 etiquetado ==
  anual → se desteje restando consecutivos, mismo filing). PRUEBA DE FUEGO por año: si
  Q1+Q2+Q3+Q4 no suma el anual auditado (±5%), ESE año pierde sus trimestres (44 empresas
  con años omitidos, nota visible en la UI). Resultado: 93 empresas con serie anual, 73 con
  trimestres, **304 años testeables con CERO descuadres** y 2025 cuadra exacto con
  eps_anual.json en todas.
- **FILAS DE CONTEXTO «Ver también» (2ª tanda de pedidos, misma noche)**: chips que
  encienden filas alineadas columna a columna bajo las barras — 💵 precio de la acción
  (último cierre del periodo), 💰 dividendo pagado en el periodo (de dividendos.json:
  porAnioNum anual / historial con fecha para trimestres), ⛏ metal para mineras (promedio
  del periodo, metal elegible; orden por su % del Perú vía mineria_familia + BEM).
  Datos nuevos: **`bpa_contexto.json` (77 KB)** ← `extractor/fetch_bpa_contexto.py`:
  precios BVL dataondemand 2020→hoy (96 tickers, ceros de relleno filtrados) + **metales
  del BCRP** (API pública, promedio mensual LME: cobre/oro/plata/zinc/plomo/estaño/níquel
  — se eligió BCRP en vez de investing.com: oficial, JSON estable, sin scraping; plata
  Q1-26 verificada contra la serie cruda). Gráfica más grande (158px). «—» = sin dato o
  sin pago; el periodo en curso se marca con nota. Correr este script junto a
  fetch_bpa_historico.py tras cada trimestre (no está en el robot de 30 min).

## 🔍 22-jul (3): «SI VES 0 REVISA DE NUEVO» — 2 bugs más + recuadro Anual (Jair)
Jair: «agrega un recuadro que diga anual y verifica que todos estén bien; si ves 0 revisa
de nuevo». Esa revisión destapó **dos bugs más**, ambos por confiar en un `0.000` del XBRL:
- **🐞 Clase de acción mal elegida (SPCC).** `eps_por_duracion` prefería SIEMPRE
  `OrdinarySharesMember`. SPCC taguea ahí **0.0** y el valor REAL en
  `smv:AccionesDeInversionMiembro` (2025: **6.095**) — y en la BVL cotizan justamente sus
  acciones de inversión (SPCC**PI1**) → su gráfica salía **plana en cero**. Fix: un valor
  CON CONTENIDO le gana siempre a un 0 de relleno; entre los no-cero se mantiene la
  preferencia por común. **SPCC rescatada: 2020 2.373 → 2025 6.095 US$ (+157%)**.
  Hubo que invalidar los 201 filings cacheados que tenían algún 0 y re-bajarlos.
- **🐞 El 0.000 que INVENTA una historia.** Varias emisoras dejan la utilidad por acción en
  0.000 aunque ganen millones (**Sedapal: S/ 248 M de utilidad, EPS 0.0**; Los Portales
  S/ 36 M; Electro Sur Este S/ 30 M; Norvial S/ 16 M; Indeco, Futura, BAM) — muchas
  presentan a la SMV por sus **BONOS**, no por acciones. Peor aún en series parciales:
  **Hermes** venía 0.928 (2023) y marcaba 0.0 en 2024-25 pese a ganar S/ 28 M ese
  trimestre → la gráfica diría «se desplomó a cero»; **Incrai** venía en −1.8 y marcaba
  0.0 → diría «se recuperó». Fix en dos capas: (a) serie ENTERA en cero → sin gráfica,
  con `MOTIVO_SIN_EPS` en `excluidas` (7 empresas); (b) `quitar_ceros_falsos()` — si la
  escala propia de la empresa (mediana de |anuales| no nulos) es ≥ 0.02, un 0.000 es
  campo sin llenar → va como HUECO, salvo que el año esté **corroborado aritméticamente**
  por un anual REAL (ojo: un año todo-en-cero se "corrobora" solo — se excluye
  explícitamente, era la trampa que dejaba pasar a Incrai). Las de centavos (Volcan,
  Enpaci, Atacocha) conservan sus ceros: ahí sí pueden ser redondeo real.
- **📅 Recuadro «Anual»** (lo pedido): en «Un solo año», primera tarjeta en dorado con el
  anual AUDITADO del año elegido y la leyenda «= la suma de los 4 trimestres» cuando
  cuadra (BVN 2025 US$ 3.08 = 0.55+0.36+0.66+1.51 ✓; Volcan US$ 0.030 ✓). La app también
  muestra ya el motivo REAL de exclusión (`bpaData.excluidas[ticker]`) y `notaCeros`.
- **Estado final auditado: 87 empresas con gráfica, 16 excluidas con razón escrita,
  253 años con 4 trimestres y CERO descuadres.** Todo cero que sobrevive está justificado:
  «centavos» (escala <0.02) o «cuadra» (corroborado por un anual real).

## 🐞 22-jul (2): BUG GRAVE EN `curar_trimestres` — 39 años mal, cazado por Jair
Jair: «¿por qué el Q2 de Volcan 2025 está vacío si sí tiene BPA?». **Tenía razón y el
bug era GENERALIZADO** (no solo Volcan): **28 de 94 empresas y 39 de 309 años (12%)
mostraban trimestres INVENTADOS o borrados**.
- **Causa raíz: tolerancias ABSOLUTAS pensadas para EPS en soles.** (a) El detector de
  "empresa acumuladora" era `|Q4 − anual| ≤ max(0.005, …)`: para una empresa de centavos
  ese 0.005 es la MITAD de su BPA anual → a Volcan le bastó UN año de coincidencia
  (2021: Q4 0.006 vs anual 0.010) para marcarla acumuladora y **destejer TODOS sus años
  restando consecutivos**, cuando sus trimestres ya venían SUELTOS y cuadraban EXACTO.
  Resultado visible: Q2-2025 real 0.007 → mostrado 0.0 («vacío», la queja de Jair) y un
  **Q3-2025 en pérdida (−0.004) que NUNCA existió** (la SMV reporta +0.003). (b) La
  prueba de fuego usaba piso `0.02`, **mayor que el BPA anual entero** de esas empresas
  → no botaba nada (Volcan 2025: suma 0.013 vs anual 0.03 y pasaba).
- **Fix**: (a) detector por **DOS HIPÓTESIS votadas año a año** — gana la que explica
  mejor los datos: `sueltos` (Q1+..+Q4 ≈ anual) vs `acumulados` (Q4 ≈ anual); empate o
  sin años completos → NO destejer (preservar la fuente). Independiente de la magnitud.
  (b) piso de la prueba de fuego `0.02 → 0.003` (redondeo real del XBRL a 3 decimales:
  4 trimestres + anual ≈ ±0.0025).
- **Resultado**: 297 años testeados, **0 descuadres** (antes 39 mal). Volcan 2025 queda
  Q1 0.007 · **Q2 0.007** · Q3 0.003 · Q4 0.013 = 0.030 = anual exacto. Empresas que
  RECUPERAN trimestres bien destejidos: CasaGrande +12, Eternit +12, GrañaHolding +12,
  Perubar +12, Hidra2 +16, BAM +4. Las que PIERDEN años (Etna −12, Crecap/SanGabriel/
  Concesionaria −8…) es porque de verdad no cuadran: mejor hueco que dato falso (#1).
- ⚠ **Lección para el futuro**: en este proyecto conviven EPS de S/23 (Backus) y de
  US$0.005 (Nexa/Volcan) — **nunca usar umbrales absolutos**; siempre relativos o por
  comparación de hipótesis.

## ⚖ 22-jul: VOLCAN SÍ TIENE BPA — mostrado con nota (pregunta de Jair)
Jair insistió «¿Volcan no tiene BPA?». **Verificado en la SMV con su Chrome**: Volcan
SÍ reporta utilidad básica por acción, serie limpia (individual, US$, acciones comunes):
2020 −0.01 · 2021 0.01 · 2022 0.019 · 2023 0.019 · 2024 0.031 · 2025 0.03. Estaba fuera
solo porque `fix_eps` lo agrupaba con los 10 «distorsionados». Decisión de Jair: mostrarla
con nota clara. Lo hecho:
- **`fetch_bpa_historico.py`**: lista blanca `MOSTRAR_INDIVIDUAL = {"VOLCABC1"}` — esos
  se bajan (antes se saltaban) y se marcan con `notaBpa`; el resto de fix_eps sigue
  excluido. **Por qué SOLO Volcan**: al bajar los 10 para revisarlos, Minsur reporta
  S/21/acción (acción a ~S/4 → P/E 0.2) y Backus S/23 vs corregido S/2.6 → su individual
  va en OTRA base de acciones, la nota diría lo contrario → siguen fuera. Volcan es el
  único donde el individual (US$0.03) vs consolidado (~US$0.057, lo que usa su P/E) es un
  efecto holding honesto y la nota calza. Los otros 7 no tienen serie individual en la SMV.
- **App**: `GraficaBPA` muestra `emp.notaBpa` como caja ámbar bajo el título (`.bpa-nota-
  individual`) cuando existe. Volcan ahora tiene sus 4 modos + gráfica + Resumen; Minsur/
  Backus siguen en modo solo-🧠 Resumen (con la nota de «no se grafica»).
- Verificado en navegador (Volcan: gráfica+nota+tarjetas 2020🔻→2024⭐; Minsur: solo
  resumen), build PWA OK. Caché nuevo: solo VOLCABC1_*.json (los 9 no-mostrados, borrados).

## 🧠 21-jul (3): GRÁFICA BPA V2 + RESUMEN INTELIGENTE (pedidos de Jair, nombre elegido por él)
La sección BPA de la ficha (nivel 3) se volvió un centro de análisis:
- **Modos como botones de análisis** (📈 Año vs año · 🏆 Mismo trimestre · 📅 Un solo año ·
  **🧠 Resumen Inteligente**), año/trimestre seleccionado estilo TradingView (borde
  `--nivel-color` = azul acero en N3 + sombra + letra blanca), animación de 280 ms al
  cambiar filtros (keyframes terminan en `transform:none` — el gotcha fill-mode de los
  tooltips NO se repite), **tarjetas resumen** antes del gráfico (BPA último + ▲▼ vs
  comparable, mejor periodo ⭐, peor 🔻 solo si fue pérdida), **▲▼ por barra** (solo con
  base positiva: % contra pérdida confunde), barra **«Relacionar con este BPA»** con
  fondo propio y chips por metal (🥇🥈🔵⚫), y **💡 Interpretación** como tarjeta.
- **`ResumenInteligente.jsx` (4º modo)**: BPA anual + variación, precio hoy + 6M, P/E
  (peInfo, con ⚠ referencial), yield; **🏦 caja** (evEbitdaRaw.efectivo) explicada;
  **🏗 deuda hoy-y-futuro**: total + barra partida corriente («vence pronto», ámbar) vs
  no corriente («deuda futura», azul) — el desglose se PARSEA de metricas.deuda (83
  empresas lo tienen); **semáforo caja-vs-vence-pronto** (🟢≥1× 🟡≥0.5× 🔴) y «en cuántos
  años la pagaría» (deuda ÷ utilidad trimestral anualizada, rotulado como ejercicio
  educativo); **BANCOS: nota especial** (deber es su negocio; caja = encaje) y sin
  semáforo; **⛏ factores del periodo** para mineras (metal BCRP último Q vs anterior) +
  dividendo; **💡 cómo se lee todo junto** compuesto por slots verificados (estilo
  redactor — sin slot, sin frase). Regla #1 y #9 respetadas: solo datos existentes, cero
  recomendaciones. GraficaBPA ahora recibe `empresa={e}`. Términos 204→206 (deuda
  corriente / deuda no corriente). Verificado en navegador (BVN minera, CREDITC1 banco,
  los 3 modos de barras, móvil 375px sin desbordes nuevos); build PWA 3.43 MiB OK.

## 🕵️ 17-jul: VIGILANCIA DEL BEM (regla de Jair) — arranque del Q2
Caso real que trajo Jair: el HI de BVN del 16-jul reporta producción de oro del 2T26
(37,266 oz incl. asociadas), pero el BEM de mayo muestra a BVN "vacío" en oro.
**Diagnóstico verificado con el Excel crudo**: NO es una celda vacía — el cuadro por
empresa del BEM es un TOP-10 por metal + "OTROS", y el oro de la entidad legal
"Compañía de Minas Buenaventura S.A.A." (~234k g/mes: Orcopampa+Tambomayo+Julcani+
San Gabriel) queda justo BAJO el corte del top → invisible en TODA la serie (0/17
meses). Coimolache entra y sale (4/17). No es bug nuestro ni anomalía de mayo: es
estructural de la fuente (el "Excel de anexos" también es top-10).
Lo construido (regla de Jair implementada, adaptada a lo que realmente pasa):
- **`fetch_bem.py` → `vigilar()`** + config `PRODUCTORES_HISTORICOS` (una línea por
  caso, cero código nuevo): (a) `hueco_reciente` = tenía dato el mes anterior y el
  último mes del BEM vino vacío → aviso, NUNCA se asume cero; (b) `fuera_del_top` =
  metal insignia sin ningún dato en toda la serie. **Validación cruzada automática**:
  busca en hechos.json un HI de producción reciente (≤120 días) de la empresa
  (entidad→ticker vía mineria_familia.json, única fuente de verdad) y lo cita en el
  aviso. Salida: sección `vigilancia` en mineria.json + alertas ⚠ en el log del robot.
- **ProduccionMinera.jsx** renderiza los avisos (estilo nota dorada): si la ficha ya
  tiene `notaProduccion` manual (BVN), los estructurales no se duplican. Verificado
  en navegador: Brocal muestra "⚠ El Brocal produce oro, pero no entra al top-10…";
  BVN mantiene su nota manual; consola limpia.
- **Robot coordinado**: deploy.yml ahora committea `extractor/cache_bem` (desde el
  14-jul cada corrida de 30 min re-bajaba del MINEM la edición de mayo porque el
  xlsx nunca viajaba en el commit). Edición 2026-05 integrada: serie ene25→may26.
- Detectado al correr: buenaventura/oro y la_zanja/oro con ✓ HI del 16-jul citado;
  brocal/oro sin HI propio (la producción de Brocal la reporta BVN en su HI).
- **📣 HI de producción DESTACADO en el apartado de minas** (pedido de Jair, mismo día):
  si la empresa publicó su "producción y volumen de ventas" del trimestre como HI,
  la sección ⛏️ lo destaca arriba con caja dorada + botón "Léelo (PDF ↗)" al original
  BVL. Genérico: busca en hechos.json (título con "producción", ≤120 días) → hoy se
  enciende para BVN ("Producción oficial del 2T 2026", del 16-jul) y SIMSA (citando
  su título real — honestidad); cualquier minera que empiece a publicarlo aparecerá
  SOLA, sin tocar código. Nivel 3 (va dentro de produccionMinera). hechos.json ya
  estaba en el bundle (chunk datos-hechos) → cero peso agregado. Verificado en
  navegador (BVN/SIMSA/Poderosa-sin-caja), consola limpia.

## 🌎 RONDA 9 del 11-jul: EMPRESAS DEL EXTRANJERO (AUNA/PPX/PML + Rio2 nueva)
Pedido de Jair: "a AUNA le falta info; aprende a sacar lo mismo de las webs de PPX, PML y Rio2, y
piensa cómo agilizar futuras extranjeras." Estas cotizan en BVL pero **NO presentan a la SMV**
(emisores extranjeros: NYSE / TSX-V de Canadá). Investigado con Chrome + pypdf; datos Q1 2026
verificados leyendo cada PDF. Lo construido:
- **`extractor/fetch_extranjero.py` + `extranjero_config.json`** (el ÚNICO lugar a editar para
  agregar una): localizador config-driven con 4 estrategias — `sec_edgar` (API data.sec.gov,
  headless, AUNA CIK 1799207), `urls_fijas` (PPX: la empresa reemplaza el mismo PDF cada trim),
  `scrape_patron` (Panoro, página JS → cae a docsSeed), `scrape_texto_wix` (Rio2: URLs opacas Wix
  → mapea por texto del enlace). Salidas: `documentos_extranjero.json` (links, lo muestra la ficha)
  + `extranjero_digest.json` (cifras "por revisar", NO se muestra — Regla #1). Corre a mano / PASOS_EPS,
  NO en el robot de 30 min (los reportes salen 1×/trimestre). Playbook completo en **`extractor/FUENTES_EXTRANJERO.md`**.
- **Datos poblados** en empresas.json (fundamentos/metricas/balanceDestacado/monedaEstados +
  campo nuevo `fundamentosFuente`): AUNA (PEN, ingresos S/1,178M, Adj.EBITDA S/217M, deuda neta
  S/3,407M, apalanc. 3.7x), PPX (CAD, patrimonio NEGATIVO -9.5M, going concern, ingreso vía Net
  Profit Interest del JV Callanquitas), PML (USD, explorador cobre pre-ingresos), **Rio2 NUEVA**
  (USD, TSX: RIO, no BVL: oro Fenix Chile + compra Cía. Minera Condestable cobre Perú; ya factura
  US$65.9M, utilidad US$22.5M). Total **115 valores**.
- **App**: `DocumentosOficiales.jsx` fusiona SMV + extranjero (pie de fuente correcto: SEC/SEDAR+,
  no "SMV"); `Empresa.jsx` usa `fundamentosFuente` para el encabezado. Sin `eps_anual` cargado →
  la app NO calcula P/E ni EV/EBITDA (evita valoraciones engañosas entre monedas/mercados).
  Verificado en navegador (AUNA/PPX/PML/Rio2): render completo, consola limpia.
- **Catalizadores = sus noticias reales** (pedido de Jair, mismo día): catalizadores.json con las
  últimas noticias fechadas de AUNA/PPX/PML/RIO. OJO honestidad: PPX y PML SÍ llegan por Hechos de
  Importancia de la BVL (ya se ven en la ficha), pero **Rio2 NO cotiza en BVL** (no está en
  hechos.json ni en empresas_config) → sus noticias solo salen en rio2.com.pe / SEDAR+; por eso su
  catalizador lo aclara.
- **Reloj de precios en Explorar** (`RelojPrecios.jsx`): banner que avisa que los precios se
  actualizan a **mediodía (12:15) y al cierre (15:15)** hora Perú (espeja el cron `15 17,20` del
  robot) + cuenta regresiva a la próxima + "última vez" (= __BUILD_TIME__). Cada tarjeta de Explorar
  muestra el precio (dorado) o "Sin cotización". Verificado en navegador.
- **📰 Noticias automáticas de la web oficial** (`NoticiasExtranjero.jsx` + `noticias_extranjero.json`):
  `fetch_extranjero.py` ahora SCRAPEA los titulares de la web de cada extranjera (config `noticias`
  por empresa: `url`/`linkPat`/`fecha`=url|orden|texto). Esencial para **Rio2** (no cotiza en BVL →
  no tiene Hechos): su ficha muestra los 4 últimos comunicados de rio2.com.pe con fecha. PPX igual
  (fecha en la URL). Panoro/AUNA se omiten (cotizan en BVL → ya llegan por Hechos). Corre en el robot
  DIARIO (`actualizar_todo.py` → `fetch_extranjero.py --solo-noticias`), no en el intradía. Los
  catalizadores volvieron a temático/a-futuro (el feed 📰 lleva las noticias fechadas). Verificado.

## 📚 RONDA 8 del 10-jul (Fable): LA BIBLIOTECA — asistente de documentos estilo NotebookLM
Pedido de Jair (prompt de "asistente profesional de documentos con RAG"): que Atlas y Sentinel
analicen VARIOS documentos a la vez, con citas exactas. **Arquitectura completa en
`ARQUITECTURA_BIBLIOTECA.md`** (decisión: RAG 100% EN EL NAVEGADOR — un backend Node +
vector DB + LLM rompería cero-costos/cero-secretos/privacidad; si algún día se aprueba con
presupuesto, la elección sería Qdrant). Piezas:
- **`lib/lectores.js`**: PDF (pdf.js por página), fotos/escaneados (OCR), **Word (.docx)**
  (JSZip CDN + DOMParser, headings = secciones), **Excel (.xlsx)** (SheetJS CDN, por hoja),
  **PowerPoint (.pptx)** (por diapositiva), TXT/CSV. Librerías 100% por CDN (cero bundle).
- **`lib/biblioteca.js`**: hasta 12 docs; chunks ~900 chars de oraciones completas con
  {página, sección}; búsqueda BM25 + SINÓNIMOS financieros ES↔EN (utilidad↔net income,
  cobre↔copper…; palabra RARA sola basta — caso "Boliden"); métricas con cita (ingresos,
  EBITDA, utilidad neta, flujo de caja, deuda) + período (Q/año) + comparación entre docs
  (delta %, "cambio importante" ≥15%, ⚠ contradicción si mismo período difiere), cronología
  (fechas+oración ordenadas), riesgos textuales, **resumen para inversionistas**. Citas
  formato pedido: `Doc.pdf · Página 12` / `Archivo.xlsx · Hoja «Resultados»`. Si no está:
  **"No encontré esa información en los documentos."** literal. Persistencia sessionStorage
  (sobrevive recarga) + historial de nombres en localStorage.
- **Atlas**: intents nuevos (Resumen para inversionistas / Compara mis documentos /
  Cronología / ¿Qué riesgos mencionan?) + métrica puntual + pregunta libre → cita la ORACIÓN
  que mejor responde; "según los documentos" le gana al glosario; saludo especial al llegar
  desde Sentinel con la biblioteca; bienvenida menciona la biblioteca si existe.
- **Sentinel.jsx**: acepta MÚLTIPLES archivos (drop o selector); 1 archivo = informe clásico
  (+ botón "súmalo a la biblioteca"), varios = panel 📚 (lista, quitar, agregar, vaciar,
  "Analizar juntos con Atlas"). Verificado en navegador: PDF real de Nexa + TXT Q1 + XLSX Q4
  → comparaciones con delta correcto por período, Boliden hallado, litio → "No encontré…".
  Móvil OK.
- **PWA RESUELTO (mismo día, pedido de Jair)**: el tope de 4 MiB (`maximumFileSizeToCacheInBytes`)
  es POR ARCHIVO, y TODO iba en un solo index.js de 2.9 MB que crece con cada actualización
  diaria del robot (historicos/lecturas/hechos) → al cruzar 4 MiB el SW lo excluiría en
  SILENCIO. Fix: `manualChunks` en vite.config.js parte los datos en trozos propios
  (datos-historicos 0.69 MB / datos-lecturas 0.51 MB / datos-hechos 0.41 MB / datos 0.98 MB;
  código 0.33 MB) — años de margen, y el usuario que vuelve solo re-descarga el trozo que
  cambió ese día. Verificado con `vite preview` (launch.json → `alto-dist`): render completo,
  consola limpia.

## 🧠 RONDA 7 del 10-jul (Fable): SENTINEL/ATLAS MÁS INTELIGENTES + OCR (leen FOTOS)
Reclamo real de Jair: el penúltimo HI de Nexa (02-jul, el comunicado sobre BOLIDEN) daba una
"descripción breve" — la lectura del robot salía VACÍA ("Sin categoría clara", 0 frases).
CAUSA: el comunicado viene de la matriz de Luxemburgo EN INGLÉS y todas las reglas eran solo
en español. Además pidió que lean fotos. Lo hecho (espejo sentinel.js ⇄ gen_lecturas.py, v2):
- **Análisis BILINGÜE (ES+EN)**: CATEGORIAS y SENALES ahora también en inglés (acquisition,
  negotiations, net loss, dividend declared…). Categorías NUEVAS: "rating" (clasificación de
  riesgo) y "auditoria" (auditoría externa). Montos/fechas también en formato inglés.
- **Resumen de verdad**: TÍTULO del documento (línea EN MAYÚSCULAS del arranque, se pesca con
  hasEOL de pdf.js), frases LÍDER cuando ninguna puntúa (antes quedaba vacío), recorte del
  legalese inglés ("forward-looking statements" — llenaba de falsas señales rojas), oraciones
  que no se parten en "S.A." ni en números ("623 , 015" → "623,015"), idioma detectado (el
  redactor avisa "el comunicado está en inglés").
- **Extractores nuevos**: adquisicion → partes ("Votorantim S.A. y Boliden"), enNegociacion,
  cambioControl, montoOperacion; legal → montoLegal; deuda → montoDeuda + tasa; directorio →
  persona + cargo; resultados → utilidad + ingresos. El redactor y Atlas los narran.
- **El caso Nexa-Boliden AHORA**: título «NEXA RESOURCES STATEMENT REGARDING BOLIDEN'S
  ANNOUNCEMENT», categoría Compra/venta/reorganización, partes detectadas, razones "negociación
  EN CURSO" + "podría cambiar quién CONTROLA la empresa", frase líder citada. Verificado en
  navegador (Sentinel + Atlas) y en Python.
- **📷 OCR — Sentinel lee FOTOS y PDF escaneados**: tesseract.js 6 (spa+eng) cargado 100% desde
  CDN jsdelivr con import dinámico → CERO peso en el bundle y el precache PWA (sigue 3.66 MiB).
  `leerDocumento()` decide: PDF con texto → pdf.js; PDF escaneado → render a canvas + OCR (máx
  8 págs, escala ≤2.2); imagen (JPG/PNG/WebP) → OCR directo. Necesita internet la primera vez
  (motor ~ unos MB del CDN); errores honestos (OCR_SIN_INTERNET / OCR_ILEGIBLE). El informe
  marca "📷 descifrado con OCR" y advierte posibles erratas. Verificado: foto y PDF escaneado
  de un HI sintético de dividendos → 🟢 con S/ 0.15 por acción y fechas correctas en ~3-8 s.
- **detectarEmpresa mejor**: palabras distintivas ≥4 letras (antes ≥6: "Nexa" no contaba),
  norm() colapsa saltos de línea (el OCR partía "Minera\nPoderosa"), y la FICHA donde el
  usuario suelta el archivo entra como pista (desempata Nexa Perú vs Nexa Atacocha; fallback
  si no se detecta nada).
- **Atlas**: respDocResumen con título + hasta 3 frases + aviso OCR; buscarEnDoc top-2
  oraciones con raíz simple y stopwords; intent nuevo "¿quién compra/vende/negocia?" (usa
  partes/cambioControl); saludoSentinel muestra el título. `terminos.json` 183→187
  (clasificación de riesgo, clasificadora, auditoría externa, OCR).
- **gen_lecturas.py v2**: `VERSION_ANALISIS = 2` — las lecturas cacheadas de versión vieja se
  re-analizan (escaneado/ilegible quedan cacheados). ⚠ Al subir la versión, correr LOCAL
  (`python extractor/gen_lecturas.py`) antes de push: si no, el robot de 30 min se pondría a
  re-bajar ~700 PDFs en la nube.

## 📝 RONDA 6 del 09-jul (Fable): NOTAS A LOS EEFF + EL 2025 MINERO COMPLETO
Pedido de Jair ("que lean las Notas a los EEFF; para minas también Q1-Q4 2025 con sus hechos").
- **`extractor/fetch_notas.py`** → `notas.json` (170 KB): las "Notas a los Estados Financieros"
  digeridas — trimestre ACTUAL para 93 empresas (88 con frases) + **Q1-Q4 2025 para las minas**
  (10 minas × 4 = 40 trimestres; las otras 7 no presentan a la SMV: juniors/SCCO-NYSE). Digest
  extractivo con señales de analista (deuda, juicios, partes relacionadas, covenants, negocio en
  marcha). Caché por expediente; **la historia 2025 congelada NO se re-consulta**; guardado
  incremental. En PASOS_EPS (completo/--trimestral).
- **`gen_lecturas.py` ampliado**: además de los 2 últimos hechos de cada empresa, lee TODOS los
  hechos 2025 de las 17 minas (API BVL corporate-actions con startDate/endDate 2025) →
  **714 lecturas** (492 de 2025: 83 🟢 / 17 🔴 / 350 🟡 / 42 escaneados-ilegibles). lecturas.json
  381 KB. PDF_BASE agregado (NameError cazado). Guardado incremental cada 25.
- **Atlas intents nuevos**: "¿qué dicen las notas de X?" (frases textuales) y "¿cómo le fue a X
  en 2025?" (minas: notas por trimestre + conteo de hechos del año con el más destacado — ej.
  BVN: venta de Chaupiloma por US$210M en el T3). Chips por empresa (máx 5).
- **EL ROBOT YA VIVE SOLO**: mientras se construía esto, él mismo commiteó "precios intradía
  17:12" y "hechos/BEM intradía 18:50" — los crones :07/:37 y :15 ya disparan (con el retraso
  natural de GitHub). El fix de openpyxl (ronda anterior) fue la llave.
- PWA precache: 3.48 MB (límite 4 MiB — si crece más, subir maximumFileSizeToCacheInBytes).

## 🗣 RONDA 5 del 09-jul (Fable): CHARLA DE LA GERENCIA + EL REDACTOR
Pedido de Jair ("que lean la charla con la gerencia de cada una" + "soluciona la diferencia de
redactar nuevos párrafos"). Piezas:
- **`extractor/fetch_gerencia.py`**: baja el **"Análisis y Discusión de la Gerencia"** (la charla
  trimestral donde la gerencia cuenta cómo le fue) de la SMV para cada empresa → `gerencia.json`
  (92 empresas, 86 con frases; extractivo: ≤7 frases + ≤6 montos TEXTUALES por empresa, elegidas
  por scoring de palabras financieras). CLAVES: la grilla de Frm_InformacionFinanciera tiene la
  fila "Análisis y Discusión de la Gerencia" con link "Descargar Documento"; caché por
  EXPEDIENTE (si no cambió, no re-baja); **guardado INCREMENTAL cada 10** (si el proceso muere no
  se pierde nada); corre en PASOS_EPS (modo completo local / --trimestral, NO en el robot de 30
  min — la SMV es flaky desde la nube). Algunos fallos legítimos: PDFs rotos o Word disfrazado.
- **`app/src/lib/redactor.js` — EL REDACTOR**: cierra la brecha con NotebookLM componiendo
  PÁRRAFOS naturales desde "slots" verificados (plantillas por categoría; si el slot está vacío,
  la frase no se escribe → redacción sin invención, Regla #1). Vive SOLO en JS (la app compone
  al vuelo desde lecturas.json/gerencia.json → no hay que mantener espejo Python ni engordar
  los JSON). Usado en: tarjeta de resultados de Sentinel (párrafo dorado), respDocResumen de
  Atlas, y respuestaGerencia.
- **Atlas nuevo intent**: "¿qué dice la gerencia de X?" / chip "¿Qué dice la gerencia de…?" →
  párrafo intro + 4 frases textuales de la charla. El resumen de empresa suma línea 🗣 con la
  primera frase de la gerencia.
- **BUG CAZADO por control de calidad (Regla #1)**: el extractor de dividendos capturaba
  "S/. 20" de "S/. 20,000,000" (el TOTAL truncado en la coma) como dividendo por acción de
  Paramonga (el real: S/ 0.601124). Fix en espejo (sentinel.js + gen_lecturas.py): número
  completo con comas Y pegado a "por acción" — ahora prefiere NO capturar antes que mentir.
  Re-leídos los 211 hechos con las reglas corregidas.

## 🛰️ RONDA 4 del 09-jul (Fable): NUTRICIÓN MASIVA — el robot lee los hechos de TODOS
Pedido de Jair ("que los dos aprendan de todas las empresas, sus 2 últimos hechos" + conversación
de NotebookLM como referencia de nivel). Piezas:
- **`extractor/gen_lecturas.py`**: port a PYTHON del análisis de sentinel.js (MANTENER EN ESPEJO:
  si cambias reglas en uno, cambia el otro). Baja el PDF de los 2 últimos hechos de cada empresa
  (pypdf, nuevo en requirements.txt), los analiza y escribe `app/src/data/lecturas.json`
  (clave = URL del PDF → sirve de CACHÉ incremental: primera corrida ~200 PDFs en minutos, las
  siguientes solo los hechos nuevos en segundos; PDFs escaneados → `escaneado:true` honesto;
  los PDF NO se guardan, solo el análisis ~0.5KB c/u). En el orquestador tras fetch_hechos
  (modos --hechos y --rapido) → el robot de cada 30 min mantiene las lecturas al día.
- **App**: `HechosImportancia.jsx` muestra badge 🟢/🔴/🟡 junto a cada hecho leído (tooltip con
  las razones); Atlas en "últimas noticias de X" suma su lectura ("🛰️ Ya leí el del [fecha]:
  pinta…" + frase clave del PDF).
- **Nivel NotebookLM**: extractores ESPECIALIZADOS en sentinel.js/gen_lecturas.py — derivados
  (instrumento Zero Cost Collar, onzas nocionales, resultado acumulado del año) y dividendos
  (monto por acción, fecha de registro/entrega) → `detalles` en el informe; **preguntas sugeridas
  POR CATEGORÍA** (PREGUNTAS_POR_CATEGORIA) como chips en Atlas; **términos 176→183** (derivado,
  zero cost collar, monto nocional, valor razonable, forward, opción put, opción call) para que
  Atlas explique los conceptos como profesor (con NUESTRAS definiciones, no inventadas).

## 🛰️ RONDA 3 del 09-jul (Fable): SENTINEL — el lector de hechos de importancia
Pedido de Jair ("que el usuario descargue el hecho, se lo pegue a una IA, ella lea, y abra un
chat con Atlas ya con el contexto"). Él eligió el nombre **Sentinel**. Piezas:
- **`lib/sentinel.js`**: `leerPdf()` extrae el texto con **pdf.js** (pdfjs-dist v6, IMPORT
  DINÁMICO → chunk aparte, solo pesa al usarlo; el worker via `?url`; ojo: `destroy()` vive en
  la TAREA, no en el doc). `analizar()` = extractivo honesto: detecta empresa (contra
  empresas.json), categoría (9 patrones, de específico a genérico, "resultados" AL FINAL),
  montos/fechas/frases clave y **veredicto buena/mala/neutra** por señales con peso + prior de
  categoría. Las categorías `rutinario: true` (posición mensual en derivados) se fuerzan a
  NEUTRA salvo puntaje extremo — mencionan "pérdidas" en sus tablas y daban falso 🔴.
  PDF escaneado sin texto → error honesto "no hago OCR". TODO corre en el navegador del
  usuario (el PDF no se sube a ningún lado — privacidad).
- **`Sentinel.jsx`** en la ficha, DEBAJO de HechosImportancia: procedimiento en 4 pasos (toca
  PDF ↗ arriba → descarga → vuelve → suéltalo), dropzone + input, animación "leyendo página X
  de Y", tarjeta de veredicto con razones, y botón "🧠 Abrir el chat con Atlas".
- **Traspaso a Atlas**: contexto por sessionStorage `alto-sentinel-contexto`; `saludoSentinel()`
  en cerebro.js hace que Atlas salude YA conociendo el doc (⚠ GOTCHA StrictMode: el saludo es
  PURO y `marcarContextoVisto()` va en un useEffect de Atlas.jsx — los inicializadores de
  useState corren 2 veces en dev y el 2º encontraba el contexto "usado"). Intents del doc:
  "¿de qué trata?", "¿buena o mala?", montos, fechas, y búsqueda libre DENTRO del texto antes
  del fallback. **Atlas "aprende"**: cada hecho leído queda en localStorage
  `alto-sentinel-aprendidos` (máx 15) → "¿qué hechos te he pasado?" los lista y el resumen de
  la empresa menciona el último. VERIFICADO con el PDF real de Nexa (hedging jun-26, 3 págs):
  detectó empresa, categoría rutinaria, veredicto neutra, chat con contexto y repreguntas.

## 🧠 RONDA 2 del 09-jul (Fable, feedback de Jair EN LA MISMA NOCHE)
- **Yachay → ATLAS** (a Jair no le gustó el nombre quechua; él eligió Atlas). Archivo ahora es
  `components/Atlas.jsx`; clases CSS siguen siendo `yachay-*`/`ya-*` (solo cambió el nombre visible).
- **NOTEBOOKLM ELIMINADO** (pedido de Jair): se borró `EstudioNotebookLM.jsx`, su botón en la ficha
  y su CSS. No volver a agregarlo salvo que él lo pida.
- **BUG NEXA CAZADO (el reclamo de Jair era REAL):** el API de la BVL SÍ tenía el HI de Nexa del
  08-jul (derivados jun-26) pero `fetch_hechos.py` lo BOTABA: exigía `observation` no vacío y muchos
  HI estándar vienen con observación EN BLANCO (la categoría es el contenido). Fix: basta titulo O
  categoría; "titulo" ahora es clave opcional en hechos.json (la app ya lo tolera).
- **BUG CELULAR CAZADO (el "no puedo tocar nada"):** DOS causas reales: (1) en iPhone tocar fuera
  NO dispara blur → el tooltip centrado (fixed, z-index 300) quedaba abierto PARA SIEMPRE tapando
  la pantalla → fix en `Glosado.jsx`: cierre por `pointerdown` a nivel documento (cualquier toque
  fuera lo cierra). (2) `.vista-anim` usaba `animation-fill-mode: both` → el transform final
  (aunque identidad) se seguía APLICANDO para siempre → el elemento era "containing block" y
  cualquier `position:fixed` de adentro (el tooltip) se anclaba a la PÁGINA (aparecía en top:7000px,
  fuera de pantalla) → fix: fill-mode `backwards` + keyframe termina en `transform: none`.
  VERIFICADO en preview móvil: tooltip centrado EN pantalla (top 367/812) y cierra al tocar fuera.
- **ATLAS APRENDE + CONOCIMIENTO PROPIO:** nuevo `data/conocimiento.json` = hechos CURADOS de los
  informes de Jair (Desktop/INFORMES REALIZADOS ALTO RESEARCH: BVN, Nexa, Minsur, CVerde, Backus,
  Brocal, Corona/MINCORI1, Volcan — SIN precios objetivo ni recomendaciones, Regla #9). Atlas lo usa
  en el resumen ("📚 Del informe ALTO"), en riesgos y en el intent nuevo "Cuéntame más de X".
  Fallback ahora ANOTA la pregunta (localStorage `alto-atlas-sin-respuesta`) y ofrece botón
  "📨 Enviar mi pregunta al equipo" → abre Comentarios con el texto listo. Identidad: "enseña y aprende".
- **💬 PESTAÑA COMENTARIOS** (`Comentarios.jsx`, ruta `#/comentarios`, en el nav): tipos (agregar/
  gusta/no gusta/pregunta para Atlas/error), textarea, "Enviar por correo" (mailto a
  `config.feedback.correo` = altoresearch1@gmail.com, SIN backend) + "Copiar mensaje". Recibe el
  borrador de Atlas por sessionStorage `alto-feedback-borrador`.
- **🆕 "ACTUALIZACIONES" reemplaza al "Mensaje del día"** en el inicio: `config.json` →
  `actualizaciones.items` (fecha+texto, la más nueva primero, se muestran 5). Jair las edita ahí.
- Términos 174 → 176 (sab, hecho de importancia). Siglas ≤4 letras en MAYÚSCULAS en Atlas.

## 🧠 YACHAY→ATLAS (IA beta) + ROBOT INTRADÍA + AVISOS 🔔 (09-jul-2026, Fable — ronda 1)
Pedido de Jair ("IA que ayude a los nuevos", "actualizar cada media hora", "aviso con sonido
a los que guardaron la acción", "NotebookLM"). Cuatro piezas, TODAS sin backend (sigue siendo
web estática, cero secretos, cero costos):
- **🧠 YACHAY — "aprende con la IA" (beta).** `app/src/lib/cerebro.js` + `components/Yachay.jsx`,
  ruta `#/ia`, botón en nav y en el hero (con chip BETA). NO llama a ninguna API: responde SOLO
  con los datos verificados ya empaquetados (114 empresas, 174 términos + glosario, tesis, tips,
  dividendos, precios, P/E, hechos). Por diseño: no se sale del tema, no inventa (si no sabe lo
  dice — Regla #1) y RECHAZA "qué compro" (Regla #9, respuesta educada + quiz). Intenciones:
  resumen de empresa, dividendos, riesgos (tips con palabras de riesgo), precio/P/E, noticias
  (hechos), término ("¿qué es X?" → terminos.json + glosario.json), top yields (con ⚠ de
  extraordinarios), "cómo empiezo", comparar X vs Y (→ link al Comparador), saludo/fallback con
  chips sugeridos estilo NotebookLM. El nombre es quechua: yachay = saber/aprender.
  **Por qué no NotebookLM incrustado:** no tiene API ni embed (cada usuario necesita su cuenta
  Google y subir fuentes a mano) — se le explicó a Jair; en su lugar:
- **📓 "Estudiar con NotebookLM"** (`components/EstudioNotebookLM.jsx`, botón en la ficha junto a
  Compartir): genera EN el navegador un .txt "paquete de estudio" (fundamentos, precio, P/E,
  dividendos, tesis, tips, catalizadores y los hechos 12m CON el link al PDF oficial de cada uno
  + preguntas sugeridas) y un modal con los 4 pasos para subirlo a notebooklm.google.com.
- **🤖 ROBOT INTRADÍA** (`deploy.yml` + `actualizar_todo.py`): 3 crones — cierre nocturno
  `0 3 * * 2-6` (--rapido, igual que antes), **hechos+BEM cada 30 min** `7,37 13-21 * * 1-5`
  (8:00-16:30 Perú, modo nuevo `--hechos` ≈ 1-2 min) y **precios ~12:15/15:15 Perú**
  `15 17,20 * * 1-5` (modo nuevo `--precios`). El modo se elige con `github.event.schedule` (trae el cron que disparó). **Solo se
  commitea Y despliega si los datos cambiaron** (output `cambios` del job; si no, el run muere en
  ~1 min sin ruido). El BEM es MENSUAL: revisarlo cada 30 min no trae nada — fetch_bem ya no
  escribe si no hay edición nueva, así que es gratis. Repo público = minutos de Actions ilimitados.
- **🔔 AVISOS EN VIVO para favoritos** (`extractor/gen_novedades.py` + `app/src/lib/novedades.js`
  + `components/AvisoNovedades.jsx` en App.jsx): gen_novedades corre al final de TODOS los modos
  del orquestador y escribe `app/public/novedades.json` (~20 KB: último hecho por ticker +
  preciosFecha + bemUltimoMes). Clave: va en **public/**, NO en src/data → se sirve SUELTO
  (fuera del bundle y FUERA del precache del SW, verificado) → la app abierta lo re-pide con
  `cache:'no-store'` al cargar, al volver a la pestaña y cada 5 min. Si una empresa con ★ tiene
  hecho nuevo → toast dorado con SONIDO ("din-don" Web Audio sintetizado, como la moneda) que al
  tocarlo abre la ficha; si sale BEM nuevo y sigues mineras → aviso ⛏️. Lo visto se guarda en
  localStorage `alto-novedades-vistas`; la PRIMERA visita solo toma la foto (no spamea hechos
  viejos) y también se fotografían los no-favoritos (guardar ★ después no dispara avisos viejos).
  El archivo es DETERMINÍSTICO (sin timestamps de reloj) → si no hay novedades queda byte-idéntico
  y el robot no commitea. VERIFICADO en preview: toast + clic → ficha + marca de visto + móvil 375px.
- Auditoría estructural OK (mismos avisos legítimos de siempre). Build PWA OK (novedades.json en
  dist/, fuera del precache del SW).

## ⛏️ PRODUCCIÓN MINERA MENSUAL (MINEM/BEM) EN LAS FICHAS DE MINAS (08-jul-2026, Fable)
- **Pedido de Jair:** gráficos de producción mensual por metal (estilo líneas con puntos, su imagen
  de referencia) en el "apartado de minas", ene-2025 → abr-2026, con las minas/participaciones de
  cada empresa abajo (quién controla qué, %, si cotizan y dan dividendos).
- **Fuente NUEVA (la pasó Jair): MINEM — Boletín Estadístico Minero** (receta completa en
  `extractor/FUENTES.md`). El cuadro S01.C02 de cada edición trae producción POR EMPRESA del mes
  (top ~10 por metal + OTROS) para el año de la edición Y el año anterior → 12 Excels
  (prepublicaciones jul25-abr26 + anexos may/jun25) arman la serie ene-2025→abr-2026 completa.
- **Nuevo `extractor/fetch_bem.py`** → `app/src/data/mineria.json` (16 entidades, 37 series).
  Caché en `extractor/cache_bem/` (committeada — el robot no re-descarga); auto-descubre ediciones
  nuevas en la colección de gob.pe; NO reescribe el JSON si el BEM no publicó nada (el robot no
  commitea ruido). Sumado a `actualizar_todo.py` (incluido `--rapido`). gob.pe pide UA de navegador.
- **Nuevo `app/src/data/mineria_familia.json` (MANUAL, verificado 08-jul):** por ticker minero:
  entidades BEM a graficar, sus minas y participaciones con %: BVN (Cerro Verde 19.58%, Brocal
  61.43%, La Zanja 100% —Newmont se la cedió—, Coimolache 40.09%; **vendió Yanacocha a Newmont
  2022 por US$300M**), Minsur (San Rafael + Pucamarca + **Marcobre/Mina Justa 60%**), Nexa
  (Cerro Lindo + El Porvenir + Atacocha 62.89%B/99.36%A), Volcan (Yauli + Chungar + Adm. Cerro,
  que absorbió Óxidos de Pasco oct-2023), Shougang (~98.5% de Shougang Corp; **Shouxin 49%**,
  relaves de Marcona), Corona (Sierra Metals 81.84% → **comprada por Alpayana 2025**, OPA por
  Corona anunciada), Santa Luisa (grupo Mitsui ~70/30), SPCC (sucursal 100% de SCCO). Sin
  producción con explicación honesta: PML/PPX/Andex (juniors), Perubar (ya no mina, almacenes),
  SIMSA (bajo el top del BEM).
- **Nuevo `ProduccionMinera.jsx`** en la ficha (solo sector minas, entre Tips y Fundamentos):
  un mini-gráfico por metal (unidades no se mezclan: TMF / g finos / kg finos), grilla punteada,
  líneas con puntos y color POR ENTIDAD consistente entre gráficos (ej. Minsur dorado = estaño,
  Marcobre azul = cobre), leyenda cuando la ficha tiene 2+ entidades (Nexa muestra Cerro Lindo +
  El Porvenir; Volcan sus 3). **Huecos honestos**: mes sin punto = no apareció en el top (produjo
  poco o nada — "no se inventa un cero"); metales con <3 datos van como texto puntual (el estaño
  real de BVN oct-2025: 17.9 TMF — verificado en el Excel crudo). Abajo: "Sus minas" +
  "Participaciones (quién tiene qué)" con links a las fichas que cotizan y si dan dividendos
  (afirmaciones respaldadas por nuestro dividendos.json). Escala desde 0 (no exagera).
- **Términos 164 → 172**: TMF, gramos finos, kg finos, MINEM, relaves, OPA, molibdeno, bismuto.
- **V2 "con carisma" (mismo día, pedido de Jair "vuélvete loco"):** el extractor ahora captura el
  **TOTAL NACIONAL por metal/mes** (fila del metal en el cuadro) → `totalesPais` en mineria.json.
  Cada gráfico trae: **chips de números grandes** (último mes con dato + traducción amable
  "= 8.4 toneladas de plata"; vs mes anterior; vs mismo mes del año pasado; **"% del metal del
  Perú"**; 2026 vs 2025 sumando SOLO meses comparables), **🏆 banner cuando domina** (share ≥25%:
  Minsur "100% de todo el estaño del Perú", Shougang+Shouxin "100% del hierro"), **★ récord del
  período** marcado sobre la línea, **hover/touch interactivo** (guía vertical + lectura del mes:
  valor por entidad + % del Perú), emoji por metal, "de la plata"/"del cobre" (género correcto).
  FIX de paso: la sección aparece por familia minera y no por sector (Shougang es sector
  "acereras" y se la perdía); y `.lista-limpia li { overflow-wrap:anywhere }` (las Fuentes SMV
  largas desbordaban en 375px — bug preexistente).
- **V3 gráfico con cuerpo + FIXES de tooltips (pedidos de Jair):** eje Y con números compactos
  (14 k…), relleno degradado bajo cada línea, frontera punteada "2025 | 2026", último dato con
  anillo y valor. **BUG Glosado cazado**: buscaba el término en minúsculas → las claves en
  MAYÚSCULAS del JSON (TMF, MINEM, OPA) NUNCA mostraban tooltip; ahora el índice se normaliza
  (cualquier clave nueva funciona en cualquier caja). **Tooltip en celular CENTRADO en pantalla**
  (@media ≤640px: position fixed + translate; antes salía pegado a la esquina y no se leía —
  queja de Jair) y ahora muestra la PALABRA como título dorado. TMF glosado también en los chips.

## ⚖ COMPARADOR "FRENTE A FRENTE" V2 (08-jul-2026, Fable) — pedido de Jair ("quedó obsoleto, vuélvete loco")
- **🏁 La carrera:** las DOS acciones en UN solo gráfico, **indexadas a 100** en el arranque
  (la forma honesta de comparar trayectorias con precios/monedas distintas), rangos 3M/6M/1A,
  línea de salida punteada en 100, % final por empresa en la leyenda (verde/rojo), nota educativa
  + aviso si alguna negocia poco. Colores fijos: A dorado / B azul (mismos en todo el duelo).
- **💰 Duelo de dividendos:** yield GRANDE por lado (comparable entre monedas), frecuencia
  traducida (semestral/trimestral/mensual/anual), monto por acción, nº de pagos 2025/2026,
  aviso yield>20% (extraordinario), barras enfrentadas. Si no reparte: "No reparte hoy"
  (antes decía "Pendiente (SMV)" — ENGAÑOSO, corregido también en la tabla).
- **⛏️ Duelo minero:** si AMBAS tienen producción BEM, sus familias compiten metal por metal
  en el mismo gráfico (suma de entidades de cada familia; se aclara que NO incluye minoritarias
  tipo Cerro Verde para BVN) + **"% del Perú"** de cada una en la leyenda. Solo metales con ≥3
  meses de dato en ambas.
- **Tabla mejorada:** barras de magnitud bajo P/E, Yield y Volatilidad (solo números sin unidad
  mezclada — nunca S/ vs US$) con micro-explicación por fila; aviso ámbar si son de SECTORES
  DISTINTOS ("sus números se leen diferente"). **📜 La historia de cada una**: tesis lado a lado.
- **↗ Compartir duelo** (Web Share / copiar link) y el link se actualiza al cambiar los
  selectores (history.replaceState). **BUG preexistente arreglado:** al llegar otra pareja por
  URL (link compartido / botón atrás) el comparador no se actualizaba (useState solo al montar;
  ahora useEffect sincroniza). Sin veredicto, como siempre: "las barras muestran MAGNITUD, no
  cuál es mejor".

## 💎 P/E RESCATADO + SIGNIFICADO DE LA CARRERA + NOTA BVN (08-jul-2026, Fable, pedidos de Jair)
- **P/E que se ocultaba (hallazgo de Jair con Santa Luisa):** 33 empresas tenían BPA anual (SMV)
  y precio, pero el P/E se ESCONDÍA porque el precio era viejo (ilíquidas). Nuevo `peInfo()` en
  `lib/finanzas.js` (único cálculo de P/E, reemplaza a peNumerico/calcularPE duplicados): ahora se
  MUESTRA con **⚠ "referencial: su último precio es del dd/mm (negocia poco)"** en la guía de la
  ficha y el Comparador (la Valoración ya lo mostraba con aviso). La nota del P/E en el Comparador
  trae la fórmula completa: **P/E = precio ÷ BPA; BPA = utilidad neta ÷ acciones en circulación**.
- **PODERC1 y SCCO al `fix_eps.py`:** les faltaba el EPS anual (Poderosa no parseó; SCCO
  sin_documentos) → EPS ttm implícito de stockanalysis con fuente. Poderosa P/E 11.3, SCCO 27.8.
  Pendiente si Jair quiere más: para sin_documentos restantes (AUNA/PML/PPX/Pucalá y fondos) el
  P/E no aplica o no hay dato; la vía "N acciones de internet + utilidad SMV" queda anotada.
- **Términos 172 → 174:** "acciones en circulación", "indexado a 100".
- **"La carrera" explicada** en el Comparador: bloque visible "¿Qué es esto?" (ambas arrancan en
  100 = indexado a 100, se compara el % desde ahí).
- **Nota en la producción de BVN** (`notaProduccion` en mineria_familia.json, render nuevo):
  explica los huecos (top-10 del BEM) y manda a sus 📰 HI ("resultados de producción y volúmenes
  de venta" trimestrales). IDEA de Jair anotada: extraer producción trimestral de esos reportes
  para complementar los huecos (los HI son PDFs trimestrales, no mensuales — sería un bloque
  aparte "según su propio reporte").

## 📊 TODAS LAS GRÁFICAS ESTILO BEM (08-jul-2026, Fable, pedido de Jair "absolutamente todas")
- **Sparkline del precio (toda ficha) reescrito:** eje Y con PRECIOS (formato inteligente:
  304 / 3.45 / 0.925), grilla punteada, 4 fechas en el eje X, guía + **lectura al pasar el
  dedo/cursor** (fecha + precio + % desde el inicio del rango), anillo en el último punto.
  Se quitó `preserveAspectRatio="none"` (deformaba el texto de los ejes). El modo `compacto`
  quedó sin uso (el Comparador v2 usa La carrera) pero se mantiene por compatibilidad.
- **La carrera (Comparador):** degradado suave bajo cada línea + hover con lectura de AMBAS
  ("01/04/2026 · BVN ▲15.9% · VOLCABC1 ▼9.5%") buscando el punto más cercano de cada serie.
- **Duelo minero:** extraído a componente `ChartDueloMetal` (necesitaba estado propio) con
  degradados por familia y lectura mensual al hover ("jun 25: BVN 31,816 kg vs Volcan 31,736").
- **Barras de dividendos (`DividendoGrafico`):** pista con grilla punteada dorada (mismo lenguaje).
- Todo verificado (hover en los 4 tipos, móvil 375px sin desborde, consola limpia), auditoría 0.

## 🔧 FIXES POST-LANZAMIENTO (05–08 jul 2026, Opus)
- **Robot ya no falla al subir ("fetch first"):** el paso "Commit de los datos frescos" del workflow ahora hace
  `git pull --rebase -X theirs origin main` ANTES del `git push`. Antes, si otro commit llegaba mientras el robot
  trabajaba, el push se rechazaba. Se configuró también la identidad de git en el repo (evita el error
  "unable to auto-detect email" durante la rebase). Los runs nocturnos 07 y 08-jul quedaron verdes.
- **PWA auto-actualizable (bug "la web no se actualiza"):** el síntoma era que el navegador mostraba la versión
  cacheada vieja hasta la 2ª recarga. **NO era el pipeline** (el servidor SIEMPRE tenía lo último — verificar con
  `curl` del bundle, no confiar en el navegador). `app/src/main.jsx` ahora registra el Service Worker con
  `registerSW({immediate:true})` + chequeo de versión al cargar / al volver a la pestaña (`visibilitychange`) /
  cada 5 min → aplica y recarga sola. Para un navegador con la versión vieja pegada: **Ctrl+Shift+R** una vez.
- **Analítica de visitas (GoatCounter):** script en `app/index.html`, panel en **altoresearch.goatcounter.com**
  (correo `altoresearch1@gmail.com`). Privada, sin cookies, gratis. Cuenta a los visitantes reales (ignora
  localhost y a veces la bloquea un adblocker propio — probar en incógnito/celular).
- **NEXA — catalizador Boliden-Votorantim (verificado con MINING.COM/Mining Journal/RTTNews/StockTitan):** Boliden
  confirmó el 02-jul que está en CONVERSACIONES para comprarle a Votorantim su participación de control (~65%) en
  Nexa (~US$1,300M). SIN acuerdo/precio/fecha. Agregado a `catalizadores.json` (NEXAPEC1) con honestidad (Regla #7).
- **Pendientes de Jair:** número de Yape (`config.json`→`apoyo.yapeNumero`); video promo TikTok (quedó a medias:
  QR con Python `qrcode` + placa final vertical PIL + guion sin voz con "GRATIS"); agregar ETFs/empresas cuando pida.

## 🚀 LANZADA (03-jul-2026) — EN VIVO + robot diario en la nube
- **URL EN VIVO:** **https://altoresearch1-arch.github.io/** (HTTPS forzado por GitHub Pages).
- **Cuenta GitHub:** `altoresearch1-arch`. **Repo (público):** `altoresearch1-arch/altoresearch1-arch.github.io`
  (mismo nombre que el usuario → URL raíz limpia = sitio de usuario). Esta PC ya tiene `origin` + credencial (GCM):
  `git push origin main` publica. Rama = `main`. `.gitignore` de raíz creado (excluye node_modules/dist/
  settings.local.json/__pycache__/secretos). Auditorías estructural + total en 0 problemas antes de subir.
- **ROBOT DIARIO** = `.github/workflows/deploy.yml`, cron `0 3 * * 2-6` UTC = **Lun–Vie 22:00 Perú** (tras el cierre
  BVL). Dos jobs: `actualizar-datos` (corre `extractor/actualizar_todo.py --rapido`, commitea los JSON frescos con
  `[skip ci]`) y `desplegar` (build PWA + publica en Pages). En `push` solo despliega. La PC NO se prende.
  Deps: `extractor/requirements.txt` (requests/bs4/lxml). Botón "Run workflow" para correrlo a mano.
- **`--rapido` (nuevo 03-jul):** el nocturno SALTA `fetch_anual_eps`+`fix_eps` (SMV). El EPS anual 2025 es ESTÁTICO
  y el SMV es LENTO/flaky desde la nube (el run completo se quedó 20+ min en ese paso). El `--rapido` corre solo
  BVL/stockanalysis en **~9 min**. El EPS se refresca con `--trimestral` o el comando completo local. **VALIDADO
  EN VIVO:** run `--rapido` verde en 9 min → commiteó datos frescos del 03-jul y desplegó.
- **Config GitHub aplicada:** Pages source = "GitHub Actions"; Actions → Workflow permissions = "Read and write"
  (el robot necesita write para commitear datos).
- **VERIFICADO en vivo:** el robot corre desde runners de EE.UU. y la BVL responde (bajó 767 cotizaciones con fecha
  de hoy). Deploy en push OK (~37s). NOTA: el 1er deploy de un sitio Pages nuevo puede fallar 1-2 veces
  ("Deployment failed, try again later" = backend provisionándose) → reintentar con un run NUEVO (no re-run del
  mismo run: colisiona por 2 artifacts "github-pages"). Riesgo a vigilar: `fetch_anual_eps` toca el SMV (flaky
  desde la nube); si `actualizar-datos` falla una noche, no se redespliega pero el sitio queda con los últimos datos.
- **mensajeDia** de hoy: "La constancia supera al talento." (Jair lo edita en `app/src/data/config.json`).
- **PENDIENTE de Jair:** número de Yape (`config.json` → `apoyo.yapeNumero`, hoy vacío; el QR ya está).

## 🎯 PRÓXIMA SESIÓN — 3 prioridades antes de lanzar (pedido de Jair, 03-jul)
Jair abrirá otra sesión enfocada en: **(1) cazar bugs, (2) reforzar seguridad, (3) LANZAR.** Contexto para arrancar:
- **BUGS a revisar / que NO son bugs:** los errores de consola tipo `[hmr] Failed to reload …` que se ven
  en el dev server **NO son bugs** — salen cuando los scripts de Python escriben los JSON mientras Vite
  intenta recargar en caliente; se limpian **reiniciando el dev server**. La app renderiza bien (verificado
  ficha por ficha). Zonas a QA manual: las 114 fichas + responsive móvil (375px), el flujo del quiz, y las
  fichas `sin_documentos` (AUNA/SCCO/PML/PPX/Pucalá) que muestran solo precio+HI+dividendos. Correr
  `python extractor/auditoria.py` y `python extractor/auditoria_total.py` (ambas en 0 problemas al 03-jul).
- **SEGURIDAD (superficie chica, es estático):** la app es **React estático sin backend, sin login, sin
  datos de usuario, sin secretos en el cliente**. Datos = JSON públicos educativos. Puntos a cerrar antes
  de publicar: (a) que NO haya llaves/tokens en el repo (el extractor solo usa APIs públicas BVL/SMV/
  stockanalysis, sin auth); (b) hosting con **HTTPS**; (c) si se usa GitHub Actions, el `GITHUB_TOKEN` con
  permisos mínimos (solo push a la rama de deploy); (d) el modal de Apoyo tiene Yape/PayPal (info pública,
  ok); (e) headers básicos (CSP) los pone el hosting (Netlify/Cloudflare/Pages). No hay CORS ni cookies.
- **LANZAR:** hosting estático (GitHub Pages / Netlify / Cloudflare Pages, gratis) + **robot diario con
  GitHub Actions** que corre `fetch_precios` → `fetch_historicos` → `fetch_hechos` → `div_stockanalysis`
  → `fetch_beneficios` → `fetch_anual_eps` → `fix_eps` → `npm run build` y redeploya. La PC de Jair NO
  necesita estar prendida (la nube lo corre). PROBAR primero que los scripts corran desde los runners de
  GitHub (EE.UU.): BVL/stockanalysis/TC son APIs y deberían andar; el SMV (solo trimestral) puede ser
  flaky → ese se corre a mano. Falta de Jair: cuenta GitHub + elegir hosting + **número de Yape** para
  el botón "copiar número" (el QR ya está en `config.json`).

## ⭐ PULIDO UI FINAL (03-jul-2026, Opus) — moneda anti-estrés + header + dividendos
- **Moneda anti-estrés (guiño al coin de Team Fortress 2):** el **logo gigante del inicio ES la moneda**:
  al clickarlo salta, se da la vuelta (flip 3D `rotateX`) y suena un "cling" **sintetizado con Web Audio**
  (cero archivos). Componente `app/src/components/MonedaFidget.jsx` (reemplaza al `<img>` del hero en
  App.jsx). El giro va sobre el WRAP para no chocar con la animación `auraLogo` (respira) del logo. Sin
  contador de giros (Jair lo pidió quitar). El sonido solo suena con clic REAL de mouse (política de audio
  del navegador). Respeta prefers-reduced-motion.
- **Header transparente:** el `.topbar` era sticky con fondo `rgba(10,10,10,0.72)`+blur → esa banda oscura
  era la "línea negra que desentonaba". Ahora `background: transparent` (styles.css). Nota: al ser
  transparente + sticky, el contenido pasa levísimamente por detrás al hacer scroll (aceptado por Jair;
  alternativas si molesta: blur suave sin color, o quitar el sticky).
- **Gráfico de dividendos:** los números de las barras (2025 vs 2026) chocaban con el título; se subió la
  altura del contenedor (100→128px, anclaje abajo) en `DividendoGrafico.jsx` → los números bajan con aire.
  Y el bloque del anuncio (📌/⚠️) se separó del gráfico (marginBottom 22 en `DividendoResumen.jsx`).

## ⭐ AUNA (PILOTO MERCADO AMERICANO) + PPX + "MUY ALTA VOLATILIDAD" (03-jul-2026, Opus) — **114 valores**
- **AUNA = primer paso a EE.UU.** (pedido de Jair). No presenta XBRL individual a la SMV porque cotiza
  en NYSE; sus datos salen de su reporte CONSOLIDADO (SEC/IR), no de la SMV. Traídos de la web y
  CONFIRMADOS: grupo de SALUD (hospitales/clínicas/oncología) en Perú, Colombia y México; ingresos 2025
  **S/4,385M**, EBITDA ajustado **~21%**, **FCF S/582M (+35%)**, EPS $1.32, pero **apalancamiento 3.6x**
  (su gran riesgo, plan bajarlo debajo de 3x); reporta en SOLES aunque su acción se compra en US$ en NYSE;
  no reparte dividendos. Tesis/tips/catalizadores/escenarios reescritos con esos números. (Se corrigió el
  tip viejo que decía "reporta en dólares" — es SOLES.) **Pendiente**: integrar sus fundamentos consolidados
  al esquema `empresas.json` (hoy siguen como sin_documentos; los números viven en la tesis/tips).
- **PPX (nuevo, +1): PPX Mining Corp** — junior de oro/plata (proyecto Igor, La Libertad), penny stock
  US$0.14 (SÍ negocia). sin_documentos (emisor extranjero) → solo HI. tesis/tips con **MUY ALTA VOLATILIDAD**.
- **"MUY ALTA VOLATILIDAD" a SCCO/PML/Pucalá/PPX** (pedido de Jair): aviso ⚠️ como primer tip. Calibrado y
  HONESTO: PML/PPX/Pucalá son apuestas especulativas de verdad; **SCCO** es un gigante estable, así que su
  aviso dice que es la acción LOCAL (BVL) la que casi no negocia y tiene precio errático (la de referencia
  es la de Nueva York) — no se le miente llamando volátil a la empresa.

## ⭐ TANDA 10 + TIPS RICOS + AUDITORÍA TOTAL (03-jul-2026, Opus) — **113 valores**
- **TANDA 10 (11, 102 → 113), las últimas relevantes** (verificado en BVL que el mercado peruano ya
  queda cubierto): **estatales** Petroperú (petrolera, deuda US$5,070M por Talara, NO paga dividendos),
  SEDAPAL (agua de Lima, monopolio natural), COFIDE (banca de 2º piso) → diversas/bancos; **eléctricas**
  Electrosur, Electro Sur Este (regionales estatales); **infraestructura** Red Vial 5/Norvial (peaje,
  gran pagadora trimestral), Inca Rail (tren a Machu Picchu, dejó de pagar tras caída del turismo);
  **industriales** IEQSA (aluminio, en pérdida Q1), Paramonga (azúcar/papel → alimentos); Compartamos
  (microfinanzas, Gentera → bancos); La Positiva Vida (seguros vida, hermana de La Positiva → diversas).
  Casi todas sin precio (no negocian) → ficha con fundamentos+dividendos. Con tesis/tips/catalizadores/
  escenarios. Petroperú extrajo OK (no sin_documentos). **El mercado peruano líquido/relevante queda
  esencialmente agotado**: lo que sobra son liquidaciones, subsidiarias de bancos extranjeros que no
  cotizan, aseguradoras chicas y agro en crisis (ver scan en el chat).
- **TIPS ENRIQUECIDOS a ~7-9 por empresa** (pedido de Jair "5-10 datos por empresa"): `enrich_tips.py`
  agregó 226 tips con DATOS CONFIRMADOS (P/E vs rango del sector, yield+frecuencia del dividendo, deuda,
  FCF, margen, liquidez real, moneda) — cero invención, sin duplicar lo que ya decía cada tip. Promedio
  5.0 → 7.0. Formato pulido (S/ 1,649 M) y frase de liquidez "0 días" reescrita.
- **TÉRMINOS 112 → 160** (barrido QUIRÚRGICO de las 113 fichas): +40 con escaneo sistemático (comisión,
  tasas de interés, regulado, tarifa, bono, flujo de caja, estacional, VAD, afiliados, mora, corto/largo
  plazo, Osinergmin, tipo de cambio, NYSE, ADR, cartera, colocaciones, refinería, ley del mineral,
  inflación, Indecopi, dumping, SUNASS, impago, cobertura, arancel, peaje, concesión, banca de 2º piso,
  monopolio natural, zafra, galvanizado, refinación, estados individuales, fecha de corte, reaseguros…).
  Segundo pase por frecuencia confirmó que lo que queda sin glosar son palabras comunes (se paró ahí a
  propósito: quirúrgico, no invasivo).
- **NUEVO `extractor/auditoria_total.py`** (auditoría profunda de coherencia, más allá de la estructural):
  placeholders reales, contradicciones tesis↔dividendos, tips duplicados/pobres, sectores rotos, P/E,
  términos vacíos. **Resultado final: 0 problemas serios, 55 avisos legítimos** (4 sin_documentos + ~24
  sin precio + 3 P/E fuera de rango explicados + yields>20% que la app avisa sola). El detector se afinó
  tras un primer run con falsos positivos ("dependiente"≠placeholder; "no reparte"≠afirmar que paga).
- **Auditoría estructural (`auditoria.py`): 0 problemas en las 113.** Navegador: consola LIMPIA, fichas
  (incl. tanda 10) renderizan con tips ricos y tooltips. Reparto sectores: minas 16, diversas ~30,
  alimentos 12, bancos ~11, eléctricas 12, AFP 4, fondos 4, resto igual.

## ⭐ TANDA 9 + SECTOR AFP + CONTEXTO (03-jul-2026, Opus) — **102 valores**
- **TANDA 9 (13, 89 → 102), las relevantes que faltaban** (pedido de Jair: "no líquidas pero
  dividendos bestiales"). El scan por liquidez las había saltado porque no negocian reciente
  (precio None), pero SÍ pagan dividendos y tienen estados SMV. **Bancos (+4):** Mibanco (microfinanzas
  #1 de LatAm, Credicorp 98.65%), BanBif (grupo Fierro/IFC), Banco Falabella (grupo Falabella, hermano
  de Saga/Inverfal), Banco Ripley. **Seguros:** Interseguro (líder rentas vitalicias ~30%, Intercorp)
  → diversas. **Eléctricas (+3):** Electroperú (la gran generadora estatal, Mantaro ~12% del país),
  Electro Dunas, San Gabán. **Diversas:** Los Portales (inmobiliaria grupo Raffo; ya NO tiene
  estacionamientos, los vendió a Apparka en 2023). **AFP (SECTOR NUEVO, +4):** Prima (Credicorp),
  Integra (#1, Sura), Profuturo (Scotiabank, ganó la licitación SBS = todos los afiliados nuevos
  hasta 2027), Habitat (la más chica y barata, chilena). Casi todas SIN precio (no negocian) → la
  ficha muestra fundamentos + dividendos, sin precio (honesto, Regla #1).
- **SECTOR "afp" integrado ENTERO** (como "fondos"): escenarios (movimiento+condiciones+notaSector,
  SIN rangoPE a propósito — no se leen por P/E), guía "cómo leer una AFP" (comisión, fondo administrado,
  afiliados, riesgo regulatorio, encaje), quiz (opción + sectorTip), ORDEN_SECTORES en Explorar/Resultados.
- **INSIGHT "retiros de AFP → la BVL cae" (pedido de Jair, VERIFICADO en prensa):** para pagar los
  retiros, las AFP (≈19% de su cartera son acciones) VENDEN, y como la bolsa es ilíquida tumban precios;
  Renta4 marcó mineras/eléctricas/constructoras como las más golpeadas. Se agregó como riesgo DOBLE en
  las 4 AFP (encoge el fondo del que cobran + las obliga a vender) y como aviso en las mineras grandes
  (BVN, Cerro Verde, Volcan, Minsur, Brocal): "presión temporal de mercado, NO cambio del negocio".
- **CONTEXTO extra con investigación web (pedido de Jair "que la gente se enganche"):** Quimpac (único
  productor integrado de SAL del Perú, ~400 mil ton/año), Electroperú (Mantaro prende ~1 de cada 8 focos
  del país), Mibanco (microfinanzas #1 de LatAm), Interseguro (líder rentas vitalicias), **Hidrostal
  (empresa PERUANA que INVENTÓ la bomba de tornillo helicoidal, patente 1961, hoy en +100 países; nació
  para bombear peces vivos en la pesca)**, Eternit (techos/tanques del Perú por +50 años; dejó el ASBESTO
  en 2017), y dato distintivo en cada AFP. Términos: 102 → 112 (AFP, retiro de AFP, SBS, rentas
  vitalicias, microfinanzas, banca de consumo, hidrología, habilitación urbana, encaje).
- **Auditoría: 0 problemas estructurales en las 102** (sector afp OK); 38 avisos (casi todos "sin precio"
  esperados + yields/PE conocidos). Verificado en navegador: Explorar "102 empresas" + chip AFP, ficha AFP
  con tooltips AFP/SBS + riesgo retiro, BVN con aviso de retiros.
- PENDIENTE (de Jair): agregar más contexto web al resto de empresas nuevas (Perubar, BanBif, Banco
  Falabella/Ripley, Mapfre, Pacífico, Pichincha, Proempresa, Inverfal, Futura, IDE, Electro Dunas, San
  Gabán) — se hicieron las de mejor gancho primero.

## ⭐ TANDA 8 + TOOLTIPS AMPLIADOS + PROPIEDAD (02-jul-2026, Opus) — **89 valores**
- **TANDA 8 (4, 85 → 89), nombres locales con estados SMV:** FPROEMP1 (Financiera Proempresa,
  microfinanzas SBS → bancos), INVFALC1 (Inverfal Perú, holding del grupo Falabella, `esHolding`
  → diversas), FUTURAI1 (Futura Consorcio Inmobiliario) e IIDEI1 (Inmobiliaria IDE) → diversas.
  Todas ilíquidas, datos SMV/BVL/EPS confirmados, con tesis/tips/catalizadores/escenarios.
  Dividendos verificados: Inverfal paga ~4.6% (holding, US$), Inmob. IDE ~13% regular, Futura
  algunos años (S/0.22 en 2025), Proempresa nada desde 2020. FPROEMP1 P/E 94 es REAL (2025 flojo,
  Q1 2026 repuntó) — explicado en tip/catalizador. Auditoría: 0 problemas estructurales, 14 avisos
  conocidos. condicionesEmpresa 11 → 15.
- **TOOLTIPS (Glosado) AMPLIADOS — pedido de Jair ("la gente que abre por primera vez se espanta"):**
  (a) **AHORA pasan por `Glosado` TODOS los textos de la ficha, arriba y abajo** (pedido de Jair
  "no dejes nada"): tesis, tips, intro de la guía, escenarios, riesgos y el fallback de catalizadores
  (antes esos NO tenían tooltip). Fundamentos/balance/guía-métricas/catalizadores ya lo tenían.
  (b) **`terminos.json` 57 → 102 términos** (+45): holding, resultado/utilidad operativa, cíclico,
  siniestralidad, primas, junior, ETF, FIBRA, penny stock, dividendo extraordinario, polimetálica,
  autoconstrucción, acción de inversión, patrimonio negativo, refinanciar, apalancamiento,
  desapalancar, antidumping, provisión/provisionar/sin provisionar, **streaming** + **step-down**
  (contrato de Nexa), free float, flotante, ramp-up, CET1, subsidiaria, filial, matriz, y los de
  CONTEXTO que pidió Jair: **cascarón bursátil**, **Bayóvar**, **fosfatos**, **SUNAT**,
  **controversia tributaria**, reparo, contingencia. (c) **Contexto específico añadido**: el caso
  SUNAT de BVN (controversia por ventas de oro 2007-2010, ya pagó ~S/2,134M — CONFIRMADO por prensa,
  contrastado con Nexa cuyo caso sigue abierto US$164M sin provisionar). Todo automático: cualquier
  término nuevo aparece solo. Verificado en vivo (Nexa 77, Inverfal 70, FOSSAL 81 con cascarón/Bayóvar,
  BVN 75 con SUNAT). PENDIENTE opcional: bloque dedicado de "Contratos" (vigentes/terminados) por empresa.
- **PROPIEDAD ENTRE EMPRESAS — investigado (de tus INFORMES + web), reporte pasado a Jair, PENDIENTE
  su OK para implementar.** Dos modelos: 💵 A vía dividendos (Cerro Verde/Brocal→BVN; BCP/Pacífico→
  Credicorp) vs 🔄 B aporte directo/intercompañía (Atacocha→Nexa; Corona presta US$66M a Sierra
  Metals; Backus presta S/910M a AB InBev). Relaciones DENTRO de la app (mostrar % en ambos lados):
  NEXAPEC1→ATACOBC1 (62.89% B/99.36% A), BVN→CVERDEC1 (19.58%) y →BROCALC1 (61.43%), BAP→CREDITC1
  (97.69%) →PACIFIC1 (~96-98%) →CRECAPC1, IFS→INTERBC1 (99%), BACKUSI1→SNJUANI1 (97.03%),
  INVFALC1→SAGAC1 (98.79%), SCCO→SPCCPI1 (sucursal 100%). No listadas: MINSURI1→Marcobre/Mina Justa
  (60%), BVN→Yanacocha/Coimolache. Diseño propuesto: `relaciones.json` + bloque "🧬 Familia
  empresarial" bidireccional en la ficha (link si la otra está en la app; texto si no).
- **Correcciones de propiedad aplicadas a tesis (confirmadas por informes de Jair + web):**
  Atacocha la controla Nexa 62.89% B/99.36% A y NO reparte dividendos (BVL/stockanalysis = 0 —
  Jair creía que pagaba; no hay registro); Cerro Verde Freeport **55.08%** (no 53.6%), Sumitomo 21%,
  BVN 19.58% (socia minoritaria); Brocal BVN 61.43% (58.9% del dividendo va a BVN). Volcan ya estaba
  bien (grupo Integra/Transition Metals, no Glencore desde 2024).
- **BUG arreglado en `auditoria.py`** (de la tanda 7): `sys.stdout.reconfigure(utf-8)` para no
  crashear con emojis en consola Windows cuando el robot la llama sin `-X utf8`.

## ⭐ TANDA 7 (02-jul-2026, Opus) — **85 valores** (78 → 85)
- **7 nuevas, "un poco de todo" (pedido de Jair: aprender a hacer tesis + escenarios):**
  aseguradoras **MAPFSGC1** (Mapfre Perú) y **PACIFIC1** (Pacífico, del grupo Credicorp) →
  sector diversas; **BPICHPC1** (Banco Pichincha, grupo ecuatoriano) → bancos ahora 5;
  industriales **QUIMPAI1** (Quimpac, químicos, acción de inversión), **HIDROSI1** (Hidrostal,
  bombas), **ETERNII1** (Eternit, fibrocemento) → diversas; **PERUBAI1** (Perubar, zinc/plomo
  de Glencore) → minas 11. Todas MUY ilíquidas (última negociación 2025/ppos-2026); la app ya
  avisa `sinNegociacionReciente`. NO se metieron las azucareras en crisis (Tumán/Andahuasi/Cayaltí)
  — decisión de Jair. El resto del mercado local líquido YA estaba agotado (verificado en vivo:
  lo que queda sin tener son ETFs/acciones extranjeras del segmento RV3).
- **Datos 7/7 CONFIRMADOS** (fuente oficial, cero inventado): fundamentos SMV Q1 2026 (`run_uno.py`),
  precios/históricos/hechos BVL, dividendos (stockanalysis + `fetch_beneficios`), EPS anual + P/E.
  Highlights: Pacífico EPS anual S/4.275 (P/E ~9.7, payout 91%, paga S/2.73 may-2026); Mapfre paga
  ~1.9%; **Quimpac paga US$0.0397 pero su yield sale 26.61%** → la app dispara sola el aviso de
  "rendimiento extraordinario / precio desactualizado" (yield>20%); B. Pichincha con **EPS anual
  2025 NEGATIVO** (−0.041, el P/E se oculta) aunque el Q1 2026 quedó apenas en azul; Eternit y
  Hidrostal SIN deuda; Perubar rentable pero con caja finísima (US$224 mil).
- **Tesis + 5 tips + catalizadores + escenarios por-empresa (`condicionesEmpresa`) escritos para las 7**,
  anclados a los números reales y con honestidad dura. Aseguradoras se leen como Rímac/Positiva
  (primas/siniestralidad, no "ventas"); Pichincha como banco (no por P/E). `condicionesEmpresa`
  pasó de 4 → 11 (las 4 previas + las 7 nuevas).
- **Nota de datos:** Mapfre y Pacífico caen al parser HTML de entidades reguladas SBS (igual que
  Rímac/Positiva): margen/deuda/FCF salen null con la nota estándar — consistente, esperado.
- **BUG ARREGLADO en `auditoria.py`**: crasheaba con UnicodeEncodeError al imprimir los emojis
  (✅❌⚠️) en la consola cp1252 de Windows cuando el robot la llama sin `-X utf8` (el audit YA
  había pasado, moría solo al reportar). Se fuerza `sys.stdout.reconfigure(encoding="utf-8")`.
- **Auditoría al cierre: 0 problemas estructurales, 13 avisos legítimos** (sin_documentos esperados
  de AUNA/SCCO/PML/Pucalá + yields extraordinarios reales, incl. Quimpac 26.61%). App verificada en
  el navegador: fichas de Pacífico y Quimpac renderizan tesis, precio (marcado viejo), sparkline,
  termómetro "poco negociada" y el aviso de yield alto. Reparto de sectores: minas 11, diversas 12,
  alimentos 8, eléctricas 5, bancos 5, fondos 4, acereras/cemento/retail/textil 3, pesqueras 2.

## ⭐ PASE PREMIUM (01-jul-2026, Fable) — qué se agregó
- **Precios históricos REALES de la BVL (el pendiente grande, RESUELTO):** endpoint oficial
  `GET dataondemand.bvl.com.pe/v1/stock-quote/share-values/<NEM>?startDate=&endDate=` (receta
  completa en `extractor/FUENTES.md`). Nuevo script `extractor/fetch_historicos.py` →
  `historicos.json` (~12 meses de cierres diarios por empresa, 48/48 OK). **Sumarlo al robot diario.**
  Quirks manejados: la BVL rellena días sin negociar repitiendo el cierre y manda 0.0 sin
  cotización (se filtran); si la acción cambia de precio <35% de los días → `pocoNegociada: true`.
- **Sparkline** (`Sparkline.jsx`): gráfico dorado del precio en la ficha (3M/6M/1A, % del
  período, mín/máx, fechas, fuente BVL). Aviso honesto en ilíquidas ("la línea se queda plana…").
  Modo `compacto` para el comparador.
- **Termómetro de volatilidad** (`Termometro.jsx`): volatilidad anualizada REAL calculada de los
  cierres (en el extractor): tranquila <22% / se mueve / montaña rusa ≥45%. Si es ilíquida dice
  **"poco negociada"** SIN número (sería engañoso) y explica el riesgo de liquidez. Educativo,
  no predice.
- **Explorador** (`Explorar.jsx`, vista propia en el nav): buscador (sin tildes), chips por
  sector, filtros "paga dividendos" / "negocia seguido", orden (sector/A-Z/yield), badges de
  yield e iliquidez, y selección de 2 empresas → barra flotante → **Comparador**.
- **Comparador** (`Comparador.jsx`): 2 empresas frente a frente (precio+fecha, P/E, dividendo,
  yield, deuda, FCF, margen, EPS, volatilidad, rango 52s) + 2 sparklines compactos. Sin
  veredicto (educa, no recomienda). P/E numérico compartido en `lib/finanzas.js`.
- **PWA instalable**: vite-plugin-pwa (autoUpdate), manifest negro/dorado, íconos generados del
  logo en `app/public/iconos/` (192/512/maskable/apple 180), metas en index.html. Funciona
  offline con lo precacheado (~1 MB). `npm run build` genera `sw.js` solo.
- **Micro-animaciones** (`lib/anim.jsx`, sin dependencias — CSS + hooks): fade-up entre vistas,
  reveal al hacer scroll (`<Reveal>`), precio que cuenta hacia arriba (`<CountUp>`), línea del
  sparkline que se dibuja, transición entre preguntas del quiz. TODO respeta
  `prefers-reduced-motion`.
- **Reveal del quiz**: pantalla "Leyendo tus respuestas…" (1.5 s, anillo dorado) → el perfil
  hace "pop" → resultados en cascada.
- **Móvil**: topbar envuelve (el nav creció), sin desborde horizontal (verificado 375px).
- ✅ Resuelto (1-jul-2026): **NEXAPEC1 tenía fundamentos vacíos** en `empresas.json` — la causa
  fue un `ReadTimeout` puntual del portal SMV en el run del 30-jun (los 3 reintentos toparon con
  timeout), NO un cambio de formato XBRL. Se creó `extractor/run_uno.py <TICKER>` que re-extrae
  UNA sola empresa y parcha su entrada en `empresas.json` + `salida_smv.json` sin re-descargar
  las 48. Nexa regenerada OK (USD, deuda US$29.5M, margen bruto 57.1% — cuadra con la tesis).
  Único fallo restante: AUNA con `sin_documentos` (la SMV no publica su XBRL individual Q1 2026).

## ⭐ AUDITORÍA GENERAL + CORRECCIONES (02-jul-2026, Fable) — pedido de Jair
- **Moneda de dividendos CORREGIDA en 14 empresas** (hallazgo de Jair: "Nexa paga en dólares"):
  stockanalysis CONVIERTE el dividendo a la moneda de cotización; la BVL trae la moneda REAL
  (`coin`). `fetch_beneficios.py` ahora además de llenar vacíos **reconstruye la entrada si la
  moneda difiere**: Nexa, Aceros, Exalmar, Minsur, Brocal, Engie, Poderosa, El Comercio, Tradi,
  Peruana de Energía, Cervesur, Hermes, INDECO, Andex → todos declaran en US$.
  Validado: Hermes US$0.8252 (BVL) = "2.83214 PEN" (stockanalysis) al TC ✓. El yield se
  convierte con el TC cuando la moneda difiere del precio; DividendoSimulador ya convertía bien.
- **REGRESIÓN detectada y cerrada para siempre**: re-correr `fetch_anual_eps` PISABA las
  correcciones manuales de EPS del 26-jun (Minsur volvió a P/E 0.1, InRetail a 102.7).
  Nuevo `extractor/fix_eps.py`: parcha eps_anual.json con el EPS ttm implícito de stockanalysis
  (Previous Close ÷ PE) para la lista TICKERS (Minsur 7.5, Backus 9.6, InRetail 14.4, IFS 11.5,
  Volcan 3.9, Corona 4.7, + BAP 14.8 y Cervesur 3.4). **Correr SIEMPRE después de fetch_anual_eps.**
- **Nuevo `extractor/auditoria.py`**: chequea presencia (fichas/datos 78/78), sectores completos
  (quiz/guias/escenarios), monedas dividendo vs BVL, P/E y yields fuera de rango. Hoy: 0 problemas
  estructurales, 12 avisos legítimos (4 sin_documentos esperados + yields extraordinarios reales).
- **PERENBC1 explicado**: su P/E 2.0 + dividendos de US$ 3.62/acción en 12m (yield 66%) = ganancia
  extraordinaria 2025 repartida; tesis/tips reescritos. La app ahora muestra un **aviso automático**
  cuando el yield >20%: "casi siempre viene de un pago EXTRAORDINARIO… no asumas que se repite".
- **Nuevo `extractor/actualizar_todo.py`** (para el Q2 en ~1.5-2 meses): UN comando corre todo en
  orden (secuencial — la SMV se atora en paralelo): `--trimestral` agrega run_batch (tras cambiar
  "trimestre" en el config); `--con-build` regenera la PWA. Termina con la auditoría.

## ⭐ TANDA 6 + DIVIDENDOS BVL "BENEFICIOS" (02-jul-2026, Fable) — **78 valores**
- **67 → 78.** Tanda 6 (11, los conocidos que negocian poco — ventana 30-120 días):
  SAGAC1 (Saga Falabella, P/E ~4.8 pero deuda S/517M y FCF -87M — tesis honesta),
  POSITIC1 (La Positiva), HERMESC1 (blindados, margen 26%, deuda S/572M), INDECOI1
  (cables Nexans, USD), GBVLAC1 (¡la propia Bolsa/nuam!), CRECAPC1, COCESUI1 (holding
  arequipeño), CONCESI1 (holding Yura/Gloria), FOSSALC1 (cascarón de fosfatos Bayóvar,
  osciló 0.76→2.40), ANDEXBC1 (junior local, 0.18→0.90), PUCALAC1 (Agro Pucalá,
  **sin_documentos** — no presentó Q1 a la SMV; tesis centrada en gobernanza).
  Holdings marcados: CONCESI1, COCESUI1, FOSSALC1, CRECAPC1, GBVLAC1. COLCA no está en SMV → fuera.
- **DIVIDENDOS DESDE LA BVL (pedido de Jair: "FIBPRIME da bastantes y salía que no"):**
  el mismo `GET /v1/issuers` trae `listValue[].listBenefit` = historial COMPLETO de
  beneficios por valor (benefitType DE = efectivo, con benefitValue + coin + fechas
  acuerdo/corte/registro/ENTREGA). Nuevo `extractor/fetch_beneficios.py`: corre DESPUÉS de
  div_stockanalysis y PARCHA dividendos.json solo donde stockanalysis no llega (nunca pisa).
  Resultado: **FIBPRIME 47 pagos, yield 8.71%, MENSUAL**; FIBCCAP 7.0% trimestral; y
  Volcan/Aenza/Morococha/Integratel/Centenario ganaron su historial antiguo (0 reciente, honesto).
- Robot diario queda: fetch_precios → fetch_historicos → fetch_hechos → div_stockanalysis →
  **fetch_beneficios** → fetch_anual_eps → build. (eps_anual falló una vez en silencio
  cuando corría en paralelo con run_uno contra la SMV — correr secuencial.)

## ⭐ TANDA 5: SECTOR "FONDOS" + GIGANTES EXTRANJEROS (02-jul-2026, Fable) — 67 empresas
- **59 → 67.** Sector NUEVO **"fondos"** (4): FIBPRIME (FIBRA Prime, Grupo Coril, rpj T00002),
  FIBCCAP (Fibra Credicorp Capital, T00003), ETFPERUD (ETF Van Eck acciones Perú, BVL029),
  ETFPESOV (ETF bonos soberanos, BVL038). + **BAP** (Credicorp Ltd., bancos, esHolding — ¡SÍ
  publica XBRL individual a la SMV!, activos S/ 44,496M), **SCCO** (Southern Copper matriz,
  minas, sin_documentos como AUNA), **PML** (Panoro, minera JUNIOR, solo apuesta,
  sin_documentos), **ENPACII1** (Energía del Pacífico, eléctricas, USD, EPS Q1 = 0.0000).
- Sector "fondos" integrado ENTERO: quiz (opción nueva en la pregunta de sector + sectorTip),
  guias.json (cómo leer un fondo: canasta/TER/rentas/tasas/liquidez), escenarios.json
  (movimiento + condiciones + notaSector; **SIN rangoPE a propósito** — Valoracion se oculta
  sola, el P/E de empresa no aplica a fondos), ORDEN_SECTORES en Explorar.jsx y Resultados.jsx.
- FIBRAs/ETFs no están en el catálogo SMV ni en stockanalysis (los 4 con entrada manual
  en empresas.json motivo "no_aplica_es_fondo"); sus distribuciones se ven por los HI 📰.
  stockanalysis cubre BAP/SCCO/PML/ETFs (6/8).
- Corrección Regla #6: los tips de ENPACII1 se escribieron antes del dato y decían "pérdida
  ligera"; el dato real es EPS US$ 0.0000 → corregidos tips/tesis/catalizadores.

## ⭐ TANDA 4 + HECHOS DE IMPORTANCIA EN LA FICHA (02-jul-2026, Fable)
- **59 empresas** (48 → 59). Tanda 4 (11): SEALDC1 (SEAL Arequipa), PERENBC1, EGEPIBC1
  (Enel Piura) en eléctricas; LUISAI1 (Santa Luisa/Mitsui), MOROCOI1 (SIMSA) en minas;
  SNJACIC1 (San Jacinto/Gloria), LAREDOC1 (Laredo/Manuelita) en alimentos; ETNAI1 (baterías),
  INTPEBC1 (Integratel ex-Telefónica), INVCENC1 (Centenario), AIHC1 (Andino, holding) en
  diversas. **RECORD S.A. se EXCLUYÓ: está EN LIQUIDACIÓN según la SMV.** ENPACII1 excluida
  (centavo sin negociación). Selección = todo lo local que negoció en 30 días (análisis del
  mercado completo BVL, 756 valores: el resto son ETFs/extranjeras/fondos/clases duplicadas).
- Datos completos 11/11: SMV Q1 (run_uno.py), precios, dividendos, EPS anual, históricos,
  tesis/tips/catalizadores escritos (anclados en números reales + perfiles stockanalysis;
  PERENBC1 no está en stockanalysis). Honestidad dura donde toca: MOROCOI1 e INTPEBC1 tienen
  PATRIMONIO NEGATIVO y sus tesis lo dicen sin filtro. ⚠️ PERENBC1 P/E 2.0 (EPS anual 9.04)
  huele a ganancia extraordinaria 2025 — revisar con criterio de Jair.
- **HI por empresa DESCIFRADO (API BVL, mejor que el portal SMV):**
  `GET /v1/issuers` → rpjCode de cada emisor (mapeados los 59 en empresas_config.json campo
  `bvlRpj`); `POST /v1/corporate-actions {rpjCode,page,size,search:"",startDate,endDate}` →
  historial COMPLETO de HI con PDF (documents.bvl.com.pe). Descubierto interceptando el XHR
  de la página de emisores con Chrome. Nuevo `extractor/fetch_hechos.py` → `hechos.json`
  (últimos 12 meses por ticker, 59/59 OK). El `hechos_importancia.py` del SMV queda de respaldo.
- **📰 Nueva sección en la ficha:** "Hechos de Importancia (comunicados oficiales)" —
  últimos 5 con fecha/categoría/link al PDF + "ver los N del último año". Pendiente #4 del
  handoff RESUELTO (y sin esperar acumulación: ya hay historial).
- Pendiente de la tanda 4: escenarios por-empresa, afinar perfiles/criterio de Jair.

## ⭐ ACTUALIZACIÓN 2 (01-jul-2026, Fable) — "full libertad"
- **Rutas por hash** (`App.jsx`): cada vista tiene URL propia (`#/empresa/BVN`, `#/explorar`,
  `#/comparar/A/B`, `#/glosario`, `#/quiz`). Links directos compartibles, botón atrás del
  navegador/celular funciona, scroll-arriba al cambiar de vista. El hash es la fuente de verdad.
- **📊 "Así cerró la BVL"** (`HoyBVL.jsx`, en inicio): top 3 subieron / top 3 bajaron del último
  cierre vs el previo (precios.json ya traía `previo`), + conteo subieron/bajaron/sin cambio.
  Excluye las `sinNegociacionReciente` (su variación sería vieja). Nota educativa "un día no
  hace tendencia". Se actualiza solo con el robot diario.
- **⭐ Favoritos "Mi lista para estudiar"** (`lib/favoritos.js`, localStorage, sin cuentas):
  botón ★ en la ficha y en cada fila del Explorador, chip-filtro "★ Mi lista (n)" en Explorar,
  y strip de chips en el inicio (`MiLista.jsx`). Sobrevive reinicios; privado del usuario.
- **🎯 Empresa del día** (`EmpresaDelDia.jsx`, en inicio): rotación DETERMINÍSTICA por fecha
  (mismo día = misma empresa para todos), con tesis y botón "Estudiarla". Invita a descubrir.
- **Rango de 12 meses** (dentro de `Sparkline.jsx`): barra dorada con marcador de dónde está el
  precio actual entre su mín y máx del año ("está al 52% del camino…"). Cierres reales BVL.
- **↗ Compartir** en la ficha: Web Share API en el celular; en escritorio copia el link
  `#/empresa/TICKER` al portapapeles ("✓ Link copiado").
- **Buscador en el Glosario**: filtra términos por nombre o definición (sin tildes), muestra
  resultados planos con su rama y el ejemplo abierto.
- Verificado: consola limpia, build de producción OK (PWA regenerada), flujos probados
  (favorito → inicio → filtro, link directo, history.back, glosario).
- **Precio de la acción el día de cada dividendo del año pasado** (pedido de Jair, 01-jul):
  `fetch_historicos.py` ahora baja desde el **1 de enero del año pasado** (~18 meses; la
  volatilidad/rango 52s/liquidez se siguen midiendo SOLO con los últimos 12). Nuevo helper
  `precioEnFecha()` en `lib/finanzas.js` (cierre real ≤14 días antes de la fecha, si no → null).
  `DividendoResumen` muestra bajo cada pago del año pasado: "la acción costaba S/ X ese día".
  Años sin histórico (2024 y antes) no muestran nada — Regla #1. El cuadro de comparación
  ahora hace pop "✓ ¡Listas para comparar!" y abre el comparador solo (máx. 2, avisado).
- **Fondo vivo** (`FondoVivo.jsx` + `.aurora` en CSS, a pedido de Jair, iterado 3 veces):
  "polvo dorado" en canvas (**260** partículas escritorio / 110 celular) que parpadea, deriva
  hacia arriba y SE ENCIENDE + se aparta cerca del cursor (dorado claro, más grandes), luz
  que sigue el mouse (halo 300px), aurora dorada que respira (2 gradientes animados solo con
  transform → GPU), y **FLECHAS DE ÍNDICE BURSÁTIL** (iterado 02-jul a pedido de Jair,
  estilo la flecha del logo): zigzag con tramos de avance (0.3–0.75 s) y retrocesos cortos
  (0.1–0.26 s) como un chart real, con PUNTA DE FLECHA orientada en la cabeza — DORADAS
  (#d4af37, la marca) las que suben / rojas tenues las que bajan; hasta 8 a la vez en
  escritorio / 4 en celular (~30% pasan rápidas), cola que se desvanece.
  Eficiente: pausa total cuando la pestaña está oculta (visibilitychange + Chrome congela
  rAF), tope de devicePixelRatio 2, y se APAGA entero con prefers-reduced-motion.

---

## 1. Qué es
App web **educativa** de la Bolsa de Valores de Lima (BVL). El usuario hace un quiz
(perfil × sector) y descubre **empresas para estudiar** — NO se recomienda comprar.
Producto = credibilidad. Negro y dorado (#D4AF37). Logo en `app/public/logo-alto.jpg`.
Visión y filosofía completas en `ALTO_PROYECTO_COMPLETO.md`.

## 2. Arquitectura
- **`app/`** — frontend React + Vite (estático). Correr: `npm --prefix app run dev` (puerto 5173).
  Build: `npm --prefix app run build`. Node se instaló con winget.
- **`extractor/`** — scripts Python que bajan datos de la SMV/BVL/stockanalysis y generan
  los JSON que consume la app. Librerías: requests, beautifulsoup4, lxml, pypdf.
- **`INFORMES REALIZADOS ALTO RESEARCH/`** (en el Escritorio) — informes PDF propios de Jair
  (NEXA, BVN, Cerro Verde, etc.) + DATOS_VERIFICADOS.md. Base de las tesis y catalizadores.

## 3. Las 9 Reglas de Oro (innegociables)
1. Cero datos inventados (lo que falta queda vacío/"pendiente"). 2. Jerarquía de fuentes.
3. EPS en moneda original. 4. Estados INDIVIDUALES SMV. 5. Lenguaje simple. 6. Verificar
contra la fuente. 7. No mezclar rumor con hecho. 8. Nunca prometer rendimientos.
9. La app educa, NO recomienda. (Detalle en `ALTO_PROYECTO_COMPLETO.md` Parte F.)

## 4. Las 48 empresas (17 → 32 → 47 → +Scotiabank, por liquidez real BVL)
> **+SCOTIAC1 (Scotiabank Perú, banco, smvId 40)** agregado el 30-jun a pedido: bancos ahora son 4.
> Ilíquido (último cierre 01/06); ficha completa con tesis/tips/catalizadores.
> **Tanda 3 (47, 30-jun-2026):** +4 minas (Poderosa, Southern Sucursal, Corona, Atacocha),
> +2 alimentos (Cartavio, Pomalca — azúcar), +2 eléctricas (Hidrandina, Pluz), y sector NUEVO
> **diversas** (7): GR Holding*, AUNA, Bosques Amazónicos, Inv. Portuarias Chancay* (megapuerto),
> Rímac Seguros, El Comercio, Tradi. (`*`=holding). Reparto actual: minas 10, alimentos 8, diversas 7,
> eléctricas 5, bancos/textil/acereras/cemento/retail 3, pesqueras 2.
> Notas: **AUNA** no presenta EE.FF. individuales a la SMV (cotiza en NYSE) → ficha con fundamentos
> pendientes (solo precio). **Corona** EPS corregido con stockanalysis (extractor sacó 0). **Bosques**
> margen "no representativo" (ingresos casi nulos → run_batch ahora suprime |margen|>300%). Varias de la
> tanda 3 son MUY ilíquidas (la app avisa "sin negociación reciente"). Se eliminó la sección "Histórico
> trimestral" de la ficha.
> **Tesis, tips y catalizadores de las 15 YA escritos** (30-jun), nutridos de los perfiles de
> stockanalysis (vía requests) + datos Q1. Catalizadores = resultados 2T + dividendos reales (que son
> Hechos de Importancia) + drivers documentados (ej. Poderosa: seguridad en Pataz; Chancay: ramp-up del
> megapuerto; Pluz: revisión tarifaria VAD).
> **Hechos de Importancia de la SMV — DESCIFRADO (30-jun):** portal `/SIMV/` → "Hechos de importancia
> general" (`Frm_hechosdeImportanciaAll`). Usa token de sesión que expira (se saca fresco de /SIMV/) y es
> un formulario ASP.NET de DOS POSTBACKS. Se maneja con **requests** (Chrome NO hace falta). Ya hay un
> extractor: `extractor/hechos_importancia.py` → `hechos_importancia.json`. FUNCIONA (probado: HI real de
> El Comercio, "Acuerdo de Junta de subsidiaria" 30-jun). Diseño: el buscador solo da los HI del DÍA (el
> filtro de fechas del form ASP.NET no aplica y no hay paginación), así que el script ACUMULA por empresa
> con dedup por N° de expediente → corriéndolo A DIARIO (junto al robot de precios) arma el historial solo.
> Pendiente: (a) sumar este script al robot diario cuando se publique; (b) opcional, mostrar los HI en la
> ficha (hoy el JSON casi vacío, esperar a que acumule). Receta en `extractor/FUENTES.md`.

### Las 32 empresas (ampliado de 17 → 32 el 26-jun-2026, por liquidez real BVL)
- **Minas (6):** NEXAPEC1, BVN, CVERDEC1, **VOLCABC1, MINSURI1, BROCALC1**
- **Bancos (3):** BBVAC1, CREDITC1(=BCP), INTERBC1
- **Alimentos y Bebidas (6):** ALICORC1, GLORIAI1, LAIVEBC1, **BACKUSI1, SNJUANI1, CASAGRC1**
- **Textil (3):** CRETEXC1, MICHEI1, FILAMEI1
- **Acereras (3):** CORAREI1, SIDERC1, SHPC1(Shougang, es minera de hierro)
- **Pesqueras (2):** AUSTRAC1, EXALMC1 (solo 2 cotizan en Mercado Principal)
- **Eléctricas (NUEVO, 3):** LUSURC1, ENGIEC1, ORYGENC1
- **Cemento/Construcción (NUEVO, 3):** CPACASC1, UNACEMC1*, FERREYC1*
- **Retail/Holdings (NUEVO, 3):** INRETC1*, IFS*, AENZAC1
- `*` = **HOLDING** (esHolding=true en config): su estado individual SMV son dividendos de
  subsidiarias, NO ventas. run_batch oculta el margen distorsionado y lo reemplaza por nota.
- Selección por liquidez: se descartó meter más a textil/acereras/pesqueras (no hay 3 líquidas más).
- Config: `extractor/empresas_config.json` (smvId, bvlNemonico, perfiles, monedaForzada, esHolding).
- **Pendiente de las 15 nuevas:** escenarios por-empresa (condicionesEmpresa) y revisar perfiles
  tentativos. Tesis, catalizadores y TIPS ya escritos. Tips enriquecidos con stockanalysis (perfiles de
  empresa, vía Chrome para Orygen/Casa Grande + requests para el resto): hallazgos como que Volcan tiene
  puerto y generación eléctrica, Minsur también hace cemento, UNACEM genera electricidad, Casa Grande
  cultiva uva/arándano, San Juan es filial directa de AB InBev.
- **Resumen de dividendos (DividendoResumen) rehecho (26-jun):** muestra los pagos INDIVIDUALES con su
  fecha (estilo stockanalysis, NO sumados), marca los del año en curso con "● este año", y una nota
  dinámica "este año ya pagó N veces; el año pasado pagó M veces — veremos si mantiene el ritmo". Usa
  el campo 'historial' de dividendos.json (ya existía).
- **Mini-gráfica de dividendos (DividendoGrafico.jsx, 26-jun):** A LADO de la lista de pagos, versión
  LIMPIA: solo 2 barras (2025 vs 2026) con el dividendo de cada año, nº de pagos, el precio de la acción
  HOY y el yield. 2026 va punteado ("en curso"). Muestra "▲ subió +X%" SOLO si 2026 ya superó a todo
  2025 (honesto: no inventa una caída por un año a medias). Idea de Jair (para enganchar).
  LIMITACIÓN: el precio de la acción en la FECHA de cada pago histórico no está en nuestras fuentes
  (el API de historial de stockanalysis da 500 para tickers BVL; la tabla de dividendos solo trae
  fecha+monto). Por eso se muestra el precio de HOY, no el del día del pago 2025.

## 5. Datos de la app (`app/src/data/`) — todos editables por Jair
| Archivo | Qué tiene | Lo genera |
|---|---|---|
| `empresas.json` | Fundamentos SMV Q1 2026 (deuda, FCF, EPS, capex, margen, balance) | `run_batch.py` |
| `precios.json` | Precio de cierre del día anterior (BVL) | `fetch_precios.py` |
| `historicos.json` | Cierres diarios ~12 meses + volatilidad real + pocoNegociada (BVL) | `fetch_historicos.py` |
| `dividendos.json` | Dividendos por año, yield, payout (stockanalysis) | `div_stockanalysis.py` |
| `eps_anual.json` | Ganancia anual 2025 + tipo de cambio USD/PEN (para P/E) | `fetch_anual_eps.py` |
| `escenarios.json` | Movimiento % por sector, condiciones bien/regular/mal, rangos P/E y EV/EBITDA | manual |
| `tesis.json` | Tesis honesta de 1 línea por empresa | manual |
| `tips.json` | 5 tips por empresa | manual |
| `catalizadores.json` | Eventos que vienen (documentado/rumor) | manual |
| `guias.json` | "Cómo leer estos números" por sector (profundo) | manual |
| `terminos.json` | Diccionario para tooltips (hover) | manual |
| `glosario.json` | Glosario en árbol | manual |
| `quiz.json` | Preguntas, perfiles, sectores, sectorTips | manual |
| `pildoras.json` | "¿Sabías que?" | manual |
| `config.json` | Marca, apoyo (Yape/PayPal), **mensajeDia** (Jair edita cada día) | manual |

## 6. Funciones de la app (qué ve el usuario)
- **Inicio:** logo, mensaje del día (editable), píldora "¿Sabías que?", botones (quiz / glosario
  / empresa al azar), disclaimer, botón flotante de apoyo.
- **Quiz:** 4 preguntas con descripción en cada opción + tip rotativo por pregunta. Botón
  "empresa al azar".
- **Resultados:** perfil × sector → empresas que coinciden + "explora todas" (con tip y precio).
- **Ficha de empresa (orden actual):**
  1. Cabecera (ticker, precio de cierre día anterior, badges)
  2. **Tesis** honesta
  3. **Resumen de dividendos** (paga?, 2025, 2026, posible pendiente)
  4. **¿Barata o cara?** (P/E + EV/EBITDA con fórmula, vs rango del sector, aviso de "P/E engaña" en cíclicos)
  5. **Dos simuladores lado a lado:** "¿Qué pasaría si invierto?" (precio: bien/regular/mal con
     condiciones) y "Simulador de dividendos" (en S/ y US$)
  6. Tips para estudiarla
  7. Fundamentos (SMV): deuda, FCF, EPS, margen
  8. Guía "Cómo leer estos números" (siempre abierta, con el dato real de la empresa por fila)
  9. Balance, Catalizadores (⚡), Fuentes
- **Tooltips:** cualquier palabra técnica se explica al pasar el cursor (Glosado + terminos.json).
- **Apoyo:** modal con QR de Yape (Jair Ulises Aguilar Parco) + PayPal (jair_aguilarp@hotmail.com).
- **Glosario** en árbol.

## 7. Cómo se actualizan los datos
- **Estados financieros (Q1 2026):** cuando salga el Q2, cambiar `trimestre` en
  `empresas_config.json` y correr `python extractor/run_batch.py`.
- **Precio:** `python extractor/fetch_precios.py` (cada día tras el cierre).
- **Histórico + volatilidad:** `python extractor/fetch_historicos.py` (cada día, junto al precio).
- **Dividendos:** `python extractor/div_stockanalysis.py`.
- **P/E (ganancia anual + tipo de cambio):** `python extractor/fetch_anual_eps.py`.
- Verificar todo: `python extractor/verify_all.py`.

## 8. Fuentes de datos (ver `extractor/FUENTES.md`, guardar SIEMPRE los enlaces)
- SMV estados: https://www.smv.gob.pe/SIMV/Frm_InformacionFinanciera
- BVL precios: `POST https://dataondemand.bvl.com.pe/v1/stock-quote/market`
- **Dividendos (principal): stockanalysis.com/quote/bvl/<NEM>/dividend/** (el overview tiene P/E real)
- BVL dividendos (respaldo, omite pagos): entrder1.htm y pubdif/infmen/202512e4.htm
- Tipo de cambio: open.er-api.com/v6/latest/USD

## 9. Hallazgos importantes (no olvidar)
- **Alicorp:** la SMV etiqueta su XBRL en USD por ERROR; es SOLES (forzado en config). Verificado
  contra estados separados auditados.
- **EPS:** sí está en el XBRL (BasicEarningsLossPerShare, contexto dimensional por clase de acción).
- **Bancos:** no presentan XBRL (se usa la página de detalle HTML); no tienen FCF/capex.
- **Dividendos:** la BVL se salta pagos (Michell ene-2026, Cerro Verde). stockanalysis es completo.
- **Rangos P/E calibrados** con stockanalysis (jun 2026): minas 9–15, bancos 7–12, alimentos 9–14,
  eléctricas 8–15, cemento 9–16, retail 9–16.
- **Monedas:** mineras y Exalmar reportan/cotizan en US$; el resto en S/.
- **BUG DE PRECIOS CORREGIDO (26-jun-2026):** `fetch_precios.py` usaba `sell` (orden de venta/ask)
  como "cierre". Lo correcto es `last` (precio realmente transado) con `lastDate`. Ej. BVN mostraba
  31.55 (ask) en vez de 30.31 (cierre real). Ahora usa last y cae a previous+previousDate si no negoció.
- **EPS distorsionados por clase de acción/moneda:** Minsur, Backus, InRetail, IFS y Volcan daban
  P/E absurdos (ej. Minsur 0.1). Se corrigieron en `eps_anual.json` con el EPS ttm real de
  stockanalysis (P/E: Minsur 7.2, Backus 9.7, InRetail 14.0, IFS 10.4, Volcan 3.7).
- **HOLDINGS (InRetail, IFS, UNACEM Corp, Ferreycorp):** el estado individual SMV NO refleja el
  negocio (son dividendos de subsidiarias; margen sale ~100%+). La Regla #4 "individuales" se pensó
  para operativas. Solución: esHolding en config → run_batch pone nota en margen e ingresos.
  Pendiente opcional: cargar datos CONSOLIDADOS para estas 4.
- **Brocal NO es junior:** es productora mediana (cobre/plata/plomo) controlada por Buenaventura
  (61%) y casi sin deuda. Perfil ajustado de apuesta→mixto/dividendos. (Juniors = PPX, PML.)
- **UI (26-jun):** (a) FCF en BANCOS ahora muestra nota "no aplica, se mide por CAPITAL/CET1 y ROE"
  (run_batch, si esBanco). (b) Empresas SIN dividendos (Volcan, Aenza): NO se muestra simulador de
  dividendos (solo el de precio), y el DividendoResumen de arriba avisa "Esta empresa no reparte
  dividendos" (sale incluso si ni está en dividendos.json/404).

## 10. Pendiente
- **Publicar** la app (link real + robot diario de precios con GitHub Actions). ← gran paso.
- Cargar el **criterio de Jair** restante (afinar tesis, catalizadores, escenarios por empresa).
- Pasar el **número de Yape** (el QR ya está; falta el número para "copiar número").
- Opcional: scraper de **Hechos de Importancia** SMV; beta/fechas de resultados al simulador;
  versión oficial con TODAS las empresas de la BVL.

## 11. Cómo NO perder memoria (anti-amnesia)
- **La verdad vive en los archivos**, no en el chat: este doc + el código + los JSON + los .md
  de `extractor/`. Mientras existan, nada se pierde aunque la conversación se resuma.
- Claude guarda memoria persistente en
  `~/.claude/projects/.../memory/` (MEMORY.md + notas). Se carga sola cada sesión.
- Para retomar: leer este `ESTADO_DEL_PROYECTO.md` y `ALTO_PROYECTO_COMPLETO.md`.
