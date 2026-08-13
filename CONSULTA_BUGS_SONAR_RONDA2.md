# 🔎 Segunda ronda — qué quedó decidido, qué se descartó y qué apareció

> Este mensaje va para los dos. Las dos respuestas de la ronda anterior se
> leyeron completas y se verificaron contra el código. Coincidieron en dos de los
> tres arreglos; en el tercero se contradijeron y hubo que elegir. Abajo va lo
> decidido (cerrado), lo descartado con el código a la vista, lo que apareció
> gracias a una de sus pistas, y las preguntas de esta ronda.
>
> **Cómo funciona esto:** ustedes opinan, acá se decide. Un punto marcado como
> cerrado no necesita más argumentos salvo que tengan una prueba de que está mal
> — en ese caso, con el contraejemplo delante.

---

## ✅ Cerrado — no hace falta volver sobre esto

**Bug 1 (la serie vieja).** Se construye un `Map<ticker, serieReparada>` una sola
vez dentro de `filasRadar()` y se pasa **por parámetro**, sin estado de módulo y
sin valor por defecto. El razonamiento que se aceptó: `NOTICIAS` es global porque
representa una copia compartida que puede llegar tarde y a la que hay que
invalidarle un caché; una serie de precios no es eso, es un argumento de cálculo.

**Bug 3 (el 🌍 congelado).** El contador `prensa` se pasa como prop y entra en las
dependencias del `useMemo`. Nada de store global ni `useSyncExternalStore`:
añadiría más complejidad de la que resuelve.

**Bug 2 (el HI de pre-apertura).** El reloj se pasa por parámetro — nada de un
`new Date()` escondido dentro de una función de negocio. Y se separan dos
conceptos que hoy están mezclados en una sola resta: la **edad de calendario** es
el cálculo, y la **relación con la última sesión** es lo que decide qué se
escribe en pantalla. La app ya tiene el vocabulario para eso («📄 HI 07:08»), así
que no hay que inventar ningún «hace 0 días».

---

## ❌ Descartado, con el código delante

### 1. El «Bug 4 latente» de `conUltimoPrecio` no existe

Se propuso que `conUltimoPrecio` podría agregar un punto duplicado para el mismo
día y aplanar el retorno de 1 día, y se sugirió como arreglo comprobar si la fecha
ya existe: si es igual, reemplazar; si es posterior, agregar. Ese es, palabra por
palabra, el código que ya está escrito:

```js
// lib/radar.js:373
function conUltimoPrecio(base, px) {
  const precio = px?.precio
  if (!(precio > 0)) return base
  const sesion = (px.ultimaOperacion || '').slice(0, 10) || px.fecha
  if (!sesion) return base
  const ultima = base[base.length - 1][0]
  if (sesion > ultima) return [...base, [sesion, precio]]                 // posterior → agrega
  if (sesion === ultima) return [...base.slice(0, -1), [sesion, precio]]  // igual → reemplaza
  return base                                                            // anterior → no toca nada
}
```

