# IA QUE ENTIENDE EL MERCADO

> Estado al **8-ago-2026**. Este archivo es la puerta de entrada: si abres una
> sesión nueva y no sabes dónde estaba todo, empieza acá.
>
> El nombre lo puso Jair y conviene tomarlo en serio en su sentido estrecho:
> **entiende el mercado, no lo predice.** Todo lo que sigue está medido, y lo
> que se midió y falló también está anotado — porque borrar los fracasos es
> cómo se vuelven a desenterrar.

---

## 1. Lo que la IA sabe, y cada cosa con su prueba

### 1.1 La BVL cotiza el mundo con un día de atraso — **PROBADO**

El movimiento del metal del día D predice el de la minera de Lima en D+1. **La
dirección**, no el tamaño.

**La prueba que lo cierra: GLD.** Es un fondo con oro físico adentro que cotiza
en Lima. Su precio *tiene* que seguir al oro:

| | oro D+0 | **oro D−1** | oro D−2 |
|---|---|---|---|
| GLD | +0.021 | **+0.851** | +0.084 |

Un fondo que contiene el metal no queda desalineado por azar. Y el control:
Luz del Sur, que no toca metales, da **−0.001**.

**Tasa de acierto direccional, fuera de muestra (2026):**

| condición | llamadas | acierto | base |
|---|---|---|---|
| cualquier movimiento del metal | 1,240 | 66.0% | 52.8% |
| metal ≥ 0.5% | 982 | 70.1% | 52.8% |
| **metal ≥ 1%** | **793** | **71.8%** | 52.8% |
| metal ≥ 2% | 434 | **74.4%** | 52.8% |

Todas con p < 0.000001.

**Las betas (2026) — si el metal hace +1% hoy, la acción mañana:**

| | metal | beta | r | acierto |
|---|---|---|---|---|
| SCCO | cobre | +1.42 | +0.68 | 87% |
| BVN | oro | +1.25 | +0.66 | 84% |
| GDX | oro | +1.20 | +0.70 | 93% |
| RIO | oro | +0.72 | +0.39 | 75% |
| Atacocha | plata | +0.55 | +0.54 | 66% |
| Volcan | plata | +0.40 | +0.50 | 69% |
| Nexa | plata | +0.32 | +0.51 | 67% |
| Cerro Verde | cobre | +0.25 | +0.20 | 55% |

**Aguantó cuatro intentos de matarlo:** el metal no se autocorrelaciona (oro
−0.034); es un pulso limpio en D+1 y nada en D+2; 10 de 10 acciones positivas
fuera de muestra (p=0.00098) y más fuerte en 2026 (+0.505) que en 2025
(+0.254); y el placebo da mineras +0.426 contra peruanas no mineras +0.120.

**La economía, neta del spread real** (438 operaciones en 2026, comprando
cuando el metal subió ≥1%): promedio **+1.13%** por operación, 63% ganadoras.
Concentrado: BVN +2.64%, SCCO +2.65%, GDX +2.03%, Atacocha +1.96%. Volcan
apenas +0.22% porque su spread de 1.13% se come su beta. Cerro Verde y
Poderosa pierden. Con el spread al doble: +0.36% y 50% ganadoras.

**LO QUE NO SE SABE, Y DECIDE SI SIRVE:** si el movimiento ocurre en el hueco
de apertura, no se puede tomar. El caso que se citaba acá estaba mal leído: RIO
el 7-ago abrió en 2.28 viniendo de 2.10 (hueco +8.6%) pero **cerró en 2.43** —
la sesión agregó +6.6% más, o sea ese día sí era tomable. Un día no prueba
nada en ninguna de las dos direcciones. Medido sobre las 43 ruedas mineras con
apertura guardada: hueco +0.075, sesión −0.117, día completo −0.026. **Con 43
observaciones no se concluye nada.** Ver §4.

### 1.2 El régimen manda sobre la señal

Oro contra S&P 500, correlación de 60 ruedas: **−0.516 en jul-2025 → +0.553 en
jul-2026**. Se dio vuelta entera.

Y R8 vive en este régimen:

| | régimen JUNTOS (hoy) | régimen OPUESTOS |
|---|---|---|
| RIO | beta +0.91 · r **+0.43** | +0.10 · r **+0.04** |
| SCCO | +0.99 · r +0.60 | −0.10 · r **−0.15** |
| BVN | +1.24 · r +0.64 | +0.78 · r +0.37 |

