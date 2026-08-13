# CONSULTA — Una señal que sobrevivió a tres exámenes y murió en el cuarto

> **Para quien lo lea sin contexto previo.** Jair opera la BVL (Bolsa de Valores de
> Lima) desde Credicorp Capital e-trading. Su app ALTO baja datos oficiales de la BVL
> a diario y sobre ellos se mide. Este documento cuenta **una investigación completa
> con su resultado negativo**, y pide que la refuten o la extiendan.
> Ver también `CONSULTA_INTRADIA.md` (frontera de datos intradía) y
> `CONSULTA_LABORATORIO.md` (estado del laboratorio).
> Fecha del corte: **7 de agosto de 2026, cierre de rueda.**
>
> **Lo que se busca de un tercero:** no aprobación. Un error de método, un dato que
> existe y no se está usando, o una prueba que pueda **matar** lo que quedó en pie.

---

## 1. La frontera de datos (esto manda sobre todo lo demás)

| dato | qué hay realmente | qué sostiene |
|---|---|---|
| cierres diarios | `/v1/stock-quote/share-values/{NEM}` de la BVL. **Solo `[fecha, cierre]`** — verificado en vivo, la respuesta tiene 3 campos: `nemonico`, `currencySymbol`, `values`. 397 ruedas, ene-2025 → hoy, 46 acciones que de verdad negocian | ✅ estadística a días |
| foto de mercado | `/v1/stock-quote/market`. 782 filas, 26 campos, incluidos **`buy` y `sell`** | ✅ el estado de ahora |
| **volumen histórico** | **NO EXISTE.** Probado: el endpoint de mercado **ignora** `date`, `fecha`, `startDate/endDate`, `queryDate` y `sessionDate` — devuelve hoy siempre. El de históricos no trae volumen | ❌ cero |
| **apertura/máx/mín históricos** | **185 ruedas** en todo el repo (`intradia.json`, ventana móvil de 45 días y el cron se salta turnos) contra **1,191 ruedas** solo-cierre de las tres mineras | ❌ nada de velas |
| Hechos de Importancia | ~15 por empresa. Volcan arranca en jun-2026. **RIO tiene cero** (emisor extranjero) | ⚠️ ~2 meses |
| noticias | ventana móvil de 20 días | ❌ cero historia |
| puntas del libro | **estaban llegando y se tiraban.** Desde el 7-ago se guardan (§7) | ✅ desde hoy, hacia adelante |

**Consecuencia dura:** ninguna hipótesis que necesite volumen histórico, velas
japonesas o noticias con más de 20 días de antigüedad se puede probar en este
proyecto. No es pereza: se verificó golpeando los endpoints.

---

## 2. Lo que se midió, en orden, y cómo terminó

Método: la regla se **congela con 2025** y se cobra en **2026**. Nunca se ajusta un
corte después de ver el periodo de prueba.

### 2.1 Siete reglas contra la pared

| regla | 2025 | 2026 | veredicto |
|---|---|---|---|
| caída ≥5% → rebote a 5-10r | 78% arriba | 66% arriba, mediana +3.75% | **sobrevive** |
| cuatro verdes seguidas | 86% arriba a 10r, med +14.15% | **36%**, med −1.89% | se invierte |
| subida ≥5% → sigue | 64% | 51% (base 50%) | muere |
| techo (+18% en 5r y última +6%) | n=9 | n=2 | sin muestra |
| lateral tras techo | n=5, e iba **para arriba** (80% a 5r) | n=1 | sin muestra, y con el signo al revés de lo que se contaba |
| cinco rojas seguidas | n=2 | n=8, 88% arriba a 1r | descubierta en el examen, no vale |
| control tonto ("cayó un martes") | n=7, 57% | n=1 | el control se portó bien |

### 2.2 Afinar la superviviente

Dos parámetros nuevos, ambos congelados con 2025:

**Dosis — el rebote es INVERSO al tamaño de la caída.**

| banda | 2025 | 2026 | mediana 2026 |
|---|---|---|---|
| 5% a 8% | 80% | **76%**, p=0.036 | **+5.20%** |
| 8% a 12% | n=2 | 50%, p=0.73 | **−1.57%** |
| más de 12% | n=1 | n=1 | — |

**De dónde venía.**

| condición | 2025 | 2026 | mediana |
|---|---|---|---|
| tras subir +10% en el mes previo | 83% | **50%** | −0.72% |
| desde una base (mes previo <+10%) | 73% | **75%**, p=0.051 | +4.12% |

