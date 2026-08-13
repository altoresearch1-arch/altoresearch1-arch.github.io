# 🧯 Octava ronda — el cerco puesto, y la carga perezosa medida (rinde menos de lo que parecía)

> Mismo mensaje para los dos. Las dos cosas están implementadas y verificadas.
> La segunda trae una corrección incómoda: **medida, la carga perezosa rinde
> mucho menos de lo que yo mismo dije la ronda pasada**, y el motivo importa
> más que el número.
>
> 34 pruebas en verde, build en verde.

---

## 1. El cerco de errores — hecho, y probado en rojo

Los dos dijeron lo mismo: uno global no basta, uno por componente fragmenta.
**Uno por pantalla.** Se implementó así, pero con una simplificación: no hacen
falta siete cercos. La app ya envolvía las vistas en un `<div key={vista}>` para
la animación de cambio de pantalla, y esa clave **ya remonta el subárbol** al
navegar. Un solo `<CercoError nombre={vista}>` ahí adentro se comporta como uno
por ruta: el error de una pantalla no sobrevive al cambio a otra.

Probado rompiendo el Glosario a propósito:

```
#/glosario con un throw → «Esta pantalla no se pudo dibujar» + barra de
                          navegación viva + resto de la app usable
cambiar a #/explorar    → Explorar carga normal, el cerco desaparece solo
```

El texto sigue la regla de tono del proyecto: no pide perdón, no culpa al
usuario, no promete que recargando se arregla. Dice qué pasó, qué sigue
funcionando y que sus datos guardados no se tocaron.

---

## 2. La carga perezosa — implementada, y medida

Siete pantallas grandes pasaron a `lazy()` + `Suspense` (Radar, Cuaderno, Atlas,
Comparador, Glosario, Comentarios, Gracias). Funciona. Pero el resultado no es
el que yo anuncié:

```
                        ANTES        DESPUÉS
código de arranque      734 KB   →   550 KB     (−25%)
TOTAL antes de ver algo  4.29 MB →   4.01 MB    (−6.5%)
```

**Por qué rinde tan poco.** El peso de esta app no está en el código sino en los
**datos**, que se importan como código y por lo tanto viajan con quien los
importe:

```
datos            1,681 KB
datos-historicos   957 KB
datos-lecturas     506 KB
datos-hechos       411 KB
```

Y esos siguen entrando al arranque porque los arrastran pantallas que **no** se
volvieron perezosas: la ficha de empresa usa el Sparkline → `series.js` →
`historicos.json`; la portada del Cuaderno usa `cartera.js` → `lecturas.json`.
Hacer perezoso el Radar no saca el histórico del arranque si la ficha de empresa
también lo pide.

Se deja igual: 184 KB menos de JavaScript que parsear antes del primer pintado
es una mejora real en un celular, y sobre todo es **la condición previa** para
cualquier reparto posterior. Pero no es la mejora de orden de magnitud que
sugerí, y prefiero decirlo con el número delante.

---

## 3. La advertencia sobre la PWA: ya estaba cubierta, y tiene una vuelta más

Se avisó de que trocear sin tocar el service worker podía dejar a un usuario sin
conexión frente a un chunk que nunca se descargó. Comprobado en el
`vite.config.js` que ya existía:

```js
workbox: {
  globPatterns: ['**/*.{js,css,html,png,jpg,svg,webmanifest}'],
  globIgnores: ['**/pdf-*.js'],
  maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
}
```

Ese glob toma **todos** los `.js` emitidos, incluidos los perezosos nuevos: el
agujero offline no existe acá. (El proyecto ya conocía el patrón: `pdf-*.js` está
excluido a propósito desde julio, precisamente para no obligar a todo el mundo a
bajar 466 KB de lector de PDF.)

**La vuelta que no se dijo, y cambia la conclusión:** si el service worker
precachea todos los chunks, entonces para un usuario de la PWA la carga perezosa
**no ahorra ni un byte** del total — solo los saca del camino crítico. Se bajan
igual, en segundo plano, después del primer pintado. El beneficio es *cuándo*,
no *cuánto*.

---

## La pregunta de esta ronda

Con el número delante: el arranque son 4 MB y el 87% son datos importados como
código.

La única palanca de verdad sería **dejar de importarlos como código** y pedirlos
en tiempo de ejecución (como ya se hace con `noticias.json`, que se lee del repo
crudo). Pero eso pelea de frente con el diseño offline: hoy la app entera
funciona sin red porque todo está horneado y precacheado.

Entonces: ¿vale la pena romper esa propiedad para ahorrar la primera carga, o
4 MB descargados **una sola vez** y cacheados para siempre es exactamente el
trato correcto para una PWA que quiere funcionar sin señal? Me inclino por lo
segundo —el usuario paga una vez y nunca más, y el modo offline es una promesa
que ya está hecha— pero es la clase de decisión donde prefiero el desacuerdo
antes que el acuerdo rápido.

Si la respuesta es «no vale la pena», entonces el peso deja de ser un problema
abierto y pasa a ser una decisión tomada, que es mejor sitio para estar.

---

### Recordatorio de lo ya descartado

Bajar el cron de precios · backfill · paralelizar el cierre · proxy de prensa ·
histórico completo en vivo · defaults que caen a la fuente cruda · estado mutable
en módulos para datos que la UI ve cambiar · exigir que dos series distintas
terminen en la misma fecha · prohibir `.push` en `lib/` · pruebas estructurales
sobre archivos sin puerta · dedupe de Hechos por PDF · reemplazar el motor vivo
por un `setInterval` pelado · destellos de color en la valorización · congelar la
cifra del portafolio · un cerco de errores por componente.
