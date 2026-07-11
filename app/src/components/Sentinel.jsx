import { useRef, useState } from 'react'
import { analizar, guardarContexto, recordarHecho } from '../lib/sentinel'
import { leerArchivo, tipoDe, TIPOS_ACEPTADOS } from '../lib/lectores'
import { losDocumentos, agregarDocumento, quitarDocumento, vaciarBiblioteca, marcarBibliotecaNueva } from '../lib/biblioteca'
import { redactarLectura } from '../lib/redactor'

// 🛰️ SENTINEL (beta) — vive DEBAJO de los Hechos de Importancia en la ficha.
// Dos modos:
//   · UN archivo → informe clásico: veredicto 🟢/🔴/🟡 + párrafo del redactor.
//   · VARIOS archivos (o ya hay biblioteca) → 📚 BIBLIOTECA: Atlas los indexa
//     todos y responde citando documento y página (estilo NotebookLM, pero
//     100% en tu navegador — nada se sube a ningún servidor).
// Formatos: PDF (con texto o escaneado), fotos JPG/PNG (OCR), Word, Excel,
// PowerPoint y TXT.

const ICONO_TIPO = { pdf: '📄', imagen: '📷', docx: '📝', xlsx: '📊', pptx: '📽', txt: '🗒' }

// Advertencia honesta de lo que Sentinel NO puede leer (pedido de Jair):
// los GRÁFICOS (barras, tortas, líneas) son imágenes — se leen sus rótulos y
// números sueltos, pero no "entiende" la curva. Recomienda leer igual el doc.
function AvisoLimitaciones() {
  return (
    <p className="sentinel-limites muted">
      ⚠ <b>Lo que Sentinel no lee bien:</b> los <b>gráficos e imágenes</b> (barras, tortas, curvas)
      son dibujos, no texto — puedo pescar los números y rótulos sueltos, pero no interpreto la
      tendencia que muestran. Las <b>tablas</b> sí las leo (Excel completo, y tablas de texto en PDF).
      Por eso, aunque te dé mi lectura, <b>abre y lee tú también el documento</b>: soy una ayuda para
      orientarte, no un reemplazo de leerlo.
    </p>
  )
}

const MENSAJE_ERROR = {
  OCR_SIN_INTERNET: 'Para leer fotos o escaneados necesito internet: el motor de OCR se descarga de un CDN la primera vez. Conéctate e inténtalo de nuevo.',
  OCR_ILEGIBLE: 'Pasé la imagen por OCR pero no logré descifrar texto legible. Prueba con una foto más nítida, derecha y con buena luz.',
  LECTOR_SIN_INTERNET: 'Para leer Word/Excel/PowerPoint necesito internet la primera vez (el lector se descarga de un CDN). Conéctate e inténtalo de nuevo.',
  FORMATO_NO_SOPORTADO: 'Ese formato no lo leo (todavía). Acepto PDF, fotos JPG/PNG, Word (.docx), Excel (.xlsx), PowerPoint (.pptx) y TXT.',
  ARCHIVO_ROTO: 'Ese archivo parece dañado o no es lo que dice ser. Prueba descargarlo o exportarlo de nuevo.',
  ARCHIVO_VACIO: 'Abrí el archivo pero no encontré texto adentro.',
  BIBLIOTECA_LLENA: 'La biblioteca llegó a su tope (12 documentos). Quita alguno para seguir agregando.',
}
const errorDe = (e) => MENSAJE_ERROR[e?.message] || 'No pude leer ese archivo. Prueba descargarlo de nuevo, o con una foto más nítida.'

