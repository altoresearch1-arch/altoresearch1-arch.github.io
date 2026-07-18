import { useEffect, useMemo, useRef, useState } from 'react'
import empresasData from '../data/empresas.json'
import Sparkline from './Sparkline'
import ImportarCartera from './ImportarCartera'
import TourGuia, { PASOS_CUADERNO } from './TourGuia'
import {
  leerCartera, guardarCartera, leerNotas, guardarNotas,
  leerRecordatorios, guardarRecordatorios, leerVisitaAnterior, marcarVisita,
  leerCuadernos, guardarCuadernos, leerActivo, guardarActivo, borrarDatosCuaderno,
  COLORES_CUADERNO, COLOR_DEFECTO, MAX_CUADERNOS,
  TC, esUSD, enSoles, fmtS, fmtP, fmtPrecioExacto, fmtSyD, fmtUSD, nombreCorto, MESES, MESES_C, fechaCorta, haceDias,
  empresaDe, filasDe, divUlt12PorAccion, proyecciones, recibidosRecientes,
  catBonita, tipoPunto, acuerdoDividendo, normTicker, SABS, CARTERA_DEMO,
} from '../lib/cartera'

// ─────────────────────────────────────────────────────────────────────────
// 📓 MI CUADERNO — la cartera del usuario, viva con los datos de los robots.
// Portado del prototipo aprobado (Artifact "Mi Cuaderno", 16-jul) a la app.
// Todo local (localStorage), todo honesto: precios BVL reales, dividendos
// del historial real, hechos con el semáforo del lector 🛰; lo estimado se
// llama estimado y lo que no se sabe no se inventa.
// ─────────────────────────────────────────────────────────────────────────

const COLORES = ['#d4af37', '#4f9d6b', '#6b8fc9', '#c0563f', '#9a7bb8',
  '#c79a3a', '#5aa3a3', '#b56a8a', '#7a9e5f', '#8a8a80']

// Fusiona una compra en la cartera. Si el MISMO ticker ya está en OTRA SAB, se
// guarda un desglose por SAB en `lotes` y la posición pasa a "repartida en varias
// SAB" (pedido de Jair). Si es la misma SAB, solo promedia el costo. Mutará `nueva`.
function fusionarPosicion(nueva, { t, cant, costo, sab, nombre, manual, sinDatos }) {
  if (!t) return
  const idx = nueva.findIndex((c) => c.t === t)
  if (idx < 0) {
    const pos = { t, cant, costo, sab }
    if (nombre) pos.nombre = nombre
    if (manual) pos.manual = true
    if (sinDatos) pos.sinDatos = true
    nueva.push(pos)
    return
  }
  const c = nueva[idx]
  const lotes = c.lotes ? c.lotes.map((l) => ({ ...l })) : [{ sab: c.sab, cant: c.cant, costo: c.costo }]
  const li = lotes.findIndex((l) => (l.sab || '') === (sab || ''))
  if (li >= 0) {
    const tot = lotes[li].cant + cant
    lotes[li].costo = tot ? (lotes[li].cant * lotes[li].costo + cant * costo) / tot : lotes[li].costo
    lotes[li].cant = tot
  } else {
    lotes.push({ sab, cant, costo })
  }
  const totalCant = lotes.reduce((a, l) => a + l.cant, 0)
  const totalCosto = totalCant ? lotes.reduce((a, l) => a + l.cant * l.costo, 0) / totalCant : 0
  const sabsUnicas = [...new Set(lotes.map((l) => l.sab))]
  nueva[idx] = {
    ...c, cant: totalCant, costo: totalCosto,
    sab: sabsUnicas.length === 1 ? sabsUnicas[0] : null,
    lotes: sabsUnicas.length > 1 ? lotes : undefined,
  }
}

