# ⛔ Invariantes — lo que NUNCA debe romperse, y por qué

> Compañero de [SONAR-Y-ROBOTS.md](SONAR-Y-ROBOTS.md). Ese cuenta **qué hace** el
> sistema; este cuenta **qué no se puede tocar**.
>
> Existe por una razón concreta. El 3-ago-2026 dos revisiones de arquitectura
> propusieron dieciocho mejoras leyendo solo el documento descriptivo. Varias
> eran destructivas — no porque el razonamiento fuera malo, sino porque el
> documento no decía *por qué* las cosas están como están. Un documento de
> arquitectura describe intenciones; el código guarda las razones. Esto rescata
> esas razones y las pone donde se ven.
>
> **Si vas a proponer una mejora, lee esto primero.** Si tu propuesta rompe algo
> de aquí, no es una mejora: es una regresión con buena intención.

---

## 🔴 Datos que se pierden para siempre

### 1. `intradia.json` NO se puede reconstruir hacia atrás
El endpoint de mercado de la BVL **solo sabe de hoy**. No hay forma de
preguntarle cuánto se negoció el martes pasado.

**Consecuencia:** cada corrida que no se guarda es un día que no vamos a tener
nunca. Por eso el cron de precios corre cada 10 minutos aunque la web no lo
necesite: no alimenta la pantalla, **construye un archivo que no existe en
ningún otro lado**.

> ❌ *"Como el cliente ya trae el precio en vivo, bajen el cron a 30–60 min"* —
> propuesto el 3-ago. Habría borrado la resolución intradía de forma permanente.

### 2. Un archivo de datos nunca se sobrescribe con menos de lo que tenía
`extractor/guardas.py` → `se_puede_escribir()`. Si la fuente trae cero registros
útiles o menos del 80% de los anteriores, **no se escribe y se sale con código 0**.

Pasó de verdad: la BVL respondió `200` con `content: []` toda una mañana y el
extractor escribió `precio: null` sobre 152 empresas.

---

## 🛡️ Reglas de las guardas (romper una la vuelve decorativa)

### 3. La guarda cuenta registros con `encontrado: True`, JAMÁS `len()`
`precios.json` tiene sus 152 entradas **incluso cuando están todas en `null`**.
Un `len()` daría 152 y aprobaría la escritura del archivo corrupto.

> Esta es la diferencia exacta entre una guarda que funciona y una que no.

### 4. La guarda corre ANTES de `acumular_intradia()`
Sin precios no hay foto del día que guardar, y ensuciar el único archivo
irrecuperable del repo sería peor que no escribir nada.

### 5. `guarda` NO es `error` en el heartbeat
Si el cortafuegos detiene la escritura, el robot **hizo su trabajo bien**.
Mezclarlos dispararía alarmas falsas cada vez que la BVL tenga una mañana mala,
y `fallos_consecutivos` perdería su significado: ya no distinguiría "mala suerte
una vez" de "esto lleva tres días roto".

### 6. Sin emojis en los `print` de `guardas.py` y `heartbeat.py`
La consola de Windows usa cp1252 y revienta con `UnicodeEncodeError`. La guarda
fallaría **justo en el momento en que tiene que proteger**. Se descubrió
probándola.

En el resto de scripts los emojis se toleran porque `actualizar_todo.py` fuerza
`PYTHONIOENCODING=utf-8` en el subproceso. Pero si corres uno **a mano** en
Windows, sigue tronando: es la única razón por la que estos dos archivos van sin
emojis pase lo que pase.

### 7. No todos los extractores llevan guarda, y es deliberado
El criterio es **frecuencia × daño**, no "ponerlas en todos lados":

| | |
|---|---|
| `fetch_precios` | cada 10 min y **borraba** precios → guarda obligatoria |
| `fetch_hechos`, `fetch_historicos` | frecuentes y sobrescriben → guarda |
| `fetch_noticias` | **fusiona** en vez de reemplazar → no hace falta |
| El resto | 1 vez al día en el cierre → riesgo bajo |

Poner guardas en los 20 sería sobreingeniería y daría una falsa sensación de
cobertura. Si añades un extractor, decide por este criterio y **anótalo aquí**.

---

## 🤖 El robot

