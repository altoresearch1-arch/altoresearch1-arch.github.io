import { useRef, useState } from 'react'
import { leerDocumento, analizar, guardarContexto, recordarHecho } from '../lib/sentinel'
import { redactarLectura } from '../lib/redactor'

// 🛰️ SENTINEL (beta) — vive DEBAJO de los Hechos de Importancia en la ficha.
// Procedimiento (se le explica al usuario ahí mismo):
//   1. Toca "PDF ↗" en un hecho de arriba → se abre el PDF oficial de la BVL.
//   2. Descárgalo y vuelve aquí (también vale una FOTO del documento).
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
    const esPdf = /\.pdf$/i.test(archivo.name) || archivo.type === 'application/pdf'
    const esFoto = /^image\//.test(archivo.type) || /\.(png|jpe?g|webp|bmp|gif)$/i.test(archivo.name)
    if (!esPdf && !esFoto) {
      setError('Leo PDF y fotos (JPG/PNG) — el formato de los hechos de importancia de la BVL o una foto del documento.')
      setEstado('error')
      return
    }
    setEstado('leyendo')
    setError('')
    setProgreso('abriendo el documento…')
    try {
      const { texto, paginas, ocr } = await leerDocumento(archivo, setProgreso)
      setProgreso('analizando lo leído…')
      // mini-pausa teatral: que se sienta que Sentinel "se toma su tiempo"
      await new Promise((r) => setTimeout(r, 600))
      const inf = analizar(texto, archivo.name, ticker)
      inf.paginasLeidas = paginas
      inf.ocr = ocr
      setInforme(inf)
      recordarHecho(inf) // Atlas lo recuerda en este navegador
      setEstado('listo')
    } catch (e) {
      setEstado('error')
      const msg = e?.message
      setError(msg === 'OCR_SIN_INTERNET'
        ? 'Para leer fotos o escaneados necesito internet: el motor de OCR se descarga de un CDN la primera vez. Conéctate e inténtalo de nuevo.'
        : msg === 'OCR_ILEGIBLE'
        ? 'Pasé la imagen por OCR pero no logré descifrar texto legible. Prueba con una foto más nítida, derecha y con buena luz.'
        : 'No pude leer ese archivo. Prueba descargar el PDF de nuevo desde el hecho de importancia, o con una foto más nítida.')
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
            ¿Un hecho de arriba te intriga? Sentinel lee el PDF (o una foto del documento) y te dice si pinta a buena o mala noticia.
          </div>
        </div>
      </div>

      {estado === 'espera' && (
        <>
          <ol className="sentinel-pasos">
            <li>Toca <b>«PDF ↗»</b> en el hecho de importancia que quieras (arriba 📰) y <b>descárgalo</b> — o <b>tómale una foto</b> al documento.</li>
            <li><b>Vuelve aquí</b> y suelta el archivo en el recuadro (o tócalo para elegirlo).</li>
            <li>Sentinel lo lee <b>en tu equipo</b> (nada se sube a ningún servidor); si es foto o escaneado lo descifra con OCR 📷.</li>
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
            aria-label="Soltar o elegir el PDF o la foto del hecho de importancia"
          >
            📎 Suelta aquí el PDF o la foto del hecho de importancia
            <span className="muted">o toca para elegir el archivo (PDF · JPG · PNG)</span>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf,image/*"
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
                {informe.ocr ? ' · 📷 descifrado con OCR' : ''}
                {informe.idioma === 'en' ? ' · documento en inglés' : ''}
              </div>
            </div>
          </div>

          {informe.titulo && (
            <p className="sentinel-parrafo" style={{ fontWeight: 600, marginBottom: 4 }}>
              «{informe.titulo}»
            </p>
          )}

          {/* el REDACTOR: párrafo en cristiano armado con lo extraído */}
          <p className="sentinel-parrafo">
            {redactarLectura(informe).replace(/\*\*/g, '')}
          </p>

          {informe.frases?.[0] && (
            <p className="sentinel-parrafo muted" style={{ fontStyle: 'italic' }}>
              📄 «{informe.frases[0].slice(0, 260)}{informe.frases[0].length > 260 ? '…' : ''}»
            </p>
          )}

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
            leer el documento ni es recomendación. El archivo se procesó en tu equipo y no se subió a ningún lado.
            {informe.ocr ? ' Ojo: el texto salió de un OCR — puede traer erratas de lectura.' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
