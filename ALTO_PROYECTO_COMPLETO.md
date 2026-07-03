# ALTO RESEARCH — Documento maestro del proyecto

> Resumen completo de todo lo trabajado: la app educativa, los hallazgos de
> investigación de mercado, la fuente de datos SMV y el enfoque para construirlo.
> Sirve como memoria del proyecto y como contexto para Claude Code.
>
> NOTA SOBRE LOS DATOS: las cifras de este documento son reales y se obtuvieron de
> fuentes oficiales/verificables (BVL, SMV, agregadores), PERO deben revalidarse contra
> la fuente antes de publicarse en cualquier reporte o app. Regla de Oro #1: cero datos
> sin verificar.

---

# PARTE A — VISIÓN Y FILOSOFÍA

## A.1 Qué es ALTO Research
Servicio de análisis fundamental de acciones de la Bolsa de Valores de Lima (BVL),
desde Arequipa, Perú. Enfocado en mineras pero abierto a todos los sectores. La
credibilidad —análisis riguroso, no promesas de rendimiento— es EL producto.

## A.2 La inspiración: el TikTok de @lflo.lflo y el juego "DSMdle"

### El TikTok (lo que cuenta)
Video de @lflo.lflo (descripción: "Las ideas no sirven a menos de que salgan al mundo",
hashtags #ideas #hate #psicología). El creador cuenta su historia: hizo un juego al estilo
Wordle —llamado **DSMdle**, por el DSM (manual de diagnóstico psiquiátrico)— donde, en vez
de adivinar una palabra, **determinas el diagnóstico a través de casos clínicos**. Le
pareció una idea útil y, al terminarlo, lo compartió en Reddit. Casi lo abandona: dice que
"tenerlo ahí no le costaba nada" y que lo dejó más por flojera de borrarlo que por otra
cosa. Pero despegó solo: se enteró de que **un psiquiatra lo estaba jugando**, luego
**alguien hizo TikToks jugándolo**, y de repente tenía **miles de usuarios** y mensajes
todos los días. El giro/moraleja: a pesar de que alguien le comentó que **"era basura"**
(de ahí #hate), terminó **sirviendo a más de 7,500 personas** (mostró una gráfica de "plays
per day"). Estuvo a punto de tirarlo a la basura. La lección: una idea no vale nada
mientras no la saques al mundo.

### El juego DSMdle (dsmdle.com — cómo está hecho)
Juego diario tipo Wordle. Muestra un caso clínico ("Femenina de 58 años, fatiga y
dificultad para concentrarse…"), eliges modo Clásico o Difícil, y vas adivinando el
diagnóstico mientras se revelan pistas una por una. Tiene casos diarios, archivo para
rejugar, login con Google, estadísticas globales, multi-idioma (ES/EN). Los casos los
genera IA, con disclaimer de "no es herramienta clínica".

### Lo que esto nos enseña para ALTO (y la diferencia importante)
- La mecánica del juego (mostrar algo → adivinar → revelar pista) es FÁCIL de programar:
  cosa de un fin de semana. Lo que toma más trabajo son los extras (login, estadísticas,
  idiomas), pero son opcionales y se agregan después con usuarios.
- Modelo a copiar: cosa chiquita, gratis, útil → imán. El dominio es un costo bajo (él
  PAGABA el dominio, ~US$10-15/año; no cobraba por él). Lo que monetiza es la atención.
- DIFERENCIA CRÍTICA: el DSMdle podía equivocarse sin consecuencias (casos generados por
  IA, disclaimer). La app de ALTO maneja decisiones de dinero real con la SMV mirando →
  NO puede inventar datos ni "recomendar". La parte difícil de la app de ALTO no es el
  quiz (eso es lo fácil); es la **data financiera verificada** por detrás.

## A.3 La idea: una app educativa gratuita
- Un quiz que, según el perfil del usuario y el sector que le interesa, le muestra
  empresas de la BVL **para estudiar** (no para comprar).
- Capa educativa: glosario con definiciones + ejemplos; píldoras "¿Sabías que?".
- Gratis. Monetización solo por **apoyo voluntario** (Yape + PayPal).
- Identidad visual: negro y dorado (#D4AF37).

## A.4 Guardarraíl legal y de marca (CRÍTICO)
- La app **NO recomienda** qué comprar. Muestra análisis/educación y deja la decisión
  explícitamente en el usuario. "Empresa para estudiar", no "compra esto".
- Recomendar formalmente (precio objetivo, "comprar") es lo que hacen las **SAB**
  reguladas por la SMV (Kallpa, Credicorp Capital, BTG, etc.). ALTO hoy NO está
  registrada como SAB ni asesor; por eso se queda del lado educativo. (Si algún día se
  quiere recomendar formalmente, el camino es registrarse en el marco SMV — consultar
  con un abogado en Perú.)
- Etiquetar la app como "educativa" no la vuelve educativa: lo que importa es lo que
  ENTREGA. Si el quiz termina en "compra X", es recomendación con disfraz. La frontera
  real es: enseña a evaluar vs. dice qué comprar.
- Mostrar **varias** empresas por perfil (no una sola fija) refuerza el marco educativo
  ("estas son las de este tipo, estúdialas").
- El botón de apoyo se enmarca como **donación voluntaria al contenido educativo**, no
  como pago por recomendación. Frase: "si esto te ayudó a aprender, invítame un café".
- Disclaimers visibles, no escondidos: "contenido educativo, no es recomendación de
  inversión ni garantía de rendimiento, el mercado manda".
- Consultar con un abogado en Perú cómo encuadrar términos/disclaimers, sobre todo por el
  botón de apoyo (fin de lucro ligado a contenido de inversión).

## A.5 El origen: el primer cliente (de dónde salió la idea de la app)
El primer cliente de ALTO (gratis) fue un converso del cripto: había invertido en Bitcoin
y quería entrar a la bolsa. La conversación reveló el insight que originó la app: **mucha
gente NO quiere la cátedra de fundamentos; quiere "dime dónde invierto y ya".** El cliente,
tras toda la explicación, pidió directo "¿cuál me recomiendas?". De ahí la idea de una app
que filtre por perfil y dé empresas concretas para estudiar, sin obligar a nadie a la
teoría (pero con la educación disponible para quien la quiera).

Lecciones de esa conversación (que moldean la marca):
- Dar el dato rápido como pide el cliente está bien; **lo que no se puede ceder es lo que
  se le ASEGURA**. El impaciente que "va con todo" es el más rentable de convertir y el
  más peligroso de manejar (si baja, vuelve diciendo "tú me dijiste").
- La diferenciación de ALTO no es vender certezas (eso hace cualquier influencer); es dar
  el dato Y decir "esto es probabilidad, no garantía".
- Errores a evitar detectados ahí: usar la anécdota no verificada del "presidente de IPSOS"
  como si fuera hecho; recomendar NEXAPEC1 sin revelar que se tiene posición (conflicto de
  interés — declararlo SUMA credibilidad); cruzar de educación a asesoría personalizada
  ("invierte 600-1000 soles, vende tras el dividendo"), que es terreno regulado.
- Insight de producto: a la gente le incomoda el ida y vuelta de cortesía; una apertura
  "bifurcada" ("¿quieres aprender desde cero o ya tienes experiencia y vamos directo?")
  deja que el lead se autoclasifique. Esa misma lógica es la del quiz.

---

# PARTE B — LA APP (DISEÑO)

## B.1 El quiz
Preguntas (4 opciones cada una). Cruza dos ejes: PERFIL de riesgo + SECTOR.

1. ¿Qué buscas en una inversión?
   - Movimiento fuerte / volatilidad → apuesta
   - Que me pague cada cierto tiempo → dividendos
   - Una apuesta de crecimiento → apuesta
   - Algo estable y aburrido → estable
2. ¿Cuánto riesgo aguantas?
   - Alto, voy con todo → apuesta
   - Medio → mixto
   - Bajo, dormir tranquilo → estable
   - Cero, sin sustos → dividendos
3. ¿Qué sector te llama más?  ← define el SECTOR
   - Minería / Bancos y finanzas / Consumo / Construcción-industrial
4. ¿Por cuánto tiempo lo dejarías?
   - Semanas (entrar/salir) → apuesta
   - Meses → mixto
   - Un par de años → estable
   - Años, cobrando dividendos → dividendos

Lógica: se cuenta el perfil con más votos; el sector lo fija la pregunta 3.

## B.2 Los 4 perfiles
- **Apuesta de crecimiento** (volatilidad, alto riesgo)
- **Generador de ingresos** (dividendos)
- **Defensiva / estable**
- **Equilibrado** (mixto)

## B.3 El resultado: cruce PERFIL × SECTOR → "empresas que más coinciden"
- Cada empresa tiene: sector + lista de perfiles a los que aplica.
- Puntaje: +2 si coincide el sector, +2 si coincide el perfil.
- "Coincidencia alta" = coincide en ambos. "Coincidencia parcial" = solo uno.
- Se muestran las 2-3 que más coinciden, ordenadas. Nunca queda vacío.
- Botón "intentar de nuevo" rota a otra empresa del mismo perfil.

### Tabla maestra empresa → sector → perfil (EJEMPLOS — la define Jair, es criterio analítico)
> Esto es lo más importante que debe llenar Jair: a qué perfil pertenece cada empresa
> es una afirmación analítica suya, no un default. Abajo solo ejemplos para ilustrar.

- NEXAPEC1 — minería — [apuesta, mixto]
- VOLCABC1 — minería — [apuesta]
- MINSURI1 — minería — [dividendos, estable, mixto]
- CVERDEC1 — minería — [dividendos, estable]
- BVN — minería — [apuesta, dividendos]
- BBVAC1 — banca — [dividendos, estable]
- INTERBC1 — banca — [dividendos, mixto]
- ALICORC1 — consumo — [estable, dividendos]
- BACKUSI1 — consumo — [estable, dividendos]
- GLORIAI1 — consumo — [estable, mixto]
- FERREYC1 — construcción/industrial — [mixto, dividendos]
- UNACEMC1 — construcción/industrial — [estable, mixto]
- CPACASC1 — construcción/industrial — [dividendos, mixto]

## B.4 Pantalla de empresa (caso de estudio)
Sigue el template "Gold Standard" de ALTO. Estructura:
- Cabecera: ticker, sector, precio (en vivo).
- Tesis en una línea (la escribe Jair).
- Fundamentos (INDIVIDUAL, SMV): Deuda, FCF, EPS (moneda original), Margen.
- Catalizadores (ej. resultados 2T; step-down streaming de plata Cerro Lindo; dividendo).
- Escenarios (matriz con colores): Favorable / Neutral / Presión / Alto riesgo.
- Histórico trimestral (Q1–Q4) individual SMV.
- Riesgos: político/electoral, conflicto comunitario, precio del metal — separando
  documentado de rumor.
- Fuentes (jerarquía): Filings SMV → reporte auditado → comunicaciones oficiales →
  medios locales verificados.
- Todos los datos salen de la SMV; nada se inventa.

## B.5 Glosario educativo (términos con definición + ejemplo)
Cada término en dorado abre un globo con: definición simple + botón "ver ejemplo".
NO son solo 3 términos; es un árbol por capas. Ramas y sub-conceptos a llenar:

- **Deuda**: deuda total, deuda neta (por qué se resta la caja), deuda/EBITDA (1x vs 4x),
  deuda en USD vs PEN (clave en Perú), vencimientos.
- **FCF (Flujo de Caja Libre)**: flujo operativo − capex; por qué ≠ utilidad neta;
  capex de mantenimiento vs de expansión; FCF yield.
- **Dividendos**: dividend yield, payout ratio, ordinario vs extraordinario, fecha
  ex-dividendo, por qué se paga en USD en algunas mineras.
- **Valoración**: P/E, P/B, EV/EBITDA.
- **Rentabilidad**: ROE, márgenes.
- **Negocio minero**: ley del mineral, cash cost, reservas vs recursos.
- **Riesgo**: volatilidad, beta, riesgo país.

El árbol también debe tener ramas "cómo leer X" por tipo de empresa:
cómo leer una INDUSTRIAL / una de CONSUMO / un BANCO / una MINERA (ver Parte C).

Recomendación: no se necesita el glosario completo para lanzar. Armar el árbol entero
y llenar lo esencial primero; agregar profundidad con usuarios, como el DSMdle.

## B.6 Píldoras "¿Sabías que?" (esquina rotativa)
Principios, NO datos puntuales (un principio no caduca ni afirma nada sobre una acción
específica → no rompe la Regla #1). Las 5 iniciales:
1. Una empresa con mucha deuda puede ser más sana que una sin deuda: lo que importa no es
   cuánta debe, sino si su negocio genera caja estable para pagarla.
2. El estado financiero de un banco no se parece al de ninguna otra empresa: no tiene
   "ventas" ni "costo de ventas"; gana con la diferencia entre lo que cobra y paga por
   intereses.
3. En una minera un P/E bajo puede ser una trampa: con el metal caro la ganancia se infla
   y la acción parece barata justo cuando podría estar cara.
4. Algunas acciones pagan dividendos en dólares y otras en soles; casi todas las mineras
   peruanas pagan en dólares.
5. "Comprar el rumor, vender la noticia": una empresa puede reportar buenas utilidades y
   aun así caer, porque el precio ya tenía esa buena noticia adentro.

## B.7 Apoyo voluntario (Yape + PayPal)
- Yape para Perú (instantáneo, local), PayPal para apoyo internacional.
- Enmarcado como donación voluntaria al contenido educativo. No es pago por recomendación.

## B.8 Qué sigue siendo trabajo de Jair (no automatizable sin perder lo que vale)
- Los datos verificados de la SMV detrás de cada cifra.
- El criterio: la tesis, qué empresa va en qué perfil, el "por qué para estudiar",
  qué riesgo es documentado vs rumor.

---

# PARTE C — INVESTIGACIÓN DE MERCADO (hallazgos reales, validar antes de publicar)

## C.1 Dividendos por sector (fuente: BVL, listas oficiales 2025 y derechos 2026)
- Mineras pagan casi siempre en USD: NEXAPEC1 US$0.07860968; MINSURI1 US$0.12140142
  (corte 2026); CVERDEC1, BVN, SCCO, SPCC, BROCAL en USD.
- AFP/pensiones: acciones caras, dividendos altos (PRIMA ~S/1,388/acción; INTEGRA cientos).
- Cerveceras: Backus paga varias veces al año, montos altos y constantes (caja predecible).
- Cemento: UNACEM S/0.02 repetido por trimestre; Pacasmayo en USD.
- Bancos: muchos pagan en ACCIONES, no efectivo (BBVA ~9.9%, INTERBANK, BANCOM).
- Utilities: pagos regulares (Engie, Luz del Sur, Enel/PLUZ).

## C.2 P/E por empresa (fuente: stockanalysis.com — son cifras CONSOLIDADAS/TTM)
> Para reportes ALTO recalcular desde estados INDIVIDUALES SMV (precio ÷ EPS individual).
> Útiles para enseñar rangos en el glosario, no para publicar como cifra ALTO.
- Ferreycorp (FERREYC1): P/E trailing ~7.45, forward ~6.97; Deuda/Patrimonio 0.71;
  ROE ~16.3%.
- Alicorp (ALICORC1): P/E trailing ~10.20, forward ~8.52; Deuda/Patrimonio 3.39 (alta);
  ROE ~27.2%; beta 0.24 (poco volátil); acción +40% en 52 semanas.
- Credicorp (BAP): P/E TTM ~13.2; fin-2024 ~9.27; ROE ~20%.
- Buenaventura (BVN): 2025 ingresos ~US$1.73 mil M (+50%), ganancias ~US$782M (+94%) —
  efecto del ciclo del oro/plata.

## C.3 La lección de la deuda
- Deuda alta NO = empresa en peligro. Depende de qué tan predecible es su caja.
- Ejemplo: Alicorp, Deuda/Patrimonio 3.39 (muy alta) pero ROE 27%, baja volatilidad,
  negocio de consumo masivo (caja todos los meses) → sana.
- Ferreycorp: deuda baja (0.71), también sana. Dos empresas sanas, deudas opuestas.
- Utilities/telecom aguantan deuda alta por flujo de caja predecible (todos pagan luz/tel.).

## C.4 Los bancos son OTRO animal (validado)
- No tienen "ventas / costo de ventas / margen bruto". Tienen margen financiero
  (ingresos por intereses − gastos por intereses), provisiones, margen financiero neto.
- Balance ordenado por liquidez; no separan corto/largo plazo.
- Sus "pasivos" (depósitos) son su materia prima, no un peligro. No aplicar el "¿tiene
  mucha deuda?" de una minera.
- Métricas propias: margen de intermediación, ROE, morosidad, ratios de capital (CET1),
  cuota de mercado. Regulados por la SBS (no solo SMV).
- → En la app, "cómo leer un banco" es una rama distinta, sin P/E clásico.

## C.5 El P/E minero es una trampa (cíclico)
- La ganancia minera depende del precio del metal. En el pico del ciclo la ganancia se
  infla y el P/E se ve bajísimo (parece barata cuando puede estar cara); en el fondo, el
  P/E se dispara o se vuelve negativo. A mineras se les mira metal, cash cost y reservas,
  no el P/E como a Alicorp.

---

# PARTE D — FUENTE DE DATOS: PORTAL SMV (lo que exploramos hoy)

## D.1 URL del buscador (Información Financiera, Mercado Principal)
https://www.smv.gob.pe/SIMV/Frm_InformacionFinanciera?data=A70181B60967D74090DCD93C4920AA1D769614EC12

## D.2 Cómo funciona el formulario (verificado a mano)
- Portal ASP.NET WebForms viejo. Token cifrado en `data=`. Postbacks AJAX: al elegir
  empresa, el formulario se refresca solo.
- Campos:
  - Empresa (dropdown, cada una con `value` numérico interno).
  - Tipo: Individual / Consolidada → SIEMPRE Individual.
  - Período: Intermedio / Anual → Intermedio para trimestres.
  - Año (incluye 2026).
  - Trimestre: I (1), II (2), III (3), IV (4).
  - Botón Buscar.
- Tras Buscar aparece tabla de resultados con filas: "Análisis y Discusión de la
  Gerencia", **"Archivo Estructurado XBRL de Información Financiera"**, "Estados
  Financieros" (lupa → detalle), "Notas a los Estados Financieros", etc.

## D.3 Values internos de empresas (confirmados)
NEXA RESOURCES PERU S.A.A. = 59 · MINSUR S.A. = 168 · SOCIEDAD MINERA EL BROCAL = 255 ·
COMPAÑIA DE MINAS BUENAVENTURA = 50 · NEXA RESOURCES ATACOCHA = 74 · PPX MINING = 149388 ·
VOLCAN COMPAÑIA MINERA = 46703 · SOCIEDAD MINERA CERRO VERDE = 93832 · ALICORP = 73 ·
FERREYCORP = 93 · UNACEM CORP = 45 · BACKUS (UNION DE CERVECERIAS) = 47 ·
CEMENTOS PACASMAYO = 74470 · BANCO BBVA PERU = 24 · INTERBANK = 35 · CREDICORP LTD = 18049.

## D.4 El dato clave: usar el XBRL
La fila "Archivo Estructurado XBRL" es la mejor fuente: archivo estructurado y etiquetado,
legible por máquina. Preferir SIEMPRE descargar/parsear el XBRL antes que raspar el HTML.

## D.5 Ejemplo real obtenido: NEXA, Individual, Q1 2026
Página de detalle (Frm_DetalleInfoFinanciera.aspx) con pestañas: Situación Financiera /
Resultados / Cambios en Patrimonio / Flujo de Efectivo / Resultados Integrales / Firmantes.
Encabezado: "NEXA RESOURCES PERU S.A.A. — INDIVIDUAL — TRIMESTRE I AL 31 DE MARZO DEL 2026
(EN MILES DE DOLARES)". Dos columnas: 31/mar/2026 y 31/dic/2025. Presentado el 06/05/2026.

Cifras del Estado de Situación Financiera (en miles de USD, al 31/mar/2026 — VALIDAR):
- Total de activos: 1,196,589
- Total pasivos: 369,449
- Total patrimonio: 827,140
- Efectivo y equivalentes: 27,825 (vs 49,347 al cierre 2025)
- Deuda financiera (otros pasivos financieros corriente 16,143 + no corriente 13,353): 29,496
- Resultados acumulados: 318,802
- Cuentas por cobrar a entidades relacionadas (corriente): 397,614
  (línea sensible: por aquí estuvo un error histórico US$40–45M vs US$407M auditado —
   siempre mostrarla tal cual, sin inferir)

El EPS sale de la pestaña "Estado de Resultados"; el FCF de "Estado de Flujo de Efectivo"
(accesibles igual).

---

# PARTE E — CONSTRUIRLO CON CLAUDE CODE

## E.1 ¿Se puede sin programador? Sí.
- Claude Code = Claude programando desde tu computadora (escribe, prueba, corrige).
- Tú diriges en español y validas resultados; no necesitas programar a fondo.
- Es ida y vuelta: él explora/escribe, tú revisas y corriges errores. Requiere paciencia,
  no un título.

## E.2 Estrategia recomendada (no depender de "alguien")
- Lanzar la app MANUAL primero (Jair carga datos verificados de la SMV — lo que ya sabe
  hacer; protege la Regla #1).
- En PARALELO, construir con Claude Code el extractor SMV (script Python que baja el XBRL).
- Si el script funciona, se conecta; si tarda, la app ya está viva igual.

## E.3 Reto técnico honesto
- La SMV no tiene API: hay que replicar el formulario (empresa, tipo, periodo, año,
  trimestre + token/viewstate) y ubicar/descargar el XBRL. Resoluble, pero es trabajo de
  construcción y mantenimiento (si la SMV cambia el portal, se ajusta).

## E.4 El extractor te ahorra el copiado, NO el criterio
- Aunque el script jale el dato solo, Jair revisa antes de publicar (sobre todo NEXA).
  Un dato mal mapeado por el script = el mismo tipo de error de siempre, pero automatizado.

---

# PARTE F — REGLAS DE ORO (innegociables, aplican a todo)

1. **Cero datos inventados.** Si no está en la fuente, queda vacío y se reporta faltante.
2. **Jerarquía de fuentes**: filings SMV → reporte auditado → comunicaciones oficiales →
   medios locales verificados. Nunca memoria como fuente primaria.
3. **EPS en moneda original** del estado. Nunca mezclar USD/PEN sin avisar.
4. **Estados INDIVIDUALES** (SMV) para los cálculos, no consolidados.
5. **Lenguaje simple** para el inversor retail promedio.
6. **Verificar estructura/propiedad** contra SMV antes de publicar (entidad exacta;
   no atribuir a NEXA PERU lo que es de la matriz Nexa Resources).
7. **No mezclar rumor con hecho.** Distinguir documentado de no verificado.
8. **Nunca prometer rendimientos.** La volatilidad se "interpreta", no se "predice".
9. **La app educa, no recomienda.** Y nunca se disfraza de educativa lo que recomienda.