### 8. `fetch_historicos.py` rehace la serie COMPLETA desde enero del año anterior
```python
inicio = date(hoy.year - 1, 1, 1)   # fetch_historicos.py
```
Es idempotente, no incremental. **Un día perdido se recupera solo** en la
siguiente corrida buena.

> ❌ *"Añadan una rutina de backfill que recupere los días faltantes"* — resuelve
> un problema que este repo no tiene.

### 9. `fetch_historicos` NO va en el intradía
Son 115 llamadas por corrida (~5,520 diarias) contra un API que no es nuestro,
para refrescar **cierres que intradía no cambian**. El dato vivo ya viene en
`precios.json` y en la capa del navegador.

### 10. La red dirigida de Google News corre SOLO en el cierre
Son ~95 consultas por corrida. En intradía serían ~4,560 diarias y Google corta
mucho antes — y llegaría tarde igual, porque tarda en indexar. El barrido de
portadas RSS (13 feeds) sí corre cada 10 min: son ~15 s.

### 11. Los pasos del cierre son secuenciales a propósito
La SMV se atora con sesiones simultáneas y `fetch_anual_eps` ya falló una vez
así. **No paralelizar.**

### 12. Un archivo de estado por robot, nunca uno compartido
Los modos corren en runs **separados** de GitHub Actions y se solapan. Con un
archivo único, dos runners haciendo pull/push casi a la vez chocan.

### 13. Todo lo que deba viajar al repo vive bajo `app/src/data/`
El workflow commitea con `git add app/src/data …`. Cualquier cosa fuera de ahí
se escribe en el runner y **se pierde al terminar el job**.

---

## 🌐 Los endpoints de la BVL (comprobados el 3-ago-2026)

### 14. `Content-Type` debe ser `application/json`
Con `text/plain` —que evitaría el preflight— el endpoint responde **415**.

### 15. El preflight NO lista `POST` y funciona igual
`Allow-Methods: GET,OPTIONS,PUT,DELETE,PATCH`. Pasa porque `POST` es un método
*safelisted* del estándar CORS. **Si algo falla, el método no es el problema.**

### 16. `startDate` de `share-values` es EXCLUSIVO
Pedir desde el 31 devuelve `[]`; pedir desde el 30 devuelve el 31. Sumarle un
día a la última fecha guardada se salta justo la rueda que falta.

### 17. `200` con `content: []` es un ESTADO, no un fallo
Le pasa a la BVL de verdad; su propia web muestra "no hay datos disponibles".
Tratarlo como error dispara alarmas falsas; tratarlo como dato bueno corrompe
archivos.

### 18. Nunca usar `sell` como precio
`sell` es la orden de venta parada en pantalla, **no una transacción**. El precio
es `last`, con caída a `previous` cuando no negoció.

### 19. CORS no existe fuera del navegador
Que 16 de 18 medios bloqueen al navegador **no dice nada** sobre leerlos desde
Python. El robot los lee sin problema: por eso el robot es la solución, no el
problema.

---

## 📡 El Radar

### 20. El filtro `pocoNegociada` no se puede quitar
De 114 acciones, 82 tienen el precio congelado; la BVL repite el último cierre
cuando nadie operó. Sin el filtro, GRHOLDC1 aparecía con **+674% en 20 días**
habiendo cambiado de precio 2 veces en el mes.

### 21. A la acción que no negoció NO se le inventa un día
En `conUltimoPrecio()`: si la fecha de sesión es **anterior** al último cierre
guardado, no se toca nada. La BVL repite el cierre viejo, y estamparlo como si
fuera de hoy inventaría una rueda que no existió.

### 22. La prensa nunca retrocede
Solo se acepta una copia con `generado` **más nuevo** que el que ya se usa. Y al
entrar una nueva hay que invalidar `cacheMundoTk`, o el 🌍 seguiría cruzando
titulares viejos.

### 23. Dentro de una cuña, el ángulo NO significa nada
Es una semilla estable (`semilla(ticker)`) para que los tickers no se monten,
nada más. El ángulo codifica **sector** y solo eso.

Por eso al abrir una cuña se puede repartir ese sector en los 360° enteros sin
perder información: si estás mirando un solo sector, esa codificación es
redundante. Es lo que lleva la separación mínima entre contactos de **0.5° a
32.7°** en minas.

