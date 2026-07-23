import { useState } from 'react'
import bpaData from '../data/bpa_historico.json'
import ctxData from '../data/bpa_contexto.json'
import dividendosData from '../data/dividendos.json'
import familiaData from '../data/mineria_familia.json'
import mineriaData from '../data/mineria.json'
import Glosado from './Glosado'
import ResumenInteligente from './ResumenInteligente'

// 📈 BPA histórico (nivel 3) — pedidos de Jair 21-jul-2026.
// CUATRO modos de análisis: Año vs año / Mismo trimestre (esquiva la
// estacionalidad) / Un solo año (Q1→Q4) / 🧠 Resumen Inteligente (nombre de
// Jair: BPA + precio + dividendo + caja + deuda hoy-y-futuro, explicado).
// Y FILAS DE CONTEXTO activables («Relacionar con este BPA»), alineadas
// columna por columna con las barras:
//   💵 precio de la acción = último cierre del periodo (BVL, bpa_contexto.json)
//   💰 dividendo = lo pagado por acción EN ese periodo (dividendos.json)
//   ⛏ metal = promedio del periodo (BCRP/LME, solo mineras; metal elegible)
// Cada barra trae su ▲/▼ vs el periodo comparable anterior; el mejor periodo
// lleva ⭐ y el peor 🔻 solo si fue pérdida (pedido de Jair). Tarjetas resumen
// arriba y la explicación como tarjeta 💡 Interpretación. Animación de 280 ms
// al cambiar filtros (re-key del wrapper .bpa-anim).
// Datos BPA de bpa_historico.json (EE.FF. INDIVIDUALES SMV, moneda original —
// Regla #3). El Q4 sale del intermedio oct-dic (hallazgo de Jair). Periodo sin
// dato = "s/d" (Regla #1). Bancos: solo modo anual. Los tickers que fix_eps
// corrige no están en el JSON: graficarlos engañaría.

const SIMBOLO = { USD: 'US$', PEN: 'S/' }
const MES_EN = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
                 Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 }
const NOMBRE_METAL = { cobre: 'Cobre', oro: 'Oro', plata: 'Plata', zinc: 'Zinc',
                       plomo: 'Plomo', estano: 'Estaño', niquel: 'Níquel' }
const EMOJI_METAL = { oro: '🥇', plata: '🥈', cobre: '🔵', zinc: '⚫',
                      plomo: '🔘', estano: '🟤', niquel: '⚪' }
const HOY = new Date()
const ANIO_HOY = String(HOY.getFullYear())
const Q_HOY = `${ANIO_HOY}-Q${Math.floor(HOY.getMonth() / 3) + 1}`

// 0.202 -> "0.20" · 3.08 -> "3.08" · 12.5 -> "12.5" · 0.004 -> "0.004"
// (los EPS chiquitos —Nexa gana centavos por acción— no pueden salir "0.00")
function fmt(v) {
  const abs = Math.abs(v)
  const dec = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 0.1 || abs === 0 ? 2 : 3
  return v.toFixed(dec)
}

function fmtPct(p) {
  const abs = Math.abs(p)
  return (p > 0 ? '+' : p < 0 ? '−' : '') + abs.toFixed(abs >= 10 ? 0 : 1) + '%'
}

// "−US$ 0.53" / "US$ 3.08" — el signo VA ANTES del símbolo (como en las barras)
function dinero(v, sim) {
  return v < 0 ? `−${sim} ${fmt(-v)}` : `${sim} ${fmt(v)}`
}

// Dividendos pagados por periodo, desde dividendos.json:
// anual = porAnioNum (lo más completo); trimestral = historial (pagos con fecha)
function dividendosPorPeriodo(ticker) {
  const dv = dividendosData.empresas?.[ticker]
  if (!dv) return null
  const anual = { ...(dv.porAnioNum || {}) }
  const trimestral = {}
  for (const p of dv.historial || []) {
    const m = /^([A-Za-z]{3})\w* (\d{1,2}), (\d{4})$/.exec(p.fecha || '')
    if (!m || p.monto == null) continue
    const mes = MES_EN[m[1]]
    if (!mes) continue
    const q = `${m[3]}-Q${Math.floor((mes - 1) / 3) + 1}`
    trimestral[q] = (trimestral[q] || 0) + p.monto
  }
  if (!Object.keys(anual).length && !Object.keys(trimestral).length) return null
  return { sim: dv.anualSim || 'S/', anual, trimestral }
}

