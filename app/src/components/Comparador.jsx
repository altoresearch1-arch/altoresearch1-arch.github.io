import { useEffect, useMemo, useState } from 'react'
import empresasData from '../data/empresas.json'
import quiz from '../data/quiz.json'
import tesisData from '../data/tesis.json'
import mineriaData from '../data/mineria.json'
import familiaData from '../data/mineria_familia.json'
import Glosado from './Glosado'
import Disclaimer from './Disclaimer'
import { peInfo, precioDe, dividendosDe, historicoDe, yieldNumerico, pagaDividendos } from '../lib/finanzas'
import { Reveal } from '../lib/anim'

// Comparador "frente a frente": 2 empresas cara a cara, solo HECHOS de
// nuestras fuentes (SMV, BVL, stockanalysis, MINEM). Sin veredicto: cuál
// encaja contigo lo decides tú — la app educa, no recomienda.
// 🏁 La carrera: ambas acciones en UN gráfico, indexadas a 100 (la forma
// honesta de comparar trayectorias con precios y monedas distintas).

const COLOR_A = '#d4af37'
const COLOR_B = '#6fb3d9'

function fechaCorta(iso) {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']
function mesCortoIso(iso) {
  const [a, m] = iso.split('-')
  return `${MESES_CORTOS[parseInt(m, 10) - 1]} ${a.slice(2)}`
}

function compacto(v) {
  if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + ' M'
  if (v >= 1e3) return (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + ' k'
  if (v >= 10) return Math.round(v).toString()
  return v.toFixed(1)
}

const PENDIENTE = <span className="comp-pend">Pendiente (SMV)</span>

function datosDe(ticker) {
  const e = empresasData.empresas.find((x) => x.ticker === ticker)
  if (!e) return null
  const px = precioDe(ticker)
  const dv = dividendosDe(ticker)
  const h = historicoDe(ticker)
  const pe = peInfo(ticker)
  const f = e.fundamentos
  return {
    e,
    sector: quiz.sectores[e.sector] || e.sector,
    precio: px?.precio != null ? `${px.moneda} ${px.precio}` : null,
    precioFecha: px?.fecha ? fechaCorta(px.fecha) : null,
    desactualizado: !!px?.sinNegociacionReciente,
    pe,
    divAnual: dv?.anual || null,
    yieldNum: yieldNumerico(ticker),
    yield: dv?.yield || null,
    frecuencia: dv?.frecuencia || null,
    nPagos25: dv?.nPorAnio?.['2025'] ?? null,
    nPagos26: dv?.nPorAnio?.['2026'] ?? null,
    deuda: f?.deuda?.valor || null,
    fcf: f?.fcf?.valor || null,
    margen: f?.margen?.valor || null,
    epsQ: f?.eps?.valor || null,
    vol: h?.volatilidadEtiqueta || null,
    volPct: h?.volatilidadAnualPct ?? null,
    rango52: h?.min52 != null
      ? `${(h.moneda || '').trim() || px?.moneda || ''} ${h.min52} – ${h.max52}`.trim()
      : null,
    tesis: tesisData.tesis?.[ticker] || null,
    reparte: pagaDividendos(ticker),
  }
}

// Dos barras enfrentadas (magnitudes relativas, mismo máximo). Solo para
// números SIN unidad mezclada (P/E, %, …) — nunca soles vs dólares.
function Barras({ a, b, colorA = COLOR_A, colorB = COLOR_B }) {
  if (a == null && b == null) return null
  const max = Math.max(a || 0, b || 0) || 1
  return (
    <div className="comp-barras">
      <div className="comp-barra"><div style={{ width: `${((a || 0) / max) * 100}%`, background: colorA }} /></div>
      <div className="comp-barra"><div style={{ width: `${((b || 0) / max) * 100}%`, background: colorB }} /></div>
    </div>
  )
}

function Fila({ nombre, a, b, glosar = true, barras = null, nota = null }) {
  const render = (v) =>
    v == null || v === '' ? PENDIENTE : glosar ? <Glosado text={String(v)} /> : v
  return (
    <div className="comp-fila-wrap">
      <div className="comp-fila">
        <div className="comp-k"><Glosado text={nombre} /></div>
        <div className="comp-v">{render(a)}</div>
        <div className="comp-v">{render(b)}</div>
      </div>
      {barras}
      {nota && <div className="comp-fila-nota muted"><Glosado text={nota} /></div>}
    </div>
  )
}

// 🏁 La carrera: cierres reales de ambas, indexados a 100 en el arranque del
// rango. Así una acción de S/ 3 y una de US$ 40 corren en la misma pista:
// lo que se compara es el CAMBIO porcentual, no el precio.
const RANGOS = [
  { id: '3M', meses: 3 }, { id: '6M', meses: 6 }, { id: '1A', meses: 12 },
]

function Carrera({ tA, tB }) {
  const [rango, setRango] = useState('6M')
  const hA = historicoDe(tA)
  const hB = historicoDe(tB)

  const series = useMemo(() => {
    if (!hA?.valores?.length || !hB?.valores?.length) return null
    const meses = RANGOS.find((r) => r.id === rango)?.meses || 6
    const corte = new Date()
    corte.setMonth(corte.getMonth() - meses)
    const iso = corte.toISOString().slice(0, 10)
    const arma = (h) => {
      const vs = h.valores.filter((v) => v[0] >= iso)
      if (vs.length < 2) return null
      const base = vs[0][1]
      if (!base) return null
      return vs.map(([f, c]) => [f, (c / base) * 100])
    }
    const sA = arma(hA)
    const sB = arma(hB)
    return sA && sB ? { sA, sB } : null
  }, [hA, hB, rango])

  if (!series) return null
  const { sA, sB } = series

  const W = 620
  const H = 210
  const PADL = 44
  const PADR = 10
  const PADT = 14
  const PADB = 22

  const t0 = Math.min(Date.parse(sA[0][0]), Date.parse(sB[0][0]))
  const t1 = Math.max(Date.parse(sA[sA.length - 1][0]), Date.parse(sB[sB.length - 1][0]))
  const vals = [...sA, ...sB].map((p) => p[1])
  const yMin = Math.min(...vals, 100)
  const yMax = Math.max(...vals, 100)
  const amp = yMax - yMin || 1
  const px = (f) => PADL + ((Date.parse(f) - t0) / (t1 - t0 || 1)) * (W - PADL - PADR)
  const py = (v) => PADT + ((yMax - v) * (H - PADT - PADB)) / amp

  const linea = (s) => s.map(([f, v]) => `${px(f).toFixed(1)},${py(v).toFixed(1)}`).join(' ')
  const finA = sA[sA.length - 1][1] - 100
  const finB = sB[sB.length - 1][1] - 100
  const pct = (v) => `${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(1)}%`
  const desierto = hA.pocoNegociada || hB.pocoNegociada

  return (
    <div className="comp-carrera">
      <div className="comp-carrera-cab">
        <span className="comp-carrera-tit">🏁 La carrera ({RANGOS.find((r) => r.id === rango)?.meses} meses)</span>
        <div className="spark-rangos">
          {RANGOS.map((r) => (
            <button key={r.id} className={'spark-rango' + (rango === r.id ? ' on' : '')}
              onClick={() => setRango(r.id)}>{r.id}</button>
          ))}
        </div>
      </div>
      <p className="comp-carrera-que muted">
        <strong>¿Qué es esto?</strong> Pusimos a las dos acciones a correr desde la misma línea
        de salida: ambas arrancan en <strong>100</strong> (<Glosado text="indexado a 100" />) y la
        línea muestra cuánto <strong>% sube o baja</strong> cada una desde ahí. Así se comparan
        limpio aunque una cueste S/ 3 y la otra US$ 40.
      </p>
      <div className="comp-carrera-leyenda">
        <span className="prodmin-leyenda-item">
          <span className="prodmin-dot" style={{ background: COLOR_A }} />
          {tA} <strong className={finA >= 0 ? 'sube' : 'baja'}>{pct(finA)}</strong>
        </span>
        <span className="prodmin-leyenda-item">
          <span className="prodmin-dot" style={{ background: COLOR_B }} />
          {tB} <strong className={finB >= 0 ? 'sube' : 'baja'}>{pct(finB)}</strong>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="prodmin-svg" role="img"
        aria-label={`Carrera de ${tA} vs ${tB}: ${pct(finA)} vs ${pct(finB)}`}>
        {[0.25, 0.5, 0.75].map((f) => {
          const v = yMin + amp * f
          return (
            <g key={f}>
              <line x1={PADL} x2={W - PADR} y1={py(v)} y2={py(v)}
                stroke="rgba(212,175,55,0.12)" strokeWidth="1" strokeDasharray="2 4" />
              <text x={PADL - 6} y={py(v) + 3.5} textAnchor="end" className="prodmin-ytick">{Math.round(v)}</text>
            </g>
          )
        })}
        {/* línea de salida: 100 = donde arrancaron las dos */}
        <line x1={PADL} x2={W - PADR} y1={py(100)} y2={py(100)}
          stroke="rgba(244,241,233,0.35)" strokeWidth="1" strokeDasharray="6 4" />
        <text x={PADL - 6} y={py(100) + 3.5} textAnchor="end" className="prodmin-ytick" fill="#f4f1e9">100</text>
        <polyline points={linea(sB)} fill="none" stroke={COLOR_B} strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={linea(sA)} fill="none" stroke={COLOR_A} strokeWidth="2.2"
          strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={px(sA[sA.length - 1][0])} cy={py(sA[sA.length - 1][1])} r="3.5" fill={COLOR_A} />
        <circle cx={px(sB[sB.length - 1][0])} cy={py(sB[sB.length - 1][1])} r="3.5" fill={COLOR_B} />
        <text x={PADL} y={H - 6} textAnchor="start" className="prodmin-tick">{fechaCorta(new Date(t0).toISOString().slice(0, 10))}</text>
        <text x={W - PADR} y={H - 6} textAnchor="end" className="prodmin-tick">{fechaCorta(new Date(t1).toISOString().slice(0, 10))}</text>
      </svg>
      <p className="muted comp-carrera-nota">
        Cierres reales de la BVL. Rentabilidad pasada NO asegura rentabilidad futura — la
        carrera cuenta lo que YA pasó, no lo que viene.
        {desierto && ' ⚠ Al menos una negocia poco: su línea se aplana los días sin operaciones.'}
      </p>
    </div>
  )
}

// 💰 Duelo de dividendos: el yield es comparable entre monedas (es un %).
function DueloDividendos({ A, B, tA, tB }) {
  const alguna = A.yieldNum != null || B.yieldNum != null
  return (
    <Reveal>
      <div className="seccion-titulo">💰 Duelo de dividendos</div>
      {alguna ? (
        <>
          <div className="comp-duelo">
            {[[A, tA, COLOR_A], [B, tB, COLOR_B]].map(([d, t, color]) => (
              <div key={t} className="comp-duelo-lado" style={{ borderTopColor: color }}>
                <div className="comp-duelo-t">{t}</div>
                {d.yieldNum != null ? (
                  <>
                    <div className="comp-duelo-big" style={{ color }}>{d.yield}</div>
                    <div className="muted comp-duelo-sub">
                      <Glosado text="yield" /> al año{d.frecuencia && d.frecuencia !== 'n' ? ` · paga ${String(d.frecuencia).toLowerCase().startsWith('sem') ? 'semestral' : String(d.frecuencia).toLowerCase().startsWith('q') || String(d.frecuencia).toLowerCase().startsWith('trim') ? 'trimestral' : String(d.frecuencia).toLowerCase().startsWith('mens') || String(d.frecuencia).toLowerCase().startsWith('month') ? 'mensual' : 'anual'}` : ''}
                    </div>
                    <div className="muted comp-duelo-sub">
                      {d.divAnual ? `${d.divAnual} por acción al año` : ''}
                      {d.nPagos25 != null ? ` · ${d.nPagos25} pago${d.nPagos25 === 1 ? '' : 's'} en 2025` : ''}
                      {d.nPagos26 != null ? ` · ${d.nPagos26} en 2026` : ''}
                    </div>
                    {d.yieldNum > 20 && (
                      <div className="comp-duelo-aviso">⚠ Yield &gt;20%: casi siempre viene de un pago
                        EXTRAORDINARIO o de un precio desactualizado — no asumas que se repite.</div>
                    )}
                  </>
                ) : (
                  <div className="comp-duelo-nada">No reparte dividendos hoy</div>
                )}
              </div>
            ))}
          </div>
          <Barras a={A.yieldNum > 20 ? null : A.yieldNum} b={B.yieldNum > 20 ? null : B.yieldNum} />
        </>
      ) : (
        <p className="muted">Ninguna de las dos reparte dividendos hoy — su historia se juega
          por precio y crecimiento, no por renta.</p>
      )}
    </Reveal>
  )
}

// ⛏️ Duelo minero: si las DOS tienen producción en el BEM, sus familias
// compiten metal por metal en el mismo gráfico (suma de sus entidades).
function serieFamilia(ticker, metal) {
  const fam = familiaData[ticker]
  if (!fam?.entidades?.length) return null
  const meses = mineriaData.meses
  const serie = meses.map((_, i) => {
    let s = null
    fam.entidades.forEach((clave) => {
      const v = mineriaData.entidades[clave]?.produccion?.[metal]?.[i]
      if (v != null) s = (s || 0) + v
    })
    return s
  })
  return serie.some((v) => v != null) ? serie : null
}

function DueloMinero({ tA, tB }) {
  const famA = familiaData[tA]
  const famB = familiaData[tB]
  if (!famA?.entidades?.length || !famB?.entidades?.length) return null

  const ORDEN = ['cobre', 'oro', 'zinc', 'plata', 'estano', 'hierro', 'plomo', 'molibdeno']
  const NOMBRES = { cobre: 'Cobre', oro: 'Oro', zinc: 'Zinc', plata: 'Plata', estano: 'Estaño', hierro: 'Hierro', plomo: 'Plomo', molibdeno: 'Molibdeno' }
  const meses = mineriaData.meses

  const compartidos = ORDEN.filter((m) => {
    const a = serieFamilia(tA, m)
    const b = serieFamilia(tB, m)
    const n = (s) => (s ? s.filter((v) => v != null).length : 0)
    return n(a) >= 3 && n(b) >= 3
  })
  if (!compartidos.length) return null

  return (
    <Reveal>
      <div className="seccion-titulo">⛏️ Duelo minero (producción MINEM)</div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
        Metal por metal, la producción mensual de las minas de cada una (suma de las
        entidades de su familia que salen en el top del BEM — NO incluye participaciones
        minoritarias como Cerro Verde para BVN).
      </p>
      {compartidos.map((metal) => {
        const sA = serieFamilia(tA, metal)
        const sB = serieFamilia(tB, metal)
        const unidad = mineriaData.unidades?.[metal] || 'TMF'
        const totalPais = mineriaData.totalesPais?.[metal]
        const W = 620; const H = 160; const PADL = 44; const PADR = 10; const PADT = 12; const PADB = 22
        const todos = [...sA, ...sB].filter((v) => v != null)
        const max = Math.max(...todos) * 1.08 || 1
        const px = (i) => PADL + (i * (W - PADL - PADR)) / (meses.length - 1)
        const py = (v) => PADT + ((max - v) * (H - PADT - PADB)) / max
        const segs = (s) => {
          const out = []; let seg = []
          s.forEach((v, i) => { if (v != null) seg.push([i, v]); else if (seg.length) { out.push(seg); seg = [] } })
          if (seg.length) out.push(seg)
          return out
        }
        // % del Perú en el último mes con dato de cada una
        const share = (s) => {
          for (let i = s.length - 1; i >= 0; i--) {
            if (s[i] != null && totalPais?.[i]) return { mes: meses[i], pct: (s[i] / totalPais[i]) * 100 }
          }
          return null
        }
        const shA = share(sA); const shB = share(sB)
        const ticks = meses.map((m, i) => ({ m, i })).filter(({ i }) => i % 3 === 0 || i === meses.length - 1)
        return (
          <div key={metal} className="prodmin-chart">
            <div className="prodmin-chart-cab">
              <span className="prodmin-metal">{NOMBRES[metal]}</span>
              <span className="muted prodmin-unidad"><Glosado text={`producción mensual en ${unidad}`} /></span>
            </div>
            <div className="comp-carrera-leyenda">
              <span className="prodmin-leyenda-item">
                <span className="prodmin-dot" style={{ background: COLOR_A }} />
                {tA}{shA && <strong className="oro"> {shA.pct >= 10 ? shA.pct.toFixed(0) : shA.pct.toFixed(1)}% del Perú</strong>}
              </span>
              <span className="prodmin-leyenda-item">
                <span className="prodmin-dot" style={{ background: COLOR_B }} />
                {tB}{shB && <strong className="oro"> {shB.pct >= 10 ? shB.pct.toFixed(0) : shB.pct.toFixed(1)}% del Perú</strong>}
              </span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="prodmin-svg" role="img"
              aria-label={`${NOMBRES[metal]}: ${tA} vs ${tB}`}>
              {[0.5, 1].map((f) => (
                <g key={f}>
                  <line x1={PADL} x2={W - PADR} y1={py(max * f)} y2={py(max * f)}
                    stroke="rgba(212,175,55,0.14)" strokeWidth="1" strokeDasharray="2 4" />
                  <text x={PADL - 6} y={py(max * f) + 3.5} textAnchor="end" className="prodmin-ytick">{compacto(max * f)}</text>
                </g>
              ))}
              <line x1={PADL} x2={W - PADR} y1={py(0)} y2={py(0)} stroke="rgba(212,175,55,0.3)" strokeWidth="1" />
              {ticks.map(({ m, i }) => (
                <text key={m} x={px(i)} y={H - 6}
                  textAnchor={i === 0 ? 'start' : i === meses.length - 1 ? 'end' : 'middle'}
                  className="prodmin-tick">{mesCortoIso(m)}</text>
              ))}
              {[[sB, COLOR_B], [sA, COLOR_A]].map(([s, color], k) =>
                segs(s).map((seg, j) => (
                  <g key={`${k}-${j}`}>
                    {seg.length > 1 && (
                      <polyline points={seg.map(([i, v]) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')}
                        fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                    )}
                    {seg.map(([i, v]) => (
                      <circle key={i} cx={px(i)} cy={py(v)} r="2.6" fill={color}>
                        <title>{`${mesCortoIso(meses[i])}: ${v >= 1000 ? Math.round(v).toLocaleString('es-PE') : v} ${unidad}`}</title>
                      </circle>
                    ))}
                  </g>
                ))
              )}
            </svg>
            <div className="prodmin-hueco muted">
              Meses sin punto = esa familia no apareció en el top del BEM ese mes.
            </div>
          </div>
        )
      })}
    </Reveal>
  )
}

export default function Comparador({ tickers, onVolver, onVerEmpresa }) {
  const lista = empresasData.empresas.map((x) => x.ticker)
  const [tA, setTA] = useState(tickers?.[0] || lista[0])
  const [tB, setTB] = useState(tickers?.[1] || lista[1])
  const [copiado, setCopiado] = useState(false)
  // Si llega otra pareja por la URL (link compartido, botón atrás), reflejarla
  useEffect(() => {
    if (tickers?.[0] && tickers?.[1]) {
      setTA(tickers[0])
      setTB(tickers[1])
    }
  }, [tickers])
  const A = datosDe(tA)
  const B = datosDe(tB)
  if (!A || !B) return null

  // El link refleja el duelo actual (sin recargar la vista)
  const cambiar = (setter, otro) => (t) => {
    setter(t)
    const par = setter === setTA ? [t, otro] : [otro, t]
    history.replaceState(null, '', `#/comparar/${par[0]}/${par[1]}`)
  }
  const setA = cambiar(setTA, tB)
  const setB = cambiar(setTB, tA)

  const compartir = async () => {
    const url = `${location.origin}${location.pathname}#/comparar/${tA}/${tB}`
    const texto = `${tA} vs ${tB} — frente a frente en ALTO Research (BVL)`
    if (navigator.share) {
      try { await navigator.share({ title: 'ALTO Research', text: texto, url }); return } catch { /* canceló */ }
    } else {
      try {
        await navigator.clipboard.writeText(url)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 1800)
      } catch { /* sin permiso */ }
    }
  }

  const Selector = ({ valor, setValor, otro }) => (
    <select className="comp-select" value={valor} onChange={(ev) => setValor(ev.target.value)}>
      {lista.filter((t) => t !== otro).map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  )

  const mismoSector = A.e.sector === B.e.sector

  return (
    <div>
      <div className="ficha-nav">
        <button className="btn btn-fantasma" onClick={onVolver}>← Volver al explorador</button>
        <button className="btn-fav" onClick={compartir} title="Compartir este duelo">
          {copiado ? '✓ Link copiado' : '↗ Compartir duelo'}
        </button>
      </div>

      <div className="card">
        <h1 style={{ marginBottom: 4 }}>⚖ Frente a frente</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Mismos datos, lado a lado. Cuál encaja contigo lo decides tú — depende
          de tu perfil, no de un ranking.
        </p>

        <div className="comp-cabecera">
          <div className="comp-k" />
          <div className="comp-empresa comp-lado-a">
            <Selector valor={tA} setValor={setA} otro={tB} />
            <div className="muted comp-nombre">{A.e.nombre}</div>
            <button className="btn-mini" onClick={() => onVerEmpresa(tA)}>ver ficha ›</button>
          </div>
          <div className="comp-empresa comp-lado-b">
            <Selector valor={tB} setValor={setB} otro={tA} />
            <div className="muted comp-nombre">{B.e.nombre}</div>
            <button className="btn-mini" onClick={() => onVerEmpresa(tB)}>ver ficha ›</button>
          </div>
        </div>

        {!mismoSector && (
          <p className="comp-sector-aviso">
            ⚠ Son de sectores distintos ({A.sector} vs {B.sector}): sus números se leen
            diferente — compara con cuidado (una deuda "alta" en eléctricas puede ser normal;
            en una minera, un problema).
          </p>
        )}

        {/* 🏁 Las dos acciones en la misma pista, indexadas a 100 */}
        <Carrera tA={tA} tB={tB} />

        <Reveal>
          <div className="comp-tabla">
            <Fila nombre="Sector" a={A.sector} b={B.sector} glosar={false} />
            <Fila
              nombre="Precio de cierre"
              a={A.precio && `${A.precio}${A.desactualizado ? ' ⚠' : ''} (${A.precioFecha})`}
              b={B.precio && `${B.precio}${B.desactualizado ? ' ⚠' : ''} (${B.precioFecha})`}
              glosar={false}
            />
            <Fila nombre="P/E" glosar={false}
              a={A.pe?.pe != null ? `${A.pe.pe.toFixed(1)}${A.pe.referencial ? ' ⚠' : ''}` : A.pe?.perdida ? 'Sin P/E (tuvo pérdida)' : null}
              b={B.pe?.pe != null ? `${B.pe.pe.toFixed(1)}${B.pe.referencial ? ' ⚠' : ''}` : B.pe?.perdida ? 'Sin P/E (tuvo pérdida)' : null}
              barras={<Barras a={A.pe?.pe} b={B.pe?.pe} />}
              nota="P/E = precio de la acción ÷ BPA (la ganancia anual que le toca a cada acción, de los estados SMV). Más bajo suele leerse como más barata — pero en cíclicas engaña. ⚠ = calculado con un precio viejo (la acción negocia poco): tómalo como referencia."
            />
            <Fila nombre="Dividendo anual" glosar={false}
              a={A.divAnual || (!A.reparte ? 'No reparte hoy' : null)}
              b={B.divAnual || (!B.reparte ? 'No reparte hoy' : null)} />
            <Fila nombre="Yield" glosar={false}
              a={A.yield || (!A.reparte ? '—' : null)}
              b={B.yield || (!B.reparte ? '—' : null)}
              barras={<Barras a={A.yieldNum} b={B.yieldNum} />}
              nota="Yield: qué % del precio te devuelve al año en dividendos (a precio de hoy)."
            />
            <Fila nombre="Deuda" a={A.deuda} b={B.deuda} glosar={false} />
            <Fila nombre="FCF (Flujo de Caja Libre)" a={A.fcf} b={B.fcf} glosar={false} />
            <Fila nombre="Margen" a={A.margen} b={B.margen} glosar={false} />
            <Fila nombre="EPS del trimestre" a={A.epsQ} b={B.epsQ} glosar={false} />
            <Fila nombre="¿Cuánto se mueve?" glosar={false}
              a={A.vol && `${A.vol}${A.volPct != null ? ` (${A.volPct}%)` : ''}`}
              b={B.vol && `${B.vol}${B.volPct != null ? ` (${B.volPct}%)` : ''}`}
              barras={<Barras a={A.volPct} b={B.volPct} />}
              nota="Volatilidad anualizada real (de sus cierres BVL): barra más larga = precio más nervioso. No es malo ni bueno: es carácter."
            />
            <Fila nombre="Rango 52 semanas" a={A.rango52} b={B.rango52} glosar={false} />
          </div>
        </Reveal>

        <DueloDividendos A={A} B={B} tA={tA} tB={tB} />
        <DueloMinero tA={tA} tB={tB} />

        {/* La historia de cada una, en una línea */}
        {(A.tesis || B.tesis) && (
          <Reveal>
            <div className="seccion-titulo">📜 La historia de cada una</div>
            <div className="comp-tesis-par">
              <div className="comp-tesis" style={{ borderLeftColor: COLOR_A }}>
                <div className="comp-duelo-t">{tA}</div>
                {A.tesis ? <Glosado text={A.tesis} /> : <span className="muted">Tesis pendiente.</span>}
              </div>
              <div className="comp-tesis" style={{ borderLeftColor: COLOR_B }}>
                <div className="comp-duelo-t">{tB}</div>
                {B.tesis ? <Glosado text={B.tesis} /> : <span className="muted">Tesis pendiente.</span>}
              </div>
            </div>
          </Reveal>
        )}

        <p className="muted" style={{ marginTop: 14, fontSize: 12.5 }}>
          ⚠ = precio desactualizado (no negocia seguido). "Pendiente (SMV)" = el
          dato no está en nuestras fuentes; nunca lo inventamos. El P/E se
          calcula con la ganancia anual 2025 — en empresas cíclicas puede engañar.
          Cuidado con comparar deudas de sectores distintos: cada sector se lee diferente.
          Las barras muestran MAGNITUD relativa, no cuál es "mejor".
        </p>
      </div>

      <Disclaimer />
    </div>
  )
}
