// 🕹️ PIXEL AVATAR (pedido de Jair 10-jul): a cada donante se le asigna un
// personaje estilo 8-bit generado A PARTIR DE SU NOMBRE. Es determinístico
// (mismo nombre = mismo personaje siempre) y NO usa imágenes: se dibuja como
// SVG al vuelo, así la web sigue pesando poco (regla "liviano sobre instantáneo").

// Hash FNV-1a simple y estable (no depende de Math.random, así el personaje
// no cambia entre recargas).
function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Paletas retro [claro (cuerpo), oscuro (fondo)].
const PALETAS = [
  ['#ffd447', '#7a5a00'], // oro
  ['#4fd1c5', '#12463f'], // teal
  ['#f56565', '#5a1f1f'], // rojo
  ['#63b3ed', '#173a5e'], // azul
  ['#68d391', '#183f2c'], // verde
  ['#b794f4', '#3a2960'], // morado
  ['#f6ad55', '#5a3213'], // naranja
  ['#f687b3', '#5c1f3f'], // rosa
]

const COLS = 8
const ROWS = 8
const MITAD = 4 // se dibuja media rejilla y se espeja -> simetría de "cara"

export default function PixelAvatar({ nombre = '?', size = 56 }) {
  const seed = hashStr(nombre)
  const paleta = PALETAS[hashStr('color:' + nombre) % PALETAS.length]
  const [claro, oscuro] = paleta
  const cell = size / COLS

  // Celdas del cuerpo: bit de la semilla por celda (mitad izquierda + espejo).
  const cuerpo = []
  let bit = 0
  for (let x = 0; x < MITAD; x++) {
    for (let y = 0; y < ROWS; y++) {
      const encendida = (seed >> bit) & 1
      bit++
      if (encendida) {
        cuerpo.push([x, y])
        cuerpo.push([COLS - 1 - x, y]) // espejo
      }
    }
  }

  // Ojos fijos y simétricos (fila 2, columnas 2 y 5) para que siempre lea como
  // un personaje. Aseguramos cuerpo debajo y dibujamos la pupila oscura encima.
  const ojos = [[2, 2], [5, 2]]
  const cuerpoConOjos = cuerpo.concat(ojos)

  return (
    <svg
      className="pixel-avatar"
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Personaje de ${nombre}`}
    >
      <rect width={size} height={size} rx={8} fill={oscuro} />
      {cuerpoConOjos.map(([x, y], i) => (
        <rect key={i} x={x * cell} y={y * cell} width={cell} height={cell} fill={claro} />
      ))}
      {ojos.map(([x, y], i) => (
        <rect
          key={'ojo' + i}
          x={x * cell + cell * 0.28}
          y={y * cell + cell * 0.28}
          width={cell * 0.44}
          height={cell * 0.44}
          fill="#0a0a0a"
        />
      ))}
    </svg>
  )
}
