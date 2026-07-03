import empresasData from '../data/empresas.json'
import { useFavoritos } from '../lib/favoritos'
import { precioDe } from '../lib/finanzas'

// "Mi lista para estudiar" en el inicio: las empresas que el usuario guardó
// con ★ (viven en su navegador/celular, ver lib/favoritos.js).
export default function MiLista({ onVerEmpresa }) {
  const favoritos = useFavoritos()
  if (favoritos.length === 0) return null
  const empresas = favoritos
    .map((t) => empresasData.empresas.find((e) => e.ticker === t))
    .filter(Boolean)

  return (
    <div className="milista card">
      <div className="milista-cab">
        <h2 style={{ margin: 0 }}>★ Mi lista para estudiar</h2>
        <span className="muted">{empresas.length} guardada{empresas.length === 1 ? '' : 's'}</span>
      </div>
      <div className="milista-chips">
        {empresas.map((e) => {
          const px = precioDe(e.ticker)
          return (
            <button key={e.ticker} className="milista-chip" onClick={() => onVerEmpresa(e.ticker)}>
              <span className="ticker">{e.ticker}</span>
              {px?.precio != null && (
                <span className="muted"> {px.moneda} {px.precio}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
