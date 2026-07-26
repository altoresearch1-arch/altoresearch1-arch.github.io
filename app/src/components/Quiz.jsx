import { useState } from 'react'
import quiz from '../data/quiz.json'
import pildorasData from '../data/pildoras.json'
import Disclaimer from './Disclaimer'

// Pool de tips para mostrar mientras se resuelve el quiz (principios educativos).
const POOL_TIPS = [...pildorasData.pildoras, ...Object.values(quiz.sectorTips || {})]

// 🗣️ Lo que dice ALTO antes de cada pregunta (25-jul). Antes decía «Pregunta 1
// de 4», que es el encabezado de un examen: numerar lo que falta convierte una
// conversación en un trámite. Estas frases dicen POR QUÉ se pregunta, que es lo
// único que justifica preguntar.
const ENTRADAS = [
  'Cuéntame qué buscas y te muestro empresas que encajen. Nada de esto queda guardado.',
  'Ya sé qué buscas. Ahora lo otro: qué tan tranquilo quieres dormir.',
  'Con eso ya tengo tu perfil. Elige por dónde quieres empezar a mirar.',
  'Última. Esta cambia bastante la lista: no es lo mismo semanas que años.',
]

// Quiz de 4 preguntas. Al terminar, llama onTerminar(respuestas).
export default function Quiz({ onTerminar, onAleatoria }) {
  const preguntas = quiz.preguntas
  const [paso, setPaso] = useState(0)
  const [respuestas, setRespuestas] = useState({})

  const preg = preguntas[paso]
  const elegido = respuestas[preg.id]
  const esUltima = paso === preguntas.length - 1

  // Tip que se muestra mientras respondes. Si ya elegiste sector, muestra el de
  // ese sector (más relevante); si no, rota por la pregunta.
  const pregSector = preguntas.find((q) => q.tipo === 'sector')
  const sectorElegido =
    pregSector && respuestas[pregSector.id] != null
      ? pregSector.opciones[respuestas[pregSector.id]].valor
      : null
  const tipActual =
    (sectorElegido && quiz.sectorTips?.[sectorElegido]) ||
    POOL_TIPS[paso % POOL_TIPS.length]

  const elegir = (idx) => {
    setRespuestas((r) => ({ ...r, [preg.id]: idx }))
  }

  const siguiente = () => {
    if (elegido == null) return
    if (esUltima) {
      onTerminar(respuestas)
    } else {
      setPaso((p) => p + 1)
    }
  }

  const atras = () => setPaso((p) => Math.max(0, p - 1))

  return (
    <div className="card">
      <div className="progreso">
        {preguntas.map((_, i) => (
          <div key={i} className={'seg' + (i <= paso ? ' on' : '')} />
        ))}
      </div>

      {/* key={paso}: remonta la pregunta al avanzar -> entra con fade suave */}
      <div key={paso} className="anim-sube">
        <div className="pregunta-num">
          {ENTRADAS[paso] ?? ENTRADAS[ENTRADAS.length - 1]}
        </div>
        <h2 style={{ marginTop: 6 }}>{preg.texto}</h2>

        <div className="opciones">
          {preg.opciones.map((op, idx) => (
            <button
              key={idx}
              className={'btn opcion' + (elegido === idx ? ' sel' : '')}
              onClick={() => elegir(idx)}
            >
              <span className="bolita" />
              <span>{op.texto}</span>
            </button>
          ))}
        </div>

        {/* La nota de la opción ya existía, pero colgaba de las cuatro a la
            vez: eso es un formulario con letra chica. Ahora aparece SOLO la de
            la que elegiste, después de elegirla — así la pantalla responde a lo
            que dijiste en vez de explicarte tus opciones antes de tiempo. */}
        {elegido != null && preg.opciones[elegido].nota && (
          <p className="quiz-eco">
            <span className="quiz-eco-marca" aria-hidden="true">↳</span>
            {/* Las notas están escritas en minúscula y sin punto (eran letra
                chica colgando de la opción). Ahora son la voz de ALTO
                repitiéndote lo que entendió, así que se dicen como frase. */}
            <span>
              {preg.opciones[elegido].nota.charAt(0).toUpperCase()}
              {preg.opciones[elegido].nota.slice(1)}
              {/\.$/.test(preg.opciones[elegido].nota) ? '' : '.'}
            </span>
          </p>
        )}
      </div>

      {tipActual && (
        <div className="quiz-tip">
          <span className="quiz-tip-label">💡 Tip</span> {tipActual}
        </div>
      )}

      <div className="quiz-nav">
        <button
          className="btn btn-fantasma"
          onClick={atras}
          disabled={paso === 0}
          style={{ visibility: paso === 0 ? 'hidden' : 'visible' }}
        >
          ← Atrás
        </button>
        <button className="btn btn-oro" onClick={siguiente} disabled={elegido == null}>
          {esUltima ? 'Muéstrame las empresas →' : 'Sigamos →'}
        </button>
      </div>

      {onAleatoria && (
        <div className="center" style={{ marginTop: 14 }}>
          <button className="btn-aleatoria" onClick={onAleatoria}>
            🎲 ¿Con prisa? Conoce una empresa al azar
          </button>
        </div>
      )}

      <Disclaimer compacto />
    </div>
  )
}
