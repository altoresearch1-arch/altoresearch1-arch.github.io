import { useState } from 'react'
import preciosData from '../data/precios.json'
import dividendosData from '../data/dividendos.json'
import epsAnualData from '../data/eps_anual.json'

// Simulador de DIVIDENDOS (al lado del de precio). Pones un monto y te dice cuánto
// recibirías en dividendos al año, en SOLES y en DÓLARES.
function num(n) {
  return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function DividendoSimulador({ empresa }) {
  const px = preciosData.precios?.[empresa.ticker]
  const dv = dividendosData.empresas?.[empresa.ticker]
  const tc = epsAnualData.tipoCambioUSDPEN || 3.4

  const sim = px?.moneda === 'US$' ? 'US$' : 'S/'
  const [monto, setMonto] = useState(sim === 'US$' ? 300 : 1000)

  // Sin precio o sin dividendos no se muestra (Empresa.jsx ya no lo renderiza en ese caso,
  // y el aviso "no da dividendos" lo da el DividendoResumen de arriba).
  if (!px || px.precio == null || !dv || !dv.anualNum || dv.anualNum <= 0) return null

  const acciones = monto > 0 ? monto / px.precio : 0
  const divMon = dv.anualSim || 'S/' // moneda en que paga el dividendo

  // dividendo total recibido para un monto por acción, en AMBAS monedas
  const ambas = (perShare) => {
    if (perShare == null) return null
    const total = acciones * perShare
    const enSoles = divMon === 'S/' ? total : total * tc
    const enDolares = divMon === 'US$' ? total : total / tc
    return { soles: enSoles, dolares: enDolares }
  }

  const anual = ambas(dv.anualNum)
  const d2025 = ambas(dv.porAnioNum?.['2025'])
  const d2026 = ambas(dv.porAnioNum?.['2026'])

  return (
    <div className="sim sim-div">
      <div className="seccion-titulo">💰 Simulador de dividendos</div>

      <div className="sim-monto">
        <label>Si invierto</label>
        <div className="sim-input">
          <span>{sim}</span>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(Number(e.target.value) || 0)}
          />
        </div>
        <div className="muted">≈ {acciones.toFixed(0)} acciones</div>
      </div>

      {anual && (
        <div className="divsim-card">
          <div className="divsim-tit">Al ritmo de un año (rinde {dv.yield})</div>
          <div className="divsim-grande">S/ {num(anual.soles)}</div>
          <div className="divsim-equiv">≈ US$ {num(anual.dolares)}</div>
        </div>
      )}

      <div className="divsim-comp">
        {d2025 && (
          <div className="divsim-fila">
            <span className="divsim-a">Como en 2025</span>
            <span>S/ {num(d2025.soles)} <span className="muted">≈ US$ {num(d2025.dolares)}</span></span>
          </div>
        )}
        {d2026 && (
          <div className="divsim-fila">
            <span className="divsim-a">2026 (hasta hoy)</span>
            <span>S/ {num(d2026.soles)} <span className="muted">≈ US$ {num(d2026.dolares)}</span></span>
          </div>
        )}
      </div>

      <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
        {divMon === 'US$'
          ? 'Esta empresa paga el dividendo en dólares; la conversión a soles usa el tipo de cambio ' + tc + '.'
          : 'El equivalente en dólares usa el tipo de cambio ' + tc + '.'}{' '}
        El dividendo no está garantizado: depende de cómo le vaya a la empresa.
      </div>
    </div>
  )
}
