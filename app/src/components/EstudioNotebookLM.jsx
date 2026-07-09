import { useState } from 'react'
import tesisData from '../data/tesis.json'
import tipsData from '../data/tips.json'
import catalizadoresData from '../data/catalizadores.json'
import hechosData from '../data/hechos.json'
import { precioDe, peInfo, dividendosDe } from '../lib/finanzas'

// 📓 ESTUDIAR CON NOTEBOOKLM — pedido de Jair (08-jul): NotebookLM (la IA
// gratuita de Google para leer documentos) no se puede INCRUSTAR en una web,
// pero sí podemos prepararle el trabajo: este botón arma un "paquete de
// estudio" en texto con TODO lo verificado de la empresa (fundamentos, precio,
// dividendos, tesis, tips, catalizadores y los hechos de importancia con el
// link a cada PDF oficial) para que el usuario lo suba a notebooklm.google.com
// y le pida resúmenes o preguntas de práctica. Cero servidores: el archivo se
// genera EN el navegador con los datos que la app ya tiene.

function armarPaquete(e) {
  const t = e.ticker
  const px = precioDe(t)
  const pe = peInfo(t)
  const dv = dividendosDe(t)
  const tips = tipsData.tips?.[t] || []
  const catal = catalizadoresData.catalizadores?.[t] || []
  const hechos = hechosData.hechos?.[t]?.hechos || []
  const m = e.metricas || {}

  const L = []
  L.push(`PAQUETE DE ESTUDIO — ${e.nombre} (${t})`)
  L.push(`Preparado por ALTO Research (altoresearch1-arch.github.io) — datos verificados de BVL/SMV.`)
  L.push(`Material EDUCATIVO: no es recomendación de inversión. Generado el ${new Date().toLocaleDateString('es-PE')}.`)
  L.push('')
  L.push('== QUIÉN ES ==')
  L.push(`Empresa: ${e.nombre}`)
  L.push(`Ticker en la BVL: ${t} · Sector: ${e.sector}`)
  L.push('')
  L.push('== PRECIO Y VALORACIÓN ==')
  if (px?.precio != null) {
    L.push(`Precio de cierre: ${px.moneda} ${px.precio} (${px.fecha})${px.sinNegociacionReciente ? ' — OJO: acción poco negociada, es su último cierre disponible' : ''}`)
  } else {
    L.push('Sin cotización reciente en la BVL (no negocia; se estudia por fundamentos y dividendos).')
  }
  if (pe && !pe.perdida) L.push(`P/E (precio ÷ ganancia anual por acción): ${pe.pe.toFixed(1)}${pe.referencial ? ' (referencial: precio viejo)' : ''}`)
  if (pe?.perdida) L.push('P/E: no aplica (pérdida anual).')
  L.push('')
  L.push('== FUNDAMENTOS (SMV, estados individuales) ==')
  for (const [k, v] of Object.entries({ 'Ganancia por acción (EPS)': m.eps, 'Flujo de caja libre (FCF)': m.fcf, 'Inversión (capex)': m.capex, Deuda: m.deuda, Margen: m.margen })) {
    if (v) L.push(`${k}: ${v}`)
  }
  L.push('')
  L.push('== DIVIDENDOS ==')
  if (dv && (dv.anual || dv.yield)) {
    if (dv.anual) L.push(`Pago anual aproximado: ${dv.anual} por acción`)
    if (dv.yield) L.push(`Yield (rendimiento por dividendo): ${dv.yield}`)
    if (dv.frecuencia) L.push(`Frecuencia: ${dv.frecuencia}`)
    if (dv.payout) L.push(`Payout: ${dv.payout}`)
  } else {
    L.push('No registra pagos recientes de dividendos.')
  }
  if (tesisData.tesis?.[t]) {
    L.push('')
    L.push('== TESIS DE ALTO (una línea, honesta) ==')
    L.push(tesisData.tesis[t])
  }
  if (tips.length > 0) {
    L.push('')
    L.push('== CLAVES PARA ENTENDERLA ==')
    tips.forEach((tip) => L.push(`- ${tip}`))
  }
  if (catal.length > 0) {
    L.push('')
    L.push('== CATALIZADORES (qué puede mover la acción) ==')
    catal.forEach((c) => L.push(`- [${c.tipo}${c.etiqueta ? ' · ' + c.etiqueta : ''}] ${c.texto}`))
  }
  if (hechos.length > 0) {
    L.push('')
    L.push('== HECHOS DE IMPORTANCIA (últimos 12 meses, comunicados oficiales a la BVL) ==')
    L.push('Tip: puedes descargar estos PDF y subirlos también a NotebookLM como fuentes.')
    hechos.forEach((h) => {
      L.push(`- ${h.fecha} · ${h.categoria}${h.titulo ? ' — ' + h.titulo : ''}`)
      if (h.pdf) L.push(`  PDF oficial: ${h.pdf}`)
    })
  }
  L.push('')
  L.push('== PREGUNTAS SUGERIDAS PARA HACERLE A NOTEBOOKLM ==')
  L.push('- Resúmeme esta empresa como si tuviera 15 años.')
  L.push('- ¿Cuáles son sus 3 fortalezas y sus 3 riesgos según estas fuentes?')
  L.push('- ¿De qué depende que le vaya bien o mal?')
  L.push('- Hazme 5 preguntas para comprobar si entendí la empresa.')
  return L.join('\n')
}

