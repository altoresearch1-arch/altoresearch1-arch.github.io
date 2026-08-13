# ✅ Tercera ronda — lo que se implementó, y qué pasó con cada consejo

> Mismo mensaje para los dos. Los cuatro bugs están arreglados, la puerta única
> está puesta y hay pruebas corriendo en dos runners. Abajo va qué se tomó de
> cada respuesta, qué se descartó **con la verificación al lado**, y las dos
> preguntas que quedan abiertas.
>
> Regla de siempre: si hace falta el cuerpo de una función para opinar, pídanlo.
> La ronda pasada el único análisis equivocado fue justamente sobre la función
> cuyo código no estaba pegado.

---

## Estado: los cuatro bugs cerrados

```
app/src/lib/series.js        NUEVO — la puerta única
app/src/lib/radar.js         ya no importa historicos.json
app/src/lib/finanzas.js      historicoDe() ya no devuelve `valores`
app/src/components/          Sparkline · Comparador · Radar · RadarSonar
app/src/lib/radar.test.js    NUEVO — 12 pruebas (vitest)
extractor/test_guardas.py    NUEVO — 8 pruebas (python, sin pytest)
INVARIANTES.md               invariantes 26 a 32
```

```
npm test                          →  12 passed
python extractor/test_guardas.py  →  TODO EN VERDE
npm run build                     →  built in 4.31s
```

**Verificado en el navegador, no solo en los tests.** El bloque «tal vez sube
por esto» de BBVAC1 mostraba **+2.0%** (medido contra el cierre del 30-jul que
tenía el archivo) y ahora muestra **+3.7%**, contra el mismo precio en vivo de
S/ 2.22 que la tarjeta imprime dos centímetros más arriba. Y el Sparkline de la
ficha de empresa terminaba en 30/07: ahora termina en 03/08, igual que el precio
que tiene al lado.

---

## Lo que se tomó tal cual

**Vitest, no el refactor.** Coincidieron los dos y fue directo: `vitest run`
resuelve los imports de JSON igual que Vite. Cero cambios en el bundle.

**La puerta única como idea central.** Es lo que más rindió de las dos rondas.
Los dos llegaron por caminos distintos a que el problema no era el cálculo del
Radar sino la ausencia de un punto único de acceso, y tenían razón: al ponerlo,
el Sparkline se arregló solo, sin tocar su lógica.

**`prensa` por props, sin store.** También coincidieron, y se hizo así.

**Nada de `Math.max(dias, 0)`.** Se separaron las dos edades: `dias` es
calendario (contra el hoy que entra por parámetro) y `despuesDelCierre` es la
relación con la última sesión. Las fechas futuras siguen dando `null`.

**El barrido por «pantallas que muestran gráfico + precio + % + fecha juntos»**
en vez de por nombre de archivo. Dio dos sitios más: `cambio6M()` y la carrera
de dos acciones del Comparador, que comparaba una serie que llegaba al 30-jul
contra otra que llegaba al 3-ago. Los dos quedaron arreglados al pasar por la
puerta.

---

## Lo que se descartó, con la verificación al lado

### 1. La puerta única propuesta se saltaba `conCola` — habría sido peor que el bug

La versión concreta que se propuso repara solo con el precio de hoy:

```js
export function obtenerSerie(ticker, precioVivo = null) {
  const base = (…valores).filter(([, v]) => v > 0)
  if (!precioVivo) return base
  return conUltimoPrecio(base, precioVivo)   // ← sin conCola
}
```

La reparación tiene **dos patas**: las ruedas cerradas que el robot no alcanzó a
guardar (`conCola`) y la rueda en curso (`conUltimoPrecio`). Con el archivo tres
ruedas atrás, esa versión pega el precio del 3-ago encima del cierre del 30-jul
y **se salta el 31-jul y el 1-ago**: la ventana sigue midiendo desde una fecha
vieja. Sería el bug original disfrazado de arreglo, y encima escondido detrás de
una función que promete lo contrario. Hay un test que lo fija.

Dos cosas más de esa misma versión: el `import { conUltimoPrecio } from './radar'`
creaba un **ciclo de imports** (las funciones de reparación se mudaron a
`series.js` y `radar.js` las importa de ahí, nunca al revés), y el
`precioVivo = null → devuelve base` es la misma trampa del default silencioso que
ya se había descartado la ronda anterior.

### 2. El `Map` de módulo: no, y por la misma razón que existe el Bug 3

Se propuso que la puerta mantuviera internamente un `Map<ticker, serie>`
construido una vez. Un Map que cambia cuando entra un precio nuevo, viviendo en
un módulo, es **exactamente la forma del Bug 3**: el dato cambia donde React no
mira y el componente nunca se entera. Acabábamos de arreglar eso.

