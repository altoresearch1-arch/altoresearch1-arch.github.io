import { useEffect, useState } from 'react'

// 💵 Reloj de PRECIOS — pedido de Jair (11-jul): en Explorar, avisar cuándo se
// actualizan los precios de las acciones (a mediodía y al cierre del mercado) +
// cuenta regresiva + última vez que se actualizaron.
//
// Espeja el cron de PRECIOS del robot (.github/workflows/deploy.yml → '15 17,20'
// UTC = 12:15 y 15:15 hora Perú, Lun–Vie) más el refresco completo de la noche
// (22:23). Los precios se hornean en el build, así que "última vez" = el momento
// del último deploy (__BUILD_TIME__, igual que RelojDatos).

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// Ranuras de PRECIOS en minutos desde medianoche (hora Perú).
const SLOTS = [12 * 60 + 15, 15 * 60 + 15, 22 * 60 + 23]
const esHabil = (dow) => dow >= 1 && dow <= 5

function ahoraPeru() {
  const s = new Date().toLocaleString('en-US', { timeZone: 'America/Lima' })
  return new Date(s)
}

function hhmm(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Próxima ranura de precios: {min, dias, minutosFalta} / {min, dias, diaSemana}
function proxima(peru) {
  const dow = peru.getDay()
  const nowMin = peru.getHours() * 60 + peru.getMinutes()
  if (esHabil(dow)) {
    for (const s of SLOTS) {
      if (s > nowMin) return { min: s, dias: 0, minutosFalta: s - nowMin }
    }
  }
  let d = dow
  let add = 0
  do {
    d = (d + 1) % 7
    add++
  } while (!esHabil(d))
  return { min: SLOTS[0], dias: add, diaSemana: d }
}

function textoProxima(p) {
  if (p.dias === 0) {
    const falta = p.minutosFalta
    const cuando =
      falta <= 1 ? 'en menos de 1 min' : falta < 60 ? `en ~${falta} min` : `en ~${Math.round(falta / 60)} h`
    return { hora: `hoy ${hhmm(p.min)}`, falta: cuando }
  }
  const cuando = p.dias === 1 ? 'mañana' : `el ${DIAS[p.diaSemana]}`
  return { hora: `${cuando} ${hhmm(p.min)}`, falta: null }
}

// Última actualización = momento del build/deploy (Vite inyecta __BUILD_TIME__).
function ultimaActualizacion() {
  const raw = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : ''
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/)
  if (!m) return null
  const [, a, mes, d, hh, mm] = m
  const peru = ahoraPeru()
  const esHoy = peru.getFullYear() === +a && peru.getMonth() + 1 === +mes && peru.getDate() === +d
  return esHoy ? `hoy ${hh}:${mm}` : `${d}/${mes}/${a} ${hh}:${mm}`
}

export default function RelojPrecios() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  const peru = ahoraPeru()
  const prox = textoProxima(proxima(peru))
  const ultima = ultimaActualizacion()

  return (
    <div className="reloj-precios">
      <div className="reloj-precios-cab">
        💵 Precios de la BVL — se actualizan a <strong>mediodía (12:15)</strong> y al{' '}
        <strong>cierre (15:15)</strong>, hora de Perú.
      </div>
      <div className="reloj-precios-filas">
        <span className="reloj-precios-item">
          ⏳ Próxima: <strong>{prox.hora}</strong>
          {prox.falta && <span className="muted"> · {prox.falta}</span>}
        </span>
        {ultima && (
          <span className="reloj-precios-item">
            🔄 Última vez: <strong>{ultima}</strong>
          </span>
        )}
      </div>
      <p className="reloj-precios-nota">
        Cierre del día anterior mientras no abra el mercado. Recarga la página tras la hora de
        actualización para ver los nuevos precios. Los muy poco negociados pueden mostrar un cierre viejo.
      </p>
    </div>
  )
}
