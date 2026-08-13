# CONSULTA — El laboratorio de trading de ALTO

> **Para quien lo lea sin contexto previo.** Jair quiere operar la BVL a horizontes
> de hasta ~2 semanas. Sobre los datos que la app ALTO ya baja a diario se construyó
> un laboratorio de medición. Este documento es el estado completo: qué datos hay,
> qué se midió, qué sobrevivió, qué se cayó y qué preguntas quedan abiertas.
> Fecha del corte: **6 de agosto de 2026**.

---

## 1. El caso que originó todo

Volcan (VOLCABC1) publicó sus resultados del 2T26 el **21-jul a las 19:12** (después
del cierre). Venía de S/0.851. Bajó siete ruedas seguidas hasta **S/0.784 (−7.9%)** y
el martes **4-ago saltó +8.4% a S/0.850** en un solo día.

La hipótesis de Jair: *el mercado castiga de más el EEFF y en dos semanas rebota; eso
se puede operar*.

**Medido, esa hipótesis es falsa como está enunciada, y verdadera en otra forma.**
Ver hallazgos 2 y 3.

---

## 2. Los datos que existen, y la frontera dura

Esto manda sobre todo lo demás. Lo que no tiene historia no puede sostener una
afirmación estadística, por bien que suene.

| dato | qué hay realmente | qué puede sostener |
|---|---|---|
| `historicos.json` | cierres diarios, **45 acciones que de verdad se negocian**, abr-2025 → hoy. Solo `[fecha, precio]` | ✅ afirmaciones estadísticas |
| `hechos.json` | Hechos de Importancia, **~15 por empresa**; el más antiguo típico es 30-ene-2026 | ⚠️ ~6 meses reales, no 12 |
| `noticias.json` | **ventana móvil de 20 días**, 173 titulares. Cada corrida bota lo viejo | ❌ **cero historia** |
| volumen | solo el de HOY (`precios.json`) e `intradia.json` (19 días, 4 con Volcan) | ❌ cero historia |
| `bpa_historico.json`, `fcf_ttm.json` | trimestrales, ~8 puntos por empresa | ⚠️ etiqueta, no estadística |
| `cotizaciones.json` | metales, promedio **MENSUAL** del BCRP, ~36 puntos | ⚠️ régimen grueso |

**Consecuencias que no se pueden negociar:**

- No existe la historia de titulares de la BVL. Una frase como *«en 17 casos similares
  con noticias positivas…»* es imposible de calcular **y de refutar**. Es exactamente
  el tipo de frase que suena más inteligente que todo lo que sí se puede sostener.
- *«8 de esos casos tenían volumen creciente»* tampoco: no hay volumen viejo.
- No hay OHLC histórico → **no se pueden dibujar velas**. Dibujarlas sería inventar
  tres de los cuatro números de cada una.
- Si se quiere medir noticias o volumen algún día, hay que **empezar a acumular hoy**;
  hacia atrás no se reconstruye.

Panel resultante: **11 086 filas** (acción × rueda), 45 acciones, abr-2025 → jul-2026.

---

## 3. Metodología — las reglas de la casa

1. Ninguna cuenta usa un dato posterior al día que evalúa.
2. Se entrena hasta **31-ene-2026** y se juzga **feb–jul 2026**, un tramo que ninguna
   regla vio al escribirse. Lo que solo funciona antes del corte, no funciona.
3. La vara no es ganar plata: es ganarle a **comprar cualquier cosa cualquier día**.
   Ese piso se calcula e imprime siempre.
4. Los costos entran siempre: **0.6% de comisión + 1% de spread supuesto**, ida y vuelta.
5. **Sin ventanas pisadas**: una posición a la vez por acción. Sin esto la misma caída
   se cuenta tres veces y cualquier resultado se infla.
6. **Prueba nula obligatoria** en todo lo que sea «casos parecidos»: se sortean cientos
   de grupos al azar del mismo pozo y se reporta el percentil del resultado real.

---

## 4. Los siete hallazgos

### 4.1 — Trece de quince señales se INVIERTEN fuera de muestra ❌

Momentum (1/3/5/10/20 ruedas), RSI, racha, fuerza relativa, distancia al techo,
volatilidad: todas mandaban «comprar lo que sube» en el entrenamiento y **cambiaban de
signo** en el examen. Causa: el tramo de entrenamiento fue alcista (+2.52% de media por
cada 10 ruedas) y el de examen plano (+0.54%). Con el retorno crudo como objetivo,
cualquier señal aprende a decir «que suba» — y eso es el calendario, no una señal.

**Regla que salió de acá:** el objetivo se mide **contra la mediana de la bolsa de ese
día**, no contra cero.

