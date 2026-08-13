# 🔎 Consulta — tres bugs del Sonar (para una segunda opinión)

> **Qué es esto.** Un pedido de revisión para otro modelo (GPT, Gemini) sobre tres
> bugs concretos del Sonar de ALTO Research. Está escrito para que se pueda
> contestar **sin tener el repo delante**: cada bug trae el código pegado, la
> evidencia medida contra los datos reales del 4-ago-2026, y las reglas del
> proyecto que la propuesta no puede romper.
>
> **Por qué se escribe así.** El 3-ago-2026 dos revisiones de arquitectura
> propusieron dieciocho mejoras leyendo solo la documentación descriptiva, y
> varias eran destructivas — no porque el razonamiento fuera malo, sino porque el
> documento contaba *qué hace* el sistema y no *por qué está como está*. Por eso
> abajo van los invariantes pegados: no como burocracia, sino porque son lo único
> que separa una mejora de una regresión con buena intención.
>
> **Qué se busca.** No confirmación. Se busca: ¿el diagnóstico está bien?, ¿el
> arreglo propuesto rompe algo?, ¿hay una tercera forma mejor?, ¿qué se está
> pasando por alto?

---

## 0. El contexto mínimo para entender los tres

**Qué es el Sonar.** Una pantalla que dibuja las ~45 acciones que de verdad se
negocian en la Bolsa de Lima. Distancia al centro = cuánto se salió la acción de
su propio vaivén (retorno ÷ su volatilidad escalada al plazo). Ángulo = sector.
Tamaño = cuánto se movió en %. La app **describe lo que ya pasó, no recomienda ni
predice**.

**De dónde salen los datos — y esto es la raíz de dos de los tres bugs.** Hay dos
caminos:

```
EN VIVO  (navegador → API de la BVL, que permite CORS)
         precio cada 45 s · Hechos de Importancia · ruedas faltantes del histórico

ROBOT    (GitHub Actions → commit al repo → la app lo lee)
         prensa, dividendos, fundamentos, y el histórico de cierres completo
```

El archivo de cierres (`historicos.json`) **solo se rehace en la corrida de cierre
de las 22:23**, y el cron de GitHub es «mejor esfuerzo» — el 3-ago se saltó 25
turnos programados seguidos. Así que el archivo se queda ruedas atrás con
frecuencia. Para que los plazos no midan mal, `filasRadar()` **repara la serie en
memoria** antes de calcular nada:

```js
// lib/radar.js — dentro de filasRadar()
const base    = conCola(guardadas, cola?.[ticker])   // ruedas que el robot no guardó
const px      = vivos?.[ticker] || preciosData.precios?.[ticker]
const valores = conUltimoPrecio(base, px)            // + el precio de hoy
```

**Estado real al 4-ago-2026** (medido, no supuesto):

```
última fecha en historicos.json : 2026-07-30
última fecha en precios.json    : 2026-08-03
contactos del Radar con el histórico atrasado: 45 de 45
```

Es decir: **el archivo va 3 ruedas atrás y la serie reparada va al día.** Todo lo
que lea el archivo crudo en vez de la serie reparada está midiendo contra otro
mercado.

---

## 🐞 Bug 1 — el «+X% desde el titular» se mide contra una serie vieja

### El código

```js
// lib/radar.js:630
export function noticiasConEfecto(ticker, ruedas) {
  const h = historicosData.historicos?.[ticker]        // ← ARCHIVO CRUDO
  const vals = (h?.valores || []).filter(([, v]) => v > 0)
  if (vals.length < 2) return []
  const ultimo = vals[vals.length - 1][1]              // ← cierre del 30-jul
  const idxIni = Math.max(0, vals.length - 1 - ruedas)
  const fechaIni = vals[idxIni][0]

  return noticiasDe(ticker).map((n) => {
    // Cierre del día del titular (o el hábil anterior si salió en fin de semana)
    let base = null, baseFecha = null
    for (const [f, v] of vals) {
      if (f > n.fecha) break
      base = v; baseFecha = f
    }
    return {
      ...n,
      dentroDeVentana: n.fecha >= fechaIni,
      desdeElTitular: base ? (ultimo / base - 1) * 100 : null,   // ← el número que sale en pantalla
      baseFecha,
    }
  })
}
```

Esa función alimenta el bloque «⚠ Tal vez esté subiendo por esto», que muestra
`+X% desde el titular` al lado de cada nota. La misma ficha, tres centímetros más
arriba, muestra el retorno del plazo calculado con la **serie reparada**.

### La evidencia (4-ago-2026)

