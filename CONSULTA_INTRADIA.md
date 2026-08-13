# CONSULTA — ¿Se puede hacer e-trading intradía con estos datos?

> **Para quien lo lea sin contexto previo.** Jair opera la BVL (Bolsa de Valores de
> Lima) desde Credicorp Capital e-trading. Sobre los datos que su app ALTO baja a
> diario se construyó un laboratorio de medición (ver `CONSULTA_LABORATORIO.md` para
> el estado a 6-ago). Este documento es un **desacuerdo abierto** entre Jair y Claude
> sobre si el proyecto puede darle lo que necesita, y busca una tercera opinión que
> pueda **refutar a cualquiera de los dos**.
> Fecha del corte: **7 de agosto de 2026, 13:30 hora de Lima**.

---

## 1. El desacuerdo, con las dos posiciones en su versión fuerte

**Jair:** el proyecto se llama laboratorio de trading y opera de 8:30 a 15:00. Un
robot de e-trading que no dice a cuánto va a llegar la acción hoy no le sirve: la
operación y la oportunidad son hoy, no mañana. Él toma la decisión y asume el riesgo;
lo que pide es el insumo, no que nadie decida por él. Si no hay número, el proyecto
no cumple su propósito y hay que darlo de baja.

**Claude:** el número no existe en estos datos, y darlo sería fabricarlo. Todo lo que
se midió apunta a que el movimiento intradía no contiene señal direccional, y la
aritmética de costos hace muy difícil que exista una ventaja intradía operable al
tamaño de Jair. La respuesta honesta no es un precio: es una distribución ancha
centrada en el precio actual.

**Lo que se busca de un tercero:** no que dé la razón a nadie. Que señale un error de
método, un dato que existe y no se está usando, o una forma de construir la señal
intradía que sobreviva a las reglas de la casa (sección 6).

---

## 2. La frontera de datos (esto manda sobre todo lo demás)

Dos veces en la historia de este proyecto un tercero propuso módulos imposibles por
no leer esta tabla. Va primero.

| dato | qué hay realmente | qué puede sostener |
|---|---|---|
| cierres diarios oficiales | `/share-values` de la BVL. **45 acciones** que de verdad negocian, abr-2025 → hoy. Solo `[fecha, precio]`. **Publica con 1 día de atraso** | ✅ estadística a días |
| foto de mercado | `/stock-quote/market`. `last`, `previous`, `opening`, `minimun`, `maximun`, `buy`, `sell`, monto, cantidad, operaciones. **En rueda, refrescable sin límite** | ✅ el estado de ahora |
| **historia intradía** | **NO EXISTE.** `intradia.json` tiene un campo `tomas` y está **vacío en las 20 ruedas guardadas**. Solo hay resumen O/H/L/C por día | ❌ **cero** hasta hoy |
| profundidad del libro | **no la publica la BVL.** Solo en la pantalla de la SAB, a mano | ⚠️ puntual, supervisado |
| Hechos de Importancia | ~15 por empresa, el más antiguo típico 30-ene-2026 | ⚠️ ~6 meses |
| noticias | ventana móvil de 20 días, se bota lo viejo en cada corrida | ❌ cero historia |
| ADR de NEXA en NYSE | **no hay.** El robot arma series solo con nemónicos de la BVL | ❌ no existe |

Desde el **7-ago 13:16** corre `laboratorio/tomas.py`, que muestrea el mercado cada 5
minutos y guarda precio, punta, rango, volumen, operaciones y VWAP. Hacia atrás no
reconstruye nada.

---

## 3. Lo que se midió hoy y sostiene la posición de Claude

### 3.1 La apertura no anticipa el resto del día

Con las 20 ruedas de resumen, restringido a **30 acciones líquidas** (20+ operaciones
en el día). `resto = cierre/apertura − 1`.

| | n | media | mediana | subió |
|---|---|---|---|---|
| piso (cualquiera, cualquier día) | 104 | +0.32% | +0.00% | 47% |
| abrió +1% o más | 23 | +0.46% | +0.44% | 52% |
| abrió plano ±1% | 69 | +0.30% | +0.00% | 45% |

