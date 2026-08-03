import { useState } from 'react'
import resumenes from '../data/resumenes.json'

// 📋 EL RESUMEN — el cierre del día, de la semana y del mes.
//
// POR QUÉ VA PRIMERO: el Radar entero es una herramienta para mirar; esto es
// la respuesta corta a "¿qué pasó?". Quien tiene 30 segundos lee esto y se va;
// quien tiene media hora sigue hacia abajo.
//
// ── LAS DOS VARAS, Y POR QUÉ SE MUESTRAN LAS DOS ─────────────────────────
// Cada movimiento se mide por dos criterios que NO coinciden:
//   · FUERZA (≥1× su propio vaivén) — la vara del DETECTOR: ¿se salió de lo
//     que esta acción suele hacer?
//   · PORCENTAJE (≥3%) — la vara del que va a TOMAR el movimiento: un +9% son
//     9% de plata aunque para esa acción sea un martes cualquiera.
//
// Se midieron sobre 10 ruedas reales: de 22 movimientos de 3% o más, SEIS
// estaban dentro del vaivén normal de su acción; y Credicorp tuvo días de 2.1×
// que el corte de 3% dejó fuera, uno por 0.0 puntos. Por eso la pantalla marca
// los DESACUERDOS en vez de esconderlos detrás de un solo número.
//
// ── QUÉ ES "LA FAVORITA" ─────────────────────────────────────────────────
// La que más veces se salió de su rango en el periodo. Es descripción de lo
// que YA pasó — la que más dio que hablar, no la que va a subir. El criterio
// va escrito en pantalla para que se pueda discutir.

