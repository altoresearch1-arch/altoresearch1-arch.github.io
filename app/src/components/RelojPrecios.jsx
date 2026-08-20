import { useEffect, useState } from 'react'
import pulsoPrecios from '../data/estados/precios.json'

// 💵 Reloj de PRECIOS — pedido de Jair (11-jul), reescrito el 19-ago-2026.
//
// LO QUE DECÍA Y ERA MENTIRA. Este cartel anunciaba "se actualizan a mediodía
// (12:15) y al cierre (15:15)". Ese cron dejó de existir hace rato: hoy los
// precios se bajan CADA 10 MINUTOS mientras hay rueda (deploy.yml → minutos
// :03 :13 :23 :33 :43 :53, de 9 a 16 hora Perú, Lun–Vie) más el cierre de la
// noche a las 22:23. El cartel seguía prometiendo dos horas que ya no pasaban.
//
// Y LO PEOR: "última vez" salía de __BUILD_TIME__ — el momento del último
// DESPLIEGUE, no de la última vez que el robot tocó un precio. Son dos cosas
// distintas y el 19-ago se vio para qué sirve la diferencia: el despliegue
// llevaba seis días roto (npm ci reventaba en el runner), el robot seguía
// bajando precios cada 10 minutos, y esta pantalla decía tranquilamente
// "🔄 Última vez: 13/08/2026 12:37" como si fuera una hora más. Nadie podía
// saber, mirando la app, que estaba leyendo precios de la semana pasada.
//
// AHORA SALE DEL PULSO DEL PROPIO ROBOT: app/src/data/estados/precios.json, que
// escribe extractor/heartbeat.py en cada corrida. Sigue viajando horneado en el
// build —no hay forma de que no— pero justamente por eso sirve de alarma: si el
// despliegue se vuelve a congelar, este sello se congela CON él y queda más
// viejo que la última ranura que tocaba. Eso es exactamente lo que se compara
// abajo, y cuando pasa el cartel lo dice en vez de disimularlo.
//
// OJO CON QUÉ PRECIO ESTÁS MIRANDO EN ESTA PANTALLA: Explorar pinta el dato
// HORNEADO (lib/finanzas → precioDe), no el vivo. El pedido directo a la BVL
// desde el navegador (lib/vivo.js) está en el Radar y en el Cuaderno, no acá.
// Por eso este reloj importa en Explorar más que en ningún otro lado.

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// Las ranuras REALES del cron de precios, en minutos desde medianoche (Perú).
//   · '3,33 14-21 * * 1-5'        UTC -> 9:03 … 16:33  (estas además republican)
//   · '13,23,43,53 14-21 * * 1-5' UTC -> 9:13 … 16:53  (estas solo commitean)
//   · '23 3 * * 2-6'              UTC -> 22:23, el barrido de cierre
const MINUTOS = [3, 13, 23, 33, 43, 53]
const CIERRE = 22 * 60 + 23
function ranurasDelDia() {
  const r = []
  for (let h = 9; h <= 16; h++) for (const m of MINUTOS) r.push(h * 60 + m)
  r.push(CIERRE)
  return r
}
const RANURAS = ranurasDelDia()
const esHabil = (dow) => dow >= 1 && dow <= 5

// Cada cuánto se REPUBLICA la web, que es lo que cambia el número horneado que
// se ve en esta pantalla: solo las ranuras :03 y :33 → media hora.
const MIN_ENTRE_DESPLIEGUES = 30

// Margen antes de gritar. El cron de Actions es "mejor esfuerzo", no un reloj:
// se retrasa minutos en las horas congestionadas. 90 min absorbe eso sin dejar
// pasar una web congelada de verdad.
const MARGEN_MS = 90 * 60000

function ahoraPeru() {
  const s = new Date().toLocaleString('en-US', { timeZone: 'America/Lima' })
  return new Date(s)
}