// Metales de una minera (vía mineria_familia + BEM), ordenados por su peso en
// el Perú (% del total nacional), filtrados a los que el BCRP cotiza.
function metalesDe(ticker) {
  const entidades = familiaData[ticker]?.entidades || []
  if (!entidades.length) return []
  const peso = {}
  for (const ent of entidades) {
    const prod = mineriaData.entidades?.[ent]?.produccion || {}
    for (const [metal, serie] of Object.entries(prod)) {
      if (!ctxData.metales?.[metal]) continue
      const pais = mineriaData.totalesPais?.[metal] || []
      let mio = 0, total = 0
      serie.forEach((v, i) => {
        if (v != null && pais[i] != null) { mio += v; total += pais[i] }
      })
      if (mio > 0 && total > 0) peso[metal] = (peso[metal] || 0) + mio / total
    }
  }
  return Object.keys(peso).sort((a, b) => peso[b] - peso[a])
}

// ▲/▼ de cada barra vs el periodo comparable ANTERIOR con dato (solo si la
// base es positiva: un % contra pérdida confunde más de lo que aclara)
function conDeltas(items) {
  let prev = null
  return items.map((it) => {
    const out = { ...it }
    if (it.valor != null) {
      if (prev != null && prev > 0) out.delta = ((it.valor - prev) / prev) * 100
      prev = it.valor
    }
    return out
  })
}

