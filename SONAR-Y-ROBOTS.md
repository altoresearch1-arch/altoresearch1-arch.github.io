# 📡 El Sonar y los robots — cómo funciona hoy

> Documento de traspaso. Estado al **3 de agosto de 2026**.
>
> 👉 **Antes de proponer cualquier cambio, lee [INVARIANTES.md](INVARIANTES.md)** —
> lo que nunca debe romperse y por qué. Este documento cuenta qué hace el
> sistema; ese cuenta qué no se puede tocar, y es el que evita que una "mejora"
> razonable resulte destructiva.
> Si vas a tocar algo de acá, lee primero los comentarios del archivo que vas a
> tocar: este repo documenta el **porqué** dentro del código, y esos comentarios
> mandan sobre este resumen si alguna vez se contradicen.

---

## 1. La idea en una frase

El Sonar es el Radar de rotación dibujado como pantalla de submarino: **distancia
al centro = cuánto se salió la acción de su propio vaivén**, ángulo = sector,
tamaño = cuánto se movió en %. El anillo marcado es 1× — cruzarlo es la anomalía.

**Regla de Oro del proyecto:** todo en pasado y en modo descripción. "Se movió",
nunca "va a subir". La app muestra, no recomienda.

---

## 2. Lo que cambió el 3-ago-2026: hay DOS fuentes, no una

Hasta ese día todo el dato venía **horneado dentro del bundle** (los `.json` se
importan como código), así que para cambiar un número había que recompilar y
republicar la web entera. Rezago: hasta 30 minutos.

Ese día se descubrió que **la BVL permite CORS** (`Access-Control-Allow-Origin: *`),
o sea que el navegador del usuario puede preguntarle directo, sin servidor
intermedio. Desde entonces conviven dos caminos:

```
   ┌─ EN VIVO (navegador → BVL) ─────────── precio, Hechos, ruedas faltantes
   │
   └─ ROBOT (GitHub Actions → repo) ─────── prensa, dividendos, fundamentos, …
```

**Nada se quedó sin respaldo:** si el camino vivo falla, todo cae solo al dato
horneado y se dice en pantalla. La app nunca se queda en blanco.

---

## 3. Qué es vivo y qué depende del robot

| Dato | Fuente | Frescura | ¿Sobrevive si el robot se cae? |
|---|---|---|---|
| Precio, volumen, rango del día, hora última operación | BVL directo | **45 s** | ✅ sí |
| Hecho de Importancia (con hora y PDF) | BVL directo | **45 s** | ✅ sí |
| Ruedas que le faltan al histórico | BVL directo | al abrir | ✅ sí |
| Prensa y titulares | robot → repo | ~10 min | ❌ no |
| Dividendos, fundamentos SMV, BPA, gerencia, notas | robot | diario | ❌ no |
| Volatilidad / histórico completo (12 meses) | robot | diario | ❌ no |
| BEM (minería), cotizaciones BCRP, resúmenes | robot | diario / 10 min | ❌ no |

### Por qué la prensa NO puede ir en vivo

Se probaron **18 medios** desde el dominio real y **16 bloquean al navegador**:
Gestión, El Comercio, La República, Andina, RPP, El Peruano, Perú21, Infomercado,
Semana Económica, Rumbo Minero, Energiminas, Proactivo, Bloomberg Línea,
FXStreet, Investing y Google News. Solo pasan **Yahoo Finanzas** y **El País**, y
los dos son internacionales: no cubren la BVL.

**No insistas por ahí.** La única salida sería un proxy propio, y eso convierte
"un repo que se actualiza solo" en "un servicio que hay que mantener".

Lo que sí se hizo fue acortar las otras dos patas del recorrido (ver §6).

---

## 4. Mapa de archivos

### Capa viva
| Archivo | Qué hace |
|---|---|
| `app/src/lib/vivo.js` | Todas las llamadas a la BVL desde el navegador + los 3 hooks |
| `app/src/components/SelloVivo.jsx` | El sello de "de cuándo es este dato" (5 estados) |