export default function Cuaderno({ onVerEmpresa, onRegistrarTour }) {
  // 📚 Varios cuadernos (máx 3, con nombre y color) — pedido de Jair.
  const [cuadernos, setCuadernos] = useState(leerCuadernos)
  const [activo, setActivo] = useState(leerActivo)
  const [configAbierta, setConfigAbierta] = useState(false)
  const cuadernoActual = cuadernos.find((c) => c.id === activo) || cuadernos[0]
  const acento = cuadernoActual?.color || COLOR_DEFECTO

  const [cartera, setCartera] = useState(() => leerCartera(activo))
  const [notas, setNotas] = useState(() => leerNotas(activo))
  const [recs, setRecs] = useState(() => leerRecordatorios(activo))
  // Al cambiar de cuaderno: recargar sus datos y recordar cuál quedó abierto.
  const montado = useRef(false)
  useEffect(() => {
    guardarActivo(activo)
    if (!montado.current) { montado.current = true; return }
    setCartera(leerCartera(activo)); setNotas(leerNotas(activo)); setRecs(leerRecordatorios(activo))
    setExpandido(null); setFormAbierto(false); setImportando(false)
  }, [activo])

  const guardarCuadernosState = (list) => { setCuadernos(list); guardarCuadernos(list) }
  const crearCuaderno = () => {
    if (cuadernos.length >= MAX_CUADERNOS) return
    const id = 'c' + Date.now().toString(36)
    const usados = cuadernos.map((c) => c.color)
    const color = (COLORES_CUADERNO.find((c) => !usados.includes(c.hex)) || COLORES_CUADERNO[0]).hex
    guardarCuadernosState([...cuadernos, { id, nombre: `Cuaderno ${cuadernos.length + 1}`, color }])
    setActivo(id)
    setConfigAbierta(true)
  }
  const renombrarCuaderno = (nombre) =>
    guardarCuadernosState(cuadernos.map((c) => (c.id === activo ? { ...c, nombre } : c)))
  const colorCuaderno = (hex) =>
    guardarCuadernosState(cuadernos.map((c) => (c.id === activo ? { ...c, color: hex } : c)))
  const borrarCuaderno = () => {
    if (cuadernos.length <= 1) return
    if (!confirm(`¿Borrar el cuaderno «${cuadernoActual.nombre}» y TODO lo que tiene dentro? No se puede deshacer.`)) return
    borrarDatosCuaderno(activo)
    const resto = cuadernos.filter((c) => c.id !== activo)
    guardarCuadernosState(resto)
    setActivo(resto[0].id)
    setConfigAbierta(false)
  }
  const [filtro, setFiltro] = useState({ tipo: 'todas', sab: null })
  const [expandido, setExpandido] = useState(null)
  const [formAbierto, setFormAbierto] = useState(false)
  const [importando, setImportando] = useState(false)
  const [toast, setToast] = useState(null)
  const hoy = useMemo(() => new Date(), [])
  const [calMes, setCalMes] = useState({ y: hoy.getFullYear(), m: hoy.getMonth() })
  const [calSel, setCalSel] = useState(null)
  const visitaAnterior = useMemo(() => leerVisitaAnterior(), [])
  useEffect(() => { marcarVisita() }, [])

  const toastTimer = useRef(null)
  const avisar = (msj) => {
    setToast(msj)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 5200)
  }
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const ponCartera = (c) => { setCartera(c); guardarCartera(c, activo) }
  const ponNotas = (n) => { setNotas(n); guardarNotas(n, activo) }
  const ponRecs = (r) => { setRecs(r); guardarRecordatorios(r, activo) }

  // 🚶 Tour de Mi Cuaderno (pedido de Jair 17-jul). Para poder mostrar TODO de
  // la mano, si el cuaderno está vacío carga una cartera de EJEMPLO (simulación)
  // antes de arrancar; al cerrar la borra sola. Si el usuario ya tenía la suya,
  // NO la toca. El velo del tour bloquea la interacción, así que mientras corre
  // la cartera no cambia — al cerrar basta con saber si fue ejemplo temporal.
  const [tourAbierto, setTourAbierto] = useState(false)
  const demoTemporal = useRef(false)
  const arrancarTour = useRef(null)
  arrancarTour.current = () => {
    let espera = 0
    if (cartera.length === 0) {
      ponCartera(CARTERA_DEMO.map((c) => ({ ...c })))
      demoTemporal.current = true
      espera = 430 // deja montar y pintar las secciones antes de medir el 1er paso
    }
    setTimeout(() => setTourAbierto(true), espera)
  }
  useEffect(() => {
    onRegistrarTour?.(() => arrancarTour.current())
  }, [onRegistrarTour])
  const cerrarTour = () => {
    setTourAbierto(false)
    if (demoTemporal.current) {
      demoTemporal.current = false
      ponCartera([])
      avisar('🧹 Borré la cartera de ejemplo del tour. Ahora arma la tuya: 🛰 Importar de mi broker o + Agregar.')
    }
  }
  // Si te vas del cuaderno con el ejemplo puesto (ej. botón atrás), no lo dejes pegado.
  useEffect(() => () => {
    if (demoTemporal.current) guardarCartera([], activo)
  }, [])

  const { filas, totalValor, totalCosto, ganTotal, cambioDia, suben, bajan } =
    useMemo(() => filasDe(cartera), [cartera])
  const proys = useMemo(() => proyecciones(filas), [filas])

  const hrs = hoy.getHours()
  const saludo = (hrs < 12 ? 'Buenos días' : hrs < 19 ? 'Buenas tardes' : 'Buenas noches') +
    '. Este cuaderno es tuyo.'

  const desde7 = new Date(hoy - 7 * 86400000)
  const hechosNuevos = filas.reduce((a, f) =>
    a + f.e.hechos.filter((h) => new Date(h.fecha + 'T12:00:00') >= desde7).length, 0)
  const prox = proys[0]

  // agregar / fusionar una posición (promedia el costo; desglosa por SAB si aplica)
  const agregarPosicion = (pos) => {
    const nueva = [...cartera]
    fusionarPosicion(nueva, pos)
    ponCartera(nueva)
  }

  // Alta en BLOQUE (importar del broker): fusiona TODAS las posiciones sobre una
  // sola copia y guarda una vez. Antes se llamaba agregarPosicion en un forEach,
  // pero cada llamada partía de la misma `cartera` del closure y se pisaban entre
  // sí → solo entraba la última (bug: "reconoció 16 y solo quedó una"). 17-jul.
  const agregarVarias = (posiciones, broker) => {
    const nueva = [...cartera]
    let entraron = 0
    posiciones.forEach((p) => {
      if (!p.t) return
      fusionarPosicion(nueva, { ...p, sab: p.sab ?? broker })
      entraron += 1
    })
    ponCartera(nueva)
    return entraron
  }

  return (
    <div className="cuaderno" style={{ '--oro': acento }}>
      {/* 📚 Tus cuadernos (máx 3, con nombre y color) */}
      <div className="cd-cuadernos">
        <div className="cd-cua-pills">
          {cuadernos.map((c) => (
            <button key={c.id}
              className={'cd-cua-pill' + (c.id === activo ? ' on' : '')}
              onClick={() => setActivo(c.id)}>
              <span className="punto" style={{ background: c.color }} />
              {c.nombre}
            </button>
          ))}
          {cuadernos.length < MAX_CUADERNOS && (
            <button className="cd-cua-nuevo" onClick={crearCuaderno} title="Nuevo cuaderno">＋</button>
          )}
        </div>
        <button className={'cd-cua-config-btn' + (configAbierta ? ' on' : '')}
          onClick={() => setConfigAbierta((v) => !v)} title="Nombre y color de este cuaderno">⚙️</button>
      </div>
      {configAbierta && (
        <div className="cd-cua-panel">
          <label className="cd-cua-nombre">
            <span>Nombre</span>
            <input type="text" value={cuadernoActual.nombre} maxLength={24}
              onChange={(ev) => renombrarCuaderno(ev.target.value)} placeholder="Mi Cuaderno" />
          </label>
          <div className="cd-cua-colores-lbl">🎨 Color de este cuaderno</div>
          <div className="cd-cua-colores">
            {COLORES_CUADERNO.map((col) => (
              <button key={col.hex} title={col.nombre}
                className={'cd-cua-color' + (cuadernoActual.color === col.hex ? ' on' : '')}
                style={{ background: col.hex }}
                onClick={() => colorCuaderno(col.hex)} />
            ))}
          </div>
          {cuadernos.length > 1 && (
            <button className="btn cd-btn-mini cd-btn-rojo cd-cua-borrar" onClick={borrarCuaderno}>
              🗑 Borrar este cuaderno
            </button>
          )}
        </div>
      )}

      {/* ── Cabecera: el patrimonio respira ── */}
      <p className="cd-saludo">{saludo}</p>
      <div className="cd-color-nota muted">
        Guardado en tu navegador — sin cuentas, sin nube. TC S/ {TC} y precios del robot.
      </div>
      {cartera.length > 0 && <p className="cd-portafolio-lbl">Esto vale tu portafolio</p>}
      <p className="cd-patrimonio">{fmtS(totalValor)}</p>
      {totalValor > 0 && <p className="cd-patrimonio-usd muted">≈ {fmtUSD(totalValor / TC)}</p>}
      {totalCosto > 0 && (
        <p className={'cd-variacion ' + (ganTotal >= 0 ? 'pos' : 'neg')}>
          {ganTotal >= 0 ? '▲ +' : '▼ '}{ganTotal.toFixed(1)}%
          <small> desde tus compras ({fmtS(totalCosto)}) · hoy {cambioDia >= 0 ? '+' : '−'}{fmtS(Math.abs(cambioDia)).replace('S/ ', 'S/ ')}</small>
        </p>
      )}
      {cartera.length > 0 && (
        <div className="cd-pulso-hoy">
          <span>📈 <b>{suben}</b> suben</span>
          <span>📉 <b>{bajan}</b> bajan</span>
          {prox && <span>💰 próximo dividendo <b>en {Math.max(1, Math.round((prox.fecha - hoy) / 86400000))} días</b></span>}
          <span>🔔 <b>{hechosNuevos}</b> hechos nuevos esta semana</span>
        </div>
      )}

      {cartera.length > 0 && (
        <DesdeUltimaVisita filas={filas} hechosNuevos={hechosNuevos} visitaAnterior={visitaAnterior} />
      )}

      {/* ── Este es tu portafolio (tus acciones) ── */}
      <div className="cd-seccion-cab">
        <h2 data-tour="cd-acciones">📊 Este es tu portafolio</h2>
        <div className="cd-botonera">
          <button className="btn cd-btn-mini cd-btn-oro" onClick={() => setImportando(true)}>🛰 Importar de mi broker</button>
          <button className="btn cd-btn-mini" onClick={() => setFormAbierto((v) => !v)}>+ Agregar</button>
          {cartera.length > 0 && (
            <button className="btn cd-btn-mini cd-btn-rojo" onClick={() => {
              if (confirm(`⚠ ¿Borrar TODAS tus ${cartera.length} empresas del cuaderno?\n\nTus notas y recordatorios se conservan.`)) {
                const n = cartera.length
                ponCartera([]); setExpandido(null); setFiltro({ tipo: 'todas', sab: null })
                avisar(`🧹 Cuaderno en blanco — se borraron ${n} empresas. Hoja nueva, historia nueva.`)
              }
            }}>🧹 Limpiar</button>
          )}
        </div>
      </div>
      {cartera.length > 0 && (
        <div className="cd-portafolio-valor">
          <span className="cd-pv-num">{fmtS(totalValor)}</span>
          <span className="cd-pv-usd">≈ {fmtUSD(totalValor / TC)}</span>
          {totalCosto > 0 && (
            <span className={'cd-pv-gan ' + (ganTotal >= 0 ? 'pos' : 'neg')}>
              {ganTotal >= 0 ? '▲ +' : '▼ '}{ganTotal.toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {formAbierto && (
        <FormAgregar
          cartera={cartera}
          onCancelar={() => setFormAbierto(false)}
          onAgregar={(pos) => {
            agregarPosicion(pos)
            setFormAbierto(false)
            avisar(`📓 ${pos.t} anotada en tu cuaderno.`)
          }}
        />
      )}

      <Hoja
        filas={filas} filtro={filtro} setFiltro={setFiltro}
        expandido={expandido} setExpandido={setExpandido}
        notas={notas} ponNotas={ponNotas}
        onGuardarFila={(t, cambios) => {
          ponCartera(cartera.map((c) => (c.t === t ? { ...c, ...cambios } : c)))
        }}
        onQuitar={(t) => {
          ponCartera(cartera.filter((c) => c.t !== t))
          setExpandido(null)
        }}
        onEjemplo={() => {
          ponCartera(CARTERA_DEMO.map((c) => ({ ...c })))
          avisar('📓 Cartera de ejemplo cargada — 8 empresas de vuelta en casa.')
        }}
        onVerEmpresa={onVerEmpresa}
        totalValor={totalValor} ganTotal={ganTotal}
      />

      {cartera.length > 0 && (
        <>
          <h2>Comprar más</h2>
          <Calculadora cartera={cartera} />

          <h2 data-tour="cd-flujo">Próximo flujo de efectivo ⭐</h2>
          <Flujo filas={filas} proys={proys} hoy={hoy} />

          <h2 data-tour="cd-calendario">Calendario inteligente</h2>
          <Calendario filas={filas} proys={proys} hoy={hoy}
            calMes={calMes} setCalMes={setCalMes} calSel={calSel} setCalSel={setCalSel} />

          <h2 data-tour="cd-pulso">El pulso de tus empresas 🛰</h2>
          <p className="muted cd-sub">Hechos de importancia reales de la BVL, con el semáforo del lector.</p>
          <Pulso filas={filas} onVerEmpresa={onVerEmpresa} />

          <h2 data-tour="cd-vigilar">Lo que debes vigilar</h2>
          <Vigilar filas={filas} proys={proys} hoy={hoy} />
        </>
      )}

      <h2 data-tour="cd-recordatorios">Recordatorios</h2>
      <Recordatorios recs={recs} ponRecs={ponRecs} />

      {cartera.length > 0 && (
        <>
          <h2>Mi historia · el diario del inversionista</h2>
          <Diario filas={filas} hoy={hoy} />

          <h2>Resumen por SAB</h2>
          <PorSAB filas={filas} totalValor={totalValor} />

          <h2>Salud de la cartera</h2>
          <Salud filas={filas} cartera={cartera} totalValor={totalValor} />

          <h2 data-tour="cd-torta">Mi torta</h2>
          <Torta filas={filas} totalValor={totalValor} />
        </>
      )}

      <div className="cd-pie muted">
        Guardado en tu navegador (localStorage) — sin cuentas, sin nube, sin backend.<br />
        Los estimados usan el patrón histórico real de cada empresa; no son promesas.
      </div>

      {importando && (
        <ImportarCartera
          onCerrar={() => setImportando(false)}
          onImportar={(posiciones, broker) => {
            const n = agregarVarias(posiciones, broker)
            setImportando(false)
            avisar(`🛰 Sentinel importó ${n} ${n === 1 ? 'posición' : 'posiciones'} a tu cuaderno. Bienvenidas a casa.`)
          }}
          onRecordatorio={(txt) => ponRecs([...recs, { txt, ok: false }])}
        />
      )}

      {toast && <div className="cd-toast visible">{toast}</div>}

      {tourAbierto && <TourGuia pasos={PASOS_CUADERNO} onCerrar={cerrarTour} />}
    </div>
  )
}

// ── Desde tu última visita ────────────────────────────────────────────────
function DesdeUltimaVisita({ filas, hechosNuevos, visitaAnterior }) {
  const hoy = new Date()
  const movers = filas.filter((f) => f.dia !== 0)
    .sort((a, b) => Math.abs(b.dia) - Math.abs(a.dia)).slice(0, 4)
  const confirmados = filas
    .map((f) => ({ t: f.t, a: acuerdoDividendo(f.t) }))
    .filter((x) => x.a && (hoy - new Date(x.a.fecha + 'T12:00:00')) < 45 * 86400000)
  if (!movers.length && !confirmados.length && !hechosNuevos) return null
  return (
    <>
      <h2>{visitaAnterior ? 'Desde tu última visita' : 'Hoy en tus empresas'}</h2>
      <div className="card cd-tarjeta cd-desde">
        {movers.map((f) => (
          <div className="cd-item" key={f.t}>
            <span className="cd-icono">{f.dia > 0 ? '🟢' : '🔴'}</span>
            <span>
              <b>{f.t}</b>{' '}
              <span className={f.dia > 0 ? 'pos' : 'neg'}>{f.dia > 0 ? '+' : ''}{f.dia.toFixed(1)}%</span>{' '}
              <small className="muted">({fmtP(f.e.previo, f.e.moneda)} → {fmtP(f.e.precio, f.e.moneda)})</small>
            </span>
          </div>
        ))}
        {confirmados.map((x) => (
          <div className="cd-item" key={'a' + x.t}>
            <span className="cd-icono">💰</span>
            <span><b>{x.t}</b> publicó acuerdo sobre dividendos el {fechaCorta(x.a.fecha)} — hecho de importancia real.</span>
          </div>
        ))}
        <div className="cd-item">
          <span className="cd-icono">📄</span>
          <span><b>{hechosNuevos}</b> hechos de importancia nuevos en tus empresas esta semana — míralos en el pulso 🛰.</span>
        </div>
      </div>
    </>
  )
}

// Selector de SAB con opción de ESCRIBIR el tuyo (pedido de Jair): al elegir
// «Otra» aparece un campito para teclear el nombre. Se usa igual en Agregar y
// en Modificar (antes la lista no calzaba: Inteligo salía en una y en otra no).
const SABS_FIJOS = SABS.filter((s) => s !== 'Otra')
function SelectorSAB({ value, onChange }) {
  const enLista = SABS_FIJOS.includes(value)
  const esOtra = !enLista // valor libre (o vacío) → modo "Otra"
  return (
    <>
      <select value={enLista ? value : 'Otra'} onChange={(ev) => {
        onChange(ev.target.value === 'Otra' ? '' : ev.target.value)
      }}>
        {SABS_FIJOS.map((s) => <option key={s}>{s}</option>)}
        <option value="Otra">Otra (escribir)…</option>
      </select>
      {esOtra && (
        <input type="text" className="cd-sab-otra" placeholder="Escribe tu SAB / broker"
          value={value === 'Otra' ? '' : value} maxLength={40}
          onChange={(ev) => onChange(ev.target.value)} />
      )}
    </>
  )
}

// ── La hoja de acciones ───────────────────────────────────────────────────
function pasaFiltro(f, filtro) {
  if (filtro.tipo === 'ganando' && f.gan < 0) return false
  if (filtro.tipo === 'perdiendo' && f.gan >= 0) return false
  if (filtro.tipo === 'condiv' && f.div12 <= 0) return false
  if (filtro.tipo === 'sindiv' && f.div12 > 0) return false
  if (filtro.sab && f.sab !== filtro.sab && !(f.lotes || []).some((l) => l.sab === filtro.sab)) return false
  return true
}

function Hoja({ filas, filtro, setFiltro, expandido, setExpandido, notas, ponNotas,
  onGuardarFila, onQuitar, onEjemplo, onVerEmpresa, totalValor, ganTotal }) {
  const tipos = [['todas', 'Todas'], ['ganando', '📈 Ganando'], ['perdiendo', '📉 Perdiendo'],
    ['condiv', '💰 Pagan dividendos'], ['sindiv', 'Sin dividendos']]
  const sabs = [...new Set(filas.flatMap((f) => (f.lotes ? f.lotes.map((l) => l.sab) : [f.sab])))].filter(Boolean)
  const visibles = filas.filter((f) => pasaFiltro(f, filtro))
  return (
    <>
      {filas.length > 0 && (
        <div className="cd-filtros">
          {tipos.map(([k, lbl]) => (
            <button key={k} className={'cd-chip-filtro' + (filtro.tipo === k ? ' activo' : '')}
              onClick={() => setFiltro({ ...filtro, tipo: k })}>{lbl}</button>
          ))}
          {sabs.map((s) => (
            <button key={s} className={'cd-chip-filtro' + (filtro.sab === s ? ' activo' : '')}
              onClick={() => setFiltro({ ...filtro, sab: filtro.sab === s ? null : s })}>{s}</button>
          ))}
          {(filtro.tipo !== 'todas' || filtro.sab) && (
            <button className="cd-chip-filtro limpiar"
              onClick={() => setFiltro({ tipo: 'todas', sab: null })}>✕ Limpiar filtros</button>
          )}
        </div>
      )}
      <div className="card cd-tarjeta cd-hoja-wrap">
        <div className="cd-hoja">
          <div className="cd-hoja-cab">
            <span>Empresa</span><span className="num">Acciones</span><span className="num">Precio compra</span>
            <span className="num">Precio</span><span className="num">Gan./pérd.</span><span className="num">Div. 12m</span>
          </div>
          {visibles.map((f) => (
            <FilaHoja key={f.t} f={f} abierta={expandido === f.t} notas={notas} ponNotas={ponNotas}
              onToggle={() => setExpandido(expandido === f.t ? null : f.t)}
              onGuardar={onGuardarFila} onQuitar={onQuitar} onVerEmpresa={onVerEmpresa} />
          ))}
          {!filas.length && (
            <div className="cd-vacio">
              <div className="cd-vacio-voz">Tu cuaderno está en blanco.</div>
              <div className="muted">Importa tu cartera desde tu broker, agrega una empresa a mano…<br />
                o empieza con la cartera de ejemplo.</div>
              <button className="btn cd-btn-mini" onClick={onEjemplo}>Cargar cartera de ejemplo</button>
            </div>
          )}
          {filas.length > 0 && !visibles.length && (
            <div className="cd-vacio muted">Ninguna empresa pasa este filtro.</div>
          )}
        </div>
        {filas.length > 0 && (
          <div className="cd-hoja-total">
            <span>{visibles.length} de {filas.length} empresas</span>
            <span>
              {fmtS(visibles.reduce((a, f) => a + f.valor, 0))}
              {filtro.tipo === 'todas' && !filtro.sab && totalValor > 0 &&
                ` · ${ganTotal >= 0 ? '+' : ''}${ganTotal.toFixed(1)}%`}
            </span>
          </div>
        )}
        {filas.length > 0 && (
          <details className="cd-hoja-leyenda">
            <summary>¿Qué significa cada columna?</summary>
            <ul>
              <li><b>Precio compra</b>: a qué precio compraste (o adquiriste) cada acción, en promedio.</li>
              <li><b>Precio</b>: cuánto vale una acción hoy en la Bolsa (último cierre del robot).</li>
              <li><b>Gan./pérd.</b>: cuánto ganas o pierdes <b>por ahora</b>, comparado con lo que pagaste. Sube y baja cada día — no es definitivo hasta que vendes.</li>
              <li><b>Div. 12m</b>: el dividendo que <b>recibirías en un año</b> si la empresa repite lo que pagó el año pasado, <b>en la moneda que ella paga</b> (varias reparten en US$). Es un estimado, no una promesa.</li>
            </ul>
          </details>
        )}
      </div>
    </>
  )
}

function FilaHoja({ f, abierta, notas, ponNotas, onToggle, onGuardar, onQuitar, onVerEmpresa }) {
  const e = f.e
  const sinPx = e.sinPrecio || e.sinDatos
  return (
    <>
      <button className={'cd-hoja-fila' + (abierta ? ' abierta' : '')} onClick={onToggle}>
        <span className="emp">
          <span className="tk">{f.t}{notas[f.t] ? ' 📝' : ''}</span>
          <span className="nm">{nombreCorto(e.nombre)} · {f.lotes ? `repartida en ${f.lotes.length} SAB` : f.sab}</span>
        </span>
        <span className="num">{f.cant.toLocaleString('es-PE')}</span>
        <span className="num">{fmtP(f.costo, e.moneda)}</span>
        <span className={'num' + (sinPx ? ' muted' : ' oro')}
          title={sinPx ? 'Sin precio reciente — se usa tu costo' : 'Último cierre del robot (igual que en la ficha de ALTO)'}>
          {sinPx ? '≈ ' : ''}{fmtPrecioExacto(e.precio, e.moneda)}
        </span>
        <span className={'num ' + (f.gan >= 0 ? 'pos' : 'neg')}>{f.gan >= 0 ? '+' : ''}{f.gan.toFixed(1)}%</span>
        <span className={'num' + (f.div12nat > 0 ? ' pos' : '')}
          title={f.div12nat > 0 && esUSD(f.divMoneda) ? `≈ ${fmtS(f.div12)}` : ''}>
          {f.div12nat > 0 ? fmtP(f.div12nat, f.divMoneda) : '—'}
        </span>
      </button>
      {abierta && <DetalleFila f={f} notas={notas} ponNotas={ponNotas}
        onGuardar={onGuardar} onQuitar={onQuitar} onVerEmpresa={onVerEmpresa} />}
    </>
  )
}

function DetalleFila({ f, notas, ponNotas, onGuardar, onQuitar, onVerEmpresa }) {
  const e = f.e
  const hoy = new Date()
  const [cant, setCant] = useState(f.cant)
  const [costo, setCosto] = useState(f.costo)
  const [sab, setSab] = useState(f.sab)
  const [nota, setNota] = useState(notas[f.t] || '')
  const [guardada, setGuardada] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const anios = Object.keys(e.porAnio || {}).map(Number).sort((a, b) => b - a).slice(0, 3).reverse()
  const chips = []
  if (e.frecuencia) chips.push({ c: 'oro', txt: e.frecuencia })
  if (e.yield) chips.push({ c: 'verde', txt: 'yield ' + e.yield })
  if (esUSD(e.divMoneda) && f.div12 > 0) chips.push({ c: '', txt: 'declara en US$' })
  if (e.sinNegoc) chips.push({ c: 'ambar', txt: 'poca negociación' })
  const ultimoPago = e.historial.length ? new Date(e.historial[0].fecha).getFullYear() : null
  if (!e.sinDatos && f.div12 === 0 && ultimoPago && ultimoPago < hoy.getFullYear() - 1)
    chips.push({ c: 'rojo', txt: 'sin dividendos desde ' + ultimoPago })
  if (!e.sinDatos && f.div12 === 0 && !ultimoPago)
    chips.push({ c: 'rojo', txt: 'nunca ha pagado dividendos' })
  if (e.sinDatos) chips.push({ c: 'ambar', txt: '🌎 sin métricas ALTO — solo lo guardamos por ti' })

  const cambiarNota = (v) => {
    setNota(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const nuevas = { ...notas }
      if (v.trim()) nuevas[f.t] = v.trim(); else delete nuevas[f.t]
      ponNotas(nuevas)
      setGuardada(true)
      setTimeout(() => setGuardada(false), 1800)
    }, 600)
  }

  return (
    <div className="cd-detalle">
      {!e.sinDatos && <Sparkline ticker={f.t} compacto />}
      <div className="cd-accion-datos">
        <div className="cd-dato"><div className="k">Valor hoy</div><div className="v oro">{fmtS(f.valor)}</div></div>
        <div className="cd-dato"><div className="k">Lo que pagaste</div><div className="v">{fmtS(f.costoT)}</div></div>
        <div className="cd-dato"><div className="k">Ganancia en soles</div>
          <div className={'v ' + (f.valor - f.costoT >= 0 ? 'pos' : 'neg')}>
            {f.valor - f.costoT >= 0 ? '+' : '−'}{fmtS(Math.abs(f.valor - f.costoT))}
          </div>
        </div>
        <div className="cd-dato"><div className="k">Div. si repite 12 m</div>
          <div className={'v' + (f.div12nat > 0 ? ' pos' : '')}>{f.div12nat > 0 ? fmtP(f.div12nat, f.divMoneda) : '—'}</div>
          {f.div12nat > 0 && esUSD(f.divMoneda) && <div className="muted" style={{ fontSize: 11 }}>≈ {fmtS(f.div12)}</div>}
        </div>
      </div>
      {f.lotes && (
        <div className="cd-lotes">
          <div className="cd-lotes-tit">🏦 Repartida en varias SAB — dónde están tus {f.cant.toLocaleString('es-PE')} acciones:</div>
          <ul>
            {f.lotes.map((l, i) => (
              <li key={i}>
                <b>{l.sab || 'sin SAB'}</b>: {l.cant.toLocaleString('es-PE')} acciones
                <span className="muted"> · compradas a {fmtP(l.costo, e.moneda)}</span>
              </li>
            ))}
          </ul>
          <div className="muted cd-lotes-nota">Para editarlas por separado, reimpórtalas o quítala y vuélvela a anotar por cada SAB.</div>
        </div>
      )}
      {anios.length > 0 && (
        <div className="cd-mini-divs">
          {anios.map((a, i) => (
            <div key={a} className={'cd-anio' + (i === anios.length - 1 ? ' ultimo' : '')}>
              <div className="a">{a}</div>
              <div className="m">{esUSD(e.divMoneda) ? 'US$ ' : 'S/ '}{Number(e.porAnio[a]).toFixed(3)}</div>
            </div>
          ))}
        </div>
      )}
      {chips.length > 0 && (
        <div className="cd-chips-linea">
          {chips.map((c, i) => <span key={i} className={'cd-chip ' + c.c}>{c.txt}</span>)}
        </div>
      )}
      <div className="cd-nota-personal">
        <div className="cd-titulo-nota">📝 Tu nota sobre {f.t}</div>
        <textarea className="cd-nota-texto" value={nota}
          placeholder="Ej.: no vender debajo de S/6.80 — esperar la expansión."
          onChange={(ev) => cambiarNota(ev.target.value)} />
        <div className="cd-nota-guardada">{guardada ? '✓ nota guardada' : ''}</div>
      </div>
      <div className="cd-editar">
        {!f.lotes && (
          <>
            <label className="cd-campo"><span>Acciones</span>
              <input type="number" value={cant} min="1" step="1" onChange={(ev) => setCant(ev.target.value)} />
            </label>
            <label className="cd-campo"><span>¿A qué precio compraste? ({esUSD(e.moneda) ? 'US$' : 'S/'})</span>
              <input type="number" value={costo} min="0" step="0.01" onChange={(ev) => setCosto(ev.target.value)} />
            </label>
            <label className="cd-campo"><span>SAB / broker</span>
              <SelectorSAB value={sab} onChange={setSab} />
            </label>
          </>
        )}
        <div className="cd-acciones-editar">
          {!e.sinDatos && (
            <button className="btn cd-btn-mini" onClick={() => onVerEmpresa?.(f.t)}>Ver su ficha →</button>
          )}
          {!f.lotes && (
            <button className="btn cd-btn-mini" onClick={() => {
              const c2 = Math.floor(Number(cant) || 0)
              const co2 = Number(costo) || 0
              if (c2 < 1 || co2 <= 0) { alert('Revisa la cantidad y el costo.'); return }
              onGuardar(f.t, { cant: c2, costo: co2, sab })
            }}>Guardar cambios</button>
          )}
          <button className="btn cd-btn-mini cd-btn-rojo" onClick={() => {
            if (confirm(`¿Quitar ${f.t} (${f.cant.toLocaleString('es-PE')} acciones) de tu cuaderno?`)) onQuitar(f.t)
          }}>Quitar</button>
        </div>
      </div>
    </div>
  )
}

// ── Agregar a mano: buscador de las 114 + manual para lo que no está ─────
function FormAgregar({ cartera, onCancelar, onAgregar }) {
  const [q, setQ] = useState('')
  const [listaAbierta, setListaAbierta] = useState(false)
  const [sel, setSel] = useState(null) // {t} | {manual:true}
  const [tkManual, setTkManual] = useState('')
  const [nomManual, setNomManual] = useState('')
  const [cant, setCant] = useState(100)
  const [costo, setCosto] = useState('')
  const [sab, setSab] = useState(SABS[0])
  const wrapRef = useRef(null)

  const TODAS = useMemo(() => empresasData.empresas
    .map((e) => ({
      t: e.ticker, nom: nombreCorto(e.nombre),
      q: normTicker(e.ticker + e.nombre),
      sinPrecio: empresaDe(e.ticker)?.precio == null,
    }))
    .sort((a, b) => a.t.localeCompare(b.t)), [])

  useEffect(() => {
    const fuera = (ev) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target)) setListaAbierta(false)
    }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [])

  const qn = normTicker(q)
  const hits = qn ? TODAS.filter((x) => x.q.includes(qn)) : TODAS
  const emp = sel && !sel.manual ? empresaDe(sel.t) : null
  const yaTiene = sel && !sel.manual ? cartera.find((c) => c.t === sel.t) : null

  const guardar = () => {
    if (!sel) { alert('Primero busca y elige la empresa (o márcala como fuera de ALTO).'); return }
    let t = sel.t, nombre = null, manual = false
    if (sel.manual) {
      t = normTicker(tkManual)
      if (!t) { alert('Ponle un ticker o código al valor (ej. AAPL).'); return }
      if (!empresaDe(t)) { nombre = nomManual.trim() || null; manual = true }
    }
    const c2 = Math.floor(Number(cant) || 0)
    const co2 = Number(costo) || 0
    if (c2 < 1 || co2 <= 0) { alert('Pon cuántas acciones y a qué precio las compraste.'); return }
    onAgregar({ t, cant: c2, costo: co2, sab, nombre, manual, sinDatos: manual })
  }

  return (
    <div className="card cd-tarjeta cd-form-agregar">
      <div className="cd-combo-emp" ref={wrapRef}>
        <label className="cd-campo cd-campo-ancho"><span>¿Qué empresa?</span>
          <input type="text" value={q} placeholder="Busca nombre o ticker…" autoComplete="off" spellCheck="false"
            onChange={(ev) => { setQ(ev.target.value); setSel(null); setListaAbierta(true) }}
            onFocus={() => setListaAbierta(true)} />
        </label>
        {listaAbierta && (
          <div className="cd-combo-lista">
            {hits.length ? hits.slice(0, 60).map((x) => (
              <button key={x.t} className="cd-combo-op" onClick={() => {
                setSel({ t: x.t }); setQ(x.t + ' — ' + x.nom); setListaAbierta(false)
                const e = empresaDe(x.t)
                if (e?.precio != null && !Number(costo)) setCosto(e.precio)
              }}>
                <b>{x.t}</b> — {x.nom}{x.sinPrecio && <small> · casi no negocia</small>}
              </button>
            )) : (
              <div className="cd-combo-vacia">No está entre las {TODAS.length} empresas de ALTO.</div>
            )}
            <button className="cd-combo-op cd-combo-otra" onClick={() => {
              setSel({ manual: true }); setListaAbierta(false)
              if (!tkManual) setTkManual(normTicker(q).slice(0, 12))
              if (!nomManual) setNomManual(q.trim())
            }}>
              ✎ No está en ALTO — agregarla igual{q.trim() ? ` («${q.trim()}»)` : ''}
            </button>
          </div>
        )}
      </div>
      {sel?.manual && (
        <div className="cd-fila-campos">
          <label className="cd-campo"><span>Ticker / código</span>
            <input type="text" value={tkManual} placeholder="Ej. AAPL" autoComplete="off" spellCheck="false"
              style={{ textTransform: 'uppercase' }} onChange={(ev) => setTkManual(ev.target.value)} />
          </label>
          <label className="cd-campo"><span>Nombre (opcional)</span>
            <input type="text" value={nomManual} placeholder="Ej. Apple Inc." autoComplete="off"
              onChange={(ev) => setNomManual(ev.target.value)} />
          </label>
        </div>
      )}
      <div className="cd-fila-campos">
        <label className="cd-campo"><span>¿Cuántas acciones?</span>
          <input type="number" value={cant} min="1" step="1" onChange={(ev) => setCant(ev.target.value)} />
        </label>
        <label className="cd-campo"><span>¿A qué precio? ({emp && esUSD(emp.moneda) ? 'US$' : 'S/'} por acción)</span>
          <input type="number" value={costo} min="0" step="0.01" onChange={(ev) => setCosto(ev.target.value)} />
        </label>
        <label className="cd-campo"><span>¿En qué SAB / broker?</span>
          <SelectorSAB value={sab} onChange={setSab} />
        </label>
      </div>
      <div className="cd-precio-info muted">
        {!sel && <>Busca la empresa por su nombre o ticker — están las <b>{TODAS.length}</b> de ALTO, y si no está, igual puedes anotarla.</>}
        {sel?.manual && <>✎ <b>Valor fuera de ALTO</b>: lo guardamos en tu cuaderno con tu precio de compra. Sin precio automático ni dividendos — no inventamos datos.</>}
        {emp && (
          <>
            {emp.precio != null
              ? <>Último cierre del robot: <b>{fmtP(emp.precio, emp.moneda)}</b> ({emp.fechaPrecio})</>
              : <><b>{sel.t}</b> casi no negocia en la BVL — se usará tu precio de compra.</>}
            {emp.yield && <> · yield {emp.yield}</>}
            {yaTiene && <><br />⚠ Ya tienes {yaTiene.cant.toLocaleString('es-PE')} — se sumarán y tu costo promedio se recalculará.</>}
          </>
        )}
      </div>
      <div className="cd-form-botones">
        <button className="btn cd-btn-mini cd-btn-fantasma" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn-oro" onClick={guardar}>Añadir a mi cuaderno</button>
      </div>
    </div>
  )
}

// ── Calculadora "comprar más" ─────────────────────────────────────────────
function Calculadora({ cartera }) {
  const [t, setT] = useState(cartera[0]?.t || '')
  const [monto, setMonto] = useState(5000)
  useEffect(() => {
    if (!cartera.find((c) => c.t === t)) setT(cartera[0]?.t || '')
  }, [cartera, t])
  const c = cartera.find((x) => x.t === t)
  if (!c) return null
  let e = empresaDe(c.t)
  const sinDatos = !e
  if (!e) e = { precio: c.costo, moneda: 'S/' }
  const precio = e.precio ?? c.costo
  const precioSoles = enSoles(precio, e.moneda)
  const nuevas = precioSoles > 0 ? Math.floor(Math.max(0, Number(monto) || 0) / precioSoles) : 0
  const divAcc = sinDatos ? 0 : divUlt12PorAccion(e)
  return (
    <div className="card cd-tarjeta cd-calc">
      <div className="cd-fila-campos">
        <label className="cd-campo"><span>Si le meto a…</span>
          <select value={t} onChange={(ev) => setT(ev.target.value)}>
            {cartera.map((x) => (
              <option key={x.t} value={x.t}>{x.t} · tienes {x.cant.toLocaleString('es-PE')}</option>
            ))}
          </select>
        </label>
        <label className="cd-campo"><span>…este monto (S/)</span>
          <input type="number" value={monto} min="0" step="100" onChange={(ev) => setMonto(ev.target.value)} />
        </label>
        <div className="cd-campo"><span>Precio hoy</span>
          <div className="cd-campo-falso">
            {fmtP(precio, e.moneda)}{esUSD(e.moneda) ? ` (≈ S/ ${precioSoles.toFixed(2)})` : ''}
          </div>
        </div>
      </div>
      <div className="cd-calc-res">
        <div className="cd-res"><div className="k">Comprarías</div><div className="v">{nuevas.toLocaleString('es-PE')}</div></div>
        <div className="cd-res"><div className="k">Tendrías en total</div><div className="v">{(c.cant + nuevas).toLocaleString('es-PE')}</div></div>
        <div className="cd-res"><div className="k">Si repite últimos 12 m</div>
          <div className="v verde">{divAcc > 0 ? fmtS(divAcc * (c.cant + nuevas)) : 'no paga'}</div></div>
      </div>
      <div className="muted cd-sub">Simulación educativa con el último cierre — no es recomendación de compra.</div>
    </div>
  )
}

// ── Flujo de efectivo: 6 meses + línea de tiempo ─────────────────────────
function Flujo({ filas, proys, hoy }) {
  const meses = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
    meses.push({ y: d.getFullYear(), m: d.getMonth(), total: 0, de: {} })
  }
  for (const p of proys) {
    for (const mm of meses) {
      if (p.fecha.getFullYear() === mm.y && p.fecha.getMonth() === mm.m) {
        mm.total += p.soles
        const prev = mm.de[p.t] || { nativo: 0, moneda: p.moneda }
        mm.de[p.t] = { nativo: prev.nativo + (p.nativo || 0), moneda: p.moneda }
      }
    }
  }
  const maxMes = Math.max(...meses.map((m) => m.total), 1)
  const total6 = meses.reduce((a, m) => a + m.total, 0)
  const en45 = proys.filter((p) => (p.fecha - hoy) / 86400000 <= 45).reduce((a, p) => a + p.soles, 0)
  const gordo = meses.reduce((a, m) => (m.total > a.total ? m : a), meses[0])
  const recibidos = recibidosRecientes(filas, 60)
  return (
    <>
      <p className="cd-flujo-frase">
        {total6 > 0 ? (
          <>
            Si nada cambia, recibirás aproximadamente <b>{fmtSyD(en45)}</b> durante los próximos
            45 días — y <b>{fmtSyD(total6)}</b> de aquí a {MESES[meses[5].m]}.
            <small> {MESES[gordo.m].charAt(0).toUpperCase() + MESES[gordo.m].slice(1)} es tu mes
              gordo: {fmtS(gordo.total)} de {Object.keys(gordo.de).length} empresa{Object.keys(gordo.de).length === 1 ? '' : 's'}.</small>
          </>
        ) : (
          <>Tus empresas no proyectan pagos en los próximos seis meses.
            <small> Buen momento para sembrar en las que sí reparten.</small></>
        )}
      </p>
      <div className="cd-flujo">
        {meses.map((mm, i) => {
          const esGordo = mm === gordo && mm.total > 0
          const humor = esGordo ? 'tu mes gordo 👑'
            : mm.total === 0 ? 'mes de siembra 🌱'
            : mm.total < maxMes * 0.25 ? 'una propinita'
            : 'buen riego 💧'
          return (
            <div key={i} className={'cd-mes' + (esGordo ? ' gordo' : '')}>
              <div className="cd-barrita"><i style={{ height: Math.max(2, (mm.total / maxMes) * 100).toFixed(0) + '%' }} /></div>
              <div className="n">{MESES[mm.m]}{i === 0 ? ' · hoy' : ''}</div>
              <div className={'m' + (mm.total ? '' : ' cero')}>{fmtS(mm.total)}</div>
              {mm.total > 0 && <div className="cd-mes-usd muted">≈ {fmtUSD(mm.total / TC)}</div>}
              <div className="de">
                {Object.entries(mm.de).map(([tk, info]) => (
                  <span key={tk} className="cd-mes-emp">{tk} <b>{fmtP(info.nativo, info.moneda)}</b></span>
                ))}
              </div>
              <div className="humor">{humor}</div>
            </div>
          )
        })}
      </div>
      <div className="card cd-tarjeta cd-linea-tiempo">
        {recibidos.slice(0, 3).map((r, i) => (
          <div key={'r' + i} className="cd-lt-item recibido">
            <div className="cuando">✓ {r.fecha.getDate()} {MESES_C[r.fecha.getMonth()].toLowerCase()}</div>
            <div className="que"><b>{r.t}</b> · <span className="monto">{fmtS(r.soles)} recibido</span></div>
          </div>
        ))}
        {proys.slice(0, 5).map((p, i) => {
          const acuerdo = acuerdoDividendo(p.t)
          return (
            <div key={'p' + i} className="cd-lt-item estimado">
              <div className="cuando">{p.fecha.getDate()} {MESES_C[p.fecha.getMonth()].toLowerCase()}</div>
              <div className="que">
                <b>{p.t}</b> · estimado <span className="monto">{fmtS(p.soles)}</span>{' '}
                {acuerdo ? <span className="cd-chip verde">📋 acuerdo publicado</span>
                  : p.mensual ? <span className="cd-chip">mensual</span>
                  : <span className="cd-chip ambar">pendiente de anuncio</span>}
              </div>
            </div>
          )
        })}
        {!recibidos.length && !proys.length && <div className="muted">Nada por aquí todavía.</div>}
      </div>
    </>
  )
}

