# Reglas congeladas — se escriben ANTES de medir, y no se tocan

> Este archivo existe porque el error que más caro salió en este laboratorio no
> fue equivocarse: fue **ajustar el corte después de ver el resultado**. Pasó
> tres veces en la misma semana y las tres se sintieron como un descubrimiento.
>
> Regla del archivo: una regla entra acá **con su corte escrito** antes de
> correr la prueba. Si después hay que moverle el corte, no se edita — se
> agrega una regla nueva con otro nombre y la vieja queda con su resultado.
> Mover un corte en silencio es cómo se fabrica un hallazgo.

---

## R1 — Rebote tras caída (DIRECCIÓN) · congelada 7-ago-2026 · **RECHAZADA**

Cayó entre 5% y 8% en una rueda y el mes previo (21 ruedas) no subió 10% o más.
Se entra al cierre de la rueda siguiente, se mide a 5 ruedas.

- Las tres mineras, 2026: 13/15 = 87%, p=0.009
- **Las otras 43 acciones, 2026: 54% contra base 51%.** No generaliza.
- Universo entero, banda 5-8%: 56% contra 49%, mediana +1.08% — el spread
  (0.70-1.13%) se lo come.

**Estado: archivada.** No entra al cerebro. Sigue contándose por si acumula.

---

## R2 — Filtro de volumen del listado extranjero · congelada 8-ago-2026 · **RECHAZADA**

Sobre eventos de R1 en RIO, PPX y BVN: "confirma" si el volumen de la plaza
extranjera (RIO.TO, PPX.V, BVN en NYSE) es ≥ **1.5×** su promedio de las 20
ruedas previas, en la fecha del evento o la última rueda extranjera anterior.

- Confirmado: 60% (n=10) contra base 42.5%. **p=0.18.**
- Todo el efecto son 4 casos de RIO. PPX en TSX-V negocia a 0.43× su promedio:
  ahí no hay plaza líquida que leer.

**Estado: archivada.** Datos fijos en `eventos_adr.csv`, prueba en `filtro_adr.py`.

---

## R3 — Capacidad de explosión / asimetría de cola · congelada 8-ago-2026 · **RECHAZADA**

Ranking de acciones por probabilidad de un movimiento de 10% en 10 ruedas.

- Spearman 2025→2026 de la prob. de subir: rho +0.686. **Pero la volatilidad
  sola da +0.675**: no aporta nada.
- Asimetría (sube − baja): rho **+0.127, p=0.40**. Ruido. Aenza pasó de −9.2% a
  +9.5% y Auna de −12.6% a +5.8%.

**Estado: archivada.** Prueba en `estabilidad_colas.py`.

---

## R4 — U invertida del mes previo (DIRECCIÓN) · congelada 8-ago-2026 · **PENDIENTE**

En días de explosión (|mov| ≥ 10%), el mes previo predice el signo a 5 ruedas
con forma de U invertida: los extremos rinden mal, el centro bien.

- Zona buena declarada: **mes previo entre 0% y +20%** → se llama arriba
- Zona mala: mes previo < −10% o > +20% → se llama abajo
- Medido (131 eventos, ambos años juntos): <−10% da 29% arriba; 0 a +10% da
  66%; +10 a +20% da 64%; >+20% da 44%

**Advertencia grabada:** esto se encontró **cortando después de ver los datos**.
No es un hallazgo, es una hipótesis. Solo cuenta con eventos posteriores al
8-ago-2026. Ritmo esperado: ~7 al mes en las 46 acciones → 30 casos limpios
hacia diciembre-2026.

---

## R5 — ¿Se va a mover? (MAGNITUD, no dirección) · congelada 8-ago-2026 · **EN PIE**

Objetivo: `|retorno de 5 ruedas| ≥ 2%`, en cualquier dirección. Se cambia la
pregunta porque **todo lo que falló predecía dirección y todo lo que sobrevivió
describía magnitud**.

Condiciones y resultado, universo de 46 acciones, entrenamiento 2025 / prueba
2026 (base: 42% y 56%):

| condición | 2025 | 2026 | n 2026 |
|---|---|---|---|
| se movió 3% o más hoy | 64% | **72%** | 1,116 |
| dos ruedas seguidas de 3%+ | 71% | **75%** | 349 |
| cayó entre 5% y 8% | 66% | **75%** | 148 |
| explotó (10%+ en un día) | 64% | **85%** | 54 |
| vol de 10r ≥ 1.5× la de 60r | 51% | 59% | 456 |
| vol de 10r ≤ 0.7× la de 60r | 36% | **49%** | 1,926 |

