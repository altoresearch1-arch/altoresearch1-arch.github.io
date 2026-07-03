import { useState } from 'react'
import data from '../data/pildoras.json'

// Píldora "¿Sabías que?" rotativa. Principios, no datos puntuales.
export default function Pildora() {
  const lista = data.pildoras
  const [i, setI] = useState(() => Math.floor(Math.random() * lista.length))

  const girar = () => setI((prev) => (prev + 1) % lista.length)

  return (
    <div className="pildora">
      <div className="titulo">
        💡 ¿Sabías que?
        <button className="girar" onClick={girar}>
          otra ↻
        </button>
      </div>
      <div>{lista[i]}</div>
    </div>
  )
}
