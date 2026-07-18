import { useEffect, useRef, useState } from 'react'
import empresasData from '../data/empresas.json'
import { empresaDe, esUSD, fmtP, fmtPrecioExacto, fmtS, divUlt12, enSoles } from '../lib/cartera'
import { BROKERS, DEMO_OCR, extraerFilas, procesarFilas, leerDocumentoCartera } from '../lib/importar'

// ─────────────────────────────────────────────────────────────────────────
// 🛰 IMPORTAR DE MI BROKER — wizard de 5 pasos (broker → subir → leer →
// revisar → crear), del prototipo aprobado el 16-jul. La lectura es REAL:
// tesseract/pdf.js EN el navegador (el documento nunca sale del equipo) y
// el diccionario de tickers decide — la IA no participa. Lenguaje de
// confianza, nunca de disculpa: "✔ Corregido de «MINSURII» — error típico
// de OCR", y toda decisión dudosa se le devuelve al usuario.
// ─────────────────────────────────────────────────────────────────────────

export default function ImportarCartera({ onCerrar, onImportar, onRecordatorio }) {
  const [paso, setPaso] = useState(1)
  const [broker, setBroker] = useState(null)
  const [otroAbierto, setOtroAbierto] = useState(false)
  const [otroNombre, setOtroNombre] = useState('')
  const [archivoNombre, setArchivoNombre] = useState('')
  const [estado, setEstado] = useState('')
  const [error, setError] = useState(null)
  const [filas, setFilas] = useState([])
  const inputRef = useRef(null)
  // ⚠ StrictMode monta→desmonta→remonta: el ref debe volver a true en el
  // cuerpo del efecto, no solo apagarse en el cleanup
  const vivoRef = useRef(true)
  useEffect(() => {
    vivoRef.current = true
    return () => { vivoRef.current = false }
  }, [])

  useEffect(() => {
    const porTecla = (e) => { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('keydown', porTecla)
    return () => document.removeEventListener('keydown', porTecla)
  }, [onCerrar])

  const leerArchivo = async (archivo) => {
    setArchivoNombre(archivo.name || 'documento')
    setPaso(3)
    setError(null)
    try {
      const texto = await leerDocumentoCartera(archivo, (m) => { if (vivoRef.current) setEstado(m) })
      if (!vivoRef.current) return
      setEstado('buscando cada ticker en el diccionario ALTO (114 empresas + alias)…')
      const crudas = extraerFilas(texto)
      if (!crudas.length) throw new Error('SIN_FILAS')
      setFilas(procesarFilas(crudas))
      setPaso(4)
    } catch (e) {
      if (!vivoRef.current) return
      const msj = e?.message === 'EXCEL_NO_SOPORTADO'
        ? 'Los .xlsx todavía no se leen directo (la app cuida su peso). En tu Excel: Archivo → Guardar como → CSV, y súbelo de nuevo — se lee igual de bien.'
        : e?.message === 'SIN_FILAS'
        ? 'Leímos el documento pero no encontramos una tabla de posiciones (ticker + cantidad). Prueba con una captura donde la tabla se vea más grande y nítida, o agrega tus empresas a mano.'
        : e?.message === 'OCR_SIN_INTERNET'
        ? 'El motor de lectura de imágenes se descarga de internet la primera vez y ahora no hay conexión. Intenta de nuevo con señal, o usa un CSV.'
        : e?.message === 'TIPO_NO_SOPORTADO'
        ? 'Ese tipo de archivo no se puede leer. Sube una captura (PNG/JPG), un PDF o un CSV.'
        : 'No pudimos leer ese documento. Prueba con una captura más nítida (que la tabla se vea grande) o agrega tus empresas a mano.'
      setError(msj)
    }
  }

  const usarDemo = () => {
    setArchivoNombre('estado_de_cuenta_ejemplo.pdf')
    setPaso(3)
    setError(null)
    // el ejemplo también pasa por el pipeline real (diccionario incluido)
    setEstado('leyendo el documento de ejemplo…')
    setTimeout(() => {
      if (!vivoRef.current) return
      setFilas(procesarFilas(DEMO_OCR))
      setPaso(4)
    }, 1600)
  }

  return (
    <div className="cd-wiz-fondo" onPointerDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <div className="cd-wiz" role="dialog" aria-label="Importar cartera">
        <div className="cd-wiz-cab">
          <div className="cd-wiz-pasos">
            {[1, 2, 3, 4, 5].map((p) => <i key={p} className={p <= paso ? 'hecho' : ''} />)}
          </div>
          <button className="cd-wiz-cerrar" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>

        {paso === 1 && (
          <div>
            <h3>¿De qué broker proviene tu cartera?</h3>
            <p className="muted cd-sub">Selecciona el origen para mejorar la precisión del reconocimiento.</p>
            <div className="cd-brokers">
              {BROKERS.map((b) => (
                <button key={b.n} className="cd-broker" onClick={() => {
                  if (b.n === 'Otro broker') { setOtroAbierto(true); return }
                  setBroker(b); setPaso(2)
                }}>
                  <span className="logo" style={{ background: b.c }}>{b.ini}</span>
                  <span>{b.n}<small>{b.n === 'Otro broker' ? 'lo intentaremos igual' : 'formato conocido'}</small></span>
                </button>
              ))}
            </div>
            {otroAbierto && (
              <div className="cd-otro-broker">
                <input type="text" value={otroNombre} maxLength="40" placeholder="Escribe el nombre de tu broker"
                  onChange={(e) => setOtroNombre(e.target.value)} autoFocus />
                <button className="btn cd-btn-mini" onClick={() => {
                  setBroker({ n: otroNombre.trim() || 'tu broker', sab: 'Otra', plantilla: null })
                  setPaso(2)
                }}>Seguir</button>
              </div>
            )}
            <NotaSentinel />
          </div>
        )}

        {paso === 2 && (
          <div>
            <h3>Sube tu cartera</h3>
            <p className="muted cd-sub">Documento de <b className="oro">{broker.n}</b>. También puedes arrastrar el archivo aquí.</p>
            <div className="cd-dropzone"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('encima') }}
              onDragLeave={(e) => e.currentTarget.classList.remove('encima')}
              onDrop={(e) => {
                e.preventDefault()
                e.currentTarget.classList.remove('encima')
                const f = e.dataTransfer.files?.[0]
                if (f) leerArchivo(f)
              }}>
              <div className="icono-drop">🛰</div>
              <div className="principal">Suelta tu archivo o toca para elegirlo</div>
              <div className="secundario">Sentinel lo leerá sin que salga de tu equipo</div>
            </div>
            <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) leerArchivo(f) }} />
            <div className="cd-tipos-doc">
              <div className="cd-tipo-doc"><span className="em">📊</span><b>CSV / Excel</b><span className="cd-fiab buena">lo más confiable ✓</span></div>
              <div className="cd-tipo-doc"><span className="em">📄</span><b>PDF</b><span className="cd-fiab ok">se lee bien</span></div>
              <div className="cd-tipo-doc"><span className="em">📷</span><b>Foto / captura</b><span className="cd-fiab floja">puede fallar</span></div>
            </div>
            <div className="cd-wiz-honesto">
              🫡 <b>Con la mano en el corazón:</b> un <b>CSV o Excel</b> (o un PDF) se lee casi perfecto porque
              son texto. Una <b>foto</b> se descifra con OCR y ahí <b>siempre se cuela algún error</b> —
              tickers mal leídos, comas corridas, costos que no cuadran. Si solo tienes foto, úsala,
              pero <b>revisa cada fila</b> antes de confirmar… o, para pocas acciones, muchas veces es
              más rápido y seguro <b>anotarlas a mano</b>.
              <div style={{ marginTop: 8 }}>
                <button className="btn cd-btn-mini" onClick={onCerrar}>✍️ Mejor lo agrego a mano</button>
              </div>
            </div>
            <div className="cd-wiz-ejemplo">
              <button className="btn cd-btn-mini cd-btn-fantasma" onClick={usarDemo}>No tengo uno a la mano — usa un documento de ejemplo</button>
            </div>
            <div className="cd-wiz-pie">
              <button className="btn cd-btn-mini cd-btn-fantasma" onClick={() => setPaso(1)}>‹ Atrás</button>
              <span />
            </div>
            <NotaSentinel />
          </div>
        )}

        {paso === 3 && (
          <div>
            <h3>Sentinel está leyendo…</h3>
            <p className="muted cd-sub">{archivoNombre} · {broker.n}</p>
            {!error ? (
              <>
                <div className="cd-radar"><div className="aguja" /><div className="centro">🛰</div></div>
                <div className="cd-analisis-msg">{estado || 'despertando a Sentinel…'}</div>
                {broker.plantilla && (
                  <div className="muted cd-sub">Plantilla de {broker.n}: {broker.plantilla}</div>
                )}
                <div className="muted cd-sub">Sin IA: solo columnas y el diccionario de las 114.</div>
              </>
            ) : (
              <>
                <div className="cd-wiz-error">🛰💔 {error}</div>
                <div className="cd-wiz-pie">
                  <button className="btn cd-btn-mini cd-btn-fantasma" onClick={() => { setError(null); setPaso(2) }}>‹ Probar con otro archivo</button>
                  <button className="btn cd-btn-mini" onClick={onCerrar}>Agregar a mano</button>
                </div>
              </>
            )}
          </div>
        )}

        {paso === 4 && (
          <PasoRevision filas={filas} setFilas={setFilas} broker={broker}
            onAtras={() => setPaso(2)} onSeguir={() => setPaso(5)} onRecordatorio={onRecordatorio} />
        )}

        {paso === 5 && (
          <PasoFinal filas={filas} broker={broker}
            onAtras={() => setPaso(4)}
            onCrear={() => {
              const importar = filas.filter((f) => f.accion === 'importar')
              onImportar(importar.map((f) => ({
                t: f.t, cant: f.cant, costo: f.costo,
                manual: !!f.sinDatos, sinDatos: !!f.sinDatos,
                nombre: f.sinDatos ? f.crudo : undefined,
              })), broker.sab)
            }} />
        )}
      </div>
    </div>
  )
}

