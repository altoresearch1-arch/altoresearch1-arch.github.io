import { useMemo, useState } from 'react'
import { PLAZOS, filasRadar, huecoHistorico, rotacionSectores, leerFuerza, generadoNoticias } from '../lib/radar'
import { useColaHistorica, useMercadoVivo, useNoticiasFrescas } from '../lib/vivo'
import RadarCandente from './RadarCandente'
import MuroNoticias from './MuroNoticias'
import RadarHistoria from './RadarHistoria'
import RadarSonar from './RadarSonar'
import RadarMundo from './RadarMundo'
import RadarResumen from './RadarResumen'
import SelloVivo from './SelloVivo'

// 📡 RADAR DE ROTACIÓN — la pantalla del que mira el mercado moverse.
//
// Dos preguntas, en este orden: ¿qué SECTOR se prendió? y dentro de él,
// ¿qué acción se movió más de lo que ella suele moverse? El cálculo entero
// vive en lib/radar.js (ahí está explicado el porqué de cada regla).
//
// TONO (Regla de Oro): todo en pasado y en modo descripción. "Se movió",
// nunca "va a subir"; "mira", nunca "compra". El Radar es un espejo del
// mercado, no un consejo.

const NOMBRE_SECTOR = {
  minas: 'Minas', acereras: 'Acereras', cemento: 'Cemento y construcción',
  bancos: 'Bancos', electricas: 'Eléctricas', alimentos: 'Alimentos',
  retail: 'Retail', textil: 'Textil', pesqueras: 'Pesqueras',
  fondos: 'Fondos y ETF', afp: 'AFP', diversas: 'Diversas',
}
const nombreSector = (s) => NOMBRE_SECTOR[s] || s