Si el régimen se da vuelta, la señal se apaga sola. 126 días contra 53: es
indicio, no ley.

### 1.3 Los fundamentos no mueven el precio

Tres empresas, mismo esqueleto:

| | operación | resultado | qué lo explica |
|---|---|---|---|
| Volcan | menores volúmenes, mayor costo, coberturas negativas | utilidad +23.3% | *"principalmente la plata"* (su gerencia) |
| Nexa Perú | zinc −5%, cobre −32%, tratado −10%, lluvias en 1T, retraso del block caving, +US$22M de costos | ingresos +45% | *"higher zinc and copper LME prices"* |
| RIO2 | primer trimestre produciendo | EBITDA aj. US$30.8M | compró una mina |

Y la reacción del precio no sigue al número: Volcan +23% de utilidad → la
acción +1.6%. Nexa falló el BPA por 25 centavos → +6.2% en dos ruedas.

**RIO cayó 4 de 4 veces después de sus propios anuncios**, y en los dos grandes
(cierre de Condestable, reporte del 1T) la caída fue 10 y 15 puntos más de lo
que el oro explica.

### 1.4 La plomería pesa más que cualquier señal

Spread real medido el 7-ago (punto medio de las puntas): Minsur 0.14% · BVN
0.29% · Nexa 0.70% · RIO 0.81% · Volcan 1.13% · **BAP 4.65%**.

Cuando el app dice «BAP cayó 2.03%», ese movimiento entero cabe dentro del
spread. Y RIO vale 4.3% menos en Lima que en Toronto por el mismo papel.

**Y el spread no es lo peor: es que algunos días no hay con quién operar.** RIO,
todo lo negociado en la rueda completa (`app/src/data/intradia.json`):

| día | operaciones | monto del día |
|---|---|---|
| 31-jul | 11 | US$63,137 |
| 3-ago | 7 | US$3,220 |
| **4-ago** | **2** | **US$284** |
| 5-ago | 34 | US$189,596 |
| 7-ago | 74 | US$580,908 |

Del día más flaco al más cargado hay **2,000 veces**. La liquidez aparece el día
después de que se movió — justo cuando R8 ya dio la señal y hay que salir. En
`historicos.json` RIO tiene 397 días y solo **154 con cambio de precio**: en 243
ruedas no hubo precio nuevo.

**Esto no toca la tasa de acierto — toca si el acierto se puede cobrar.** Son
las dos preguntas separadas de todo el laboratorio, y esta columna es la
segunda. Con 5 días de intradía no alcanza para una regla; alcanza para saber
que el tamaño de la posición no lo decide la señal, lo decide el libro.

---

## 2. El cementerio — lo que se midió y murió

Se guarda para no volver a desenterrarlo. Detalle completo en
`REGLAS_CONGELADAS.md`.

| regla | por qué murió |
|---|---|
| Rebote tras caída ≥5% | 87% en las tres mineras, **54% en las otras 43** |
| Cuatro verdes seguidas | 86% en 2025 → **36%** en 2026 |
| Acompañada vs sola | derivada mirando el periodo de prueba |
| Techo y lateral tras techo | n=9 y n=5, y el signo al revés |
| Capacidad de explosión / asimetría | Spearman +0.127 (p=0.40); Aenza pasó de −9.2% a +9.5% |
| Compresión precede expansión | falso acá: la quieta explota **menos** (6.3% vs 8.9%) |
| Filtro de volumen del ADR | 60% contra base 42.5%, pero **p=0.18** y todo son 4 casos de RIO |
| Magnitud (¿se va a mover?) | 72% aparente, pero **era composición**: dentro de cada acción el lift es −2.8 pts |

**El patrón de todos:** un efecto agregado que en realidad decía en qué acción
estabas parado. La prueba por defecto ya no es entrenamiento/prueba —
**es comparar dentro de la misma acción.**

---

## 3. El cerebro: cómo está hecho y cómo va

`cerebro.py` · `bitacora.py` · examen de cinco pruebas.

**Objetivo:** probabilidad de que |retorno de 5 ruedas| ≥ 2%. **No opina de
dirección**: 34% de acierto medido a una rueda.

**Se puntúa con Brier, no con tasa de acierto.** Un lector honesto no es el que
más acierta: es el que cuando dice 70% acierta 70%.

**Estado: 2 de 5.** Calibrado sin sesgo (dice 58.5%, pasa 58.4%; dice 70-80%,
pasa 74.9%; dice 0-10%, pasa 1.4%). Falla las tres que piden lectura de día.

