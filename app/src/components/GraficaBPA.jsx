import { useState } from 'react'
import bpaData from '../data/bpa_historico.json'
import ctxData from '../data/bpa_contexto.json'
import dividendosData from '../data/dividendos.json'
import familiaData from '../data/mineria_familia.json'
import mineriaData from '../data/mineria.json'
import Glosado from './Glosado'

// 📈 BPA histórico (nivel 3) — pedidos de Jair 21-jul-2026.
// TRES modos: Año vs año / Mismo trimestre (esquiva la estacionalidad) /
// Un solo año (Q1→Q4). Y FILAS DE CONTEXTO activables, alineadas columna por
// columna con las barras (2ª tanda de pedidos):
//   💵 precio de la acción = último cierre del periodo (BVL, bpa_contexto.json)
//   💰 dividendo = lo pagado por acción EN ese periodo (dividendos.json)
//   ⛏ metal = promedio del periodo (BCRP/LME, solo mineras; metal elegible)
// Datos BPA de bpa_historico.json (EE.FF. INDIVIDUALES SMV, moneda original —
// Regla #3). El Q4 sale del intermedio oct-dic (hallazgo de Jair). Periodo sin
// dato = "s/d" (Regla #1). Bancos: solo modo anual. Los tickers que fix_eps
// corrige no están en el JSON: graficarlos engañaría.

const SIMBOLO = { USD: 'US$', PEN: 'S/' }
const MES_EN = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
                 Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 }
const NOMBRE_METAL = { cobre: 'Cobre', oro: 'Oro', plata: 'Plata', zinc: 'Zinc',
                       plomo: 'Plomo', estano: 'Estaño', niquel: 'Níquel' }
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

