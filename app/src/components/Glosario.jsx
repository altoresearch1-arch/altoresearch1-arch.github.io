import { useMemo, useState } from 'react'
import glosario from '../data/glosario.json'

// Glosario en árbol por capas. Cada rama se abre; cada término muestra
// definición simple + botón "ver ejemplo". Con buscador: al escribir se
// muestran solo los términos que coinciden (en cualquier rama).

function normalizar(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function Termino({ term, abierto = false }) {
  const [verEj, setVerEj] = useState(false)
  return (
    <div className="glos-term">
      <div className="t oro">{term.t}</div>
      <div className="d">{term.d}</div>
      {term.ej && (
        <>
          {!verEj && !abierto ? (
            <button
              className="btn btn-fantasma"
              style={{ marginTop: 8, padding: '6px 12px', fontSize: 13 }}
              onClick={() => setVerEj(true)}
            >
              ver ejemplo
            </button>
          ) : (
            <div className="ej">{term.ej}</div>
          )}
        </>
      )}
    </div>
  )
}

export default function Glosario() {
  const [busqueda, setBusqueda] = useState('')
  const q = normalizar(busqueda.trim())

  const resultados = useMemo(() => {
    if (!q) return null
    const encontrados = []
    for (const rama of glosario.ramas) {
      for (const term of rama.terminos) {
        if (normalizar(term.t).includes(q) || normalizar(term.d).includes(q)) {
          encontrados.push({ term, rama: rama.titulo })
        }
      }
    }
    return encontrados
  }, [q])

  return (
    <div>
      <h1>Glosario</h1>
      <p className="lead">
        Conceptos en simple, con ejemplo. No necesitas leerlo todo: abre la rama
        que te interese — o busca directo.
      </p>
      <input
        className="explorar-busqueda"
        type="search"
        placeholder="Busca un término… (ej. dividendo, P/E, flujo de caja)"
        value={busqueda}
        onChange={(ev) => setBusqueda(ev.target.value)}
        autoComplete="off"
      />
      <div className="space" />

      {resultados ? (
        resultados.length === 0 ? (
          <p className="muted">
            Nada con "{busqueda}". Prueba con otra palabra, o abre las ramas de abajo.
          </p>
        ) : (
          <div className="glos-cuerpo" style={{ border: '1px solid var(--gris)', borderRadius: 10 }}>
            {resultados.map(({ term, rama }, i) => (
              <div key={i}>
                <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>{rama}</div>
                <Termino term={term} abierto />
              </div>
            ))}
          </div>
        )
      ) : (
        glosario.ramas.map((rama) => (
          <details key={rama.id} className="glos-rama">
            <summary>
              {rama.titulo}
              <span className="oro">＋</span>
            </summary>
            <div className="glos-cuerpo">
              {rama.terminos.map((term, i) => (
                <Termino key={i} term={term} />
              ))}
            </div>
          </details>
        ))
      )}
    </div>
  )
}
