import { leerFavoritos } from './favoritos'

// NOVEDADES EN VIVO — la app le pregunta a la web (novedades.json, servido
// SUELTO en la raíz, fuera del bundle) si alguna empresa de la lista ★ del
// usuario tiene un hecho de importancia nuevo o si el MINEM publicó un BEM
// nuevo. El robot de GitHub Actions refresca ese archivo cada 30 min en
// horario de mercado. Sin cuentas ni servidores: lo visto se recuerda en
// localStorage, igual que los favoritos.

const CLAVE = 'alto-novedades-vistas' // { hechos: {TICKER: 'fecha|titulo'}, bem: '2026-04' }

function leerVistas() {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE))
    return v && typeof v === 'object' ? v : null
  } catch {
    return null
  }
}

function guardarVistas(vistas) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(vistas))
  } catch { /* incógnito sin storage: los avisos salen igual, solo se repiten */ }
}

const claveDe = (h) => `${h.fecha}|${h.titulo}`

export async function buscarNovedades() {
  // no-store: queremos el archivo FRESCO del servidor, no el del Service Worker
  const r = await fetch(`${import.meta.env.BASE_URL}novedades.json`, { cache: 'no-store' })
  if (!r.ok) throw new Error(`novedades.json ${r.status}`)
  return r.json()
}

// Compara lo que llegó contra lo ya visto y devuelve los avisos NUEVOS de las
// empresas guardadas (★). La primera visita solo toma la foto inicial en
// silencio (no tendría gracia avisar 114 hechos viejos de golpe).
export function detectarAvisos(novedades, esMinera) {
  const hechos = novedades?.hechos || {}
  const vistas = leerVistas()
  const avisos = []

  if (vistas) {
    const favoritos = leerFavoritos()
    for (const t of favoritos) {
      const h = hechos[t]
      if (h?.fecha && vistas.hechos?.[t] && vistas.hechos[t] !== claveDe(h)) {
        avisos.push({ tipo: 'hecho', ticker: t, ...h })
      }
    }
    // BEM nuevo (es MENSUAL): avisar solo si el usuario sigue alguna minera.
    if (novedades?.bemUltimoMes && vistas.bem && vistas.bem !== novedades.bemUltimoMes) {
      const mineras = favoritos.filter((t) => esMinera?.(t))
      if (mineras.length > 0) {
        avisos.push({ tipo: 'bem', mes: novedades.bemUltimoMes, ticker: mineras[0], mineras })
      }
    }
  }

  // Foto al día de TODO (también lo no-favorito: así, al guardar una empresa
  // después, no le avisamos sus hechos viejos como si fueran noticia).
  const nuevas = { hechos: {}, bem: novedades?.bemUltimoMes || vistas?.bem || null }
  for (const [t, h] of Object.entries(hechos)) {
    if (h?.fecha) nuevas.hechos[t] = claveDe(h)
  }
  guardarVistas(nuevas)
  return avisos
}

// "din-don" suave de notificación, sintetizado con Web Audio (cero archivos,
// mismo truco que la moneda del inicio). Si el navegador aún no permite audio
// (no hubo ningún clic en la página), simplemente no suena — el aviso sale igual.
let _ac = null
export function sonarAviso() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    if (!_ac) _ac = new AC()
    const ctx = _ac
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const now = ctx.currentTime
    const notas = [[880, 0], [1174.7, 0.16]] // La5 → Re6: campanita amable
    notas.forEach(([f, dt]) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.setValueAtTime(f, now + dt)
      o.connect(g)
      g.connect(ctx.destination)
      g.gain.setValueAtTime(0.0001, now + dt)
      g.gain.exponentialRampToValueAtTime(0.12, now + dt + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, now + dt + 0.5)
      o.start(now + dt)
      o.stop(now + dt + 0.6)
    })
  } catch { /* sin audio no pasa nada */ }
}