Todas las de arriba con p<0.0001. La quieta queda **por debajo** de la base en
los dos años: la calma no anticipa el movimiento, lo desmiente.

**Dosis (lo que la valida):** la probabilidad sube pareja con el tamaño del
movimiento de hoy — <1%: 37/47% · 1-3%: 47/62% · 3-5%: 62/68% · 5-8%: 67/73% ·
8-12%: 65/88%. En dirección la dosis salía **al revés**; acá se comporta como un
mecanismo.

**Duración:** la ventaja decae suave — +18 puntos a 1 rueda, +16 a 5, +12 a 10,
+7 a 20.

**Lo que NO dice:** hacia dónde. Cero información direccional.

### R5 corregida — 8-ago-2026, dos horas después

Tres problemas encontrados al pulirla. Se dejan escritos porque cada uno se
comió una parte del resultado.

**1. Ventanas solapadas.** Los casos eran ruedas consecutivas midiendo ventanas
de 5 ruedas que se pisan entre sí. En las tres mineras, 225 casos son **41
independientes**; en las 46, 2,926 son **581**. El signo no cambia pero la
confianza estaba inflada. Todo lo de abajo va sin solapar.

**2. La llamada negativa no sirve.** Separadas por tipo (46 acciones, sin
solapar): "se va a mover" acierta **69%** (n=208); "no se va a mover" acierta
**53%** (n=373). Y en las tres mineras la negativa acierta **20-25%**, porque la
base de ellas es 77-80%: no existe la semana quieta en Volcan, Nexa o RIO.
**Se elimina la llamada negativa.**

**3. Y lo que casi se lleva todo: el 69% era COMPOSICIÓN.** Comparando dentro de
cada acción —su propia base contra su propia condicional— el lift mediano es
**−2.8 puntos** y solo **9 de 20** acciones mejoran (p=0.75). La condición se
dispara más seguido en papeles que igual se mueven siempre; no aporta sobre
saber en qué acción estás parado. Volcan da lift **−26**.

**Lo que sobrevive, medido dentro de cada acción y sin días de precio repetido:**

| | valor |
|---|---|
| rho de Spearman (|mov hoy| vs |mov 5r|), mediano | **+0.085** |
| acciones con rho positivo | **30 de 38** · p=0.0002 |
| |mov| a 5r según el cuartil de hoy | Q1 0.92× · Q2 0.91× · Q3 0.99× · **Q4 1.24×** |

*(con los días de precio repetido: rho +0.118, 41/46, p<1e-6 — el precio que se
repite infla el efecto, así que manda la versión limpia.)*

**Estado: EN PIE pero mucho más chica de lo que parecía.** La lectura honesta:
*"hoy fue uno de los días más movidos de esta acción; después de días así, esta
acción se movió ~24% más que su semana normal."* Todo lo que está por debajo del
cuartil superior no dice nada (0.91-0.99×). Es descriptivo, es dentro de la
propia acción, y es modesto — que es exactamente lo que aguantó.

---

## R6 — Pegada a un extremo del año · congelada 8-ago-2026 · **PENDIENTE**

`|posición en el rango de 52 semanas − 50|`. Estar pegada al techo o al piso,
no estar arriba contra abajo.

Medida como ganancia de separación **sobre la base móvil de 90 ruedas de la
propia acción** (el rival que dejó sin efecto a los cinco ángulos anteriores):

| | ganancia | acciones a favor | p |
|---|---|---|---|
| distancia al medio | **+5.8 pts** | 25/38 | **0.037** |
| — solo pegada al techo (>80) | +10.6 pts | 8/11 | 0.11 |
| — solo pegada al piso (<20) | −5.2 pts | 3/7 | 0.77 |

**Las tres advertencias, grabadas:**
1. Se llegó a ella **recodificando** después de que la versión cruda
   (arriba vs abajo) diera p=0.13. No es un hallazgo, es una segunda pasada.
2. **7 variantes probadas ese día** (A1 sector, A2 cruda, A2b distancia, A3
   tiempo desde el salto, B rango intradía, techo, piso). Bonferroni deja el
   0.037 en **0.26**.
