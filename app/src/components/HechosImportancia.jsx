import { useState } from 'react'
import hechosData from '../data/hechos.json'
import lecturasData from '../data/lecturas.json'
import empresasData from '../data/empresas.json'
import { redactarLectura } from '../lib/redactor'
import { guardarContexto } from '../lib/sentinel'

// Hechos de Importancia: los comunicados OFICIALES que la empresa está
// obligada a enviar al regulador (SMV) y que publica la BVL. Es la fuente
// primaria de noticias de cada empresa — sin rumores. Datos de hechos.json
// (extractor/fetch_hechos.py, últimos ~12 meses).
//
// 🛰️ "Léemelo" (pedido de Jair 09-jul): el robot YA leyó los hechos recientes
// (gen_lecturas.py) → cada uno con lectura tiene un botón que la despliega AHÍ
// MISMO (párrafo del redactor + veredicto + razones) sin descargar el PDF, y
// un salto a Atlas con ese contexto cargado.

const VISIBLES = 5

const EMOJI_LECTURA = { buena: '🟢', mala: '🔴', neutra: '🟡' }
const TEXTO_LECTURA = {
  buena: 'Pinta a buena noticia',
  mala: 'Pinta a mala noticia',
  neutra: 'Pinta neutra / administrativa',
}

function lecturaDe(pdf) {
  const l = pdf && lecturasData.lecturas?.[pdf]
  return l && !l.escaneado && !l.ilegible ? l : null
}

function fechaCorta(iso) {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

const nombreDe = (t) => {
  const n = empresasData.empresas.find((e) => e.ticker === t)?.nombre || t
  return n.replace(/\s+(S\.?A\.?A?\.?|S\.?A\.?C\.?)\s*$/i, '')
}

// Lectura desplegada bajo el hecho: párrafo + veredicto + razones + ir a Atlas
function LecturaInline({ lec, ticker }) {
  const doc = { ...lec, empresa: nombreDe(ticker) }

  const abrirAtlas = () => {
    // el contexto para las repreguntas de Atlas: las frases clave hacen de texto
    guardarContexto({ ...doc, texto: (lec.frases || []).join(' ') })
    location.hash = '#/ia'
  }

  return (
    <div className="hi-lectura-panel">
      <div className={`hi-lectura-veredicto v-${lec.veredicto}`}>
        {EMOJI_LECTURA[lec.veredicto]} <b>{TEXTO_LECTURA[lec.veredicto]}</b>
      </div>
      <p className="hi-lectura-parrafo">{redactarLectura(doc).replace(/\*\*/g, '')}</p>
      {lec.razones?.length > 0 && (
        <ul className="sentinel-razones">
          {lec.razones.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
      {lec.frases?.[0] && <p className="hi-lectura-frase">📄 «{lec.frases[0].slice(0, 220)}»</p>}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-oro hi-lectura-atlas" onClick={abrirAtlas}>
          🧠 Preguntarle a Atlas sobre este hecho
        </button>
      </div>
      <p className="muted" style={{ fontSize: 11, margin: '6px 0 0' }}>
        Lectura automática del robot (por palabras y patrones, beta). El documento oficial
        completo está en «PDF ↗».
      </p>
    </div>
  )
}

export default function HechosImportancia({ ticker }) {
  const h = hechosData.hechos?.[ticker]
  const [abiertos, setAbiertos] = useState(false)
  const [lecturaAbierta, setLecturaAbierta] = useState(null) // índice del hecho desplegado
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
                  title={`🛰️ Lectura automática: ${TEXTO_LECTURA[lec.veredicto]}`}
                >
                  {EMOJI_LECTURA[lec.veredicto]}
                </span>
              )}
              {lec && (
                <button
                  className={'hi-leer' + (lecturaAbierta === i ? ' on' : '')}
                  onClick={() => setLecturaAbierta(lecturaAbierta === i ? null : i)}
                >
                  {lecturaAbierta === i ? '− Cerrar' : '🛰️ Léemelo'}
                </button>
              )}
              {x.pdf && (
                <a className="hi-pdf" href={x.pdf} target="_blank" rel="noopener noreferrer">
                  PDF ↗
                </a>
              )}
            </div>
            {x.titulo && <div className="hi-titulo">{x.titulo}</div>}
            {lecturaAbierta === i && lec && <LecturaInline lec={lec} ticker={ticker} />}
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
        la fuente primaria, sin rumores. 🛰️ = el robot ya lo leyó (toca «Léemelo»).
        Fuente: BVL · documents.bvl.com.pe.
      </p>
    </div>
  )
}
