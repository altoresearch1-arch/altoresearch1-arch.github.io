import dividendosData from '../data/dividendos.json'
import DividendoGrafico from './DividendoGrafico'
import { precioEnFecha } from '../lib/finanzas'

// Resumen de dividendos (parte de ARRIBA de la ficha). Muestra los pagos INDIVIDUALES
// con su fecha (estilo stockanalysis), NO sumados, destacando el/los de este año (2026),
// y una nota: cuántas veces pagó el año pasado y si va a mantener el ritmo.

const ANIO_ACTUAL = new Date().getFullYear()

const MESES = {
  Jan: 'ene', Feb: 'feb', Mar: 'mar', Apr: 'abr', May: 'may', Jun: 'jun',
  Jul: 'jul', Aug: 'ago', Sep: 'sep', Oct: 'oct', Nov: 'nov', Dec: 'dic',
}

const MES_NUM = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
}

// "Aug 4, 2026" -> { texto:'4 ago 2026', anio:'2026', iso:'2026-08-04' }
function parseFecha(f) {
  const m = /([A-Za-z]{3})\s+(\d{1,2}),\s+(20\d\d)/.exec(f || '')
  if (!m) return { texto: f, anio: null, iso: null }
  const iso = MES_NUM[m[1]] ? `${m[3]}-${MES_NUM[m[1]]}-${m[2].padStart(2, '0')}` : null
  return { texto: `${m[2]} ${MESES[m[1]] || m[1]} ${m[3]}`, anio: m[3], iso }
}

// monto por acción con hasta 4 decimales, sin ceros sobrantes (0.53249 -> 0.5325)
function fmtMonto(n, mon) {
  const s = Number(n).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
  return `${mon} ${s}`
}

function vez(n) {
  return n === 1 ? 'vez' : 'veces'
}

export default function DividendoResumen({ empresa }) {
  const dv = dividendosData.empresas?.[empresa.ticker]

  const t2025 = dv?.porAnio?.['2025']
  const n2025 = dv?.nPorAnio?.['2025'] || 0
  const n2026 = dv?.nPorAnio?.['2026'] || 0
  const paga = !!(dv && ((dv.anualNum && dv.anualNum > 0) || t2025 || dv.porAnio?.['2026']))

  if (!paga) {
    return (
      <div className="divres divres-no">
        💰 Esta empresa no reparte dividendos (al menos no de forma reciente).
      </div>
    )
  }

  // Pagos individuales (los más recientes), con fecha. NO sumados.
  const pagos = (dv.historial || []).map((h) => ({ ...h, ...parseFecha(h.fecha) })).slice(0, 6)

  // Nota comparativa: este año vs el año pasado.
  let nota
  if (n2026 > 0) {
    nota = `Este año (2026) ya pagó ${n2026} ${vez(n2026)}. El año pasado pagó ${n2025} ${vez(n2025)}`
      + (t2025 ? ` (${t2025} en total)` : '')
      + ` — veremos si mantiene el ritmo este año.`
  } else if (n2025 > 0) {
    nota = `Todavía no paga en 2026. El año pasado pagó ${n2025} ${vez(n2025)}`
      + (t2025 ? ` (${t2025} en total)` : '')
      + ` — veremos si vuelve a pagar este año.`
  }

  return (
    <div className="divres">
      <div className="divres-cab">
        💰 Sí paga dividendos
        {dv.yield && <span className="divres-yield">rinde {dv.yield} al año</span>}
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 22 }}>
        <div style={{ flex: '1 1 240px', minWidth: 220 }}>
          <div className="muted" style={{ fontSize: 12, margin: '2px 0 6px' }}>
            Pagos por acción (cada entrega por separado, con su fecha):
          </div>
          <div className="divres-pagos">
            {pagos.map((p, i) => {
              // Para los pagos del AÑO PASADO mostramos cuánto costaba la
              // acción ese día (cierre real BVL de historicos.json).
              const esAnioPasado = p.anio === String(ANIO_ACTUAL - 1)
              const pxDia = esAnioPasado && p.iso ? precioEnFecha(empresa.ticker, p.iso) : null
              return (
                <div
                  key={i}
                  className="divres-pago"
                  style={{
                    padding: '4px 0', borderBottom: '1px solid rgba(212,175,55,0.12)',
                    opacity: p.anio === String(ANIO_ACTUAL) ? 1 : 0.7,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span>
                      {p.anio === String(ANIO_ACTUAL) && <span style={{ color: '#D4AF37', marginRight: 6 }} title="pago de este año">●</span>}
                      <span className="divres-a">{p.texto}</span>
                      {p.anio === String(ANIO_ACTUAL) && <span style={{ color: '#D4AF37', fontSize: 11, marginLeft: 6 }}>este año</span>}
                    </span>
                    <strong>{fmtMonto(p.monto, p.moneda)}</strong>
                  </div>
                  {pxDia && (
                    <div className="divres-pxdia">
                      la acción costaba {pxDia.moneda} {pxDia.precio} ese día
                      {pxDia.fecha !== p.iso && ' (último cierre previo)'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ flex: '1 1 200px', minWidth: 190 }}>
          <DividendoGrafico dv={dv} ticker={empresa.ticker} />
        </div>
      </div>

      {nota && (
        <div className="divres-pend" style={{ marginTop: 8 }}>
          📌 {nota}
        </div>
      )}
      {(() => {
        // yields altísimos casi siempre son un pago EXTRAORDINARIO (o un precio
        // viejo por falta de negociación): avisarlo, no venderlo como normal.
        const y = parseFloat(String(dv.yield || '').replace('%', ''))
        if (!(y > 20)) return null
        return (
          <div className="divres-pend" style={{ marginTop: 8 }}>
            ⚠️ Un rendimiento así de alto ({dv.yield}) casi siempre viene de un pago
            EXTRAORDINARIO (o de un precio desactualizado por poca negociación) — no
            asumas que se repite cada año.
          </div>
        )
      })()}
    </div>
  )
}
