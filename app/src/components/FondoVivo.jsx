import { useEffect, useRef } from 'react'
import { prefiereQuieto } from '../lib/anim'
import { NIVELES, leerNivel } from '../lib/nivel'

// Fondo vivo: "polvo dorado" flotando en canvas + luz que sigue el cursor.
// Sobrio (partículas tenues, deriva lenta) e interactivo: se apartan suave
// del mouse. Barato en batería: pausa cuando la pestaña no se ve, tope de
// devicePixelRatio, pocas partículas en celular, y se APAGA por completo si
// el usuario pide menos movimiento (prefers-reduced-motion).
// 🎨 NIVELES v3: el polvo y la luz del cursor toman el COLOR DEL NIVEL
// (verde dinero / oro / azul acero / platino) — la atmósfera entera es tuya.
// El cambio ocurre tapado por la pantalla de transición, así que al volver
// "el mundo ya es de otro color". Las flechas de índice NO se tocan: su
// verde/rojo significa sube/baja y eso no se negocia.

const ORO = { r: 212, g: 175, b: 55 }

function hexARgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return ORO
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

// versión "encendida" del color: mezclado 35% hacia blanco
function aclarar(c) {
  return {
    r: Math.round(c.r + (255 - c.r) * 0.35),
    g: Math.round(c.g + (255 - c.g) * 0.35),
    b: Math.round(c.b + (255 - c.b) * 0.35),
  }
}

