# 🧭 ANÁLISIS EDUCATIVO PROFUNDO + TOUR POR NIVELES — ALTO Research

> **21 de julio de 2026.** Pedido de Jair: entender TODO lo construido para explicar los números
> como un profesor, con lentes POR SECTOR (una minera endeudada ≠ AUNA endeudada ≠ un banco),
> mejorar el tour y meterlo en todos los niveles. **Sin tocar código** — este documento es el plano
> para la próxima sesión (Fable renovado). Se leyó: ESTADO_DEL_PROYECTO.md completo, TourGuia,
> SelectorNivel, lib/nivel, Empresa.jsx, RadiografiaExpres, Valoracion, guias.json, escenarios.json,
> quiz.json, tips (muestras), BurbujaTour.

---

## 1. Veredicto general

**Lo que ALTO ya hace mejor que casi cualquier app educativa de bolsa:**
- La honestidad es una ventaja educativa real: "no se inventa un cero", "no encontré esa información",
  P/E referencial con ⚠, "no reparte hoy". El usuario aprende que *la duda es parte del análisis*.
- `guias.json` es ORO puro: ya enseña que la deuda de un banco no es la de una minera, que el P/E
  cíclico engaña, que las vedas parten el año pesquero. **El problema no es el contenido: es que ese
  contenido vive enterrado en una sección larga de la ficha y NO gobierna al resto de la app.**
- El sistema de 4 niveles con anzuelo (la radiografía que dice "el porqué vive en el nivel 3") es
  el mejor mecanismo de retención que tiene la app.
- Los tours existentes (inicio, ficha, explorar, cuaderno) son cálidos y bien escritos.

**Los 3 defectos estructurales (crítica sin miedo, como pediste):**

1. **El tour explica la INTERFAZ, no los NÚMEROS.** "Este es el precio", "estos son los dividendos"
   — enseña dónde están las cosas, no cómo juzgarlas. Un usuario termina el tour de la ficha de BVN
   sabiendo dónde está el P/E, pero sin saber que un P/E de 9.6 en una minera con margen 84% puede
   ser una trampa de ciclo. El conocimiento existe (está en la guía del sector), pero el tour no lo usa.

2. **El tour NO conoce los niveles.** Cuando el usuario sube de nivel 2 a 3, se le aparecen de golpe
   la Valoración con fórmulas, catalizadores, escenarios, riesgos y producción minera… **sin nadie que
   se los presente.** Justo el momento de mayor confusión es el único sin tour. Los PASOS_FICHA son
   los mismos para todos los niveles y no cubren ninguna sección de nivel 3-4.

3. **El sector "diversas" es un hueco educativo.** AUNA (salud), Rímac/Mapfre/Pacífico (seguros),
   Chancay/Inca Rail/Red Vial 5 (transporte/concesiones), Integratel (telecom), Los Portales
   (inmobiliaria)… todas se leen hoy con UNA guía genérica que dice "léelas una por una" — o sea,
   la app admite que no las enseña. Y el ejemplo estrella de Jair (la deuda de AUNA es manejable
   porque su flujo es estable) **no está escrito en ninguna guía**: está solo en los tips de AUNA.

**Y una contradicción real cazada leyendo los datos:** los tips de CREDITC1 (BCP) dicen primero
"Sus depósitos son materia prima: no le apliques el '¿debe mucho?' de una minera" (✔ correcto) y
tres líneas después "Carga deuda financiera de ~S/ 18,640 M: mírala contra la caja que genera"
(✘ ese es EXACTAMENTE el lente minero que la propia guía prohíbe para bancos). Vino de
`enrich_tips.py`, que agregó tips de deuda genéricos sin filtro por sector. Hay que auditar todos
los bancos/seguros/AFP con ese mismo ojo.

---

## 2. El problema central: la app sabe QUÉ es cada número, pero aún no enseña a JUZGARLO según el sector

El ejemplo que diste es la prueba ácida. Tomemos "deuda alta" y pasémosla por 4 empresas reales de la app:

| Empresa | Deuda | Lo que un principiante concluye hoy | Lo que debería aprender |
|---|---|---|---|
| **AUNA** (salud) | apalancamiento 3.6x | "¡Debe muchísimo, es peligrosa!" | Los hospitales generan flujo ESTABLE (la gente no deja de enfermarse). 3.6x se amortiza en años; el riesgo real es que México siga flojo o suban las tasas. Su plan <3x es el dato a vigilar. |
| **BVN** (minera) | deuda de largo plazo | "Es igual que AUNA, tranquilo" | ¡No! La caja minera depende del precio del oro. La misma deuda que hoy es cómoda se vuelve soga si el metal cae 30%. Una minera NO puede darse el lujo de deber 3.6x su EBITDA en el pico del ciclo. |
| **BCP** (banco) | "deuda" S/ 18,640 M + depósitos enormes | "¡Es la más endeudada de todas!" | Los pasivos de un banco SON su materia prima (los depósitos). Medirlo por deuda es un error de categoría: se mide por capital (CET1), morosidad y ROE. |
| **Luz del Sur** (eléctrica) | deuda alta permanente | "Debe mucho, mala señal" | Ingreso regulado = se endeuda barato a 20 años a propósito. Deuda alta es el ESTADO NORMAL de una utility; el riesgo es tasas al alza o recorte tarifario. |

**El mismo número, cuatro veredictos distintos.** Hoy la app muestra el monto de deuda crudo en
Fundamentos y deja la interpretación a un párrafo de la guía que el usuario de nivel 1 ni siquiera ve
(guiaSector es nivel 2) y el de nivel 3 probablemente no lee completo. La radiografía exprés — lo que
TODOS ven — tiene 4 globos (precio, dividendos, barata/cara, movimiento) y **ninguno habla de deuda**.

