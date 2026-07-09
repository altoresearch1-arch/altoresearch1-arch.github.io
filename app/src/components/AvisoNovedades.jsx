import { useEffect, useRef, useState } from 'react'
import empresasData from '../data/empresas.json'
import { buscarNovedades, detectarAvisos, sonarAviso } from '../lib/novedades'

// CAMPANITA DE NOVEDADES 🔔 — si el usuario guardó empresas con ★ y a alguna
// le llega un hecho de importancia (o el MINEM publica un BEM nuevo y sigue
// mineras), aparece un aviso flotante CON SONIDO; al tocarlo va directo a la
// ficha. Revisa al abrir la app, al volver a la pestaña y cada 5 minutos
// (el robot refresca novedades.json cada 30 min en horario de mercado).

// nombre sin la cola legal ("S.A.A.", "S.A."…) para que el aviso respire
const nombreDe = (t) => {
  const n = empresasData.empresas.find((e) => e.ticker === t)?.nombre || t
  return n.replace(/\s+(S\.?A\.?A?\.?|S\.?A\.?C\.?)\s*$/i, '')
}

const esMinera = (t) =>
  empresasData.empresas.find((e) => e.ticker === t)?.sector === 'minas'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const mesLegible = (iso) => {
  const [a, m] = String(iso).split('-')
  return `${MESES[parseInt(m, 10) - 1] || iso} ${a}`
}

export default function AvisoNovedades() {
  const [avisos, setAvisos] = useState([])
  const revisando = useRef(false)

  useEffect(() => {
    const revisar = async () => {
      if (revisando.current) return
      revisando.current = true
      try {
        const nov = await buscarNovedades()
        const nuevos = detectarAvisos(nov, esMinera)
        if (nuevos.length > 0) {
          setAvisos((prev) => [...prev, ...nuevos].slice(-3)) // máx. 3 en pantalla
          sonarAviso()
        }
      } catch { /* sin internet o archivo aún no publicado: silencio */ }
      revisando.current = false
    }
    revisar()
    const alVolver = () => { if (document.visibilityState === 'visible') revisar() }
    document.addEventListener('visibilitychange', alVolver)
    const timer = setInterval(revisar, 5 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      clearInterval(timer)
    }
  }, [])

  if (avisos.length === 0) return null

  const cerrar = (i) => setAvisos((prev) => prev.filter((_, j) => j !== i))
  const abrir = (aviso, i) => {
    cerrar(i)
    location.hash = `#/empresa/${aviso.ticker}`
  }

  return (
    <div className="avisos-novedades" role="status" aria-live="polite">
      {avisos.map((a, i) => (
        <div key={`${a.ticker}-${a.fecha || a.mes}-${i}`} className="aviso-novedad">
          <button className="aviso-cerrar" aria-label="Cerrar aviso"
            onClick={(e) => { e.stopPropagation(); cerrar(i) }}>×</button>
          <div className="aviso-cuerpo" onClick={() => abrir(a, i)}>
            {a.tipo === 'hecho' ? (
              <>
                <div className="aviso-titulo">🔔 <b>{nombreDe(a.ticker)}</b>, una empresa que sigues, tiene una novedad</div>
                <div className="aviso-detalle">
                  <span className="aviso-cat">{a.categoria}</span>
                  {a.titulo ? ` — ${a.titulo}` : ''} · {a.fecha}
                </div>
              </>
            ) : (
              <>
                <div className="aviso-titulo">⛏️ Salió el BEM de <b>{mesLegible(a.mes)}</b> (MINEM)</div>
                <div className="aviso-detalle">
                  Producción minera nueva en {a.mineras.map(nombreDe).join(', ')}
                </div>
              </>
            )}
            <div className="aviso-ir">Tocar para ver la ficha →</div>
          </div>
        </div>
      ))}
    </div>
  )
}