En la muestra completa (263 obs, 81 tickers, incluye ilíquidas): abrir **+2% o más**
terminó subiendo el **35%** de las veces contra un piso de 41%.

**Debilidad de esta medición, explícita:** n=23 en la celda que importa. No alcanza
para afirmar nada aunque hubiera salido distinto. Y los días se solapan (cuando la
bolsa entera sube, suben todas), así que el n efectivo es menor que el nominal.

### 3.2 La aritmética del costo contra el tamaño del movimiento

Libro real de Nexa leído en la pantalla de Credicorp el 7-ago 13:03:

```
COMPRA                    VENTA
  500 @ 4.280             4.300 @ 6,815
4,599 @ 4.250             4.330 @ 8,985
1,000 @ 4.210             4.350 @   400
9,273 @ 4.200             4.370 @   746
```

Costo de ida y vuelta **cruzando el spread**, por tamaño:

| tamaño | S/ | ida+vuelta | con comisión 0.6% |
|---|---|---|---|
| 500 | 2,100 | −0.47% | **−1.07%** |
| 2,000 | 8,600 | −0.99% | **−1.59%** |
| 5,000 | 21,000 | −1.09% | **−1.69%** |
| 15,000 | 64,000 | −2.26% | **−2.86%** |

Rango mediano de un día completo (máx/mín) en las líquidas: **1.83%**. En Nexa:
**2.78%** (n=5 ruedas, poquísimo).

→ Para empatar intradía hay que capturar entre **57% y 89% del rango del día
entero**, cada vez. A 10 ruedas el movimiento medido de la única regla que sobrevivió
es **+3.07% bruto** contra el mismo costo, y por eso ahí sí queda ventaja (+1.47%
neto, 64% de aciertos, n=143, fuera de muestra).

**El costo es fijo; la oportunidad crece con el tiempo.** Ese es el argumento central.

### 3.3 Distribución del cierre dentro del rango del día

n=104. Percentiles de dónde cayó el cierre dentro de `[mín, máx]` del día:

| | percentil del rango | aplicado al rango de Nexa hoy (4.180–4.390) |
|---|---|---|
| 1 de cada 10 bajo | 0 | S/4.180 |
| 1 de cada 4 bajo | 14 | S/4.210 |
| la mitad bajo | 62 | **S/4.309** |
| 3 de cada 4 bajo | 93 | S/4.375 |
| 9 de cada 10 bajo | 100 | S/4.390 |

Con Nexa en 4.300, el centro cae en **+0.21%** y la banda del 50% va de **−2.09% a
+1.74%**. Además **1 de cada 10 cierra en el mínimo exacto y 1 de cada 10 en el
máximo exacto**: la distribución se amontona en los extremos, no en el medio.

Vale solo si el rango no se ensancha, y no sabe nada de Nexa en particular.

---

## 4. El punto donde la posición de Claude es MÁS DÉBIL

Esto va acá y no escondido, porque es el mejor argumento contra el propio análisis.

**Todo el cálculo de costos de 3.2 asume ÓRDENES A MERCADO —cruzar el spread.** Si
Jair pone una **orden límite** y espera, no paga el spread: paga en **riesgo de no
ejecución**. Una entrada límite paciente puede costar cerca de 0% de spread, y
entonces:

- el costo cae de ~1.6% a ~0.6% (solo comisión),
- hay que capturar ~22% del rango diario en vez de 57%,
- **y el argumento central de 3.2 se debilita mucho.**

Contra eso: no hay ni un dato en este repo sobre tasas de ejecución de órdenes límite
en la BVL, ni sobre cuánto se pierde por las veces que no ejecutan (que es
precisamente cuando el precio se fue en tu contra — sesgo de selección adverso).
**Nadie midió esto y es medible**: ver pregunta 6.2.

**Segunda debilidad:** Nexa tiene **n=5 ruedas** en la muestra de rango diario. El
2.78% podría estar muy mal estimado.