const signo = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}%`
const clase = (n) => (n > 0.05 ? 'sube' : n < -0.05 ? 'baja' : 'muted')
const miles = (n) => (n == null ? null : Math.round(n).toLocaleString('es-PE'))
const dia = (iso) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '')

// Una línea de prensa con su hora cuando la hay. La hora importa: es la
// diferencia entre "salió el mismo día" y "salió antes del movimiento".
function Nota({ n }) {
  const cuerpo = (
    <>
      {n.hora && <span className="res-hora">{n.hora}</span>}
      {n.tipo === 'hecho' && <span className="res-hi">📄 HI</span>}
      {n.tipo === 'mundo' && <span className="res-mundo">🌍 {n.tema}</span>}
      <span className="res-nota-txt">
        {n.titulo}
        {n.medio && <span className="muted"> · {n.medio}</span>}
      </span>
    </>
  )
  const href = n.url || n.pdf
  return href
    ? <a className="res-nota" href={href} target="_blank" rel="noreferrer">{cuerpo}</a>
    : <div className="res-nota">{cuerpo}</div>
}

function FilaMov({ f, marcado, onVerEmpresa }) {
  const v = f.volumen
  return (
    <div className={'res-mov' + (marcado ? ' marcado' : '')}>
      <div className="res-mov-cab">
        <button className="res-tk" onClick={() => onVerEmpresa(f.ticker)}>{f.ticker}</button>
        <span className={'res-pct ' + clase(f.pct)}>{signo(f.pct)}</span>
        <span className="res-fz muted">
          {f.fuerza != null ? `${Math.abs(f.fuerza).toFixed(1)}× su vaivén` : 'sin vaivén medido'}
        </span>
        {v && (
          <span className="res-vol muted">
            {v.moneda} {miles(v.monto)} · {v.ops} op{v.ops === 1 ? '' : 's'}
            {v.ultima && <> · última {v.ultima.slice(11, 16)}</>}
          </span>
        )}
      </div>
      {v && v.min != null && v.max != null && (
        <div className="res-rango muted">
          en el día fue de {v.min} a {v.max}
          {v.apertura != null && <> · abrió en {v.apertura}</>}
        </div>
      )}
      {f.prensa?.length > 0
        ? f.prensa.slice(0, 3).map((n, i) => <Nota key={i} n={n} />)
        : <div className="res-nota muted">Nada publicado ese día.</div>}
    </div>
  )
}

export default function RadarResumen({ onVerEmpresa }) {
  const [tab, setTab] = useState('dia')
  const r = resumenes
  if (!r?.diario) return null

  const d = r.diario
  const periodo = tab === 'semana' ? r.semanal : tab === 'mes' ? r.mensual : null

  return (
    <div className="card res-card">
      <div className="res-cab">
        <h3 style={{ margin: 0 }}>📋 Resumen</h3>
        {/* EL SELLO. Sin fecha y hora, un resumen no se puede auditar: no se
            sabe si es de hoy o de la semana pasada. */}
        <span className="muted res-sello">sellado {r.generadoLegible}</span>
      </div>

      <div className="res-tabs" role="group" aria-label="Periodo del resumen">
        {[['dia', 'El día'], ['semana', 'La semana'], ['mes', 'El mes']].map(([id, txt]) => (
          <button key={id} className={'res-tab' + (tab === id ? ' activo' : '')}
                  onClick={() => setTab(id)}>{txt}</button>
        ))}
      </div>

      {tab === 'dia' && (
        <>
          <p className="muted res-intro">
            Rueda del <b>{d.fecha}</b> · {d.contactos} acciones que de verdad se
            negocian. Se mide con <b>dos varas que no coinciden</b>: cuánto se
            salió de su propio vaivén, y cuánto se movió en plata.
          </p>

          <div className="res-cols">
            <div className="res-col">
              <div className="res-col-tit">🔥 Se salieron de su vaivén <span className="muted">≥1×</span></div>
              {d.porFuerza.length
                ? d.porFuerza.map((f) => (
                  <FilaMov key={f.ticker} f={f} onVerEmpresa={onVerEmpresa}
                           marcado={d.soloLasVeElVaiven.includes(f.ticker)} />))
                : <p className="muted res-nada">Ninguna se salió de su rango.</p>}
            </div>
            <div className="res-col">
              <div className="res-col-tit">💰 Movieron 3% o más <span className="muted">en plata</span></div>
              {d.porPct.length
                ? d.porPct.map((f) => (
                  <FilaMov key={f.ticker} f={f} onVerEmpresa={onVerEmpresa}
                           marcado={d.soloLasVeElPorcentaje.includes(f.ticker)} />))
                : <p className="muted res-nada">Ninguna llegó al 3%.</p>}
            </div>
          </div>

          {/* LOS DESACUERDOS. Es lo más útil de toda la tarjeta: donde las dos
              varas se contradicen es donde un criterio solo te habría mentido. */}
          {(d.soloLasVeElVaiven.length > 0 || d.soloLasVeElPorcentaje.length > 0) && (
            <div className="res-desacuerdo">
              <div className="res-desacuerdo-tit">⚖️ Donde las dos varas no coinciden</div>
              {d.soloLasVeElVaiven.length > 0 && (
                <div>
                  <b>{d.soloLasVeElVaiven.join(' · ')}</b> — se salió de su rango pero{' '}
                  <b>no llegó al 3%</b>: un corte fijo la habría dejado pasar.
                </div>
              )}
              {d.soloLasVeElPorcentaje.length > 0 && (
                <div>
                  <b>{d.soloLasVeElPorcentaje.join(' · ')}</b> — movió 3% o más pero{' '}
                  <b>es normal para ella</b>: la plata está, la anomalía no.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {periodo && (() => {
        const g = periodo.favorita
        return (
          <>
            <p className="muted res-intro">
              De <b>{periodo.desde}</b> a <b>{periodo.hasta}</b> · {periodo.ruedas} ruedas.
            </p>

            <div className="res-favorita">
              <div className="res-fav-cab">
                <span className="res-fav-eti">🏆 La favorita de{tab === 'semana' ? ' la semana' : 'l mes'}</span>
                <button className="res-fav-tk" onClick={() => onVerEmpresa(g.ticker)}>{g.ticker}</button>
                <span className={'res-fav-pct ' + clase(g.total.pct)}>{signo(g.total.pct)}</span>
              </div>
              <div className="muted res-fav-nom">{g.nombre}</div>
              <div className="res-fav-datos">
                <span><b>{g.cruces}</b> {g.cruces === 1 ? 'vez' : 'veces'} fuera de su rango</span>
                <span>{g.total.precioDesde} → {g.total.precioHasta}</span>
                {g.montoPeriodo != null
                  ? <span>{miles(g.montoPeriodo)} negociados · {g.opsPeriodo} ops</span>
                  : <span className="muted">volumen del periodo: aún sin dato</span>}
              </div>
              <p className="muted res-criterio"><b>Cómo se elige:</b> {periodo.criterio}</p>
            </div>

            <div className="res-col-tit">Día a día de {g.ticker}</div>
            {g.dias.map((x) => (
              <div key={x.fecha} className="res-dia">
                <div className="res-dia-cab">
                  <span className="res-dia-f">{dia(x.fecha)}</span>
                  <span className={'res-pct ' + clase(x.pct)}>{signo(x.pct)}</span>
                  <span className="muted">
                    {x.fuerza != null ? `${Math.abs(x.fuerza).toFixed(1)}×` : '—'}
                    {x.volumen?.ultima && <> · última {x.volumen.ultima.slice(11, 16)}</>}
                  </span>
                </div>
                {x.prensa?.length > 0
                  ? x.prensa.slice(0, 2).map((n, i) => <Nota key={i} n={n} />)
                  : <div className="res-nota muted">Sin prensa ese día.</div>}
              </div>
            ))}

            <div className="res-col-tit" style={{ marginTop: 12 }}>El marcador</div>
            <div className="res-tabla">
              {periodo.tabla.map((m) => (
                <button key={m.ticker} className="res-tabla-fila" onClick={() => onVerEmpresa(m.ticker)}>
                  <span className="res-tk">{m.ticker}</span>
                  <span className="muted">{m.cruces} {m.cruces === 1 ? 'cruce' : 'cruces'}</span>
                  <span className={'res-pct ' + clase(m.pct)}>{signo(m.pct)}</span>
                  <span className="muted">
                    {m.monto != null ? `${miles(m.monto)} · ${m.ops} ops` : ''}
                  </span>
                </button>
              ))}
            </div>
          </>
        )
      })()}

      <p className="muted res-pie">
        Cierres reales de la BVL. <b>Esto describe lo que ya pasó y no anticipa
        nada</b> — «favorita» significa la que más se salió de su rango, no la
        que va a subir. El volumen y la hora de la última operación vienen del
        mercado; la hora exacta de un salto necesita el acumulado intradía, que
        recién empieza. Material de estudio, no recomendación de inversión.
      </p>
    </div>
  )
}