function NotaSentinel() {
  return (
    <div className="cd-sentinel-nota">
      <span>🛰</span>
      <span><b>Sentinel</b> — el mismo lector que ya lee los hechos de importancia — trabaja{' '}
        <b>dentro de tu navegador</b>: tu documento nunca sale de tu equipo. Sin nube, sin cuentas.</span>
    </div>
  )
}

// ── Paso 4: la revisión (el usuario siempre tiene el control) ────────────
function PasoRevision({ filas, setFilas, broker, onAtras, onSeguir, onRecordatorio }) {
  const opciones = empresasData.empresas.map((e) => e.ticker).sort()
  const intlPend = filas.filter((f) => f.estado === 'internacional' && f.accion === 'pendiente')
  const reconocidas = filas.filter((f) => f.accion === 'importar' && !f.sinDatos && !f.faltaCosto).length
  const decisiones = filas.filter((f) => f.accion === 'pendiente' || (f.faltaCosto && f.accion === 'importar')).length

  const cambia = (i, cambios) => setFilas(filas.map((f, j) => (j === i ? { ...f, ...cambios } : f)))

  return (
    <div>
      <h3>Revisa lo que encontró Sentinel</h3>
      <p className="muted cd-sub">
        ✔ <b className="verde">{filas.length}</b> encontradas · ✔ <b className="verde">{reconocidas}</b> reconocidas ·
        ⚠ <b className="ambar">{decisiones}</b> requiere{decisiones === 1 ? '' : 'n'} una decisión tuya
      </p>
      {intlPend.length > 0 && (
        <div className="cd-panel-intl">
          🌎 <b>Detectamos activos internacionales:</b> {intlPend.map((f) => f.crudo).join(', ')}.
          Actualmente ALTO Research solo administra empresas listadas en la Bolsa de Valores de Lima.
          <div className="botones">
            <button className="btn cd-btn-mini" onClick={() =>
              setFilas(filas.map((f) => (intlPend.includes(f) ? { ...f, accion: 'importar', sinDatos: true, t: f.crudo } : f)))}>
              ○ Importarlos igualmente (sin métricas avanzadas)
            </button>
            <button className="btn cd-btn-mini cd-btn-fantasma" onClick={() =>
              setFilas(filas.map((f) => (intlPend.includes(f) ? { ...f, accion: 'omitir' } : f)))}>
              ○ Omitirlos
            </button>
            <button className="btn cd-btn-mini cd-btn-fantasma" onClick={() => {
              onRecordatorio?.(`Avisarme cuando ALTO administre acciones internacionales (${intlPend.map((f) => f.crudo).join(', ')})`)
              setFilas(filas.map((f) => (intlPend.includes(f) ? { ...f, accion: 'omitir' } : f)))
            }}>
              ○ Esperar futuras actualizaciones 🔔
            </button>
          </div>
        </div>
      )}
      <div className="cd-rev-tabla">
        <div className="cd-rev-fila cab">
          <span>Empresa</span><span>Cantidad</span><span>Costo prom.</span><span>Estado</span>
        </div>
        {filas.map((f, i) => {
          const e = f.sinDatos ? null : empresaDe(f.t)
          const omitida = f.accion === 'omitir'
          const desconocidaPend = f.estado === 'desconocido' && f.accion === 'pendiente'
          let icono = '✅', status = ''
          if (omitida) { icono = '✕'; status = 'Omitida — no se importará.' }
          else if (f.estado === 'exacto') status = '✔ Coincidencia 100%'
          else if (f.estado === 'alias') status = `✔ Reconocida: «${f.crudo}» es ${f.t} en la BVL · coincidencia 100%`
          else if (f.estado === 'corregido') { icono = '🔧'; status = `✔ Corregido de «${f.crudo}» — error típico de OCR · coincidencia ${f.conf}%` }
          else if (f.estado === 'manual') status = '✔ Elegida por ti'
          else if (f.estado === 'internacional') { icono = '🌎'; status = f.sinDatos ? '🌎 Se importará sin métricas avanzadas.' : 'Activo internacional — decide en el panel azul.' }
          else { icono = '⚠️'; status = f.sinDatos ? '⚠ Se importará sin información financiera.' : `⚠ No tenemos información financiera para «${f.crudo}».` }
          return (
            <div key={i} className={omitida ? 'cd-rev-omitida' : ''}>
              <div className="cd-rev-fila">
                {desconocidaPend || f.sinDatos ? (
                  <span className={'cd-rev-crudo' + (desconocidaPend ? ' ambar' : '')}>{f.crudo}</span>
                ) : (
                  <select value={f.t} disabled={omitida}
                    onChange={(ev) => cambia(i, { t: ev.target.value, estado: 'manual', conf: 100 })}>
                    {opciones.map((t) => <option key={t}>{t}</option>)}
                  </select>
                )}
                <input type="number" value={f.cant} min="1" step="1" disabled={omitida}
                  onChange={(ev) => cambia(i, { cant: Math.max(1, Math.floor(Number(ev.target.value) || 1)) })} />
                <input type="number" value={f.costo ?? ''} min="0" step="0.0001" placeholder="PPC" disabled={omitida}
                  className={(f.faltaCosto && !f.costo) || f.ppcSospechoso ? 'ambar-borde' : ''}
                  onChange={(ev) => cambia(i, { costo: Number(ev.target.value) || 0, ppcSospechoso: false, ppcCorregido: false })} />
                <span className="cd-rev-derecha">
                  <span className="cd-rev-estado">{icono}</span>
                  {omitida ? (
                    <button className="cd-rev-boton verde" onClick={() =>
                      cambia(i, { accion: (f.estado === 'desconocido' || (f.estado === 'internacional' && !f.sinDatos)) ? 'pendiente' : 'importar' })}>
                      deshacer
                    </button>
                  ) : (
                    <button className="cd-rev-boton" aria-label="Omitir" onClick={() => cambia(i, { accion: 'omitir' })}>✕</button>
                  )}
                </span>
              </div>
              {desconocidaPend && (
                <div className="cd-rev-acciones-desc">
                  ¿Qué deseas hacer?
                  <select defaultValue="" onChange={(ev) => {
                    if (ev.target.value) cambia(i, { t: ev.target.value, estado: 'manual', accion: 'importar', sinDatos: false, conf: 100 })
                  }}>
                    <option value="">○ Buscar empresa…</option>
                    {opciones.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <button className="btn cd-btn-mini" onClick={() => cambia(i, { accion: 'importar', sinDatos: true, t: f.crudo })}>
                    ○ Importarla igualmente
                  </button>
                  <button className="btn cd-btn-mini cd-btn-fantasma" onClick={() => cambia(i, { accion: 'omitir' })}>○ Omitir</button>
                </div>
              )}
              <div className="cd-rev-status">
                {status}
                {!omitida && e && !f.sinDatos && f.costo > 0 && f.accion === 'importar' && e.precio != null && (
                  <RevExtra e={e} f={f} />
                )}
                {f.faltaCosto && !omitida && !(f.costo > 0) && (
                  <span className="ambar"> ⚠ No encontramos el costo promedio — escríbelo.</span>
                )}
                {f.ppcCorregido && !omitida && (
                  <span className="ambar"> 🔧 El costo leído parecía un total (o traía la coma corrida); lo ajustamos al precio por acción — verifícalo.</span>
                )}
                {f.ppcSospechoso && !f.ppcCorregido && !omitida && (
                  <span className="ambar"> ⚠ ¿El costo estará bien leído? Está muy lejos del precio actual — revísalo.</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="btn cd-btn-mini" onClick={() => {
          const t0 = opciones[0]
          setFilas([...filas, {
            crudo: t0, t: t0, cant: 100, costo: empresaDe(t0)?.precio || 1,
            estado: 'manual', conf: 100, accion: 'importar', faltaCosto: false,
          }])
        }}>+ Agregar una empresa manualmente</button>
      </div>
      <div className="cd-wiz-pie">
        <button className="btn cd-btn-mini cd-btn-fantasma" onClick={onAtras}>‹ Volver a subir</button>
        <button className="btn btn-oro" onClick={() => {
          const sinCosto = filas.filter((f) => f.accion === 'importar' && !(f.costo > 0))
          if (sinCosto.length) {
            alert(`A ${sinCosto.map((f) => f.t).join(', ')} le falta el costo promedio. Escríbelo u omítela.`)
            return
          }
          setFilas(filas.map((f) => (f.accion === 'pendiente' ? { ...f, accion: 'omitir' } : f)))
          onSeguir()
        }}>Continuar ›</button>
      </div>
    </div>
  )
}

function RevExtra({ e, f }) {
  const gan = ((e.precio - f.costo) / f.costo) * 100
  const d12 = divUlt12(f.t)
  return (
    <span className="cd-rev-extra">
      {' '}· hoy {fmtPrecioExacto(e.precio, e.moneda)} ·{' '}
      <span className={gan >= 0 ? 'pos' : 'neg'}>{gan >= 0 ? '+' : ''}{gan.toFixed(1)}%</span>
      {d12 > 0 && <> · div. 12 m {fmtS(d12 * f.cant)}</>}
    </span>
  )
}

// ── Paso 5: resumen y creación ────────────────────────────────────────────
function PasoFinal({ filas, broker, onAtras, onCrear }) {
  const importar = filas.filter((f) => f.accion === 'importar')
  const omitidas = filas.filter((f) => f.accion === 'omitir')
  const sinDatos = importar.filter((f) => f.sinDatos)
  const valorTotal = importar.reduce((a, f) => {
    const e = f.sinDatos ? null : empresaDe(f.t)
    const precio = e?.precio ?? f.costo
    return a + f.cant * enSoles(precio, e?.moneda || 'S/')
  }, 0)
  return (
    <div>
      <h3>Todo listo</h3>
      <p className="muted cd-sub">Sentinel y el diccionario hicieron su trabajo. La decisión final es tuya.</p>
      <div className="cd-resumen-nums">
        <div className="cd-resumen-num"><div className="n">{filas.length}</div><div className="t">detectadas</div></div>
        <div className="cd-resumen-num ok"><div className="n">{importar.length}</div><div className="t">se importarán</div></div>
        <div className="cd-resumen-num duda"><div className="n">{omitidas.length}</div><div className="t">omitidas</div></div>
      </div>
      {importar.length > 0 && (
        <p className="cd-sub" style={{ textAlign: 'center' }}>
          Valor aproximado al último cierre: <b className="oro">{fmtS(valorTotal)}</b> · SAB: {broker.sab}
        </p>
      )}
      {sinDatos.length > 0 && (
        <div className="cd-rev-aviso">🌎 {sinDatos.map((f) => f.t).join(', ')} se guardará{sinDatos.length === 1 ? '' : 'n'} sin métricas ALTO (solo cantidad y costo).</div>
      )}
      {omitidas.length > 0 && (
        <div className="cd-rev-aviso tenue">Quedan fuera: {omitidas.map((f) => f.crudo || f.t).join(', ')}. Puedes volver atrás si cambias de idea.</div>
      )}
      <div className="cd-disclaimer">
        La información fue reconocida automáticamente a partir del documento proporcionado. Aunque hacemos
        todo lo posible por identificar correctamente cada posición, recomendamos revisar cantidades, precios
        y empresas antes de guardar. Siempre podrás editar, agregar o eliminar posiciones posteriormente.
        La decisión final sobre los datos almacenados es del usuario.
      </div>
      <div className="cd-wiz-pie">
        <button className="btn cd-btn-mini cd-btn-fantasma" onClick={onAtras}>‹ Revisar de nuevo</button>
        <button className="btn btn-oro" disabled={!importar.length} onClick={onCrear}>📓 Crear mi Cuaderno</button>
      </div>
    </div>
  )
}
