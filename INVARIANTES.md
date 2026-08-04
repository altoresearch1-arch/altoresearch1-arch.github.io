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

### 7. `fetch_historicos.py` rehace la serie COMPLETA desde enero del año anterior
```python
inicio = date(hoy.year - 1, 1, 1)   # fetch_historicos.py
```
Es idempotente, no incremental. **Un día perdido se recupera solo** en la
siguiente corrida buena.

> ❌ *"Añadan una rutina de backfill que recupere los días faltantes"* — resuelve
> un problema que este repo no tiene.

### 8. `fetch_historicos` NO va en el intradía
Son 115 llamadas por corrida (~5,520 diarias) contra un API que no es nuestro,
para refrescar **cierres que intradía no cambian**. El dato vivo ya viene en
`precios.json` y en la capa del navegador.

### 9. La red dirigida de Google News corre SOLO en el cierre
Son ~95 consultas por corrida. En intradía serían ~4,560 diarias y Google corta
mucho antes — y llegaría tarde igual, porque tarda en indexar. El barrido de
portadas RSS (13 feeds) sí corre cada 10 min: son ~15 s.

### 10. Los pasos del cierre son secuenciales a propósito
La SMV se atora con sesiones simultáneas y `fetch_anual_eps` ya falló una vez
así. **No paralelizar.**

### 11. Un archivo de estado por robot, nunca uno compartido
Los modos corren en runs **separados** de GitHub Actions y se solapan. Con un
archivo único, dos runners haciendo pull/push casi a la vez chocan.

### 12. Todo lo que deba viajar al repo vive bajo `app/src/data/`
El workflow commitea con `git add app/src/data …`. Cualquier cosa fuera de ahí
se escribe en el runner y **se pierde al terminar el job**.

---

## 🌐 Los endpoints de la BVL (comprobados el 3-ago-2026)

### 13. `Content-Type` debe ser `application/json`
Con `text/plain` —que evitaría el preflight— el endpoint responde **415**.

### 14. El preflight NO lista `POST` y funciona igual
`Allow-Methods: GET,OPTIONS,PUT,DELETE,PATCH`. Pasa porque `POST` es un método
*safelisted* del estándar CORS. **Si algo falla, el método no es el problema.**

### 15. `startDate` de `share-values` es EXCLUSIVO
Pedir desde el 31 devuelve `[]`; pedir desde el 30 devuelve el 31. Sumarle un
día a la última fecha guardada se salta justo la rueda que falta.

### 16. `200` con `content: []` es un ESTADO, no un fallo
Le pasa a la BVL de verdad; su propia web muestra "no hay datos disponibles".
Tratarlo como error dispara alarmas falsas; tratarlo como dato bueno corrompe
archivos.

### 17. Nunca usar `sell` como precio
`sell` es la orden de venta parada en pantalla, **no una transacción**. El precio
es `last`, con caída a `previous` cuando no negoció.

### 18. CORS no existe fuera del navegador
Que 16 de 18 medios bloqueen al navegador **no dice nada** sobre leerlos desde
Python. El robot los lee sin problema: por eso el robot es la solución, no el
problema.

---

## 📡 El Radar

### 19. El filtro `pocoNegociada` no se puede quitar
De 114 acciones, 82 tienen el precio congelado; la BVL repite el último cierre
cuando nadie operó. Sin el filtro, GRHOLDC1 aparecía con **+674% en 20 días**
habiendo cambiado de precio 2 veces en el mes.

### 20. A la acción que no negoció NO se le inventa un día
En `conUltimoPrecio()`: si la fecha de sesión es **anterior** al último cierre
guardado, no se toca nada. La BVL repite el cierre viejo, y estamparlo como si
fuera de hoy inventaría una rueda que no existió.

### 21. La prensa nunca retrocede
Solo se acepta una copia con `generado` **más nuevo** que el que ya se usa. Y al
entrar una nueva hay que invalidar `cacheMundoTk`, o el 🌍 seguiría cruzando
titulares viejos.

### 22. Dentro de una cuña, el ángulo NO significa nada
Es una semilla estable (`semilla(ticker)`) para que los tickers no se monten,
nada más. El ángulo codifica **sector** y solo eso.

Por eso al abrir una cuña se puede repartir ese sector en los 360° enteros sin
perder información: si estás mirando un solo sector, esa codificación es
redundante. Es lo que lleva la separación mínima entre contactos de **0.5° a
32.7°** en minas.

> Si alguna vez le das significado al ángulo dentro de la cuña, la expansión
> deja de ser honesta y hay que quitarla.

### 23. Los sectores usan MEDIANA, no promedio
Con 2 o 3 nombres por sector, un caso raro cuenta una película que no pasó.

### 24. La gráfica y el número no pueden contradecirse
`SonarGrafica` dibuja `fila.serie`, **la misma** de la que salen el `%` y la
fuerza. Si alguna vez no coinciden, el bug está en la serie, no en el dibujo.

---

## 🎯 Tono (la Regla de Oro del proyecto)

### 25. Todo en pasado y en modo descripción
"Se movió", nunca "va a subir". "Mira", nunca "compra". La app **muestra, no
recomienda**.

### 26. Lo medido va separado de lo hipotético
El 🌍 mundo lleva otro rótulo que la firma **a propósito**: la firma trae su
cuenta sacada de los cierres, el mundo son cadenas escritas a mano sin medir
contra el precio. Mezclarlas le daría a una hipótesis el mismo peso visual que a
un hecho, y esa es justo la confusión que el Radar existe para evitar.

### 27. Nunca "porque", siempre "puede"
Que el precio subiera después del titular no significa que subiera **por** el
titular. `estudio_noticias.py` midió que ni los titulares de la propia empresa
predicen su cierre.

---

## Cómo mantener esto vivo

Cuando cierres un bug o tomes una decisión que **costó descubrir**, añádela aquí
con su evidencia. Un invariante sin su porqué se borra en la siguiente
refactorización; con su porqué, se respeta.

Y si algún invariante deja de ser cierto, **bórralo** — una regla falsa hace más
daño que ninguna regla.
