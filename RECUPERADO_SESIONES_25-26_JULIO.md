# Recuperado — sesiones del 25-26 de julio de 2026

> Reconstruido el 30/07/2026 leyendo los transcripts de las sesiones anteriores.
> Se escribió porque el contexto de conversación se perdió al mover la carpeta del proyecto.

## Por qué se "perdió"

Las sesiones anteriores corrían desde `C:\Users\User\Desktop\Plan de app ALTO RESEARCH`.
Esa carpeta ya no está en el Escritorio: el proyecto ahora vive en
`C:\Users\User\Plan de app ALTO RESEARCH` (con otra copia en `Documentos`).

Cada carpeta tiene su propio historial de sesiones, así que al abrir la nueva ruta
la conversación arranca en blanco. **No se borró nada** — los archivos y los commits
están completos. Los transcripts viejos siguen guardados y son legibles.

## Sesiones de origen

| Sesión | Fecha | Mensajes |
|---|---|---|
| Interfaz pantalla inicial mejorada | 26/07 01:49 | 697 |
| Interfaz inicial con selector de colores | 26/07 04:03 | 345 |

## Commits que salieron de ahí

| Commit | Qué trae |
|---|---|
| `bd26989` | La interfaz de entrada: el Plan para nuevo inversor sube al inicio |
| `2a355e2` | Siete colores a elegir y un inicio que ya no grita todo a la vez |
| `c2d1962` | Los colores salen del escondite (☰ → Colores) y la moneda se tiñe con ellos |
| `cbacafb` | La tapa del Cuaderno puede venirse con el color de la app |

Todo subido y desplegado. El árbol quedó limpio.

---

## 1. La puerta de entrada (sesión del 01:49)

Recorrido del usuario nuevo: **bienvenida → conversación → diploma → elige nivel → entra**.

### Los cuatro niveles se eligen por quién eres, no por lo que abren

Cada nivel lleva una línea «Para ti si…» **siempre visible**, aunque la ficha esté
plegada — es lo primero que necesita alguien que no sabe cuál le toca: reconocerse.

- **💸 Simple** — nunca compraste una acción y lo primero que quieres saber es cuánto podrías ganar o perder.
- **🟡 Aprender** — prefieres entender antes de poner un sol.
- **📊 Análisis** — ya sabes qué es una acción y quieres decidir con criterio.
- **🧠 Lobo** — lees memorias y hechos de importancia, y quieres la fuente cruda.

### Tres decisiones de diseño que conviene no deshacer

1. **Solo el nivel elegido se despliega.** Las cuatro fichas completas eran ~900 px de
   scroll para leer cuatro veces lo mismo. El diploma pasó de 5525 a 5092 px en celular.
2. **El recomendado viene marcado, no impuesto.** Sale con el 3 puesto y la cinta
   «el tuyo», pero tocas otro y cambia.
3. **Cada nivel dice qué NO trae** («Sin los documentos crudos de la SMV ni el radar
   Sentinel: eso es el 4»). Elegir sabiendo qué te pierdes es lo que hace que la
   elección sea tuya y no una recomendación disfrazada.

El nivel elegido manda en las cuatro salidas, incluida la discreta — que dice
«Solo entrar a la app, sin ficha» y respeta lo que elegiste.

### Animaciones, todas con un motivo

Fichas escalonadas a 70 ms · la barra del elemento crece al elegir · la explicación
se despliega deslizando · los chips entran en cascada · el ✓ rebota una vez · la cinta
«el tuyo» late **exactamente dos veces** y se queda quieta (un latido infinito deja de
ser un aviso y pasa a ser un tic) · los 8 pasos del diploma también escalonados.

Todo se apaga con `prefers-reduced-motion` y todo es `transform`/`opacity`.

---

## 2. Colores por nivel (sesión del 04:03)

### Dónde está el selector