### El Radar
| Archivo | Qué hace |
|---|---|
| `app/src/lib/radar.js` | **Todo el cálculo.** Fuerza, firma, ventanas, mundo, muro |
| `app/src/components/Radar.jsx` | Orquesta los hooks y arma la pantalla |
| `app/src/components/RadarSonar.jsx` | El plato + la ficha del contacto |
| `app/src/components/SonarGrafica.jsx` | La gráfica de cómo subió y bajó |
| `RadarResumen / RadarMundo / MuroNoticias / RadarCandente / RadarHistoria` | Las otras secciones |

### El robot
| Archivo | Qué hace |
|---|---|
| `.github/workflows/deploy.yml` | Los crones y el despliegue |
| `extractor/actualizar_todo.py` | Orquestador: qué pasos corre cada modo |
| `extractor/fetch_*.py` | Un archivo por fuente |

---

## 5. La capa viva, en detalle

Todo en `app/src/lib/vivo.js`. Host único: `dataondemand.bvl.com.pe`.

### Las tres llamadas

| Función | Endpoint | Nota |
|---|---|---|
| `bajarMercadoVivo()` | `POST /v1/stock-quote/market`, body `{}` | Una llamada = mercado entero (~115 cotizaciones) |
| `bajarHechosVivos()` | `POST /v1/corporate-actions` **sin `rpjCode`** | Una llamada = HI de todo el mercado. Con `rpjCode` serían 152 llamadas |
| `bajarColaHistorica()` | `GET /v1/stock-quote/share-values/{NEM}?startDate&endDate` | Una por ticker; solo cuando falta algo |

Y una cuarta que no es de la BVL:

| `bajarNoticiasDelRepo()` | `GET raw.githubusercontent.com/…/noticias.json` | Se salta el despliegue |

### ⚠️ Trampas comprobadas — no las redescubras

1. **El preflight NO lista `POST`** (`Allow-Methods: GET,OPTIONS,PUT,DELETE,PATCH`).
   Funciona igual porque `POST` es un método *safelisted* del estándar CORS. Si
   algo falla, el método no es el problema.
2. **`Content-Type` tiene que ser `application/json`.** Con `text/plain` —que
   evitaría el preflight— el endpoint responde **415**.
3. **`startDate` de `share-values` es EXCLUSIVO.** Pedir desde el 31 devuelve `[]`;
   pedir desde el 30 devuelve el 31. Sumarle un día a la última fecha guardada se
   salta justo la rueda que falta.
4. **La BVL a veces responde 200 con `content: []`.** No es un error: pasó el
   3-ago por la mañana y su propia web decía "no hay datos disponibles". Hay que
   tratarlo como estado, no como falla (`estado: 'vacio'`).

### Los tres hooks

| Hook | Cadencia | Detalles |
|---|---|---|
| `useMercadoVivo()` | **45 s** en rueda | Precio + Hechos en `Promise.allSettled` (uno no tumba al otro). Se detiene con la pestaña de fondo; refresca al volver; fuera de rueda consulta una vez y para; backoff 60→120→300 s |
| `useColaHistorica()` | **1 vez por visita** | Solo si el archivo está atrasado. De a 6 en 6. Un cierre cerrado no se mueve |
| `useNoticiasFrescas()` | **5 min** | Lee del repo. Solo acepta copias **más nuevas**; nunca retrocede |

**Horario de rueda:** Lun–Vie 9:00–16:15 hora de Lima. Perú es UTC-5 todo el año
(sin horario de verano), por eso alcanza con restar 5 h al UTC.

### Cómo entra el dato vivo al cálculo

`filasRadar(vivos, hechosVivos, cola)` en `radar.js`. Sin argumentos funciona
igual que siempre, con el dato horneado.

- **`conCola(base, cola)`** — pega al final las ruedas que el robot no alcanzó a
  guardar. Solo fechas **posteriores** a la última del archivo; nunca reescribe
  un cierre ya guardado.
