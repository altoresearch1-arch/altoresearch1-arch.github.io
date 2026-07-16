import { useState } from 'react'
import mineriaData from '../data/mineria.json'
import familiaData from '../data/mineria_familia.json'
import Glosado from './Glosado'

// ⛏️ Producción minera mensual (MINEM — Boletín Estadístico Minero).
// Un gráfico por metal (las unidades no se mezclan: TMF ≠ gramos finos), con
// números grandes: último mes, vs mes anterior, vs mismo mes del año pasado y
// % de TODO el Perú (el BEM trae el total nacional por metal). Hover/touch:
// lectura mes a mes. El BEM publica el TOP de productores: si la empresa no
// aparece un mes, queda SIN punto (produjo poco o nada relativo al top) —
// Regla #1: el hueco se explica, no se inventa un cero.

const METAL_INFO = {
  cobre: { nombre: 'Cobre', unidad: 'TMF', emoji: '🟠' },
  oro: { nombre: 'Oro', unidad: 'gramos finos', emoji: '🥇' },
  zinc: { nombre: 'Zinc', unidad: 'TMF', emoji: '🛡️' },
  plata: { nombre: 'Plata', unidad: 'kg finos', emoji: '🥈' },
  plomo: { nombre: 'Plomo', unidad: 'TMF', emoji: '🔋' },
  hierro: { nombre: 'Hierro', unidad: 'TMF', emoji: '🧲' },
  estano: { nombre: 'Estaño', unidad: 'TMF', emoji: '🥫' },
  molibdeno: { nombre: 'Molibdeno', unidad: 'TMF', emoji: '🔧' },
  arsenico: { nombre: 'Arsénico', unidad: 'TMF', emoji: '⚗️' },
  bismuto: { nombre: 'Bismuto', unidad: 'TMF', emoji: '💊' },
  cadmio: { nombre: 'Cadmio', unidad: 'TMF', emoji: '🔌' },
  manganeso: { nombre: 'Manganeso', unidad: 'TMF', emoji: '⚒️' },
  magnesio: { nombre: 'Magnesio', unidad: 'TMF', emoji: '✨' },
}

// Colores de línea por entidad (el dorado de la marca primero)
const COLORES = ['#d4af37', '#6fb3d9', '#d9836f', '#8fce8f']

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']

function mesCorto(iso) {
  const [a, m] = iso.split('-')
  return `${MESES_CORTOS[parseInt(m, 10) - 1]} ${a.slice(2)}`
}

function formatearNum(v) {
  if (v == null) return '—'
  if (v >= 1000) return Math.round(v).toLocaleString('es-PE')
  if (v >= 10) return v.toFixed(1)
  return v.toFixed(2)
}

// Número "grande" con traducción amable: el oro en gramos se vuelve kilos,
// la plata en kilos se vuelve toneladas, los millones se leen como millones.
function traducir(v, metal) {
  if (v == null) return null
  if (metal === 'oro' && v >= 1000) {
    const kg = v / 1000
    return `= ${kg >= 1000 ? (kg / 1000).toFixed(1) + ' toneladas' : Math.round(kg).toLocaleString('es-PE') + ' kg'} de oro`
  }
  if (metal === 'plata' && v >= 1000) return `= ${(v / 1000).toFixed(1)} toneladas de plata`
  if (v >= 1e6) return `= ${(v / 1e6).toFixed(2)} millones de toneladas`
  return null
}

// "del cobre" pero "de la plata" (único metal femenino de la lista)
function delMetal(metal, info) {
  return metal === 'plata' ? `de la ${info.nombre.toLowerCase()}` : `del ${info.nombre.toLowerCase()}`
}

