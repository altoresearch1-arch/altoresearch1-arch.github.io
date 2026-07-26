# Prueba de papel — H0 (la prueba del dedo)

*Material listo para imprimir y salir a probar. Es el brazo operativo del [Protocolo de Transformaciones Cognitivas](PROTOCOLO_TRANSFORMACIONES_COGNITIVAS_ALTO.md) y alimenta directamente el [Diario de Hipótesis](DIARIO_DE_HIPOTESIS.md). Se corre en la **MISMA sesión** y con las **MISMAS 10 personas** que la [Prueba de papel H1/H2](PRUEBA_DE_PAPEL_H1_H2.md) — H0 va **primero**, en frío, antes de mostrar ninguna tarjeta del PTC. Aquí no se decide si el home "gusta": se mide si **el home actual tiene o no jerarquía**. Nada más.*

> **Qué mide H0:** el **punto de partida**. El home de HOY, tal como está en vivo, contra el cual se va a comparar el rediseño del PTC. **No es una pantalla del PTC** — es la línea base. Si no medimos dónde estamos parados, cualquier "mejora" futura será una opinión, no un avance.

---

## 0 · La inversión honesta de H0 (leer DOS veces antes de mostrar nada)

**Esto es lo más fácil de leer al revés. Léelo despacio.**

En H1 y H2, *confirmar* la hipótesis es una buena noticia: la pantalla funciona. **En H0 es al revés.**

- **H0 CONFIRMADA = nuestro home actual FALLA.** Confirmar significa que el home **no tiene jerarquía**: cada persona toca algo distinto porque nada manda, nada responde una duda concreta. Eso es exactamente lo que **justifica el rediseño del PTC**. Confirmar H0 es darle la razón al proyecto de rediseño.
- **H0 REFUTADA = el home actual YA concentra la atención.** Refutar significa que un mismo destino se repite en la mayoría de dedos: **ya hay jerarquía**, el home ya empuja hacia un lado. Eso **también es dato valioso** — significaría que el problema del home no es la falta de jerarquía sino otra cosa, y que el rediseño debe apuntar a otro lado.

> **No hay "resultado malo".** Confirmada nos dice *rediseña, tenías razón*. Refutada nos dice *el home ya jerarquiza, el diagnóstico estaba mal, mira otra cosa*. Las dos enseñan. Lo único que sería un fracaso es administrar la prueba sesgando el dedo de la gente.

Esto ya está pre-registrado en el Diario (fila H0, pre-registro 2026-07-23). Se reproduce aquí para que quien administre **no cambie la predicción a media prueba**:

- **H0** — *El home actual no tiene jerarquía: presenta ALTO en vez de responder una duda del usuario.*
  Test: 10 personas, *"toca lo primero que te parezca importante"*, sin explicar nada.
  **Predicción: ≥6 destinos DISTINTOS entre 10 → sin jerarquía → H0 CONFIRMADA.**
  **Si un mismo destino se repite en ≥6/10 → hay jerarquía → H0 REFUTADA.**

---

## 1 · Qué pantalla se muestra (esto decide si mides bien o mides basura)

Un usuario nuevo **no ve el home de golpe**. La secuencia real de la app es:

1. **BIENVENIDA** a pantalla completa (`Bienvenida.jsx`) — logo + titular *"Aquí se aprende a estudiar empresas de la Bolsa de Lima"* + 3 caminos rankeados.
2. **LECCIÓN EXPRÉS** opcional (5 tarjetas de 15 s) si toca el 🐣.
3. **RECIÉN AHÍ** aparece la **PANTALLA PRINCIPAL / "inicio"** (bloque `vista === 'inicio'` en `App.jsx`), con nivel ya fijado (por defecto nivel 2, "Aprender").

Hay **dos pantallas candidatas** y es fácil medir la equivocada:

| | **(A) BIENVENIDA** | **(B) PANTALLA PRINCIPAL / "inicio"** ← la correcta |
|---|---|---|
| Qué es | Lo primero que ve un usuario nuevo | El home "de verdad", tras bienvenida/lección |
| ¿Tiene jerarquía? | **Sí** — un titular y 2-3 caminos rankeados | **No** — ~10 destinos en paralelo |
| ¿Responde una duda? | **Sí** — *"¿qué es esto y por dónde entro?"* | **No** — presenta ALTO sin preguntar nada |
| ¿Sirve para H0? | **NO.** Mediría otra cosa. | **SÍ. Esta es la pantalla-home de H0.** |

**Recomendación (obligatoria): mostrar la PANTALLA PRINCIPAL (B), no la bienvenida.**

**Motivo:** H0 dice literalmente *"presenta ALTO en vez de responder una duda"*. La bienvenida **sí** responde una duda y **sí** rankea sus opciones — probarla mediría una hipótesis que nadie pre-registró. La pantalla que de verdad *"presenta ALTO con muchas opciones sin responder una sola duda"* es la principal: cinta BVL, moneda-fidget con el logo gigante, hero + quiz, 4 atajos, buscador, portada del Cuaderno, "Así cerró la BVL", empresa del día, más las flotantes Mentor y Apóyame. **Ahí** es donde el dedo tiene que elegir.

**Cómo entrar directo a (B) para el test en frío:**
- En la bienvenida, tocar **"Solo quiero mirar la app →"** (hace `setNivel(2)` directo, salta la lección), **o**
- Tener el `localStorage` ya marcado con un nivel (usuario que "ya pasó" bienvenida + lección).
- Así la **primera** pantalla que ven las 10 personas es la principal, en **nivel 2** (orden hero-primero).
- **Ojo:** en frío **no** saldrán ni la `PuertaTardia` (banner de niveles) ni "Mi lista ★" — esos solo aparecen si el usuario ya vio una ficha o guardó un favorito. Correcto: el test es en frío.

**Antes de sentar a la primera persona:** deja el celular/pantalla **ya abierto en (B)**, arriba del todo (sin scroll), con la primera visita "fresca" para que el globo del Mentor aparezca como aparecería de verdad. Entre persona y persona, **recarga y vuelve a subir al tope** para que todas vean lo mismo.

### Captura del home actual (imprimir y tener al lado)

Imprime o ten a la mano una **captura de la pantalla principal (B)** tal como la verá la gente, para (a) verificar que estás mostrando la pantalla correcta y (b) marcar sobre ella a qué destino apuntó cada dedo.

```
[pegar aquí la captura del home actual]
```

*(La captura se genera aparte y se adjunta a este documento. Debe ser la vista "inicio" en nivel 2, en celular, arriba del todo.)*

---

## 2 · Ficha PTC — H0

| | |
|---|---|
| **Hipótesis (falsable)** | El home actual no tiene jerarquía: presenta ALTO en vez de responder una duda del usuario. |
| **Creencia (nuestra, la que se pone a prueba)** | *"Nuestro home ya guía al usuario a lo importante."* H0 la desafía: sospechamos que **no** guía, que reparte la atención. |
| **Qué mediría** | La **dispersión del primer toque**. Si 10 dedos van a 10 lugares distintos, no hay jerarquía. Si convergen en uno, sí la hay. |
| **Comportamiento observado** | El **primer destino** que cada persona toca en frío, sin instrucción de qué buscar. |
| **Rol en el PTC** | **Línea base.** No instala ningún modelo — retrata el punto de partida contra el que se comparará el home rediseñado. |

> **Contraste con H1/H2:** en H1/H2 el comportamiento se mide *después* (prototipo clickable) y la tarjeta *declara* un modelo. En H0 el comportamiento **es** la medida y se toma **ahora**, sobre el producto real, sin tarjeta.

---

## 3 · Logística (idéntica a H1/H2 — mismas personas, misma sesión)

**A quién probar — 10 personas FRÍAS.** Es lo que más contamina el resultado si se descuida:

- **Nada de gente de finanzas.** Alguien que ya sabe leer una app de bolsa "sabe" a dónde ir — eso fabrica jerarquía que no existe para un novato.
- **Nada de amigos cercanos que te quieran quedar bien.** Tocan lo que creen que "quieres" que toquen.
- **Mezcla de edades y oficios.** Alguien que nunca abrió una cuenta en la bolsa es el usuario correcto.
- **Que no hayan visto ALTO antes.**