**Las seis reglas de arquitectura, todas nacidas de un error:**
1. Todo se compara **dentro de la misma acción**.
2. Variable de FECHA (clima del mercado) → se estima juntando las 46. Variable
   de ACCIÓN (zona del precio) → dentro de cada una y después se promedia.
   Juntarlas mezcla «esta acción en su techo vs en su medio» con «una cara vs
   otra barata», y gana la segunda.
3. Ventana corta para el nivel (90 ruedas, arregló un sesgo de 8.3 puntos),
   historia larga para los efectos.
4. Todo en log-odds: +13 puntos sobre una base de 20% y de 80% no son lo mismo.
5. Encogimiento proporcional a la evidencia: peso = casos/(casos+25).
6. Dos puntos de abstención, y son los más difíciles de programar.

**Advertencia grabada:** la v1 sacó 5/5 con un examen regalado. Los cortes eran
absolutos y los aprobaba un modelo cuya única habilidad era saber en qué acción
estaba: su propia base ya daba 0.0380 de las 0.0383 de resolución. El examen v2
mide todo **como ganancia sobre esa base**.

---

## 4. Lo que falta, en orden de lo que desbloquea

1. **La apertura histórica.** Decide si R8 se puede tomar o se lo lleva el
   hueco. `fetch_precios.py` la borraba cada 45 días; **arreglado el 8-ago**,
   ahora conserva el resumen para siempre y solo poda las `tomas`. Respuesta en
   ~2 meses.
2. **La liquidez diaria.** Decide el tamaño de cualquier posición, y para los
   papeles flacos decide si se puede entrar. RIO negoció US$284 en la rueda del
   4-ago y US$580,908 el 7-ago (§1.4). `intradia.json` guarda 20 días y acumula
   solo — con dos meses más se vuelve una distribución, no cinco anécdotas.
   Es la vuelta por afuera al punto 4: el histórico no se puede pedir, pero
   sí se puede juntar de acá en adelante.
3. **El zinc.** Yahoo no lo publica (`ZINC=F`, `ZN=F` → 404). Nexa y Atacocha
   andan con plata prestada. El informe trimestral de Nexa **sí trae el precio
   LME del zinc** (US$3,466/t en 2T26): se puede sacar de ahí.
4. **Volumen histórico: imposible.** Probado — el endpoint de históricos solo
   da `[fecha, cierre]` y el de mercado ignora `date`, `fecha`,
   `startDate/endDate`, `queryDate` y `sessionDate`.

---

## 5. Los archivos

| archivo | qué hace |
|---|---|
| `cerebro.py` | el motor + su examen de 5 pruebas |
| `bitacora.py` | `anotar` / `resolver` / `examen` — apuesta escrita antes del resultado |
| `bitacora.jsonl` | el registro. **No se edita nunca** |
| `REGLAS_CONGELADAS.md` | R1 a R8 con su corte, su fecha y su resultado |
| `metal_manda.py` | la prueba del metal → minera |
| `estabilidad_colas.py` | Spearman de la cola, el que mató la tabla de explosión |
| `filtro_adr.py` + `eventos_adr.csv` | el filtro de volumen extranjero, rechazado |
| `pregunta_magnitud.py` | el cambio de pregunta: magnitud en vez de dirección |
| `../extractor/fetch_metales.py` | oro, plata, cobre, platino diarios (Yahoo, acumula) |
| `../app/src/data/metales_diarios.json` | 503 cierres por metal, ago-2024 → hoy |

**Nada está commiteado.** El repo tiene todo esto sin versionar.

---

## 6. La lección de método, que vale más que todas las reglas

**Una hipótesis que sobrevive a muchos exámenes sobre los mismos datos no está
más probada que al principio.** El rebote pasó tres controles duros — el de
puntas de la literatura, la medida de Roll, el costo real — y los tres eran
sobre los mismos 15 casos. La primera prueba que agregó datos nuevos lo tumbó
en un intento.

Y dos veces hubo que corregir memoria escrita horas antes: un refinamiento
derivado mirando el periodo de prueba, y una regla anunciada como sobreviviente
antes de probarla fuera de las tres mineras.

**Cada vez que en lugar de argumentar se agregaron datos, el número bajó y se
acercó a la verdad.** 87% → 54% al mirar 43 acciones más. 5/5 → 1/5 al arreglar
el examen. 72% → composición al comparar cada acción consigo misma.
