import { useMemo } from 'react'
import empresasData from '../data/empresas.json'
import quiz from '../data/quiz.json'
import tesisData from '../data/tesis.json'
import { precioDe } from '../lib/finanzas'

// "Empresa del día": rotación DETERMINÍSTICA por fecha (mismo día = misma
// empresa para todos). No es recomendación: es una invitación a estudiar
// una distinta cada día — en 48 días las conoces todas.

function indiceDelDia(n) {
  const hoy = new Date()
  const clave = `${hoy.getFullYear()}-${hoy.getMonth() + 1}-${hoy.getDate()}`
  let h = 0
  for (const c of clave) h = (h * 31 + c.charCodeAt(0)) % 100000
  return h % n
}

export default function EmpresaDelDia({ onVerEmpresa }) {
  const e = useMemo(() => {
    const lista = empresasData.empresas
    return lista[indiceDelDia(lista.length)]
  }, [])
  if (!e) return null
  const px = precioDe(e.ticker)
  const tesis = tesisData.tesis?.[e.ticker]

  return (
    <div className="empdia card">
      <div className="empdia-kicker">🎯 Empresa del día</div>
      <div className="empdia-fila">
        <div style={{ flex: 1 }}>
          <span className="ticker" style={{ fontSize: 19 }}>{e.ticker}</span>
          <span className="badge parcial" style={{ marginLeft: 8 }}>
            {quiz.sectores[e.sector] || e.sector}
          </span>
          <div className="muted">{e.nombre}</div>
        </div>
        {px?.precio != null && (
          <div className="empdia-precio oro">{px.moneda} {px.precio}</div>
        )}
      </div>
      {tesis && <div className="empdia-tesis">{tesis}</div>}
      <button className="btn btn-oro" style={{ marginTop: 12 }} onClick={() => onVerEmpresa(e.ticker)}>
        Estudiarla →
      </button>
      <span className="muted empdia-nota">
        Mañana toca otra — en {empresasData.empresas.length} días las conoces todas.
      </span>
    </div>
  )
}