- **`conUltimoPrecio(base, px)`** — pega el precio de hoy según la fecha de la
  **sesión** (la de la última operación, no la de nuestra consulta):
  - sesión **posterior** al último cierre → agrega fila
  - sesión **igual** → reemplaza (mismo día, más fresco)
  - sesión **anterior** o sin dato → **no toca nada** ← esto protege de la acción
    que lleva días sin negociar, a la que la BVL le repite el último cierre
- **`ultimoHecho(ticker, hoy, hechosVivos)`** — gana el más reciente; con fecha
  empatada gana el vivo, porque trae la hora.
- **`NOTICIAS`** es una variable de módulo intercambiable con
  `usarNoticiasFrescas()`. Al entrar una copia nueva **se invalida `cacheMundoTk`**,
  si no el 🌍 seguiría cruzando titulares viejos.

Como los titulares viven en un módulo y no en el estado de React, el hook
devuelve un contador que `Radar.jsx` mete en las dependencias del `useMemo`.

---

## 6. El robot

`.github/workflows/deploy.yml` + `extractor/actualizar_todo.py`.

| Cron (UTC) | Hora de Lima | Modo | ¿Despliega? |
|---|---|---|---|
| `23 3 * * 2-6` | 22:23 Lun–Vie | `--rapido` (cierre completo) | Sí |
| `7,17,…,57 13-23 * * 1-5` y `0-2 * * 2-6` | 8:07 – 21:57 | `--hechos` | Sí |
| `3,33 14-21 * * 1-5` | :03 y :33 en rueda | `--precios` | Sí |
| `13,23,43,53 14-21 * * 1-5` | :13 :23 :43 :53 | `--precios` | **No** |

Reglas que ya estaban y conviene no romper:

- **Solo commitea si los datos cambiaron.** Si no, la corrida termina en ~1 min.
- **La red dirigida de Google News (~95 consultas) corre SOLO en el cierre.** En
  intradía serían ~4,560 consultas diarias y Google corta mucho antes.
- **`fetch_historicos` NO va en el intradía** (decisión del 2-ago): son 115
  llamadas por corrida para refrescar cierres que intradía no cambian.
- Los minutos son impares (`:07`, `:23`, `:33`) a propósito: GitHub agenda peor
  los minutos redondos.

### El cambio del 3-ago en el robot

Las corridas de `:13/:23/:43/:53` **antes** iban con `--sin-prensa`, y tenía
sentido: como no despliegan, buscar titulares ahí era tirar lecturas a la basura.
Eso **dejó de ser cierto** cuando la app empezó a leer `noticias.json` del repo —
un commit sin despliegue igual le llega al lector. Ahora también traen prensa:
de cada 30 min a cada 10.

Para revertirlo es una línea: volver a poner `--precios --sin-prensa`.

---

## 7. Problemas conocidos

### ✅ Cerrado — la fuente vacía ya no puede borrar datos buenos

**El accidente:** cuando la BVL responde `content: []`, el bucle marca todas las
empresas como "NO encontrado" y escribía `{"precio": null, …}` para cada una,
encima de los precios buenos. Pasó el 3-ago y hubo que restaurar con `git
checkout`. En producción ese cron corre cada 10 min y commitea.

**El arreglo:** `extractor/guardas.py` → `se_puede_escribir()`, conectada a
`fetch_precios`, `fetch_hechos` y `fetch_historicos`. Si la corrida trae cero
registros útiles, o menos del **80%** de los que ya tenía el archivo, se avisa y
se sale limpio (código 0) **sin tocar nada**.

Dos detalles que no son obvios y conviene no deshacer:

- **Cuenta registros con `encontrado: True`, NO `len()` del diccionario.** Es la
  diferencia entre funcionar y no funcionar: `precios.json` tiene sus 152
  entradas incluso cuando están todas en `null`, así que un `len()` daría 152 y
  dejaría pasar exactamente el bug que esto evita.
- **En `fetch_precios` la guarda va ANTES de `acumular_intradia()`.** Sin precios
  no hay foto del día que guardar, y ensuciar el único archivo que no se puede
  reconstruir sería peor que no escribir.