```
VOLCABC1   histórico 0.795 (30-jul)   precio 0.85  (3-ago)   →  6.92 puntos de diferencia
CORAREI1   histórico 1.421            precio 1.51            →  6.26
FIBPRIME   histórico 6.506            precio 6.91            →  6.21
CASAGRC1   histórico 9.5              precio 8.97            → −5.58
BVN        histórico 31.72            precio 30.43           → −4.07
```

Los 45 contactos, sin excepción. O sea: la tarjeta puede decir «+9.4%» arriba y
«+2.5% desde el titular» abajo, calculados desde cierres distintos, sin que nada
en pantalla lo advierta.

### El invariante que esto viola

> **#25. La gráfica y el número no pueden contradecirse.** `SonarGrafica` dibuja
> `fila.serie`, **la misma** de la que salen el `%` y la fuerza. Si alguna vez no
> coinciden, el bug está en la serie, no en el dibujo.

El espíritu es el mismo aunque la letra hable de la gráfica: dos números
derivados del precio, uno al lado del otro, no pueden venir de series distintas.

### El arreglo que se me ocurre (critíquenlo)

`filasRadar()` ya construye `valores` reparado por ticker; hoy solo se exporta
recortado a 24 puntos (`serie: valores.slice(-24)`, suficiente para dibujar el
plazo más largo de 20 ruedas). La idea es pasarle a `noticiasConEfecto` la serie
reparada en vez de que lea el módulo.

### Lo que hay que resolver, y donde quiero otra opinión

1. **Los 24 puntos no alcanzan.** Un titular puede ser más viejo que la serie
   recortada: la función busca el cierre *del día del titular* recorriendo toda la
   historia. ¿Se expone la serie completa reparada (45 tickers × ~390 cierres, ya
   están en memoria), se recorta a un largo mayor, o se resuelve de otra forma?
2. **¿Parámetro o estado de módulo?** Pasarla por parámetro mantiene la función
   pura y testeable, pero hay que enhebrarla por dos componentes. Guardarla en un
   módulo (como se hace con `NOTICIAS`) es menos código y más acoplamiento.
   ¿Cuál conviene acá?
3. **¿Qué más lee el archivo crudo?** Encontré también `series()` /
   `historiaDelPlazo()` en el mismo archivo — pero esas miran 18 meses hacia
   atrás, donde 3 ruedas no cambian nada, así que las dejo. **No audité
   `lib/finanzas.js`, que también importa `historicos.json`.** ¿Qué otros lugares
   heredan este desfase?

---

## 🐞 Bug 2 — un Hecho de Importancia publicado antes de la apertura desaparece

### El código

```js
// lib/radar.js:298
function ultimoHecho(ticker, hoyISO, hechosVivos) {
  const guardado = hechosData.hechos?.[ticker]?.hechos?.[0]
  const fresco = hechosVivos?.[ticker]?.[0]
  const h = fresco?.fecha && (!guardado?.fecha || fresco.fecha >= guardado.fecha)
    ? fresco : guardado
  if (!h?.fecha) return null
  const dias = Math.round((new Date(hoyISO) - new Date(h.fecha)) / 86400000)
  return {
    fecha: h.fecha, titulo: h.titulo || '', categoria: h.categoria || '',
    pdf: h.pdf || null, hora: h.hora || null, envivo: !!h.envivo,
    dias: isFinite(dias) && dias >= 0 ? dias : null,     // ← negativo se vuelve null
  }
}
```

Y el llamador le pasa como «hoy» **la fecha del último cierre**, no la fecha real:

```js
// lib/radar.js:496 — dentro de filasRadar()
hecho: ultimoHecho(ticker, fechaCierre, hechosVivos),
```

Todos los consumidores filtran por `dias != null`:

```js
// components/RadarSonar.jsx:450
{c.hecho?.dias != null && c.hecho.dias <= 12 && ( … el distintivo «📄 HI 07:08» … )}

// lib/radar.js:688 — dentro de candentes()
hecho: f.hecho?.dias != null && f.hecho.dias <= diasNoticia ? f.hecho : null,
```

### Por qué falla

Si el Hecho es **posterior** a la última sesión de esa acción, `dias` sale
negativo → `null` → el Hecho **desaparece de toda la pantalla**. Los dos casos en
que pasa:

- **Antes de la apertura (8:00–9:00 hora de Lima).** Ninguna acción negoció
  todavía, así que `fechaCierre` es de ayer y cualquier HI de hoy queda invisible.
  Es exactamente el caso que el proyecto usa como bandera: *el 3-ago-2026 Alicorp
  publicó la compra de los activos de Unilever a las 07:08*, y la capa en vivo
  existe justamente para mostrar eso a los segundos. A esa hora, con este código,
  no se muestra.
