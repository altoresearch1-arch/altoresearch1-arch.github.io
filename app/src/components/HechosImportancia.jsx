import { useState } from 'react'
import hechosData from '../data/hechos.json'
import lecturasData from '../data/lecturas.json'

// Hechos de Importancia: los comunicados OFICIALES que la empresa está
// obligada a enviar al regulador (SMV) y que publica la BVL. Es la fuente
// primaria de noticias de cada empresa — sin rumores. Datos de hechos.json
// (extractor/fetch_hechos.py, últimos ~12 meses).

const VISIBLES = 5

// 🛰️ lectura automática pre-hecha por el robot (gen_lecturas.py): veredicto
// de los 2 hechos más recientes de cada empresa, clave = URL del PDF
const EMOJI_LECTURA = { buena: '🟢', mala: '🔴', neutra: '🟡' }
function lecturaDe(pdf) {
  const l = pdf && lecturasData.lecturas?.[pdf]
  return l && !l.escaneado && !l.ilegible ? l : null
}

function fechaCorta(iso) {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

export default function HechosImportancia({ ticker }) {
  const h = hechosData.hechos?.[ticker]
  const [abiertos, setAbiertos] = useState(false)
  if (!h?.hechos?.length) return null

  const lista = abiertos ? h.hechos : h.hechos.slice(0, VISIBLES)

  return (
    <div>
      <div className="seccion-titulo">📰 Hechos de Importancia (comunicados oficiales)</div>
      <div className="hi-lista">
        {lista.map((x, i) => {
          const lec = lecturaDe(x.pdf)
          return (
          <div key={i} className="hi-item">
            <div className="hi-cab">
              <span className="hi-fecha">{fechaCorta(x.fecha)}</span>
              {x.categoria && <span className="hi-cat">{x.categoria}</span>}
              {lec && (
                <span
                  className={`hi-lectura v-${lec.veredicto}`}
                  title={`🛰️ Lectura automática de Sentinel: pinta ${lec.veredicto === 'buena' ? 'a buena noticia' : lec.veredicto === 'mala' ? 'a mala noticia' : 'neutra/administrativa'}${lec.razones?.length ? ' — ' + lec.razones.join('; ').replace(/🟢 |🔴 /g, '') : ''}`}
                >
                  {EMOJI_LECTURA[lec.veredicto]}
                </span>
              )}
              {x.pdf && (
                <a className="hi-pdf" href={x.pdf} target="_blank" rel="noopener noreferrer">
                  PDF ↗
                </a>
              )}
            </div>
            {x.titulo && <div className="hi-titulo">{x.titulo}</div>}
          </div>
          )
        })}
      </div>
      {h.hechos.length > VISIBLES && (
        <button className="btn btn-fantasma hi-vermas" onClick={() => setAbiertos((v) => !v)}>
          {abiertos ? '− Ver menos' : `+ Ver los ${h.hechos.length} del último año`}
        </button>
      )}
      <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
        Estos son los avisos oficiales que la empresa envía al regulador (SMV) —
        la fuente primaria, sin rumores. Fuente: BVL · documents.bvl.com.pe.
      </p>
    </div>
  )
}