// Barras genéricas: items = [{ etiqueta, valor|null }] — hueco honesto si null
function Barras({ items, sim }) {
  const max = Math.max(...items.filter((i) => i.valor != null).map((i) => Math.abs(i.valor))) || 1
  return (
    <div className="bpagraf">
      {items.map((it) => {
        if (it.valor == null) {
          return (
            <div key={it.etiqueta} className="bpagraf-col">
              <div className="bpagraf-valor muted">s/d</div>
              <div className="bpagraf-barra sindato" style={{ height: 12 }} />
              <div className="bpagraf-anio">{it.etiqueta}</div>
            </div>
          )
        }
        const v = it.valor
        const h = Math.max(8, (Math.abs(v) / max) * 96)
        return (
          <div key={it.etiqueta} className="bpagraf-col">
            <div className={'bpagraf-valor' + (v < 0 ? ' perdida' : '')}>
              {v < 0 ? `−${sim} ${fmt(-v)}` : `${sim} ${fmt(v)}`}
            </div>
            <div className={'bpagraf-barra' + (v < 0 ? ' perdida' : '')} style={{ height: h }} />
            <div className="bpagraf-anio">{it.etiqueta}</div>
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

export default function GraficaBPA({ ticker }) {
  const emp = bpaData.empresas?.[ticker]
  const serie = emp?.serie || {}
  const trims = emp?.trimestres || {}
  const aniosSerie = Object.keys(serie).sort()
  const clavesQ = Object.keys(trims).sort()
  const aniosQ = [...new Set(clavesQ.map((k) => k.slice(0, 4)))].sort()
  const hayTrimestres = clavesQ.length > 0

  const qReciente = hayTrimestres ? clavesQ[clavesQ.length - 1].slice(5) : 'Q1'
  // default de "Un solo año": el último año COMPLETO (con Q4)
  const aniosCompletos = aniosQ.filter((a) => trims[`${a}-Q4`] != null)
  const [modo, setModo] = useState('anual')
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

  if (aniosSerie.length < 2 && !hayTrimestres) return null

  const sim = SIMBOLO[emp.moneda] || emp.moneda || ''
  const precios = ctxData.precios?.[ticker]
  const divs = dividendosPorPeriodo(ticker)

  // ── items según el modo ──
  let items = []
  if (modo === 'anual') {
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
  const hayBarras = items.some((i) => i.valor != null)

  // clave de contexto por etiqueta según el modo (año / año del Q / Q del año)
  const clavePeriodo = (etiqueta) =>
    modo === 'anual' ? etiqueta : modo === 'trimestre' ? `${etiqueta}-${q}` : `${anioSel}-${etiqueta}`
  const esTrimestral = modo !== 'anual'
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

  return (
    <div>
      <div className="seccion-titulo">
        📈 <Glosado text="BPA" /> — ¿gana más por acción que antes?
      </div>

      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <div className="spark-rangos">
          <button className={'spark-rango' + (modo === 'anual' ? ' on' : '')} onClick={() => setModo('anual')}>
            Año vs año
          </button>
          {hayTrimestres && (
            <>
              <button className={'spark-rango' + (modo === 'trimestre' ? ' on' : '')} onClick={() => setModo('trimestre')}>
                Mismo trimestre
              </button>
              <button className={'spark-rango' + (modo === 'anio' ? ' on' : '')} onClick={() => setModo('anio')}>
                Un solo año
              </button>
            </>
          )}
        </div>
        {modo === 'trimestre' && (
          <div className="spark-rangos">
            {['Q1', 'Q2', 'Q3', 'Q4'].map((nq) => (
              <button key={nq} className={'spark-rango' + (q === nq ? ' on' : '')} onClick={() => setQ(nq)}>
                {nq}
              </button>
            ))}
          </div>
        )}
        {modo === 'anio' && (
          <div className="spark-rangos">
            {aniosQ.map((a) => (
              <button key={a} className={'spark-rango' + (anioSel === a ? ' on' : '')} onClick={() => setAnioSel(a)}>
                {a}
              </button>
            ))}
          </div>
        )}
      </div>

      {hayBarras
        ? <Barras items={items} sim={sim} />
        : <p className="muted">La SMV no tiene ese periodo para esta empresa.</p>}

      {/* ── contexto activable: precio / dividendo / metal, alineado por columna ── */}
      {hayBarras && (precios || divs || metales.length > 0) && (
        <div className="bpagraf-extras">
          <span className="bpagraf-extras-tit">Ver también:</span>
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
          {metales.length > 0 && (
            <button className={'spark-rango' + (verMetal ? ' on' : '')} onClick={() => setVerMetal(!verMetal)}>
              ⛏ Metal
            </button>
          )}
          {verMetal && metales.length > 1 && metales.map((mt) => (
            <button key={mt} className={'spark-rango chico' + (metalSel === mt ? ' on' : '')} onClick={() => setMetalSel(mt)}>
              {NOMBRE_METAL[mt] || mt}
            </button>
          ))}
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

      <p className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>
        {modo === 'anual' && primero && ultimo && primero !== ultimo && (
          <>
            {ultimo.valor > primero.valor
              ? <>De {sim} {fmt(primero.valor)} ({primero.etiqueta}) a {sim} {fmt(ultimo.valor)} ({ultimo.etiqueta}): gana más por acción que antes. </>
              : ultimo.valor < primero.valor
                ? <>De {sim} {fmt(primero.valor)} ({primero.etiqueta}) a {sim} {fmt(ultimo.valor)} ({ultimo.etiqueta}): gana menos por acción que antes — pregúntate por qué antes de mirar el precio. </>
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
            El Q4 sale del estado intermedio oct-dic que la empresa presenta en enero.
          </>
        )}
        {items.some((i) => i.valor != null && i.valor < 0) && <> Las barras rojas son periodos en pérdida.</>}
      </p>
      {modo !== 'anual' && emp.notaTrimestres && (
        <p className="muted" style={{ fontSize: 11.5 }}>
          ⚖ <Glosado text={emp.notaTrimestres} />
        </p>
      )}
      <p className="muted" style={{ fontSize: 11.5 }}>
        <Glosado text={emp.fuente} /> · moneda original
        {verPrecio && <> · precio: BVL (cierres reales)</>}
        {verDiv && <> · dividendos: stockanalysis + BVL</>}
        {verMetal && <> · metales: BCRP (promedio mensual LME)</>}
      </p>
    </div>
  )
}