> Si alguna vez le das significado al ángulo dentro de la cuña, la expansión
> deja de ser honesta y hay que quitarla.

### 24. Los sectores usan MEDIANA, no promedio
Con 2 o 3 nombres por sector, un caso raro cuenta una película que no pasó.

### 25. La gráfica y el número no pueden contradecirse
`SonarGrafica` dibuja `fila.serie`, **la misma** de la que salen el `%` y la
fuerza. Si alguna vez no coinciden, el bug está en la serie, no en el dibujo.

### 26. La serie de precios se pide por UNA sola puerta: `serieDe()`
`lib/series.js`. Y `historicoDe()` **no devuelve `valores`** — entrega los
metadatos (volatilidad, rango de 12 meses, liquidez) y nada más.

No es una preferencia de estilo: es el cierre de una clase entera de bugs. El
archivo del robot se queda ruedas atrás cada vez que el cron falla (el
04-ago-2026 llegaba al 30-jul con el precio ya en el 3-ago), así que quien leía
la serie cruda mostraba números viejos al lado de números frescos:

- el «+X% desde el titular» del Sonar daba **+2.0%** donde correspondía
  **+3.7%** (BBVAC1, medido el 04-ago);
- el Sparkline de la ficha de empresa y del Cuaderno terminaba tres ruedas
  antes que el «Valor hoy» que tiene una línea más abajo.

Dos bugs distintos, una sola causa: dos fuentes de verdad para el mismo dato.
Si la serie cruda no sale por ninguna puerta, no se puede leer mal.

> ⚠️ La reparación tiene **dos patas** y hacen falta las dos: `conCola` (las
> ruedas cerradas que el robot no guardó) y `conUltimoPrecio` (la rueda en
> curso). Reparar solo con el precio de hoy deja un hueco en el medio y la
> ventana sigue midiendo desde una fecha vieja.

### 27. La edad de un Hecho de Importancia se mide contra el CALENDARIO
Contra el día de hoy, que entra **por parámetro** — nunca un `new Date()`
escondido dentro del cálculo, y nunca contra la fecha del último cierre.

Medida contra el cierre, cualquier Hecho posterior a la última rueda daba días
negativos y **desaparecía de toda la pantalla**. Pasa en las dos ventanas donde
el dato vale más: entre las 8 y las 9 de la mañana (la rueda no abrió, el cierre
es de ayer) y los fines de semana. El 03-ago-2026 Alicorp publicó su compra a
Unilever a las 07:08 — justo el caso que la capa en vivo existe para mostrar.

La relación con la última sesión (`despuesDelCierre`) es un dato **aparte**: la
pantalla dice la hora («📄 HI 07:08»), no un «hace 0 días» que sería falso. Y
las fechas futuras siguen dando `null`: ahí no hay nada que mostrar, hay un dato
malo.

### 28. Si el dato vive en un módulo, el componente necesita su contador
Los titulares no viven en el estado de React (`NOTICIAS` en `lib/radar.js`), así
que React **no puede saber** que entró una copia nueva. `RadarSonar` calculaba
el cruce 🌍 con `useMemo(…, [])` y se quedaba congelado con la prensa horneada
toda la visita, aunque el módulo hiciera bien su parte invalidando `cacheMundoTk`.

Por eso `prensa` viaja como prop y entra en las dependencias. Y por eso mismo la
serie reparada **no** se guarda en un Map de módulo: un dato que cambia donde
React no mira es exactamente esta falla otra vez.

### 28-bis. Los patrones no aflojan sus cortes hasta que enciendan
`lib/patrones.js` agrega cuatro lecturas al Sonar. Tres de ellas dieron **0
contactos** el día que se escribieron (7-ago-2026) y así se dejaron:

- **el día partido** mide la separación con las medianas de las acciones de
  Lima, no con el precio de los metales. El 7-ago el oro subió 2.37% y el cobre
  cayó 1.85% en el exterior, pero en Lima las dos familias cerraron en verde:
  la marca no encendió, y **está bien** que no encendiera. Para ver ese día
  hace falta la cotización DIARIA del metal, que hoy no se baja (el BCRP la
  publica mensual). Bajar el corte hasta que prenda es fabricar la señal.
