import { useEffect, useState } from 'react'

// 🕐 Reloj de actualización — pedido de Jair (10-jul).
// Muestra en cada ficha CUÁNDO vuelve a revisar el robot los Hechos de
// Importancia y la producción minera (BEM), con cuenta regresiva, el aviso de
// que la SMV a veces demora unos minutos, y la última vez que trajo datos nuevos.
//
// El horario espeja el cron del robot (.github/workflows/deploy.yml):
//   • Hechos + BEM: cada 30 min en :07 y :37, de 8:07 a 21:37 (hora Perú).
//   • Cierre: 22:23 (barre lo último del día).
//   • Solo días hábiles (Lun–Vie). La BVL no negocia fines de semana.
// (Los PRECIOS son otro cron: 12:15 y 15:15 — eso lo explica su propia sección.)

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// Ranuras del día hábil, en minutos desde la medianoche (hora Perú).
function ranurasDelDia() {
  const r = []
  for (let h = 8; h <= 21; h++) {
    r.push(h * 60 + 7, h * 60 + 37) // :07 y :37
  }
  r.push(22 * 60 + 23) // cierre 22:23
  return r
}
const RANURAS = ranurasDelDia()
const esHabil = (dow) => dow >= 1 && dow <= 5

// "Ahora" en hora de Perú, sin importar la zona horaria del celular:
// construimos un Date a partir del string en horario America/Lima.
function ahoraPeru() {
  const s = new Date().toLocaleString('en-US', { timeZone: 'America/Lima' })
  return new Date(s)
}

// hh:mm a partir de minutos desde medianoche
function hhmm(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Próxima ranura: {min, dias, minutosFalta}. dias=0 hoy, 1 mañana, etc.
function proxima(peru) {
  const dow = peru.getDay()
  const nowMin = peru.getHours() * 60 + peru.getMinutes()
  if (esHabil(dow)) {
    for (const s of RANURAS) {
      if (s > nowMin) return { min: s, dias: 0, minutosFalta: s - nowMin }
    }
  }
  // No queda ranura hoy (o es finde): saltar al próximo día hábil, primera ranura.
  let d = dow
  let add = 0
  do {
    d = (d + 1) % 7
    add++
  } while (!esHabil(d))
  return { min: RANURAS[0], dias: add, diaSemana: d }
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

// Última vez que el robot trajo datos nuevos = momento del build/deploy.
// __BUILD_TIME__ lo inyecta Vite: "YYYY-MM-DD HH:mm:ss" en hora de Perú.
function ultimaActualizacion() {
  const raw = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : ''
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/)
  if (!m) return null
  const [, a, mes, d, hh, mm] = m
  const peru = ahoraPeru()
  const esHoy = peru.getFullYear() === +a && peru.getMonth() + 1 === +mes && peru.getDate() === +d
  return esHoy ? `hoy ${hh}:${mm}` : `${d}/${mes}/${a} ${hh}:${mm}`
}

export default function RelojDatos() {
  // Recalcular cada 30 s para que la cuenta regresiva no quede congelada.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  const peru = ahoraPeru()
  const p = proxima(peru)
  const prox = textoProxima(p)
  const ultima = ultimaActualizacion()

  return (
    <div className="reloj-datos">
      <div className="reloj-cab">🕐 Actualización de Hechos de Importancia y producción (BEM)</div>
      <div className="reloj-fila">
        <span className="reloj-k">Próxima revisión</span>
        <span className="reloj-v">
          {prox.hora}
          {prox.falta && <span className="reloj-falta"> · {prox.falta}</span>}
        </span>
      </div>
      {ultima && (
        <div className="reloj-fila">
          <span className="reloj-k">Última vez con datos nuevos</span>
          <span className="reloj-v">{ultima}</span>
        </div>
      )}
      <p className="reloj-nota">
        El Gran Hermano revisa cada 30 minutos, de 8:00 a 21:30 (Lun–Vie). ⚠ A veces el servidor de la SMV
        se demora y el dato entra 7–10 minutos más tarde.
      </p>
    </div>
  )
}