export default function Sentinel({ ticker }) {
  const [estado, setEstado] = useState(() => (losDocumentos().length > 0 ? 'biblioteca' : 'espera'))
  const [progreso, setProgreso] = useState('')
  const [informe, setInforme] = useState(null)
  const [error, setError] = useState('')
  const [avisoBib, setAvisoBib] = useState('')
  const [bibDocs, setBibDocs] = useState(() => losDocumentos())
  const [arrastrando, setArrastrando] = useState(false)
  const inputRef = useRef(null)
  const ultimoArchivoRef = useRef(null) // para "súmalo a la biblioteca" tras un informe

  const procesar = async (lista) => {
    const archivos = [...(lista || [])].filter(Boolean)
    if (!archivos.length) return
    const invalido = archivos.find((a) => !tipoDe(a))
    if (invalido) {
      setError(`«${invalido.name}»: ${MENSAJE_ERROR.FORMATO_NO_SOPORTADO}`)
      setEstado('error')
      return
    }
    // varios archivos (o biblioteca ya empezada) → modo BIBLIOTECA
    if (archivos.length > 1 || losDocumentos().length > 0) return agregarVarios(archivos)

    // un archivo → informe clásico
    const archivo = archivos[0]
    setEstado('leyendo')
    setError('')
    setProgreso('abriendo el documento…')
    try {
      const { texto, paginas, ocr } = await leerArchivo(archivo, setProgreso)
      setProgreso('analizando lo leído…')
      // mini-pausa teatral: que se sienta que Sentinel "se toma su tiempo"
      await new Promise((r) => setTimeout(r, 600))
      const inf = analizar(texto, archivo.name, ticker)
      inf.paginasLeidas = paginas
      inf.ocr = ocr
      setInforme(inf)
      ultimoArchivoRef.current = archivo
      recordarHecho(inf) // Atlas lo recuerda en este navegador
      setEstado('listo')
    } catch (e) {
      setEstado('error')
      setError(errorDe(e))
    }
  }

  const agregarVarios = async (archivos) => {
    setEstado('leyendo')
    setError('')
    const fallos = []
    for (let i = 0; i < archivos.length; i++) {
      const a = archivos[i]
      const pre = archivos.length > 1 ? `(${i + 1}/${archivos.length}) ` : ''
      try {
        setProgreso(`${pre}${a.name}: abriendo…`)
        await agregarDocumento(a, (msg) => setProgreso(`${pre}${a.name}: ${msg}`))
      } catch (e) {
        fallos.push(`«${a.name}»: ${errorDe(e)}`)
        if (e?.message === 'BIBLIOTECA_LLENA') break
      }
    }
    setBibDocs([...losDocumentos()])
    setAvisoBib(fallos.join(' '))
    setEstado(losDocumentos().length > 0 ? 'biblioteca' : 'error')
    if (losDocumentos().length === 0) setError(fallos.join(' ') || 'No pude leer esos archivos.')
  }

  const sumarInformeABiblioteca = async () => {
    if (!ultimoArchivoRef.current) return
    await agregarVarios([ultimoArchivoRef.current])
    ultimoArchivoRef.current = null
    setInforme(null)
  }

  const abrirAtlas = () => {
    guardarContexto(informe)
    location.hash = '#/ia'
  }

  const abrirAtlasBiblioteca = () => {
    marcarBibliotecaNueva()
    location.hash = '#/ia'
  }

  const quitar = (id) => {
    quitarDocumento(id)
    const quedan = losDocumentos()
    setBibDocs([...quedan])
    if (quedan.length === 0) setEstado('espera')
  }

  const V = {
    buena: { emoji: '🟢', frase: 'Pinta a BUENA noticia' },
    mala: { emoji: '🔴', frase: 'Pinta a MALA noticia' },
    neutra: { emoji: '🟡', frase: 'Pinta NEUTRA / administrativa' },
  }[informe?.veredicto || 'neutra']

  const zonaProps = {
    onDragOver: (e) => { e.preventDefault(); setArrastrando(true) },
    onDragLeave: () => setArrastrando(false),
    onDrop: (e) => { e.preventDefault(); setArrastrando(false); procesar(e.dataTransfer.files) },
  }

  return (
    <div className="sentinel card">
      <div className="sentinel-cab">
        <span className="sentinel-icono" aria-hidden="true">🛰️</span>
        <div>
          <div className="seccion-titulo" style={{ margin: 0 }}>
            Sentinel <span className="yachay-beta">lector · BETA</span>
          </div>
          <div className="muted" style={{ fontSize: 12.5 }}>
            ¿Un hecho de arriba te intriga? Sentinel lee el PDF (o una foto del documento) y te dice si
            pinta a buena o mala noticia. Y si le das VARIOS archivos, arma tu 📚 biblioteca: Atlas
            responde sobre todos citando documento y página.
          </div>
        </div>
      </div>

      {estado === 'espera' && (
        <>
          <ol className="sentinel-pasos">
            <li>Toca <b>«PDF ↗»</b> en el hecho de importancia que quieras (arriba 📰) y <b>descárgalo</b> — o <b>tómale una foto</b> al documento.</li>
            <li><b>Vuelve aquí</b> y suelta el archivo en el recuadro (o tócalo para elegirlo). Acepto PDF, fotos, Word, Excel, PowerPoint y TXT — <b>y varios a la vez</b>.</li>
            <li>Sentinel lo lee <b>en tu equipo</b> (nada se sube a ningún servidor); si es foto o escaneado lo descifra con OCR 📷.</li>
            <li>Abre el chat con <b>Atlas</b>, que ya conocerá tus documentos, y pregúntale lo que quieras.</li>
          </ol>
          <div
            className={'sentinel-zona' + (arrastrando ? ' activa' : '')}
            onClick={() => inputRef.current?.click()}
            {...zonaProps}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
            aria-label="Soltar o elegir los documentos (PDF, foto, Word, Excel, PowerPoint o TXT)"
          >
            📎 Suelta aquí el PDF o la foto del hecho de importancia
            <span className="muted">o toca para elegir — PDF · JPG · Word · Excel · PPT · TXT (varios a la vez = 📚 biblioteca)</span>
          </div>
          <AvisoLimitaciones />
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={TIPOS_ACEPTADOS}
        style={{ display: 'none' }}
        onChange={(e) => { procesar(e.target.files); e.target.value = '' }}
      />

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
          <button className="btn btn-fantasma" onClick={() => setEstado('espera')}>← Intentar con otro archivo</button>
        </div>
      )}

      {estado === 'biblioteca' && (
        <div className="sentinel-informe">
          <b>📚 Tu biblioteca ({bibDocs.length} de 12)</b>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
            Atlas responde usando TODOS estos documentos y cita la fuente exacta (documento · página o sección).
            Todo vive en tu navegador — nada se subió a ningún lado.
          </div>
          {avisoBib && <div className="sentinel-error" style={{ marginBottom: 8 }}>⚠ {avisoBib}</div>}
          <ul className="sentinel-razones" style={{ listStyle: 'none', paddingLeft: 0 }}>
            {bibDocs.map((d) => (
              <li key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden="true">{ICONO_TIPO[d.tipo] || '📄'}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.nombre}
                  <span className="muted">
                    {d.paginas ? ` · ${d.paginas} pág.` : ''}{d.ocr ? ' · OCR 📷' : ''}{d.periodo ? ` · ${d.periodo.replace('-T', ' T')}` : ''}
                  </span>
                </span>
                <button
                  className="btn btn-fantasma"
                  style={{ padding: '2px 8px' }}
                  onClick={() => quitar(d.id)}
                  aria-label={`Quitar ${d.nombre} de la biblioteca`}
                >✕</button>
              </li>
            ))}
          </ul>
          <div
            className={'sentinel-zona' + (arrastrando ? ' activa' : '')}
            onClick={() => inputRef.current?.click()}
            {...zonaProps}
            role="button"
            tabIndex={0}
            style={{ padding: 10 }}
            aria-label="Agregar más documentos a la biblioteca"
          >
            ➕ Agregar más documentos
          </div>
          <button className="btn btn-oro sentinel-atlas" onClick={abrirAtlasBiblioteca}>
            🧠 Analizar juntos con Atlas (cita documento y página)
          </button>
          <button className="btn btn-fantasma" onClick={() => { vaciarBiblioteca(); setBibDocs([]); setAvisoBib(''); setEstado('espera') }}>
            🗑 Vaciar la biblioteca
          </button>
          <AvisoLimitaciones />
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
          <button className="btn btn-fantasma" onClick={sumarInformeABiblioteca}>
            📚 Sumarlo a la biblioteca (para analizarlo junto a otros)
          </button>
          <button className="btn btn-fantasma" onClick={() => { setInforme(null); setEstado('espera') }}>
            📎 Leer otro documento
          </button>

          <AvisoLimitaciones />
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