// Números compactos para el eje: 1.1 M · 110 k · 850
function compacto(v) {
  if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + ' M'
  if (v >= 1e3) return (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + ' k'
  if (v >= 10) return Math.round(v).toString()
  return v.toFixed(1)
}

function pctTexto(actual, base) {
  if (actual == null || base == null || base === 0) return null
  const pct = ((actual - base) / base) * 100
  return { pct, texto: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`, sube: pct >= 0 }
}

// Suma de todas las líneas del gráfico en un mes (null si ninguna tiene dato)
function sumaMes(lineas, i) {
  let s = null
  lineas.forEach((l) => {
    const v = l.valores[i]
    if (v != null) s = (s || 0) + v
  })
  return s
}

// Un gráfico de líneas para UN metal (varias entidades = varias líneas), con
// grilla punteada, récord marcado, número en el último punto y lectura al
// pasar el dedo/cursor. Escala desde 0 (honesto: no exagera los saltos).
function GraficoMetal({ metal, lineas, meses, conLeyenda }) {
  const info = METAL_INFO[metal] || { nombre: metal, unidad: '', emoji: '⛏️' }
  const [hover, setHover] = useState(null)
  const W = 620
  const H = 200
  const PADL = 48
  const PADR = 10
  const PADT = 30
  const PADB = 24

  const todos = lineas.flatMap((l) => l.valores.filter((v) => v != null))
  if (!todos.length) return null
  const max = Math.max(...todos) * 1.08 || 1
  const px = (i) => PADL + (i * (W - PADL - PADR)) / (meses.length - 1)
  const py = (v) => PADT + ((max - v) * (H - PADT - PADB)) / max

  const segmentos = (valores) => {
    const segs = []
    let seg = []
    valores.forEach((v, i) => {
      if (v != null) seg.push([i, v])
      else if (seg.length) { segs.push(seg); seg = [] }
    })
    if (seg.length) segs.push(seg)
    return segs
  }

  // ── Números que enganchan (sobre la SUMA de lo graficado) ──
  const totalPais = mineriaData.totalesPais?.[metal]
  let iUlt = -1
  for (let i = meses.length - 1; i >= 0; i--) {
    if (sumaMes(lineas, i) != null) { iUlt = i; break }
  }
  const vUlt = iUlt >= 0 ? sumaMes(lineas, iUlt) : null
  const vPrev = iUlt > 0 ? sumaMes(lineas, iUlt - 1) : null
  const vAnioPasado = iUlt >= 12 ? sumaMes(lineas, iUlt - 12) : null
  const vsPrev = pctTexto(vUlt, vPrev)
  const vsAnio = pctTexto(vUlt, vAnioPasado)
  const sharePais = vUlt != null && totalPais?.[iUlt] ? (vUlt / totalPais[iUlt]) * 100 : null

  // 2026 vs 2025 comparando SOLO los meses donde ambos años tienen dato (honesto)
  let acum26 = 0; let acum25 = 0; let nComp = 0
  meses.forEach((m, i) => {
    if (!m.startsWith('2026')) return
    const j = i - 12
    const a = sumaMes(lineas, i); const b = j >= 0 ? sumaMes(lineas, j) : null
    if (a != null && b != null) { acum26 += a; acum25 += b; nComp++ }
  })
  const vsAcum = nComp >= 2 ? pctTexto(acum26, acum25) : null

  // Récord del período (el punto más alto de todas las líneas)
  let record = null
  lineas.forEach((l) => l.valores.forEach((v, i) => {
    if (v != null && (!record || v > record.v)) record = { v, i, color: l.color }
  }))

  const hayHuecos = lineas.some((l) => l.valores.some((v) => v == null))
  const ticks = meses.map((m, i) => ({ m, i })).filter(({ i }) => i % 3 === 0 || i === meses.length - 1)
  const varias = lineas.length > 1

  // Lectura al pasar el cursor/dedo (índice de mes más cercano)
  const moverHover = (ev) => {
    const svg = ev.currentTarget
    const rect = svg.getBoundingClientRect()
    const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left
    const xRel = (cx / rect.width) * W
    const i = Math.round(((xRel - PADL) / (W - PADL - PADR)) * (meses.length - 1))
    setHover(Math.min(meses.length - 1, Math.max(0, i)))
  }

  return (
    <div className="prodmin-chart">
      <div className="prodmin-chart-cab">
        <span className="prodmin-metal">{info.emoji} {info.nombre}</span>
        <span className="muted prodmin-unidad">
          <Glosado text={`producción mensual en ${info.unidad}`} />
        </span>
      </div>

      {/* 🏆 cuando domina su metal a nivel nacional */}
      {sharePais != null && sharePais >= 25 && (
        <div className="prodmin-trofeo">
          🏆 {varias ? 'Sus minas juntas produjeron' : 'Produjo'} el{' '}
          <strong>{sharePais >= 99.5 ? '100' : sharePais.toFixed(0)}%{' '}
          {metal === 'plata' ? 'de toda la plata' : `de todo el ${info.nombre.toLowerCase()}`} del Perú</strong>{' '}
          en {mesCorto(meses[iUlt])}.
        </div>
      )}

      {/* Números grandes del último mes con dato */}
      {vUlt != null && (
        <div className="prodmin-stats">
          <div className="prodmin-chip">
            <div className="prodmin-chip-k">{mesCorto(meses[iUlt])}{varias ? ' (juntas)' : ''}</div>
            <div className="prodmin-chip-v">{formatearNum(vUlt)} <span className="prodmin-chip-u"><Glosado text={info.unidad} /></span></div>
            {traducir(vUlt, metal) && <div className="prodmin-chip-extra">{traducir(vUlt, metal)}</div>}
          </div>
          {vsPrev && (
            <div className="prodmin-chip">
              <div className="prodmin-chip-k">vs {mesCorto(meses[iUlt - 1])}</div>
              <div className={'prodmin-chip-v ' + (vsPrev.sube ? 'sube' : 'baja')}>{vsPrev.texto}</div>
            </div>
          )}
          {vsAnio && (
            <div className="prodmin-chip">
              <div className="prodmin-chip-k">vs {mesCorto(meses[iUlt - 12])}</div>
              <div className={'prodmin-chip-v ' + (vsAnio.sube ? 'sube' : 'baja')}>{vsAnio.texto}</div>
              <div className="prodmin-chip-extra">mismo mes, un año antes</div>
            </div>
          )}
          {sharePais != null && sharePais < 25 && (
            <div className="prodmin-chip">
              <div className="prodmin-chip-k">{delMetal(metal, info)} del Perú</div>
              <div className="prodmin-chip-v oro">{sharePais >= 10 ? sharePais.toFixed(0) : sharePais.toFixed(1)}%</div>
              <div className="prodmin-chip-extra">en {mesCorto(meses[iUlt])}</div>
            </div>
          )}
          {vsAcum && (
            <div className="prodmin-chip">
              <div className="prodmin-chip-k">2026 vs 2025</div>
              <div className={'prodmin-chip-v ' + (vsAcum.sube ? 'sube' : 'baja')}>{vsAcum.texto}</div>
              <div className="prodmin-chip-extra">{nComp} meses comparables</div>
            </div>
          )}
        </div>
      )}

      {(varias || conLeyenda) && (
        <div className="prodmin-leyenda">
          {lineas.map((l) => (
            <span key={l.clave} className="prodmin-leyenda-item">
              <span className="prodmin-dot" style={{ background: l.color }} />
              {l.nombre}
            </span>
          ))}
        </div>
      )}

      <div className="prodmin-svg-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="prodmin-svg" role="img"
          aria-label={`Producción mensual de ${info.nombre} (${info.unidad})`}
          onMouseMove={moverHover} onMouseLeave={() => setHover(null)}
          onTouchStart={moverHover} onTouchMove={moverHover} onTouchEnd={() => setHover(null)}>
          {/* degradados para el relleno bajo cada línea */}
          <defs>
            {lineas.map((l) => (
              <linearGradient key={l.clave} id={`pmg-${metal}-${l.clave}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={l.color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={l.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {/* grilla horizontal punteada CON números (eje Y) */}
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1={PADL} x2={W - PADR} y1={py(max * f)} y2={py(max * f)}
                style={{ stroke: 'color-mix(in srgb, var(--oro) 16%, transparent)' }} strokeWidth="1" strokeDasharray="2 4" />
              <text x={PADL - 7} y={py(max * f) + 3.5} textAnchor="end" className="prodmin-ytick">
                {compacto(max * f)}
              </text>
            </g>
          ))}
          <line x1={PADL} x2={W - PADR} y1={py(0)} y2={py(0)} style={{ stroke: 'color-mix(in srgb, var(--oro) 35%, transparent)' }} strokeWidth="1" />
          <text x={PADL - 7} y={py(0) + 3.5} textAnchor="end" className="prodmin-ytick">0</text>
          {/* frontera 2025 | 2026 */}
          {(() => {
            const i26 = meses.indexOf('2026-01')
            if (i26 <= 0) return null
            const x = (px(i26 - 1) + px(i26)) / 2
            return (
              <g>
                <line x1={x} x2={x} y1={PADT - 10} y2={H - PADB}
                  stroke="rgba(244,241,233,0.16)" strokeWidth="1" strokeDasharray="5 4" />
                <text x={x - 5} y={PADT - 14} textAnchor="end" className="prodmin-anio">2025</text>
                <text x={x + 5} y={PADT - 14} textAnchor="start" className="prodmin-anio oro">2026</text>
              </g>
            )
          })()}
          {ticks.map(({ m, i }) => (
            <text key={m} x={px(i)} y={H - 8}
              textAnchor={i === 0 ? 'start' : i === meses.length - 1 ? 'end' : 'middle'}
              className="prodmin-tick">
              {mesCorto(m)}
            </text>
          ))}
          {/* guía vertical del hover */}
          {hover != null && (
            <line x1={px(hover)} x2={px(hover)} y1={PADT - 6} y2={H - PADB}
              stroke="rgba(244,241,233,0.35)" strokeWidth="1" strokeDasharray="3 3" />
          )}
          {/* una línea por entidad (con relleno degradado), cortada en los meses sin dato */}
          {lineas.map((l) => {
            const color = l.color
            return segmentos(l.valores).map((seg, s) => (
              <g key={`${l.clave}-${s}`}>
                {seg.length > 1 && (
                  <>
                    <polygon
                      points={`${px(seg[0][0]).toFixed(1)},${py(0).toFixed(1)} ${seg
                        .map(([i, v]) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`)
                        .join(' ')} ${px(seg[seg.length - 1][0]).toFixed(1)},${py(0).toFixed(1)}`}
                      fill={`url(#pmg-${metal}-${l.clave})`} />
                    <polyline
                      points={seg.map(([i, v]) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')}
                      fill="none" stroke={color} strokeWidth="2.2"
                      strokeLinejoin="round" strokeLinecap="round" />
                  </>
                )}
                {seg.map(([i, v]) => (
                  <circle key={i} cx={px(i)} cy={py(v)} r={hover === i ? 4.5 : 3} fill={color}>
                    <title>{`${l.nombre} — ${mesCorto(meses[i])}: ${formatearNum(v)} ${info.unidad}`}</title>
                  </circle>
                ))}
              </g>
            ))
          })}
          {/* último dato de cada línea: anillo + su valor al costado (si hay sitio) */}
          {lineas.map((l) => {
            let iFin = -1
            for (let i = l.valores.length - 1; i >= 0; i--) {
              if (l.valores[i] != null) { iFin = i; break }
            }
            if (iFin < 0) return null
            const v = l.valores[iFin]
            return (
              <g key={`fin-${l.clave}`}>
                <circle cx={px(iFin)} cy={py(v)} r="5.5" fill="none" stroke={l.color}
                  strokeWidth="1.5" opacity="0.8" />
                {lineas.length === 1 && (
                  <text x={px(iFin) - 9} y={py(v) - 9} textAnchor="end"
                    className="prodmin-vfinal" fill={l.color}>
                    {compacto(v)}
                  </text>
                )}
              </g>
            )
          })}
          {/* récord del período */}
          {record && (
            <text x={Math.min(Math.max(px(record.i), 60), W - 60)} y={py(record.v) - 8}
              textAnchor="middle" className="prodmin-record">
              ★ récord: {formatearNum(record.v)} ({mesCorto(meses[record.i])})
            </text>
          )}
        </svg>
        {/* Lectura del mes bajo el cursor/dedo */}
        {hover != null && (
          <div className="prodmin-lectura">
            <strong>{mesCorto(meses[hover])}</strong>
            {lineas.map((l) => (
              <span key={l.clave} className="prodmin-lectura-item">
                <span className="prodmin-dot" style={{ background: l.color }} />
                {l.valores[hover] != null
                  ? `${formatearNum(l.valores[hover])} ${info.unidad}`
                  : 'fuera del top ese mes'}
              </span>
            ))}
            {totalPais?.[hover] != null && sumaMes(lineas, hover) != null && (
              <span className="prodmin-lectura-item muted">
                {((sumaMes(lineas, hover) / totalPais[hover]) * 100).toFixed(1)}% del Perú
              </span>
            )}
          </div>
        )}
      </div>
      {hayHuecos && (
        <div className="prodmin-hueco muted">
          Los meses sin punto: no apareció ese mes entre los principales productores
          de {info.nombre.toLowerCase()} (produjo muy poco o nada) — el MINEM solo publica el top por metal.
        </div>
      )}
    </div>
  )
}

export default function ProduccionMinera({ ticker }) {
  const fam = familiaData[ticker]
  if (!fam) return null

  const meses = mineriaData.meses
  const entidades = (fam.entidades || [])
    .map((clave) => ({ clave, ...mineriaData.entidades[clave] }))
    .filter((e) => e.produccion)

  // metal -> líneas (una por entidad que lo produce)
  // El color es POR ENTIDAD (el mismo en todos los gráficos de la ficha).
  const porMetal = {}
  entidades.forEach((ent, k) => {
    Object.entries(ent.produccion).forEach(([metal, valores]) => {
      porMetal[metal] = porMetal[metal] || []
      porMetal[metal].push({
        clave: ent.clave, nombre: ent.nombre, valores,
        color: COLORES[k % COLORES.length],
      })
    })
  })

  // Con ≥3 meses de datos se grafica; con menos, se lista como "puntual"
  // (2 puntos dibujan una "tendencia" que no existe).
  const conDatos = (lineas) => Math.max(...lineas.map((l) => l.valores.filter((v) => v != null).length))
  // Orden fijo: los metales que mueven la plata primero, los subproductos al final.
  const ORDEN = ['cobre', 'oro', 'zinc', 'plata', 'estano', 'hierro', 'plomo', 'molibdeno',
    'manganeso', 'arsenico', 'bismuto', 'cadmio', 'magnesio']
  const metales = Object.entries(porMetal)
    .sort((a, b) => ORDEN.indexOf(a[0]) - ORDEN.indexOf(b[0]))
  const graficables = metales.filter(([, lineas]) => conDatos(lineas) >= 3)
  const puntuales = metales.filter(([, lineas]) => conDatos(lineas) < 3)

  return (
    <div className="prodmin">
      <div className="seccion-titulo">⛏️ Producción de sus minas (MINEM)</div>

      {fam.sinProduccion ? (
        <p className="prodmin-sinprod"><Glosado text={fam.sinProduccion} /></p>
      ) : (
        <>
          <p className="muted prodmin-intro">
            Lo que reportó al Ministerio de Energía y Minas, mes a mes
            ({mesCorto(meses[0])} → {mesCorto(meses[meses.length - 1])}). Pasa el dedo o el
            cursor por el gráfico para leer cada mes. Producir más no garantiza ganar más
            (depende del precio del metal y los costos) — pero muestra si el negocio está
            creciendo o apagándose.
          </p>
          {graficables.map(([metal, lineas]) => (
            <GraficoMetal key={metal} metal={metal} lineas={lineas} meses={meses}
              conLeyenda={entidades.length > 1} />
          ))}
          {fam.notaProduccion && (
            <div className="prodmin-notaprod">
              <Glosado text={fam.notaProduccion} />
            </div>
          )}
          {puntuales.length > 0 && (
            <div className="prodmin-hueco muted">
              También apareció de forma puntual (muy pocos meses con dato, no da para una gráfica):{' '}
              {puntuales.map(([metal, lineas]) => {
                const info = METAL_INFO[metal] || { nombre: metal, unidad: '' }
                const pares = lineas.flatMap((l) =>
                  l.valores.map((v, i) => (v != null ? `${mesCorto(meses[i])}: ${formatearNum(v)} ${info.unidad}` : null))
                    .filter(Boolean))
                return `${info.nombre} (${pares.join(' · ')})`
              }).join(' — ')}.
            </div>
          )}
        </>
      )}

      {/* Sus minas */}
      {fam.minas?.length > 0 && (
        <>
          <div className="prodmin-sub">Sus minas</div>
          <ul className="lista-limpia">
            {fam.minas.map((m, i) => (
              <li key={i}><Glosado text={m} /></li>
            ))}
          </ul>
        </>
      )}

      {/* Participaciones: quién controla a quién, con % — y si la otra cotiza, link */}
      {fam.participaciones?.length > 0 && (
        <>
          <div className="prodmin-sub">Participaciones (quién tiene qué)</div>
          <ul className="lista-limpia">
            {fam.participaciones.map((p, i) => (
              <li key={i}>
                <div className="prodmin-part">
                  {p.ticker ? (
                    <a className="prodmin-link" href={`#/empresa/${p.ticker}`}>{p.nombre} ({p.ticker})</a>
                  ) : (
                    <strong>{p.nombre}</strong>
                  )}
                  <span className="badge parcial prodmin-pct">{p.pct}</span>
                </div>
                <div className="muted" style={{ marginTop: 2 }}>
                  {p.cotiza ? '✓ cotiza en la BVL' : 'no cotiza en la BVL'}
                  {p.dividendos && p.dividendos !== '—' ? ` · ${p.dividendos}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {fam.nota && (
        <p className="muted prodmin-nota"><Glosado text={fam.nota} /></p>
      )}

      <p className="muted prodmin-fuente">
        Fuente:{' '}
        <a className="prodmin-link" href={mineriaData.fuenteUrl} target="_blank" rel="noreferrer">
          MINEM — Boletín Estadístico Minero
        </a>{' '}
        (producción por empresa; el MINEM publica el top de productores por metal).
        Actualizado: {mineriaData.actualizado}.
      </p>
    </div>
  )
}
