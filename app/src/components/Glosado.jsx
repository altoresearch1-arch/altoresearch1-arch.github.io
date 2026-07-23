import { useEffect, useRef, useState } from 'react'
import terminosData from '../data/terminos.json'
import { claveDeTermino, tarjetaMentor, pedirTarjeta } from '../lib/mentor'
import { leerNivel } from '../lib/nivel'

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
  // Entre la palabra y el tooltip hay un hueco: si el cierre fuera inmediato,
  // el cursor nunca llegaría vivo a los botoncitos. Se cierra con un respiro,
  // y entrar al tooltip cancela el cierre.
  const cierre = useRef(null)
  const abrir = () => { clearTimeout(cierre.current); setVer(true) }
  const cerrarLuego = () => {
    clearTimeout(cierre.current)
    cierre.current = setTimeout(() => setVer(false), 220)
  }
  useEffect(() => () => clearTimeout(cierre.current), [])

  // BUG CAZADO 09-jul (celular "muerto"): en iPhone, tocar FUERA de un elemento
  // enfocado NO dispara blur → el tooltip (fijo y centrado, z-index 300) quedaba
  // abierto para siempre tapando la pantalla y "nada se podía tocar". Ahora
  // CUALQUIER toque fuera de la palabra lo cierra (pointerdown a nivel documento),
  // incluido tocar el propio tooltip.
  useEffect(() => {
    if (!ver) return
    const cerrar = (ev) => {
      if (ref.current && ev.target === ref.current) return // el 2º tap en la palabra no lo re-cierra en falso
      // …pero tocar los botoncitos 📖/📊/🧠 del propio tooltip NO lo cierra:
      // si no, en el celular nunca se podría llegar a tocarlos.
      if (ev.target.closest?.('.termino-pop')) return
      setVer(false)
    }
    document.addEventListener('pointerdown', cerrar, true)
    return () => document.removeEventListener('pointerdown', cerrar, true)
  }, [ver])

  // 🎓 EL PUENTE CON EL MENTOR (§31-3): si este término tiene una tarjeta
  // escrita para el nivel en que está el usuario, el tooltip deja de ser el
  // final del camino y ofrece seguir. Si no la tiene, no se promete nada.
  const claveMentor = claveDeTermino(palabra)
  const tarjeta = claveMentor ? tarjetaMentor(claveMentor, { nivel: leerNivel() ?? 2 }) : null

  const alMentor = (ev, ejemplo) => {
    ev.preventDefault()
    ev.stopPropagation()
    setVer(false)
    pedirTarjeta(claveMentor, { ejemplo })
  }

  const alAtlas = (ev) => {
    ev.preventDefault()
    ev.stopPropagation()
    setVer(false)
    // Mismo patrón que ya usa "enviar al equipo": la pregunta viaja escrita.
    try { sessionStorage.setItem('alto-atlas-pregunta', `¿Qué es ${palabra}?`) } catch { /* sin storage */ }
    location.hash = '#/ia'
  }

  return (
    <span
      ref={ref}
      className="termino"
      tabIndex={0}
      onMouseEnter={abrir}
      onMouseLeave={cerrarLuego}
      onFocus={abrir}
      onClick={abrir}
      onBlur={cerrarLuego}
    >
      {palabra}
      {ver && (
        <span className="termino-pop" role="tooltip">
          <strong className="termino-pop-t">{palabra}</strong>
          {definicion}
          <span className="termino-pop-acciones" onMouseEnter={abrir} onMouseLeave={cerrarLuego}>
            {tarjeta && (
              <button className="termino-pop-btn" onClick={(e) => alMentor(e, false)}>
                📖 Explícamelo
              </button>
            )}
            {tarjeta?.ejemplo && (
              <button className="termino-pop-btn" onClick={(e) => alMentor(e, true)}>
                📊 Ejemplo
              </button>
            )}
            <button className="termino-pop-btn" onClick={alAtlas}>
              🧠 Atlas
            </button>
          </span>
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