La puerta quedó como función pura sobre los imports del módulo. Sin argumentos
repara con `precios.json` —que está horneado y siempre disponible, sin red y sin
hooks— y eso solo alcanza para el Sparkline. El Radar, que además tiene la cola
bajada en vivo, la pasa explícita. **Ningún camino devuelve la serie cruda.**

Y el cierre no es una convención documentada: **`historicoDe()` dejó de devolver
`valores`**. Entrega volatilidad, rango de 12 meses y liquidez, que es para lo
que la usan las otras nueve pantallas. Si la serie cruda no sale por ninguna
puerta de la UI, no hay nada que recordar.

### 3. El Range de YouTube no funciona — probado

Se propuso `curl -r 0-80000` para bajar solo la cabecera. Resultado real:

```
range: http=200  bytes=1267265      ← 200, no 206: ignoró el Range
HEAD:  Content-Length: 0, sin Accept-Ranges
canonical dentro de los primeros 80 KB: sí
```

YouTube no honra Range en esa respuesta. Lo que sí sirve es la otra propuesta:
leer el stream y cortar en `</head>` **o a los 128 KB, lo que llegue primero**.
El tope duro es la parte buena — un cambio raro del documento nunca termina
bajando un mega. También entra la validación de que el `canonical` pertenezca al
canal esperado: distingue «no hay nada en vivo» de «YouTube cambió el HTML».

### 4. Dos correcciones de hecho

- No son 250 tickers recalculándose en cada render: son **45 filas**, memoizadas
  contra `[precios, hechos, cola, prensa, hoy]`, que se recalculan como mucho
  cada 45 s.
- `pocoNegociada` no es una función de JavaScript: es una bandera del extractor
  en Python — fracción de ruedas con cambio de precio en 12 meses contra un
  umbral de 0.5. Una suspensión de 3 días sobre ~250 ruedas mueve esa fracción
  un punto: no puede voltear el umbral.

---

## Sobre las pruebas: se resolvió el desacuerdo y apareció algo que ninguna vio

Sobre `pocoNegociada` hubo posiciones opuestas («se ve a los 2 segundos, no vale
el test» contra «sí, porque es difícil de detectar a mano»). Se probó, y por un
argumento que no estaba en ninguna de las dos: el «se nota enseguida» solo cubre
la falla en un sentido. Si el filtro se afloja, aparecen 82 fantasmas y salta a
la vista; si se pasa de estricto, **desaparecen acciones y no lo nota nadie**. El
test son tres líneas.

Y lo que ninguna vio: **la guarda del extractor es Python**, así que son dos
runners y no hay forma de que sea uno solo. Escribir ese test en JavaScript sería
probar una reimplementación, no la guarda que corre cada 10 minutos. Quedó como
un script plano con `assert`, sin agregar pytest.

De esas 8 pruebas, la que más rinde es la que ninguna respuesta habría pedido:
recorre `guardas.py` y `heartbeat.py` y verifica que **cada línea con `print(`
sobreviva a cp1252**. La consola de Windows revienta con `UnicodeEncodeError`
ante un emoji, o sea que la guarda fallaría justo en el momento en que tiene que
proteger. Ya pasó una vez; ahora está fijado.

---

## Las dos preguntas que quedan

1. **¿Qué falta cerrar de esta clase de bug?** La puerta cubre las series de
   precios. Pero el patrón de fondo —dos módulos leyendo el mismo dato por
   caminos distintos— puede repetirse con los otros archivos del robot
   (`hechos.json`, `dividendos.json`, `precios.json` mismo, que hoy se importa
   en ocho sitios). ¿Vale la pena el mismo tratamiento para alguno, o ahí la
   duplicidad no hace daño porque nadie los mezcla con un dato más fresco?

2. **Sobre las pruebas que ahora existen:** ¿qué le falta a esas 12 para que sea
   difícil romper el Radar sin que un test se queje? Interesa el hueco concreto,
   no una lista de buenas prácticas. El criterio sigue siendo el mismo: solo lo
   que al romperse da **números plausibles** que nadie notaría en pantalla.

---

## Lo que sigue

El detector de transmisiones en vivo (Fed, Casa Blanca, Gobierno del Perú,
BCRP): robot que escribe `envivo.json`, la app lo lee del repo crudo para no
esperar al despliegue, y caducidad del lado del cliente a los ~20 minutos porque
el cron de GitHub es «mejor esfuerzo». Solo el enlace y la hora de inicio: sin
título ni descripción, porque el título de un video lo escribe un tercero para
que le hagan clic, y esta app solo muestra cosas medidas.

### Recordatorio de lo ya descartado

Bajar el cron de precios (borra resolución intradía irrecuperable) · rutina de
backfill (`fetch_historicos` es idempotente) · paralelizar el cierre (la SMV se
atora) · proxy para leer prensa desde el navegador · traer el histórico completo
en vivo · defaults que caen a la fuente cruda · estado mutable en módulos para
datos que la UI tiene que ver cambiar.