- **Fin de semana y feriados.** Medido: de 1,610 Hechos guardados, **9 salieron
  sábado o domingo**. Poco, pero no cero.

### Lo que NO está fallando (para que nadie arregle de más)

Con los datos horneados de hoy, **0 de los 45 contactos** pierden su Hecho: el
precio de `precios.json` (3-ago) empuja `fechaCierre` por delante de las fechas de
los HI. El bug es de la ventana pre-apertura y del fin de semana, no permanente.
Dicho de otra forma: es latente y golpea justo en el momento de más valor.

### Dónde quiero otra opinión

1. **¿Qué reloj?** Medir contra «hoy de verdad» mete una dependencia temporal en
   una función que hoy es determinista (mismo archivo → mismo resultado, siempre).
   ¿Se pasa `hoy` como parámetro desde el componente para que siga siendo pura?
   ¿O basta con recortar el negativo a 0?
2. **¿Qué se muestra?** «hace 0 días» es mentira si el HI salió a las 07:08 y la
   rueda todavía no abrió. El proyecto ya prefiere mostrar la hora cuando la
   tiene («📄 HI 07:08»). ¿Hay una etiqueta mejor para «esto salió después del
   último cierre»?
3. **Relojes mezclados.** `candentes()` decide qué titulares son frescos con
   `new Date()` real, mientras el Hecho se mide contra `fechaCierre`. Dos relojes
   en la misma función. ¿Unificar en cuál?

---

## 🐞 Bug 3 — el marcador 🌍 se congela con la prensa del bundle

### El código

La prensa tiene dos orígenes: la copia horneada en el bundle y una **más nueva**
que la app baja del repo cada 5 minutos. Al entrar una copia nueva hay que
invalidar el cruce mundo→ticker, y eso el módulo lo hace bien:

```js
// lib/radar.js:70
export function usarNoticiasFrescas(doc) {
  if (!doc?.porEmpresa || !doc.generado) return false
  if (NOTICIAS.generado && doc.generado <= NOTICIAS.generado) return false
  NOTICIAS = doc
  cacheMundoTk = null          // ✅ el cruce mundo→ticker se arma de estos titulares
  return true
}
```

El componente, en cambio, cachea el Set derivado **para siempre**:

```js
// components/RadarSonar.jsx:198
const tocadasPorElMundo = useMemo(() => tickersTocadosPorElMundo(), [])   // ← deps vacías
```

El padre sí se entera de la prensa nueva y la mete en sus dependencias, pero ese
contador nunca llega al hijo:

```js
// components/Radar.jsx:58
const prensa = useNoticiasFrescas()          // sube de número con cada copia nueva
const { filas, … } = useMemo(() => filasRadar(vivo.precios, vivo.hechos, cola),
                             [vivo.precios, vivo.hechos, cola, prensa])
…
<RadarSonar filas={filas} ruedas={ruedas} plazo={plazo} vivo={vivo} … />   // sin `prensa`
```

Resultado: durante toda la visita, el distintivo 🌍 («hay noticias de afuera que
pueden llegarle a esta acción») refleja los titulares con los que se compiló el
sitio, aunque hayan entrado tres copias nuevas de prensa.

### El invariante en juego

> **#22. La prensa nunca retrocede.** Solo se acepta una copia con `generado` más
> nuevo que el que ya se usa. Y al entrar una nueva hay que invalidar
> `cacheMundoTk`, o el 🌍 seguiría cruzando titulares viejos.

El invariante está cumplido en el módulo y burlado en el componente.

### Dónde quiero otra opinión

El arreglo obvio es pasar `prensa` por props y meterlo en las dependencias. Es
correcto pero es enhebrar un contador solo para decir «algo cambió allá adentro».
¿Hay una forma más limpia sin convertir esto en una máquina de estado — que
`mundoDe()` devuelva su versión, un `useSyncExternalStore`, otra cosa? ¿O el
contador es simplemente lo correcto y no hay que darle más vueltas?

---

## 🚧 Las reglas que la propuesta NO puede romper

Estos son los invariantes del proyecto que tocan esta zona. Están abreviados; cada
uno existe porque algo se rompió de verdad.

