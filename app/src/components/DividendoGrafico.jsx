import preciosData from '../data/precios.json'

// Mini-comparativa LIMPIA de dividendos: solo 2025 vs 2026, el monto de cada año,
// el precio de la acción (hoy) y el yield. Pensada para enganchar de un vistazo.
// Honesto (Regla #8): 2026 va en curso, así que solo decimos "▲ subió" si este año
// YA superó lo de todo 2025; si no, se marca "en curso" sin inventar una caída.

const ANIO_ACTUAL = new Date().getFullYear()

export default function DividendoGrafico({ dv, ticker }) {
  if (!dv?.porAnioNum) return null
  const sim = dv.anualSim || 'S/'
  const v2025 = dv.porAnioNum['2025'] || 0
  const v2026 = dv.porAnioNum['2026'] || 0
  if (v2025 <= 0 && v2026 <= 0) return null

  const n2025 = dv.nPorAnio?.['2025'] || 0
  const n2026 = dv.nPorAnio?.['2026'] || 0
  const max = Math.max(v2025, v2026) || 1

  const px = preciosData.precios?.[ticker]
  const precioTxt = px && px.precio != null ? `${px.moneda} ${px.precio}` : null

  // "subió" solo si 2026 ya pasó a todo 2025 (comparación honesta de un año en curso)
  const yaSupero = v2025 > 0 && v2026 > v2025
  const subioPct = yaSupero ? ((v2026 - v2025) / v2025) * 100 : null

  const Barra = ({ anio, valor, pagos, enCurso }) => {
    const h = Math.max(10, (valor / max) * 56)
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#D4AF37', marginBottom: 4 }}>
          {sim} {valor.toFixed(2)}
        </div>
        <div style={{
          width: '70%', height: h, borderRadius: '5px 5px 0 0',
          background: enCurso ? 'transparent' : '#D4AF37',
          border: enCurso ? '1.5px dashed #D4AF37' : 'none',
        }} />
        <div style={{ fontSize: 12, color: '#EDE7D2', marginTop: 5 }}>{anio}</div>
        <div className="muted" style={{ fontSize: 11 }}>
          {pagos > 0 ? `${pagos} pago${pagos > 1 ? 's' : ''}` : '—'}{enCurso ? ' · en curso' : ''}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minWidth: 190 }}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
        Dividendo: 2025 vs 2026
      </div>

      <div className="divgraf-pista" style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: 128, padding: '0 6px' }}>
        <Barra anio="2025" valor={v2025} pagos={n2025} enCurso={false} />
        <Barra anio="2026" valor={v2026} pagos={n2026} enCurso={ANIO_ACTUAL === 2026} />
      </div>

      {yaSupero && (
        <div style={{ marginTop: 8, color: '#6FB295', fontSize: 13, fontWeight: 600 }}>
          ▲ subió +{subioPct.toFixed(0)}% <span className="muted" style={{ fontWeight: 400 }}>vs 2025</span>
        </div>
      )}

      {precioTxt && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: '#EDE7D2' }}>
          Acción hoy: <strong>{precioTxt}</strong>
          {dv.yield && <span className="muted"> · rinde {dv.yield}</span>}
        </div>
      )}
    </div>
  )
}
