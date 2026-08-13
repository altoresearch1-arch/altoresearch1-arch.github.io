# 🧱 Quinta ronda — cuatro pruebas más, y cinco propuestas que no pasaron la comprobación

> Mismo mensaje para los dos. De las pruebas estructurales propuestas, **dos
> entraron y se comprobaron en rojo**, y **tres no se pueden escribir hoy** — dos
> porque fallarían con el código actual y una porque contradice una decisión del
> proyecto. Todo con el conteo al lado.
>
> Se pasó de 21 a **25 pruebas** en vitest, más las 8 de Python.

---

## Lo que entró

**1. La marca del dividendo.** Era un hueco real: es la única marca de la firma
que le **quita** valor al movimiento (una acción que cae 4% el día que pagó no se
movió, se le descontó la plata que repartió). Si dejara de salir, el Sonar
volvería a señalar como anomalía pura aritmética del calendario — y el % de caída
seguiría siendo correcto, así que nada en pantalla se vería roto. Hoy la marca
salta en 7 casos de dividendo ya pagado y 15 de fecha ex por venir.

**2. La puerta no tiene reloj.** `new Date()` sin argumentos dentro de
`series.js` haría fallar la prueba. El determinismo es su propiedad más valiosa
ahora que es el único punto de entrada, y un reloj adentro lo rompe de una forma
que ninguna prueba de resultado detecta: pasa hoy y falla en marzo.

**3. Ningún componente hace `fetch`.** Verificado antes de escribirla: hoy hay
**cero** en toda la carpeta `components/`, así que la regla es exigible. Un
`fetch` dentro de un `.jsx` se dispara en cada repintado; la capa viva tiene
backoff, corte con la pestaña de fondo y horario de rueda — un componente que
pida por su cuenta no tiene nada de eso.

**4. Coherencia entre pantallas.** Lo que el Radar muestra como precio es lo
mismo que devuelve el acceso que usa la ficha. Es la propiedad, no el
componente: si divergen, da igual cuál de los dos «acertó».

**Las dos estructurales se probaron en rojo**, que es lo único que las hace
valer: se metió un `new Date()` en la puerta y un `fetch` en `MiLista.jsx`, las
dos fallaron nombrando el archivo, y al revertir volvieron a verde.

---

## Lo que no pasó la comprobación

### 1. Prohibir `.push` / `.splice` / `.pop` en `lib/` — 273 usos legítimos

```
grep -rn "\.push(\|\.splice(\|\.pop(" lib/  →  273
```

Casi todos son acumuladores locales (`filas.push(...)` dentro del bucle que
construye el resultado). Empujar en un array que la propia función acaba de
crear no es un efecto secundario: es cómo se construye una lista. La regla daría
273 falsos positivos el primer día y se desactivaría esa misma tarde, que es el
peor destino posible para una prueba.

### 2. Prohibir `new Date()` en todo `lib/` — no es exigible hoy

```
18 apariciones en 8 archivos: cartera.js, biblioteca.js, enganche.js,
sentinel.js, analista.js, finanzas.js, radar.js
```

La idea es buena y por eso se aplicó **donde sí es cierta** (la puerta).
Extenderla a `radar.js` exige antes pasar el «hoy» por parámetro en `candentes()`
y en `temasDelMundo()`, y eso toca la caché del cruce 🌍 que se acaba de
arreglar. Va como cambio propio, no de contrabando dentro de otro.

Un matiz que conviene no perder: `lib/vivo.js` hace `partesLima(d = new Date())`
— un reloj como **valor por defecto de un parámetro** es justamente el patrón
correcto, porque sigue siendo inyectable. Una prohibición por cadena de texto
también marcaría ese código, que está bien.

### 3. La prueba estructural de `hechos.json` y `precios.json` — todavía no existe qué proteger

```
hechos.json   importado en 5 archivos
precios.json  importado en 7
```

La prueba estructural solo puede escribirse **después** de que exista la puerta:
hoy fallaría al escribirla. El orden importa — primero la puerta, después el
candado. Escribirla ahora sería dejar el proyecto con pruebas en rojo, que es la
forma más rápida de que la gente aprenda a ignorarlas.

### 4. La mezcla de monedas en el Comparador — no aplica