function hhmm(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Próxima ranura: {min, dias, minutosFalta} / {min, dias, diaSemana}
function proxima(peru) {
  const dow = peru.getDay()
  const nowMin = peru.getHours() * 60 + peru.getMinutes()
  if (esHabil(dow)) {
    for (const s of RANURAS) {
      if (s > nowMin) return { min: s, dias: 0, minutosFalta: s - nowMin }
    }
  }
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

// La ÚLTIMA ranura que ya venció, como Date en hora Perú. Camina hacia atrás
// saltándose sábados y domingos, así el fin de semana no dispara falsas
// alarmas: el domingo lo que "tocaba" sigue siendo el viernes 22:23.
function ultimaRanura(peru) {
  const nowMin = peru.getHours() * 60 + peru.getMinutes()
  const d = new Date(peru)
  if (esHabil(d.getDay())) {
    for (let i = RANURAS.length - 1; i >= 0; i--) {
      if (RANURAS[i] <= nowMin) {
        const r = new Date(d)
        r.setHours(0, RANURAS[i], 0, 0)
        return r
      }
    }
  }
  do {
    d.setDate(d.getDate() - 1)
  } while (!esHabil(d.getDay()))
  d.setHours(0, CIERRE, 0, 0)
  return d
}

function comoHace(ms) {
  const min = Math.round(ms / 60000)
  if (min < 2) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 36) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} días`
}

// El pulso que dejó el robot de precios (extractor/heartbeat.py).
// `ultima_con_cambios_utc` y no `ultimo_run_utc`: correr sin traer nada no es
// haber actualizado un precio, y esa distinción es justamente la que sirve acá.
function leerPulso() {
  const raw = pulsoPrecios?.ultima_con_cambios_utc || pulsoPrecios?.ultimo_ok_utc
  const t = raw ? new Date(raw) : null
  if (!t || Number.isNaN(t.getTime())) return null

  // El sello viene en UTC; se escribe en horario de Lima.
  const fmt = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const partes = Object.fromEntries(fmt.formatToParts(t).map((x) => [x.type, x.value]))
  const hoy = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date())
  const mismoDia = hoy === `${partes.day}/${partes.month}`

  const atraso = ultimaRanura(ahoraPeru()).getTime() - t.getTime()
  return {
    texto: mismoDia
      ? `hoy ${partes.hour}:${partes.minute}`
      : `${partes.day}/${partes.month} ${partes.hour}:${partes.minute}`,
    hace: comoHace(Date.now() - t.getTime()),
    congelado: atraso > MARGEN_MS,
    diasAtras: Math.floor(atraso / 86400000),
  }
}

export default function RelojPrecios() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  const prox = textoProxima(proxima(ahoraPeru()))
  const p = leerPulso()

  return (
    <div className="reloj-precios">
      <div className="reloj-precios-cab">
        💵 Precios de la BVL — el robot los baja <strong>cada 10 minutos</strong> mientras hay
        rueda (9:00–17:00, Lun–Vie) y una vez más al <strong>cierre (22:23)</strong>, hora de Perú.
      </div>
      <div className="reloj-precios-filas">
        <span className="reloj-precios-item">
          ⏳ Próxima: <strong>{prox.hora}</strong>
          {prox.falta && <span className="muted"> · {prox.falta}</span>}
        </span>
        {p && (
          <span className="reloj-precios-item">
            🔄 Último precio nuevo: <strong>{p.texto}</strong>
            <span className="muted"> · {p.hace}</span>
          </span>
        )}
      </div>
      {p?.congelado && (
        <p className="reloj-precios-nota" role="status">
          ⚠ <strong>Esta copia de la página está atrasada.</strong> El robot siguió bajando precios
          después de esa hora, pero la web no se volvió a publicar
          {p.diasAtras >= 1 ? ` en ${p.diasAtras} día${p.diasAtras > 1 ? 's' : ''}` : ''}: lo que
          ves abajo son los últimos cierres que alcanzó a hornear. Recarga con Ctrl+F5 por si es tu
          caché; si sigue igual, el que está roto es el despliegue.
        </p>
      )}
      <p className="reloj-precios-nota">
        En esta pantalla el precio viene <strong>horneado en la página</strong>, y la página se
        vuelve a publicar cada {MIN_ENTRE_DESPLIEGUES} minutos: recárgala para ver los nuevos. (El
        precio al segundo, pedido directo a la BVL, está en el Radar y en tu Cuaderno.) Mientras no
        abra el mercado se muestra el cierre anterior, y las muy poco negociadas pueden mostrar un
        cierre viejo.
      </p>
    </div>
  )
}