**Tercera:** la posición de Claude se apoya en que 13 de 15 señales de este repo se
invirtieron fuera de muestra. Eso es evidencia sobre señales *diarias*, y se está
extrapolando a intradía, que es un régimen distinto. La extrapolación puede ser
inválida.

---

## 5. Lo construido hoy (todo corriendo, todo verificable)

| archivo | qué hace |
|---|---|
| `laboratorio/tomas.py` | muestrea el mercado cada 5 min; guarda precio, punta, rango, volumen, VWAP. **Arrancó el 7-ago 13:16** |
| `laboratorio/vivo.py` | el estado de la rueda ahora: rango, punta, spread, movimiento en días típicos, sector, hechos de hoy |
| `laboratorio/libro.py` | costo real de entrar y salir **según el tamaño**, contra el libro de la SAB |
| `laboratorio/motor.py` | corregido: ver 5.1 |
| `laboratorio/eventos.py` | corregido: ver 5.1 |

### 5.1 Cuatro errores encontrados hoy, todos del mismo tipo

1. **El EEFF de Nexa era invisible.** `familia()` clasificaba por el TÍTULO, y la SMV
   publica el Hecho con el título **vacío** y lo completa después. De 421 Hechos con
   categoría financiera, los **únicos 3 sin título** eran los dos EEFF de Nexa y el de
   Atacocha, publicados esa noche. Caían en «otros», familia con tasa base
   **positiva** (+1.24% a 15r, 59% verde), cuando la del EEFF es negativa. Arreglado:
   sin título manda la categoría.
2. **`fechas_eeff()` tenía su propia lista de palabras**, distinta de `familia()`. Un
   EEFF podía entrar al estudio de eventos y no a la exclusión del panel. Unificado.
3. **Duplicados de episodio.** El mismo trimestre entraba 2–3 veces (individual +
   consolidado el mismo día; EEFF + presentación corporativa al día siguiente;
   trimestral + anual el mismo día). 17 «casos castigados» eran 13. Podado: un
   trimestre = un episodio, se queda el primer aviso y, empatados, el individual.
4. **Dos fuentes de precio mezcladas en la misma serie.** `historicos.json` son
   cierres oficiales; `precios.json` es la última operación. Se empalmaba el segundo
   al final del primero. Medido: **43 de 44 acciones difieren en la misma fecha**,
   mediana 0.92%, máximo 13.45%. Eso ponía la ÚLTIMA rueda —la única que mira quien
   decide— en otra escala. En Nexa inventó un **+2.55% y un techo de 3 meses** donde
   el cierre oficial dice **+0.07% y −2.24% bajo el techo**.

### 5.2 Un misterio abierto que invalida precisión, no dirección

Para NEXAPEC1 el **5-ago** hay **tres precios distintos** del mismo día:

- última operación: **4.150** (endpoint de mercado; Credicorp muestra lo mismo como «cierre ant.»)
- VWAP (monto÷cantidad): **4.120**
- serie oficial `/share-values`: **4.050**

Se descartó que el oficial sea el VWAP. **No se sabe qué es 4.050.** Hasta resolverlo,
toda medición tiene ~2% de incertidumbre en el precio de referencia.

---

## 6. Preguntas para el tercero — acá es donde de verdad puede aportar

**6.1 ¿Hay un error de método en 3.1?** El test es `cierre/apertura` condicionado al
gap de apertura. ¿Es la partición correcta? ¿Debería condicionarse al movimiento
relativo al mercado en vez de al absoluto? ¿Al volumen de la primera hora (que no
tenemos)? Con n=23 en la celda clave, ¿qué test tiene potencia suficiente?

**6.2 Órdenes límite (la pregunta más importante).** ¿Cómo se mide la tasa de
ejecución y el sesgo de selección adverso de una orden límite **sin** historia
intradía y **sin** registro de órdenes propias? ¿Se puede aproximar con las tomas de
5 minutos que empezaron hoy? Si se puede, la sección 4 tumba la sección 3.2.

