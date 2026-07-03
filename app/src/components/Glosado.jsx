import { useState } from 'react'
import terminosData from '../data/terminos.json'

// Detecta términos técnicos dentro de un texto y los explica al pasar el cursor.
// No requiere clic: el tooltip aparece en hover (y en foco para teclado/táctil).

const TERMINOS = terminosData.terminos

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
  return (
    <span
      className="termino"
      tabIndex={0}
      onMouseEnter={() => setVer(true)}
      onMouseLeave={() => setVer(false)}
      onFocus={() => setVer(true)}
      onBlur={() => setVer(false)}
    >
      {palabra}
      {ver && (
        <span className="termino-pop" role="tooltip">
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
