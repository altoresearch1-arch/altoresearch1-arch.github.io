import { useEffect, useState } from 'react'
import empresasData from '../data/empresas.json'
import { NIVELES } from '../lib/nivel'
import { pasosDesbloqueo, cuentaVisibles } from '../lib/guiontour'

// ─────────────────────────────────────────────────────────────────────────
// ✨ "Acabas de desbloquear N secciones — ¿te las presento?" (mejora #2)
// El instante de subir de nivel dentro de una ficha era el de mayor
// curiosidad del usuario… y la app se quedaba muda: aparecían secciones
// nuevas y nadie las presentaba. Esta tarjetita ofrece un mini-tour SOLO de
// lo recién abierto, con los datos de ESA empresa.
// Se cuenta lo que existe DE VERDAD en esta ficha (una empresa sin producción
// minera ni catalizadores desbloquea menos): si no hay nada nuevo visible, no
// se ofrece nada — mejor callarse que prometer de más.
// ─────────────────────────────────────────────────────────────────────────

export default function OfertaDesbloqueo({ ticker, nivel, onAceptar, onCerrar }) {
  const [cuantas, setCuantas] = useState(null)
  const info = NIVELES.find((n) => n.id === nivel)

  useEffect(() => {
    // esperar a que React pinte las secciones nuevas antes de contarlas
    const e = empresasData.empresas.find((x) => x.ticker === ticker)
    const t = setTimeout(() => setCuantas(cuentaVisibles(pasosDesbloqueo(e, nivel))), 320)
    return () => clearTimeout(t)
  }, [ticker, nivel])

  useEffect(() => {
    if (cuantas === 0) onCerrar()
  }, [cuantas, onCerrar])

  if (!cuantas || !info) return null

  return (
    <div className="desbloqueo" style={{ '--nivel-color': info.color }} role="dialog" aria-label="Secciones desbloqueadas">
      <button className="desbloqueo-x" onClick={onCerrar} aria-label="Ahora no">✕</button>
      <div className="desbloqueo-cab">
        <span className="desbloqueo-icono" aria-hidden="true">{info.elemento}</span>
        <strong>
          ✨ Acabas de desbloquear {cuantas} {cuantas === 1 ? 'sección nueva' : 'secciones nuevas'} en {ticker}
        </strong>
      </div>
      <p className="desbloqueo-txt">
        Nivel {info.icono} <strong>{info.nombre}</strong>. ¿Te las presento una por una, con los
        números de esta empresa? Son {cuantas} pasos — nada más.
      </p>
      <div className="desbloqueo-botones">
        <button className="btn btn-fantasma" onClick={onCerrar}>Ahora no</button>
        <button className="btn btn-oro" onClick={onAceptar}>Sí, muéstramelas 🚶</button>
      </div>
    </div>
  )
}