La carrera de dos acciones normaliza cada serie a base 100 antes de dibujar:

```js
const arma = (valores) => { … return vs.map(([f, c]) => [f, (c / base) * 100]) }
```

Un retorno relativo no tiene moneda. Cruzar una acción en dólares contra una en
soles no produce un spread ficticio en ese gráfico: produce exactamente lo que
dice, cuánto se movió cada una respecto de sí misma. (Otra cosa sería un gráfico
de precios absolutos, que no existe ahí.)

### 5. «Verificar que el retorno no se hunda por el dividendo» — contradice el diseño

El precio **sí** cae el día ex, y eso es correcto: es la plata saliendo. La
decisión del proyecto es **marcarlo, nunca ajustarlo** — inventar un cierre que
no existió sería peor que avisar. Una prueba que exija que la ventana «no se
hunda» obligaría precisamente al ajuste que se descartó.

Se tomó el núcleo útil de la idea: en vez de exigir que el número no baje, se
exige que **la marca salga**. Es la prueba 1 de arriba.

---

## Dos cosas en las que hay acuerdo y conviene dejar escritas

**Los defaults hacia la fuente cruda ya son imposibles, no solo desaconsejados.**
Se propuso vigilar que ninguna función de reparación pueda degradarse en silencio
a la serie cruda. Eso ya está cubierto por la estructural que existe: no se puede
caer al archivo si no se puede importar el archivo. Es el efecto secundario más
útil de esa prueba.

**La puerta se mantiene pequeña.** Hace una cosa: construir una serie
consistente. No va a ser además caché de indicadores, formateadora, selectora de
ventana ni normalizadora de fechas — si crece por ahí deja de ser cómoda, y una
puerta incómoda es exactamente cómo vuelven a aparecer los caminos alternativos.
Las cachés que tiene son de **datos inmutables** (el JSON del bundle no cambia
durante la vida de la página); esa es la diferencia con el `Map` de series
reparadas que se descartó, que cachearía algo que sí cambia.

---

## El quinto bug: hay acuerdo en el criterio

Los dos llegaron a lo mismo desde ángulos distintos, y es el criterio que se
adopta: **la aplicación no puede mostrar dos frescuras del mismo dato.** Prometer
tiempo real en el Sonar y entregar el archivo del último despliegue al abrir la
empresa no es una limitación de implementación, es una incoherencia que el
usuario ve.

La arquitectura que se va a seguir es la de separar **almacén** de **gatillo**:
el almacén de datos vivos sube a la raíz de la aplicación; el gatillo se queda
donde está. Con una precisión que sale de cómo funciona el endpoint: la consulta
de Hechos va **sin `rpjCode`** y por eso devuelve el mercado entero en **una sola
llamada** — así que la ficha de empresa abierta directamente no necesita una
consulta individual, dispara exactamente la misma llamada que dispararía el
Radar. Pedir por ticker sería el camino que el proyecto ya descartó (serían 152
llamadas si se generalizara).

**Lo que queda por decidir, y es la pregunta de esta ronda:**

1. Si el almacén vivo sube a la raíz, la app consulta a la BVL cada 45 s aunque
   el usuario nunca abra el Radar. ¿Se acepta eso, o el gatillo debe seguir
   atado a que haya alguna pantalla que de verdad muestre dato vivo?
2. La regla de «una sola frescura» ¿se aplica también al **precio**? Porque
   entonces alcanza a la valorización del Cuaderno, que hoy usa el cierre
   horneado mientras el Radar va en vivo — y eso es la plata del usuario, no un
   indicador.
3. Mientras la llamada está en vuelo, la ficha muestra el dato horneado. ¿Se
   dice en pantalla («actualizando…») o se muestra sin más y se reemplaza cuando
   llega?

---

### Recordatorio de lo ya descartado

Bajar el cron de precios · backfill · paralelizar el cierre · proxy de prensa ·
histórico completo en vivo · defaults que caen a la fuente cruda · estado mutable
en módulos para datos que la UI ve cambiar · exigir que dos series distintas
terminen en la misma fecha · prohibir `.push` en `lib/` · pruebas estructurales
sobre archivos que todavía no tienen puerta.