3. Todo el efecto viene del lado del techo, con **11 acciones**. Es la misma
   forma de las tres reglas que ya murieron.

**Solo cuenta con ruedas posteriores al 8-ago-2026.**

---

## R7 — Rango intradía (Parkinson) · **NO SE PUEDE MEDIR**

El rango máximo-mínimo es un estimador de volatilidad mucho más eficiente que
el cierre contra cierre. Sería el candidato natural. **No hay con qué
probarlo:** 185 ruedas con rango en todo el repositorio, repartidas entre 45
acciones, y **ninguna acción llega a 15 ruedas**. `intradia.json` es una
ventana móvil de 45 días y el cron se salta turnos.

Queda anotada como la primera prueba a correr cuando el archivo acumule.
Ritmo: ~45 ruedas por acción al año si el robot no falla.

---

## R8 — La BVL cotiza el mundo con un día de atraso · 8-ago-2026 · **PROBADO**

El movimiento del metal del día D predice el de la minera de Lima en D+1. No el
tamaño: **la dirección**. Es lo único direccional que sobrevivió en 19 meses.

**Las betas (2026, fuera de muestra) — si el metal hace +1% hoy:**

| acción | metal | mañana | r |
|---|---|---|---|
| SCCO | cobre | +1.42% | +0.68 |
| BVN | oro | +1.25% | +0.66 |
| GDX | oro | +1.20% | +0.70 |
| RIO | oro | +0.72% | +0.39 |
| Atacocha | plata | +0.55% | +0.54 |
| Volcan | plata | +0.40% | +0.50 |
| Nexa | plata | +0.32% | +0.51 |

**Lo que aguantó:**
1. *No es mecánico.* El metal no se predice a sí mismo: oro −0.034, plata
   −0.083, cobre −0.093 de autocorrelación.
2. *Pulso limpio en D+1.* D+0 ≈ 0 · D+1 grande · D+2, D+3, D+5 ≈ 0. La
   información entra completa en una sesión y después no queda nada.
3. *Fuera de muestra.* 10 de 10 acciones positivas en 2026, p=0.00098. Mediana
   2025 +0.254 → 2026 **+0.505**: se puso más fuerte en el periodo no visto.
4. *Placebo.* Mineras r mediano +0.426 contra acciones peruanas no mineras
   +0.120. Luz del Sur, que no toca metales: **−0.001**.

**LA PRUEBA QUE LO CIERRA — GLD.** Es un fondo que tiene oro físico adentro y
cotiza en Lima. Su precio *tiene* que seguir al oro:

| | oro D+0 | oro D−1 | oro D−2 |
|---|---|---|---|
| **GLD** | +0.021 | **+0.851** | +0.084 |

Sigue al oro de AYER, no al de hoy. Eso no es una correlación estadística que
se pueda deber al azar: es un hecho mecánico sobre un fondo que contiene el
metal. **El cierre de la BVL refleja el mundo del día anterior.**

**LO QUE NO SE SABE, Y ES LO QUE DECIDE SI SIRVE:** si el movimiento ocurre en
el hueco de apertura o durante la sesión. Si es en el hueco, no se puede tomar
— para cuando abre, ya pasó. Es lo que ocurrió con RIO el 7-ago: abrió en 2.28
viniendo de 2.10, con todo el salto adentro.

Medido sobre las 43 ruedas mineras con apertura guardada: hueco +0.075, sesión
−0.117, día completo −0.026. **Con 43 observaciones no se puede concluir nada**
— el mismo muro que R7. Hace falta la apertura histórica.

**Falta el zinc.** Yahoo no lo publica. Nexa y Atacocha van con plata como
reemplazo y eso está anotado en `extractor/fetch_metales.py`.

**LA TASA DIRECCIONAL, fuera de muestra (2026):**

| condición | llamadas | acierto | base |
|---|---|---|---|
| cualquier movimiento del metal | 1,240 | 66.0% | 52.8% |
| metal ≥ 0.5% | 982 | 70.1% | 52.8% |
| **metal ≥ 1%** | **793** | **71.8%** | 52.8% |
| metal ≥ 2% | 434 | 74.4% | 52.8% |