### 4.2 — La caída fuerte de corto plazo SÍ rebota ✅

Única regla que aguanta los dos tramos, con la mediana acompañando a la media y
repartida en decenas de acciones. Neto = bruto − 0.6% − 1.0%.

| regla | tramo | ops | mediana | gana | **neto** | acciones |
|---|---|---|---|---|---|---|
| −3% en 3 ruedas | entrena | 213 | +1.63% | 64% | +0.69% | 38 |
| −3% en 3 ruedas | EXAMEN | 254 | +1.54% | 59% | +0.65% | 43 |
| −5% en 3 ruedas | entrena | 119 | +1.74% | 66% | +0.48% | 34 |
| −5% en 3 ruedas | EXAMEN | 160 | +2.25% | 63% | **+1.49%** | 37 |
| −8% en 3 ruedas | entrena | 52 | +3.34% | 69% | +1.33% | 26 |
| −8% en 3 ruedas | EXAMEN | 88 | +4.40% | 68% | **+3.14%** | 29 |
| piso (cualquier cosa) | EXAMEN | 506 | +0.22% | 52% | −1.11% | 45 |

Más hondo el hueco, más grande el rebote. Ninguna acción sola aporta más del 18%.

### 4.3 — Pero la caída causada por el EEFF NO rebota: sigue ❌

Estudio de eventos aparte, 431 hechos, 323 con 15 ruedas de futuro:

- **EEFF trimestral es la única familia que se inclina en rojo**: n=61, mediana −0.97%
  a 5 ruedas, **33% en verde**. Juntas de accionistas (+3.74% a 3r, 70% verde, n=23) y
  clasificaciones de riesgo (+5.61% a 15r, **90% verde**, n=20) van al otro lado.
- De los EEFF castigados (−2% o peor a 3 ruedas): piso en la rueda 5, saldo a 15 ruedas
  **−6.47%**, y solo **13% recuperó todo**. El control genérico rebota **más** (+3.65%
  vs +2.83%) y pierde **menos** (−2.60%).

**Las dos mitades juntas dan un mercado coherente: exagera el ruido y se queda corto
con la noticia.** Volcan jul-2026 es ese 13%, no la regla.

### 4.4 — La memoria de mercado encuentra, pero no evita ✅⚠️

Motor de similitud: toma el estado de una acción, busca las 20 ruedas más parecidas de
los 19 meses, con tres podas (nada del futuro; nada de la misma acción a menos de 20
ruedas; un episodio = un voto). Cada resultado pasa por 800 sorteos al azar.

Validación sobre 400 ruedas del examen, vecinos solo del pasado de cada una:

| la memoria dijo | n | media | mediana | gana |
|---|---|---|---|---|
| BUENO (percentil ≥90) | 57 | +1.99% | **+2.53%** | **63%** |
| MALO (percentil ≤10) | 93 | +0.57% | +0.11% | 51% |
| indistinguible | 250 | +0.60% | +0.18% | 52% |
| piso (todas) | 400 | +0.79% | +0.30% | 53% |

**Sirve para encontrar, no para evitar**: cuando dice MALO el precio sube casi igual.
Y **no es la regla del rebote disfrazada**: 42 de los 57 aciertos (74%) son casos que
«cayó −3%» nunca ve (estado típico 3r +1.58%, rsi 55), y ahí da mediana +2.55% con 69%
de aciertos. n=42 — dirección, no certeza.

### 4.5 — La sensibilidad al metal es del SECTOR, no de la empresa ❌

Variación mensual de cada minera contra la del metal (BCRP, 18 meses), cada r contra
2 000 permutaciones. Con n=18, una serie sin relación llega a |r|=0.48 el 5% de las
veces solo por azar.

En crudo Volcan sigue a la **plata** (r=+0.65\*) y **no al zinc** (+0.29) siendo minera
de zinc — parece confirmar el «Factor Plata» de sus informes. Hasta que sale **estaño
+0.55\*** en una empresa que no produce estaño: eso delata un factor común.

Descontando la mediana de las mineras cada mes:

| acción | plata cruda | plata **propia** |
|---|---|---|
| VOLCABC1 | +0.65\* | **+0.31** (nada) |
| BVN | +0.64\* | +0.12 (nada) |
| MINSURI1 | +0.77\* | +0.01 (nada) |
| **ATACOBC1** | +0.82\* | **+0.78\*** |
| CVERDEC1 | +0.44 | **−0.57\*** |

**Operar Volcan por la plata es operar el sector minero entero con riesgo
idiosincrásico encima.** Atacocha sí tiene exposición propia; Volcan no.

### 4.6 — El 91% de los saltos grandes no tiene ningún papel detrás ❌

