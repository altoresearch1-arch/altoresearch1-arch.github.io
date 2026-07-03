import { useRef } from 'react'

// El LOGO gigante del inicio es la "moneda" anti-estrés (guiño al coin de TF2):
// clícalo mientras esperas / te aburres y salta, se da la vuelta (flip 3D) y suena.
// El sonido se SINTETIZA con Web Audio (cero archivos). El giro va sobre el WRAP
// para no chocar con la animación de "aura que respira" del propio logo.

let _ac = null // un solo AudioContext, se crea con el primer clic (gesto del usuario)

function sonarMoneda() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    if (!_ac) _ac = new AC()
    const ctx = _ac
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime
    const parciales = [[1175, 0], [1568, 0.045], [2350, 0.02]] // 'cling' metálico
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
  } catch (e) { /* si el navegador bloquea el audio, el logo igual gira */ }
}

export default function MonedaFidget() {
  const wrapRef = useRef(null)

  const girar = () => {
    sonarMoneda()
    const el = wrapRef.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const vueltas = reduce ? 360 : 720 // giros completos (siempre acaba de frente)
    const salto = reduce ? -12 : -34
    el.animate(
      [
        { transform: 'perspective(760px) translateY(0) rotateX(0deg)' },
        { transform: `perspective(760px) translateY(${salto}px) rotateX(${vueltas * 0.5}deg)`, offset: 0.5 },
        { transform: `perspective(760px) translateY(0) rotateX(${vueltas}deg)` },
      ],
      { duration: reduce ? 520 : 780, easing: 'cubic-bezier(.34,.72,.28,1)' }
    )
  }

  return (
    <div
      className="hero-logo-wrap"
      ref={wrapRef}
      onClick={girar}
      role="button"
      tabIndex={0}
      aria-label="Gira el logo de ALTO"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); girar() } }}
      style={{ cursor: 'pointer', display: 'inline-block' }}
    >
      <img
        className="hero-logo"
        src={`${import.meta.env.BASE_URL}logo-alto.jpg`}
        alt="ALTO Research"
        draggable="false"
      />
    </div>
  )
}