| # | Regla | Por qué |
|---|---|---|
| 1 | `intradia.json` no se puede reconstruir hacia atrás | El API de la BVL solo sabe de hoy. Cada corrida que no se guarda es un día perdido para siempre. **Por eso el cron de precios de 10 min no se toca.** |
| 2 | Un archivo de datos nunca se sobrescribe con menos de lo que tenía | La BVL respondió `200` con `content: []` una mañana entera y el extractor escribió `precio: null` sobre 152 empresas |
| 17 | `200` con `content: []` es un **estado**, no un fallo | Le pasa a la BVL de verdad; su propia web dice «no hay datos disponibles» |
| 18 | Nunca usar `sell` como precio | `sell` es la orden parada en pantalla, no una transacción. El precio es `last`, con caída a `previous` |
| 19 | El CORS no existe fuera del navegador | Que 16 de 18 medios bloqueen al navegador no dice nada sobre leerlos desde Python. El robot es la solución, no el problema |
| 20 | El filtro `pocoNegociada` no se puede quitar | De 114 acciones, 82 tienen el precio congelado. Sin el filtro, GRHOLDC1 aparecía con **+674% en 20 días** habiendo cambiado de precio 2 veces en el mes |
| 21 | A la acción que no negoció **no** se le inventa un día | La BVL repite el último cierre; estamparlo como si fuera de hoy inventaría una rueda que no existió |
| 22 | La prensa nunca retrocede | (ver Bug 3) |
| 24 | Los sectores usan **mediana**, no promedio | Con 2 o 3 nombres por sector, un caso raro cuenta una película que no pasó |
| 25 | La gráfica y el número no pueden contradecirse | (ver Bug 1) |
| 26 | Todo en pasado y en modo descripción | «Se movió», nunca «va a subir». La app **muestra, no recomienda** |
| 27 | Lo medido va separado de lo hipotético | Mezclarlas le daría a una hipótesis el mismo peso visual que a un hecho |
| 28 | Nunca «porque», siempre «puede» | Se midieron 2,259 titulares de un año contra los cierres: ni los titulares de la propia empresa predicen su cierre |

### Propuestas ya evaluadas y descartadas — no hace falta repetirlas

- ❌ «Como el cliente ya trae el precio en vivo, bajen el cron de precios a 30–60
  min» → borraría la resolución intradía de forma permanente (invariante 1).
- ❌ «Añadan una rutina de *backfill* para los días faltantes» → `fetch_historicos`
  rehace la serie completa desde enero del año anterior; es idempotente, un día
  perdido se recupera solo.
- ❌ «Paralelicen los pasos del cierre» → la SMV se atora con sesiones simultáneas
  y ya falló así una vez.
- ❌ «Monten un proxy para leer la prensa desde el navegador» → convierte «un repo
  que se actualiza solo» en «un servicio que hay que mantener».
- ❌ «Traigan el histórico en vivo cada vez» → son 115 llamadas por corrida contra
  un API ajeno para refrescar cierres que intradía no cambian.

---

## 📋 Lo que se pide contestar

1. ¿El diagnóstico de cada bug es correcto? Si alguno está mal, díganlo con el
   contraejemplo.
2. Para cada uno: ¿el arreglo propuesto rompe algún invariante de la tabla? ¿Hay
   una forma mejor?
3. Las preguntas abiertas de cada sección (serie completa vs. recortada; qué reloj
   usa `ultimoHecho`; cómo se entera el hijo de la prensa nueva).
4. **¿Qué se está pasando por alto?** Los tres bugs salieron de leer el código con
   los datos reales al lado. Si hay un cuarto en la misma zona, es más valioso que
   una mejor versión de estos tres.
5. **Cómo verificar la respuesta.** El proyecto **no tiene ningún test** — los 28
   invariantes viven solo en prosa, y esa es la razón de fondo por la que una
   revisión bien intencionada puede romper algo sin enterarse. Si su propuesta se
   puede fijar con una prueba, escríbanla.

### Para reproducir la evidencia

Desde la carpeta `app/`, con Node:

```bash
node -e "
const fs=require('fs');
const H=JSON.parse(fs.readFileSync('src/data/historicos.json','utf8')).historicos;
const P=JSON.parse(fs.readFileSync('src/data/precios.json','utf8')).precios;
const E=new Set(JSON.parse(fs.readFileSync('src/data/empresas.json','utf8')).empresas.map(e=>e.ticker));
for(const [tk,h] of Object.entries(H)){
  if(!E.has(tk)||h.pocoNegociada) continue;
  const v=(h.valores||[]).filter(x=>x[1]>0); if(v.length<21) continue;
  const ult=v[v.length-1], px=P[tk]; if(!px||!(px.precio>0)) continue;
  const ses=(px.ultimaOperacion||'').slice(0,10)||px.fecha;
  if(ses>ult[0]) console.log(tk, ult[0], ult[1], '->', ses, px.precio,
    ((px.precio/ult[1]-1)*100).toFixed(2)+'%');
}"
```
