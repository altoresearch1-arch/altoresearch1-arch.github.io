import { useEffect, useMemo, useState } from 'react'
import empresasData from '../data/empresas.json'
import { variacionesDia, yieldNumerico, historicoDe, pagaDividendos } from '../lib/finanzas'
import { prefiereQuieto } from '../lib/anim'

// 🎣 "¿Sabías que…?": ganchos de CURIOSIDAD para el hero de los niveles 1-2.
// Cada dato es 100% real y calculado al vuelo de los mismos JSON del robot
// (nada redactado a mano = nada que se pueda vencer). Rota solo cada 5.5 s
// (con prefers-reduced-motion no rota: puntos manuales), y tocar el dato
// abre la ficha de esa empresa — el anzuelo lleva directo al contenido.
const MS_ROTA = 5500

export default function GanchoDatos({ onVerEmpresa }) {
  const datos = useMemo(() => {
    const lista = []
    const { filas } = variacionesDia(empresasData.empresas)

    // 1) La que más saltó en el último cierre
    const top = filas[0]
    if (top && top.pct > 0.5) {
      lista.push({
        texto: <>La acción de <strong>{top.nombre}</strong> saltó <strong className="sube">▲{top.pct.toFixed(1)}%</strong> en el último cierre de la BVL.</>,
        ticker: top.ticker,
      })
    }
    // 2) La que más cayó (el susto también engancha)
    const peor = filas[filas.length - 1]
    if (peor && peor.pct < -0.5) {
      lista.push({
        texto: <>La acción de <strong>{peor.nombre}</strong> cayó <strong className="baja">▼{Math.abs(peor.pct).toFixed(1)}%</strong> en el último cierre. ¿Por qué será?</>,
        ticker: peor.ticker,
      })
    }
    // 3) El dividendo más jugoso (dejando fuera los extraordinarios >20%)
    let mejorYield = null
    for (const e of empresasData.empresas) {
      const y = yieldNumerico(e.ticker)
      if (y != null && y <= 20 && (!mejorYield || y > mejorYield.y)) mejorYield = { e, y }
    }
    if (mejorYield) {
      lista.push({
        texto: <>Los dividendos de <strong>{mejorYield.e.nombre}</strong> rinden <strong className="sube">{mejorYield.y.toFixed(1)}% al año</strong> a su precio actual.</>,
        ticker: mejorYield.e.ticker,
      })
    }
    // 4) La montaña rusa más brava (volatilidad real de 12 meses)
    let brava = null
    for (const e of empresasData.empresas) {
      const h = historicoDe(e.ticker)
      if (h?.volatilidadEtiqueta === 'montaña rusa' && (!brava || h.volatilidadAnualPct > brava.v)) {
        brava = { e, v: h.volatilidadAnualPct }
      }
    }
    if (brava) {
      lista.push({
        texto: <><strong>{brava.e.nombre}</strong> es la montaña rusa de la app: su precio se movió <strong>±{Math.round(brava.v)}%</strong> en un año.</>,
        ticker: brava.e.ticker,
      })
    }
    // 5) Cuántas reparten dividendos (invita a explorar)
    const nPagan = empresasData.empresas.filter((e) => pagaDividendos(e.ticker)).length
    if (nPagan > 0) {
      lista.push({
        texto: <><strong>{nPagan} de las {empresasData.empresas.length}</strong> empresas de la app reparten dividendos — te pagan por ser socio.</>,
        ticker: null,
      })
    }
    return lista
  }, [])

  const [i, setI] = useState(0)
  // Si el usuario elige un punto a mano, la rotación automática se APAGA:
  // nada de moverle el dato bajo el dedo justo cuando iba a tocarlo.
  const [manual, setManual] = useState(false)
  useEffect(() => {
    if (manual || prefiereQuieto() || datos.length < 2) return
    const t = setInterval(() => setI((v) => (v + 1) % datos.length), MS_ROTA)
    return () => clearInterval(t)
  }, [datos.length, manual])

  if (!datos.length) return null
  const d = datos[i]

  return (
    <div className="gancho">
      <span className="gancho-etq">🎣 ¿Sabías que…?</span>
      <button
        key={i}
        type="button"
        className={'gancho-dato' + (d.ticker ? '' : ' sin-link')}
        onClick={() => d.ticker && onVerEmpresa(d.ticker)}
      >
        <span className="gancho-texto">{d.texto}</span>
        {d.ticker && <span className="gancho-ver">ver su ficha →</span>}
      </button>
      {datos.length > 1 && (
        <div className="gancho-puntos" role="tablist" aria-label="Más datos">
          {datos.map((_, j) => (
            <button
              key={j}
              type="button"
              className={'gancho-punto' + (j === i ? ' activo' : '')}
              aria-label={`Dato ${j + 1}`}
              onClick={() => {
                setManual(true)
                setI(j)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