**Cómo:**

- **Uno a uno.** Nunca en grupo (se copian el dedo).
- **No expliques NADA.** No digas qué es ALTO, no digas para qué sirve, no señales nada con la mano. Tu trabajo es *callar y anotar*.
- **La consigna EXACTA, palabra por palabra:**

> ## *"Toca lo primero que te parezca importante."*

- **Y silencio.** No agregues "…de esta pantalla", no agregues "lo que más te llame". Solo esa frase. Luego callas y esperas.
- **Anota a qué destino apuntó el dedo** (usa los nombres de la lista de abajo / marca sobre la captura).
- **Opcional, una sola repregunta neutral tras el toque:** *"¿Por qué ese?"* → anota la frase literal. **Nunca** *"¿no te llamó más el otro?"* (eso le mueve el dedo).
- **~1-2 minutos por persona.** H0 es rápida: es un solo toque. Luego, con la misma persona, sigues a P1/P2 de H1/H2.

**La regla de oro:** en el momento en que sientas ganas de "ayudar" a que toquen lo correcto, **estás fabricando el resultado.** Muérdete la lengua y anota el dedo tal como cayó.

---

## 4 · Hoja de registro — P1 a P10 (imprimir esta)

Marca en la columna **"Destino tocado"** el nombre exacto de la lista de abajo (o su número). Si tocan algo que no está en la lista, escríbelo tal cual — es dato.

| # | Destino tocado (nombre o nº de la lista) | ¿Por qué ese? (frase literal, opcional) |
|---|---|---|
| P1 | | |
| P2 | | |
| P3 | | |
| P4 | | |
| P5 | | |
| P6 | | |
| P7 | | |
| P8 | | |
| P9 | | |
| P10 | | |

**Lista de destinos válidos del home actual** *(el mapa real de la pantalla "inicio"; prominencia entre paréntesis)*:

1. **Marca "ALTO Research"** — logo/wordmark del topbar (media)
2. **Enlaces de nav** — Inicio · Explorar · 📓 Cuaderno · 🧠 Atlas *(solo escritorio; en celular se ocultan)* (media)
3. **Badge de nivel "🟡 Aprender ▾"** — abre el menú de los 4 niveles (media)
4. **Botón menú ☰** — abre la hoja MenuNav (media)
5. **Cinta BVL** — chips de tickers que desfilan; cada uno abre una ficha (media)
6. **🆕 Actualizaciones** — barra plegable, colapsada por defecto (baja)
7. **Moneda-fidget** — el logo gigante de ALTO; juguete, no navega (**alta**)
8. **🎣 Gancho "¿Sabías que…?"** — dato rotativo que abre una ficha (media)
9. **🎯 Empezar el quiz** — botón dorado grande del hero (**alta**)
10. **Atajos del hero** — 🔎 Explorar las 115 · 📖 Glosario · 🧠 Atlas beta · 🎲 Una al azar (media)
11. **Buscador "Busca entre las 115…"** — input de búsqueda (**alta**)
12. **Portada "📓 Mi Cuaderno"** — tarjeta dorada que respira; abre el Cuaderno (**alta**)
13. **📊 Así cerró la BVL** — filas Subieron/Bajaron; cada una abre una ficha (media)
14. **🎯 Empresa del día → "Estudiarla →"** — tarjeta con botón dorado (media)
15. **🐣 Repaso de la Lección** — banner "¿Eres nuevo por aquí?" (baja)
16. **💡 Píldora "¿Sabías que?"** — rota un principio; no navega (baja)
17. **FLOTANTE: Mentor ALTO** — globo "🎓 ¿Primera vez por aquí?" / pill (**alta**)
18. **FLOTANTE: "💛 Apóyame"** — pill de donación, siempre visible (**alta**)

> **Recordatorio del mapa:** hay **al menos 5 destinos "alta"** peleando por el primer toque (moneda, quiz, buscador, portada Cuaderno, Mentor/Apóyame), varios **dorados y animados**. Ese reparto es justo el síntoma que H0 quiere medir — pero **no se lo cuentes a la persona ni lo uses para sugerir**. Solo lo usas tú para tabular rápido.

