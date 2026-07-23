// 🔔 Los sonidos de la casa, sintetizados con Web Audio — cero archivos y
// cero peso extra en la descarga (la dieta de la web manda: ver dieta-de-la-web).
//
// Nacieron dentro de MonedaFidget (el logo-moneda anti-estrés del inicio) y
// viven aquí desde el 23-jul porque el "cling" dejó de ser solo de la moneda:
// también premia la mini-pregunta del Mentor (#14). Es EL MISMO sonido a
// propósito — en ALTO, ese cling significa "lo lograste", venga de donde venga.

let _ac = null // un solo AudioContext, se crea con el primer gesto del usuario

function contexto() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!_ac) _ac = new AC()
  if (_ac.state === 'suspended') _ac.resume().catch(() => {})
  return _ac
}

/** "Cling" metálico de moneda: el premio. */
export function cling() {
  try {
    const ctx = contexto()
    if (!ctx) return
    const now = ctx.currentTime
    const parciales = [[1175, 0], [1568, 0.045], [2350, 0.02]]
    parciales.forEach(([f, dt]) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'triangle'
      o.frequency.setValueAtTime(f, now + dt)
      o.frequency.exponentialRampToValueAtTime(f * 0.985, now + dt + 0.3)
      o.connect(g)
      g.connect(ctx.destination)
      g.gain.setValueAtTime(0.0001, now + dt)
      g.gain.exponentialRampToValueAtTime(0.15, now + dt + 0.006)
      g.gain.exponentialRampToValueAtTime(0.0001, now + dt + 0.34)
      o.start(now + dt)
      o.stop(now + dt + 0.42)
    })
  } catch { /* sin audio, la app funciona igual */ }
}

/** "Tunk" sordo del intento que no llegó: pesa, pero no regaña. */
export function tunk(intento = 1) {
  try {
    const ctx = contexto()
    if (!ctx) return
    const now = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'triangle'
    // cada intento suena un pelín más agudo: se siente que "ya casi"
    o.frequency.setValueAtTime(180 + intento * 40, now)
    o.frequency.exponentialRampToValueAtTime(120, now + 0.09)
    o.connect(g)
    g.connect(ctx.destination)
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(0.12, now + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
    o.start(now)
    o.stop(now + 0.15)
  } catch { /* nada */ }
}
