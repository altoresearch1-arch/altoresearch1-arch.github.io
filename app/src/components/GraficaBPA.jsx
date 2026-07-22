import { useState } from 'react'
import bpaData from '../data/bpa_historico.json'
import Glosado from './Glosado'

// 📈 BPA histórico (nivel 3) — pedidos de Jair 21-jul-2026.
// TRES modos de comparación:
//   · "Año vs año": la serie anual auditada (¿gana más por acción que antes?)
//   · "Mismo trimestre": solo los Q1 (o Q2/Q3/Q4) a través de los años —
//     esquiva la estacionalidad, compara manzanas con manzanas.
//   · "Un solo año": Q1→Q4 de un año — ¿el año se hizo parejo o en un golpe?
// Datos de bpa_historico.json (EE.FF. INDIVIDUALES SMV, moneda original —
// Regla #3). El Q4 sale del estado INTERMEDIO oct-dic que la SMV recibe en
// enero (hallazgo de Jair) — nada se deriva. Periodo sin dato = hueco "s/d"
// (Regla #1). Bancos: solo modo anual (su detalle HTML no separa trimestres).
// Los tickers que fix_eps corrige NO están en el JSON: graficarlos engañaría.

const SIMBOLO = { USD: 'US$', PEN: 'S/' }

// 0.202 -> "0.20" · 3.08 -> "3.08" · 12.5 -> "12.5" · 0.004 -> "0.004"
// (etiquetas cortas; los EPS chiquitos —Nexa gana centavos por acción— no
// pueden salir como "0.00": sería mentir un cero)
function fmt(v) {
  const abs = Math.abs(v)
  const dec = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 0.1 || abs === 0 ? 2 : 3
  return v.toFixed(dec)
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
              <div className="bpagraf-barra sindato" style={{ height: 10 }} />
              <div className="bpagraf-anio">{it.etiqueta}</div>
            </div>
          )
        }
        const v = it.valor
        const h = Math.max(6, (Math.abs(v) / max) * 64)
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

export default function GraficaBPA({ ticker }) {
  const emp = bpaData.empresas?.[ticker]
  const serie = emp?.serie || {}
  const trims = emp?.trimestres || {}
  const aniosSerie = Object.keys(serie).sort()
  const clavesQ = Object.keys(trims).sort() // "2023-Q2"
  const aniosQ = [...new Set(clavesQ.map((k) => k.slice(0, 4)))].sort()
  const hayTrimestres = clavesQ.length > 0

  // Q del dato más reciente (hoy Q1-2026): el default más útil para comparar
  const qReciente = hayTrimestres ? clavesQ[clavesQ.length - 1].slice(5) : 'Q1'
  // default de "Un solo año": el último año COMPLETO (con Q4); el año en curso
  // se puede tocar igual, pero no recibe al usuario con puros "s/d"
  const aniosCompletos = aniosQ.filter((a) => trims[`${a}-Q4`] != null)
  const [modo, setModo] = useState('anual')
  const [q, setQ] = useState(qReciente)
  const [anioSel, setAnioSel] = useState(
    aniosCompletos[aniosCompletos.length - 1] || aniosQ[aniosQ.length - 1]
  )

  if (aniosSerie.length < 2 && !hayTrimestres) return null

  const sim = SIMBOLO[emp.moneda] || emp.moneda || ''

  // ── items según el modo ──
  let items = []
  if (modo === 'anual') {
    const desde = parseInt(aniosSerie[0], 10)
    const hasta = parseInt(aniosSerie[aniosSerie.length - 1], 10)
    for (let a = desde; a <= hasta; a++) {
      items.push({ etiqueta: String(a), valor: serie[String(a)] ?? null })
    }
  } else if (modo === 'trimestre') {
    for (const a of aniosQ) {
      items.push({ etiqueta: a, valor: trims[`${a}-${q}`] ?? null })
    }
    // si el año más viejo/nuevo no tiene ESTE Q, no ensuciar con s/d en los bordes
    while (items.length && items[0].valor == null) items.shift()
    while (items.length && items[items.length - 1].valor == null) items.pop()
  } else {
    for (const nq of ['Q1', 'Q2', 'Q3', 'Q4']) {
      items.push({ etiqueta: nq, valor: trims[`${anioSel}-${nq}`] ?? null })
    }
  }
  const hayBarras = items.some((i) => i.valor != null)

  // Lectura de tendencia (solo modos con línea de tiempo)
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
      </p>
    </div>
  )
}
