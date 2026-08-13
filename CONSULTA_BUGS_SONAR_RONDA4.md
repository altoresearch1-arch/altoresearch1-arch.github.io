# 🧪 Cuarta ronda — las pruebas nuevas, y un quinto bug confirmado

> Mismo mensaje para los dos. De las propuestas de pruebas de la ronda anterior,
> **una era falsa contra los datos reales** y se descartó; el resto entró. Se
> pasó de 12 a 21 pruebas en vitest. Y una de las dos observaciones sobre qué
> otros archivos necesitan la puerta única resultó ser un bug de verdad,
> verificado.
>
> Método de siempre: nada se da por bueno sin comprobarlo contra los datos.

---

## Lo que entró

```
21 pruebas en vitest (eran 12)  ·  8 en python  ·  build en verde
```

**El test estructural es el que más protege.** Recorre `app/src` y falla si
aparece un `import … from '…/data/historicos.json'` fuera de `series.js`. No
prueba un cálculo: prueba que nadie deshaga la decisión de arquitectura, y en
silencio, que es como se deshacen.

Y se comprobó que **muerde**, que es lo único que hace útil a un test así: se
volvió a meter el import a mano en `Sparkline.jsx` y falló nombrando el archivo;
al revertirlo, verde otra vez. Un test estructural que nunca se probó en rojo es
decoración.

**El resto de las que entraron:**

| Prueba | Qué fija |
|---|---|
| El precio de la ficha **es** el último punto de la serie | El gráfico y el número de al lado no pueden venir de sitios distintos. Verificado: se cumple en las 45 filas |
| La serie reparada nunca es más corta que la del archivo | Una optimización futura que se coma dos ruedas dejaría el gráfico idéntico |
| La puerta es **determinista** | Mismas entradas → misma secuencia. Es el único punto de entrada a las series: que dos llamadas difieran haría dudar de todas las pantallas |
| `retornoOffset` no se corre un puesto | 21 cierres planos con un salto puesto a mano; se verifica que la ventana de ayer no se contamine con la rueda de hoy |
| Un titular anterior a la serie no da `NaN` ni `Infinity` | React pinta un `NaN` como texto vacío y el fallo pasa desapercibido |
| La edad del HI no cambia si el «hoy» trae hora | (ver abajo — este destapó un arreglo) |

---

## La sugerencia del huso horario destapó un arreglo real

La propuesta era pasar `2026-08-04T23:55:00-05:00` y exigir `dias === 0`. Se
probó y **con el código de ayer ese test fallaba**: un instante completo son
28h55m contra la medianoche UTC del día del Hecho, redondea a 1, y a las siete
de la tarde de Lima la pantalla habría dicho «hace 1 día» de algo publicado hoy.

Hoy el llamador pasa una fecha suelta, así que no estaba fallando en producción
— pero era una trampa esperando al primer refactor. Ahora `ultimoHecho` recorta
las dos fechas a `YYYY-MM-DD` y las lee como medianoche UTC, y la prueba compara
las 45 filas calculadas con fecha suelta contra las mismas con instante
completo: tienen que dar idéntico.

---

## La que se descartó: era falsa contra los datos reales

> «El Comparador nunca compara ventanas distintas: que ambas series terminen
> exactamente en la misma fecha.»

Ese test habría fallado el día que se escribiera. Medido ahora mismo:

```
fechas de cierre entre las 45 acciones: { "2026-08-03": 42, "2026-07-31": 3 }
```

Tres acciones no negociaron desde el 31-jul, y su serie **debe** terminar ahí:
inventarles una rueda es exactamente lo que prohíbe el invariante #21 (la BVL
repite el último cierre de la que no operó). Que dos series terminen en fechas
distintas no es un bug, es el dato diciendo la verdad.

Lo que sí importaba de esa idea —que las dos series salgan de la misma puerta y
con la misma reparación— ya está garantizado por construcción desde que el
Comparador dejó de leer el archivo crudo. Un test de igualdad de fechas habría
sido peor que ninguno: obligaría a romper el invariante 21 para ponerlo en verde.

---

## 🔴 Quinto bug, confirmado

Una de las dos respuestas dijo que `hechos.json` sí necesita el mismo
tratamiento, porque existe una versión viva que puede entrar en conflicto con la
horneada. La otra dijo que no, porque «todos consumen exactamente el mismo
archivo». **La primera tiene razón, y se verificó:**

```js
// components/HechosImportancia.jsx:79 — la lista de Hechos de la ficha de empresa
const h = hechosData.hechos?.[ticker]     // ← solo el archivo horneado
```

La capa viva baja los Hechos de Importancia del endpoint de la BVL cada 45 s,
pero **solo el Radar los ve**. La ficha de empresa lee el archivo del bundle,
que únicamente cambia cuando se vuelve a publicar la web. Resultado: el Sonar
puede estar mostrando «📄 HI 07:08» de una empresa y, al abrir esa misma
empresa, su lista de Hechos no lo tiene. El mismo dato, dos frescuras, dos
pantallas — que es la definición exacta del Bug 1.

No se arregló en esta tanda y conviene decir por qué: la ficha de empresa **no
tiene capa viva**. Meter una puerta `hechosDe(ticker, {vivos})` no arregla nada
por sí sola si nadie le pasa los vivos; hace falta decidir antes si la capa en
vivo sube al nivel de la aplicación (y entonces consulta la BVL aunque el
usuario nunca abra el Radar) o si se queda donde está. Esa decisión es el
verdadero contenido del arreglo, y va para la próxima ronda.

**El criterio queda claro y coincide con lo que dijeron los dos:** la puerta
única no se extiende por simetría, sino allí donde **existe una segunda
representación más fresca del mismo dato**. Con esa vara: `hechos.json` sí (hay
versión viva), `dividendos.json` no (no existe un dividendo intradía),
`precios.json` es el caso a mirar — no por el acceso al JSON, sino por si alguna
pantalla muestra rentabilidad actual con el cierre de ayer mientras el Radar va
en vivo.

---

## Sobre el determinismo

Se convirtió en prueba. Y hay un matiz que conviene dejar dicho: la puerta usa
cachés internas (la serie cruda y los metadatos se leen una vez por ticker),
pero son cachés de **datos inmutables** — el JSON del bundle no cambia durante
la vida de la página. Eso es lo que las hace compatibles con el determinismo, y
es justo lo que **no** se cumplía en la propuesta del `Map` de series reparadas:
ese cachearía algo que sí cambia cuando entra un precio nuevo.

---

## Las preguntas de esta ronda

1. **Sobre el quinto bug:** ¿subir la capa viva al nivel de la aplicación —y
   consultar la BVL aunque el usuario nunca abra el Radar— o dejarla donde está
   y aceptar que la ficha de empresa muestre Hechos con el rezago del
   despliegue? Interesa el criterio, no la implementación.
2. **Sobre las 21 pruebas:** ¿queda algún hueco donde romper algo produzca
   números plausibles? El test estructural cubre `historicos.json`; el resto son
   propiedades de la serie y de las ventanas.
3. **Una duda propia:** el test estructural es la primera regla del proyecto que
   se hace cumplir con una prueba en vez de con un documento. ¿Hay más
   invariantes de INVARIANTES.md que se puedan volver estructurales así — que no
   comprueben un resultado sino una forma del código?

---

### Recordatorio de lo ya descartado

Bajar el cron de precios · backfill · paralelizar el cierre · proxy de prensa ·
histórico completo en vivo · defaults que caen a la fuente cruda · estado mutable
en módulos para datos que la UI tiene que ver cambiar · exigir que dos series de
acciones distintas terminen en la misma fecha.
