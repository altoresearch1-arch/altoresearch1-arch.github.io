import { useMemo, useState } from 'react'
import { historicoDe, precioDe } from '../lib/finanzas'

// Gráfico del precio (cierres DIARIOS reales de la BVL, historicos.json),
// estilo BEM (pedido de Jair: "todas las gráficas como el BEM"): eje Y con
// precios, grilla punteada, fechas en el eje X y lectura al pasar el
// dedo/cursor. Regla de Oro #1: si no hay histórico, no se dibuja nada.

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

// Precio para el eje: sin decimales de sobra (S/ 304 no necesita ".00";
// una acción de S/ 0.9 sí necesita sus centavos).
function fmtPrecio(v) {
  if (v >= 100) return Math.round(v).toLocaleString('es-PE')
  if (v >= 10) return v.toFixed(1)
  if (v >= 1) return v.toFixed(2)
  return v.toFixed(3)
}

export default function Sparkline({ ticker, compacto = false }) {
  const h = historicoDe(ticker)
  const [rango, setRango] = useState('6M')
  const [hover, setHover] = useState(null)

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
  const H = compacto ? 110 : 180
  const PADL = compacto ? 6 : 48
  const PADR = compacto ? 6 : 8
  const PADT = 8
  const PADB = compacto ? 6 : 22
  const cierres = serie.map((v) => v[1])
  const min = Math.min(...cierres)
  const max = Math.max(...cierres)
  const amplitud = max - min || max * 0.01 || 1
  const px = (i) => PADL + (i * (W - PADL - PADR)) / (serie.length - 1)
  const py = (v) => PADT + ((max - v) * (H - PADT - PADB)) / amplitud

  const puntos = serie.map((v, i) => `${px(i).toFixed(1)},${py(v[1]).toFixed(1)}`)
  const linea = puntos.join(' ')
  const area = `${PADL},${H - PADB} ${linea} ${W - PADR},${H - PADB}`

  const primero = serie[0][1]
  const ultimo = serie[serie.length - 1][1]
  const cambioPct = ((ultimo - primero) / primero) * 100
  const sube = cambioPct >= 0
  // la BVL a veces manda el símbolo vacío en el histórico -> usar el de precios
  const moneda = (h.moneda || '').trim() || precioDe(ticker)?.moneda || ''
  const gid = `grad-${ticker}-${compacto ? 'c' : 'g'}`

  // Fechas del eje X: inicio, ~⅓, ~⅔ y fin del rango
  const iTicks = compacto ? [] : [0, Math.round((serie.length - 1) / 3),
    Math.round(((serie.length - 1) * 2) / 3), serie.length - 1]

  // Lectura al pasar el cursor/dedo (día más cercano)
  const moverHover = (ev) => {
    const rect = ev.currentTarget.getBoundingClientRect()
    const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left
    const xRel = (cx / rect.width) * W
    const i = Math.round(((xRel - PADL) / (W - PADL - PADR)) * (serie.length - 1))
    setHover(Math.min(serie.length - 1, Math.max(0, i)))
  }
  const hv = hover != null ? serie[hover] : null

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
        <svg viewBox={`0 0 ${W} ${H}`} className="spark-svg" role="img"
          aria-label={`Precio de ${ticker}: de ${moneda}${primero} a ${moneda}${ultimo}`}
          onMouseMove={compacto ? undefined : moverHover}
          onMouseLeave={compacto ? undefined : () => setHover(null)}
          onTouchStart={compacto ? undefined : moverHover}
          onTouchMove={compacto ? undefined : moverHover}
          onTouchEnd={compacto ? undefined : () => setHover(null)}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4af37" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* grilla punteada con el PRECIO en el eje (estilo BEM) */}
          {!compacto && [0, 1 / 3, 2 / 3, 1].map((f) => {
            const v = min + amplitud * (1 - f)
            return (
              <g key={f}>
                <line x1={PADL} x2={W - PADR} y1={py(v)} y2={py(v)}
                  stroke="rgba(212,175,55,0.16)" strokeWidth="1" strokeDasharray="2 4" />
                <text x={PADL - 7} y={py(v) + 3.5} textAnchor="end" className="prodmin-ytick">
                  {fmtPrecio(v)}
                </text>
              </g>
            )
          })}
          {/* fechas en el eje X */}
          {iTicks.map((i, k) => (
            <text key={k} x={px(i)} y={H - 7}
              textAnchor={k === 0 ? 'start' : k === iTicks.length - 1 ? 'end' : 'middle'}
              className="prodmin-tick spark-fecha-eje">
              {fechaCorta(serie[i][0])}
            </text>
          ))}
          {/* guía del hover */}
          {hv && (
            <line x1={px(hover)} x2={px(hover)} y1={PADT} y2={H - PADB}
              stroke="rgba(244,241,233,0.35)" strokeWidth="1" strokeDasharray="3 3" />
          )}
          <polygon points={area} fill={`url(#${gid})`} />
          <polyline points={linea} fill="none" stroke="#d4af37" strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round" className="spark-linea" />
          {hv && <circle cx={px(hover)} cy={py(hv[1])} r="4" fill="#e6c965" />}
          <circle cx={px(serie.length - 1)} cy={py(ultimo)} r="3.5" fill="#e6c965" className="spark-punto" />
          <circle cx={px(serie.length - 1)} cy={py(ultimo)} r="6" fill="none"
            stroke="#e6c965" strokeWidth="1.3" opacity="0.7" />
        </svg>
        {compacto && (
          <div className="spark-minmax">
            <span>máx {moneda} {max}</span>
            <span>mín {moneda} {min}</span>
          </div>
        )}
      </div>
      {/* Lectura del día bajo el cursor/dedo */}
      {hv && !compacto && (
        <div className="prodmin-lectura">
          <strong>{fechaCorta(hv[0])}</strong>
          <span className="prodmin-lectura-item">
            <span className="prodmin-dot" style={{ background: '#d4af37' }} />
            {moneda} {hv[1]}
          </span>
          <span className={'prodmin-lectura-item ' + (hv[1] >= primero ? 'sube' : 'baja')}>
            {hv[1] >= primero ? '▲' : '▼'} {Math.abs(((hv[1] - primero) / primero) * 100).toFixed(1)}%
            <span className="muted"> desde el inicio del rango</span>
          </span>
        </div>
      )}
      <div className="spark-pie">
        <span className="muted">
          {fechaCorta(serie[0][0])} → {fechaCorta(serie[serie.length - 1][0])} · cierres reales BVL
          {!compacto && ' · pasa el dedo o el cursor para leer cada día'}
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