function fechaCorta(iso) {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

const signo = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}%`
const clase = (n) => (n > 0.05 ? 'sube' : n < -0.05 ? 'baja' : 'muted')

export default function Radar({ onVerEmpresa }) {
  // 2 semanas por defecto: es el plazo más corto donde el +5% que persigue
  // un trader deja de ser excepcional (43% de las ventanas en 18 meses de
  // historia, contra 3% en un solo día). Ver RadarHistoria.
  const [ruedas, setRuedas] = useState(10)
  // 🔴 El mercado en vivo. Mientras hay rueda el navegador le pregunta el
  // precio a la BVL cada 45 s y TODO el Radar se recalcula con él: el plato,
  // el ranking, los sectores. Si la BVL no contesta (o es domingo), `precios`
  // queda en null y filasRadar cae sola al dato horneado del robot.
  const vivo = useMercadoVivo()
  // 📈 Si el robot no corrió, el archivo de cierres se quedó ruedas atrás y
  // los plazos medirían mal. Esto baja de la BVL solo las ruedas que faltan,
  // una vez por visita. Con el archivo al día no cuesta ni una llamada.
  const hueco = useMemo(() => huecoHistorico(), [])
  const { cola } = useColaHistorica(hueco)
  // 📰 La prensa es lo único que no se puede pedir desde el navegador (los
  // medios bloquean). Lo que sí se puede es leerla del REPO en vez de esperar
  // a que la web se vuelva a publicar: así aparece apenas el robot la
  // commitea. `prensa` sube de número cada vez que entra una copia más nueva.
  const prensa = useNoticiasFrescas()
  const { filas, descartadas, total, fecha } = useMemo(
    () => filasRadar(vivo.precios, vivo.hechos, cola),
    [vivo.precios, vivo.hechos, cola, prensa],
  )
  const sectores = useMemo(() => rotacionSectores(filas, ruedas), [filas, ruedas])

  const ranking = useMemo(
    () => filas
      .filter((f) => f.retornos[ruedas] != null)
      .sort((a, b) => b.retornos[ruedas] - a.retornos[ruedas]),
    [filas, ruedas],
  )

  if (!filas.length) {
    return (
      <div className="card">
        <h2>📡 Radar</h2>
        <p className="muted">
          No hay series de precios suficientes para calcular el Radar. Corre el
          robot (<code>python extractor/actualizar_todo.py --precios</code>) y vuelve.
        </p>
      </div>
    )
  }

  const plazo = PLAZOS.find((p) => p.ruedas === ruedas)
  const topeSector = Math.max(...sectores.map((s) => Math.abs(s.mediana)), 0.01)

  return (
    <div className="radar">
      <div className="card radar-cabecera">
        <div className="radar-cab">
          <h2 style={{ margin: 0 }}>📡 Radar de rotación</h2>
          <SelloVivo vivo={vivo} fecha={fecha ? fechaCorta(fecha) : null} />
        </div>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          Qué se movió en la BVL durante <b>{plazo.etiqueta}</b>, con las{' '}
          <b>{filas.length} acciones que de verdad se negocian</b>. Las otras{' '}
          {descartadas} de las {total} quedaron fuera: tienen el precio congelado
          y su “subida” sería de un día viejo.
        </p>

        <div className="radar-plazos" role="group" aria-label="Plazo del Radar">
          {PLAZOS.map((p) => (
            <button
              key={p.ruedas}
              className={'radar-plazo' + (p.ruedas === ruedas ? ' activo' : '')}
              onClick={() => setRuedas(p.ruedas)}
            >
              {p.corto} <span className="muted">· {p.etiqueta}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 1) El resumen: la respuesta corta a «¿qué pasó?», con su sello de
             fecha y hora. Va PRIMERO a propósito — quien tiene 30 segundos lee
             esto y se va; quien tiene media hora sigue hacia abajo. */}
      <RadarResumen onVerEmpresa={onVerEmpresa} />

      {/* ── 2) El sonar: el mercado de un vistazo, en pantalla de submarino. */}
      <RadarSonar filas={filas} ruedas={ruedas} plazo={plazo} vivo={vivo} onVerEmpresa={onVerEmpresa} />

      {/* ── 3) El mundo: lo que llega de afuera, con el canal por el que llega.
             Va antes del muro y del ranking a propósito — más de un tercio del
             plato (10 minas + 2 acereras + 3 fondos) tiene la causa fuera del
             país, y hasta hoy la app preguntaba todo con el lente de Perú. */}
      <RadarMundo
        onVerEmpresa={onVerEmpresa}
        tickersVisibles={new Set(filas.map((f) => f.ticker))}
      />

      {/* ── 4) El muro: todos los titulares, lo nuevo marcado. */}
      <MuroNoticias filas={filas} ruedas={ruedas} onVerEmpresa={onVerEmpresa} />

      {/* ── 5) Lo candente: movimiento fuera de rango + lo que se publicó. */}
      <RadarCandente filas={filas} ruedas={ruedas} plazo={plazo} onVerEmpresa={onVerEmpresa} />

      {/* ── 6) La rotación: el sector manda sobre la acción suelta. */}
      <div className="card radar-sectores">
        <h3 style={{ margin: '0 0 4px' }}>¿Qué sector se movió?</h3>
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
          La <b>mediana</b> de sus acciones en {plazo.etiqueta} (no el promedio:
          con 2 o 3 nombres por sector, un caso raro cuenta una película que no
          pasó). Abajo de cada uno, de quién sale el número.
        </p>
        {sectores.map((s) => (
          <div key={s.sector} className="radar-sector">
            <div className="radar-sector-fila">
              <span className="radar-sector-nom">{nombreSector(s.sector)}</span>
              <span className="radar-sector-barra">
                <i
                  className={s.mediana >= 0 ? 'sube-bg' : 'baja-bg'}
                  style={{ width: `${(Math.abs(s.mediana) / topeSector) * 100}%` }}
                />
              </span>
              <span className={'radar-sector-pct ' + clase(s.mediana)}>
                {signo(s.mediana)}
              </span>
            </div>
            <div className="radar-sector-quien muted">
              {s.n === 1 ? '1 acción: ' : `${s.n} acciones: `}
              {s.tickers.join(' · ')}
            </div>
          </div>
        ))}
      </div>

      {/* ── 7) La memoria: qué pasó antes a este mismo plazo. */}
      <RadarHistoria ruedas={ruedas} plazo={plazo} onVerEmpresa={onVerEmpresa} />

      {/* ── 8) El ranking, con la fuerza al lado del %. */}
      <div className="card radar-ranking">
        <h3 style={{ margin: '0 0 4px' }}>Acción por acción</h3>
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
          Un % suelto no dice nada: +3% en una montaña rusa es un martes
          cualquiera, y +3% en una tranquila es un terremoto. Por eso debajo del
          % va el <b>vaivén normal de esa acción</b> a este plazo — lo que se
          mueve sin que pase nada. 🔥 aparece cuando el movimiento se salió de
          ese rango, y ahí sí hay algo que mirar.
        </p>
        <div className="radar-lista">
          {ranking.map((f) => {
            const pct = f.retornos[ruedas]
            const fz = leerFuerza(f.fuerzas[ruedas], f.normales[ruedas])
            return (
              <button key={f.ticker} className="radar-fila" onClick={() => onVerEmpresa(f.ticker)}>
                <span className="radar-tk">{f.ticker}</span>
                <span className="radar-nom">
                  {f.nombre}
                  <span className="radar-sec muted"> · {nombreSector(f.sector)}</span>
                  {f.hecho?.dias != null && f.hecho.dias <= 10 && (
                    <span className="radar-hecho">
                      📰 publicó un hecho {f.hecho.dias === 0 ? 'hoy'
                        : f.hecho.dias === 1 ? 'ayer' : `hace ${f.hecho.dias} días`}
                    </span>
                  )}
                </span>
                <span className="radar-nums">
                  <span className={'radar-pct ' + clase(pct)}>{signo(pct)}</span>
                  {fz && (
                    <span className={'radar-fuerza' + (fz.nivel === 0 ? ' muted' : '')}>
                      {fz.icono} {fz.texto}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <p className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
        Cierres reales de la BVL (los mismos que baja el robot todos los días)
        {generadoNoticias() && <> · titulares al {generadoNoticias()}</>}. El Radar{' '}
        <b>mide lo que ya pasó y lo ordena</b> — que algo haya subido no dice
        nada de si va a seguir subiendo, y la fuerza mide movimiento, no motivo.
        Esto es material de estudio, no una recomendación de inversión.
      </p>
    </div>
  )
}