// ── Calendario inteligente ────────────────────────────────────────────────
function eventosDelMes(filas, proys, y, m) {
  const porDia = {}
  const mete = (dia, ev) => { (porDia[dia] = porDia[dia] || []).push(ev) }
  for (const p of proys) {
    if (p.fecha.getFullYear() === y && p.fecha.getMonth() === m) {
      mete(p.fecha.getDate(), {
        tipo: 'div', t: p.t,
        texto: 'Dividendo esperado · ' + fmtS(p.soles) + ' para ti',
        sub: p.mensual ? 'paga cada mes (promedio de sus pagos)' : 'pagó en esta fecha hace un año',
        acuerdo: acuerdoDividendo(p.t),
      })
    }
  }
  for (const f of filas) {
    for (const h of f.e.hechos) {
      const fe = new Date(h.fecha + 'T12:00:00')
      if (fe.getFullYear() === y && fe.getMonth() === m) {
        const c = catBonita(h.categoria)
        mete(fe.getDate(), { tipo: tipoPunto(h.categoria), t: f.t, texto: c.txt, sub: h.titulo || c.extra || '', pdf: h.pdf, veredicto: h.veredicto })
      }
    }
  }
  return porDia
}

function Calendario({ filas, proys, hoy, calMes, setCalMes, calSel, setCalSel }) {
  const { y, m } = calMes
  const porDia = eventosDelMes(filas, proys, y, m)
  const arranque = (new Date(y, m, 1).getDay() + 6) % 7
  const diasMes = new Date(y, m + 1, 0).getDate()
  const celdas = []
  for (let i = 0; i < arranque; i++) celdas.push(null)
  for (let d = 1; d <= diasMes; d++) celdas.push(d)
  return (
    <div className="card cd-tarjeta cd-cal">
      <div className="cd-cal-cab">
        <button onClick={() => { setCalSel(null); setCalMes(m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }) }} aria-label="Mes anterior">‹</button>
        <span className="cd-mes-titulo">{MESES[m]} {y}</span>
        <button onClick={() => { setCalSel(null); setCalMes(m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }) }} aria-label="Mes siguiente">›</button>
      </div>
      <div className="cd-cal-grid">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <span key={d} className="cd-cal-sem">{d}</span>)}
        {celdas.map((d, i) => {
          if (d == null) return <span key={'v' + i} />
          const evs = porDia[d] || []
          const esHoy = y === hoy.getFullYear() && m === hoy.getMonth() && d === hoy.getDate()
          return (
            <button key={d}
              className={'cd-cal-celda' + (esHoy ? ' hoy-dia' : '') + (evs.length ? ' con-eventos' : '') + (calSel === d && evs.length ? ' sel' : '')}
              disabled={!evs.length}
              onClick={() => setCalSel(calSel === d ? null : d)}>
              <span>{d}</span>
              <span className="cd-cal-puntos">
                {evs.slice(0, 3).map((e, k) => <i key={k} className={'p-' + e.tipo} />)}
              </span>
            </button>
          )
        })}
      </div>
      <div className="cd-cal-leyenda muted">
        <span><i className="p-div" /> dividendo estimado</span>
        <span><i className="p-resultados" /> resultados</span>
        <span><i className="p-junta" /> junta</span>
        <span><i className="p-hecho" /> hecho</span>
      </div>
      {calSel && porDia[calSel] && (
        <div className="cd-cal-detalle">
          <div className="cd-fecha-titulo">{calSel} de {MESES[m]}</div>
          {porDia[calSel].map((ev, i) => {
            const luz = ev.tipo === 'div' ? '💰' : ev.veredicto === 'buena' ? '🟢'
              : ev.veredicto === 'mala' ? '🔴' : ev.tipo === 'junta' ? '🏛'
              : ev.tipo === 'resultados' ? '📊' : '🟡'
            return (
              <div key={i} className="cd-cal-evento">
                <span>{luz}</span>
                <span className="desc">
                  <b>{ev.t}</b> — {ev.texto}
                  {ev.sub && <small>{ev.sub}</small>}
                  {ev.acuerdo && <small><span className="cd-chip verde">📋 acuerdo publicado el {fechaCorta(ev.acuerdo.fecha)}</span></small>}
                  {ev.pdf && <small><a href={ev.pdf} target="_blank" rel="noopener noreferrer">Abrir documento oficial SMV ↗</a></small>}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── El pulso 🛰: últimos hechos con el semáforo del lector ───────────────
function Pulso({ filas, onVerEmpresa }) {
  const eventos = []
  for (const f of filas) for (const h of f.e.hechos) eventos.push({ t: f.t, ...h })
  eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  return (
    <div className="card cd-tarjeta cd-pulso">
      {eventos.slice(0, 9).map((ev, i) => {
        const luz = ev.veredicto === 'buena' ? '🟢' : ev.veredicto === 'mala' ? '🔴'
          : ev.veredicto === 'neutra' ? '🟡' : '⚪'
        const c = catBonita(ev.categoria)
        return (
          <div key={i} className="cd-pulso-item">
            <span className="cd-pulso-luz">{luz}</span>
            <span className="cd-pulso-que">
              <button className="tk" onClick={() => onVerEmpresa?.(ev.t)}>{ev.t}</button>
              <span className="cat">{c.txt}</span>
              {ev.titulo && ev.titulo.length > 3 && <span className="tit">{ev.titulo}</span>}
              {(ev.razon && (ev.veredicto === 'buena' || ev.veredicto === 'mala')) ? (
                <span className="razon">{ev.razon}</span>
              ) : c.extra ? <span className="razon">{c.extra}</span> : null}
              {ev.pdf && <a href={ev.pdf} target="_blank" rel="noopener noreferrer">documento SMV ↗</a>}
            </span>
            <span className="cd-pulso-cuando">{haceDias(ev.fecha)}</span>
          </div>
        )
      })}
      {!eventos.length && <div className="muted">Sin hechos recientes en tus empresas.</div>}
    </div>
  )
}

// ── Lo que debes vigilar: derivado de los patrones REALES de cada una ────
function Vigilar({ filas, proys, hoy }) {
  const items = []
  for (const f of filas) {
    const e = f.e
    if (e.sinDatos) continue
    if (e.frecuencia === 'Mensual') {
      items.push({ icono: '📅', txt: <><b>{nombreCorto(e.nombre)}</b> paga todos los meses{e.yield ? ` (yield ${e.yield})` : ''} — marca el ritmo de tu flujo.</> })
      continue
    }
    const proxima = proys.find((p) => p.t === f.t)
    const ultimo = e.historial.length ? new Date(e.historial[0].fecha) : null
    const ultimoAnio = ultimo?.getFullYear() || null
    if (f.div12 === 0 && ultimoAnio && ultimoAnio < hoy.getFullYear() - 1) {
      items.push({ icono: '🔴', txt: <><b>{nombreCorto(e.nombre)}</b> — sin dividendos desde {ultimoAnio}; vigila sus resultados, no su calendario.</> })
    } else if (proxima) {
      const dias = Math.round((proxima.fecha - hoy) / 86400000)
      const acuerdo = acuerdoDividendo(f.t)
      items.push({
        icono: acuerdo ? '📋' : '💰',
        txt: <><b>{nombreCorto(e.nombre)}</b> — su patrón dice {MESES[proxima.fecha.getMonth()]} para el próximo
          pago (en ~{dias} días). {acuerdo ? `Acuerdo publicado el ${fechaCorta(acuerdo.fecha)}.` : 'Aún sin comunicado.'}</>,
      })
    } else if (ultimo && f.div12 > 0) {
      items.push({ icono: '✅', txt: <><b>{nombreCorto(e.nombre)}</b> ya pagó su dividendo el {ultimo.getDate()} de {MESES[ultimo.getMonth()]} — el próximo recién el año que viene.</> })
    }
  }
  return (
    <div className="card cd-tarjeta cd-vigilar">
      {items.slice(0, 6).map((it, i) => (
        <div key={i} className="cd-item"><span className="cd-icono">{it.icono}</span><span>{it.txt}</span></div>
      ))}
      {!items.length && <div className="cd-item"><span className="cd-icono">🌙</span><span>Nada urgente en tus empresas.</span></div>}
    </div>
  )
}

// ── Recordatorios ─────────────────────────────────────────────────────────
function Recordatorios({ recs, ponRecs }) {
  const [txt, setTxt] = useState('')
  const anotar = () => {
    if (!txt.trim()) return
    ponRecs([...recs, { txt: txt.trim(), ok: false }])
    setTxt('')
  }
  return (
    <div className="card cd-tarjeta cd-recs">
      {recs.map((r, i) => (
        <div key={i} className={'cd-rec-item' + (r.ok ? ' hecho' : '')}>
          <button className="cd-rec-check" aria-label="Marcar"
            onClick={() => ponRecs(recs.map((x, j) => (j === i ? { ...x, ok: !x.ok } : x)))}>✓</button>
          <span className="cd-rec-texto">{r.txt}</span>
          <button className="cd-rec-borrar" aria-label="Borrar"
            onClick={() => ponRecs(recs.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      {!recs.length && <div className="muted cd-sub">Tu agenda está limpia. Qué paz.</div>}
      <div className="cd-rec-nueva">
        <input type="text" value={txt} maxLength="90" placeholder="Ej.: revisar resultados de Minsur"
          onChange={(ev) => setTxt(ev.target.value)}
          onKeyDown={(ev) => { if (ev.key === 'Enter') anotar() }} />
        <button className="btn cd-btn-mini" onClick={anotar}>Anotar</button>
      </div>
    </div>
  )
}

// ── Mi historia: dividendos por año (historial real BVL) ─────────────────
function Diario({ filas, hoy }) {
  const porAnio = {}
  let recibido = 0, pagos = 0, mayor = { t: '', soles: 0, fecha: hoy }
  for (const f of filas) {
    for (const h of f.e.historial) {
      const fe = new Date(h.fecha)
      if (fe.getFullYear() >= 2025 && fe <= hoy) {
        const monto = enSoles(h.monto, h.moneda) * f.cant
        const a = fe.getFullYear()
        porAnio[a] = porAnio[a] || { total: 0, pagos: 0, mayor: { t: '', soles: 0 } }
        porAnio[a].total += monto
        porAnio[a].pagos++
        if (monto > porAnio[a].mayor.soles) porAnio[a].mayor = { t: f.t, soles: monto }
        recibido += monto; pagos++
        if (monto > mayor.soles) mayor = { t: f.t, soles: monto, fecha: fe }
      }
    }
  }
  const masRentable = [...filas].sort((a, b) => b.gan - a.gan)[0]
  return (
    <>
      <div className="card cd-tarjeta cd-diario">
        {Object.keys(porAnio).sort().map((a) => (
          <div key={a} className="cd-diario-anio">
            <div className="cd-diario-num">{a}</div>
            <div className="cd-diario-que">
              <div>Habrías recibido <b className="verde">{fmtS(porAnio[a].total)}</b> en dividendos ({porAnio[a].pagos} pago{porAnio[a].pagos === 1 ? '' : 's'}, con tus cantidades de hoy).</div>
              <div>El más generoso: <b>{porAnio[a].mayor.t}</b> con {fmtS(porAnio[a].mayor.soles)}.</div>
            </div>
          </div>
        ))}
        {!Object.keys(porAnio).length && (
          <div className="muted">Tus empresas no registran pagos desde 2025 — tu historia comienza con el próximo.</div>
        )}
      </div>
      {filas.length > 0 && (
        <div className="cd-stats">
          <div className="card cd-tarjeta cd-stat">
            <div className="k">Dividendos 2025–2026</div>
            <div className="v oro">{fmtS(recibido)}</div>
            <div className="sub muted">{pagos} pagos, según el historial real BVL</div>
          </div>
          <div className="card cd-tarjeta cd-stat">
            <div className="k">Mayor pago</div>
            <div className="v chico oro">{mayor.t ? `${mayor.t} · ${fmtS(mayor.soles)}` : '—'}</div>
            <div className="sub muted">{mayor.t ? `${mayor.fecha.getDate()} de ${MESES[mayor.fecha.getMonth()]} de ${mayor.fecha.getFullYear()}` : ''}</div>
          </div>
          <div className="card cd-tarjeta cd-stat">
            <div className="k">Más rentable</div>
            <div className="v chico oro">{masRentable.t}</div>
            <div className="sub muted">{masRentable.gan >= 0 ? '+' : ''}{masRentable.gan.toFixed(1)}% desde tu compra</div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Resumen por SAB ───────────────────────────────────────────────────────
function PorSAB({ filas, totalValor }) {
  const porSAB = {}
  for (const f of filas) {
    porSAB[f.sab] = porSAB[f.sab] || { n: 0, valor: 0, costo: 0 }
    porSAB[f.sab].n++
    porSAB[f.sab].valor += f.valor
    porSAB[f.sab].costo += f.costoT
  }
  const maxSAB = Math.max(...Object.values(porSAB).map((s) => s.valor), 1)
  return (
    <div className="card cd-tarjeta cd-sabs">
      {Object.entries(porSAB).sort((a, b) => b[1].valor - a[1].valor).map(([sab, s]) => {
        const g = s.costo > 0 ? ((s.valor - s.costo) / s.costo) * 100 : 0
        return (
          <div key={sab} className="cd-sab-fila">
            <span className="izq">
              <b>{sab}</b> <span className="muted">· {s.n} empresa{s.n === 1 ? '' : 's'}</span>
              <div className="cd-barra-sab"><i style={{ width: ((s.valor / maxSAB) * 100).toFixed(0) + '%' }} /></div>
            </span>
            <span className="der">
              {fmtS(s.valor)}
              <div className={'sub ' + (g >= 0 ? 'pos' : 'neg')}>{g >= 0 ? '+' : ''}{g.toFixed(1)}%</div>
            </span>
          </div>
        )
      })}
      <div className="cd-sab-fila total"><span>Toda tu cartera</span><span>{fmtS(totalValor)}</span></div>
    </div>
  )
}

// ── Salud de la cartera ───────────────────────────────────────────────────
function Salud({ filas, cartera, totalValor }) {
  const maxPeso = Math.max(...filas.map((f) => f.valor / (totalValor || 1)), 0)
  const pesoDiv = filas.filter((f) => f.div12 > 0).reduce((a, f) => a + f.valor, 0) / (totalValor || 1)
  const pesoMineras = filas.filter((f) => f.e.sector === 'minas').reduce((a, f) => a + f.valor, 0) / (totalValor || 1)
  const pesoLiquido = filas.filter((f) => !f.e.sinNegoc && !f.e.sinDatos && !f.e.sinPrecio).reduce((a, f) => a + f.valor, 0) / (totalValor || 1)
  const dims = [
    { n: 'Diversificación', v: Math.max(0, Math.min(100, (1 - maxPeso) * 100 + (cartera.length >= 8 ? 10 : 0))), palabras: ['muy concentrada', 'se puede repartir más', 'bien repartida'] },
    { n: 'Dividendos', v: pesoDiv * 100, palabras: ['casi no llueven', 'buen goteo', 'lluvia constante'] },
    { n: 'Minería', v: pesoMineras * 100, palabras: ['poco minera', 'con buena veta', 'corazón minero'] },
    { n: 'Liquidez', v: pesoLiquido * 100, palabras: ['difícil de vender', 'se mueve regular', 'fácil de mover'] },
  ]
  return (
    <div className="card cd-tarjeta cd-salud">
      {dims.map((s) => (
        <div key={s.n} className="cd-dim">
          <span className="nombre">{s.n}</span>
          <span className="cd-barra"><i style={{ width: s.v.toFixed(0) + '%' }} /></span>
          <span className="palabra">{s.palabras[s.v < 40 ? 0 : s.v < 70 ? 1 : 2]}</span>
        </div>
      ))}
      <div className="muted cd-sub">Describe tu cartera, no la califica: una cartera concentrada a propósito también es una decisión.</div>
    </div>
  )
}

// ── Mi torta ──────────────────────────────────────────────────────────────
function Torta({ filas, totalValor }) {
  const orden = [...filas].sort((a, b) => b.valor - a.valor)
  let off = 25
  const arcos = orden.map((f, i) => {
    const pct = totalValor > 0 ? (f.valor / totalValor) * 100 : 0
    const color = i === 0 ? 'var(--oro)' : COLORES[i % COLORES.length]
    const arco = { pct, color, off, t: f.t, nombre: nombreCorto(f.e.nombre) }
    off -= pct
    return arco
  })
  return (
    <div className="card cd-tarjeta cd-torta-wrap">
      <svg className="cd-torta" viewBox="0 0 42 42" role="img" aria-label="Distribución de la cartera">
        <circle cx="21" cy="21" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
        {arcos.map((a, i) => (
          <circle key={i} cx="21" cy="21" r="15.9" fill="none" stroke={a.color} strokeWidth="7"
            strokeDasharray={`${a.pct.toFixed(2)} ${(100 - a.pct).toFixed(2)}`}
            strokeDashoffset={a.off.toFixed(2)} />
        ))}
        <text x="21" y="20" textAnchor="middle" className="cd-torta-n">{filas.length}</text>
        <text x="21" y="26" textAnchor="middle" className="cd-torta-t">EMPRESAS</text>
      </svg>
      <div className="cd-leyenda">
        {arcos.map((a, i) => (
          <div key={i} className="cd-leyenda-fila">
            <span className="punto" style={{ background: a.color }} />
            {a.nombre} <small className="muted">{a.t}</small>
            <span className="pct">{a.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