- **Sin emojis en los `print` de `guardas.py`.** La consola de Windows usa cp1252
  y revienta con `UnicodeEncodeError` — o sea que la guarda fallaría justo cuando
  tiene que proteger. Pasó al probarla.

Probado con los dos escenarios: mercado vacío (aborta, archivos byte por byte
idénticos) y mercado normal de 783 cotizaciones (escribe, la guarda no se asoma).

### 🟡 El cron de GitHub es "mejor esfuerzo"

El 3-ago no disparó **ninguna** corrida programada entre las 06:11 UTC del 1-ago y
las 17:27 UTC del 3-ago — unos 25 turnos vencidos. El workflow estaba `active` y el
script sano; **se recuperó solo**. El propio archivo ya documentaba un retraso de
7 horas en julio. No es un bug del repo: es cómo funciona el agendador.

Mitigación ya hecha: precio, Hechos e histórico ya no dependen de él.

### ✅ Cerrado — `intradia.json` se commiteaba aunque no cambiara nada

El workflow promete *"solo se commitea si los datos cambiaron"* y esa guarda
existe (`git diff --cached --quiet`), pero estaba **anulada**: `intradia.json`
estampa `generado` con la hora al minuto, así que el archivo siempre difería
aunque no se hubiera movido un precio. En rueda quieta o feriado, 48 commits sin
novedad. Ahora `guardas.cambio_real()` compara solo la clave útil (`dias`),
ignorando el sello de hora, y si no cambió no se reescribe.

### 💓 El pulso de los robots — `app/src/data/estados/`

Un JSON por robot (`precios.json`, `hechos.json`, `historicos.json`), escrito por
`extractor/heartbeat.py` → `latir()`.

**Uno por robot y no uno solo** porque los modos corren en runs separados de
Actions y se solapan; con un archivo compartido, dos runners haciendo pull/push
casi a la vez chocan. Con uno cada uno, el rebase nunca decide nada.

**Las tres fechas no son redundantes:**

| Campo | Qué contesta |
|---|---|
| `ultimo_run_utc` | ¿el cron disparó? Si se congela, **GitHub no está arrancando** |
| `ultimo_ok_utc` | ¿cuándo terminó bien? Si `run` avanza y esto no, corre y falla |
| `ultima_con_cambios_utc` | ¿cuándo trajo algo nuevo? "Corrí hace 2 min" ≠ "actualicé hace 3 días" |

Más `estado` (`ok` / `guarda` / `error`), `fallos_consecutivos`, `registros`,
`duracion_ms` y el `commit` que lo produjo. `latir()` **nunca lanza**: un fallo
escribiendo el pulso no puede tumbar al robot que hacía el trabajo real.

Falta la parte visible: que el Radar lo lea y muestre "hechos hace 40 s · prensa
hace 3 min".

### 🟡 Comentarios desactualizados en `deploy.yml`

La cabecera dice que los Hechos corren "cada 30 min, horario de mercado". El cron
real es **cada 10 min, de 8:07 a 21:57**. La cuenta de corridas diarias del
comentario (~48) tampoco cuadra: son ~133.

---

## 8. Si vas a trabajar en esto

**Verifica antes de afirmar.** En esta sesión se dieron por imposibles dos cosas
que resultaron perfectamente posibles (CORS de la BVL, Hechos en vivo) y una que
resultó imposible de verdad (la prensa). La única forma de saberlo fue probar
contra el endpoint real desde el dominio real.

**Cuidado al correr el extractor a mano** mientras la BVL está vacía: ver §7.

**La gráfica y el número no se pueden contradecir.** `SonarGrafica` dibuja
`fila.serie`, que es la misma serie de la que salen el `%` y la fuerza. Si alguna
vez no coinciden, el bug está en la serie, no en el dibujo.

**El tono importa tanto como el dato.** Nada de lo que se muestra puede sonar a
recomendación, y todo lo que no está medido va rotulado como hipótesis — por eso
el 🌍 mundo va separado de la firma y con otro rótulo.
