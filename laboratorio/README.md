# 🔬 El laboratorio

Instrumento personal de Jair. **No entra a la app**: la app tiene la Regla de Oro
(#29 — muestra, no recomienda) y es pública; esto responde «¿esta situación vino
seguida de algo?», que es otra pregunta y otro público.

```bash
python laboratorio/motor.py            # valida reglas: entrena vs examen
python laboratorio/hoy.py              # quién está hoy en una situación medida
python laboratorio/eventos.py          # tasa base por familia de Hecho
python laboratorio/similares.py TICKER # ruedas parecidas del pasado + prueba nula
python laboratorio/similares.py validar# ¿la memoria acertó fuera de muestra?
python laboratorio/ficha.py TICKER     # los cuatro cerebros en una pantalla
python laboratorio/grafico.py TICKER   # el precio anotado → grafico-TICKER.html
python laboratorio/ohlc.py             # cosecha la rueda de hoy (OHLC + volumen)
python laboratorio/ohlc.py --vivo      # captura la PUNTA (bid/ask) — correr EN RUEDA
python laboratorio/ohlc.py NEXAPEC1 4.10 4.14   # punta a mano, si hiciera falta
python laboratorio/ohlc.py --estado    # cuánto llevamos acumulado
```

**La punta es pública y estaba a la vista.** `fetch_precios.py:200` ya lo
documentaba sin usarlo: *«'sell' es la orden de venta (ask) parada en pantalla, NO
el cierre → nunca usar 'sell'»*. Para fijar el precio hacían bien en descartarla;
para medir el spread es justo el dato que falta, y viene gratis en la misma
respuesta. El payload cambia con la hora: **con el mercado cerrado el endpoint solo
trae `previous`**, así que `--vivo` hay que correrlo entre las 9:00 y las 15:00 de
Lima. No hace falta ningún puente a la SAB.

**`ohlc.py` es lo único que arregla los agujeros, y solo hacia adelante.**
`precios.json` ya trae OHLC y volumen de ~50 tickers todos los días, pero el robot
lo **sobreescribe**: el acumulador se los queda antes de que se pierdan. No pide
nada a mano salvo la punta compradora/vendedora, que no existe en ningún archivo y
es el supuesto más frágil del laboratorio. La fecha se toma **del dato, nunca del
reloj**: `precios.json` trae una `fecha` por ticker y hoy conviven tres distintas
en el mismo archivo.

`grafico.py` se vuelve a correr después de cada corrida del robot y trae la rueda
nueva. **No tiene velas ni barras de volumen a propósito**: `historicos.json`
guarda `[fecha, precio]` y `intradia.json` son 19 días (4 con Volcan). Dibujar
apertura, máximo y mínimo con eso sería inventar tres de los cuatro números de
cada vela. Si `fetch_historicos.py` empieza a guardar OHLC, las velas salen solas
desde ese día hacia adelante.

## Los tres niveles de evidencia, y por qué se imprimen distinto

Todo lo que sale de acá viene rotulado. No es decoración: es lo que impide que
una corazonada se lea como un cálculo (Invariante #30 del proyecto).

| rótulo | qué significa | qué datos |
|---|---|---|
| 📊 **MEDIDO** | trae n y tasa base contrastada contra el precio | precio diario, Hechos |
| 🏷️ **ETIQUETA** | el dato es real, pero no alcanza para una probabilidad | BPA, FCF, producción, metales |
| ⚠️ **SIN HISTORIA** | nunca se pudo contrastar y quizá nunca se pueda | noticias, volumen |

`noticias.json` es una **ventana móvil de 20 días** y `historicos.json` guarda
`[fecha, precio]` y nada más. Por eso una frase como «en 17 casos similares con
volumen creciente y noticias positivas…» no es difícil de calcular: es
**imposible** con estos archivos, y suena más inteligente que todo lo que sí se
puede sostener. Ese es el motivo del tercer rótulo.

## Los datos que ya había

Nada nuevo se descarga. Todo sale de lo que el robot deja a diario:
`historicos.json` (cierres diarios, 45 acciones que de verdad se negocian,
abr-2025 → hoy), `precios.json` (la rueda de hoy, que el histórico todavía no
tiene) y `hechos.json` (los Hechos de Importancia).

Panel: **11,086 filas** (acción × rueda). Entrena hasta **2026-01-31**, examen
**feb–jul 2026** — el examen es un tramo que ninguna regla vio al escribirse.

## Lo que se midió el 6-ago-2026

### 1. Trece de quince señales se invierten fuera de muestra

Momentum, RSI, racha, fuerza relativa, distancia al techo: todas mandaban Q5
(comprar lo que sube) en el entrenamiento y **cambiaban de signo** en el examen.
La causa es de manual: el tramo de entrenamiento fue alcista (+2.52% de media
por cada 10 ruedas) y el de examen fue plano (+0.54%). Con el retorno crudo
como objetivo, cualquier señal aprende a decir «que suba» y eso no es una señal,
es el calendario.

**Regla que salió de acá:** el objetivo se mide contra la mediana de la bolsa
ese mismo día, no contra cero.

### 2. La caída fuerte de corto plazo sí rebota

Única regla que aguanta los dos tramos, con la mediana acompañando a la media y
repartida entre decenas de acciones:

| regla | tramo | ops | bruto | mediana | gana | **neto** | acciones |
|---|---|---|---|---|---|---|---|
| −3% en 3 ruedas | entrena | 213 | +2.29% | +1.63% | 64% | +0.69% | 38 |
| −3% en 3 ruedas | EXAMEN | 254 | +2.25% | +1.54% | 59% | +0.65% | 43 |
| −5% en 3 ruedas | entrena | 119 | +2.08% | +1.74% | 66% | +0.48% | 34 |
| −5% en 3 ruedas | EXAMEN | 160 | +3.09% | +2.25% | 63% | **+1.49%** | 37 |
| −8% en 3 ruedas | entrena | 52 | +2.93% | +3.34% | 69% | +1.33% | 26 |
| −8% en 3 ruedas | EXAMEN | 88 | +4.74% | +4.40% | 68% | **+3.14%** | 29 |
| piso (comprar cualquier cosa) | EXAMEN | 506 | +0.49% | +0.22% | 52% | −1.11% | 45 |

Neto = bruto − 0.6% de comisión − 1.0% de spread supuesto. Más hondo el hueco,
más grande el rebote, y en los dos tramos. Ninguna acción sola pone más del 18%
en el examen.

### 3. Pero si la caída la causó el EEFF, no rebota — sigue

Estudio de eventos aparte, sobre 273 episodios con 15 ruedas de futuro (un
trimestre = un episodio; ver el docstring de `estudio()` en `eventos.py`):

- **Las dos familias de EEFF son las únicas que se inclinan en rojo**:
  trimestral n=40, mediana −0.14% a 3 ruedas y **35% en verde a 15**; anual
  n=10, **−3.45% a 15r y 20% en verde**. Juntas (+3.39% a 3r) y clasificaciones
  de riesgo (+4.92% a 15r, 89% en verde) van al otro lado.
- De los **15 EEFF castigados** (−2% o peor a 3 ruedas): saldo a 15 ruedas
  **−6.98%**, peor punto medio −9.16%, y **1 de 15 recuperó todo** (BAP,
  14-may-2026). El mejor punto medio de todo el camino es **+0.11%**: ni
  siquiera hay rebote que aprovechar.
- El control —cualquier caída de −2% en 3 ruedas sin ningún Hecho en esas 3
  ruedas, n=2194 ventanas solapadas— hace lo contrario: mediana a 15 ruedas
  **+2.19%**, mejor punto medio +7.52%, peor −3.17%.

Las dos cosas juntas dan un mercado coherente: **exagera el ruido y se queda
corto con la noticia**. Por eso `hoy.py` marca ⚠ cuando hay un EEFF en las
últimas 10 ruedas.

Cuidado con la dirección de la flecha: esto se midió sobre EEFF que **ya
cayeron**. No dice qué hace un EEFF que el mercado recibió bien —para eso la
familia entera (35% en verde a 15r) es la única referencia, y es débil.

### 4. La memoria de mercado encuentra, pero no evita

`similares.py` toma el estado de una acción y busca las 20 ruedas más parecidas
de los 19 meses, con tres podas (nada del futuro, nada de la misma acción a
menos de 20 ruedas, un episodio = un voto). Ningún resultado sale sin su
**prueba nula**: se sortean 800 grupos del mismo tamaño al azar y se mira dónde
cae el grupo real. La respuesta más frecuente —y la más valiosa— es
«indistinguible del azar».

Validación sobre 400 ruedas del examen (feb–jul 2026), vecinos tomados solo del
pasado de cada una:

| la memoria dijo | n | media | mediana | gana |
|---|---|---|---|---|
| BUENO (percentil ≥90) | 57 | +1.99% | **+2.53%** | **63%** |
| MALO (percentil ≤10) | 93 | +0.57% | +0.11% | 51% |
| indistinguible | 250 | +0.60% | +0.18% | 52% |
| piso (todas) | 400 | +0.79% | +0.30% | 53% |

#### Corrección (6-ago, tras partir el panel)

«Sirve para encontrar pero no para evitar» era **un artefacto de mezclar dos
poblaciones**. Al correr la misma validación por separado:

| grupo | qué dijo | n | media | mediana | gana |
|---|---|---|---|---|---|
| **locales** (25) | BUENO | 41 | **+1.65%** | +0.81% | 63% |
| | MALO | 43 | **−0.50%** | +0.00% | 49% |
| | piso | 300 | +0.32% | +0.06% | 50% |
| **extranjeros** (20) | BUENO | 45 | −0.21% | +1.37% | 58% |
| | MALO | 68 | +0.92% | −1.76% | 47% |
| | piso | 300 | +0.01% | −0.35% | 47% |

**En las locales la memoria sí evita**: MALO da −0.50% contra un piso de +0.32%.
Las dos puntas informan. En las de nomenclatura internacional el resultado es
**incoherente** —media y mediana se contradicen en signo en los dos grupos—, que
es la firma de unos pocos valores extremos mandando. El +0.57% de MALO en la
corrida mezclada venía de ahí.

Caveat del corte: el filtro es por nomenclatura del ticker, así que el balde
«extranjero» junta ETF globales (QQQ, SPY, GLD) con ADR de empresas peruanas
(BVN, BAP, IFS, AUNA). Separar esos dos falta. Y no es la regla del rebote disfrazada — **42 de los 57
aciertos (74%) son casos que «cayó −3%» nunca ve** (estado típico: 3r +1.58%,
rsi 55), y ahí da mediana +2.55% con 69% de aciertos. n=42: dirección, no
certeza.

### 5. La familia del Hecho se decide por el título, y el título llega tarde

La «Presentación corporativa sobre resultados del 2do. Trimestre» es el mismo
evento que el EEFF con otro nombre. Sin esa línea en `familia()` caía en
«otros» —tasa base **positiva**— y la ficha mostraba el número contrario justo
el día que más importa.

Peor todavía: **el día del evento el título no existe**. La SMV publica el
Hecho con `titulo` vacío y lo completa después. El 5-ago-2026, de 421 Hechos
con categoría de aprobación de información financiera, los **únicos 3 sin
título** eran los dos EEFF de Nexa y el de Atacocha, publicados esa noche. O
sea: el título falta exactamente el día en que la ficha se usa. Por eso
`familia()` cae a la **categoría** cuando el título está vacío, y por eso
`fechas_eeff()` llama a la misma función en vez de tener su propia lista de
palabras —tenerlas separadas dejaba entrar un EEFF al estudio de eventos y no a
la exclusión del panel—.

La categoría de la SMV se llama «Aprobación De La Información Financiera Anual
Auditada, Memoria Anual, E Información Financiera Intermedia»: cubre anual e
intermedia con el mismo nombre, así que **no distingue**. Sin título, el
respaldo asume trimestral. Es correcto de agosto a noviembre y puede fallar en
febrero-marzo, que es cuando salen las auditadas.

Al corregir esto y podar los duplicados (un trimestre = un episodio), EEFF
trimestral quedó en **40 episodios** y EEFF anual apareció por primera vez con
n≥10 (**10 episodios, −3.45% a 15r, 20% en verde**). Los dos siguen en rojo.

### 6. La sensibilidad al metal es del sector, no de la empresa

`metales.py` cruza la variación mensual de cada minera con la del metal (BCRP,
~18 meses) y contrasta cada r contra 2,000 permutaciones — con n=18, una serie
sin relación llega a |r|=0.48 el 5% de las veces solo por azar.

En crudo, Volcan sigue a la **plata** (r=+0.65\*) y **no al zinc** (+0.29),
siendo minera de zinc. Confirma el «Factor Plata» de los informes… hasta que se
mira el estaño: +0.55\* en una empresa que no produce estaño. Eso delata un
factor común.

Descontando la mediana de las mineras de cada mes, queda lo **propio**:

| acción | plata cruda | plata propia | veredicto |
|---|---|---|---|
| VOLCABC1 | +0.65\* | **+0.31** | nada propio |
| BVN | +0.64\* | +0.12 | nada propio |
| MINSURI1 | +0.77\* | +0.01 | nada propio |
| ATACOBC1 | +0.82\* | **+0.78\*** | exposición propia real |
| CVERDEC1 | +0.44 | **−0.57\*** | se queda atrás cuando la plata manda |

**Operar Volcan por la plata es operar el sector minero entero con riesgo
idiosincrásico encima.** Atacocha sí tiene plata propia; Volcan no. Y aun así:
una correlación mensual no es una señal de dos semanas — dice con qué se mueve,
no cuándo.

### 7. El 91% de los saltos grandes no tiene ningún papel detrás

Sobre las 45 acciones negociadas, en el tramo con cobertura de Hechos: **457
movimientos de 4% o más**, y solo **43 (9%)** coincidieron con un Hecho que el
mercado ya pudiera leer ese día — contando la hora real de publicación, que sale
de la ruta del PDF y no del JSON.

En Volcan, 33 saltos ≥4% en 130 ruedas y 5 con Hecho. Los cinco más grandes
(−15.31% el 2-feb, +13.98% el 10-jun, −10.56% el 1-jun, +8.75% el 10-feb, +8.42%
el 4-ago) **no tienen nada publicado**. Ni siquiera el del 10-jun: la Junta se
celebró ese día pero sus acuerdos se publicaron el 11.

Por eso `grafico.py` escribe «no se publicó nada» en vez de buscar una causa. Un
gráfico que siempre encuentra explicación es un gráfico que la está inventando.

## Lo que este laboratorio NO puede decir todavía

- **El spread no está en ningún archivo.** Los cierres no dicen a qué precio se
  compra de verdad una acción que acaba de caer 8%. Con 3% de ida y vuelta la
  ventaja del −5% muere. Es el supuesto más frágil de todo esto.
- **`hechos.json` guarda ~15 hechos por empresa** (el más antiguo típico:
  30-ene-2026). Son ~6 meses de eventos, no 12 — por eso el corte «−5% CON EEFF»
  se queda en 14 operaciones y no concluye nada.
- **Un solo régimen y medio.** 19 meses no contienen una caída general de la BVL.
  Ninguna de estas tasas base ha visto un mercado feo de verdad.
- **Entran ETF y ADR extranjeros** (QQQ, GDX, SMH, RIO, SCCO) que se negocian en
  la BVL con otra liquidez que una minera local. Separarlos está pendiente.
