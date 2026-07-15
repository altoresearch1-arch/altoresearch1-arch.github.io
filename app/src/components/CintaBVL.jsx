import { useMemo } from 'react'
import empresasData from '../data/empresas.json'
import { variacionesDia } from '../lib/finanzas'

// 📟 Cinta bursátil del inicio (estilo TradingView/Bloomberg): una tira que
// desfila con TODAS las que negociaron con cambio en el último cierre.
// Es el latido del mercado apenas entras — y cada chip abre su ficha.
// CSS puro (@keyframes cintaDesfila): el contenido va DUPLICADO para que el
// bucle sea perfecto (cuando la primera copia salió entera, la segunda está
// exactamente donde empezó la primera). Se pausa al pasar el cursor o tocar,
// y con prefers-reduced-motion queda quieta con scroll manual.
export default function CintaBVL({ onVerEmpresa }) {
  const filas = useMemo(() => {
    const { filas } = variacionesDia(empresasData.empresas)
    return filas.filter((f) => Math.abs(f.pct) > 0.001)
  }, [])

  if (filas.length < 4) return null

  // velocidad constante por chip (~2.6 s cada uno): con 30 chips ≈ 78 s la vuelta
  const duracion = Math.max(30, Math.round(filas.length * 2.6))

  const Chips = ({ ariaOculto }) => (
    <div className="cinta-grupo" aria-hidden={ariaOculto || undefined}>
      {filas.map((f) => (
        <button
          key={f.ticker + (ariaOculto ? '-b' : '')}
          type="button"
          className="cinta-chip"
          tabIndex={ariaOculto ? -1 : undefined}
          onClick={() => onVerEmpresa(f.ticker)}
        >
          <span className="cinta-ticker">{f.ticker}</span>
          <span className={'cinta-pct ' + (f.pct >= 0 ? 'sube' : 'baja')}>
            {f.pct >= 0 ? '▲' : '▼'}{Math.abs(f.pct).toFixed(1)}%
          </span>
        </button>
      ))}
    </div>
  )

  return (
    <div className="cinta" aria-label="Último cierre de la BVL, empresa por empresa">
      <div className="cinta-pista" style={{ '--cinta-dur': `${duracion}s` }}>
        <Chips />
        <Chips ariaOculto />
      </div>
    </div>
  )
}
