import mineriaData from '../data/mineria.json'
import familiaData from '../data/mineria_familia.json'
import Glosado from './Glosado'

// ⛏️ Producción minera mensual (MINEM — Boletín Estadístico Minero).
// Un mini-gráfico por metal (las unidades no se mezclan: TMF ≠ gramos finos).
// El BEM publica el TOP de productores por metal: si la empresa no aparece un
// mes, ese mes queda SIN punto (produjo poco o nada relativo al top) — Regla #1:
// el hueco se explica, no se inventa un cero.
// Abajo: sus minas y participaciones (mineria_familia.json, datos verificados).

const METAL_INFO = {
  cobre: { nombre: 'Cobre', unidad: 'TMF' },
  oro: { nombre: 'Oro', unidad: 'gramos finos' },
  zinc: { nombre: 'Zinc', unidad: 'TMF' },
  plata: { nombre: 'Plata', unidad: 'kg finos' },
  plomo: { nombre: 'Plomo', unidad: 'TMF' },
  hierro: { nombre: 'Hierro', unidad: 'TMF' },
  estano: { nombre: 'Estaño', unidad: 'TMF' },
  molibdeno: { nombre: 'Molibdeno', unidad: 'TMF' },
  arsenico: { nombre: 'Arsénico', unidad: 'TMF' },
  bismuto: { nombre: 'Bismuto', unidad: 'TMF' },
  cadmio: { nombre: 'Cadmio', unidad: 'TMF' },
  manganeso: { nombre: 'Manganeso', unidad: 'TMF' },
  magnesio: { nombre: 'Magnesio', unidad: 'TMF' },
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

// Un gráfico de líneas para UN metal (varias entidades = varias líneas).
// Grilla punteada + puntos por mes, estilo "chart clásico". Escala desde 0
// (honesto: no exagera las subidas y bajadas).
function GraficoMetal({ metal, lineas, meses, conLeyenda }) {
  const info = METAL_INFO[metal] || { nombre: metal, unidad: '' }
  const W = 620
  const H = 170
  const PADL = 8
  const PADR = 8
  const PADT = 10
  const PADB = 24

  const todos = lineas.flatMap((l) => l.valores.filter((v) => v != null))
  if (!todos.length) return null
  const max = Math.max(...todos) * 1.08 || 1
  const px = (i) => PADL + (i * (W - PADL - PADR)) / (meses.length - 1)
  const py = (v) => PADT + ((max - v) * (H - PADT - PADB)) / max

  // Segmentos continuos (los huecos = meses sin dato → la línea se corta)
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

  const hayHuecos = lineas.some((l) => l.valores.some((v) => v == null))
  const ticks = meses.map((m, i) => ({ m, i })).filter(({ i }) => i % 3 === 0 || i === meses.length - 1)

  return (
    <div className="prodmin-chart">
      <div className="prodmin-chart-cab">
        <span className="prodmin-metal">{info.nombre}</span>
        <span className="muted prodmin-unidad">
          <Glosado text={`producción mensual en ${info.unidad}`} />
        </span>
      </div>
      {(lineas.length > 1 || conLeyenda) && (
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
          aria-label={`Producción mensual de ${info.nombre} (${info.unidad})`}>
          {/* grilla horizontal punteada */}
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1={PADL} x2={W - PADR} y1={py(max * f)} y2={py(max * f)}
              stroke="rgba(212,175,55,0.18)" strokeWidth="1" strokeDasharray="2 4" />
          ))}
          <line x1={PADL} x2={W - PADR} y1={py(0)} y2={py(0)} stroke="rgba(212,175,55,0.35)" strokeWidth="1" />
          {/* meses en el eje */}
          {ticks.map(({ m, i }) => (
            <text key={m} x={px(i)} y={H - 8}
              textAnchor={i === 0 ? 'start' : i === meses.length - 1 ? 'end' : 'middle'}
              className="prodmin-tick">
              {mesCorto(m)}
            </text>
          ))}
          {/* una línea por entidad, cortada en los meses sin dato */}
          {lineas.map((l) => {
            const color = l.color
            return segmentos(l.valores).map((seg, s) => (
              <g key={`${l.clave}-${s}`}>
                {seg.length > 1 && (
                  <polyline
                    points={seg.map(([i, v]) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')}
                    fill="none" stroke={color} strokeWidth="2"
                    strokeLinejoin="round" strokeLinecap="round" />
                )}
                {seg.map(([i, v]) => (
                  <circle key={i} cx={px(i)} cy={py(v)} r="3" fill={color}>
                    <title>{`${l.nombre} — ${mesCorto(meses[i])}: ${formatearNum(v)} ${info.unidad}`}</title>
                  </circle>
                ))}
              </g>
            ))
          })}
        </svg>
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
            ({mesCorto(meses[0])} → {mesCorto(meses[meses.length - 1])}). Producir más no
            garantiza ganar más (depende del precio del metal y los costos) — pero muestra
            si el negocio está creciendo o apagándose.
          </p>
          {graficables.map(([metal, lineas]) => (
            <GraficoMetal key={metal} metal={metal} lineas={lineas} meses={meses}
              conLeyenda={entidades.length > 1} />
          ))}
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