Sobre las 45 acciones, en el tramo con cobertura de Hechos: **457 movimientos de 4% o
más**, y solo **43 (9%)** coincidieron con un Hecho que el mercado ya pudiera leer ese
día — contando la **hora real de publicación**, que sale de la ruta del PDF
(`.../20260721191201/...`) y no del JSON. Sin leer la hora, un tercio de los eventos
queda corrido una rueda.

En Volcan: 33 saltos ≥4% en 130 ruedas, 5 con Hecho. Los cinco mayores (−15.31% el
2-feb, +13.98% el 10-jun, −10.56% el 1-jun, +8.75% el 10-feb, +8.42% el 4-ago) **no
tienen nada publicado**. Ni el del 10-jun: la Junta se celebró ese día pero sus
acuerdos se publicaron el 11.

### 4.7 — La clasificación de la familia se decide por el título, y tiene filo

La «Presentación corporativa sobre resultados del 2do. Trimestre» es el EEFF con otro
nombre. Sin esa línea en el clasificador caía en «otros» —tasa base **positiva**— y la
ficha mostraba el número contrario justo el día que más importa. Corregido: EEFF pasó
de 51 a 61 eventos y siguió negativo en los cinco horizontes.

---

## 5. Lo que se construyó (`laboratorio/`, fuera de `app/`)

Vive fuera de la app porque la app tiene la Regla de Oro #29 (*muestra, no recomienda*)
y es pública; esto es un instrumento personal.

| archivo | qué hace |
|---|---|
| `motor.py` | panel + backtest walk-forward. Se le escribe una regla y dice si aguanta |
| `eventos.py` | estudio de eventos por familia de Hecho, con la hora real del PDF |
| `similares.py` | memoria de mercado + prueba nula + validación fuera de muestra |
| `metales.py` | sensibilidad al metal, cruda y descontando el sector, con permutaciones |
| `etiquetas.py` + `.json` | libro de etiquetas cualitativas con hipótesis falsables |
| `ficha.py` | los cuatro cerebros de una acción en una pantalla |
| `grafico.py` | el precio anotado + cono de precios → HTML |
| `hoy.py` | quién está hoy en una situación medida |
| `README.md` | hallazgos y límites |

### Los tres niveles de evidencia

