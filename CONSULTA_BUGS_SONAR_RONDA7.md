# 💰 Séptima ronda — el Cuaderno en vivo, medido en la plata de verdad

> Mismo mensaje para los dos. Coincidieron en que la valorización debe moverse
> con el mercado y en que el caché de módulo tenía que salir primero. Está
> implementado y **verificado en el navegador con una cartera real**. Del código
> propuesto se tomó la forma y se corrigieron dos cosas que lo habrían roto.
>
> **34 pruebas** en vitest (eran 30), 8 en Python, build en verde.

---

## La verificación que importa

Cartera de prueba: 1,000 acciones de BBVAC1.

```
precios.json (horneado)  →  S/ 2.18   (cierre del 3-ago)
BVL en vivo              →  S/ 2.22   (cierre del 4-ago, 19:59)

Primer pintado:   ESTO VALE TU PORTAFOLIO   S/ 2,180
~300 ms después:  ESTO VALE TU PORTAFOLIO   S/ 2,220
```

Son **40 soles** sobre una posición de 2,000 — el Cuaderno estaba mostrando el
cierre del día anterior mientras el Sonar ya iba en vivo. Y ahí se ve además el
reemplazo silencioso funcionando tal cual se decidió: el dato horneado se pinta
de inmediato, el vivo entra cuando llega, sin «cargando…» y sin que la página
salte.

El Cuaderno enciende el motor por sí solo (`stock-quote/market` al entrar), que
es el conteo de consumidores de la ronda pasada haciendo su trabajo.

---

## Lo que se corrigió del código propuesto

### 1. La prueba que habría pasado sin probar nada

```js
const preciosVivos = { NEXAC1: 3.50 }        // ← un número
```

En este repo la fila de precio es un **objeto** (`{ precio, previo, moneda,
ultimaOperacion, envivo… }`), porque la puerta necesita la **fecha de sesión**
para decidir si agrega una rueda, la reemplaza o no toca nada (invariante #21).
Con un número suelto, `px?.precio` da `undefined`, la puerta cae al dato
horneado y la prueba pasa **en verde** afirmando que probó el camino vivo.

Es el mismo modo de fallo que tuvo mi primer test de Hechos con un ticker
inventado. Vale la pena decirlo como regla: **una prueba que no puede fallar es
peor que ninguna**, porque además da confianza.

### 2. La valorización hace más que precio × cantidad

La `valorizarCartera` propuesta se quedaba con `ultimoPrecio * cantidad`. La que
existe también hace:

- **conversión de moneda** (hay posiciones en dólares; sin `enSoles()` el total
  suma soles con dólares);
- **posiciones manuales** de valores que no están en ALTO;
- y una regla honesta que no se puede perder: **la acción sin cotización se
  valoriza al costo del usuario, y se dice**. No se le inventa un precio.

Reemplazar la función entera habría cerrado un bug abriendo tres. Lo que se hizo
fue lo mínimo: `filasDe(cartera, vivos)` y `empresaDe(t, px)`, con `px` opcional
— sin argumento, todo se comporta como antes.

### 3. El destello de color: no

Se propusieron dos cosas contradictorias entre ambas respuestas: «nunca un texto
que altere la estructura, reemplazo silencioso» y, después, un flash verde/rojo
en cada cambio. Se quedó lo primero.

El motivo es del proyecto, no estético: la Regla de Oro es que la app **muestra,
no recomienda**. Un destello sobre la plata de alguien cada 45 segundos no es
información nueva —el número ya cambió, ahí está— sino una forma de pedir
atención. Eso es una cinta bursátil, y esto es un cuaderno.

El `tabular-nums` sí entró, que era la parte buena de esa propuesta: el temblor
de la fila es un problema tipográfico y se arregla en el CSS, no congelando el
dato.

### 4. El gráfico de distribución de cartera

Llegó sin pedirse y no entra: el Cuaderno tiene su propio diseño y esto era una
tanda de corrección de bugs. Si en algún momento hace falta, se piensa con el
resto de la pantalla, no como anexo de un arreglo.

---

## La excepción de la edición

Se propuso congelar el valor **mientras el usuario está editando** una posición
(cantidad, costo). Está bien pensada y no se implementó todavía por una razón
concreta: hay que mirar si el número editable y el total están a la vista al
mismo tiempo en cada uno de los formularios del Cuaderno. Si lo están, entra; si
el formulario tapa el total, sería complejidad sin síntoma. Queda anotado como lo
único pendiente de esta ronda.

---

## Los invariantes nuevos

**33 (ampliado)** — la identidad de un registro no puede depender de un atributo
que aparece más tarde. Nació del dedupe de Hechos por PDF, pero vale para
cualquier campo que se agregue después.

**35** — ningún consumidor guarda su propia copia del dato vivo. El proveedor
tiene el estado, las pantallas lo leen. Es la generalización del caché de
`empresaDe()`: pasó dos veces y la segunda costaba plata.

**36** — la valorización se mueve con el mercado, y sin adornos.

---

## Lo que queda abierto

1. **La excepción de la edición** (arriba).
2. **El peso de entrar.** Hoy no hay un solo `import()` dinámico: quien abre el
   Sonar se descarga igual `lecturas.json` (506 KB) y el resto — 6.25 MB para
   todos. Con carga perezosa por ruta cada pantalla baja lo suyo. ¿Ven algún
   riesgo en trocear así una PWA que precachea con service worker? Es la única
   parte donde el troceo podría pelearse con el modo offline, y prefiero
   preguntarlo antes que descubrirlo.
3. **Un cerco de errores por pantalla.** Hoy no hay ninguno: un fallo en el
   Cuaderno se lleva la app entera. ¿Lo pondrían por ruta, o uno solo arriba con
   un mensaje honesto?

---

### Recordatorio de lo ya descartado

Bajar el cron de precios · backfill · paralelizar el cierre · proxy de prensa ·
histórico completo en vivo · defaults que caen a la fuente cruda · estado mutable
en módulos para datos que la UI ve cambiar · exigir que dos series distintas
terminen en la misma fecha · prohibir `.push` en `lib/` · pruebas estructurales
sobre archivos sin puerta · dedupe de Hechos por PDF · reemplazar el motor vivo
por un `setInterval` pelado · destellos de color en la valorización · congelar la
cifra del portafolio.