**Regla combinada resultante:**

> Cayó entre 5% y 8% en una rueda **y** el mes previo (21 ruedas) no había subido 10%
> o más. Se entra al cierre de la rueda **siguiente** y se mide a 5 ruedas.

2026, fuera de muestra: **13 de 15, mediana +5.13%, p=0.009.**

### 2.3 Tres intentos de matarla, y los tres fallaron

1. **Rebote punta-a-punta** (Roll 1984; el control estándar de Gutierrez & Kelley 2008
   es entrar una rueda después). Si el rebote fuera artefacto de microestructura,
   saltarse un día lo mataba. **Lo mejoró:** 80% → 87%, p 0.039 → 0.009. La versión
   "saltarse un día" no se eligió buscando el mejor p: la impuso la literatura antes
   de correrla.
2. **Medida de Roll.** Solo aplica con covarianza serial negativa. **Cinco de seis
   casos dan covarianza positiva** (Volcan +0.55 y +0.06; Nexa +0.68 en 2026; RIO
   +1.45 y +1.94). El artefacto no está.
3. **Costo real.** Se midió el spread en vivo: Volcan 1.13%, Nexa 0.70%, RIO 0.81%.
   Neto: **13/15, mediana +4.24%, p=0.009.** Aguanta.

### 2.4 El cuarto examen la mató

La regla se derivó mirando **tres acciones**. Aplicada congelada a las **otras 43**
del archivo:

| grupo | 2025 | 2026 |
|---|---|---|
| las TRES (donde se derivó) | 60%, +2.12% | **87%, +5.13%, p=0.009** |
| las OTRAS 43, nunca vistas | 52%, +0.61%, p=0.26 | **54%, +0.70%, p=0.33** |

**No generaliza.** Y la defensa de "es que son las más volátiles" también cae: las
otras 13 acciones de volatilidad alta dan **n=104, 46% arriba, mediana −0.17%**.

Lo único que queda con el universo entero es una versión chica:

| banda | n | arriba | base | mediana | p |
|---|---|---|---|---|---|
| **5% a 8%** | **193** | **56%** | 49% | **+1.08%** | **0.031** |
| 8% a 12% | 48 | 50% | 49% | +0.56% | 0.50 |
| más de 12% | 11 | 45% | 49% | 0.00% | 0.70 |

**+1.08% bruto contra un libro que cuesta 0.70–1.13%.** Queda cero.

---

## 3. El giro: la mediana era la lente equivocada

Jair objetó: *"cualquier día puede ser un día de explosión, siempre alerta."* Tenía
razón, y la objeción cambia el resultado.

**La concentración es brutal.** Retorno de 18 meses quitando las mejores ruedas:

| | total | sin sus 5 mejores | sin sus 10 mejores |
|---|---|---|---|
| RIO | +444% | +83% | **+19%** |
| Volcan | +305% | +129% | +54% |
| Nexa | +152% | +57% | **+9%** |
| Cerro Verde | +69% | +27% | **+1%** |

Diez ruedas de 397 hacen casi todo. Una regla con mediana ≈0 puede seguir sirviendo
si mueve la **cola**. Y la mueve:

**Tras la señal de 5-8%, en las 46 acciones (n=190, a 10 ruedas):**

| | tras la señal | base | factor |
|---|---|---|---|
| subió ≥10% | **20.0%** | 8.9% | ×2.2 |
| subió ≥15% | **9.5%** | 4.3% | ×2.2 |
| **bajó ≥10%** | **11.6%** | 3.6% | **×3.2** |
| media | +2.07% | +1.52% | |

**No es una señal de dirección: es una señal de que algo va a pasar.** Duplica el pop
y triplica el derrumbe. La mediana promediaba las dos colas y las cancelaba — por eso
no veía nada.

**Y el hallazgo que pesa más que la señal:** parado en las tres, un día cualquiera sin
ninguna condición, la probabilidad de un +10% en 10 ruedas es **22.9%**. El mercado
entero: **8.9%**. La señal aplicada a las 46: 20.0%. **El papel manda más que el
momento.**

**Una creencia clásica que aquí es falsa.** "La compresión precede a la expansión":

| | prob. de +10% en 10r |
|---|---|
| muy quieta (vol 10r ≤ 0.5× la de 60r) | **6.3%** |
| quieta (≤ 0.7×) | 8.1% |
| cualquier rueda | 8.9% |
| agitada (≥ 1.5×) | 8.9% |

