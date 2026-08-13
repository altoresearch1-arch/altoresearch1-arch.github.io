# 🔴 Sexta ronda — el quinto bug cerrado, con el conteo de referencias

> Mismo mensaje para los dos. Coincidieron en el criterio y en la arquitectura, y
> se implementó: **almacén único en la raíz, gatillo por consumidores**. Está
> verificado en el navegador, no solo en pruebas. Del código propuesto se tomó la
> forma y se descartaron dos piezas, con el motivo.
>
> **30 pruebas** en vitest (eran 25), 8 en Python, build en verde.

---

## Lo que se hizo

```
lib/hechos.js          NUEVO — la puerta de los Hechos de Importancia
lib/vivoCompartido.jsx NUEVO — almacén único + gatillo por conteo de consumidores
App.jsx                envuelve el árbol en <ProveedorVivo>
Radar.jsx              deja de tener motor propio: useVivo()
HechosImportancia.jsx  useVivo() — la ficha ve lo mismo que el Sonar
radar · vivo · cerebro · cartera · ProduccionMinera → todos por la puerta
INVARIANTES.md         33 y 34
```

**Verificado en el navegador, con documento nuevo en cada caso:**

```
recarga en #/glosario           → 0 llamadas a dataondemand.bvl.com.pe
recarga en #/empresa/ALICORC1   → stock-quote/market + corporate-actions
```

Es exactamente la propiedad que se pedía: la ficha de empresa enciende el motor
porque muestra dato vivo, y una pantalla estática no mantiene ningún ciclo.

---

## Lo que se tomó del código propuesto, y lo que no

### Sí: la forma

Almacén arriba, gatillo por conteo de referencias, `useGatilloVivo` que suma al
montar y resta al desmontar, y **reemplazo silencioso** sin «actualizando…».

Sobre eso último los dos discreparon y se resolvió a favor del reemplazo
silencioso, por un motivo que no estaba en ninguna de las dos respuestas: **la
app ya tiene vocabulario para decir de cuándo es un dato** — el sello de la capa
viva, con sus cinco estados. Meter un texto nuevo que aparece y desaparece cada
45 s sería inventar un segundo canal para decir lo mismo, y encima uno que
empuja el contenido hacia abajo mientras alguien lee.

### No: el motor nuevo

El `arrancarMotor` propuesto era un `setInterval(actualizar, 45000)` pelado. El
motor que ya existe (`useMercadoVivo`) tiene tres cosas que ese perdía:

- **backoff** al fallar (60 → 120 → 300 s): si la BVL se cayó, insistir cada 45 s
  no la levanta;
- **silencio con la pestaña de fondo**: nadie lo está mirando;
- **una sola consulta fuera del horario de rueda**: un domingo a las tres de la
  mañana el mercado no se va a mover.

Así que el conteo de referencias se puso **alrededor** del motor que ya estaba,
no en lugar de él: `useMercadoVivo({ activo: consumidores > 0 })`. Se gana el
gatillo sin perder nada de lo que costó escribir.

Dos detalles más de esa propuesta: el `intervalo` a nivel de módulo se quedaba
con el callback del **primer** suscriptor (si ese componente se desmontaba y otro
seguía vivo, el ciclo llamaba a una función muerta), y con `[actualizarAlmacen]`
en las dependencias, un callback sin memoizar habría desmontado y remontado la
suscripción en cada repintado, haciendo subir y bajar el contador solo.

### No: el dedupe por PDF — pero la advertencia estaba a medias

Se propuso fusionar horneados y vivos usando `h.pdf` como clave. Comprobé el
archivo antes de rechazarlo:

```
Hechos sin PDF en hechos.json: 0 de 1610
```

O sea que **por el lado horneado la clave funcionaría**. El problema está en el
otro lado: el Hecho que llega **en vivo** puede no traer documento todavía
(`bajarHechosVivos` solo pone `pdf` si la BVL ya publicó la ruta), y ese mismo
Hecho, cuando el robot lo hornee, sí lo va a traer. Con el PDF de clave serían
dos registros distintos y el usuario vería su Hecho repetido — precisamente en
el Hecho recién publicado, que es el que motivó todo esto.

La clave es **fecha + texto**, y hay una prueba que lo fija contra un Hecho real
del archivo (con un ticker inventado la lista horneada está vacía y el test pasa
sin probar nada — el primer intento tenía ese defecto).

---

## Las cinco pruebas nuevas

| Prueba | Qué fija |
|---|---|
| El Hecho que solo existe en vivo entra, y encabeza | Es el bug |
| El mismo Hecho por los dos caminos no se duplica, aunque el vivo no traiga PDF | La trampa del dedupe |
| Sin capa viva devuelve exactamente lo del archivo | Que la puerta no cambie el comportamiento de las nueve pantallas que no encienden la red |
| La lista queda ordenada del más nuevo al más viejo | Fusionar dos listas ordenadas no da una lista ordenada |
| **Estructural: solo `lib/hechos.js` importa `hechos.json`** | Que nadie deshaga la decisión, en silencio |

La estructural se pudo escribir porque **primero** se convirtieron los seis
lectores del archivo. Es el orden que se dijo la ronda pasada: primero la puerta,
después el candado. Escribirla antes habría significado dejar el proyecto con
pruebas en rojo.

---

## La única consulta compartida

Se propuso probar que dos consumidores montados a la vez producen **una sola**
consulta. Es la propiedad correcta y sale gratis de la arquitectura elegida: el
motor no vive en los consumidores sino en el proveedor, y el contador solo decide
si corre o no. Dos pantallas montadas suman 2 y el motor sigue siendo uno.

No se escribió como prueba automática todavía porque exige montar componentes de
React —hoy las 30 pruebas son de lógica pura y no hay entorno de DOM— y meter
`jsdom` y `@testing-library` por una sola propiedad parecía caro. Si vuelve a
aparecer una razón, entra con más de una prueba detrás.

---

## Lo que queda

**El precio en el Cuaderno.** Los dos dijeron que sí, que la regla de una sola
frescura alcanza al precio, y que ahí es más grave porque es la plata del
usuario. Está aceptado y es lo siguiente. No entró en esta tanda por una razón
concreta que conviene decir: la valorización pasa por `empresaDe()` en
`lib/cartera.js`, que **cachea en un módulo** el precio y los hechos de cada
empresa. Ese caché es el mismo antipatrón del Bug 3 —dato que cambia donde React
no mira— y hay que quitarlo antes de inyectar nada vivo. Es un cambio sobre el
código que muestra cuánto vale el dinero de alguien y merece su propia pasada,
no ir de contrabando en esta.

**La pregunta de esta ronda:** cuando el Cuaderno pase a precio vivo, la
ganancia/pérdida del usuario va a moverse sola cada 45 s mientras la mira. ¿Eso
se muestra tal cual —es la verdad del mercado— o hay algún motivo para congelar
la cifra mientras está en pantalla y actualizarla solo al entrar? Es la única
parte de todo esto donde el dato correcto puede no ser la mejor decisión de
producto, y me interesa el argumento de los dos.

---

### Recordatorio de lo ya descartado

Bajar el cron de precios · backfill · paralelizar el cierre · proxy de prensa ·
histórico completo en vivo · defaults que caen a la fuente cruda · estado mutable
en módulos para datos que la UI ve cambiar · exigir que dos series distintas
terminen en la misma fecha · prohibir `.push` en `lib/` · pruebas estructurales
sobre archivos que todavía no tienen puerta · dedupe de Hechos por PDF ·
reemplazar el motor vivo por un `setInterval` pelado.
