import { useEffect, useRef, useState } from 'react'
import terminosData from '../data/terminos.json'

// Detecta términos técnicos dentro de un texto y los explica al pasar el cursor.
// No requiere clic: el tooltip aparece en hover (y en foco para teclado/táctil).

// Índice en minúsculas: el texto matchea sin importar mayúsculas ("TMF", "Sunat"),
// y la clave del JSON también puede venir en mayúsculas (TMF, MINEM, OPA).
const TERMINOS = {}
for (const [k, v] of Object.entries(terminosData.terminos)) {
  TERMINOS[k.toLowerCase()] = v
}

// Regex con todos los términos, los más largos primero (para cazar "total de activos"
// antes que "activos"). Límites que respetan acentos y la barra de "p/e".
const claves = Object.keys(TERMINOS).sort((a, b) => b.length - a.length)
const escapadas = claves.map((k) => k.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'))
const RE = new RegExp(
  '(?<![\\wáéíóúñ])(' + escapadas.join('|') + ')(?![\\wáéíóúñ])',
  'gi'
)

function Termino({ palabra, definicion }) {
  const [ver, setVer] = useState(false)
  const ref = useRef(null)

  // BUG CAZADO 09-jul (celular "muerto"): en iPhone, tocar FUERA de un elemento
  // enfocado NO dispara blur → el tooltip (fijo y centrado, z-index 300) quedaba
  // abierto para siempre tapando la pantalla y "nada se podía tocar". Ahora
  // CUALQUIER toque fuera de la palabra lo cierra (pointerdown a nivel documento),
  // incluido tocar el propio tooltip.
  useEffect(() => {
    if (!ver) return
    const cerrar = (ev) => {
      if (ref.current && ev.target === ref.current) return // el 2º tap en la palabra no lo re-cierra en falso
      setVer(false)
    }
    document.addEventListener('pointerdown', cerrar, true)
    return () => document.removeEventListener('pointerdown', cerrar, true)
  }, [ver])

  return (
    <span
      ref={ref}
      className="termino"
      tabIndex={0}
      onMouseEnter={() => setVer(true)}
      onMouseLeave={() => setVer(false)}
      onFocus={() => setVer(true)}
      onClick={() => setVer(true)}
      onBlur={() => setVer(false)}
    >
      {palabra}
      {ver && (
        <span className="termino-pop" role="tooltip">
          <strong className="termino-pop-t">{palabra}</strong>
          {definicion}
        </span>
      )}
    </span>
  )
}

// Recibe un string y devuelve nodos con los términos envueltos en tooltips.
export default function Glosado({ text }) {
  if (text == null || text === '') return null
  const str = String(text)
  const nodos = []
  let ultimo = 0
  let m
  RE.lastIndex = 0
  let i = 0
  while ((m = RE.exec(str)) !== null) {
    const def = TERMINOS[m[0].toLowerCase()]
    if (!def) continue
    if (m.index > ultimo) nodos.push(str.slice(ultimo, m.index))
    nodos.push(<Termino key={i++} palabra={m[0]} definicion={def} />)
    ultimo = m.index + m[0].length
  }
  if (ultimo < str.length) nodos.push(str.slice(ultimo))
  return <>{nodos}</>
}