---

## 5 · Conteo y decisión

Al terminar las 10, **cuenta cuántos destinos DISTINTOS se tocaron** (no cuántas personas — cuántos lugares diferentes recibieron al menos un dedo). Y anota **cuál fue el destino más repetido** y en cuántos de 10.

| Resultado | Veredicto | Qué significa · qué se hace |
|---|---|---|
| **≥ 6 destinos distintos** entre las 10 | **H0 CONFIRMADA — sin jerarquía.** | El home no manda a nadie a ningún lado en particular: presenta ALTO y reparte la atención. **Justifica el rediseño del PTC.** Es la línea base "desde donde partimos". |
| **Un mismo destino en ≥ 6/10** | **H0 REFUTADA — hay jerarquía.** | El home ya concentra la atención en un destino. **Dato valioso**: el diagnóstico "no tiene jerarquía" estaba mal; anota *cuál* destino manda y replantea a qué debe apuntar el rediseño. |
| **Zona intermedia** — p.ej. 4-5 destinos distintos, o el destino top junta 4-5/10 | **No concluyente.** | **No lo fuerces a un veredicto.** Describe el patrón tal cual: cuántos destinos distintos, cuál fue el más tocado y con qué frecuencia, y qué "altas" se llevaron los dedos. Anótalo literal y decide si repetir con más personas o afinar la consigna. **No inventes jerarquía que los datos no muestran, ni la niegues si el top está a un dedo del umbral.** |

> **Sub-lectura útil (aunque no cambia el veredicto):** ¿los toques cayeron sobre destinos de prominencia **alta** (moneda, quiz, buscador, Cuaderno, Mentor/Apóyame) o se dispersaron también a los **medios/bajos**? Si 10 dedos van a 6 lugares y **todos** son "altas" dorados, la historia es "cinco imanes compiten"; si van a 6 lugares repartidos por toda la pantalla, es "no hay imán". Las dos confirman H0, pero enseñan distinto al rediseño. Anótalo.

---

## 6 · Cerrar el ciclo (obligatorio)

El resultado **no vive en esta hoja**: vive en el [Diario de Hipótesis](DIARIO_DE_HIPOTESIS.md). Al terminar las 10 personas, llena las columnas pendientes de la **fila H0**:

- **Fecha resultado** — el día que terminaste las 10.
- **Resultado** — Confirmada / Refutada / No concluyente. *Sin "parcialmente".* **Recuerda la inversión:** Confirmada = el home falla (sin jerarquía) = rediseño justificado; Refutada = el home ya jerarquiza.
- **¿Qué aprendimos?** — **la columna protegida.** Anota el conteo real: cuántos destinos distintos, cuál fue el top y en cuántos de 10, si se concentraron en "altas" o se dispersaron. Cita frases literales del *"¿por qué ese?"* — sobre todo si el resultado sorprende (p.ej. si convergieron y H0 quedó refutada: *¿por qué* ese destino ganó?). Esta columna no se borra jamás.
- **Consecuencia** — qué se hace con el hallazgo: arranca el rediseño del home con jerarquía (si Confirmada), o replantea el diagnóstico y define a qué apuntar (si Refutada), o repite/afina (si no concluyente).

> **Termómetro de cultura:** H0 solo vale si el dedo cayó libre. Si te descubres "ayudando" a que toquen lo importante, no mediste la jerarquía del home — mediste tu propia mano. La honestidad de esta prueba se juega en el silencio del administrador.

---

## 7 · Nota final — H0 es la línea base, no una pantalla del PTC

H0 no propone nada, no instala ningún modelo, no tiene tarjeta que rediseñar. **Retrata el home de hoy** para que, cuando exista el home rediseñado del PTC, se pueda correr la **misma prueba del dedo** sobre el nuevo y comparar: *¿ahora el dedo converge donde queremos?* Sin este retrato del punto de partida, el "antes/después" del rediseño sería una impresión. Con él, es una medición. Por eso H0 va primero, en frío, antes de que nadie vea una sola tarjeta de H1 o H2.