**☰ → 🎨 Colores de la app.** Panel con los cuatro niveles, cada uno con sus siete
colores. El del nivel donde estás se aplica al toque; los otros esperan a que entres.
Hay «restablecer» por nivel y «volver a los de fábrica» para todos.

> Primero quedó escondido dentro del menú del badge de nivel y no se encontraba.
> Ese menú se abre para cambiar de nivel, no para pintar. Por eso se sacó al ☰.
> El badge lo conserva, pero ya no es el único sitio.

### Los siete tonos

Los cuatro elementales de siempre + **🤍 blanco, 🔮 morado, 🌸 rosa**.
Cada nivel recuerda el suyo: pones morado en «Aprender», subes a «Análisis» y ahí
sigue el celeste; vuelves y te espera el morado.

El color no es decorativo: tiñe todo lo que antes era dorado (botones, títulos, bordes,
la estrella de favoritos), la aurora del fondo y el polvo del canvas.

### 🪙 La moneda del logo también se tiñe

No bastaba con girar el tono: sobre un dorado tan saturado casi no se nota.
Va con la receta **`grayscale → sepia → hue-rotate`**, que primero deja la imagen
neutra y recién ahí la lleva al color. Medido sobre los píxeles claros del logo:

| color | resultado |
|---|---|
| 👑 Oro | rgb(177,146,73) |
| 🤍 Blanco | rgb(179,179,179), plata |
| 🔮 Morado | rgb(185,146,221) |
| 🌸 Rosa | rgb(224,143,176) |

### 📓 La tapa del Cuaderno

**Mi Cuaderno → ⚙️ → primera tapa, la 🎨.** No guarda un color: guarda el encargo de
seguir al de la app, así que el cuaderno se repinta en el acto al cambiar el tinte.
Las siete tapas fijas (Dorado, Esmeralda, Turquesa, Zafiro, Amatista, Coral, Rubí)
siguen mandando por encima si eliges una.

---

## 3. El inicio ordenado

Eran doce bloques uno debajo del otro, todos con el mismo peso.
Quedaron tres secciones plegables en [SeccionInicio.jsx](app/src/components/SeccionInicio.jsx):

| | qué junta | entrada |
|---|---|---|
| 🎓 Empieza por aquí | el plan + la lección exprés | abierta (niveles 1-2) |
| 📓 Lo tuyo | tu cuaderno + tu lista ★ | abierta |
| 📊 El mercado hoy | cierre de la BVL + empresa del día | cerrada en 1-2, abierta del 3 |

El plan y la lección estaban en las dos puntas de la página siendo lo mismo — el camino
del que recién llega. Las 🆕 Actualizaciones bajaron al pie (hablan de ALTO, no de la
bolsa) y el hero perdió el atajo de Atlas, que ya estaba dos veces en pantalla.

Nada se borra: se pliega, y la app recuerda cómo lo dejaste.

---

## Trampas técnicas que costaron tiempo

- **`NIVELES[].color` ya no sirve para pintar.** Pasó a ser solo el valor de fábrica;
  para el color vigente hay que usar **`colorNivel(id)`** de
  [nivel.js](app/src/lib/nivel.js). Los ocho componentes que lo usaban ya están migrados.
- **Especificidad CSS del Cuaderno.** La regla del tinte global le ganaba a la que hace
  que el logo tome el color de la portada activa, aunque estuviera escrita antes.
  Corregido: dentro del Cuaderno la marca sigue siendo suya. Si se tocan esos estilos,
  verificar los dos casos (app en verde + tapa 🎨 → cuaderno verde; app en verde +
  tapa Rubí → cuaderno rojo).
- **Caché del PWA.** Si un cambio no aparece en el navegador, recargar con `Ctrl+Shift+R`.

## Lo único que quedó sin hacer

**No hay capturas de pantalla** de la interfaz nueva. El panel del navegador no estaba
visible y el motor no compone cuadros sin él. Se verificó el DOM en escritorio y a
375 px (sin desbordes, sin errores de consola, `vite build` pasa), pero las capturas
quedaron pendientes de que se abra el panel.
