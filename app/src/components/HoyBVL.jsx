import { useMemo } from 'react'
import empresasData from '../data/empresas.json'
import { variacionesDia } from '../lib/finanzas'

// "Así cerró la BVL": variación del último cierre vs el previo, SOLO con
// datos reales de precios.json (el cálculo vive en lib/finanzas.variacionesDia,
// compartido con la cinta bursátil del inicio). Las que no negociaron ese día
// quedan fuera del ranking (su variación sería vieja).

function fechaCorta(iso) {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

export default function HoyBVL({ onVerEmpresa }) {
  const { movidas, subieron, bajaron, planas, fecha } = useMemo(() => {
    const { filas, subieron, bajaron, planas, fecha } = variacionesDia(empresasData.empresas)
    const conCambio = filas.filter((f) => Math.abs(f.pct) > 0.001)
    const top = conCambio.slice(0, 3)
    const bottom = conCambio.slice(-3).reverse().filter((f) => !top.includes(f))
    return { movidas: { top, bottom }, subieron, bajaron, planas, fecha }
  }, [])

  if (!movidas.top.length && !movidas.bottom.length) return null

  const Fila = ({ f }) => (
    <button className="hoy-fila" onClick={() => onVerEmpresa(f.ticker)}>
      <span className="hoy-ticker">{f.ticker}</span>
      <span className="hoy-nombre">{f.nombre}</span>
      <span className="hoy-precio muted">{f.moneda} {f.precio}</span>
      <span className={'hoy-pct ' + (f.pct >= 0 ? 'sube' : 'baja')}>
        {f.pct >= 0 ? '▲' : '▼'} {Math.abs(f.pct).toFixed(1)}%
      </span>
    </button>
  )

  return (
    <div className="hoy card">
      <div className="hoy-cab">
        <h2 style={{ margin: 0 }}>📊 Así cerró la BVL</h2>
        {fecha && <span className="muted">cierre del {fechaCorta(fecha)}</span>}
      </div>
      <p className="muted" style={{ margin: '4px 0 10px' }}>
        De nuestras {empresasData.empresas.length}, ese día negociaron con cambio:{' '}
        <span className="sube">{subieron} subieron</span> ·{' '}
        <span className="baja">{bajaron} bajaron</span>
        {planas > 0 && <> · {planas} sin cambio</>}. Toca una para estudiarla.
      </p>
      <div className="hoy-cols">
        {movidas.top.length > 0 && (
          <div>
            <div className="hoy-tit sube">Subieron más</div>
            {movidas.top.map((f) => <Fila key={f.ticker} f={f} />)}
          </div>
        )}
        {movidas.bottom.length > 0 && (
          <div>
            <div className="hoy-tit baja">Bajaron más</div>
            {movidas.bottom.map((f) => <Fila key={f.ticker} f={f} />)}
          </div>
        )}
      </div>
      <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
        Variación del último cierre vs el cierre previo (BVL). Un día no hace
        tendencia: sirve para mirar, no para correr a comprar.
      </p>
    </div>
  )
}