export default function EstudioNotebookLM({ empresa }) {
  const [abierto, setAbierto] = useState(false)
  const [descargado, setDescargado] = useState(false)

  const descargar = () => {
    const blob = new Blob([armarPaquete(empresa)], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ALTO_${empresa.ticker}_estudio.txt`
    a.click()
    URL.revokeObjectURL(a.href)
    setDescargado(true)
  }

  return (
    <>
      <button className="btn-fav" onClick={() => setAbierto(true)} title="Estudiar esta empresa con NotebookLM (IA gratuita de Google)">
        📓 NotebookLM
      </button>
      {abierto && (
        <div className="modal-overlay" onClick={() => setAbierto(false)}>
          <div className="modal-nblm" onClick={(ev) => ev.stopPropagation()}>
            <button className="modal-cerrar" onClick={() => setAbierto(false)} aria-label="Cerrar">×</button>
            <h2 style={{ marginTop: 0 }}>📓 Estudia {empresa.ticker} con NotebookLM</h2>
            <p className="muted">
              NotebookLM es la IA <b>gratuita</b> de Google para estudiar documentos: le subes
              fuentes y te las explica, resume y hasta te hace preguntas de práctica.
              Te preparamos el paquete con nuestros datos verificados:
            </p>
            <ol className="nblm-pasos">
              <li>
                <button className="btn btn-oro" onClick={descargar}>
                  {descargado ? '✓ Paquete descargado' : '⬇ Descargar el paquete de estudio (.txt)'}
                </button>
              </li>
              <li>
                Abre <a href="https://notebooklm.google.com" target="_blank" rel="noreferrer">notebooklm.google.com</a>{' '}
                (con tu cuenta de Google) y crea un cuaderno nuevo.
              </li>
              <li>Sube el archivo como fuente. Si quieres ir a fondo, agrega también los PDF de los hechos de importancia 📰 (los links vienen dentro del paquete).</li>
              <li>Pídele: «resúmeme la empresa», «¿qué riesgos tiene?», «hazme 5 preguntas para practicar»…</li>
            </ol>
            <p className="muted" style={{ marginBottom: 0 }}>
              El paquete se arma en tu dispositivo con los datos de esta ficha (BVL/SMV).
              Es material educativo, no recomendación. NotebookLM es un servicio de Google, ajeno a ALTO.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
