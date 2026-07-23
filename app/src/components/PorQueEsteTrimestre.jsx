import { useState } from 'react'
import gerenciaData from '../data/gerencia.json'
import Glosado from './Glosado'
import { redactarGerencia } from '../lib/redactor'

// 🗣 ¿Por qué le fue así este trimestre? (mejora #103 del plan educativo)
// El tercer escalón de la escalera de aprendizaje ("¿por qué gana más o menos
// este año?") estaba ENTERRADO en el nivel 4: las frases de la propia gerencia
// explicando el trimestre ya venían digeridas en gerencia.json y solo las veía
// quien abría documentos o le preguntaba a Atlas. Aquí suben al nivel 2, que
// es donde la cabeza las pide — después de saber qué hace la empresa y antes
// de opinar sobre si está barata.
// Todo es TEXTUAL del documento oficial de la SMV: no se resume ni se
// interpreta (Regla de Oro #1). Si la empresa no lo presentó, no hay tarjeta.

// Las frases vienen del PDF: se limpian espacios raros del extractor, nada más.
function limpiar(f) {
  return String(f).replace(/\s+/g, ' ').trim()
}

export default function PorQueEsteTrimestre({ empresa }) {
  const [todo, setTodo] = useState(false)
  const g = gerenciaData.gerencia?.[empresa.ticker]
  const frases = (g?.frases || []).map(limpiar).filter((f) => f.length > 40)
  if (!frases.length) return null

  const nombreCorto = empresa.nombreCorto || empresa.nombre
  const visibles = todo ? frases.slice(0, 6) : frases.slice(0, 3)

  return (
    <div className="gerencia-tarjeta">
      <div className="seccion-titulo">🗣 ¿Por qué le fue así este trimestre?</div>
      <p className="gerencia-intro muted">
        <Glosado text={redactarGerencia(nombreCorto, g).replace(/\*\*/g, '')} />
      </p>
      <ul className="gerencia-frases">
        {visibles.map((f, i) => (
          <li key={i}>«<Glosado text={f} />»</li>
        ))}
      </ul>
      {frases.length > 3 && (
        <button className="btn btn-fantasma gerencia-mas" onClick={() => setTodo(!todo)}>
          {todo ? 'Mostrar menos' : `Ver más de lo que dijo (${Math.min(frases.length, 6) - 3} frases más)`}
        </button>
      )}
      <p className="muted gerencia-pie">
        Citas TEXTUALES del «Análisis y Discusión de la Gerencia» que la empresa presentó a la SMV.
        Es su versión de los hechos — la de la parte interesada: contrástala con los números de
        arriba antes de creerle del todo.
      </p>
    </div>
  )
}