La rama de «anterior → no toca nada» es un invariante del proyecto (#21): a la
acción que no negoció no se le inventa una rueda, porque la BVL repite su último
cierre y estamparlo como si fuera de hoy sería fabricar un día que no existió.

**Lo interesante es dónde falló.** De las cuatro funciones en juego,
`conUltimoPrecio` fue la única cuyo **cuerpo no estaba pegado** en el documento —
solo se la mencionaba por su nombre. Sobre las tres que sí tenían el código a la
vista, el análisis fue bueno. De ahí sale la regla para lo que viene: **si el
cuerpo de una función no está en el documento, no se opina sobre ella — se pide.**
Un «revisé y encontré» sobre código que no se vio cuesta más caro que un «falta
esto para poder opinar».

### 2. El parámetro con valor por defecto que cae al archivo crudo

Se propuso esta firma para el arreglo del Bug 1:

```js
export function noticiasConEfecto(ticker, ruedas, valsReparados = []) {
  const vals = valsReparados.length > 0
    ? valsReparados
    : (historicosData.historicos?.[ticker]?.valores || []).filter(([, v]) => v > 0)
  …
```

Se rechaza. Parece prudente y es lo contrario: mantiene vivas las dos fuentes de
verdad y hace que el bug vuelva **en silencio** cada vez que alguien llame a la
función sin el parámetro. El objetivo del arreglo no es que la función acierte
más seguido, es que **sea imposible leer el archivo crudo desde ahí**. Parámetro
obligatorio.

### 3. El recorte de días negativos a `0`

Una de las dos respuestas advirtió explícitamente que no se hiciera
`Math.max(dias, 0)` porque esconde el problema — y la otra, en su propio código,
escribió `dias: isFinite(dias) && dias >= 0 ? dias : 0`. Se resuelve a favor de la
primera, y no por estilo:

Con el reloj real (día calendario de Lima), un HI publicado hoy a las 07:08 da
`dias = 0` **sin recortar nada**. La rama negativa deja de ser alcanzable en el
caso que estamos arreglando; lo único que llega ahí es un registro con fecha
futura, o sea un dato malo. Y ahí un `0` imprime «publicado hoy» sobre datos
corruptos, que es exactamente lo que este proyecto no hace en ningún otro lado:
sin dato, no se inventa. Ese `null` se queda.

---

## 🆕 Lo que apareció gracias a la pista de auditar TODO lo que lee el histórico

La sugerencia era buscar no solo `historicos.json` por nombre sino cualquier
lectura de `historicosData`, porque el Bug 1 nace de una duplicidad de fuentes.
Se hizo, y el desfase está **fuera del Sonar**, en las dos pantallas más usadas:

```js
// components/Sparkline.jsx:31 — la gráfica de precio de toda la app
const h = historicoDe(ticker)          // → historicosData.historicos[ticker], archivo crudo
```

Y se renderiza en:

- `components/Empresa.jsx:278` — la gráfica principal de la ficha de empresa.
- `components/Cuaderno.jsx:658` — **una línea antes** de «Valor hoy», que sale de
  `precios.json`.

Con los datos del 4-ago: la gráfica termina el **30-jul** y el número que tiene
debajo es del **3-ago**. En la pantalla de la cartera, el gráfico y el valor de tu
plata están desfasados tres ruedas, a un centímetro de distancia.

Se revisaron también los otros lectores y **no** están afectados, para que nadie
los arregle de más: `precioEnFecha()` solo consulta fechas viejas (dividendos del
año pasado), e `historiaDelPlazo()` mira 18 meses, donde 3 ruedas no mueven nada.

---

## ⚠️ Un problema que ninguna de las dos vio: los tests propuestos no corren

Los tres tests planteados están bien pensados (cola + precio vivo para el Bug 1;
cierre de ayer con HI de hoy 07:08 para el Bug 2; dos `generado` consecutivos para
el Bug 3). Pero tal como se escribieron no se pueden ejecutar:

- `require('../app/src/lib/radar')` — `radar.js` es ESM, no CommonJS.
- Y aunque se importara con `import`, ese archivo hace `import x from '../data/x.json'`
  **siete veces**, sin atributos de importación. Node exige `with { type: 'json' }`;
  Vite no, porque los transforma en tiempo de compilación.

O sea que hay una decisión previa que nadie planteó: **para poder testear
`radar.js` hace falta un runner que resuelva los imports de JSON igual que Vite, o
separar la aritmética pura de los imports de datos.** Se decidió lo primero:
vitest como `devDependency` — no toca el bundle, no pesa en la web, y hace que los
tres tests corran sin refactor.

---

## ❓ Las preguntas de esta ronda

1. **Sobre vitest:** ¿alguna razón concreta para no meterlo? ¿Vale más la pena el
   refactor de separar la aritmética pura de los imports de datos, aunque sea
   mucho más grande?
2. **Sobre la raíz del Bug 1 y del Sparkline:** los dos nacen de que cualquier
   archivo puede leer el histórico crudo. ¿Cómo se logra que exista **una sola
   función** que entregue «la serie de precios de este ticker, ya reparada», de
   modo que leer el archivo crudo por accidente sea imposible — sin que eso se
   convierta en un store global con estado escondido? Interesa la forma concreta,
   no el principio.
3. **Sobre las pruebas, más allá de estos bugs:** de los invariantes numéricos del
   proyecto (el filtro `pocoNegociada`, las tres ramas de `conUltimoPrecio`, la
   mediana en vez del promedio por sector, la guarda del extractor que cuenta
   registros con `encontrado: true` y no `len()`), ¿cuáles fijarían con una prueba
   y cuáles no valen el costo? El criterio que interesa es cuál se rompería sin
   que nadie se dé cuenta.
4. **¿Qué se sigue pasando por alto?** Con la misma vara que la vez pasada: una
   pista verificable vale más que una auditoría general. Si hace falta el cuerpo
   de una función para opinar, pídanlo.

---

## 🔜 Lo que viene después (contexto, no tarea)

Después de estos arreglos toca una función nueva: avisar cuando la Fed, la Casa
Blanca, el Gobierno del Perú o el BCRP están **transmitiendo en vivo**, con el
enlace y nada más — sin título ni descripción, porque el titular de un video lo
escribe un tercero para que le hagan clic, y esta app solo muestra cosas medidas.

El diseño, ya verificado contra YouTube: pedir `youtube.com/@canal/live` y mirar el
`<link rel="canonical">`. Si es `watch?v=…` está en vivo y ese es el enlace; si es
`/channel/…` no hay nada. Sin API key, sin muro de consentimiento, 200 en los
cuatro canales. Va por el robot (GitHub Actions), no por el navegador, porque
YouTube bloquea al navegador igual que los medios de prensa. La app lo lee del
repo crudo para no esperar al despliegue.

**La parte que interesa opinar:** el cron de GitHub es «mejor esfuerzo» — el
3-ago-2026 se saltó 25 turnos programados seguidos. Si el robot se muere con un
🔴 escrito en el archivo, la app mostraría «EN VIVO» sobre una transmisión que ya
terminó. La defensa prevista es **caducidad del lado del cliente**: si el archivo
tiene más de ~20 minutos, no se pinta nada (aguanta una corrida perdida sin
mentir hacia adelante). ¿Ven un agujero en eso? ¿Y alguna forma de detectarlo sin
descargar ~1 MB de HTML por canal en cada vuelta, además de cortar la lectura en
el `</head>`?

---

### Recordatorio de lo ya descartado en rondas anteriores

Bajar el cron de precios (borra resolución intradía irrecuperable) · rutina de
backfill (`fetch_historicos` es idempotente, se recupera solo) · paralelizar los
pasos del cierre (la SMV se atora con sesiones simultáneas) · un proxy para leer
prensa desde el navegador (convierte un repo que se actualiza solo en un servicio
que hay que mantener) · traer el histórico completo en vivo (115 llamadas por
corrida para refrescar cierres que intradía no cambian).
