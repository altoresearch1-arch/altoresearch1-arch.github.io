import { useEffect, useMemo, useState } from 'react'
import empresasData from '../data/empresas.json'
import quiz from '../data/quiz.json'
import tipsData from '../data/tips.json'
import { precioDe, pagaDividendos, yieldNumerico, historicoDe } from '../lib/finanzas'
import { Reveal } from '../lib/anim'
import { useFavoritos, alternarFavorito } from '../lib/favoritos'
import RelojPrecios from './RelojPrecios'

// Explorador: buscador + filtros + orden sobre las 48 empresas, y selección
// de 2 para el comparador. Solo hechos (precio, yield, liquidez) — sin ranking
// de "mejores": la app educa, no recomienda.

const ORDEN_SECTORES = ['minas', 'bancos', 'afp', 'alimentos', 'electricas', 'cemento', 'retail', 'diversas', 'fondos', 'textil', 'acereras', 'pesqueras']

// quita tildes y baja a minúsculas para buscar "atacocha" o "unión"
// (NFD separa la tilde de la letra; ̀-ͯ son los acentos combinantes)
function normalizar(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export default function Explorar({ onVerEmpresa, onComparar }) {
  const [busqueda, setBusqueda] = useState('')
  const [sectorSel, setSectorSel] = useState('todos')
  const [soloDividendos, setSoloDividendos] = useState(false)
  const [soloLiquidas, setSoloLiquidas] = useState(false)
  const [soloGuardadas, setSoloGuardadas] = useState(false)
  const [orden, setOrden] = useState('sector') // sector | ticker | yield
  const [paraComparar, setParaComparar] = useState([])
  const favoritos = useFavoritos()

  // Orden aleatorio FIJO por visita (una sola vez al entrar): así la primera
  // empresa que ves cambia cada vez —antes siempre salía Nexa— sin re-barajar
  // mientras filtras o buscas. Se usa como desempate dentro de cada sector.
  const mezcla = useMemo(() => {
    const m = {}
    for (const e of empresasData.empresas) m[e.ticker] = Math.random()
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sectores = ORDEN_SECTORES.filter((s) =>
    empresasData.empresas.some((e) => e.sector === s)
  )

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda)
    let lista = empresasData.empresas.filter((e) => {
      if (sectorSel !== 'todos' && e.sector !== sectorSel) return false
      if (soloDividendos && !pagaDividendos(e.ticker)) return false
      if (soloLiquidas && historicoDe(e.ticker)?.pocoNegociada) return false
      if (soloGuardadas && !favoritos.includes(e.ticker)) return false
      if (q && !normalizar(e.ticker).includes(q) && !normalizar(e.nombre).includes(q)) return false
      return true
    })
    if (orden === 'ticker') {
      lista = [...lista].sort((a, b) => a.ticker.localeCompare(b.ticker))
    } else if (orden === 'yield') {
      lista = [...lista].sort(
        (a, b) => (yieldNumerico(b.ticker) ?? -1) - (yieldNumerico(a.ticker) ?? -1)
      )
    } else {
      // por sector, pero DENTRO de cada sector el orden es aleatorio por visita
      // (antes quedaba fijo el de empresas.json → siempre Nexa primero)
      lista = [...lista].sort((a, b) => {
        const d = ORDEN_SECTORES.indexOf(a.sector) - ORDEN_SECTORES.indexOf(b.sector)
        return d !== 0 ? d : mezcla[a.ticker] - mezcla[b.ticker]
      })
    }
    return lista
  }, [busqueda, sectorSel, soloDividendos, soloLiquidas, soloGuardadas, favoritos, orden, mezcla])

  const alternarComparar = (ticker) => {
    setParaComparar((sel) => {
      if (sel.includes(ticker)) return sel.filter((t) => t !== ticker)
      if (sel.length >= 2) return sel // por ahora solo 2 (el cuadro lo avisa)
      return [...sel, ticker]
    })
  }

  // Con las 2 elegidas: cuadro "¡Listas!" y se abre el comparador solito
  // (pausa breve para que se vea el check; la ✕ cancela a tiempo).
  useEffect(() => {
    if (paraComparar.length !== 2) return
    const timer = setTimeout(() => onComparar(paraComparar), 1100)
    return () => clearTimeout(timer)
  }, [paraComparar, onComparar])

  return (
    <div>
      <div className="card">
        <h1 style={{ marginBottom: 4 }}>🔎 Explora las {empresasData.empresas.length} empresas</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Busca, filtra y elige 2 para compararlas lado a lado. Todo para{' '}
          <strong>estudiar</strong> — no es recomendación.
        </p>

        <RelojPrecios />

        <input
          className="explorar-busqueda"
          type="search"
          placeholder="Busca por ticker o nombre… (ej. BVN, Gloria, cemento…)"
          value={busqueda}
          onChange={(ev) => setBusqueda(ev.target.value)}
          autoComplete="off"
        />

        <div className="explorar-chips">
          <button
            className={'chip' + (sectorSel === 'todos' ? ' on' : '')}
            onClick={() => setSectorSel('todos')}
          >
            Todos
          </button>
          {sectores.map((s) => (
            <button
              key={s}
              className={'chip' + (sectorSel === s ? ' on' : '')}
              onClick={() => setSectorSel(sectorSel === s ? 'todos' : s)}
            >
              {quiz.sectores[s] || s}
            </button>
          ))}
        </div>

        <div className="explorar-filtros">
          <button
            className={'chip chip-filtro' + (soloDividendos ? ' on' : '')}
            onClick={() => setSoloDividendos((v) => !v)}
          >
            💰 Paga dividendos
          </button>
          <button
            className={'chip chip-filtro' + (soloLiquidas ? ' on' : '')}
            onClick={() => setSoloLiquidas((v) => !v)}
          >
            🔄 Negocia seguido
          </button>
          {favoritos.length > 0 && (
            <button
              className={'chip chip-filtro' + (soloGuardadas ? ' on' : '')}
              onClick={() => setSoloGuardadas((v) => !v)}
            >
              ★ Mi lista ({favoritos.length})
            </button>
          )}
          <label className="explorar-orden">
            Ordenar:
            <select value={orden} onChange={(ev) => setOrden(ev.target.value)}>
              <option value="sector">por sector</option>
              <option value="ticker">A → Z</option>
              <option value="yield">por dividendo (yield)</option>
            </select>
          </label>
        </div>

        <div className="muted" style={{ margin: '10px 0 4px' }}>
          {filtradas.length === 0
            ? 'Ninguna empresa coincide con esos filtros.'
            : `${filtradas.length} empresa${filtradas.length === 1 ? '' : 's'}`}
        </div>

        {filtradas.map((e, i) => {
          const px = precioDe(e.ticker)
          const h = historicoDe(e.ticker)
          const yld = yieldNumerico(e.ticker)
          const enComparacion = paraComparar.includes(e.ticker)
          return (
            <Reveal key={e.ticker} retraso={Math.min(i, 6) * 40}>
              <div className="card empresa-item" onClick={() => onVerEmpresa(e.ticker)}>
                <div style={{ flex: 1 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="ticker">{e.ticker}</span>
                    <span className="badge parcial">{quiz.sectores[e.sector] || e.sector}</span>
                    {yld != null && yld > 0 && (
                      <span className="badge badge-yield">💰 {yld}%</span>
                    )}
                    {h?.pocoNegociada && (
                      <span className="badge badge-ilq">poco negociada</span>
                    )}
                  </div>
                  <div className="muted">{e.nombre}</div>
                  {tipsData.tips?.[e.ticker]?.[0] && (
                    <div className="empresa-tip">💡 {tipsData.tips[e.ticker][0]}</div>
                  )}
                </div>
                <div className="explorar-derecha">
                  <span className="explorar-precio">
                    {px?.precio != null ? (
                      <>{px.moneda} <strong>{px.precio}</strong></>
                    ) : (
                      <span className="muted">Sin cotización</span>
                    )}
                  </span>
                  <button
                    className={'btn-estrella' + (favoritos.includes(e.ticker) ? ' on' : '')}
                    title={favoritos.includes(e.ticker) ? 'Quitar de mi lista' : 'Guardar en mi lista'}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      alternarFavorito(e.ticker)
                    }}
                  >
                    {favoritos.includes(e.ticker) ? '★' : '☆'}
                  </button>
                  <button
                    className={'btn-comparar' + (enComparacion ? ' on' : '')}
                    title={enComparacion ? 'Quitar de la comparación' : 'Elegir para comparar'}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      alternarComparar(e.ticker)
                    }}
                  >
                    ⚖ {enComparacion ? '✓' : '+'}
                  </button>
                  <span className="oro">›</span>
                </div>
              </div>
            </Reveal>
          )
        })}
      </div>

      {/* Cuadro flotante de comparación */}
      {paraComparar.length === 1 && (
        <div className="comparar-barra">
          <span className="comparar-barra-txt">
            ⚖ <strong>{paraComparar[0]}</strong>
            <span className="muted"> · elige otra para comparar (por ahora solo 2)</span>
          </span>
          <button className="btn btn-fantasma btn-chico" onClick={() => setParaComparar([])}>
            ✕
          </button>
        </div>
      )}
      {paraComparar.length === 2 && (
        <div className="comparar-barra comparar-lista">
          <span className="comparar-check">✓</span>
          <span className="comparar-barra-txt">
            <strong>¡Listas para comparar!</strong>
            <span className="comparar-sub">{paraComparar[0]} vs {paraComparar[1]} · abriendo…</span>
          </span>
          <button
            className="btn btn-fantasma btn-chico"
            title="Cancelar"
            onClick={() => setParaComparar([])}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