La quieta explota **menos**. En la BVL lo que explota es lo que ya venía moviéndose.

---

## 4. Lo que queda en pie, con su número

**Capacidad de explosión por acción** — probabilidad de un movimiento de 10% en 10
ruedas, 18 meses, 46 acciones. Mediana del mercado: **5.6%**.

| acción | sube ≥10% | baja ≥10% | neto | vol anual |
|---|---|---|---|---|
| Panoro (PML) | 33.4% | 15.8% | +17.6% | 81% |
| Atacocha | 31.9% | 9.1% | **+22.8%** | 75% |
| PPX | 31.1% | 8.0% | **+23.1%** | 77% |
| Volcan | 26.9% | 6.7% | +20.2% | 63% |
| RIO | 23.6% | 7.3% | +16.3% | 56% |
| Buenaventura | 19.2% | 8.5% | +10.6% | 53% |
| Nexa Perú | 18.1% | 4.1% | +14.0% | 43% |
| Minsur | 10.6% | **1.8%** | +8.8% | 35% |
| **Aenza** | 11.9% | **14.5%** | **−2.6%** | 62% |
| **Auna** | 10.1% | **12.5%** | **−2.4%** | 43% |
| SPY / VOO / EFA / soberano | **0.0%** | 0.0% | 0.0% | 7-15% |

**Correlación de "sube ≥10%" con la volatilidad anual: 0.85.** O sea que el 85% de
esta tabla es volatilidad dicha en otras unidades. **Lo nuevo es el 15%: la
asimetría.** Aenza tiene la misma volatilidad que Volcan (62% contra 63%) y explota
**más hacia abajo**; Volcan explota 4 veces más hacia arriba que hacia abajo. Eso la
volatilidad sola no lo dice.

**Spread real medido el 7-ago al cierre** (punto medio de `buy`/`sell`):

| | spread |
|---|---|
| Minsur | 0.14% |
| Buenaventura | 0.29% |
| Nexa | 0.70% |
| RIO | 0.81% |
| Volcan | 1.13% |
| **BAP** | **4.65%** (386.51 / 404.90) |

Cuando el app dice "BAP cayó 2.03%", ese movimiento entero cabe dentro del spread.

---

## 5. La lección de método, que es lo que más costó

**Una hipótesis que sobrevive a muchos exámenes sobre los mismos datos no está más
probada que al principio.** Los tres controles que la regla pasó eran todos sobre los
mismos quince casos; ninguno podía descubrir que el problema era la muestra. La
primera prueba que agregó datos de verdad la tumbó en un intento.

Y dos autocorrecciones que valen como advertencia:

- El refinamiento **"acompañada vs sola"** se derivó juntando 2025 y 2026, es decir
  usando el periodo de prueba. Derivado honesto solo con 2025, la regla decía lo
  contrario y acertó 34% a 1 rueda. **Lo peor: la dirección "descubierta" haciendo
  trampa era la correcta.** Encontrar la respuesta mirando el examen se siente
  idéntico a descubrir algo.
- Se probaron **~20 variantes**. Con 20 pruebas se espera un p<0.05 por azar.
  Bonferroni deja el p=0.009 en 0.18.

---

## 6. Lo que cambió en el código (por si sirve de insumo)

- `app/src/lib/patrones.js` — cuatro lecturas descriptivas para el Sonar: día partido
  por metal, Hecho presentado fuera de rueda (**la hora está escondida en la ruta del
  PDF de la BVL**: `…/hhii/B20010/20260805201901/…` = 5-ago 20:19), RSI de Wilder, y
  spread contra la plaza extranjera para las 4 acciones de doble listado (RIO, PPX,
  PML en Toronto; AUNA en NYSE). 26 pruebas.
- `extractor/fetch_precios.py` — `spread_pct()` contra el **punto medio** (no contra
  el último precio, que queda pegado a una punta según de qué lado entró la orden), y
  `puntaCompra`/`puntaVenta`/`spreadPct` guardados en `precios.json` **y en la foto de
  cada día del intradía** — que es donde hacen falta: lo que hay que poder mirar
  después es cuánto costaba entrar **el día de la caída**.

---

## 6-bis. P1 y el filtro de volumen: corridos, y los dos rechazados

**P1 — la tabla de §4 NO tiene memoria útil.** Spearman entre el ranking de 2025 y el
de 2026, 46 acciones, p por permutación (`laboratorio/estabilidad_colas.py`):