**La solución de fondo (mejora #3 y #4 de la lista):** un indicador nuevo "¿Puede pagar su deuda?"
= deuda neta ÷ EBITDA (o ÷ FCF donde no haya EBITDA), traducido a "años de caja para pagarla", con
veredicto POR LENTE:
- Banco/seguro/AFP → "no se mide así" + qué mirar en su lugar (capital, siniestralidad, comisión).
- Utility/salud/concesión (flujo estable) → verde hasta ~4x, con la explicación de por qué aguantan.
- Minera/pesquera/acerera (flujo cíclico) → ámbar desde ~2x, con el aviso "hoy el metal la cubre,
  pero la deuda se juzga en el FONDO del ciclo, no en el pico".
- Consumo/retail → intermedio (~3x), atado a la estabilidad del margen.

Todo con datos que YA existen (deuda, EBITDA/EBIT del cálculo de EV, FCF). Cero fuentes nuevas.

---

## 3. Pantalla por pantalla — las 8 preguntas

Formato compacto por pantalla: **E**=qué enseña · **P**=qué entiende un principiante · **C**=qué confunde ·
**F**=qué explicación falta · **Ej**=ejemplo práctico a agregar · **Cmp**=comparación que ayudaría ·
**Err**=error típico del inversionista · **T**=cómo volverlo tour interactivo.

### 3.1 Puerta de niveles (SelectorNivel)
- **E:** que la app se adapta a tu experiencia; que aprender es una escalera.
- **P:** elige por autopercepción ("nunca he invertido" → 2). Funciona.
- **C:** "¿Cuánto podría ganar?" como nombre del nivel 1 promete ganancia (roza la Regla #8);
  "Lobo de wall street" contradice la identidad anti-hype de ALTO — el lobo de la película es
  el ESTAFADOR. Gracioso, pero manda el mensaje equivocado en una app cuya marca es honestidad.
- **F:** qué pierdes/ganas al elegir cada nivel en términos de aprendizaje (los chips ayudan pero
  son de features, no de conocimiento).
- **Ej:** bajo cada tarjeta, una línea "con este nivel entenderás: …" (ej. N2: "por qué un banco
  no se mide por su deuda").
- **Cmp:** —
- **Err:** elegir nivel 4 por ego y ahogarse; elegir 1 y no descubrir nunca que hay más.
- **T:** un micro-tour de 2 pasos la primera vez que se ELIGE nivel: "esto acabas de desbloquear /
  esto te espera arriba".

### 3.2 Inicio
- **E:** el mercado vivo (cinta BVL, HoyBVL, gancho de datos), puertas de entrada (quiz, buscador,
  empresa del día).
- **P:** verde sube, rojo baja; que existe un quiz. Bien.
- **C:** demasiadas puertas a la vez para un nivel 1 (cinta + gancho + HoyBVL + empresa del día +
  mi lista + actualizaciones); el tour de 11 pasos las recorre TODAS y agota.
- **F:** "¿y por dónde EMPIEZO?" — no hay una ruta sugerida explícita (el quiz lo insinúa).
- **Ej:** en HoyBVL: "¿por qué subió? Toca y revisa si publicó un Hecho de Importancia" —
  conectar variación con causa.
- **Cmp:** la cinta podría marcar el sector de cada ticker (color/emoji) para que el ojo aprenda
  que "las mineras se mueven juntas".
- **Err:** correr a comprar lo que más subió ayer (el texto "un día no hace tendencia" ya existe —
  bien — pero está en letra chica).
- **T:** partir el tour del inicio en 2: "lo esencial" (5 pasos: nivel, buscador, quiz, cuaderno, ❓)
  y "el resto" opcional. Al terminar, ofrecer: "¿te llevo a tu primera ficha con el tour puesto?"

### 3.3 Quiz → Resultados
- **E:** perfil de riesgo × sector → empresas afines. Los sectorTips son la mejor educación del flujo.
- **P:** que existe "su" tipo de empresa.
- **C:** q1 mezcla "movimiento fuerte" y "apuesta de crecimiento" (ambas → apuesta) — parecen
  distintas y puntúan igual; "Semanas, entrar y salir" (q4) legitima el trading en una app que
  educa inversión — merece al menos una advertencia en resultados.
- **F:** POR QUÉ esas empresas coinciden con tu perfil (hoy el match es una caja negra).
- **Ej:** en cada resultado: "salió porque elegiste [dividendos] y esta reparte 6% con caja estable".
- **Cmp:** mostrar 1 empresa que NO coincide y por qué ("esta NO te salió: es montaña rusa").
- **Err:** creer que el resultado del quiz es recomendación de compra (el disclaimer existe;
  reforzarlo en el momento del resultado, no solo al pie).
- **T:** tour de Resultados (hoy NO existe): 3 pasos — qué significa tu perfil, por qué estas
  empresas, qué hacer ahora (abrir una ficha con tour).

### 3.4 Explorar
- **E:** el universo BVL completo (115), filtrar, ordenar, comparar. Tour ya existe y está bien.
- **C:** ordenar por yield sin contexto invita al error clásico #1 del dividendero: perseguir
  el yield más alto (que casi siempre es un pago extraordinario o un precio viejo).
- **F/Err:** al ordenar por yield, un aviso pegado al encabezado: "yield altísimo = casi siempre
  trampa: precio viejo o pago que no se repite" (la ficha ya lo dice; Explorar no).
- **Ej/Cmp:** chip "mediana del sector" al filtrar por sector (yield y P/E medianos) para que el
  usuario compare contra ALGO.
- **T:** ya tiene tour; agregarle un paso condicional cuando el usuario ordena por yield.

### 3.5 Ficha — Radiografía exprés (los 4 globos)
- **E:** la empresa en 10 segundos; el anzuelo de niveles (excelente diseño).
- **P:** los veredictos simples ("barata", "montaña rusa").
- **C:** "Barata" a secas en una minera cíclica es EL riesgo educativo más grande de la app: el
  globo no hereda el aviso de ciclo que la Valoración sí tiene. En niveles 1-2 el usuario ve
  "Barata" sin el porqué NI el peligro.
- **F:** deuda y margen no tienen globo; el veredicto cíclico no sube al globo.
- **Ej:** BVN nivel 1: "💎 Barata*  · *ojo: es minera, su ganancia sube y baja con el oro".
- **Cmp:** tocar el globo podría mostrar "vs sector: la mediana de mineras está en X".
- **Err:** comprar "porque la app dijo barata". Un asterisco de ciclo en el globo mismo es la
  vacuna mínima.
- **T:** los globos son el lugar perfecto para micro-tours de 1 paso por globo ("¿qué significa
  este veredicto?") — ver §6.

### 3.6 Ficha — Precio + Sparkline + Termómetro
- **E:** qué costó la acción de verdad (cierres reales), cuánto se sacude.
- **P:** la línea sube = subió. El termómetro con etiquetas de lenguaje humano funciona muy bien.
- **C:** "sin negociación reciente" está bien avisado, pero el CONCEPTO de iliquidez (no podrás
  vender al precio de pantalla) solo se explica en el termómetro nivel 3.
- **F:** en ilíquidas, el aviso de liquidez debería ser nivel 1 — es un riesgo de plata real,
  no un tecnicismo.
- **Ej:** "esta acción negoció por última vez el 12/05: si compraras hoy, quizá nadie te la
  compre mañana al mismo precio".
- **Cmp:** sparkline vs el sector (línea fantasma de la mediana del sector) — nivel 3+.
- **Err:** leer el % de 6 meses de una ilíquida como si fuera real (es un precio viejo).
- **T:** paso de tour condicional si `pocoNegociada`: "esta es de las que casi no se negocian —
  esto cambia TODO lo que veas abajo".

### 3.7 Ficha — Tesis
- **E:** qué es la empresa en una línea. Perfecto para N1.
- **F:** falta el "de qué vive" en términos de flujo: ¿vende metal? ¿cobra comisión? ¿cobra
  peaje? Esa única palabra (metal/comisión/peaje/prima/renta) es la semilla del lente sectorial.
- **T:** paso de tour que lea la tesis y diga "quédate con UNA cosa: esta empresa vive de X —
  todo lo demás que veas abajo se juzga con ese ojo".

### 3.8 Ficha — Dividendos (resumen + gráfico + simulador)
- **E:** pagos reales con fechas, yield, la diferencia 2025/2026. El aviso yield>20% es excelente.
- **P:** "me pagan por tener la acción".
- **C:** yield vs payout vs sostenibilidad: el usuario ve "rinde 8%" y no sabe si es sostenible;
  bancos que pagan en ACCIONES (la guía lo cuenta, el resumen no lo marca); moneda del dividendo
  vs moneda del precio (ya resuelto en datos, pero el usuario no entiende por qué le salió en US$).
- **F:** "¿de dónde sale la plata del dividendo?" → conectar con FCF: si FCF < dividendos,
  el pago sale de deuda o caja vieja — INSOSTENIBLE. Dato ya disponible.
- **Ej:** Michell: "vive de repartir"; Quimpac 26%: "la trampa del yield: precio viejo".
- **Cmp:** el duelo de dividendos del Comparador ya lo hace bien.
- **Err:** #1 del Perú dividendero: anualizar un pago extraordinario. #2: comprar después de la
  fecha de corte creyendo que cobra.
- **F (crítico):** FECHA DE CORTE explicada como concepto de nivel 1 con dibujito temporal
  (compra antes del corte → cobras; después → no). El Cuaderno ya tiene el calendario; la ficha
  no enseña el mecanismo.
- **T:** tour del bloque de dividendos con los datos reales ("este año ya pagó 2 veces, mira las
  fechas de corte").

### 3.9 Ficha — ¿Barata o cara? (Valoración)
- **E:** P/E con fórmula y números reales, rango sectorial, EV/EBITDA-EV/EBIT honesto. La mejor
  sección técnica de la app.
- **P:** "pagar 10 veces la ganancia anual" — la fórmula visible es didáctica de verdad.
- **C:** dos múltiplos + fallback EV/EBIT + rangos distintos = densa incluso para nivel 3;
  el rango de "diversas" (8-18) mezcla seguros con puertos — comparación sin sentido económico;
  bancos: la guía promete P/B+ROE y la sección solo da P/E.
- **F:** P/E relativo a la PROPIA historia ("su P/E hoy vs su rango de 12 meses") — con
  históricos + EPS ya se puede aproximar; el "por qué" del rango sectorial (¿quién decidió 9-15?).
- **Ej:** el aviso cíclico debería ir con ejemplo numérico: "si el oro cayera 25%, la ganancia
  de BVN podría caer a la mitad y este P/E 9.6 se convertiría en 19 → ya no estaría barata".
- **Cmp:** "las otras mineras hoy: Poderosa 11.3, Cerro Verde 15.3" — una línea, contexto instantáneo.
- **Err:** P/E bajo = ganga (en cíclicas es lo contrario en el pico); comparar P/E entre sectores;
  usar P/E con precio viejo (ya avisado ✔).
- **T:** ES el tour más importante al desbloquear nivel 3 — ver §6.

### 3.10 Ficha — Simuladores
- **E:** magnitud de ganar/perder sin arriesgar. Anti-humo: enseña que también se pierde.
- **C:** los % son fijos POR SECTOR (minas -32% "mal") aunque la app YA calcula la volatilidad
  real de cada empresa — una minera tranquila y una junior usan el mismo -32%.
- **F:** de dónde salen esos % ("¿por qué -32?").
- **Ej:** usar la volatilidad real: "en su peor racha de 12 meses, ESTA acción cayó X% — así se
  sentiría en tu bolsillo".
- **Err:** leer "bien +22%" como probabilidad y no como escenario.
- **T:** paso de tour: "mueve el monto; fíjate que 'mal' también existe — si ver -S/320 te
  duele en un juego, en la vida real duele el triple".

### 3.11 Ficha — Tips + Fundamentos + Guía del sector (nivel 2)
- **E:** el corazón educativo. La guía con dato real inyectado por métrica es un diseño excelente.
- **C:** la guía es un MURO de texto (7-8 métricas × párrafo); llega después de los tips y muchos
  no la alcanzan; los tips generados a veces contradicen la guía (caso BCP §1).
- **F:** jerarquía visual: cuál de las 7 métricas es LA importante en este sector ("Lo que más
  manda" está al FINAL — debería abrir la guía, no cerrarla).
- **Ej/Cmp/Err:** cada métrica de la guía debería cerrar con su error típico en una línea roja
  ("⚠ error común: …") — el contenido de tus preguntas 6 y 7, sistematizado.
- **T:** tour de nivel 2 al desbloquear: recorre tips → fundamentos → guía y enseña el ORDEN de
  lectura ("primero 'lo que más manda', después el resto").

### 3.12 Ficha — Producción minera (nivel 3)
- **E:** producción real MINEM, participaciones, % del Perú. Única en su tipo — nadie más lo tiene.
- **C:** huecos del top-10 (ya explicados con notas doradas ✔); TMF/g finos/kg finos siguen siendo
  marcianos aunque estén glosados; la conexión producción→ingresos no se enseña.
- **F:** el puente: "más onzas × precio del metal = ingresos; por eso esta gráfica ANTICIPA los
  resultados del trimestre" — esa frase convierte la sección de curiosidad en herramienta.
- **Ej:** "BVN produjo X oz en el 2T y el oro promedió US$Y → por eso el HI de producción del
  16-jul importa: es el adelanto de los resultados".
- **Err:** confundir producción de la ENTIDAD con la participación de la empresa (Cerro Verde
  produce mucho, pero a BVN solo le toca 19.58%).
- **T:** tour propio de la sección al desbloquear nivel 3 en una minera.

### 3.13 Ficha — Catalizadores / Escenarios / Riesgos (nivel 3)
- **E:** qué puede mover el precio; documentado vs rumor (distinción MUY valiosa).
- **C:** "catalizador" es jerga pura para quien acaba de subir de nivel; escenarios y simulador
  se pisan (ambos hablan de bien/regular/mal); los riesgos no están rankeados (el mortal y el
  menor pesan igual visualmente).
- **F:** qué HACER con un catalizador (anotarlo, esperarlo, vigilar la fecha) — conectar con
  los recordatorios del Cuaderno.
- **Ej:** un caso cerrado: "el catalizador X de [empresa] se cumplió en [fecha] y el precio hizo
  Y — así se usa esto" (aprendizaje por historia real, no por teoría).
- **Err:** comprar por rumor (la etiqueta ya educa ✔); creer que catalizador = certeza.
- **T:** incluido en el tour de nivel 3.

### 3.14 Ficha — Nivel 4 (Hechos, Sentinel, Documentos, Fuentes, Reloj)
- **E:** el análisis primario de verdad: leer la fuente.
- **C:** Sentinel es potentísimo pero su flujo de 4 pasos (abrir PDF → descargar → volver →
  soltar) pierde gente; los EEFF de DocumentosOficiales asustan sin un mapa de lectura.
- **F:** "cómo leer un Hecho de Importancia en 60 segundos" y "los EEFF en 10 minutos: qué
  página abrir primero" — guías de combate, no de teoría.
- **Ej:** un HI real ANOTADO (el de dividendos de BVN con flechitas: aquí el monto, aquí el corte).
- **T:** tour de nivel 4 al desbloquear + tour interno de Sentinel con un PDF de ejemplo precargado
  (mismo patrón que la cartera demo del Cuaderno — la simulación que se borra sola ya existe ahí).

### 3.15 Comparador
- **E:** comparar bien (indexado a 100, magnitud no veredicto, aviso de sectores distintos).
- **C:** el aviso de sectores distintos es genérico ("sus números se leen diferente") — no dice
  POR QUÉ para ESE par.
- **F:** la razón concreta del par: BCP vs BVN → "la 'deuda' del banco son depósitos (su materia
  prima); la de la minera es riesgo de ciclo — no las compares".
- **Ej/Cmp:** duelos didácticos precargados sugeridos ("los clásicos"): BVN↔Poderosa, BCP↔Interbank,
  Alicorp↔Gloria, Luz del Sur↔Engie, UNACEM↔Pacasmayo — un botón "duelos famosos".
- **Err:** elegir "la que ganó la carrera" (pasado ≠ futuro; ponerlo en la nota educativa).
- **T:** tour del Comparador — HOY NO EXISTE y es la pantalla más densa de la app.

### 3.16 Mi Cuaderno
- **E:** cartera real, flujo de dividendos, concentración (la torta). Tour con demo: el mejor de la app.
- **F:** la torta avisa concentración por EMPRESA/sector pero no el lente: "80% mineras = tu
  patrimonio ES el precio de los metales, aunque tengas 5 empresas distintas" (diversificar entre
  5 mineras NO es diversificar).
- **Ej:** yield on cost ("a tu precio de compra, tu dividendo te rinde X% — distinto del yield
  de pantalla").
- **Err:** contar dividendos estimados como sueldo fijo (ya avisa "no promesas" ✔).
- **T:** ya existe y es modelo a seguir; sumar el paso de concentración sectorial.

### 3.17 Atlas + Glosario
- **E:** respuesta con datos verificados; términos en árbol.
- **C:** Atlas está escondido tras el menú ☰ y el usuario no sabe QUÉ preguntarle en cada
  contexto; el glosario es diccionario (consulta), no curso (secuencia).
- **F:** botones "🧠 pregúntale a Atlas" CONTEXTUALES en cada sección de la ficha ("¿por qué
  está barata?", "¿qué dijo la gerencia?") — Atlas ya sabe responderlas; falta el puente de UI.
- **T:** tour de Atlas de 3 pasos con chips reales; en el glosario, "rutas" ordenadas (de
  'acción' a 'EV/EBITDA' en 12 términos).

---

## 4. Playbook por sector — el lente antes que el número

La regla pedida: **antes de juzgar un indicador, la app declara el lente.** Por sector: qué manda,
cómo se lee la deuda (el ejemplo ácido), el error típico, el par comparable en la app, y un caso
histórico peruano para contarlo.

| Lente | Vive de | La deuda se lee… | Error típico | Par en la app | Caso peruano para enseñar |
|---|---|---|---|---|---|
| **Mineras** | precio del metal − cash cost | contra la caja del FONDO del ciclo, no del pico | P/E bajo en pico = "ganga" | BVN↔Poderosa | Volcan 2015-16: zinc en el piso, la acción a centavos; 2016-17 el zinc dobló y la acción ×5. El MISMO negocio. |
| **Bancos** | margen financiero (presta caro, capta barato) | NO se lee: los pasivos son materia prima; mirar CET1, mora, ROE | sumar depósitos como "deuda" | BCP↔Interbank | Retiros AFP 2020-22: liquidez inundó y luego secó el sistema. |
| **Seguros** | primas + rendimiento de invertirlas | reservas técnicas ≠ deuda; mirar siniestralidad y resultado técnico | leer primas como "ventas" | Rímac↔Pacífico | El Niño 2017/2023: los siniestros se comen un año entero de resultado técnico. |
| **Salud (AUNA)** | ocupación de camas/consultas — flujo estable | como una utility: años de EBITDA; 3.6x manejable SI el flujo no cae | aplicarle el susto minero a su deuda | AUNA (sola) — comparar con Luz del Sur en ESTABILIDAD, no en negocio | AUNA misma: compró clínicas con deuda; el mercado la castiga hasta ver el desapalancamiento <3x. |
| **Eléctricas** | tarifa regulada × demanda | deuda alta y larga es el estado NORMAL; riesgo = tasas y regulador | asustarse por el monto | Luz del Sur↔Engie | Sequías: años de mala hidrología aprietan margen de las hidro. |
| **Cemento/Construcción** | despachos (obra pública + autoconstrucción) | contra el ciclo de obra; cómoda en auge, pesada en freno | extrapolar el auge | UNACEM↔Pacasmayo | Aenza (ex Graña y Montero): Lava Jato 2017 — el riesgo de gobernanza destruye más valor que cualquier ciclo. |
| **Retail/Consumo** | ticket × tráfico, rotación de inventario | media: la caja predecible la sostiene (mirar deuda/EBITDA ~3x) | ignorar capital de trabajo e inventarios | InRetail↔Falabella (grupo) | InRetail: compró farmacias (Quicorp 2018) con deuda y la digirió con caja de supermercados. |
| **Pesqueras** | cuota × biomasa × precio harina | ojo: se endeudan ENTRE vedas para operar | anualizar un trimestre de temporada | Austral↔Exalmar | El Niño 2014 y 2023: vedas extendidas, año casi sin pesca. |
| **Agro/Azúcar** | rendimiento de campo × precio commodity | contra la zafra y el clima | ignorar el riesgo social/laboral | Casa Grande↔Cartavio | Azucareras norteñas: décadas de crisis societaria — el papel barato puede serlo para siempre. |
| **Acereras** | construcción + precio acero/chatarra | cíclica, como minera | comprar en pico de obra | Aceros↔Sider | Dumping chino: Indecopi y los aranceles mueven el margen de un año entero. |
| **Textil** | demanda externa × tipo de cambio | peligrosa: no hay caja estable que la respalde | creer que margen fino = empresa mala (es el negocio) | Creditex↔Michell | Michell: vive de la alpaca y reparte lo que gana — el textil que funciona es el de nicho. |
| **Telecom (Integratel)** | abonados × tarifa — capex eterno | alta y renovable SI los abonados no caen; patrimonio negativo = alerta real | "es Telefónica, es segura" | — (única) | Integratel: patrimonio NEGATIVO tras años de guerra de precios — la marca no paga la deuda. |
| **Transporte/Concesiones** | tráfico × peaje/tarifa, con FECHA DE CADUCIDAD | de proyecto: alta al inicio, se amortiza con el tráfico; mirar plazo de concesión | valorar la concesión como si fuera eterna | Red Vial 5↔Inca Rail | Inca Rail: la pandemia cortó el turismo y el dividendo murió — ingreso concentrado en UN activo. |
| **AFP** | comisión × fondo administrado | irrelevante; el riesgo es REGULATORIO | analizar la rentabilidad de TU fondo en vez de la EMPRESA | Prima↔Integra | Retiros 2020-22: el Congreso encogió el fondo → menos comisión → y de paso tumbó la BVL. |
| **Fondos** | la canasta | no aplica; mirar TER y qué hay dentro | comprar el nombre sin ver la canasta | FIBRA Prime↔Fibra Credicorp | FIBRAs vs tasas: cuando el BCR subió tasas, las rentas valían menos. |
| **Holdings** | dividendos de sus hijas | mirar el GRUPO consolidado, nunca el individual | leer el margen individual (~100%, falso) | IFS↔Credicorp | Ya resuelto en app con esHolding — convertirlo en lección visible. |

**Implementación conceptual (sin código todavía):** un campo `lente` por empresa (salud, seguros,
concesión, telecom, inmobiliaria, industrial…) que por defecto hereda del sector. La guía, el
veredicto de deuda, los avisos del comparador y los guiones del tour leen el LENTE, no el sector.
Así "diversas" deja de ser un cajón ciego sin romper la taxonomía existente (Explorar, quiz,
escenarios siguen funcionando igual).

---

## 5. Nunca un indicador solo — los combos del analista

Tu bloque final, sistematizado. Estas son las 10 lecturas cruzadas que un analista hace en
automático y que la app puede componer con datos que YA tiene (patrón redactor.js: plantillas con
slots verificados; si falta el dato, la frase no se escribe):

1. **P/E bajo + margen récord + sector cíclico** → probable pico de ciclo: la "ganga" es espejismo.
   (BVN: P/E 9.6 + margen 84% + oro caro = exactamente esta foto.)
2. **P/E bajo + precio viejo** → no es ganga, es iliquidez. (Ya avisado ✔ — sumarlo al combo.)
3. **Yield alto + FCF < dividendos pagados** → dividendo financiado con deuda o caja vieja:
   insostenible. El más valioso de todos para el público dividendero de ALTO.
4. **Yield >20% + un solo pago** → extraordinario, no lo anualices. (Ya existe ✔.)
5. **Deuda alta + flujo estable (lente salud/utility)** → manejable: se amortiza en años; vigilar
   tasas y el plan de desapalancamiento (AUNA <3x).
6. **Deuda alta + flujo cíclico (lente minero)** → bomba de tiempo si el metal cae; mirar
   vencimientos y caja. La MISMA deuda del combo 5, veredicto opuesto.
7. **Deuda "gigante" + lente banco** → error de categoría: cambiar de métrica (CET1, mora, ROE),
   no de opinión.
8. **CAPEX alto + FCF negativo + proyecto documentado** → inversión, no enfermedad (mina en
   construcción, puerto en ramp-up: Chancay, San Gabriel de BVN). FCF negativo SIN proyecto → alerta.
9. **Margen que se aprieta + costos (energía/insumo/TC) subiendo** → el margen avisa ANTES que
   la utilidad: es el indicador adelantado.
10. **Producción subiendo + precio del metal estable** → ingresos del trimestre que viene, hoy
    (BEM como adelanto del HI de resultados — único de ALTO).

**Dónde vive esto:** una sección "🧠 Lectura de analista" (nivel 4, o el cierre del nivel 3) que
narra los combos que APLICAN a esa empresa, cada uno con su semáforo y su "por qué". Es la
materialización literal de tu regla: ningún número se pronuncia solo.

---

## 6. El tour progresivo — 5 profundidades por indicador

Tu esquema de 5 niveles, mapeado a los 4 niveles de la app (el N5 tuyo = "cómo lo combina un
analista" vive dentro del nivel 4 como "Lectura de analista"):

| Tu nivel pedagógico | Nivel de la app | Qué hace el tour |
|---|---|---|
| 1. Qué es (sin asumir nada) | N1 💸 | nombra la cosa con analogía y el dato real |
| 2. Cómo se interpreta | N2 🟡 | qué es alto/bajo/normal EN ESTE SECTOR |
| 3. Cómo se usa para decidir | N3 📊 | qué harías tú con este número (estudiar más, vigilar, descartar) |
| 4. Excepciones y casos especiales | N3/N4 | cuándo el número miente (ciclo, holding, iliquidez, moneda) |
| 5. Cómo se combina con otros | N4 👑 | los combos de §5 con los datos de la empresa |

### Guion completo de ejemplo — LA DEUDA (tu ejemplo estrella)

**N1 (bebé):** "La empresa debe plata, como cualquiera puede deber la casa o el carro. Deber no es
malo por sí solo — lo importante es si le alcanza para pagar."
**N2 (interpretar, POR LENTE):**
- Minera (BVN/Volcan): "Su caja depende del precio del metal. Deuda cómoda hoy puede ser soga si
  el oro cae. Regla de este sector: la deuda se juzga imaginando el metal BARATO."
- Salud (AUNA): "Los hospitales cobran todos los meses, pase lo que pase con la economía. Por eso
  puede deber 3.6 veces su ganancia anual y pagarla en años, como una hipoteca con sueldo fijo.
  Lo que vigila el mercado: que baje de 3x como prometió."
- Banco (BCP): "¡Alto ahí! Los 'pasivos' de un banco son los DEPÓSITOS de la gente — su materia
  prima, no su enfermedad. A un banco se le pregunta otra cosa: ¿cuánto colchón tiene (capital)?
  ¿le pagan sus deudores (morosidad)?"
- Eléctrica (Luz del Sur): "Debe mucho A PROPÓSITO: con ingreso regulado se presta barato a 20
  años. Aquí deuda alta es normal; el peligro es que suban las tasas."
**N3 (decidir):** "Divide la deuda entre lo que la empresa genera al año: eso da los AÑOS que
tardaría en pagarla. Menos de 2 = holgada; 2-4 = depende del lente (¿flujo estable o cíclico?);
más de 4 = necesitas una muy buena razón documentada."
**N4 (excepciones):** "Tres trampas: (a) moneda — deuda en dólares con ingresos en soles = riesgo
cambiario escondido (Petroperú); (b) vencimientos — no es lo mismo deber a 2030 que el próximo
diciembre; (c) holdings — la deuda de la matriz no es la del grupo."
**N5 (combinar):** "El analista cruza: deuda vs FCF (¿la paga sola?), vs margen (¿si el margen se
aprieta, sigue alcanzando?), vs catalizadores (¿hay refinanciación anunciada?). Nunca el monto solo."

### Guiones resumidos de los demás (misma estructura, para escribir en la próxima sesión)

- **P/E:** N1 "años de ganancia que pagas por entrar" → N2 rango del sector → N3 barata/cara como
  PUNTO DE PARTIDA de estudio, no veredicto → N4 la trampa cíclica con número (si el oro cae 25%,
  el P/E 9.6 se vuelve 19) + pérdida (no hay P/E) + precio viejo → N5 P/E+margen+ciclo (combo 1).
- **Dividendos:** N1 "te pagan por ser socio" → N2 yield y frecuencia vs el sector → N3 la fecha
  de corte (el mecanismo con línea de tiempo) → N4 extraordinarios, pagos en acciones (bancos),
  moneda → N5 yield vs FCF (combo 3: ¿es sostenible?).
- **FCF:** N1 "la plata que de verdad sobra en la caja al final del mes" → N2 positivo constante =
  se autofinancia → N3 FCF cubre el dividendo = dividendo confiable → N4 FCF negativo por proyecto
  documentado no es enfermedad (Chancay, San Gabriel); en bancos no aplica → N5 combos 3 y 8.
- **Margen:** N1 "de cada 100 que vende, cuánto le queda" → N2 fino-estable (consumo) vs grueso-
  saltarín (minas) → N3 margen apretándose = alerta temprana → N4 holdings (margen falso ~100%),
  cíclicas en pico → N5 combo 9.
- **Volatilidad:** N1 "cuánto se sacude" → N2 etiquetas del termómetro → N3 elegir según tu
  estómago (conecta con el quiz) → N4 "poco negociada" NO es "tranquila": es un precio congelado
  → N5 volatilidad × concentración de cartera (Cuaderno).
- **Producción (mineras):** N1 "cuánto metal sacó" → N2 la serie y el % del Perú → N3 producción ×
  precio = adelanto de resultados → N4 top-10 del BEM (huecos honestos), participación ≠ entidad →
  N5 combo 10.

---

## 7. Arquitectura del tour por niveles (la mejora que pediste explícitamente)

Hoy: 4 tours de PANTALLA (inicio/ficha/explorar/cuaderno), iguales para todos los niveles.
Propuesta — 3 capas, todas montadas sobre el TourGuia existente (que ya salta pasos sin elemento,
así que los pasos por nivel degradan solos):

**Capa A — Tour de pantalla por nivel (lo urgente).** `PASOS_FICHA` se parte por nivel:
- `PASOS_FICHA_BASE` (todos): radiografía, precio, tesis, dividendos, simulador, estrella.
- `PASOS_FICHA_N2`: tips → fundamentos → guía ("el orden de lectura: primero 'lo que más manda'").
- `PASOS_FICHA_N3`: valoración (con la fórmula y el aviso cíclico SI aplica), termómetro,
  producción minera (si es minera), catalizadores, escenarios, riesgos.
- `PASOS_FICHA_N4`: reloj, hechos, Sentinel, documentos, fuentes, lectura de analista.
El tour normal (❓) concatena BASE + los del nivel actual.

**Capa B — Tour de DESBLOQUEO (el momento mágico).** Al subir de nivel dentro de una ficha
(nivel-cta o el anzuelo de la radiografía), en vez de solo aparecer las secciones nuevas:
"✨ Acabas de desbloquear 4 secciones — ¿te las presento?" → mini-tour SOLO de lo nuevo, con los
datos de ESA empresa. Es la respuesta directa a "meterlo en todos los niveles por cada punto".
Hoy ese momento — el de mayor curiosidad y mayor confusión — está mudo.

**Capa C — Micro-tours de indicador (el ❓ de cada sección).** Un icono discreto por sección
(valoración, dividendos, deuda…) que lanza el guion de §6 A LA PROFUNDIDAD del nivel actual,
con los números reales de la empresa y el LENTE del sector. Guiones = datos (JSON de plantillas
con slots, estilo redactor.js), no código nuevo por empresa.

**Tours de pantalla que faltan por completo:** Resultados del quiz, Comparador, Atlas, Glosario,
Sentinel (con documento de ejemplo precargado, patrón cartera-demo del Cuaderno).

---

## 8. Las 100 mejoras priorizadas

**[P0] = el corazón (próxima sesión) · [P1] = alto impacto · [P2] = medio · [P3] = pulido/futuro**

### El tour y el onboarding (1–20)
1. **[P0]** Tour de ficha POR NIVEL (capa A de §7): pasos propios para N2, N3 y N4.
2. **[P0]** Tour de DESBLOQUEO al subir de nivel: presenta solo las secciones recién abiertas (capa B).
3. **[P0]** Guiones del tour con el DATO REAL de la empresa y su lente sectorial, no texto genérico.
4. **[P0]** Tour del Comparador (la pantalla más densa hoy no tiene ninguno).
5. **[P0]** Tour de Resultados del quiz: qué significa tu perfil y POR QUÉ salieron esas empresas.
6. **[P1]** Micro-tours ❓ por indicador con los guiones de 5 profundidades de §6 (capa C).
7. **[P1]** Tour de Atlas (3 pasos con chips reales según contexto).
8. **[P1]** Tour de Sentinel con PDF de ejemplo precargado que se borra solo (patrón cartera-demo).
9. **[P1]** Partir el tour del inicio en "lo esencial" (5 pasos) + "el resto" opcional (11 agotan).
10. **[P1]** Cierre de cada tour con puente: "¿te llevo a tu primera ficha con el tour puesto?"
11. **[P1]** Paso condicional en Explorar cuando el usuario ordena por yield (la trampa del yield).
12. **[P1]** Paso condicional en la ficha si la empresa es `pocoNegociada` ("esto cambia todo lo de abajo").
13. **[P2]** Micro-tour de 2 pasos al ELEGIR nivel por primera vez (qué desbloqueaste / qué te espera).
14. **[P2]** Mini-quiz de 1 pregunta al cerrar un tour ("¿qué aprendiste?") con la moneda como premio sonoro.
15. **[P2]** "Tours vistos" en localStorage con badge de progreso (3 de 7 pantallas exploradas).
16. **[P2]** Tour del Glosario: cómo buscar, las ramas, y las rutas (mejora 47).
17. **[P2]** Re-ofrecer el tour de desbloqueo si el usuario cambió de nivel desde el badge 🎚️ (no solo desde la CTA).
18. **[P3]** Guiones de tour también en el Cuaderno por nivel (hoy es único).
19. **[P3]** "Modo profesor": reproducir todos los micro-tours de una ficha en secuencia (clase completa de ~5 min).
20. **[P3]** Atajo de teclado/gesto para reabrir el último tour donde quedó.

### Lentes sectoriales (21–40)
21. **[P0]** Campo `lente` por empresa (salud, seguros, concesión, telecom, inmobiliaria, agro,
    industrial…) que hereda del sector y lo refina — "diversas" deja de ser cajón ciego.
22. **[P0]** Guía propia de SEGUROS (Rímac, Mapfre, Pacífico, Interseguro, Positiva Vida): primas,
    siniestralidad, resultado técnico vs financiero, por qué FCF no aplica.
23. **[P0]** Guía propia de SALUD para AUNA: deuda alta + flujo estable = hipoteca con sueldo fijo;
    apalancamiento 3.6x y meta <3x como ejemplo vivo.
24. **[P0]** Auditar TODOS los tips generados por enrich_tips contra la guía del lente (el tip de
    deuda de BCP contradice su propia guía; revisar bancos, seguros, AFP, holdings).
25. **[P1]** Guía de CONCESIONES (Red Vial 5, Inca Rail, Chancay): tráfico, plazo de la concesión,
    la fecha de caducidad como concepto central.
26. **[P1]** Guía de TELECOM para Integratel: abonados, capex eterno, qué significa patrimonio negativo.
27. **[P1]** Guía INMOBILIARIA (Los Portales, Futura, IDE): preventas, tasas hipotecarias, rentas.
28. **[P1]** Guía AGRO/AZÚCAR (Casa Grande, Cartavio, Pomalca, Laredo, Paramonga): zafra, clima,
    riesgo societario — hoy se leen con la guía de "alimentos" que habla de fideos y leche.
29. **[P1]** "Lo que más manda" ABRE la guía del sector en vez de cerrarla (jerarquía de lectura).
30. **[P1]** Cada métrica de la guía cierra con "⚠ error común" en una línea (tus preguntas 6-7 sistematizadas).
31. **[P1]** El aviso de sectores distintos del Comparador dice la razón CONCRETA del par
    (banco vs minera: depósitos ≠ deuda; minera vs eléctrica: cíclico vs regulado).
32. **[P1]** El rango P/E de "diversas" (8-18) se reemplaza por rangos por LENTE o por la
    comparación contra la propia historia (mejora 45) — comparar AUNA con un puerto no enseña nada.
33. **[P2]** Termómetro y simulador leen el lente: una concesión turística (Inca Rail) no se simula
    como una inmobiliaria.
34. **[P2]** Chips de lente en Explorar (filtro fino dentro de "diversas": salud, seguros, concesiones…).
35. **[P2]** Página "radar del sector": tabla de todas las empresas del sector con mediana de P/E,
    yield y deuda/EBITDA — el contexto que hoy falta para "comparar contra algo".
36. **[P2]** El quiz distingue lentes en la pregunta de sector cuando el usuario es N3+ (a un
    principiante no; la lista de 12 ya es larga).
37. **[P2]** sectorTips por lente en Resultados (hoy AUNA recibe el tip de "diversas").
38. **[P2]** notaSector de escenarios por lente (mismo motivo).
39. **[P3]** Página educativa "el mapa de la BVL": qué sectores existen, cuánto pesa cada uno,
    por qué la BVL es minera hasta cuando no lo parece (las AFP venden mineras en los retiros).
40. **[P3]** Etiqueta de lente visible en la cabecera de la ficha ("🏥 salud · se lee como flujo estable").

### Indicadores nuevos y lecturas cruzadas (41–60)
41. **[P0]** Indicador "¿Puede pagar su deuda?": deuda neta ÷ EBITDA (o FCF) en AÑOS, con umbrales
    POR LENTE (banco: no aplica + qué mirar; utility/salud: hasta ~4x; cíclicas: ámbar desde ~2x).
42. **[P0]** Globo nuevo en la radiografía: "¿Debe mucho?" con ese veredicto — la deuda entra por
    fin a los 10 segundos que todos ven.
43. **[P0]** Sección "🧠 Lectura de analista" (N4): los combos de §5 que apliquen a la empresa,
    compuestos con slots verificados estilo redactor.js — la materialización de "nunca un
    indicador solo".
44. **[P0]** El asterisco de ciclo SUBE al globo "¿Barata o cara?" en niveles 1-2 ("Barata* · es
    minera: su ganancia sube y baja con el metal") — hoy el veredicto pelado es el mayor riesgo
    educativo de la app.
45. **[P1]** P/E vs su PROPIA historia: percentil del P/E actual contra los 12-18 meses de
    histórico ya descargado ("hoy está en la parte baja/alta de SU rango").
46. **[P1]** P/B + ROE para bancos en Valoración — la guía lo promete y la sección no lo cumple
    (patrimonio ya viaja en balanceDestacado de varios bancos; completar extractor si falta).
47. **[P1]** Sostenibilidad del dividendo: comparar dividendos pagados vs FCF del año → semáforo
    "se lo puede pagar / lo está forzando" (combo 3, el más valioso para tu público).
48. **[P1]** Fecha de corte como lección visual de N1: línea de tiempo compra→corte→pago en el
    resumen de dividendos (el mecanismo, no solo las fechas).
49. **[P1]** Descalce de moneda: aviso cuando la deuda está en US$ y los ingresos en S/ (Petroperú
    como caso de libro; el dato de moneda ya existe).
50. **[P1]** El ejemplo numérico del aviso cíclico: "si el metal cayera 25%, este P/E 9.6 sería ~19"
    — una resta que vale más que tres párrafos.
51. **[P2]** Vencimientos de deuda cuando las notas de los EEFF los den (notas.json ya digiere
    covenants/deuda): "casi toda vence después de 2028" cambia el veredicto.
52. **[P2]** Payout visible con lectura ("reparte el 91% de lo que gana: casi no guarda para crecer").
53. **[P2]** Contexto de ciclo del metal: precio del metal hoy vs su promedio de la serie BEM/histórica
    ("el cobre está en zona alta") — insumo para el combo 1 sin predecir nada.
54. **[P2]** El simulador usa la volatilidad REAL de la empresa (ya calculada) en vez del % fijo
    sectorial; "en su peor racha de 12 meses cayó X%".
55. **[P2]** "Qué mirar el próximo trimestre": checklist por empresa generado de catalizadores +
    calendario (conecta con recordatorios del Cuaderno).
56. **[P2]** Racha de dividendos: "ha pagado N años seguidos" (historial ya existe en dividendos.json).
57. **[P2]** ROE para todas las que tengan patrimonio en balanceDestacado, con lectura por lente.
58. **[P3]** Cash cost minero cuando alguna fuente oficial lo dé (si no hay fuente, honesto: no se muestra).
59. **[P3]** Beta local aproximada (correlación con la cinta BVL) como "¿se mueve con el mercado o sola?" educativo.
60. **[P3]** "La empresa entera" (EV) explicada con la analogía de comprar la bodega: pagas el
    traspaso Y asumes lo que debe.

### Ejemplos, casos históricos y analogías (61–75)
61. **[P1]** Módulo "Historias de la BVL": mini-casos de 5 líneas con moraleja — Volcan 2015-17
    (ciclo), Aenza/Lava Jato (gobernanza), Inca Rail/pandemia (concentración), Petroperú/Talara
    (deuda+moneda), retiros AFP (mercado ilíquido), BVN-SUNAT (contingencias), azucareras (papel
    barato para siempre). Cada ficha enlaza el caso de SU lente.
62. **[P1]** Biblioteca de analogías curada por indicador/lente (hipoteca con sueldo fijo = AUNA;
    harina del panadero = depósitos del banco; tienda que cierra por veda = pesquera; peaje con
    fecha de caducidad = concesión) — una analogía fija por concepto, usada consistentemente en
    guías, tours y Atlas.
63. **[P1]** "Duelos famosos" precargados en el Comparador (BVN↔Poderosa, BCP↔Interbank,
    Alicorp↔Gloria, Luz del Sur↔Engie, UNACEM↔Pacasmayo) con una línea de qué enseña cada duelo.
64. **[P1]** Un Hecho de Importancia real ANOTADO (flechitas: aquí el monto, aquí la fecha de
    corte) como lección de Sentinel/N4.
65. **[P2]** "Qué pasó después": revisitar catalizadores pasados cumplidos/incumplidos y qué hizo
    el precio — aprendizaje por historia real, sin predicción.
66. **[P2]** Guía "los EEFF en 10 minutos": qué página abrir primero, qué ignorar (para
    DocumentosOficiales N4).
67. **[P2]** Guía "un HI en 60 segundos": título → categoría → monto → fechas (Sentinel ya extrae
    todo esto; falta enseñar el método manual).
68. **[P2]** En cada resultado del quiz, el "por qué salió" ("elegiste dividendos: esta reparte
    6.1% con caja estable").
69. **[P2]** El anti-ejemplo del quiz: "esta NO te salió porque es montaña rusa y pediste dormir tranquilo".
70. **[P2]** Píldoras (¿Sabías que?) conectadas al lente del día ("¿sabías que la deuda de un banco
    no es deuda?") — hoy son datos sueltos.
71. **[P3]** "El diccionario de la calle": jerga bursátil peruana real (papel, jugada, el humo)
    traducida al vocabulario correcto.
72. **[P3]** Casos internacionales espejo SOLO cuando iluminan lo local (Southern↔SCCO,
    AUNA↔hospitales USA) — con moderación.
73. **[P3]** Línea de tiempo de cada empresa (hitos de sus HI del año) como historia visual.
74. **[P3]** "El error del mes": rotar un error clásico documentado con su caso real (estilo
    empresa del día).
75. **[P3]** Video/carrusel TikTok generado de un caso histórico (conecta con el pendiente de promo).

### Flujo de aprendizaje y UX (76–90)
76. **[P1]** "Academia ALTO": ruta de lecciones ordenadas (qué es una acción → cómo se compra en
    Perú → dividendos → P/E → deuda por lente → leer un HI) armada 100% con contenido existente
    (glosario+guías+fichas ejemplo), progreso en localStorage.
77. **[P1]** Lección 0 que HOY NO EXISTE: cómo se compra una acción en el Perú de verdad — qué es
    una SAB, cuánto cobra, el mínimo práctico, cuánto demora. Sin esto, todo lo demás es teoría.
78. **[P1]** Costos e impuestos reales: comisiones SAB, 5% a la ganancia de capital, retención de
    dividendos — el simulador podría mostrar el neto ("de S/100 de dividendo te llegan ~S/95").
79. **[P1]** Tooltips por nivel: Glosado da la definición corta en N1-2 y suma "cómo lo usa un
    analista" en N3-4 (los términos ya están; es una segunda oración por término clave).
80. **[P2]** Renombrar nivel 1 ("¿Cuánto podría ganar?" promete ganancia — p. ej. "Ver cómo se
    mueve mi dinero") y nivel 4 ("Lobo de wall street" es el estafador de la película — p. ej.
    "Analista completo"). Decisión de Jair; la marca es honestidad.
81. **[P2]** Rutas en el glosario: secuencias ordenadas de términos (de 'acción' a 'EV/EBITDA' en
    12 pasos) además del árbol.
82. **[P2]** Botones contextuales "🧠 pregúntale a Atlas" por sección de la ficha con la pregunta
    ya escrita ("¿por qué está barata BVN?", "¿qué dice la gerencia?") — Atlas ya sabe responder;
    falta el puente.
83. **[P2]** El quiz sugiere nivel inicial (una pregunta más: "¿sabes qué es un dividendo?") —
    hoy nivel y quiz no se hablan.
84. **[P2]** Jerarquía visual en riesgos: el mortal primero y marcado (hoy todos pesan igual).
85. **[P2]** Fusionar la narrativa de Escenarios y Simulador (se pisan): el simulador ES los
    escenarios con plata imaginaria — contarlo junto.
86. **[P2]** Aviso de liquidez a nivel 1 en ilíquidas (hoy la explicación vive en el termómetro N3;
    el riesgo es de plata real, no un tecnicismo).
87. **[P3]** Insignias de aprendizaje (leíste tu primera guía completa, comparaste tu primer duelo,
    abriste tu primer HI) — con la estética de la moneda.
88. **[P3]** Modo "explícame como a un niño": botón que baja temporalmente cualquier sección a
    lenguaje N1 sin cambiar el nivel guardado.
89. **[P3]** Buscador que entiende preguntas ("¿quién paga más dividendos en bancos?") ruteando a
    Atlas/Explorar según el caso.
90. **[P3]** Accesibilidad del tour: leer pasos en voz alta (Web Speech API, cero dependencias).

### Cuaderno, Comparador y ecosistema (91–100)
91. **[P1]** Concentración por LENTE en la torta del Cuaderno: "tienes 5 empresas pero 80% son
    mineras: tu patrimonio ES el precio de los metales" — diversificar entre 5 mineras no es diversificar.
92. **[P1]** Yield on cost en el Cuaderno ("a TU precio de compra, este dividendo te rinde X%").
93. **[P2]** El Cuaderno detecta combos de §5 en TU cartera ("2 de tus 4 empresas tienen dividendo
    forzado sobre su FCF").
94. **[P2]** Comparador: además de la razón del par (31), sugerir el par correcto ("para comparar
    un banco, mejor: Interbank").
95. **[P2]** Simulación educativa de cartera: la misma plata en 1 empresa vs repartida en 3 del
    mismo sector vs 3 de sectores distintos, con los históricos reales del último año.
96. **[P2]** AvisoNovedades enseña al avisar: el toast del hecho nuevo dice la categoría en
    cristiano ("convocó a junta: ahí suelen decidirse dividendos").
97. **[P3]** "Mi diario de decisiones" en el Cuaderno: por qué guardaste/compraste (texto libre) —
    releerse a uno mismo es la lección más barata del mundo.
98. **[P3]** Exportar del Cuaderno una tarjeta-resumen compartible (imagen) sin datos sensibles.
99. **[P3]** Comparador de 3 (hoy 2) SOLO en N4, manteniendo el diseño de duelo para el resto.
100. **[P3]** Las preguntas sin respuesta de Atlas (localStorage alto-atlas-sin-respuesta) alimentan
     un FAQ público mensual — el usuario ve que preguntar mejora la app.

---

## 9. Qué haría primero mañana (con Fable renovado y los US$100)

Orden sugerido de implementación, máximo aprendizaje por sol invertido:

1. ~~**Sesión 1 — El lente y la deuda (mejoras 21-24, 41-44)**~~ ✅ **HECHA el 22-jul-2026.**
   Entregado: `lentes.json` + `lib/lente.js` con 19 lentes (#21) · guías propias de seguros,
   salud, concesiones, telecom, inmobiliaria, agro y combustibles (#22-#28) · "⚠ error común" en
   todas las métricas de todas las guías (#30) y "lo que más manda" abriendo la guía (#29) ·
   `PuedePagarDeuda.jsx` con años de caja y umbrales por lente (#41) + globo "¿Debe mucho?"
   (#42) · asterisco de ciclo en el globo "Barata" (#44) · auditoría de 176 tips (#24, E5, E6,
   E7) · "💰 Vive de:" (#102) · "🗣 ¿Por qué le fue así este trimestre?" con gerencia.json en
   N2 (#103) · fixes de honestidad E1/#113, E2, E4/#115, E12, E13 y #31 (razón concreta del par
   en el Comparador). Detalle en ESTADO_DEL_PROYECTO.md.
   **Lo que quedó fuera a propósito:** #32 (rangos de P/E por lente — cambia veredictos de ~20
   empresas y merece calibrarse con datos, no a ojo), #43/#47/#50 (son la Sesión 3) y #23 en su
   versión completa para más grupos de salud (hoy solo AUNA existe en la app).
2. **Sesión 2 — El tour por niveles (mejoras 1-5):** pasos por nivel + tour de desbloqueo + guiones
   con datos reales + tours de Comparador y Resultados. El TourGuia actual ya lo soporta casi todo.
3. **Sesión 3 — Los combos (mejoras 43, 47, 50):** "Lectura de analista" con los combos de §5,
   sostenibilidad del dividendo vs FCF, y el ejemplo numérico del ciclo.
4. **Sesión 4 — Los micro-tours de indicador (mejora 6)** con los guiones de §6 escritos como datos.

> Nota final de método: casi todo lo propuesto se construye con datos que YA existen en los JSON
> (deuda, EBITDA/EBIT, FCF, dividendos, históricos, notas, lecturas) y con patrones que YA existen
> en el código (TourGuia salta pasos, redactor compone desde slots, cartera-demo se borra sola).
> No hay dependencias nuevas, no hay backend, no hay costo — fiel a las 9 Reglas de Oro.

---

# PARTE II — LA ESCALERA DE APRENDIZAJE Y LA REGLA DE LOS 5 SEGUNDOS
*(agregado 21-jul, segundo pedido de Jair: aprender tiene un ORDEN; cada número debe responder
la siguiente pregunta de la cabeza en <5 segundos, o proponer cómo.)*

## 10. La escalera maestra — y el hallazgo incómodo

La secuencia natural con la que una cabeza aprende una empresa:

```
1. ¿Qué hace la empresa?
2. ¿Cómo gana dinero?
3. ¿Por qué gana más (o menos) este año?
4. ¿Qué riesgos tiene?
5. ¿Está barata?
6. ¿Vale la pena? (→ en ALTO: "¿estoy listo para DECIDIR?", nunca "compra" — Regla #9)
```

**El hallazgo incómodo: la ficha actual responde la pregunta 5 ANTES que la 1.** Lo primero que ve
el usuario es el precio y la radiografía con el veredicto "Barata" — está juzgando el precio de un
negocio que todavía no sabe qué es. La tesis (pregunta 1) llega después de los veredictos; la
pregunta 2 no tiene elemento propio; la 3 está ENTERRADA en el nivel 4 (gerencia.json — verificado:
las frases reales de la gerencia de BVN explicando el trimestre YA están digeridas: "producción de
plata +39% por reevaluación de mineral de baja ley", el CAS, Coimolache pasando de pérdida a
utilidad de US$46.8M… y hoy solo las ve quien le pregunta a Atlas o abre documentos en N4); la 4
es nivel 3; y la 6 no se cierra nunca — el usuario se queda con la pregunta en la boca y se la va
a responder TikTok.

**Cómo se arregla sin demoler la ficha** (la radiografía como gancho de 10 segundos es defendible
— un vistazo no es una lección):
- **El TOUR se re-secuencia por la escalera, no por el orden del DOM.** El tour de la ficha cuenta:
  tesis ("qué hace") → "vive de" ("cómo gana") → cómo le fue ("por qué este año") → riesgos → recién
  entonces el veredicto de precio → cierre de decisión. El DOM puede quedarse como está; la
  NARRACIÓN no.
- **Escalón 2 ("¿cómo gana dinero?"):** una línea nueva "💰 Vive de:" junto a la tesis — metal,
  comisión, peaje, prima, renta, tarifa. Una palabra que instala el lente sectorial (§4) desde el
  segundo cero.
- **Escalón 3 ("¿por qué este año?"):** tarjeta "🗣 ¿Por qué le fue así este trimestre?" en nivel
  2-3 con 2-3 frases de gerencia.json pasadas por el redactor (los datos existen; solo están mal
  ubicados en la escalera — es la mejora con mejor ratio valor/esfuerzo de todo el documento).
- **Escalón 6 (el cierre):** checklist "¿Estás listo para decidir?" al final de la ficha —
  compatible con la Regla #9 porque no responde SI comprar, responde si el usuario ya puede
  decidir SOLO: ☐ sé de qué vive ☐ sé por qué ganó/perdió este año ☐ conozco su riesgo #1 ☐ sé si
  su deuda es del tipo peligroso para SU sector ☐ entiendo por qué el P/E dice lo que dice ☐ sé
  qué evento vigilar el próximo trimestre. Las que estén en blanco enlazan a su sección. "La app
  no te dice si comprar; te dice si ya estás listo para decidirlo tú."

**La escalera también ordena los niveles:** N1 vive en los escalones 1-2 (+el vistazo), N2 agrega
el 3, N3 agrega 4-5, N4 cierra con el 6 y la Lectura de analista. Los tours de desbloqueo (§7 capa
B) son literalmente "subir un escalón".

## 11. Auditoría de los 5 segundos — la cadena de preguntas de cada número

Método: por cada número visible, la cadena de preguntas que la cabeza hace EN ORDEN; para cada una,
¿la app la responde hoy en <5 segundos? (✔ sí / ◐ a medias / ✘ no) y la propuesta. Las propuestas
referencian las 100 mejoras de §8 cuando ya existían, y las nuevas van numeradas 101+.

### 11.1 «P/E 9.2» (el ejemplo de Jair, resuelto entero)
| La cabeza pregunta | Hoy | Cómo responder en <5s |
|---|---|---|
| ¿Eso es bueno? | ✔ veredicto Barata/En rango/Cara (radiografía + Valoración) | ya está — es de lo mejor de la app |
| ¿Comparado con quién? | ◐ "rango del sector 9–15" — pero el sector es una abstracción sin cara | **#109**: los vecinos con nombre y número en una línea: "hoy: Poderosa 11.3 · Cerro Verde 15.3 · BVN 9.6" (peInfo ya calcula todos) |
| ¿Siempre? (¿ese veredicto es estable?) | ✘ nada | **#45**: P/E vs su PROPIA historia con los 18 meses ya descargados ("está en la parte baja de su rango del año") |
| ¿Y por qué está barata? | ◐ el aviso cíclico existe pero es genérico | **#43+#50**: la razón compuesta de slots verificados: "probable: el oro caro infló la ganancia (margen 84%, récord) → P/E deprimido = espejismo de ciclo" — y si no hay razón verificable, decirlo: "el mercado la castiga y nuestras fuentes no dicen por qué" (Regla #1) |
| ¿Entonces compro? | ✘ la cadena muere sin cierre | **#104**: el checklist de decisión — la respuesta honesta es "esa pregunta te toca a ti; verifica que puedas responder estas 6 primero" |

### 11.2 «S/ 30.31» (el precio)
- *¿Es caro?* ✘ — y aquí vive **la lección más ausente de toda la app**: PRECIO ≠ VALOR. Una acción
  de S/0.15 no es "más barata" que una de S/300 (depende de cuántas acciones hay y cuánto gana cada
  una). El principiante peruano compra centavitos "porque alcanzan más". → **#106**: lección
  anti-penny-stock en N1, un tooltip en el precio mismo: "¿S/0.15 es barato? El precio solo no dice
  nada — barata o cara se responde abajo 💎".
- *¿Subió o bajó?* ✔ tile 6 meses + sparkline.
- *¿Puedo comprarla a ese precio de verdad?* ◐ el aviso de iliquidez existe pero en N3 → **#86**.
- *¿Cuántas me alcanzan con S/500?* ✔ el simulador — pero no dice el costo de la SAB → **#78**.

### 11.3 «▲ subió 15.9%» (últimos 6 meses)
- *¿Por qué subió?* ✘ el número flota sin causa → **#107**: los Hechos de Importancia MARCADOS
  sobre el sparkline (puntitos tocables en la fecha del HI; hechos.json ya tiene fecha+categoría
  +semáforo del lector). Responde "¿qué pasó ahí?" en 2 segundos y es la conexión causa-precio
  que ningún competidor educativo tiene.
- *¿Y va a seguir subiendo?* — la respuesta honesta es NO SE SABE; decirla explícita ("lo pasado
  no promete nada — lo que viene está en ⚡ catalizadores") convierte un silencio en lección.

### 11.4 «rinde 6.13% al año» (el yield)
- *¿Me pagan eso fijo?* ◐ la frecuencia está; la variabilidad se infiere → una palabra lo arregla:
  "variable, según utilidades".
- *¿Es mucho?* ✘ sin referencia → **#35**: mediana del sector al lado.
- *¿Es sostenible?* ✘ → **#47**: dividendos pagados vs FCF (el semáforo "se lo puede pagar / lo
  está forzando").
- *¿Cuándo y cómo cobro?* ◐ fechas sí; el MECANISMO del corte no → **#48** (línea de tiempo).
- *¿Cuánto me toca con S/1,000?* ✔ DividendoSimulador — cerrar con el neto de impuestos (**#78**).

### 11.5 «Deuda: S/ 18,640 M»
La cadena completa — *¿es mucho? → ¿puede pagarla? → ¿es grave en SU negocio? → ¿cuándo vence? →
¿en qué moneda?* — está **✘ en cero hoy**: el número se muestra pelado y la interpretación vive a
tres pantallas de scroll en la guía. Es el peor ratio dato/respuesta de la ficha y ya es el corazón
de la Parte I: **#41** (años de caja), **#21** (lente), **#51** (vencimientos), **#49** (moneda).
La cadena es el ORDEN en que el tour de la deuda (§6) debe soltar sus pasos.

### 11.6 «Margen 84%» (BVN, Q1)
- *¿Es bueno?* ◐ suena bueno; nadie dice comparado con qué.
- *¿Es normal?* ✘ → **#108**: badge de contexto contra su propia serie y su sector: "récord — su
  normal ronda 40-60%".
- *¿Durará?* ✘ → el combo 1 de §5: margen récord + minera = es el METAL, no la empresa; se va
  cuando el oro se vaya. Esta cadena de 3 respuestas es la vacuna anti-pico-de-ciclo completa.

### 11.7 «FCF: US$ X M»
- *¿Qué es esto?* ✔ glosado + guía.
- *¿Alcanza?* ✘ ¿alcanza para QUÉ es la pregunta real → responder contra sus dos usos: cubre el
  dividendo (**#47**) y/o baja la deuda (**#41**). "Le sobraron US$X: pagó el dividendo (US$Y) y
  le quedó para amortizar" — tres números que ya existen, juntos por primera vez.
- *¿Y si es negativo?* ◐ la guía lo explica en abstracto → el combo 8 (¿hay proyecto documentado
  que lo justifique?) responde para ESTA empresa.

### 11.8 «EPS 3.15» → *¿y eso qué?* — el EPS solo NO responde nada para un principiante; su única
función pedagógica es ser el puente al P/E. → en N1-2, mostrarlo ya convertido: "ganó S/3.15 por
acción → al precio de hoy, pagas 9.6 años de esa ganancia (eso es el P/E)". Un número menos que
memorizar, una conexión más.

### 11.9 «Montaña rusa» (volatilidad)
- *¿Cuánto es "mucho"?* ✔ etiquetas humanas.
- *¿La aguanto YO?* ✘ — la app ya SABE la respuesta (el perfil del quiz está en localStorage) y no
  la usa → **#110b**: cruzar termómetro × perfil: "elegiste 'dormir tranquilo': esta se sacude más
  de lo que dijiste aguantar". Personalización honesta con cero datos nuevos.

### 11.10 «mal: −32%» (simulador/escenarios)
- *¿Por qué justo −32?* ✘ número mágico → **#54** (usar SU peor racha real de 12 meses: "esto ya
  le pasó, no es teoría").
- *¿Qué tendría que pasar para eso?* ✔ las condiciones por sector/empresa — bien resuelto.

### 11.11 «🟢 buena pinta» (hecho leído por el robot)
- *¿Qué pasó?* ✔ tooltip con razones.
- *¿Me afecta?* ◐ solo si está en Mi lista/Cuaderno hay contexto → el toast educador (**#96**).
- *¿Qué hago con esto?* ✘ → la respuesta educativa: "¿cambia la razón por la que te interesaba?
  (tu tesis)" — cerrar el toast/tooltip con esa pregunta, que enlaza tesis y recordatorios.

### 11.12 «apalancamiento 3.6x» (AUNA) — hoy es un tip suelto; la cadena (*¿mucho? → ¿para un
hospital? → ¿lo está bajando?*) se responde entera con el lente salud (**#23**) + años de caja
(**#41**) + el catalizador del plan <3x. AUNA es el caso de demostración perfecto de toda la Parte II.

### 11.13 Producción minera (serie BEM)
- *¿Produce más o menos que antes?* ✔ chips vs mes/año — excelente.
- *¿Y eso cuánta plata es?* ✘ el puente producción×precio→ingresos (**§3.12**): "esta gráfica es
  el ADELANTO de sus resultados".

## 12. El patrón de interfaz: la cadena como UI (no solo como tour)

La regla de los 5 segundos pide que la RESPUESTA viva pegada al número, no en una sección lejana.
Patrón propuesto — **la cadena conversacional**: bajo cada número clave, un link discreto con la
PRÓXIMA pregunta de la cadena ("¿y esto es bueno? →"). Al tocarlo se expande la respuesta de una
línea… que termina con la SIGUIENTE pregunta ("¿comparado con quién? →"). El usuario baja la
escalera pregunta por pregunta, exactamente al ritmo de su cabeza, y cada respuesta es un slot
verificado (redactor). Es el mismo contenido de los micro-tours de §7-C con otra puerta de
entrada — y donde una pregunta no tenga respuesta verificable, el último eslabón es el chip de
Atlas con la pregunta ya escrita (**#82**), o el botón de Comentarios si ni Atlas sabe (la
pregunta del usuario alimenta el FAQ, **#100**).

**Y como regla permanente de diseño (#112):** cada número nuevo que entre a ALTO debe pasar el
checklist antes de salir: ¿cuál es su cadena de preguntas? ¿cada eslabón se responde en <5s?
¿el último eslabón cierra en decisión propia o en Atlas — nunca en el vacío?

## 13. Mejoras nuevas de la Parte II (101–112)

101. **[P0]** El tour de la ficha se RE-SECUENCIA por la escalera (tesis → vive de → cómo le fue →
     riesgos → veredicto de precio → cierre), no por el orden del DOM.
102. **[P0]** Línea "💰 Vive de:" junto a la tesis (escalón 2, instala el lente desde el segundo cero).
103. **[P0]** Tarjeta "🗣 ¿Por qué le fue así este trimestre?" en N2-3 con frases de gerencia.json
     vía redactor — el escalón 3 ya está digerido, solo está enterrado en N4. El mejor
     valor/esfuerzo de todo el plan.
104. **[P0]** Checklist de cierre "¿Estás listo para decidir?" (escalón 6, compatible con Regla #9);
     los ítems en blanco enlazan a su sección.
105. **[P1]** Patrón "cadena conversacional" bajo los números clave (§12): cada respuesta termina
     con la siguiente pregunta tocable.
106. **[P1]** Lección "precio ≠ valor" anti-penny-stock en el precio mismo (N1).
107. **[P1]** Hechos de Importancia marcados como puntos tocables SOBRE el sparkline — responde
     "¿por qué subió?" en 2 segundos con datos que ya existen.
108. **[P1]** Margen (y métricas clave) con badge de contexto vs su propia serie ("récord del año")
     y vs sector.
109. **[P1]** Los vecinos del sector con nombre y P/E en la Valoración ("Poderosa 11.3 · Cerro
     Verde 15.3") — el "¿comparado con quién?" con cara.
110. **[P1]** (a) FCF contado contra sus dos usos: "cubrió el dividendo y le quedó para deuda";
     (b) termómetro × perfil del quiz: "elegiste dormir tranquilo: esta se sacude más".
111. **[P2]** EPS mostrado ya convertido a su lectura ("ganó S/3.15 por acción → pagas 9.6 años de
     esa ganancia") en N1-2.
112. **[P2→regla permanente]** La auditoría de los 5 segundos como checklist de QA para todo
     número nuevo que entre a la app.

**Ajuste al orden de sesiones de §9:** la Sesión 1 sigue siendo lentes+deuda, pero suma #102 y
#103 (baratas y de máximo impacto); la Sesión 2 (tour por niveles) implementa #101 y #104 como
parte del guion. La cadena conversacional (#105) puede esperar a la Sesión 4 junto con los
micro-tours — son el mismo contenido con dos puertas.

---

# PARTE III — LA AUDITORÍA DE LOS 100 USUARIOS
*(agregado 21-jul, tercer pedido de Jair: errores educativos sin piedad, agujeros, demolición,
comparación mundial, sesgos, carga cognitiva y el comité de profesores.)*

## 14. Catálogo de errores educativos — todo lo que hoy se puede aprender MAL

Recorrido como 100 usuarios distintos (el novato con S/300, la dividendera, el que viene de
TikTok, el contador curioso, el que abre desde un cel con datos…). Cada error: dónde está,
qué concluye mal el usuario, por qué ocurre y el arreglo. Verificados contra el código real.

**E1 — El anzuelo de niveles ESCONDE una advertencia de riesgo.** `RadiografiaExpres` en niveles
1-2 reemplaza la nota del tile por "🔍 toca: ¿por qué?". Pero esa nota a veces ES una advertencia:
"P/E referencial (precio viejo)". Resultado: un nivel 1 ve "💎 Barata" calculada con un precio de
hace meses, sin ninguna señal. **Regla que nace aquí: las advertencias JAMÁS se esconden por
nivel — el nivel esconde profundidad, nunca peligro.** Arreglo: "Barata*" con la nota mínima
siempre visible.

**E2 — El amortiguador 0.4 del Simulador enseña lo contrario de la verdad.** Para ilíquidas,
`damp = 0.4` reduce los escenarios a ±40% "porque se mueve poco". El usuario aprende: "ilíquida =
más tranquila = más segura". La realidad: una ilíquida no se mueve… hasta que se mueve DE GOLPE
(FOSSAL 0.76→2.40, Andex 0.18→0.90 — ¡casos de la propia app!). Su riesgo no es el vaivén diario:
es el salto y no poder salir. Arreglo: en ilíquidas no amortiguar sino CAMBIAR el mensaje del
escenario: "aquí el riesgo no es el %: es que cuando quieras vender, no haya comprador".

**E3 — El Simulador tiene 2 de 3 escenarios en positivo.** bien(+22%) / regular(+3%) / mal(−32%):
el "regular" es ganancia. La foto mental que queda: "lo normal es ganar algo". En un año malo de
la BVL, "regular" es −10%. Arreglo: "regular" debe poder ser levemente negativo en cíclicas, o al
menos decir "regular también puede ser perder un poco"; y considerar mostrar 🔴 primero (el orden
también educa).

**E4 — "Cero sustos" → dividendos, en el quiz.** La opción dice "nada de volatilidad: mejor que
te paguen y ya". Enseña que las dividenderas no se mueven. BVN paga dividendos Y es sensible al
oro; Quimpac "rinde 26%" y es ilíquida. Dividendo ≠ ausencia de riesgo — es EL malentendido
número 1 del inversionista de ingresos. Arreglo: reescribir la opción ("prefiero que me paguen
mientras espero") y matizar en Resultados.

**E5 — Los tips tienen números CONGELADOS que envejecen.** "Cotiza a P/E ~9.6", "rinde ~3.82%",
escritos a mano en tips.json. La Valoración calcula el P/E EN VIVO cada día. En 6 meses el tip
dirá 9.6 y la Valoración 14 — dos verdades en la misma pantalla, y el usuario no sabe cuál creer
(y deja de creer en ambas: el costo es la CREDIBILIDAD, el producto de ALTO). Arreglo: prohibir
cifras duras en tips manuales — o placeholder vivo ({PE}) o la cifra con fecha ("a jun-2026").

**E6 — El tip de deuda de BCP contradice su propia guía** (cazado en Parte I, pertenece a este
catálogo): "mírala contra la caja que genera" es el lente minero que la guía de bancos prohíbe.
Auditar TODOS los tips de enrich_tips en bancos/seguros/AFP/holdings.

**E7 — Frecuencias de dividendo en inglés crudo.** Tips dicen "rinde ~6.13% al año (annual)",
"(semi)" — jerga de stockanalysis sin traducir, en una app cuyo orgullo es el español claro.
Arreglo: mapa annual→anual, semi→semestral, quarterly→trimestral, monthly→mensual.

**E8 — "Tranquila = menos sustos" en el Termómetro.** Iguala volatilidad baja con riesgo bajo.
Una azucarera en crisis societaria con pocas operaciones puede salir "tranquila"; Inca Rail era
"tranquila" hasta que la pandemia le cortó el ingreso a cero. La volatilidad mide el pasado del
PRECIO, no la salud del NEGOCIO. Arreglo: una línea fija en el termómetro: "esto mide cuánto se
sacudió el precio — NO si el negocio es seguro; eso se ve en riesgos y deuda" (+ mejora #124).

**E9 — El top-3 de HoyBVL sin volumen.** En un mercado ilíquido, "subió 15%" puede ser UNA
operación de S/2,000. El usuario aprende que la BVL da saltos diarios aprovechables. Arreglo:
mostrar el monto negociado junto a la variación ("subió 15% · negoció S/8 mil — ojo, poquísimo")
o filtrar por monto mínimo.

**E10 — La barra de 52 semanas ancla al máximo.** "Está al 52% del camino entre su mín y máx"
instala la idea de que el máximo es un techo alcanzable ("le queda 48% de subida"). Es el sesgo
de anclaje servido en bandeja. Arreglo: nota "el máximo no es una meta ni una promesa: es solo
dónde estuvo".

**E11 — El gancho de portada ES la trampa del yield.** GanchoDatos rota "quién paga más
dividendos": la primera lección que da la portada es perseguir el yield más alto — exactamente
el error que la ficha corrige tres pantallas después. Arreglo: el gancho lleva la vacuna dentro
("paga 26% — ¿demasiado bonito? toca y ve por qué un yield así casi siempre engaña").

**E12 — Veredicto "Barata/Cara" con el rango de 'diversas' (8-18).** Comparar el P/E de una
aseguradora contra un rango que mezcla salud, puertos y medios es un veredicto sin sentido
económico vestido de precisión. Arreglo: #21/#32 (lentes) — y mientras tanto, en 'diversas' decir
"vs un rango amplio y poco comparable" en el propio veredicto.

**E13 — "El rango del sector" son 3 empresas.** En textil o pesqueras, el "rango justo" sale de
2-3 emisores locales. Es una estadística de 3 puntos presentada como norma del universo. Arreglo:
decir de dónde sale ("rango de referencia, calibrado con las N del sector en BVL + pares
regionales") — honestidad de método, no solo de dato.

**E14 — Los % fijos por sector del Simulador** (todas las minas ±22/−32): la junior PPX y el
gigante SCCO simulan igual. Ya está como mejora #54 (usar la volatilidad real de CADA empresa);
pertenece a este catálogo porque enseña magnitudes falsas.

**E15 — La Carrera con una ilíquida dibuja estabilidad falsa.** La línea plana de la que no
negocia parece "la estable" al lado de la líquida que vibra. El aviso existe pero es tímido.
Arreglo: pintar la línea ilíquida punteada/atenuada con etiqueta "precio congelado, no calma".

**E16 — La cinta diaria educa la mirada equivocada.** Verde/rojo de AYER en una app de estudiar
negocios a años. Leve (el tour ya dice "para curiosear"), pero el color diario es la primera
emoción de cada visita. Arreglo mínimo: tooltip en la cinta "el color es de un día — el negocio
se juzga en años".

**E17 — La Empresa del día puede presentar una junior a un nivel 1 sin su advertencia.** La
rotación determinística no distingue: el día que toque PPX, el novato ve la tarjeta con tesis
pero el "MUY ALTA VOLATILIDAD" vive en los tips (nivel 2). Arreglo: si el perfil es apuesta/junior,
el badge de advertencia viaja EN la tarjeta del día.

**E18 — "≈ 66 acciones a S/15 c/u" sin costos.** El simulador convierte monto→acciones como si
comprar fuera gratis. Con S/500, la comisión mínima de una SAB puede comerse 2-4%. Arreglo: #78
(nota de costos reales: "en la vida real, réstale la comisión de la SAB ~S/X").

**E19 — Dos robots sin presentación conjunta.** Atlas enseña, Sentinel lee — pero el novato ve
dos nombres, dos iconos, y no sabe cuál es cuál ni por qué. Arreglo: una línea canónica usada en
todos lados: "🛰️ Sentinel LEE los documentos; 🧠 Atlas te los EXPLICA" (+ tours #7/#8).

**E20 — Los nombres de los niveles 1 y 4 enseñan valores equivocados** (Parte I #80): "¿Cuánto
podría ganar?" promete ganancia; "Lobo de wall street" celebra a un estafador condenado en una
app cuya marca es la honestidad. No es cosmético: los nombres son la primera lección.

## 15. Los agujeros — lo que el usuario espera y no encuentra

### 15.1 El test de BVN (tu ejemplo, verificado contra la ficha real)

| El usuario quiere saber | ¿Está? | Detalle |
|---|---|---|
| ¿Cuánto produce? | ✔ | serie BEM + HI de producción destacado — de lo mejor de la app |
| ¿Qué % del oro del Perú es? | ✔ | chip "% del metal del Perú" (con la nota honesta del top-10) |
| ¿Qué minas tiene? | ✔ | familia minera con participaciones |
| ¿Cuánto gana? | ✔ | fundamentos + EPS |
| ¿Está barata? | ✔ | Valoración |
| **¿A cuánto está el ORO hoy?** | ✘ | **el driver #1 de la empresa no aparece en toda la app** — agujero mayor (#116) |
| ¿Cuánto le cuesta producir una onza? | ◐ | el CAS está EN gerencia.json (US$/oz por mina, verificado) — digerido pero nunca mostrado (#127) |
| ¿Qué mina aporta más? | ◐ | producción por entidad sí; EBITDA por mina no es dato público por emisor — decirlo honesto y dar el proxy (producción × metal) |
| ¿Cuál es su MAYOR riesgo? | ◐ | hay lista de riesgos, sin jerarquía (#84) — el usuario quiere UNO, el primero |
| ¿Cuántos años de mineral le quedan? | ✘ | reservas/vida de mina: está en memorias anuales; evaluar fuente (#126) |
| ¿Quién la controla? ¿quién la dirige? | ✘ | estructura accionaria y directorio (#131); "familia empresarial" sigue pendiente de OK |
| ¿Cómo le fue los últimos 5 años? | ✘ | solo Q actual (+2025 minero); sin serie multi-año de ingresos/utilidad (#119) |
| ¿Cuándo publica los próximos resultados? | ✘ | agenda de resultados (cronograma SMV) — nadie la muestra (#118b) |

### 15.2 Agujeros por tipo de usuario

- **El novato absoluto:** ¿cómo COMPRO una acción de verdad? ¿qué SAB elijo, cuánto cobra, cuál
  es el mínimo? ¿qué impuestos pago? → la Lección 0 (#77-78) sigue siendo el agujero más grande
  de toda la plataforma: ALTO enseña a analizar un carro a alguien que no sabe dónde queda la
  tienda.
- **La dividendera:** calendario de dividendos de TODO el mercado este mes (el Cuaderno lo hace
  solo con TU cartera) (#118); racha de años pagando (#56); "¿puede seguir pagándolo?" (#47).
- **El curioso de noticias:** "¿qué pasó HOY en la bolsa?" — un feed global de los hechos del día
  con el semáforo del lector. **El dato ya existe entero en hechos.json + lecturas.json**; solo
  falta la vista (#117). Valor/esfuerzo altísimo.
- **El estudiante/analista:** series históricas de 5 años estilo Macrotrends (#119); exportar
  a CSV lo que ve (#132); ratios comparados del sector en una tabla (#35).
- **El de provincia con datos móviles:** ya es el mejor atendido (peso, offline, carga) — ventaja
  real de ALTO que ninguna plataforma global tiene en Perú.
- **El profesor que quiere usar ALTO en clase:** modo proyector/imprimir ficha (P3, #133).
- **Todos:** el TIPO DE CAMBIO del día (ya viaja en eps_anual.json y no se muestra, #125) y
  "¿cómo va la BVL este año?" (el índice como contexto, #130).

**El patrón de los agujeros:** casi ninguno exige fuentes nuevas — son datos ya descargados sin
vista (CAS, hechos del día, TC, calendario) o vistas nuevas sobre fuentes ya dominadas (SMV,
BVL). Los únicos con fuente nueva real: precio de metales (#116, fuente pública gratuita) y
reservas (#126, memorias).

## 16. Demolición sin diplomacia — lo que sobra, lo que estorba, lo que debe morir

1. **La puerta de niveles como PRIMER contacto está al revés.** Le pides al usuario que se
   autoclasifique antes de haber visto una sola pantalla. No sabe qué significa "analizarla" si
   nunca vio una ficha. Es fricción antes del valor — el momento de mayor abandono de cualquier
   web. Rediseño: entrar directo en nivel 2 (el modo aprender, el corazón de la marca) con un
   banner "🎚️ elige tu nivel cuando quieras", y la puerta se ofrece tras la primera ficha vista.
   La puerta actual es hermosa — pero es una GRAN segunda pantalla, no una gran primera.
2. **Escenarios y Simulador son la misma lección dos veces** (#85): el usuario de nivel 3 lee
   bien/regular/mal en el simulador y 5 pantallas abajo otra vez en Escenarios con otras palabras.
   Fusión: los escenarios SON las condiciones del simulador — una sola sección.
3. **Las Píldoras ("¿Sabías que?") son confeti.** Datos sueltos sin secuencia ni consecuencia.
   No matarlas: reciclarlas como ganchos de las lecciones (#70) — cada píldora termina en "¿por
   qué importa? →".
4. **El P/E aparece en CUATRO lugares con cuatro redacciones** (radiografía, Valoración, fila de
   la guía, tip congelado). Cuatro versiones = cuatro oportunidades de contradicción (E5 ya es
   una). Una sola fuente de verdad narrativa: la Valoración; los demás REFERENCIAN ("ver 💎").
5. **La ficha nivel 4 es un pergamino.** 15+ secciones en un solo scroll. La radiografía ancla
   4; el resto es arqueología. Rediseño: mini-índice pegajoso (chips de sección) a partir de
   nivel 3 — no tabs (romperían el flujo de lectura), solo navegación.
6. **El bloque EV/EBITDA vive un nivel antes de tiempo.** Es la sección más densa de la app
   (10 conceptos) y aparece en nivel 3 junto a TODO lo demás nuevo. Al nivel 4 (#122) — el nivel
   3 se queda con P/E bien contado, que ya es un logro.
7. **"Explora todas" desde Resultados compite con Explorar.** Dos caminos al mismo destino con
   nombres distintos. Unificar el CTA.
8. **El botón "empresa al azar" en el hero** es ruleta para un nivel 1. Moverlo a Explorar; el
   hero queda con UNA acción dominante (el quiz).

## 17. ALTO vs los mejores del mundo — la matriz

| Plataforma | Qué hace mejor que ALTO | Qué hace peor | Qué copiar | Qué JAMÁS copiar |
|---|---|---|---|---|
| **TradingView** | gráficos interactivos, watchlists fluidas | educación cero: te da el cuchillo sin enseñar a cortar; casino social | la fluidez del gráfico (zoom/rangos); alertas de precio simples | el feed social de "ideas" y señales — es el efecto rebaño con interfaz |
| **Koyfin** | dashboards de una empresa en una página; ratios HISTÓRICOS graficados | densidad de terminal, inglés, curva de entrada brutal | la "página resumen" con ratios en el TIEMPO (#45/#119) | la densidad: 40 widgets a la vez |
| **Finviz** | screener instantáneo; el HEATMAP del mercado | cero contexto: números pelados sin lente; ads | el mapa de calor de la BVL por sector (#120) — una foto del mercado que enseña sola | los "signals" técnicos para principiantes |
| **TIKR** | 10 años de financieros limpios + transcripts | paywall, inglés, sin pedagogía | la tabla multi-año simple (#119); su disciplina de fuente | los estimados de analistas — en BVL no existen y falsearían (Regla #1) |
| **Alpha Spread** | visualiza valor intrínseco vs precio (DCF por escenarios) | el "intrinsic value" con decimales crea falsa precisión | la SEPARACIÓN visual precio↔valor como concepto educativo | el veredicto automático de "infravalorada 34%" — Regla #9 en contra |
| **Macrotrends** | series de 15-20 años gratis | UX de 2010, ads por todos lados | la humildad del gráfico largo: el ciclo se enseña SOLO mirando 15 años de Volcan | nada más — es solo datos |
| **Simply Wall St** | narrativa visual (infografías); riesgos auto-detectados en texto simple | el "snowflake" resume una empresa en un dibujito — mata el pensamiento | informes-historia visuales; su lista de "checks" de riesgos automatizados (nuestros combos §5 son eso) | el score único — un número que decide por ti es lo opuesto a ALTO |
| **GuruFocus** | screeners de calidad (F-Score, Z-Score) explicados | culto a los gurús: "compra lo que compró Buffett" | checklists de calidad con nombre y explicación (inspira el "¿listo para decidir?") | el guru-following: rebaño premium |
| **Yahoo Finance** | ubicuidad, portafolios simples, gratis | noticias clickbait, foros tóxicos, datos a veces sucios | casi nada — quizá la simpleza del portafolio (el Cuaderno ya es mejor) | el feed de noticias-anzuelo y los comentarios |
| **Morningstar** | el CONCEPTO de moat/ventaja competitiva; análisis de gobernanza; educación seria | estrellas y medallas que sustituyen el juicio; caro | enseñar MOAT como concepto por lente (¿qué protege a Gloria? ¿y a BVN? nada — el oro no tiene marca) (#134); el lente de gobernanza (Aenza) | las 5 estrellas: autoridad en vez de método |

**Lectura de la matriz:** nadie en el mundo combina (a) datos primarios verificados, (b) español
peruano claro, (c) lentes por sector, (d) cero recomendación, (e) 300 KB en un celular de
provincia. Esa combinación ES el foso de ALTO. Lo que las globales tienen y ALTO no: PROFUNDIDAD
HISTÓRICA (#119, el único agujero estructural serio frente a ellas) y screeners visuales (#120).
Lo que ALTO tiene y ninguna global tendrá: el BEM, las lecturas de HI con semáforo, la SMV
digerida, y una escalera pedagógica. **La conclusión estratégica: no perseguir features de
terminal; profundizar la escalera y la historia.**

## 18. Sesgos cognitivos — dónde caen los usuarios de ALTO y la vacuna de cada uno

| Sesgo | Dónde cae en ALTO (hoy) | La vacuna concreta |
|---|---|---|
| **Perseguir el yield** | GanchoDatos "quién paga más" (E11), Explorar orden por yield | vacuna EN el gancho; aviso al ordenar (#11); sostenibilidad vs FCF (#47) |
| **Perseguir P/E bajo** | tile "Barata" (E1/#44) | asterisco cíclico; "barata ≠ regalada: a veces está barata POR algo" |
| **Anclaje** | barra 52 semanas (E10); precio de compra en Cuaderno; el propio rango P/E del sector | notas anti-ancla; en Cuaderno: "tu precio de compra no le importa al mercado — la pregunta es si HOY la comprarías" |
| **FOMO** | HoyBVL top subieron; cinta verde; toast de hechos 🟢 | "un día no hace tendencia" en grande, no en letra chica; mostrar volumen (E9) |
| **Confirmación** | Atlas y tips como espejo: el que ya compró busca lo verde | **#121 "Abogado del diablo"**: botón que muestra el caso EN CONTRA primero (riesgos, escenario mal, lo que dijo la gerencia de malo) |
| **Rebaño** | compartir duelos/fichas; empresa del día como "la que todos miran" | recordatorio en compartir: "compartes una ficha para ESTUDIAR, no una recomendación"; módulo retiros-AFP como caso de rebaño nacional |
| **Exceso de confianza** | subir a nivel 4 "Lobo" = graduarse; perfil "apuesta" del quiz como licencia | renombrar N4 (E20); en Resultados: "tu perfil describe tu tolerancia, no te da permiso" |
| **Efecto disposición** (vender ganadoras, abrazar perdedoras) | el rojo/verde por posición del Cuaderno | en el detalle de posición: "¿venderías por el color o porque cambió la tesis? Relee tu nota" (#97 el diario) |
| **Recencia** | margen récord Q1 extrapolado; sparkline 3M por defecto | badge "récord vs su historia" (#108); default del sparkline a 1A |
| **Costo hundido** | "espero recuperar lo perdido y salgo" | lección en Cuaderno: "el mercado no sabe cuánto pagaste" |
| **Ilusión de control** | el simulador con su slider da sensación de dominio | ya tiene el disclaimer fuerte ✔; sumar "los 3 escenarios son inventos educativos — el mercado no conoce estas 3 cajitas" (E3) |
| **Falsa precisión** | P/E con decimal, EV con 2 decimales, "está al 52% del camino" | redondear lo que no merece decimales; enseñar "los números finos no son más ciertos" |

**La idea grande:** un módulo transversal "🧠 Tu peor enemigo eres tú" en la Academia (#76):
cada sesgo con su caso peruano (el rebaño de los retiros, el FOMO de las juniors 2020, el anclaje
del que compró Aenza a 3 soles). Casi ninguna plataforma del mundo lo hace — sería marca registrada
de ALTO.

## 19. Carga cognitiva — el conteo que nadie hace

Conteo de conceptos NUEVOS que recibe un usuario por pantalla (concepto = término que exige
definición: P/E, EV, veda, CAS…):

| Momento | Conceptos nuevos de golpe | Veredicto |
|---|---|---|
| Inicio nivel 1 | ~3 (ticker, cierre, dividendo) | ✔ sano |
| Ficha nivel 1 | ~5 (cierre, dividendo, yield, barata/cara, volatilidad-etiqueta) | ✔ al límite pero digerible |
| Subir de nivel 2→3 en la ficha | **~12-14 en un scroll** (P/E con fórmula, BPA, rango sectorial, cíclico, EV, EBITDA, EBIT, D&A, deuda neta, capitalización, catalizador, escenario, riesgo doc/rumor, volatilidad anualizada) | ✘ **el momento más sobrecargado de toda la app — y es exactamente donde no hay tour (Parte I §7)** |
| Sección Valoración sola | 10 | ✘ la tarjeta más densa; mover EV a N4 (#122) |
| Guía del sector (minas) | 8 métricas × párrafo ≈ 700 palabras seguidas | ◐ muro; jerarquizar (#29) |
| Comparador | ~14 filas × 2 empresas | ◐ denso pero es N3+; el tour (#4) lo salva |
| Cuaderno con tour | ~6 repartidos en 10 pasos | ✔ el modelo a imitar: un concepto por paso |

**La regla que se propone (y va como #122 a la lista): presupuesto de 3 conceptos nuevos por
pantalla-momento.** Si una sección necesita más, se parte en niveles o en pasos de tour. El
Cuaderno ya lo cumple sin saberlo; la subida 2→3 lo viola por 4x. Medida concreta además del
tour de desbloqueo: repartir el nivel 3 en DOS olas ("análisis" primero: valoración+termómetro;
"eventos" después: catalizadores+escenarios+riesgos — desbloqueadas con un toque, no con scroll).

*(El eje 7 del pedido — pensar como profesor con cadenas antes/después — es la Parte II entera:
§10-§12. La cadena del "yield 8%" que diste es la §11.4, con su eslabón faltante ahora agregado:
"¿por qué paga TANTO?" → porque un yield muy gordo casi siempre es el DENOMINADOR — el precio
cayó o está viejo — no la generosidad de la empresa.)*

## 20. El comité: Buffett, Damodaran, Marks, Lynch y el profesor peruano

*(Ejercicio de rol: qué diría cada escuela mirando ALTO. Paráfrasis de sus ideas públicas
aplicadas a la app — no citas literales.)*

**Ronda 1 — ¿Qué le sobra y qué le falta? (donde el comité DISCREPA)**

- **"Buffett"** (el negocio primero, pocos números): «La mitad de los ratios estorba. Un
  principiante necesita CUATRO preguntas: ¿entiendo cómo gana plata? ¿algo la protege? ¿la maneja
  gente honesta? ¿el precio es razonable? La línea "Vive de:" (#102) vale más que todo el bloque
  EV/EBITDA — ese bloque, al último nivel o afuera. Y falta el concepto de FOSO: ¿qué protege a
  Gloria? La marca y la distribución. ¿Qué protege a BVN? Nada — el oro no tiene marca; su único
  foso sería costo bajo, y su CAS está subiendo. Esa comparación enseña más que diez múltiplos.»
- **"Damodaran"** (todo número necesita una historia): «Discrepo con el rango fijo 9-15: es un
  número sin historia. ¿Por qué 9-15? ¿Calibrado cuándo, con qué tasas? Los rangos deben
  respirar: contra la propia historia (#45) y con la fecha de calibración visible (E13). Y
  cuidado con la palabra "Barata": el P/E bajo dice que es barata RESPECTO A SU GANANCIA ACTUAL —
  si la ganancia es de pico de ciclo, la historia detrás del número está podrida. La sección
  "Lectura de analista" (#43) es exactamente número+historia: es lo mejor del plan.»
- **"Marks"** (ciclos y riesgo de verdad): «Dos objeciones. Primera: el termómetro enseña que
  riesgo = sacudida. Falso: riesgo es perder plata PARA SIEMPRE (E8). La ilíquida "tranquila" es
  la más peligrosa de la lista. Segunda: la app avisa "el P/E cíclico engaña" pero no dice DÓNDE
  estamos en el ciclo — el aviso sin posición es medio aviso (#53). Y el pensamiento de segundo
  nivel falta: todo el mundo YA SABE que BVN gana con el oro caro; la pregunta educativa es
  "¿cuánto de eso ya está en el precio?" — esa pregunta debe existir en la ficha aunque la
  respuesta honesta sea "no se sabe".»
- **"Lynch"** (compra lo que conoces): «Al novato no le des BVN primero — dale Gloria, Backus,
  InRetail: empresas cuyo producto tocó HOY. La empresa del día debería arrancar por las
  conocibles (E17). Y clasifiquen cada empresa en mi taxonomía (#123): estable (Gloria), cíclica
  (BVN, Aceros), de crecimiento (InRetail), dividendera (Luz del Sur, Red Vial 5), recuperación
  (Aenza, Petroperú), activos ocultos (FOSSAL, Chancay). Seis etiquetas que le dicen al usuario
  QUÉ JUEGO está jugando cada acción — porque el error fatal es jugar una cíclica como si fuera
  estable.»
- **El profesor peruano** (la realidad local): «Todo muy bonito, pero mis alumnos tienen S/500 y
  no saben qué es una SAB. Sin la Lección 0 (#77) y los costos (#78), ALTO enseña a manejar sin
  decir dónde está el timón. La ILIQUIDEZ no es una nota al pie en la BVL: es LA característica
  del mercado — debe ser un capítulo, no un aviso (E2, E9, E15). Y los retiros de AFP son nuestro
  laboratorio de macro: úsenlo. En lo que ALTO ya es campeón mundial y no lo saben: funciona en
  un Redmi con datos, en español, gratis. Eso vale más que todo Koyfin para un chico de Juliaca.»

**Ronda 2 — Los desacuerdos, resueltos:**

1. *¿Múltiplos o flujo de caja descontado?* Damodaran quiere enseñar valor intrínseco; Buffett
   responde que si necesitas Excel ya es "no". **Resolución del comité:** nada de calculadora DCF
   (falsa precisión, Regla #9 en riesgo — ver Alpha Spread §17); SÍ el "DCF mental" como
   narrativa de nivel 4: "el valor de una empresa es toda la caja que va a generar, traída al
   presente; el P/E es solo el atajo de esa idea" — un párrafo, no una herramienta.
2. *¿Cuántos conceptos?* Buffett minimalista vs Damodaran completista. **Resolución:** los dos
   ganan — la escalera de niveles ES la respuesta: nivel 2 buffettiano (4 preguntas), nivel 4
   damodariano (todos los ángulos). El error sería mezclarlos en una pantalla (§19 ya lo mide).
3. *¿Por dónde empieza el novato?* Lynch (consumo conocible) vs Marks (que aprenda ciclos desde
   el día 1 porque la BVL ES cíclica). **Resolución:** primera ficha sugerida de consumo (Lynch),
   pero la PRIMERA LECCIÓN de la Academia es "esta bolsa es minera y cíclica" (Marks) — se
   estudia primero lo simple, se aprende primero el terreno.
4. *¿Renombrar el termómetro?* Marks quiere "sacudida" y "riesgo" separados; el profesor advierte
   que dos medidores confunden. **Resolución:** un solo termómetro con la línea fija de E8
   ("mide la sacudida del precio, no la seguridad del negocio") + el riesgo de verdad vive en
   la sección Riesgos jerarquizada (#84).

**Ronda 3 — El curso perfecto (la Academia ALTO, 9 módulos con las pantallas como laboratorio):**

| # | Módulo | Escuela | Laboratorio en la app |
|---|---|---|---|
| 0 | Cómo se compra de verdad en Perú (SAB, costos, impuestos, mínimos) | profesor | Lección 0 + simulador con costos |
| 1 | Qué es una acción y de qué VIVE una empresa | Lynch | tesis + "Vive de:" de 5 empresas conocibles |
| 2 | El terreno: la BVL es minera, cíclica e ilíquida | Marks + profesor | cinta, HoyBVL con volumen, La Carrera |
| 3 | Los 6 juegos (clasificación Lynch) | Lynch | badges #123, uno por sector |
| 4 | La caja manda: FCF y dividendos sostenibles | Buffett | ficha Luz del Sur vs Quimpac (yield trampa) |
| 5 | La deuda según el negocio (el lente) | todos de acuerdo | BVN vs AUNA vs BCP vs Luz del Sur (§6) |
| 6 | El ciclo: cuándo los números buenos mienten | Marks | Volcan 2015-17 + margen récord de BVN |
| 7 | Valoración: número + historia | Damodaran | Valoración + vecinos + propia historia |
| 8 | Tu peor enemigo: los 12 sesgos | comité entero | §18, con casos peruanos |
| 🎓 | Examen final: el checklist "¿listo para decidir?" (#104) sobre UNA empresa elegida por el alumno, guardado en su Cuaderno | — | ficha + Cuaderno |

## 21. Mejoras nuevas de la Parte III (113–134) y ajuste final

113. **[P0]** Las advertencias JAMÁS se esconden por nivel: arreglar E1 (el anzuelo tapa "P/E
     referencial") y auditar cualquier otra nota de riesgo filtrada por nivel.
114. **[P0]** Prohibir cifras congeladas en tips manuales (E5): placeholder vivo o cifra con fecha.
115. **[P0]** Reescribir "Cero sustos → dividendos" del quiz (E4) y el mensaje ilíquida del
     simulador (E2: el riesgo es el salto y la salida, no el vaivén).
116. **[P1]** Precio de los metales (oro/cobre/zinc/plata/estaño/hierro) en las fichas mineras —
     el driver #1 hoy invisible; fuente pública, robot diario.
117. **[P1]** Feed "los hechos de HOY de toda la bolsa" con semáforo (hechos.json+lecturas.json
     ya lo tienen todo).
118. **[P1]** Calendario de dividendos de TODO el mercado + agenda de próximos resultados
     (cronograma SMV).
119. **[P1]** Series multi-año (5a) de ingresos/utilidad/dividendo para las top-20 (el único
     agujero estructural vs las plataformas globales).
120. **[P1]** Heatmap de la BVL por sector (la foto del mercado que enseña sola, estilo Finviz).
121. **[P1]** "Abogado del diablo": botón que muestra el caso EN CONTRA primero — la vacuna
     anti-confirmación.
122. **[P1]** Presupuesto de 3 conceptos por pantalla: mover EV/EBITDA a N4 y partir el nivel 3
     en dos olas (análisis / eventos).
123. **[P1]** Clasificación Lynch por empresa (estable/cíclica/crecimiento/dividendera/
     recuperación/activos ocultos) como badge educativo con tooltip.
124. **[P1]** Termómetro con la línea fija "mide la sacudida del precio, NO la seguridad del
     negocio" (E8) + línea ilíquida punteada en La Carrera (E15).
125. **[P2]** Tipo de cambio del día visible (ya está en eps_anual.json).
126. **[P2]** Reservas/vida de mina desde memorias anuales (si la fuente es viable; si no, honesto).
127. **[P2]** CAS/cash cost desde gerencia.json donde exista (BVN ya lo trae, verificado).
128. **[P2]** Traducir frecuencias de dividendo (annual/semi/quarterly/monthly) en todos los tips (E7).
129. **[P2]** Notas anti-anclaje: barra 52s (E10) y precio de compra del Cuaderno.
130. **[P2]** El índice BVL como tercera línea en La Carrera ("¿le ganó a la bolsa?").
131. **[P2]** "¿Quién manda aquí?": accionistas de control y directorio por ficha (los cambios ya
     llegan por HI; falta el roster).
132. **[P3]** Exportar a CSV lo que el usuario ve (tabla del sector, dividendos, su cuaderno).
133. **[P3]** Modo clase: vista proyector/imprimir de la ficha para profesores.
134. **[P3]** El concepto MOAT/foso por lente ("¿qué protege a esta empresa?") — un campo
     cualitativo por ficha, escrito con el criterio de Jair.

**Ajuste final de prioridades (consolidado de las 3 partes):** la Sesión 1 (lentes + deuda) suma
los fixes de honestidad E1/E4/E5 (#113-115) porque son errores activos, no mejoras; la Sesión 2
(tour por niveles) absorbe la partición del nivel 3 en dos olas (#122); el feed de hechos del día
(#117) y el precio de los metales (#116) son la mejor Sesión 5 — las dos vistas con mayor valor
por esfuerzo de toda la Parte III.

---

# PARTE IV — EL LABORATORIO UX: EL MAPA DE DUDAS
*(agregado 21-jul, cuarto pedido de Jair: simular usuarios que NO saben finanzas — sus preguntas
reales, sus cadenas mentales, sus preguntas invisibles y dónde abandonan.)*

## 22. Método y códigos del laboratorio

Aquí NO analiza el experto: piensa la persona que jamás oyó "P/E". El mapa contiene **~500
preguntas explícitas agrupadas en ~60 familias**; las 3,000 del pedido brotan de multiplicar
familia × empresa × persona — y el mapa está armado para que CUALQUIERA de esas 3,000 caiga en
una familia ya diagnosticada. Códigos de evaluación usados en todas las tablas:

- **R?** ¿ALTO la responde hoy? ✔ sí en <5s · ◐ sí pero lejos/técnico/tarde · ✘ no
- **Nec** = qué necesita: **T**ooltip · **G**(tour) · **A**nalogía · **E**jemplo · **C**omparación ·
  **IA** (Atlas con la pregunta lista) · **V**ideo 60s · **L**ección (Academia)

## 23. Las 9 personas — cómo piensa cada cabeza

### 23.1 🎓 El universitario (22, quiere "aprender a invertir")
Mente: ordenada, quiere CURSO, no datos sueltos. Miedo: perder sus ahorros de ciber-trabajos.
Primera búsqueda: "cómo empezar".
Preguntas típicas: ¿hay un orden para aprender esto? ✘(L — la Academia #76 no existe aún) ·
¿con cuánto empiezo? ✘(L, #77) · ¿qué es exactamente una acción? ◐(término existe; nadie lo
ofrece de entrada) · ¿esto me sirve para mi tesis/universidad? ✘ · ¿puedo practicar sin plata?
✔(simulador, Cuaderno demo) · ¿dónde estudio gratis lo demás? ✘.
**Dónde se rompe:** busca la escalera y encuentra un buffet. Su retención depende 100% de #76.

### 23.2 👷 El trabajador (35, sin tiempo, "dímelo rápido")
Mente: eficiencia; entra de noche 10 minutos. Miedo: que lo estafen por no entender.
Preguntas: ¿cuál es el resumen? ✔(radiografía — su pantalla favorita) · ¿me avisas si pasa algo?
✔(★ + din-don — matazo para él) · ¿cuánto tengo que revisar por semana? ✘(nadie le dice el
RITMO: "con 10 min/semana basta: mira tus avisos y el feed del día" #117) · ¿puedo dejarlo solo?
◐ · ¿la app me va a vender algo después? ✘(transparencia del modelo: "gratis, vive de yapes").
**Dónde se rompe:** nada le dice cuánta atención exige esto. El "contrato de tiempo" no existe.

### 23.3 👴 El jubilado (68, su CTS/AFP retirada, terror a perderla)
Mente: desconfianza sana + letra chica ilegible. Miedo: perder la pensión, morir estafado.
Preguntas: ¿esto es seguro? ◐(disclaimer legal ≠ respuesta humana) · ¿quiénes son ustedes? ✘
(**no hay página "quiénes somos" — y las Fuentes están en nivel 4: la CONFIANZA está gateada al
último nivel**, #138) · ¿puedo perder toda mi plata? ◐(término "riesgo" sí; respuesta directa
no) · ¿esto es como Interbank/plazo fijo? ✘(la comparación que SU cabeza necesita) · ¿me pueden
robar desde la app? ✘(fácil: "aquí no se mete plata ni datos — solo se estudia") · ¿la letra se
puede agrandar? ✘(#143).
**Dónde se rompe:** en la puerta. Si en 60 segundos no siente "esto es serio y no me piden
plata", cierra y no vuelve.

### 23.4 🆕 El de la cuenta recién abierta (28, ya tiene SAB, no sabe qué hacer)
Mente: ansiedad de ejecutar ("ya pagué la apertura, ahora QUÉ compro").
Preguntas: ¿qué compro primero? ✔(rechazo educado + quiz — correcto) · ok, ¿pero cómo ELIJO yo?
◐(el checklist #104 es SU respuesta y no existe aún) · ¿cuántas empresas debería tener? ✘(L:
diversificación básica) · ¿compro de una o poco a poco? ✘(L: la idea de comprar por partes) ·
¿a qué hora se compra? ◐(RelojPrecios ayuda sin querer) · ¿qué orden le doy a la SAB? ✘(límite
vs mercado — nadie en Perú se lo explica, #139).
**Dónde se rompe:** el puente estudio→acción. ALTO lo educa y lo suelta justo antes del paso
que le da miedo.

### 23.5 🪙 El que viene de cripto (24, exchanges 24/7, velas japonesas)
Mente: velocidad; busca el botón COMPRAR y el gráfico de velas. Miedo: "esto es lento y viejo".
Preguntas: ¿dónde está el botón de comprar? ✘(**y su ausencia sin explicación lee como "app
incompleta"** — decirlo con orgullo: "aquí no se compra: se decide. Se compra en una SAB, así →"
#139) · ¿por qué la bolsa CIERRA? ✘(horarios explicados solo de refilón) · ¿dónde están las
velas? ✘(decir por qué no: educamos ciclos, no trading) · ¿cuál es el "staking" de esto?
◐(¡los dividendos! — el PUENTE conceptual perfecto y nadie lo tiende: "el dividendo es el
staking de verdad: te paga la empresa, no el protocolo") · ¿por qué se mueve tan poco? ◐ ·
¿hay apalancamiento? ✘(decir que NO y por qué es una ventaja).
**Dónde se rompe:** primeros 60 segundos sin botón de comprar. Es el usuario con MÁS riesgo de
abandono — y el más valioso de convertir (ya asume el riesgo; le falta el método).

### 23.6 🏦 El plazo-fijista (45, solo conoce depósitos, "¿cuánto paga?")
Mente: TODO lo lee como tasa fija. Miedo: la palabra "perder".
Preguntas: ¿cuánto paga al año? ⚠️ — lee "rinde 6.13%" COMO UNA TEA DE DEPÓSITO. **El error de
mapeo más peligroso de toda la app**: el yield parece tasa pactada y no lo es (#136: "no es una
tasa fija: sale de dividir un pago variable entre un precio que se mueve") · ¿me devuelven mi
capital? ✘(directo: no — el capital flota) · ¿cuál es "la más segura"? ◐(termómetro, con la
trampa E8) · ¿y si mejor lo dejo en el banco? ✘(la comparación honesta plazo-fijo vs acciones
que SU cabeza pide: riesgo, liquidez, impuestos — sin vender ninguna).
**Dónde se rompe:** cuando su primera "tasa" (yield) baje o el precio caiga: se sentirá
engañado. La vacuna debe llegar ANTES del malentendido.

### 23.7 📱 El de TikTok (19, vio "gana S/500 diarios con la bolsa")
Mente: resultado YA; atención de 15 segundos. Miedo: quedarse fuera (FOMO puro).
Preguntas: ¿cuál va a subir? ✔(rechazo Regla #9 — correcto pero seco) · ¿cuánto gano en un mes?
◐(simulador — su gancho natural si se le ofrece rápido) · ¿esto es como el video que vi? ✘(la
respuesta útil: "el que gana seguro en ese video es el que vende el curso") · ¿por qué tan
lento? ✘ · ¿dónde está lo emocionante? ◐(La Carrera, los duelos — SU lenguaje, mal aprovechado
para captarlo).
**Dónde se rompe:** el rechazo sin contraoferta. Decir "no recomendamos" y punto lo devuelve a
TikTok. #141: rechazo + gancho inmediato ("eso no existe, pero mira LO QUE SÍ: este juego de
duelos con empresas reales…").

### 23.8 💰 El que oyó que "Buenaventura paga dividendos" (52, dato de un amigo)
Mente: viene por UNA empresa y UNA promesa. Miedo: que el dato del amigo sea falso.
Preguntas: ¿es verdad que paga? ✔(resumen de dividendos — excelente) · ¿cuánto me toca si pongo
S/10,000? ✔(DividendoSimulador — la app le responde en 2 minutos: SU final feliz) · ¿cuándo es
el próximo pago? ◐(historial sí; próxima fecha estimada, tímida) · ¿y si compro HOY, cobro? ✘
(fecha de corte #48 — SU pregunta decisiva) · ¿me conviene más que el banco? ✘(#136) · ¿por qué
a veces paga más y a veces menos? ◐(en la guía, lejos: "variable, depende del oro" debería estar
PEGADO al monto).
**Dónde se rompe:** la fecha de corte. Puede COMPRAR MAL por culpa de este hueco (comprar un día
tarde y no cobrar) — es el agujero con consecuencia económica más directa de la app.

### 23.9 🐣 El que nunca ha comprado nada (33, curioso total, cero contexto)
Mente: en blanco; ni SAB, ni ticker, ni bolsa. Miedo: sentirse bruto.
Preguntas (las hace EN SILENCIO, por vergüenza — por eso casi todas son ✘ y van al FAQ #140):
¿qué es exactamente comprar una acción? · ¿a dónde va mi plata cuando compro? · ¿la empresa se
entera de que existo? · ¿puedo perder MÁS de lo que puse? · ¿esto es apuesta o es otra cosa? ·
¿qué es "BVN"? ¿por qué no dice Buenaventura? · ¿por qué esta acción cuesta S/0.15 y esa S/300 —
la barata es peor? · ¿puedo vender cuando quiera? · ¿qué pasa si la empresa quiebra? · ¿y si
quiebra la bolsa?
**Dónde se rompe:** en la puerta de niveles — le pregunta "¿qué tan metido estás en esto?" a
alguien que no sabe qué es "esto". Necesita el botón "🐣 Nunca he invertido — empieza aquí" (#135).

## 24. Los primeros 30 segundos en 11 empresas (usuario cero)

*(mapeo: "Enel" hoy en la BVL = Pluz (ex Enel Distribución) y Enel Piura; "Intercorp" = IFS/Interbank)*

| Empresa | Lo primero que piensa | Dónde se pierde en 30s |
|---|---|---|
| **Buenaventura (BVN)** | "¿por qué está en dólares si es peruana?" | la moneda sin explicación en la cabecera; luego "¿BVN?" (ticker) |
| **AUNA** | "¡clínicas, esto sí lo entiendo!… ¿por qué no tiene precio en soles ni P/E?" | "cotiza en NYSE" sin traducir QUÉ significa para él («¿puedo comprarla desde Perú?» ✘) |
| **Ferreycorp** | "¿ferre… ferretería?" | no sabe que es Caterpillar; la tesis lo salva SI la lee — el nombre confunde antes |
| **Credicorp/BCP (CREDITC1)** | "el BCP, seguro y conocido" | la "deuda" gigante lo asusta (E6/lente); y ¿BAP o CREDITC1? — dos fichas para "lo mismo" sin mapa |
| **Volcan (VOLCABC1)** | "¿por qué la acción vale centavos? ¿está quebrada?" | precio bajo = empresa mala (falacia #106) + ¿qué es la B del ticker? (clases, #137) |
| **Minsur** | "¿estaño? ¿eso se usa para algo?" | nadie le dice para qué sirve el estaño ni que Minsur es ~100% del Perú (el dato estrella está en N3) |
| **IFS (Intercorp)** | "¿esto es Interbank o no?" | holding vs banco: la palabra "holding" aparece antes que su explicación |
| **Pacasmayo** | "cemento, fácil"… "¿por qué gana menos si construyen igual?" | el ciclo de obra pública no se cuenta en N1-2 |
| **Aceros Arequipa** | "conozco la marca" | "acero chino", "antidumping" — jerga de propietario en tips sin puente |
| **Pluz / Enel Piura** | "¿Enel no era la de la luz? ¿por qué se llama Pluz?" | el cambio de nombre corporativo jamás se explica — parece otra empresa |
| **Luz del Sur** | "la de mi recibo — ¿o sea gano con mi propio recibo?" | ¡su intuición es CORRECTA y nadie la celebra! — el mejor gancho educativo desperdiciado |

**Patrón de los 30 segundos:** las confusiones casi nunca son financieras — son de IDENTIDAD
(¿quién es esta empresa? ¿por qué ese nombre/ticker/moneda/centavos?). La cabecera de la ficha
resuelve la identidad financiera (precio/sector) pero no la identidad HUMANA. Fix transversal:
la línea "Vive de:" (#102) + ticker descifrado (#137) + moneda explicada en la cabecera misma.

## 25. Banco universal de preguntas por elemento (las familias)

### La portada
| Pregunta | R? | Nec |
|---|---|---|
| ¿Qué es este sitio? ¿qué gano entrando? | ◐ (hero lo dice a medias) | copy directo |
| ¿Es gratis? ¿dónde está la trampa? | ◐ (solo en el tour) | copy visible |
| ¿Quiénes lo hacen? ¿por qué creerles? | ✘ | #138 página + Fuentes desde N1 |
| ¿Qué significa la tira que se mueve? | ✔ (tour) | — |
| ¿Por qué esos números verdes/rojos? | ✔ | — |
| ¿Aquí puedo COMPRAR? | ✘ | #139 (decirlo con orgullo) |

### La cabecera de la ficha
| Pregunta | R? | Nec |
|---|---|---|
| ¿Qué significa "VOLCABC1"? | ✘ | #137 T |
| ¿Por qué en US$ si es peruana? | ✘ | T+E en la cabecera |
| ¿Ese precio es de ahora? | ✔ (fecha del cierre) | — |
| ¿Por qué cuesta centavos? ¿es mala? | ✘ | #106 T+A |
| ¿"Sin cotización"? ¿la empresa cerró? | ✘ (suena a página rota) | #142 |
| ¿Qué es ese badge de "perfil apuesta"? | ◐ | T |

### El gráfico (sparkline)
¿Qué son los ejes? ✔ · ¿por qué la línea se corta/plana? ◐(#142) · ¿por qué subió AHÍ? ✘(#107
hechos sobre la línea) · ¿el pasado dice el futuro? ◐(decirlo explícito: NO) · ¿3M/6M/1A cuál
miro? ✘(guiar: "para estudiar, 1A") · ¿qué es esa banda mín–máx? ◐(E10 anti-ancla).

### Dividendos
¿Qué es un dividendo, físicamente — me depositan dónde? ✘(#140: cuenta en la SAB/CAVALI) ·
¿si compro hoy cobro? ✘(#48 CORTE — la familia con daño económico directo) · ¿es fijo como el
banco? ✘(#136 — el malentendido del plazo-fijista) · ¿por qué 8% no es automáticamente mejor
que 4%? ◐(#47) · ¿por qué en dólares? ◐ · ¿"payout 91%" es bueno? ◐(T+E) · ¿por qué dejó de
pagar en 2023? ✘(historia del pago, E).

### ¿Barata o cara? (Valoración)
¿Qué es P/E, en cristiano? ✔(fórmula visible — de lo mejor) · ¿quién decidió el rango 9-15?
✘(E13) · ¿"barata" = va a subir? ✘(**la inferencia FATAL: nadie la niega explícitamente** —
una línea obligatoria: "barata no significa que subirá: significa que pagas poco por su ganancia
ACTUAL") · ¿EV/EBITDA…? — el usuario cero NO llega viva a esta tarjeta (#122 la muda a N4) ·
¿por qué "tuvo pérdida" borra el P/E? ◐(bien dicho, falta el "y ahora qué miro" → EV/escenarios).

### Fundamentos
¿"Deuda: S/18,640 M" — eso es mucho? ✘(cadena §11.5 en cero) · ¿qué es FCF y por qué me
importa? ◐(guía lejos) · ¿"margen 84%" significa que me gano 84%? ✘(**confusión real del
usuario cero: margen de la EMPRESA ≠ retorno del INVERSIONISTA** — nadie la desactiva; T+A:
"de cada 100 que VENDE ELLA, le quedan 84 — no habla de tu ganancia") · ¿"Pendiente de verificar
(SMV)" — está rota la app? ✘(#142: "la empresa aún no lo publica — así es la vida real").

### El simulador
¿De verdad puede pasar el −32%? ✔(disclaimer fuerte) · ¿de dónde salen los %? ✘(E14/#54) ·
¿me alcanza para empezar con S/100? ◐(acepta el monto; no dice el costo real #78) · ¿"66
acciones" — puedo comprar 66 exactas? ✘(lotes/mínimos de la SAB, #139).

### Los niveles y el resto
¿Qué me estoy perdiendo en los otros niveles? ✔(chips/CTA) · ¿subir de nivel cuesta? ◐(decir
"gratis, siempre") · ¿por qué hay DOS robots (Atlas/Sentinel)? ✘(E19) · ¿qué es un "hecho de
importancia", suena a chisme? ◐(T+A: "los comunicados que la ley OBLIGA a publicar") · ¿por qué
me piden nivel al entrar? ✘(§16.1).

## 26. Las cadenas mentales completas (usuario cero — arrancan ANTES que las de §11)

Las de la Parte II auditaban desde el número; estas arrancan desde la IGNORANCIA de la sigla.
Formato: eslabón → R?/remedio.

**P/E=7:** ¿qué significa esa sigla? ✔T → ¿por qué 7? ✔(fórmula) → ¿es bueno? ✔(veredicto) →
¿cuál sería MALO? ✘(mostrar los extremos del sector: "Pichincha no tiene P/E — perdió; Cerro
Verde 15.3") → ¿siempre es bueno bajo? ◐(cíclico) → ¿en minería también? ◐ → ¿y en bancos? ✘
(P/B #46) → ¿entonces compro? ✘(#104). **6/8 sin respuesta redonda para el usuario cero.**

**Deuda:** ¿deber es malo? ✘A(hipoteca) → ¿cuánto debe ESTA? ✔ → ¿es mucho? ✘(#41) → ¿la puede
pagar? ✘(#41) → ¿todas las mineras deben así? ✘C(vecinos) → ¿por qué AUNA debe MÁS que BVN y no
pasa nada? ✘(lente §2 — LA pregunta de Jair, hoy sin respuesta en la interfaz) → ¿puede quebrar?
✘(qué pasaría con mi acción: #140) → ¿quién le prestó? ✘(bonos/bancos, N4 notas).

**Dividendo/yield 8%:** ¿qué es? ✔T → ¿me lo pagan a mí, dónde? ✘#140 → ¿cuándo? ◐#48 →
¿es fijo? ✘#136 → ¿8% es mucho? ◐#35 → ¿por qué TANTO? ◐(§19: el denominador) → ¿puede dejar
de pagar? ◐(historia del pago) → ¿qué puede salir mal? ◐(riesgos N3).

**EBITDA/EV:** ¿qué es EBITDA? ✔T → ¿en qué se diferencia de "ganancia"? ◐(T con analogía:
"la ganancia del MOTOR, antes de cuotas e impuestos") → ¿EBITDA negativo? ✘(E: "el motor mismo
pierde — grave") → ¿qué es "valor de empresa"? ◐(A bodega: "el traspaso + asumir sus deudas") →
resto: mudar a N4 (#122).

**Margen 84%:** ¿qué es margen? ✔T → ¿yo gano ese 84%? ✘(la confusión empresa/inversionista,
§25) → ¿es normal? ✘#108 → ¿va a durar? ✘(combo 1).

**FCF:** ¿qué es "flujo"? ◐(A: "lo que sobra en caja al fin de mes, como en tu casa") → ¿por qué
importa más que la ganancia? ◐(guía) → ¿negativo = quiebra? ✘(combo 8) → ¿alcanza para el
dividendo? ✘#47.

**EPS 3.15:** ¿qué es? ✔T → ¿me lo pagan? ✘(**confusión real: EPS ≠ dividendo** — "gana S/3.15
por acción PERO reparte S/0.90: lo demás se queda a trabajar" — esa resta enseña retención y
payout de un golpe) → ¿sube o baja vs antes? ✘(serie #119).

**Volatilidad "montaña rusa":** ¿qué mide? ✔ → ¿me puede pasar a MÍ? ◐(simulador) → ¿montaña
rusa = mala? ✘("ni buena ni mala: es un precio nervioso — la pregunta es TU estómago" #110b) →
¿tranquila = segura? ✘(E8).

**"Poco negociada":** ¿qué significa? ✔ → ¿por qué nadie la compra? ✘("empresas familiares con
pocas acciones sueltas" — free float T) → ¿me conviene? ✘(directo: para empezar, NO — puedes
quedar atrapado) → ¿entonces por qué la muestran? ✘("porque existir ≠ recomendar; y sus
dividendos pueden ser reales" — honestidad de catálogo).

**Hecho 🟢:** ¿quién decidió que es buena? ◐(tooltip razones) → ¿el robot puede equivocarse? ✘
(decirlo: "es una lectura automática de señales — el PDF manda") → ¿qué hago? ✘(§11.11).

**Producción minera:** ¿TMF/onzas? ✔T → ¿mucho o poco? ✔(% del Perú) → ¿más producción = más
gano yo? ✘(el puente §3.12 + "solo si el precio del metal acompaña" #116).

**Escenarios:** ¿quién inventó estos 3 futuros? ◐(E14) → ¿cuál va a pasar? ✔("no se sabe" bien
dicho) → ¿me preparo cómo? ✘(#104).

## 27. Las preguntas invisibles — las que nadie formula y todos necesitan

El oro del laboratorio: si no se responden, el usuario construye un modelo mental FALSO y cada
dato posterior se malinterpreta. Van como FAQ de nivel 1 (#140) y salpicadas donde tocan:

1. **¿A dónde va mi plata cuando compro?** → al que te VENDE la acción, no a la empresa. (Sin
   esto, "apoyar a la empresa comprando" — modelo mental falso comunísimo.)
2. **¿Puedo perder MÁS de lo que puse?** → No (al contado). El miedo silencioso #1.
3. **¿Qué pasa con mis acciones si quiebra mi SAB?** → están en CAVALI a tu nombre, no en la SAB.
4. **¿La empresa sabe que soy accionista? ¿me llega algo?** → sí: registro, junta, dividendos.
5. **¿Quién pone el precio?** → nadie: el cruce de órdenes. (Sin esto, "la empresa/el gobierno
   sube el precio" — falso agente.)
6. **¿Si la empresa gana, me toca automático?** → NO: solo si reparte. Ganancia ≠ dividendo (la
   confusión EPS del §26).
7. **¿Por qué hay acciones de S/0.15 y de S/300?** → número de acciones; barato-el-precio ≠
   barata-la-empresa (#106).
8. **¿Qué le pasa a MI acción si la empresa quiebra?** → cobras al final de la cola: puedes
   perder todo lo puesto — por eso importan deuda y riesgos.
9. **¿Por qué una empresa "peruana" cotiza en dólares o en Nueva York?** → BVN/AUNA/SCCO: la
   cabecera debe decirlo en una línea.
10. **¿Puedo vender cuando yo quiera?** → solo si alguien compra: la iliquidez ES la respuesta.
11. **¿"No negocia hace meses" = la empresa está muerta?** → no: la EMPRESA opera; su ACCIÓN no
    cambia de manos (#142).
12. **¿Pago impuestos?** → dividendos con retención ~5%; ganancia al vender, 5% (#78).
13. **¿Esto es apostar?** → la respuesta honesta y matizada que define la identidad de ALTO:
    comprar sin estudiar = apostar; estudiar cambia el juego. Merece estar EN la portada.
14. **¿Qué es la SMV y por qué ALTO la cita tanto?** → el árbitro que obliga a decir la verdad —
    es la credencial de TODOS los datos de la app y solo se explica en N4 (#138).

## 28. Los 10 momentos de abandono, rankeados

1. **La puerta de niveles al usuario cero** (§16.1): le pregunta cuán metido está en algo que no
   sabe qué es → #135 botón "🐣 nunca he invertido".
2. **El cripto/TikTok no encuentra el botón comprar ni una contraoferta** → #139/#141.
3. **El plazo-fijista lee el yield como TEA** → no abandona hoy: abandona DECEPCIONADO en 6
   meses, y no vuelve nunca → #136 (el abandono más caro porque es con rencor).
4. **La avalancha 2→3** (12-14 conceptos, §19) → #122 + tour de desbloqueo.
5. **El dividendero compra sin saber la fecha de corte** → daño económico real → #48.
6. **El escéptico no encuentra quién está detrás ni las fuentes (N4)** → #138.
7. **Primera ficha abierta = ilíquida**: "Sin cotización · Pendiente SMV" suena a app rota → #142
   + Explorar podría abrir por defecto las líquidas.
8. **"¿Ferrey-qué?" — identidad de empresa no resuelta en 5s** → #102/#137.
9. **El flujo de 4 pasos de Sentinel** → tour #8 + ejemplo precargado.
10. **El rechazo seco de "¿qué compro?"** sin redirección con gancho → #141.

## 29. Los primeros 5 minutos, rediseñados (el recorrido del usuario cero)

**Min 0-1:** entra SIN puerta de niveles (nivel 2 por defecto). Una frase arriba del hero:
"Aquí se aprende a estudiar empresas de la Bolsa de Lima. No se compra, no se recomienda, no
cuesta." + botón "🐣 Nunca he invertido → empieza aquí".
**Min 1-2 (si tocó 🐣):** la Lección Exprés — 5 tarjetas de 15 segundos: qué es una acción /
a dónde va tu plata / ganancia ≠ dividendo / aquí no se compra (se compra en una SAB, así) /
puedes perder — por eso se estudia. *(Las 5 matan las preguntas invisibles 1, 2, 6, 13 y el
agujero #139 de un tiro.)*
**Min 2-3:** el quiz (ya existente, con E4 corregido).
**Min 3-5:** primera ficha CONOCIBLE (Lynch: Gloria/Backus/Luz del Sur — "la de tu recibo") con
el tour re-secuenciado por la escalera (#101) y el saludo de BurbujaTour ya existente.
**Cierre del min 5:** "esto fue el nivel Aprender. Cuando quieras más: 🎚️" — la puerta de
niveles aparece AHORA, cuando ya sabe qué está eligiendo.

## 30. Mejoras de la Parte IV (135–150)

135. **[P0]** Botón "🐣 Nunca he invertido — empieza aquí" + Lección Exprés de 5 tarjetas (mata
     4 preguntas invisibles y el momento de abandono #1).
136. **[P0]** El yield NUNCA a solas: "no es una tasa fija como el banco" en cada lugar donde se
     muestre (el malentendido del plazo-fijista, abandono con rencor).
137. **[P0]** Ticker descifrado en la cabecera ("VOLCABC1 = Volcan, acción común clase B" + por
     qué existen clases) y moneda explicada ahí mismo.
138. **[P1]** Página "¿Quiénes somos y de dónde salen los datos?" accesible desde nivel 1 — la
     confianza (SMV como árbitro, el robot, las fuentes) hoy está gateada al nivel 4.
139. **[P1]** La respuesta canónica al "¿dónde compro?": mini-guía de la SAB (qué es, costos,
     tipos de orden, mínimos) enlazada desde ficha y simulador — dicha con orgullo ("aquí se
     decide; allá se ejecuta").
140. **[P1]** El FAQ de las preguntas invisibles (§27) como vista de nivel 1 + salpicado
     contextual (la #8 en Riesgos, la #10 en iliquidez, la #5 en el sparkline).
141. **[P1]** El rechazo con contraoferta: cuando alguien pida "cuál sube" (Atlas/buscador), la
     negativa Regla #9 va seguida de un gancho inmediato (duelo/quiz/simulador).
142. **[P1]** Reescribir los estados vacíos para nivel 1: "Sin cotización", "Pendiente de
     verificar (SMV)", línea plana — hoy suenan a app rota; deben sonar a mercado real explicado.
143. **[P2]** Accesibilidad jubilado: tamaño de letra ajustable (A±) y contraste — y probar la
     app con letra grande sin desbordes.
144. **[P2]** Las ~60 familias de este mapa cargadas como intents/chips de Atlas (cada pregunta
     del laboratorio que ALTO no responde en interfaz, Atlas la responde en chat).
145. **[P2]** Telemetría de dudas sin backend: contar localmente qué tooltips se abren más y
     ofrecer "enviar mis dudas frecuentes" por Comentarios — para priorizar contenido real.
146. **[P2]** Los 11 recorridos de 30 segundos (§24) como checklist de QA manual permanente:
     cada release grande se prueba "con cerebro de usuario cero".
147. **[P3]** 5 videos de 60s (acción, dividendo, P/E, deuda, iliquidez) enlazados desde tooltips
     — conecta con el pendiente del TikTok promocional.
148. **[P3]** "Míralo con un ejemplo": cada concepto tiene su empresa-ejemplo canónica (P/E→
     Gloria, deuda-lente→AUNA, ciclo→Volcan, iliquidez→FOSSAL, corte→la próxima que pague).
149. **[P3]** Glosario con audio (Web Speech, cero dependencias) para lectura difícil.
150. **[P3]** La pregunta de salida: "¿qué no entendiste hoy?" (1 tap + opcional texto) →
     alimenta el FAQ y las prioridades de contenido.

**Cierre de la Parte IV:** el laboratorio confirma la tesis de todo el documento desde el otro
lado del mostrador: los expertos (Parte I-III) pedían lentes y escalera; los usuarios cero piden
IDENTIDAD (¿quién es esta empresa?), MECANISMO (¿a dónde va mi plata?) y CONFIANZA (¿quiénes son
ustedes?) — tres cosas más baratas de construir que cualquier indicador, y que hoy son los tres
primeros motivos de abandono.

---

# PARTE V — EL MENTOR ALTO (idea de Jair, 21-jul: el botón flotante contextual)

## 31. Veredicto: no es una mejora más — es la PUERTA que unifica el plan

La propuesta de Jair (botón flotante permanente → panel chico → modo "toca cualquier cosa" →
tarjetas con analogía → "🤔 No entendí" contextual → progreso ✔ → etiqueta que cambia según la
sección) resuelve de un golpe el problema de distribución de TODO este documento: teníamos el
CONTENIDO (guiones §6, cadenas §11/§26, analogías #62, familias del Mapa de Dudas §25) pero
repartido en 5 puertas distintas (tooltips, tours, guía, Atlas, FAQ). **El Mentor es la única
puerta.** El usuario no busca la ayuda: la ayuda está parada al costado, hablando de lo que él
está mirando.

**Qué absorbe (estas mejoras dejan de ser features sueltas y se vuelven modos del Mentor):**
- #6 micro-tours de indicador → son las tarjetas del modo tocar.
- #105 cadena conversacional → cada tarjeta termina en la siguiente pregunta ("¿comparado con
  quién? →").
- #82 chips contextuales de Atlas → la opción "🧠 Preguntar a Atlas" con la pregunta ya escrita.
- #140 FAQ de preguntas invisibles → las opciones del "🤔 No entendí" por sección (las familias
  de §25 SON esas listas: Valoración → ¿qué es P/E?/¿por qué barata?/¿quién decidió el rango?).
- #145/#150 telemetría de dudas → cada "no entendí" tocado es un voto; "escríbeme tu duda" va a
  Comentarios.
- #148 empresa-ejemplo canónica → el botón "Ver ejemplo con Gloria" de cada tarjeta.
- La BurbujaTour ❓ existente → el tour pasa a ser UNA opción del panel ("🚶 Tour de esta
  pantalla"). **Regla: un solo botón flotante de aprendizaje** — hoy ya existe ❓ abajo a la
  izquierda y la pill de apoyo; un tercer flotante sería ruido. El Mentor la absorbe, no conviven.

**Ajustes propuestos a la idea (crítica honesta):**
1. **Borde dorado punteado, no azul**: el azul es el color del nivel 3; el lenguaje visual de "esto
   se toca y se explica" en ALTO ya existe — son los puntitos dorados de Glosado. El modo tocar
   debe hablar ese mismo idioma (consistencia > novedad).
2. **Los modos "Seleccionar" y "¿Qué es esto?" son el mismo modo** — fusionarlos en uno solo
   ("👆 ¿Qué es esto? — toca algo"). Dos modos casi iguales duplican la decisión del usuario.
3. **El "mantener presionado cualquier palabra" NO se construye aparte**: Glosado ya intercepta
   las palabras técnicas. Lo que se agrega es que el tooltip de Glosado gane 3 botoncitos
   (📖 más / 📊 ejemplo / 🧠 Atlas). Un sistema de selección paralelo estilo Android es caro,
   frágil en móvil, y duplicaría a Glosado.
4. **"✔✔ Dominado" no se regala**: marcar "dominado" por haber leído sería mentirle al usuario
   sobre sí mismo (Regla #1 aplicada al aprendizaje). ✔ visto = honesto y automático; ✔✔ dominado
   solo si respondió bien la mini-pregunta (conecta con #14). El progreso "aprendiste 5 de 14"
   además es el mapa de qué falta — y alimenta la Academia (#76).
5. **La profundidad de la tarjeta la decide el NIVEL del usuario**: la misma tarjeta de P/E en
   nivel 1 da la analogía de la bodega; en nivel 3 suma el rango y la trampa cíclica; en nivel 4
   remata con el combo (§5). El contenido son los guiones de §6 — ya diseñados, cero trabajo nuevo.
6. **La etiqueta contextual con moderación**: cambiar el texto del botón por sección es oro
   ("💎 ¿Por qué dice Barata?"), pero si cambia a cada scroll parece un bicho nervioso. Regla:
   cambia al ENTRAR a una sección mayor (dividendos/valoración/producción/riesgos), con un
   máximo de 1 cambio cada pocos segundos, y en reposo vuelve a "💡 Explícamelo".
7. **Anatomía técnica barata (sin backend, fiel a la casa)**: los objetivos tocables son
   `data-mentor="pe|deuda|spark|…"` sobre las secciones que ya existen; el contenido vive en un
   `mentor.json` (clave × nivel × lente → tarjeta con analogía/ejemplo/pregunta-siguiente) —
   editable por Jair como todos los JSON; el progreso en localStorage (`alto-mentor-visto`),
   mismo patrón que favoritos; la detección de contexto es el IntersectionObserver que el tour
   ya casi tiene. Cero dependencias.

**Mejora #151 [P0] — El Mentor ALTO**: botón flotante único de aprendizaje con 4 modos (tour /
tocar-y-explicar / no-entendí contextual / Atlas), tarjetas por nivel y lente desde mentor.json,
progreso honesto ✔/✔✔, etiqueta contextual por sección. Absorbe #6, #82, #105, #140, #145, #148,
#150 y la BurbujaTour. **Reordena el plan: la cáscara del Mentor se construye en la Sesión 2
(junto al tour, comparten infraestructura) y las tarjetas se llenan con los guiones de la Sesión
4 — así cada contenido nuevo que se escriba ya tiene dónde vivir.**

*(Maqueta interactiva mostrada a Jair el 21-jul: ficha BVN con el pill dorado, panel de 4
opciones, modo tocar con bordes punteados dorados, tarjeta de la bodega con "Ver ejemplo con
Gloria", "No entendí" contextual de Valoración y contador de aprendidos.)*