- **la mixta no vota.** Volcan vende zinc y plata: si se la asignara a una
  familia, correría esa mediana y el «día partido» pasaría a demostrarse solo.
- **el spread contra la plaza extranjera** devuelve `null` sin el precio de
  afuera, en vez de mostrar el último conocido. Un spread viejo se ve idéntico
  a uno fresco.

Y el tipo de cambio se acepta en los dos sentidos (`USD/CAD` o `CAD/USD`)
porque invertir el par da un número plausible y equivocado: RIO2 el 7-ago daba
−4.3% bien convertido y −50.7% al revés.

---

## 🎯 Tono (la Regla de Oro del proyecto)

### 29. Todo en pasado y en modo descripción
"Se movió", nunca "va a subir". "Mira", nunca "compra". La app **muestra, no
recomienda**.

### 30. Lo medido va separado de lo hipotético
El 🌍 mundo lleva otro rótulo que la firma **a propósito**: la firma trae su
cuenta sacada de los cierres, el mundo son cadenas escritas a mano sin medir
contra el precio. Mezclarlas le daría a una hipótesis el mismo peso visual que a
un hecho, y esa es justo la confusión que el Radar existe para evitar.

### 31. Nunca "porque", siempre "puede"
Que el precio subiera después del titular no significa que subiera **por** el
titular. `estudio_noticias.py` midió que ni los titulares de la propia empresa
predicen su cierre.

---

## 🧪 Las pruebas

### 32. Son DOS runners, y no hay forma de que sea uno solo
```bash
cd app && npm test                 # vitest -> app/src/lib/radar.test.js
python extractor/test_guardas.py   # sin pytest -> la guarda del extractor
```
La guarda es Python y vitest no la puede tocar. Escribir ese test en JavaScript
sería probar una reimplementación, no la guarda que corre cada 10 minutos.

**Qué merece una prueba:** lo que al romperse produce **números plausibles** que
nadie notaría mirando la pantalla — las tres ramas de `conUltimoPrecio`, la
mediana por sector, el conteo con `encontrado` de la guarda, el filtro
`pocoNegociada`. **Qué no:** formatos, textos, iconos. Cambian mucho más seguido
que la aritmética, y ahí el test se vuelve un peaje.

Existe porque los invariantes vivían solo en prosa, y dos revisiones externas
propusieron cambios destructivos sin poder notarlo: leer un documento no falla,
un test sí.

---

## 🔴 La capa viva

