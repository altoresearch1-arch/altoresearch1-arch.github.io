import { useMemo, useState } from 'react'
import { historicoDe, precioDe } from '../lib/finanzas'

// Gráfico del precio (cierres DIARIOS reales de la BVL, historicos.json).
// Regla de Oro #1: si no hay histórico, no se dibuja nada. La fuente y el
// rango de fechas se muestran siempre.
// `compacto`: versión chica sin selector de rango (para el comparador).

const RANGOS = [
  { id: '3M', meses: 3, texto: '3 meses' },
  { id: '6M', meses: 6, texto: '6 meses' },
  { id: '1A', meses: 12, texto: '1 año' },
]

function fechaCorta(iso) {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a.slice(2)}`
}

export default function Sparkline({ ticker, compacto = false }) {
  const h = historicoDe(ticker)
  const [rango, setRango] = useState(compacto ? '6M' : '6M')

  const serie = useMemo(() => {
    if (!h?.valores?.length) return null
    const meses = RANGOS.find((r) => r.id === rango)?.meses || 6
    const corte = new Date()
    corte.setMonth(corte.getMonth() - meses)
    const iso = corte.toISOString().slice(0, 10)
    const vs = h.valores.filter((v) => v[0] >= iso)
    return vs.length >= 2 ? vs : h.valores
  }, [h, rango])

  if (!serie || serie.length < 2) return null

  const W = 600
  const H = compacto ? 110 : 150
  const PAD = 6
  const cierres = serie.map((v) => v[1])
  const min = Math.min(...cierres)
  const max = Math.max(...cierres)
  const amplitud = max - min || max * 0.01 || 1
  const px = (i) => PAD + (i * (W - PAD * 2)) / (serie.length - 1)
  const py = (v) => PAD + ((max - v) * (H - PAD * 2)) / amplitud

  const puntos = serie.map((v, i) => `${px(i).toFixed(1)},${py(v[1]).toFixed(1)}`)
  const linea = puntos.join(' ')
  const area = `${PAD},${H - PAD} ${linea} ${W - PAD},${H - PAD}`

  const primero = serie[0][1]
  const ultimo = serie[serie.length - 1][1]
  const cambioPct = ((ultimo - primero) / primero) * 100
  const sube = cambioPct >= 0
  // la BVL a veces manda el símbolo vacío en el histórico -> usar el de precios
  const moneda = (h.moneda || '').trim() || precioDe(ticker)?.moneda || ''
  const gid = `grad-${ticker}-${compacto ? 'c' : 'g'}`

  return (
    <div className={'spark' + (compacto ? ' spark-compacto' : '')}>
      {!compacto && (
        <div className="spark-cab">
          <span className="spark-tit">📈 Últimos meses en bolsa</span>
          <span className={'spark-cambio ' + (sube ? 'sube' : 'baja')}>
            {sube ? '▲' : '▼'} {Math.abs(cambioPct).toFixed(1)}%
            <span className="spark-cambio-nota"> en {RANGOS.find((r) => r.id === rango)?.texto}</span>
          </span>
        </div>
      )}
      <div className="spark-svg-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="spark-svg" role="img"
          aria-label={`Precio de ${ticker}: de ${moneda}${primero} a ${moneda}${ultimo}`}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4af37" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#${gid})`} />
          <polyline points={linea} fill="none" stroke="#d4af37" strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round" className="spark-linea" />
          <circle cx={px(serie.length - 1)} cy={py(ultimo)} r="3.5" fill="#e6c965" className="spark-punto" />
        </svg>
        <div className="spark-minmax">
          <span>máx {moneda} {max}</span>
          <span>mín {moneda} {min}</span>
        </div>
      </div>
      <div className="spark-pie">
        <span className="muted">
          {fechaCorta(serie[0][0])} → {fechaCorta(serie[serie.length - 1][0])} · cierres reales BVL
        </span>
        {!compacto && (
          <div className="spark-rangos">
            {RANGOS.map((r) => (
              <button key={r.id}
                className={'spark-rango' + (rango === r.id ? ' on' : '')}
                onClick={() => setRango(r.id)}>
                {r.id}
              </button>
            ))}
          </div>
        )}
      </div>
      {h.pocoNegociada && !compacto && (
        <div className="spark-aviso">
          ⚠️ Esta acción negocia poco: la línea se queda plana los días en que nadie
          compró ni vendió. El último precio puede tener semanas.
        </div>
      )}
      {!compacto && h.min52 != null && h.max52 != null && h.max52 > h.min52 && (
        <Rango52 min={h.min52} max={h.max52} actual={ultimo} moneda={moneda} />
      )}
    </div>
  )
}

// Barra del rango de 12 meses: dónde está el precio actual entre su mínimo y
// máximo del año (todo de cierres reales BVL). Describe, no predice.
function Rango52({ min, max, actual, moneda }) {
  const pos = Math.min(100, Math.max(0, ((actual - min) / (max - min)) * 100))
  return (
    <div className="rango52">
      <div className="rango52-cab">
        <span className="rango52-tit">Rango de 12 meses</span>
        <span className="muted">
          está al {pos.toFixed(0)}% del camino entre su mínimo y su máximo del año
        </span>
      </div>
      <div className="rango52-barra">
        <div className="rango52-relleno" style={{ width: `${pos}%` }} />
        <div className="rango52-marca" style={{ left: `${pos}%` }} />
      </div>
      <div className="rango52-extremos">
        <span>mín {moneda} {min}</span>
        <span>máx {moneda} {max}</span>
      </div>
    </div>
  )
}
