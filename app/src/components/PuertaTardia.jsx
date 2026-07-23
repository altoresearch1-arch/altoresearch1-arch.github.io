import { useState } from 'react'
import SelectorNivel from './SelectorNivel'

// ─────────────────────────────────────────────────────────────────────────
// 🎚️ LA PUERTA DE NIVELES, AL FINAL (mejora #135 — Parte IV §29)
// La puerta no se borró: se mudó. Antes preguntaba "¿qué tan metido estás?"
// en el segundo cero; ahora espera a que el usuario haya entrado por el 🐣 y
// haya mirado su primera ficha. Recién entonces aparece esta cinta en el
// inicio: ya sabe qué es una acción, ya vio cómo se ve una empresa, y por fin
// la pregunta tiene sentido — porque ya sabe qué está eligiendo.
// Se muestra UNA vez. Si dice "ahora no", no vuelve a salir (el 🎚️ de la
// barra sigue ahí para siempre).
// ─────────────────────────────────────────────────────────────────────────

const CLAVE = 'alto-puerta-tardia'
const CLAVE_FICHAS = 'alto-fichas-vistas'

export function marcarFichaVista() {
  try {
    const n = parseInt(localStorage.getItem(CLAVE_FICHAS), 10) || 0
    localStorage.setItem(CLAVE_FICHAS, String(n + 1))
  } catch { /* incógnito */ }
}

// ¿Toca ofrecerle los niveles? Solo si: entró por el 🐣 (por eso está en
// nivel 2 sin haberlo elegido), ya vio al menos una ficha, y no se la
// ofrecimos antes.
export function tocaPuertaTardia(nivel) {
  try {
    if (nivel !== 2) return false
    if (localStorage.getItem(CLAVE) === '1') return false
    if (localStorage.getItem('alto-leccion-expres') !== '1') return false
    return (parseInt(localStorage.getItem(CLAVE_FICHAS), 10) || 0) >= 1
  } catch { return false }
}

function cerrarParaSiempre() {
  try { localStorage.setItem(CLAVE, '1') } catch { /* incógnito */ }
}

export default function PuertaTardia({ onElegir, onCerrar }) {
  const [abierta, setAbierta] = useState(false)

  const elegir = (id) => { cerrarParaSiempre(); onElegir(id); onCerrar() }
  const ahoraNo = () => { cerrarParaSiempre(); onCerrar() }

  if (abierta) {
    return (
      <div className="puerta-tardia-full">
        <SelectorNivel onElegir={elegir} />
        <button className="btn btn-fantasma puerta-tardia-volver" onClick={ahoraNo}>
          Déjame en «Aprender» por ahora
        </button>
      </div>
    )
  }

  return (
    <div className="puerta-tardia" role="status">
      <div className="puerta-tardia-txt">
        <strong>Eso que acabas de ver fue el nivel «Aprender».</strong>{' '}
        Es el segundo de cuatro: más arriba aparecen los escenarios, los riesgos, la producción
        de las mineras y los documentos que las empresas le entregan a la SMV. Ahora que ya
        sabes de qué va, elige tú.
      </div>
      <div className="puerta-tardia-botones">
        <button className="btn" onClick={() => setAbierta(true)}>🎚️ Ver los 4 niveles</button>
        <button className="btn btn-fantasma" onClick={ahoraNo}>Ahora no</button>
      </div>
    </div>
  )
}
