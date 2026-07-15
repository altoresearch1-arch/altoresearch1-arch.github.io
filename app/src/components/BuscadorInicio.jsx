import { useMemo, useRef, useState } from 'react'
import empresasData from '../data/empresas.json'
import quiz from '../data/quiz.json'

// 🔎 Buscador exprés del inicio: escribe "bvn", "southern" o "cerveza" y entra
// directo a la ficha. Es el camino más corto para TODOS los públicos (el que
// recién llega no sabe qué es un ticker; el pro no quiere navegar menús).
// Busca en ticker + nombre + sector, sin acentos, máximo 6 sugerencias.

const sinTildes = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function BuscadorInicio({ onVerEmpresa }) {
  const [texto, setTexto] = useState('')
  const [foco, setFoco] = useState(false)
  const inputRef = useRef(null)

  const resultados = useMemo(() => {
    const q = sinTildes(texto.trim())
    if (q.length < 2) return []
    return empresasData.empresas
      .map((e) => {
        const ticker = sinTildes(e.ticker)
        const nombre = sinTildes(e.nombre)
        const sector = sinTildes(quiz.sectores[e.sector] || e.sector)
        // ranking simple: ticker exacto > ticker empieza > nombre empieza > contiene
        let peso = -1
        if (ticker === q) peso = 4
        else if (ticker.startsWith(q)) peso = 3
        else if (nombre.startsWith(q)) peso = 2
        else if (ticker.includes(q) || nombre.includes(q) || sector.includes(q)) peso = 1
        return { e, peso }
      })
      .filter((r) => r.peso > 0)
      .sort((a, b) => b.peso - a.peso || a.e.ticker.localeCompare(b.e.ticker))
      .slice(0, 6)
  }, [texto])

  const abrir = (ticker) => {
    setTexto('')
    inputRef.current?.blur()
    onVerEmpresa(ticker)
  }

  return (
    <div className="buscar-inicio">
      <div className="buscar-inicio-caja">
        <span className="buscar-inicio-lupa" aria-hidden="true">🔎</span>
        <input
          ref={inputRef}
          type="search"
          value={texto}
          onChange={(ev) => setTexto(ev.target.value)}
          onFocus={() => setFoco(true)}
          onBlur={() => setTimeout(() => setFoco(false), 150) /* deja llegar el clic a la sugerencia */}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' && resultados.length > 0) abrir(resultados[0].e.ticker)
            if (ev.key === 'Escape') setTexto('')
          }}
          placeholder={`Busca entre las ${empresasData.empresas.length}: BVN, Southern, cerveza…`}
          aria-label="Buscar una empresa"
        />
      </div>
      {foco && resultados.length > 0 && (
        <div className="buscar-inicio-lista">
          {resultados.map(({ e }) => (
            <button key={e.ticker} type="button" onClick={() => abrir(e.ticker)}>
              <span className="buscar-inicio-ticker">{e.ticker}</span>
              <span className="buscar-inicio-nombre">{e.nombre}</span>
              <span className="buscar-inicio-sector">{quiz.sectores[e.sector] || e.sector}</span>
            </button>
          ))}
        </div>
      )}
      {foco && texto.trim().length >= 2 && resultados.length === 0 && (
        <div className="buscar-inicio-lista">
          <div className="buscar-inicio-nada">
            No está entre las {empresasData.empresas.length} de la app.
          </div>
        </div>
      )}
    </div>
  )
}
