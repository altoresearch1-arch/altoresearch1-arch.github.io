import { useRef, useState } from 'react'
import { leerPdf, analizar, guardarContexto, recordarHecho } from '../lib/sentinel'

// 🛰️ SENTINEL (beta) — vive DEBAJO de los Hechos de Importancia en la ficha.
// Procedimiento (se le explica al usuario ahí mismo):
//   1. Toca "PDF ↗" en un hecho de arriba → se abre el PDF oficial de la BVL.
//   2. Descárgalo y vuelve aquí.
//   3. Suéltalo en Sentinel: lo lee EN tu equipo (no se sube a ningún lado).
//   4. Te dice si pinta a buena o mala noticia (con sus razones, sin recomendar).
//   5. Abres el chat con Atlas, que ya conoce el documento, y le preguntas.

export default function Sentinel({ ticker }) {
  const [estado, setEstado] = useState('espera') // espera | leyendo | listo | error
  const [progreso, setProgreso] = useState('')
  const [informe, setInforme] = useState(null)
  const [error, setError] = useState('')
  const [arrastrando, setArrastrando] = useState(false)
  const inputRef = useRef(null)

  const procesar = async (archivo) => {
    if (!archivo) return
    if (!/\.pdf$/i.test(archivo.name) && archivo.type !== 'application/pdf') {
      setError('Solo leo PDF (el formato de los hechos de importancia de la BVL).')
      setEstado('error')
      return
    }
    setEstado('leyendo')
    setError('')
    setProgreso('abriendo el documento…')
    try {
      let paginas = 0
      const texto = await leerPdf(archivo, (p, total) => {
        paginas = total
        setProgreso(`leyendo página ${p} de ${total}…`)
      })
      setProgreso('analizando lo leído…')
      // mini-pausa teatral: que se sienta que Sentinel "se toma su tiempo"
      await new Promise((r) => setTimeout(r, 600))
      const inf = analizar(texto, archivo.name)
      inf.paginasLeidas = paginas
      setInforme(inf)
      recordarHecho(inf) // Atlas lo recuerda en este navegador
      setEstado('listo')
    } catch (e) {
      setEstado('error')
      setError(e?.message === 'PDF_ESCANEADO'
        ? 'Este PDF es una imagen escaneada (sin texto). Sentinel aún no hace OCR — léelo directo de la BVL 🙏.'
        : 'No pude leer ese PDF. Prueba descargarlo de nuevo desde el hecho de importancia.')
    }
  }

  const abrirAtlas = () => {
    guardarContexto(informe)
    location.hash = '#/ia'
  }

  const V = {
    buena: { emoji: '🟢', frase: 'Pinta a BUENA noticia' },
    mala: { emoji: '🔴', frase: 'Pinta a MALA noticia' },
    neutra: { emoji: '🟡', frase: 'Pinta NEUTRA / administrativa' },
  }[informe?.veredicto || 'neutra']

  return (
    <div className="sentinel card">
      <div className="sentinel-cab">
        <span className="sentinel-icono" aria-hidden="true">🛰️</span>
        <div>
          <div className="seccion-titulo" style={{ margin: 0 }}>
            Sentinel <span className="yachay-beta">lector · BETA</span>
          </div>
          <div className="muted" style={{ fontSize: 12.5 }}>
            ¿Un hecho de arriba te intriga? Sentinel lee el PDF y te dice si pinta a buena o mala noticia.
          </div>
        </div>
      </div>

      {estado === 'espera' && (
        <>
          <ol className="sentinel-pasos">
            <li>Toca <b>«PDF ↗»</b> en el hecho de importancia que quieras (arriba 📰) y <b>descárgalo</b>.</li>
            <li><b>Vuelve aquí</b> y suelta el archivo en el recuadro (o tócalo para elegirlo).</li>
            <li>Sentinel lo lee <b>en tu equipo</b> (el PDF no se sube a ningún servidor) y te da su lectura.</li>
            <li>Abre el chat con <b>Atlas</b>, que ya conocerá el documento, y pregúntale lo que quieras.</li>
          </ol>
          <div
            className={'sentinel-zona' + (arrastrando ? ' activa' : '')}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastrando(false); procesar(e.dataTransfer.files?.[0]) }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
            aria-label="Soltar o elegir el PDF del hecho de importancia"
          >
            📎 Suelta aquí el PDF del hecho de importancia
            <span className="muted">o toca para elegir el archivo</span>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            style={{ display: 'none' }}
            onChange={(e) => { procesar(e.target.files?.[0]); e.target.value = '' }}
          />
        </>
      )}

      {estado === 'leyendo' && (
        <div className="sentinel-leyendo">
          <span className="sentinel-ojo" aria-hidden="true">🛰️</span>
          <div>
            <b>Sentinel está leyendo…</b>
            <div className="muted">{progreso}</div>
          </div>
        </div>
      )}

      {estado === 'error' && (
        <div className="sentinel-error">
          ⚠ {error}
          <button className="btn btn-fantasma" onClick={() => setEstado('espera')}>← Intentar con otro PDF</button>
        </div>
      )}

      {estado === 'listo' && informe && (
        <div className="sentinel-informe">
          <div className={`sentinel-veredicto v-${informe.veredicto}`}>
            <span className="sentinel-veredicto-emoji">{V.emoji}</span>
            <div>
              <b>{V.frase}</b>
              <div className="muted" style={{ fontSize: 12 }}>
                {informe.empresa ? `${informe.empresa}` : 'Empresa no identificada'} · {informe.categoria}
                {informe.paginasLeidas ? ` · ${informe.paginasLeidas} pág.` : ''}
              </div>
            </div>
          </div>

          {informe.razones.length > 0 && (
            <ul className="sentinel-razones">
              {informe.razones.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}

          {(informe.montos.length > 0 || informe.fechas.length > 0) && (
            <div className="sentinel-datos muted">
              {informe.montos.length > 0 && <>💵 {informe.montos.slice(0, 5).join(' · ')}<br /></>}
              {informe.fechas.length > 0 && <>📅 {informe.fechas.slice(0, 4).join(' · ')}</>}
            </div>
          )}

          <button className="btn btn-oro sentinel-atlas" onClick={abrirAtlas}>
            🧠 Abrir el chat con Atlas (ya leyó el documento)
          </button>
          <button className="btn btn-fantasma" onClick={() => { setInforme(null); setEstado('espera') }}>
            📎 Leer otro PDF
          </button>

          <p className="muted" style={{ fontSize: 11.5, marginBottom: 0 }}>
            Lectura automática por palabras y patrones (beta): resalta y organiza, no reemplaza
            leer el documento ni es recomendación. El PDF se procesó en tu equipo y no se subió a ningún lado.
          </p>
        </div>
      )}
    </div>
  )
}