**LA ECONOMÍA, neta del spread real** (438 operaciones, comprando cuando el
metal subió ≥1%): promedio **+1.13%**, 63% ganadoras. BVN +2.64% · SCCO +2.65%
· GDX +2.03% · Atacocha +1.96% · Nexa +0.82% · RIO +0.76% · Volcan +0.22% ·
Cerro Verde −0.07% · Poderosa −0.43%. Con el spread al doble: +0.36% y 50%.

**EL RÉGIMEN LA CONDICIONA.** Oro~S&P pasó de −0.516 (jul-2025) a +0.553
(jul-2026). En el régimen anterior RIO daba r=+0.04 con el oro y SCCO −0.15: la
señal no existía. 126 días contra 53 — indicio, no ley.

**Estado: el hecho está probado, el uso no.** Como lectura descriptiva entra ya
mismo («el oro cerró +2.3% después de que Lima cerrara; históricamente BVN
recogió 1.25 por cada punto al día siguiente»). Como señal para operar, no
hasta resolver el hueco.

### R8 — corte añadido 13-ago-2026: RIO y PPX salen del universo

No se toca ningún número de arriba. Se acota **a qué acciones aplica**, porque
dos de las diez no hacen precio en Lima: lo copian de Canadá convertido a
dólares.

**La aritmética del 13-ago-2026, medida al centavo con CAD/USD = 0.7171:**

| | Toronto | × 0.7171 | Lima | |
|---|---|---|---|---|
| RIO, cierre 12-ago | CAD 3.360 | US$2.409 | US$2.400 | paridad |
| RIO, 13-ago 10:46 | CAD 3.135 | US$2.248 | US$2.260 | paridad |
| PPX, cierre 12-ago | CAD 0.2200 | US$0.1578 | US$0.158 | paridad |

RIO.TO cayó −6.69% ese día por su reporte del Q2 y Lima marcó −5.83%. No es
que la minera de Lima reaccionara: reimprimió. Lo mismo PPX, que marcó −5.39%
sin ninguna noticia — venía con 5.8% de premio sobre Toronto y convergió.

**Por qué esto invalida R8 para las dos:**

1. La beta contra el oro (RIO +0.72, r=+0.39) no mide a Lima reaccionando al
   metal. Mide a **Toronto** reaccionando, y a Lima copiando con el desfase de
   su horario. Es la misma información contada dos veces.
2. El hueco de apertura, que R8 declara como *«lo que no se sabe, y es lo que
   decide si sirve»*, para estas dos está **garantizado**: todo lo que pasa en
   Canadá con Lima cerrada solo puede entrar como hueco.
3. El ejemplo que R8 cita para ilustrar el hueco —RIO el 7-ago, abriendo en
   2.28 viniendo de 2.10— probablemente no es el metal entrando con retraso.
   Es el espejo alcanzando a Toronto. **Pendiente de verificar** con el cierre
   de RIO.TO del 6 y 7 de agosto.
4. El spread de RIO en Lima ese día fue **4.35%** ida y vuelta, contra una
   ventaja neta medida de +0.76%. Aunque la señal existiera, no se cobra.

**Universo de R8 después de este corte:** SCCO, BVN, GDX, Atacocha, Volcan,
Nexa, Cerro Verde, Poderosa. **Fuera: RIO y PPX.**

**Lo que se abre en su lugar, sin congelar todavía:** para un espejo, la serie
que importa no es el metal sino la **desviación contra su plaza de origen**.
El 13-ago PPX pasó de paridad a las 09:35 a +5.7% de premio sobre el medio de
Toronto a las 12:27, en la misma rueda. Eso es medible todos los días y es
falsable. Antes de convertirlo en regla hace falta escribirle el corte y
contarlo hacia adelante, como manda este archivo.

**Anotado de paso:** RIO no tiene código RPJ en `hechos.json`
(`encontrado: False`, cero hechos), mientras PPX (`OE4570`, 40 hechos en 12
meses) y Panoro (`OE2760`) sí publican hechos de importancia en la BVL siendo
igual de canadienses. O Rio2 no filea en Perú, o el extractor nunca le encontró
el código. Sin resolver.

---

## Cómo se agrega una regla

1. Escribir acá el nombre, el corte exacto y la fecha, **antes** de correr nada.
2. Correr sobre el **universo completo** (46 acciones), nunca sobre 3.
3. Entrenamiento 2025 / prueba 2026, o congelar y contar hacia adelante.
4. Anotar el resultado, gane o pierda. Las rechazadas se quedan: borrarlas es
   cómo se vuelven a desenterrar.