// Barras genéricas: items = [{ etiqueta, valor|null, delta? }] — hueco honesto
// si null; ⭐ al mejor periodo y 🔻 al peor SOLO si fue pérdida.
function Barras({ items, sim }) {
  const conValor = items.filter((i) => i.valor != null)
  const max = Math.max(...conValor.map((i) => Math.abs(i.valor))) || 1
  const marcar = conValor.length >= 3
  const mejor = marcar ? Math.max(...conValor.map((i) => i.valor)) : null
  const peor = marcar ? Math.min(...conValor.map((i) => i.valor)) : null
  return (
    <div className="bpagraf">
      {items.map((it, idx) => {
        if (it.valor == null) {
          return (
            <div key={it.etiqueta} className="bpagraf-col" style={{ '--i': idx }}>
              <div className="bpagraf-valor muted">s/d</div>
              <div className="bpagraf-barra sindato" style={{ height: 12 }} />
              <div className="bpagraf-anio">{it.etiqueta}</div>
            </div>
          )
        }
        const v = it.valor
        const h = Math.max(8, (Math.abs(v) / max) * 96)
        const esMejor = marcar && v === mejor && mejor !== peor
        const esPeor = marcar && v === peor && peor < 0
        return (
          <div key={it.etiqueta} className="bpagraf-col" style={{ '--i': idx }}>
            <div className={'bpagraf-valor' + (v < 0 ? ' perdida' : '')}>
              {v < 0 ? `−${sim} ${fmt(-v)}` : `${sim} ${fmt(v)}`}
            </div>
            {it.delta != null && (
              <div className={'bpa-delta chico ' + (it.delta > 0 ? 'sube' : it.delta < 0 ? 'baja' : '')}>
                {it.delta > 0 ? '▲' : it.delta < 0 ? '▼' : '='} {fmtPct(it.delta)}
              </div>
            )}
            <div className={'bpagraf-barra' + (v < 0 ? ' perdida' : '') + (esMejor ? ' mejor' : '')} style={{ height: h }} />
            <div className={'bpagraf-anio' + (esMejor ? ' mejor' : '')}>
              {it.etiqueta}{esMejor ? ' ⭐' : ''}{esPeor ? ' 🔻' : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Fila de contexto alineada con las columnas de la gráfica
function FilaContexto({ titulo, items, valores, formato }) {
  return (
    <div className="bpagraf-ctx">
      <div className="bpagraf-ctx-titulo">{titulo}</div>
      <div className="bpagraf-ctx-fila">
        {items.map((it) => {
          const v = valores[it.etiqueta]
          return (
            <div key={it.etiqueta} className="bpagraf-ctx-cel">
              {v == null ? <span className="muted">—</span> : formato(v)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function GraficaBPA({ ticker, empresa }) {
  const emp = bpaData.empresas?.[ticker]
  const serie = emp?.serie || {}
  const trims = emp?.trimestres || {}
  const aniosSerie = Object.keys(serie).sort()
  const clavesQ = Object.keys(trims).sort()
  const aniosQ = [...new Set(clavesQ.map((k) => k.slice(0, 4)))].sort()
  const hayTrimestres = clavesQ.length > 0

  // ¿tenemos serie histórica de BPA para graficar? Los 10 tickers de fix_eps
  // NO están en bpa_historico.json (su EPS del XBRL individual no representa a
  // la acción que cotiza: clases de acción como Volcan, holding o moneda). Para
  // ellos igual mostramos el 🧠 Resumen Inteligente (sale del BALANCE, no del
  // BPA problemático) — antes se apagaba TODA la sección (pregunta de Jair).
  const hayBpa = aniosSerie.length >= 2 || hayTrimestres
  const soloResumen = !hayBpa
  // motivo REAL por el que quedó fuera (lo escribe el extractor): EPS distorsionado
  // por clase/holding, o la SMV que deja el campo en 0.000. Sin él, texto genérico.
  const motivoExcluida = bpaData.excluidas?.[ticker] || null

  const qReciente = hayTrimestres ? clavesQ[clavesQ.length - 1].slice(5) : 'Q1'
  // default de "Un solo año": el último año COMPLETO (con Q4)
  const aniosCompletos = aniosQ.filter((a) => trims[`${a}-Q4`] != null)
  const [modo, setModo] = useState(hayBpa ? 'anual' : 'resumen')
  const [q, setQ] = useState(qReciente)
  const [anioSel, setAnioSel] = useState(
    aniosCompletos[aniosCompletos.length - 1] || aniosQ[aniosQ.length - 1]
  )
  // contexto activable
  const [verPrecio, setVerPrecio] = useState(false)
  const [verDiv, setVerDiv] = useState(false)
  const [verMetal, setVerMetal] = useState(false)
  const metales = metalesDe(ticker)
  const [metalSel, setMetalSel] = useState(metales[0] || null)

  // sin serie de BPA Y sin datos de empresa para el resumen → no hay nada que mostrar
  if (soloResumen && !empresa) return null

  const sim = SIMBOLO[emp?.moneda] || emp?.moneda || ''
  const precios = ctxData.precios?.[ticker]
  const divs = dividendosPorPeriodo(ticker)
  const esResumen = modo === 'resumen'

  // ── items según el modo ──
  let items = []
  if (modo === 'anual' || esResumen) {
    const desde = parseInt(aniosSerie[0], 10)
    const hasta = parseInt(aniosSerie[aniosSerie.length - 1], 10)
    for (let a = desde; a <= hasta; a++) {
      items.push({ etiqueta: String(a), valor: serie[String(a)] ?? null })
    }
  } else if (modo === 'trimestre') {
    for (const a of aniosQ) items.push({ etiqueta: a, valor: trims[`${a}-${q}`] ?? null })
    while (items.length && items[0].valor == null) items.shift()
    while (items.length && items[items.length - 1].valor == null) items.pop()
  } else {
    for (const nq of ['Q1', 'Q2', 'Q3', 'Q4']) {
      items.push({ etiqueta: nq, valor: trims[`${anioSel}-${nq}`] ?? null })
    }
  }
  items = conDeltas(items)
  const hayBarras = items.some((i) => i.valor != null)

  // clave de contexto por etiqueta según el modo (año / año del Q / Q del año)
  const clavePeriodo = (etiqueta) =>
    modo === 'anual' ? etiqueta : modo === 'trimestre' ? `${etiqueta}-${q}` : `${anioSel}-${etiqueta}`
  const esTrimestral = modo === 'trimestre' || modo === 'anio'
  const tomarCtx = (fuente) => {
    const mapa = {}
    for (const it of items) {
      mapa[it.etiqueta] = (esTrimestral ? fuente?.trimestral : fuente?.anual)?.[clavePeriodo(it.etiqueta)] ?? null
    }
    return mapa
  }
  // ¿alguna columna es el periodo EN CURSO? (para la nota al pie)
  const enCurso = items.some((it) => {
    const k = clavePeriodo(it.etiqueta)
    return k === ANIO_HOY || k === Q_HOY
  })

  const metal = metalSel && ctxData.metales?.[metalSel]
  const conValor = items.filter((i) => i.valor != null)
  const primero = conValor[0]
  const ultimo = conValor[conValor.length - 1]
  // tarjetas resumen sobre la gráfica (solo con historia suficiente)
  const mejorItem = conValor.length >= 3
    ? conValor.reduce((a, b) => (b.valor > a.valor ? b : a)) : null
  const peorItem = conValor.length >= 3
    ? conValor.reduce((a, b) => (b.valor < a.valor ? b : a)) : null
  const vsQue = modo === 'anual' ? 'vs año anterior'
    : modo === 'trimestre' ? `vs ${q} anterior` : 'vs trimestre anterior'
  // 📅 recuadro "Anual" (pedido de Jair): en «Un solo año», el anual AUDITADO del
  // año elegido — sirve para ver de un vistazo que los 4 trimestres lo componen.
  const anualDelAnio = modo === 'anio' ? (serie[anioSel] ?? null) : null
  const cuadraElAnio = anualDelAnio != null && conValor.length === 4 &&
    Math.abs(conValor.reduce((s, i) => s + i.valor, 0) - anualDelAnio) <=
      Math.max(0.003, Math.abs(anualDelAnio) * 0.05)

  const MODOS = hayBpa ? [
    { id: 'anual', icono: '📈', nombre: 'Año vs año' },
    ...(hayTrimestres
      ? [{ id: 'trimestre', icono: '🏆', nombre: 'Mismo trimestre' },
         { id: 'anio', icono: '📅', nombre: 'Un solo año' }]
      : []),
    ...(empresa ? [{ id: 'resumen', icono: '🧠', nombre: 'Resumen Inteligente' }] : []),
  ] : []

  return (
    <div>
      <div className="seccion-titulo">
        {soloResumen
          ? <>🧠 Resumen Inteligente</>
          : <>📈 <Glosado text="BPA" /> — ¿gana más por acción que antes?</>}
      </div>

      {/* Nota del BPA individual (holdings/clases de acción — antes se excluían;
          22-jul pedido de Jair: se muestran CON esta aclaración) */}
      {hayBpa && emp?.notaBpa && (
        <p className="bpa-nota-individual">
          ⚖ <Glosado text={emp.notaBpa} />
        </p>
      )}

      {/* Sin serie de BPA histórico: nota honesta (los 10 de fix_eps) + solo el resumen */}
      {soloResumen && (
        <p className="muted" style={{ fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
          {motivoExcluida
            ? <>Sin gráfica del <Glosado text="BPA" /> histórico: <Glosado text={motivoExcluida} /></>
            : <>El <Glosado text="BPA" /> histórico de esta acción no se grafica: su EPS del
               archivo XBRL individual no representa a la acción que cotiza (por clases de
               acción, estructura de holding o moneda), así que dibujar años de barras
               engañaría. El P/E y el resto del análisis sí usan su EPS corregido.</>}
        </p>
      )}

      {/* ── modos de análisis: botones importantes, no simples chips ── */}
      {MODOS.length > 0 && (
        <div className="bpa-modos">
          {MODOS.map((m) => (
            <button
              key={m.id}
              className={'bpa-modo' + (modo === m.id ? ' on' : '') + (m.id === 'resumen' ? ' ri' : '')}
              onClick={() => setModo(m.id)}
            >
              <span className="bpa-modo-icono">{m.icono}</span> {m.nombre}
            </button>
          ))}
        </div>
      )}
      {modo === 'trimestre' && (
        <div className="spark-rangos bpa-sub">
          {['Q1', 'Q2', 'Q3', 'Q4'].map((nq) => (
            <button key={nq} className={'spark-rango bpa-pill' + (q === nq ? ' on' : '')} onClick={() => setQ(nq)}>
              {nq}
            </button>
          ))}
        </div>
      )}
      {modo === 'anio' && (
        <div className="spark-rangos bpa-sub">
          {aniosQ.map((a) => (
            <button key={a} className={'spark-rango bpa-pill' + (anioSel === a ? ' on' : '')} onClick={() => setAnioSel(a)}>
              {a}
            </button>
          ))}
        </div>
      )}

      {/* re-key: al cambiar el filtro TODO entra con la animación de 280 ms */}
      <div key={`${modo}-${q}-${anioSel}`} className="bpa-anim">
        {esResumen ? (
          <ResumenInteligente ticker={ticker} empresa={empresa} metales={metales} />
        ) : (
          <>
            {/* ── tarjetas resumen: contexto inmediato antes del gráfico ── */}
            {hayBarras && ultimo && (conValor.length >= 3 || anualDelAnio != null) && (
              <div className="bpa-tarjetas">
                {/* 📅 ANUAL del año elegido (pedido de Jair): el auditado de la SMV,
                    y si los 4 trimestres están, se dice que son sus partes */}
                {anualDelAnio != null && (
                  <div className="bpa-tarjeta anual">
                    <div className="bpa-tarjeta-t">Anual {anioSel}</div>
                    <div className={'bpa-tarjeta-v' + (anualDelAnio < 0 ? ' perdida' : '')}>
                      {dinero(anualDelAnio, sim)}
                    </div>
                    <span className="bpa-delta">
                      {cuadraElAnio ? '= la suma de los 4 trimestres' : 'auditado (SMV)'}
                    </span>
                  </div>
                )}
                <div className="bpa-tarjeta">
                  <div className="bpa-tarjeta-t">BPA {ultimo.etiqueta}</div>
                  <div className={'bpa-tarjeta-v' + (ultimo.valor < 0 ? ' perdida' : '')}>
                    {ultimo.valor < 0 ? `−${sim} ${fmt(-ultimo.valor)}` : `${sim} ${fmt(ultimo.valor)}`}
                  </div>
                  {ultimo.delta != null && (
                    <span className={'bpa-delta ' + (ultimo.delta > 0 ? 'sube' : ultimo.delta < 0 ? 'baja' : '')}>
                      {ultimo.delta > 0 ? '▲' : ultimo.delta < 0 ? '▼' : '='} {fmtPct(ultimo.delta)}
                      <span className="bpa-delta-vs"> {vsQue}</span>
                    </span>
                  )}
                </div>
                {mejorItem && mejorItem.valor !== peorItem?.valor && (
                  <div className="bpa-tarjeta">
                    <div className="bpa-tarjeta-t">Mejor periodo</div>
                    <div className="bpa-tarjeta-v">{mejorItem.etiqueta} ⭐</div>
                    <span className="bpa-delta">{sim} {fmt(mejorItem.valor)}</span>
                  </div>
                )}
                {peorItem && peorItem.valor !== mejorItem?.valor && (
                  <div className="bpa-tarjeta">
                    <div className="bpa-tarjeta-t">Peor periodo</div>
                    <div className="bpa-tarjeta-v">{peorItem.etiqueta}{peorItem.valor < 0 ? ' 🔻' : ''}</div>
                    <span className={'bpa-delta' + (peorItem.valor < 0 ? ' baja' : '')}>
                      {peorItem.valor < 0 ? `−${sim} ${fmt(-peorItem.valor)}` : `${sim} ${fmt(peorItem.valor)}`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {hayBarras
              ? <Barras items={items} sim={sim} />
              : <p className="muted">La SMV no tiene ese periodo para esta empresa.</p>}

            {/* ── «Relacionar con este BPA»: contexto alineado por columna ── */}
            {hayBarras && (precios || divs || metales.length > 0) && (
              <div className="bpa-relacionar">
                <span className="bpa-relacionar-tit">Relacionar con este BPA</span>
                <div className="bpa-relacionar-chips">
                  {precios && (
                    <button className={'spark-rango' + (verPrecio ? ' on' : '')} onClick={() => setVerPrecio(!verPrecio)}>
                      💵 Precio acción
                    </button>
                  )}
                  {divs && (
                    <button className={'spark-rango' + (verDiv ? ' on' : '')} onClick={() => setVerDiv(!verDiv)}>
                      💰 Dividendo
                    </button>
                  )}
                  {metales.map((mt) => (
                    <button
                      key={mt}
                      className={'spark-rango' + (verMetal && metalSel === mt ? ' on' : '')}
                      onClick={() => {
                        if (verMetal && metalSel === mt) setVerMetal(false)
                        else { setMetalSel(mt); setVerMetal(true) }
                      }}
                    >
                      {EMOJI_METAL[mt] || '⛏'} {NOMBRE_METAL[mt] || mt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {hayBarras && verPrecio && precios && (
              <FilaContexto
                titulo={<>💵 La acción {esTrimestral ? 'al cerrar ese trimestre' : 'al cerrar ese año'} ({precios.sim})</>}
                items={items} valores={tomarCtx(precios)} formato={(v) => fmt(v)}
              />
            )}
            {hayBarras && verDiv && divs && (
              <FilaContexto
                titulo={<>💰 <Glosado text="Dividendo" /> pagado por acción en el periodo ({divs.sim})</>}
                items={items} valores={tomarCtx(divs)} formato={(v) => fmt(v)}
              />
            )}
            {hayBarras && verMetal && metal && (
              <FilaContexto
                titulo={<>⛏ {NOMBRE_METAL[metalSel]} — promedio del periodo ({metal.unidad})</>}
                items={items} valores={tomarCtx(metal)} formato={(v) => fmt(v)}
              />
            )}
            {hayBarras && (verPrecio || verDiv || verMetal) && enCurso && (
              <p className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                El periodo en curso muestra lo que VA de él (no está cerrado). «—» = sin dato o sin pago.
              </p>
            )}

            {/* ── 💡 la explicación, con diseño de tarjeta ── */}
            {hayBarras && (
              <div className="bpa-interpreta">
                <div className="bpa-interpreta-t">💡 Interpretación</div>
                <p>
                  {modo === 'anual' && primero && ultimo && primero !== ultimo && (
                    <>
                      {ultimo.valor > primero.valor
                        ? <>De {dinero(primero.valor, sim)} ({primero.etiqueta}) a {dinero(ultimo.valor, sim)} ({ultimo.etiqueta}): gana más por acción que antes. </>
                        : ultimo.valor < primero.valor
                          ? <>De {dinero(primero.valor, sim)} ({primero.etiqueta}) a {dinero(ultimo.valor, sim)} ({ultimo.etiqueta}): gana menos por acción que antes — pregúntate por qué antes de mirar el precio. </>
                          : <>Igual que en {primero.etiqueta}: ni más ni menos por acción. </>}
                      Este es el mismo <Glosado text="BPA" /> que alimenta el <Glosado text="P/E" /> de
                      «¿Barata o cara?»: si el BPA cae y el precio no, la acción se encarece sola.
                    </>
                  )}
                  {modo === 'trimestre' && (
                    <>
                      Comparar el mismo {q} entre años esquiva la <Glosado text="estacionalidad" />:
                      un {q} solo se compara justo con otro {q} (pesca, campaña navideña y cosechas
                      hacen que los trimestres de un mismo año no se parezcan entre sí).
                    </>
                  )}
                  {modo === 'anio' && (
                    <>
                      El {anioSel} desglosado: ¿la ganancia se hizo pareja o en un solo golpe?
                      {mejorItem && mejorItem.valor !== peorItem?.valor && (
                        <> El mejor trimestre fue el {mejorItem.etiqueta} ⭐{peorItem?.valor < 0 ? ` y el ${peorItem.etiqueta} cerró en pérdida 🔻` : ''}.</>
                      )}
                      {' '}El Q4 sale del estado intermedio oct-dic que la empresa presenta en enero.
                    </>
                  )}
                  {items.some((i) => i.valor != null && i.valor < 0) && <> Las barras rojas son periodos en pérdida.</>}
                </p>
              </div>
            )}
            {modo !== 'anual' && emp.notaTrimestres && (
              <p className="muted" style={{ fontSize: 11.5 }}>
                ⚖ <Glosado text={emp.notaTrimestres} />
              </p>
            )}
            {emp.notaCeros && (
              <p className="muted" style={{ fontSize: 11.5 }}>
                ⚖ <Glosado text={emp.notaCeros} />
              </p>
            )}
            <p className="muted" style={{ fontSize: 11.5 }}>
              <Glosado text={emp.fuente} /> · moneda original
              {verPrecio && <> · precio: BVL (cierres reales)</>}
              {verDiv && <> · dividendos: stockanalysis + BVL</>}
              {verMetal && <> · metales: BCRP (promedio mensual LME)</>}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