export default function FondoVivo() {
  const ref = useRef(null)

  useEffect(() => {
    if (prefiereQuieto()) return // accesibilidad: fondo estático
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    // color del polvo según el nivel elegido (oro si aún no hay nivel)
    let polvo = ORO
    let polvoClaro = aclarar(ORO)
    const aplicarColorNivel = () => {
      const n = NIVELES.find((x) => x.id === leerNivel())
      polvo = n ? hexARgb(n.color) : ORO
      polvoClaro = aclarar(polvo)
    }
    aplicarColorNivel()

    let ancho = 0, alto = 0
    let particulas = []
    let rafId = null
    let ultimoT = performance.now()
    const raton = { x: -9999, y: -9999, activo: false }
    const esMovil = window.innerWidth < 640

    const redimensionar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      ancho = window.innerWidth
      alto = window.innerHeight
      canvas.width = ancho * dpr
      canvas.height = alto * dpr
      canvas.style.width = ancho + 'px'
      canvas.style.height = alto + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const crearParticulas = () => {
      const n = esMovil ? 150 : 360
      particulas = Array.from({ length: n }, () => ({
        x: Math.random() * ancho,
        y: Math.random() * alto,
        vx: (Math.random() - 0.5) * 12,
        vy: -3 - Math.random() * 9, // deriva lenta hacia arriba (como brasas)
        r: 0.7 + Math.random() * 1.7,
        base: 0.08 + Math.random() * 0.22, // opacidad base (tenue)
        fase: Math.random() * Math.PI * 2,
        parpadeo: 0.4 + Math.random() * 0.9,
      }))
    }

    // ---- FLECHAS DE ÍNDICE BURSÁTIL (como la del logo de ALTO): zigzag con
    //      tramos de avance y pequeños retrocesos, y PUNTA DE FLECHA en la
    //      cabeza. Doradas las que suben (marca), rojas tenues las que bajan. ----
    let lineas = []
    let proximaLinea = 0.3 // segundos hasta la siguiente

    const crearLinea = () => {
      const sube = Math.random() < 0.5
      const rapida = Math.random() < 0.3
      return {
        sube,
        x: -30,
        y: alto * (0.12 + Math.random() * 0.76) + (sube ? alto * 0.1 : -alto * 0.1),
        vx: (rapida ? 300 : 160) + Math.random() * 130, // px/s hacia la derecha
        pendiente: 40 + Math.random() * 55, // px/s vertical del tramo de avance
        puntos: [],
        maxPuntos: rapida ? 90 : 150, // cola LARGA: se ve el recorrido completo
        alfaMax: 0.20 + Math.random() * 0.14,
        // zigzag de índice: avanza fuerte, corrige un poco, vuelve a avanzar
        enRetroceso: false,
        tramoRestante: 0.4 + Math.random() * 0.4, // segundos del tramo actual
      }
    }

    const pasoLineas = (dt) => {
      // lluvia constante: sale una nueva cada fracción de segundo
      proximaLinea -= dt
      const tope = esMovil ? 4 : 8
      if (proximaLinea <= 0 && lineas.length < tope) {
        lineas.push(crearLinea())
        proximaLinea = 0.4 + Math.random() * 1.0
      }
      for (const l of lineas) {
        // cambio de tramo: avance largo <-> retroceso corto (escalones de índice)
        l.tramoRestante -= dt
        if (l.tramoRestante <= 0) {
          l.enRetroceso = !l.enRetroceso
          l.tramoRestante = l.enRetroceso
            ? 0.10 + Math.random() * 0.16
            : 0.30 + Math.random() * 0.45
        }
        const dir = l.sube ? -1 : 1 // arriba = y negativa
        const vy = l.enRetroceso ? -dir * l.pendiente * 0.9 : dir * l.pendiente
        l.x += l.vx * dt
        l.y += vy * dt + (Math.random() - 0.5) * 10 * dt
        l.puntos.push([l.x, l.y])
        if (l.puntos.length > l.maxPuntos) l.puntos.shift()
      }
      lineas = lineas.filter((l) => l.x - l.puntos.length * 4 < ancho + 60)
    }

    const dibujarLineas = () => {
      for (const l of lineas) {
        const n = l.puntos.length
        if (n < 3) continue
        // VERDE (sube) / rojo tenue (baja), como flecha de índice clásica
        const color = l.sube ? '96, 205, 130' : '192, 86, 63'
        // la cola se desvanece: dibujamos por tramos con alfa creciente
        for (let i = 1; i < n; i++) {
          const alfa = l.alfaMax * (i / n)
          ctx.beginPath()
          ctx.moveTo(l.puntos[i - 1][0], l.puntos[i - 1][1])
          ctx.lineTo(l.puntos[i][0], l.puntos[i][1])
          ctx.strokeStyle = `rgba(${color}, ${alfa.toFixed(3)})`
          ctx.lineWidth = 5.6
          ctx.stroke()
        }
        // PUNTA DE FLECHA en la cabeza, orientada hacia donde va
        const [hx, hy] = l.puntos[n - 1]
        const [px2, py2] = l.puntos[Math.max(0, n - 4)]
        const ang = Math.atan2(hy - py2, hx - px2)
        const tam = 16
        const alfaCabeza = Math.min(0.65, l.alfaMax * 2.6)
        ctx.beginPath()
        ctx.moveTo(hx + Math.cos(ang) * tam, hy + Math.sin(ang) * tam)
        ctx.lineTo(hx + Math.cos(ang + 2.55) * tam, hy + Math.sin(ang + 2.55) * tam)
        ctx.lineTo(hx + Math.cos(ang - 2.55) * tam, hy + Math.sin(ang - 2.55) * tam)
        ctx.closePath()
        ctx.fillStyle = `rgba(${color}, ${alfaCabeza.toFixed(3)})`
        ctx.fill()
      }
    }

    const cuadro = (t) => {
      const dt = Math.min(0.05, (t - ultimoT) / 1000)
      ultimoT = t
      ctx.clearRect(0, 0, ancho, alto)

      pasoLineas(dt)
      dibujarLineas()

      // luz que sigue el cursor (solo escritorio) — visible pero elegante,
      // y del color del nivel
      if (raton.activo && !esMovil) {
        const c = `${polvo.r}, ${polvo.g}, ${polvo.b}`
        const g = ctx.createRadialGradient(raton.x, raton.y, 0, raton.x, raton.y, 300)
        g.addColorStop(0, `rgba(${c}, 0.10)`)
        g.addColorStop(0.45, `rgba(${c}, 0.035)`)
        g.addColorStop(1, `rgba(${c}, 0)`)
        ctx.fillStyle = g
        ctx.fillRect(raton.x - 300, raton.y - 300, 600, 600)
      }

      for (const p of particulas) {
        // cerca del cursor: se apartan con suavidad y SE ENCIENDEN
        let cercania = 0 // 0 = lejos, 1 = pegada al cursor
        if (raton.activo) {
          const dx = p.x - raton.x
          const dy = p.y - raton.y
          const d2 = dx * dx + dy * dy
          if (d2 < 170 * 170 && d2 > 0.01) {
            const d = Math.sqrt(d2)
            cercania = (170 - d) / 170
            const fuerza = cercania * 42
            p.x += (dx / d) * fuerza * dt
            p.y += (dy / d) * fuerza * dt
          }
        }
        p.x += p.vx * dt
        p.y += p.vy * dt
        // reaparecen por el lado contrario (mundo continuo)
        if (p.y < -8) { p.y = alto + 8; p.x = Math.random() * ancho }
        if (p.x < -8) p.x = ancho + 8
        if (p.x > ancho + 8) p.x = -8

        let alfa = p.base * (0.55 + 0.45 * Math.sin(t / 1000 * p.parpadeo + p.fase))
        let radio = p.r
        if (cercania > 0) {
          // brillan más fuerte y un pelín más grandes junto al cursor
          alfa = Math.min(0.85, alfa + cercania * 0.55)
          radio = p.r * (1 + cercania * 0.8)
        }
        ctx.beginPath()
        ctx.arc(p.x, p.y, radio, 0, Math.PI * 2)
        // el color del nivel se aclara cuando están encendidas junto al cursor
        ctx.fillStyle = cercania > 0.15
          ? `rgba(${polvoClaro.r}, ${polvoClaro.g}, ${polvoClaro.b}, ${alfa.toFixed(3)})`
          : `rgba(${polvo.r}, ${polvo.g}, ${polvo.b}, ${alfa.toFixed(3)})`
        ctx.fill()
      }
      rafId = requestAnimationFrame(cuadro)
    }

    const alMover = (ev) => {
      raton.x = ev.clientX
      raton.y = ev.clientY
      raton.activo = true
    }
    const alSalir = () => { raton.activo = false }
    const alVisibilidad = () => {
      if (document.hidden) {
        if (rafId) cancelAnimationFrame(rafId)
        rafId = null
      } else if (!rafId) {
        ultimoT = performance.now()
        rafId = requestAnimationFrame(cuadro)
      }
    }
    const alRedimensionar = () => { redimensionar() }

    redimensionar()
    crearParticulas()
    rafId = requestAnimationFrame(cuadro)
    window.addEventListener('mousemove', alMover, { passive: true })
    window.addEventListener('mouseout', alSalir)
    window.addEventListener('resize', alRedimensionar)
    document.addEventListener('visibilitychange', alVisibilidad)
    // al cambiar de nivel, el polvo se re-tiñe (mismo evento que usa useNivel)
    window.addEventListener('alto-nivel-cambio', aplicarColorNivel)
    window.addEventListener('storage', aplicarColorNivel)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', alMover)
      window.removeEventListener('mouseout', alSalir)
      window.removeEventListener('resize', alRedimensionar)
      document.removeEventListener('visibilitychange', alVisibilidad)
      window.removeEventListener('alto-nivel-cambio', aplicarColorNivel)
      window.removeEventListener('storage', aplicarColorNivel)
    }
  }, [])

  return <canvas ref={ref} className="fondo-vivo" aria-hidden="true" />
}