### 33. Los Hechos de Importancia se piden por `hechosDe()`
`lib/hechos.js`. Mismo motivo que la serie de precios (#26): tienen **dos
representaciones con distinta frescura** —el archivo del robot y lo que el
navegador baja cada 45 s— y mientras solo el Radar veía la viva, el Sonar decía
«📄 HI 07:08» de una empresa y esa misma empresa, abierta, no tenía ese Hecho.

**El dedupe va por fecha + texto, JAMÁS por PDF.** El Hecho que llega en vivo
puede no traer documento todavía (`bajarHechosVivos` solo pone `pdf` si la BVL
ya publicó la ruta) y el mismo Hecho, cuando el robot lo hornee, sí lo va a
traer. Con el PDF de clave serían dos registros distintos y el usuario vería su
Hecho repetido.

La regla general, que vale para cualquier campo que se agregue después: **la
identidad de un registro no puede depender de un atributo que aparece más
tarde.** Si el dato vivo y el horneado se distinguen por algo que uno de los dos
todavía no tiene, no son el mismo registro para el código y sí lo son para el
usuario.

> **El criterio para la próxima fuente de datos:** la puerta única no se pone
> por simetría, se pone donde existe una segunda representación **más fresca**
> del mismo dato. `historicos.json` sí · `hechos.json` sí · `dividendos.json`
> no, porque no existe un dividendo intradía.

### 34. El almacén de datos vivos es uno solo, y el gatillo lo encienden los consumidores
`lib/vivoCompartido.jsx`. El almacén vive en la raíz de la app para que no haya
dos frescuras del mismo dato; el motor **solo corre cuando hay al menos una
pantalla montada que muestre dato vivo**. Una pestaña olvidada en el glosario no
le pregunta nada a la BVL. Comprobado: recargando en el glosario, **0 llamadas**;
recargando directo en una ficha de empresa, `stock-quote/market` y
`corporate-actions`.

Y el motor sigue siendo `useMercadoVivo` **con todo lo que ya tenía**: backoff al
fallar, silencio con la pestaña de fondo y una sola consulta fuera del horario de
rueda. Un `setInterval` de 45 s pelado es más corto de escribir y le estaría
preguntando a la BVL un domingo a las tres de la mañana.

### 35. Ningún consumidor guarda su propia copia del dato vivo
El proveedor tiene el estado; las pantallas lo **leen**. En cuanto una guarda su
copia —en un `useState` propio, o en un caché de módulo— vuelve a haber dos
verdades y ninguna prueba de resultado lo nota.

Pasó dos veces, y la segunda costaba plata: `empresaDe()` en `lib/cartera.js`
cacheaba la empresa **entera, precio incluido**, así que la capa viva traía un
precio nuevo, React repintaba el Cuaderno, y la función devolvía el objeto viejo
porque la clave del ticker ya estaba guardada. El Cuaderno mostraba el cierre del
día anterior mientras el Sonar ya iba en vivo.

Se cachea **solo lo que no cambia** durante la vida de la página (nombre, sector,
historial de dividendos, Hechos del archivo). El precio entra por argumento.

### 36. La valorización del Cuaderno se mueve con el mercado, y sin adornos
Cuando la pantalla dice «esto vale tu portafolio», responde a *ahora*, no a *la
última vez que el robot publicó*. Congelar la cifra mientras alguien la mira es
programar el mismo bug a propósito: al recargar, la plata daría un salto en vez
de irse moviendo.

Pero **nada de destellos, animaciones ni resaltados** en cada cambio. Hay
diferencia entre *el mercado cambió* y *quiero llamar tu atención sobre que
cambió*; lo segundo es una cinta bursátil, y esto es un cuaderno. El temblor de
la fila cuando un `1` es más angosto que un `8` se arregla donde corresponde:
`font-variant-numeric: tabular-nums`, en el CSS.

---

## 📦 El peso de la app

### 37. Los datos van HORNEADOS en el bundle, y es una decisión, no una deuda
Se evaluó el 05-ago-2026 sacarlos y pedirlos en tiempo de ejecución para
aligerar la primera carga. **Se rechaza.** Todo lo que hace especial a este
proyecto —sin backend, sin servidor, GitHub Pages, un robot que publica y una
app que funciona entera sin señal— se apoya en que el dato viaja con el código.
Romper eso para ahorrar una descarga sería cambiar la propiedad más fuerte por
la métrica más vistosa.

**Y la métrica era engañosa.** Los 4 MB del `dist` son tamaño en disco; lo que
de verdad viaja va comprimido:

| | disco | por la red |
|---|---|---|
| `datos` | 1,701 KB | 436 KB |
| `datos-historicos` | 980 KB | 152 KB |
| `index` | 558 KB | 186 KB |
| `datos-lecturas` | 513 KB | 84 KB |
| `datos-hechos` | 418 KB | 54 KB |
| **primera carga** | **~4.0 MB** | **~950 KB** |

Comprobado contra el sitio publicado: GitHub Pages responde
`Content-Encoding: gzip` **solo**, incluso pidiéndole brotli. Por eso **no** se
agrega un plugin que genere `.br`/`.gz` en el build: esos archivos nadie los
pediría —Pages comprime al vuelo y no negocia archivos precomprimidos— y solo
engordarían el repo.

Una sola descarga de ~950 KB, cacheada para siempre por el service worker
(29 entradas), a cambio de que la app entera funcione en un avión. Ese trato se
mantiene mientras no cambien los objetivos de fondo.

> Si algún día aparece un dato **muy pesado, poco usado y prescindible sin red**
> (una biblioteca documental, un paquete de PDF), ese sí es candidato a salir
> del bundle. Los datos que sostienen las pantallas, no.

---

## Cómo mantener esto vivo

Cuando cierres un bug o tomes una decisión que **costó descubrir**, añádela aquí
con su evidencia. Un invariante sin su porqué se borra en la siguiente
refactorización; con su porqué, se respeta.

Y si algún invariante deja de ser cierto, **bórralo** — una regla falsa hace más
daño que ninguna regla.
