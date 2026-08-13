# 📦 Novena ronda — cerrado, y el número real era otro

> Mismo mensaje para los dos. La decisión queda tomada en los términos que
> propusieron: los datos se quedan horneados y el modo offline es la propiedad
> que se protege. Escrito como invariante #37.
>
> Pero antes de cerrarla se midió una cosa más, y cambia la fuerza del
> argumento: **la primera carga nunca fueron 4 MB.**

---

## El número real

Los 4 MB son tamaño en disco. Lo que viaja por la red va comprimido:

| | disco | por la red |
|---|---|---|
| `datos` | 1,701 KB | **436 KB** |
| `datos-historicos` | 980 KB | **152 KB** |
| `index` | 558 KB | **186 KB** |
| `datos-lecturas` | 513 KB | **84 KB** |
| `datos-hechos` | 418 KB | **54 KB** |
| CSS | 200 KB | **35 KB** |
| **primera carga** | **~4.0 MB** | **~950 KB** |

Un JSON de precios y fechas comprime muy bien: el histórico entero baja de 980 a
152 KB. O sea que la discusión de las dos últimas rondas —si valía la pena
romper el modo offline para ahorrar peso— estaba sobre una cifra cuatro veces
mayor que la real. La conclusión no cambia; el margen para dudar, sí: **950 KB
una vez, y nunca más**, contra una app que funciona entera sin señal.

---

## La compresión Brotli: comprobada contra el sitio publicado, y no entra

Se propuso `vite-plugin-compression` para emitir `.br` y `.gz` en el build. Se
midió contra el sitio real:

```
curl -I -H "Accept-Encoding: br, gzip"  https://altoresearch1-arch.github.io/
  → Content-Encoding: gzip          ← gzip, aun pidiéndole brotli

assets/index-*.js  →  Content-Length: 246225   Content-Encoding: gzip
```

Dos cosas se ven ahí:

1. **GitHub Pages ya comprime al vuelo.** El gzip que se quería conseguir ya
   está puesto, sin plugin y sin configuración.
2. **No sirve brotli**, aunque el cliente lo ofrezca. Y tampoco negocia archivos
   precomprimidos que uno deje en el repo: los `.br` y `.gz` que generara el
   plugin no los pediría nadie. Serían archivos muertos engordando el
   repositorio y el despliegue.

El razonamiento sobre por qué Brotli comprime mejor un JSON con claves repetidas
es correcto — simplemente no aplica en este hosting. Si algún día la app se
mudara a un servidor propio o a un CDN que sí lo sirva, el plugin vuelve a la
mesa.

---

## El registro de la decisión: va como invariante, no como documento aparte

Se propuso un ADR («ADR-004: bundling de datos estáticos»). El contenido es
exactamente el correcto —contexto, decisión, consecuencias positivas y
negativas— pero este proyecto ya tiene ese sitio: `INVARIANTES.md`, donde cada
regla vive con la evidencia que la produjo y con la fecha. Abrir un segundo
sistema de registro haría que dentro de seis meses haya que buscar en dos
lugares y que uno de los dos envejezca.

Quedó como **invariante #37**, con la tabla de arriba y con el criterio para el
futuro: si algún día aparece un dato **muy pesado, poco usado y prescindible sin
red** —una biblioteca documental, un paquete de PDF—, ese sí es candidato a salir
del bundle. Los datos que sostienen las pantallas, no.

---

## Lo que dejan estas nueve rondas

```
5 bugs cerrados     · el % desde el titular · el HI de pre-apertura · el 🌍
                      congelado · el Sparkline · los Hechos de la ficha
2 puertas únicas    · series.js · hechos.js
1 capa viva         · un motor para toda la app, encendido por consumidores
34 pruebas (JS)     · 4 de ellas estructurales, todas probadas en rojo
8 pruebas (Python)  · la guarda del extractor, que vitest no puede tocar
37 invariantes      · cada uno con la evidencia que lo produjo
```

De las dos observaciones sobre el método, la que me llevo es la del orden:
**idea → implementación mínima → medición real → decisión**. La carga perezosa
no se mantuvo porque rindiera mucho, sino porque medirla mostró qué problema
resolvía de verdad; y esta ronda no cambió de conclusión, pero descubrió que el
número que la sostenía estaba cuatro veces inflado.

Que es, al final, lo mismo que decía el documento de la primera ronda: verificar
antes de afirmar. Solo que ahora también se aplica a lo que uno mismo afirmó dos
rondas atrás.

Gracias a los dos. Cuando aparezca el siguiente frente —el detector de
transmisiones en vivo es el que sigue— el patrón ya está: fuente única → puerta
→ proveedor si el dato cambia → prueba estructural → invariante.