**6.3 ¿Qué se puede preguntar con 36 tomas × 30 ruedas × 45 acciones?** ¿Cuántas
observaciones INDEPENDIENTES son realmente, dado que las acciones de un mismo día
están correlacionadas y las tomas de una misma rueda están autocorrelacionadas? ¿Qué
diseño de walk-forward corresponde?

**6.4 ¿Existe una fuente de historia intradía de la BVL** —o de los ADR de las
peruanas en NYSE— que no estemos viendo? Si existe, cambia todo.

**6.5 El desbalance del libro.** Hoy Nexa pasó de 13.6:1 a 1.9:1 hacia la venta en 15
minutos mientras un comprador barría 5,886 acciones a 4.300. ¿Hay literatura seria de
que el desbalance del libro prediga algo en mercados **ilíquidos** como la BVL, o solo
en mercados profundos? ¿Es medible con tomas de 5 minutos o hace falta tick a tick?

**6.6 La pregunta incómoda, en serio.** Si la respuesta honesta es «con estos datos no
hay señal intradía operable», ¿cuál es la forma correcta de decírselo a alguien que
quiere operar hoy? ¿Y hay un uso intradía legítimo —ejecución, tamaño, no operar—
que valga por sí solo?

---

## 7. Las reglas de la casa (cualquier propuesta debe cumplirlas)

1. Ninguna cuenta usa un dato posterior al día que evalúa.
2. Se entrena hasta `2026-01-31` y se juzga después. Lo que solo funciona antes del
   corte, no funciona.
3. La vara no es ganar plata: es **ganarle a comprar cualquier cosa cualquier día**.
   Ese piso se calcula y se imprime siempre.
4. Los costos entran siempre, y el spread también —ahora con la curva por tamaño de
   la sección 3.2, no con una constante.
5. Prueba nula obligatoria: se sortean grupos al azar del mismo pozo y se mira dónde
   cae el grupo real. La respuesta más frecuente y más valiosa es «indistinguible del
   azar».
6. Una posición a la vez por acción: sin eso, la misma caída se cuenta tres veces.
7. Tres niveles de evidencia separados tipográficamente: MEDIDO (con n), ETIQUETA (sin
   probabilidad), SIN HISTORIA (nunca contrastado contra el precio).

**Historial que conviene saber:** de 15 señales probadas en este repo, **13 se
invirtieron fuera de muestra**. Las que más prometían en el entrenamiento fueron las
peores en el examen. Sobrevivió una: caída de −5% en 3 ruedas sin EEFF de por medio,
+1.47% neto a 10 ruedas, 64% de aciertos, n=143, en 37 acciones distintas.

---

## 8. Cómo refutar a Claude, concretamente

Cualquiera de estas cinco cosas cambia su posición:

1. Una señal intradía que sobreviva walk-forward con el corte de la regla 2, con
   costos restados según la curva de 3.2, y con prueba nula.
2. Una demostración de que el test de 3.1 está mal planteado y que bien planteado da
   otra cosa.
3. Un método defendible para estimar ejecución de órdenes límite que baje el costo
   real muy por debajo de 1.6% (sección 6.2).
4. Una fuente de historia intradía que no estemos viendo (6.4).
5. Evidencia de que el desbalance del libro predice en mercados ilíquidos (6.5).

Lo que **no** lo cambia: un modelo que produzca un precio objetivo sin tasa base, sin
n, sin prueba nula y sin costos. De eso ya se descartaron 13.

---

## 9. Reproducir todo

```bash
python laboratorio/motor.py            # las reglas, entrena vs examen
python laboratorio/eventos.py          # tasa base por familia de Hecho
python laboratorio/ficha.py NEXAPEC1   # los cuatro cerebros
python laboratorio/vivo.py NEXAPEC1    # la rueda ahora
python laboratorio/tomas.py --estado   # cuántas tomas intradía llevamos
python laboratorio/libro.py --estado   # libros anotados
```
