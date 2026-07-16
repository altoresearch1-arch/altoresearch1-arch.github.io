import { useRef } from 'react'

// El LOGO gigante del inicio es la "moneda" anti-estrés (guiño al coin de TF2).
// v2 (pedido de Jair 09-jul): ahora la moneda SE RESISTE — cada toque es un
// intento (tiembla y suena sordo) y recién al 3º-6º intento (aleatorio) se da
// la vuelta completa, suena el "cling" y SUELTA PARTÍCULAS doradas. Todo
// sintetizado (cero archivos): sonidos con Web Audio, partículas con spans +
// Web Animations API. El giro va sobre el WRAP para no chocar con el aura.

let _ac = null // un solo AudioContext, se crea con el primer clic (gesto del usuario)

function contexto() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!_ac) _ac = new AC()
  if (_ac.state === 'suspended') _ac.resume().catch(() => {})
  return _ac
}

// "Cling" metálico del giro logrado (el de siempre)
function sonarMoneda() {
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
  } catch { /* sin audio, igual se mueve */ }
}

// "Tunk" sordo del intento fallido: la moneda pesa
function sonarIntento(intento) {
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

// 🎉 Partículas doradas al lograr el giro: chispas que salen disparadas del
// centro y caen con "gravedad" (todo con spans + WAAPI; se autodestruyen).
function soltarParticulas(wrap, reduce) {
  const cuantas = reduce ? 10 : 34
  const rect = wrap.getBoundingClientRect()
  const cx = rect.width / 2
  const cy = rect.height / 2
  for (let i = 0; i < cuantas; i++) {
    const p = document.createElement('span')
    const esChispa = Math.random() < 0.3
    p.className = 'moneda-particula'
    p.textContent = esChispa ? '✦' : ''
    const talla = esChispa ? 10 + Math.random() * 8 : 5 + Math.random() * 6
    p.style.width = esChispa ? 'auto' : `${talla}px`
    p.style.height = esChispa ? 'auto' : `${talla}px`
    p.style.fontSize = `${talla + 4}px`
    if (esChispa) p.style.background = 'transparent' // el ✦ brilla solo, sin bolita detrás
    p.style.left = `${cx}px`
    p.style.top = `${cy}px`
    wrap.appendChild(p)
    // ángulo con sesgo hacia arriba (fuente de chispas) + gravedad de vuelta
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4
    const dist = 55 + Math.random() * 115
    const dx = Math.cos(ang) * dist
    const dy = Math.sin(ang) * dist
    const caida = 40 + Math.random() * 60
    const dur = 650 + Math.random() * 450
    const giro = (Math.random() - 0.5) * 540
    // salida escalonada (stagger): las chispas no explotan como un anillo
    // perfecto sino como una FUENTE — unas salen al toque y otras un pelín
    // después. Nace invisible (estilo natural) para que la espera no la
    // muestre plantada en el centro; los keyframes la encienden al arrancar.
    const espera = Math.random() * 110
    p.style.opacity = '0'
    p.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.1) rotate(${giro * 0.6}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy + caida}px)) scale(0.4) rotate(${giro}deg)`, opacity: 0 },
      ],
      { duration: dur, delay: espera, easing: 'cubic-bezier(0.16, 0.8, 0.4, 1)' }
    ).onfinish = () => p.remove()
  }
}

export default function MonedaFidget() {
  const wrapRef = useRef(null)
  const intentos = useRef(0)
  // cuántos toques pide ESTA vuelta (3 a 6, aleatorio; cambia tras cada giro)
  const objetivo = useRef(3 + Math.floor(Math.random() * 4))
  const ocupada = useRef(false) // que no se encimen animaciones

  // Liberar el candado por EVENTO y también por TIEMPO: si la pestaña está de
  // fondo (o el navegador pausa animaciones), onfinish puede no llegar nunca y
  // la moneda quedaría muda para siempre.
  const ocuparDurante = (anim, ms) => {
    ocupada.current = true
    const liberar = () => { ocupada.current = false }
    anim.onfinish = liberar
    anim.oncancel = liberar
    setTimeout(liberar, ms + 120)
  }

  const intentar = () => {
    const el = wrapRef.current
    if (!el || ocupada.current) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    intentos.current += 1

    if (intentos.current < objetivo.current) {
      // INTENTO FALLIDO: tiembla (cada vez un poco más — "ya casi sale") y suena sordo
      sonarIntento(intentos.current)
      const fuerza = Math.min(intentos.current, 5)
      const grados = (reduce ? 8 : 16) + fuerza * (reduce ? 2 : 6)
      const lado = Math.random() < 0.5 ? 1 : -1
      const durTiembla = reduce ? 220 : 320
      const anim = el.animate(
        [
          { transform: 'perspective(760px) rotateX(0deg) rotate(0deg)' },
          { transform: `perspective(760px) rotateX(${grados}deg) rotate(${lado * 2}deg)`, offset: 0.35 },
          { transform: `perspective(760px) rotateX(${-grados * 0.35}deg) rotate(${-lado * 1.5}deg)`, offset: 0.7 },
          { transform: 'perspective(760px) rotateX(0deg) rotate(0deg)' },
        ],
        { duration: durTiembla, easing: 'cubic-bezier(0.36, 0.07, 0.19, 0.97)' }
      )
      ocuparDurante(anim, durTiembla)
      return
    }

    // ¡GIRO LOGRADO! — vuelta completa + cling + lluvia de partículas
    intentos.current = 0
    objetivo.current = 3 + Math.floor(Math.random() * 4)
    sonarMoneda()
    soltarParticulas(el, reduce)
    const vueltas = reduce ? 360 : 720
    const salto = reduce ? -12 : -34
    const durGiro = reduce ? 520 : 780
    const anim = el.animate(
      [
        { transform: 'perspective(760px) translateY(0) rotateX(0deg)' },
        { transform: `perspective(760px) translateY(${salto}px) rotateX(${vueltas * 0.5}deg)`, offset: 0.5 },
        { transform: `perspective(760px) translateY(0) rotateX(${vueltas}deg)` },
      ],
      { duration: durGiro, easing: 'cubic-bezier(.34,.72,.28,1)' }
    )
    ocuparDurante(anim, durGiro)
  }

  return (
    <div
      className="hero-logo-wrap"
      ref={wrapRef}
      onClick={intentar}
      role="button"
      tabIndex={0}
      aria-label="Intenta voltear la moneda de ALTO (se resiste: dale varios toques)"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); intentar() } }}
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