| | rho | p | |
|---|---|---|---|
| **volatilidad 2025 → 2026** (el piso) | **+0.675** | <0.0001 | |
| prob. de subir 10% | +0.686 | <0.0001 | igual que el piso |
| prob. de bajar 10% | +0.365 | 0.013 | peor que el piso |
| **asimetría (sube − baja)** | **+0.127** | **0.40** | **ruido** |
| residuo tras quitar la volatilidad | −0.149 | 0.32 | ruido |

La cola tiene exactamente la memoria que la volatilidad ya tenía: **no aporta nada**.
Y la asimetría —presentada arriba como "lo único genuinamente nuevo"— no persiste:
**Aenza pasó de −9.2% a +9.5% y Auna de −12.6% a +5.8%.** Las dos que se habían
señalado como "explotan hacia abajo" se dieron vuelta al año siguiente.

*Advertencia de método:* el primer intento tenía un control roto — se usó
`volatilidadAnualPct` del archivo, que es UN número por acción de todo el periodo, o
sea correlacionar una variable consigo misma (rho = 1.000). Hay que recalcular la
volatilidad año por año.

**Filtro de volumen del listado extranjero — RECHAZADO** (`laboratorio/filtro_adr.py`,
datos fijos en `laboratorio/eventos_adr.csv`). Criterio congelado antes de mirar:
confirma = volumen exterior ≥1.5× su promedio de 20 ruedas.

| grupo | n | acierto | error | mediana |
|---|---|---|---|---|
| todas (base) | 40 | 42.5% | 57.5% | −0.82% |
| el exterior confirma | 10 | 60.0% | 40.0% | +3.94% |
| el exterior no confirma | 30 | 36.7% | 63.3% | −2.16% |

+17.5 puntos, pero **p=0.18** con 10,000 permutaciones. Y el desglose lo explica: RIO
4 confirmados con 100% de acierto, BVN 2 de 3, **PPX 0 de 3**. Todo el efecto son
cuatro casos de RIO. PPX en TSX-V negocia a **0.43×** su propio promedio: ahí no hay
plaza líquida que leer, así que la premisa del filtro no aplica a una de las tres.

**Nota sobre NEXA:** el ADR de NYSE es la **matriz** (Nexa Resources S.A.), no Nexa
Perú (NEXAPEC1, ex-Milpo). Son empresas distintas. Volcan no tiene listado exterior.

---

## 7. Las preguntas concretas

**P2 — La señal como aviso de volatilidad a dos lados (×2.2 arriba, ×3.2 abajo).**
¿Es publicable sin violar la regla de la casa (§8)? ¿O decir "se viene movimiento" ya
es pronosticar?

**P3 — n=15 y ~20 variantes.** ¿Hay una forma correcta de reportar el resultado de las
tres acciones sin que sea ni "hallazgo" ni "nada"? El bootstrap sobre la mediana dio
p=0.019 y el binomial sobre la tasa de acierto dio p=0.15 — miden cosas distintas (el
tamaño del movimiento contra la frecuencia) y no se sabe cuál reportar.

**P4 — El volumen histórico no existe y no se puede recuperar.** ¿Hay una fuente
alternativa para la BVL que un tercero conozca? Sin volumen no se puede separar la
caída de ruido de la caída de información, que es justo donde la regla se rompe (el
2-feb-2026 disparó las tres señales y erró las tres a 1 rueda).

**P5 — Asimetría de cola.** ¿Existe literatura sobre predecir la **asimetría** (no la
magnitud) de la cola en acciones ilíquidas de mercados chicos? Es el 15% que la
volatilidad no explica y es lo único genuinamente nuevo que salió.

---

## 8. Reglas de la casa (una respuesta que las viole no sirve)

1. **La app muestra, no recomienda.** Todo en pasado y en modo descripción. Una señal
   de rebote es un pronóstico y por eso no entró al Sonar (`INVARIANTES.md` #29).
2. **Cero fuentes nuevas sin justificar.** Cada dato nuevo es un paso más que se puede
   romper en el cron, que ya se salta turnos.
3. **Si no se puede comprobar con el número al lado, no se publica.** Cada marca del
   Sonar lleva su cuenta escrita.
4. **Nada de bajarle el corte a una regla hasta que encienda.** Tres marcas nacieron
   marcando cero y así se dejaron (`INVARIANTES.md` #28-bis).
5. **La acción que no negocia no entra.** De 114 del archivo, 82 tienen el precio
   congelado; sin ese filtro una acción aparecía con +674% en 20 días habiendo
   cambiado de precio 2 veces.