Todo lo que sale rotulado. No es decoración: impide que una corazonada se lea como un
cálculo (Invariante #30 del proyecto).

- 📊 **MEDIDO** — trae n y tasa base contrastada contra el precio (precio diario, Hechos)
- 🏷️ **ETIQUETA** — el dato es real pero no alcanza para una probabilidad (BPA, FCF,
  producción, metales)
- ⚠️ **SIN HISTORIA** — nunca se pudo contrastar y quizá nunca se pueda (noticias, volumen)

### Decisiones de diseño deliberadas

- **No hay puntaje único.** Un número redondo esconde de dónde salió y qué cerebro
  mandó. Cada bloque habla por su cuenta y las contradicciones quedan visibles.
- **Fundamentales, metales y noticias NO entran a la distancia de similitud.** Se
  muestran como contexto rotulado.
- **El cono de precios da rango, no dirección.** Para Volcan a S/0.860, a 10 ruedas:
  80% de los casos parecidos entre **S/0.807 y S/0.927**, mediana S/0.865 — pero la
  prueba nula deja ese centro en *percentil 48, indistinguible del azar*. El ancho sí
  es información; la dirección no.

---

## 6. Lo que se rechazó de la arquitectura propuesta, y por qué

Se propuso una IA de cuatro cerebros (fundamental, mercado, catalizadores,
probabilístico) con memoria de patrones. Se adoptó casi entera. Lo que no:

1. **«Cerebro de catalizadores» con noticias** → imposible: ventana móvil de 20 días.
2. **«8 de esos casos tenían volumen creciente»** → imposible: no hay volumen viejo.
3. **Fundamentales como dimensión de similitud** → 8 puntos por empresa; etiquetan un
   episodio, no pesan en una distancia.
4. **«Las calificadoras son un piso de precio»** → la secuencia lo contradice: Fitch
   salió el 1-jun y Volcan cerró ese día en 0.720 **bajando desde 0.805**; siguió a
   0.690. La subida arrancó el 10-jun, día de la Junta.
5. **Emitir «compra/vende»** → fuera de alcance por decisión explícita.

**Discrepancias de datos detectadas** (importan porque una etiqueta sin base contable
compara peras con manzanas):

- utilidad 2T26: **5.5 M USD** (individual, que es lo que lee ALTO) vs **46.9 M**
  (consolidado, que citan los informes de gerencia). **8× de diferencia.**
- caja: **400.9 M** (individual) vs **493.2 M** (consolidado).
- bono: **8.500%** es el cupón (hechos del 16 y 24-jun) y **7.75%** la tasa de
  reapertura de 220 MM. Los dos números son correctos y significan cosas distintas.
  Colocar por debajo del cupón propio es apetito institucional.

Por eso el libro de etiquetas exige el campo `base: individual | consolidado | no_aplica`.

---

## 7. Estado del libro de etiquetas

14 etiquetas anotadas: **2 verificadas por el laboratorio, 12 marcadas «viene de un
tercero»**. Cada una con fecha del documento, fuente y base contable.

La mejor de las cualitativas: **coberturas −84.0 MM USD en 1H26**. Es la que reconcilia
el 5.5 M de utilidad individual del repo con el relato de negocio sano — explica una
contradicción real en vez de decorar.

**Hipótesis abierta y corriendo:** anotada el 2026-08-05 con precio de referencia
S/0.860, dice «sube» a 10 ruedas. Vence alrededor del 19-ago y **se puntúa sola contra
el precio, gane o pierda**. Es la primera entrada del cuaderno.

Con 0 hipótesis vencidas no hay marcador. El libro existe para **acumular**: se juzga
cuando haya ~30.

---

## 8. Lo que el laboratorio NO puede decir todavía

1. **El spread no está en ningún archivo.** Una acción que acaba de caer 8% no se
   compra al precio de cierre. Con 3% de ida y vuelta, toda la ventaja del hallazgo 4.2
   muere. **Es el supuesto más frágil de todo esto** y solo se verifica mirando la
   punta real en la SAB.
2. **19 meses no contienen una caída general de la BVL.** Ninguna tasa base ha visto un
   mercado feo de verdad.
3. **Entran ETF y ADR extranjeros** (QQQ, GDX, SMH, RIO, SCCO) con liquidez distinta a
   una minera local. Separarlos está pendiente.
4. **Los hechos cubren ~6 meses**, así que el corte «−5% CON EEFF de por medio» se
   queda en 14 operaciones y no concluye nada.

---

## 9. Preguntas abiertas — dónde un tercero aporta más

1. ~~**El spread.** ¿Alguna fuente pública da bid/ask?~~ **RESUELTO (6-ago).** Sí, y
   estaba en el propio repo: el endpoint `dataondemand.bvl.com.pe/v1/stock-quote/market`
   —el que el robot ya llama a diario— devuelve `buy` y `sell` **durante la rueda**.
   `fetch_precios.py:200` lo documentaba y lo descartaba a propósito (para fijar el
   precio hacían bien). Con el mercado cerrado el payload se reduce a `previous`, así
   que hay que capturarlo entre 9:00 y 15:00. Ya está en `laboratorio/ohlc.py --vivo`.
   **No hace falta ningún puente a la SAB ni scraping del navegador.** Queda pendiente
   solo acumular ruedas: hacia atrás no existe.
2. **¿Vale la pena leer los PDF con un LLM?** Las etiquetas cualitativas tendrían ~61
   eventos con precio, no miles. ¿Cómo se validaría que aportan, sin caer en contar la
   historia después de ver el precio?
3. **El sesgo de supervivencia del panel:** son las 45 que hoy se negocian. Las que
   dejaron de negociarse no están. ¿Cuánto infla eso las tasas base?
4. **La memoria acierta cuando dice BUENO pero falla cuando dice MALO.** ¿Es una
   asimetría real del mercado (las caídas son más impredecibles) o un artefacto de
   medir en un tramo sin mercado bajista?
5. **n=42 en el hallazgo 4.4.** ¿Qué prueba adicional lo mataría o lo confirmaría, sin
   volver a usar el mismo tramo?
6. **Acumulación:** si empezamos hoy a guardar volumen diario, OHLC y cada corrida de
   noticias, ¿cuál de los tres da antes una muestra utilizable?

---

## 10. Cómo reproducir todo

```bash
python laboratorio/motor.py             # valida reglas: entrena vs examen
python laboratorio/eventos.py           # tasa base por familia de Hecho
python laboratorio/similares.py validar # ¿la memoria acertó fuera de muestra?
python laboratorio/metales.py           # sensibilidad al metal, cruda y propia
python laboratorio/ficha.py VOLCABC1    # los cuatro cerebros en una pantalla
python laboratorio/grafico.py VOLCABC1  # el precio anotado + cono
python laboratorio/etiquetas.py         # el libro y el marcador de hipótesis
python laboratorio/hoy.py               # quién está hoy en situación medida
```

Todo sale de datos que el robot de ALTO ya baja a diario. Cero fuentes nuevas.
