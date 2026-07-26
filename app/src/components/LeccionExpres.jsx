import { useEffect, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────
// 🐣 LA LECCIÓN EXPRÉS (mejora #135 del plan educativo, Parte IV §29)
// El momento de abandono #1 de toda la app era la puerta de niveles: le
// preguntaba al usuario cero "¿qué tan metido estás en esto?" sobre algo que
// todavía no sabe qué es. Esta es la otra puerta: siete tarjetas de quince
// segundos que responden las preguntas invisibles que NADIE hace en voz alta
// y que, sin responder, hacen que se vaya en el minuto uno:
//   1. ¿qué es invertir, en criollo?  (pedido de Jair, 24-jul: la lección
//      arrancaba en "¿qué es una acción?" y se saltaba el verbo. El que nunca
//      invirtió no sabe todavía en qué se diferencia de ahorrar.)
//   2. ¿qué es una acción?          (invisible #1)
//   3. ¿a dónde va mi plata?        (invisible #2 — la de MECANISMO)
//   4. ¿qué es un dividendo?        (invisible #6: ganar ≠ cobrar dividendo)
//   5. ¿esto es tradear?            (pedido de Jair, 24-jul: la palabra que el
//      usuario cero ya escuchó en TikTok y que NO era ALTO en ningún lado;
//      el plan la marca como riesgo: "educamos ciclos, no trading", §1323.)
//   6. ¿dónde compro?               (agujero #139: la respuesta es "en una SAB")
//   7. ¿esto es apostar?            (invisible #13 — la identidad de ALTO)
// Regla de la casa: no se promete, no se recomienda, no se esconde el riesgo.
// La última tarjeta dice "puedes perder" en letra grande a propósito.
// ─────────────────────────────────────────────────────────────────────────

export const CLAVE_LECCION = 'alto-leccion-expres'
// 🔖 Dónde se quedó quien la EMPEZÓ y la cerró a medias. Sin esto, cerrar
// costaba las tarjetas ya leídas y volver a empezar era el castigo por
// asomarse — el usuario cero no vuelve dos veces a la misma pantalla.
export const CLAVE_PASO = 'alto-leccion-paso'

export function leccionVista() {
  try { return localStorage.getItem(CLAVE_LECCION) === '1' } catch { return false }
}
export function marcarLeccionVista() {
  try {
    localStorage.setItem(CLAVE_LECCION, '1')
    localStorage.removeItem(CLAVE_PASO) // terminada: el marcador ya no sirve
  } catch { /* incógnito */ }
}
/** En qué tarjeta se quedó (0 si nunca empezó o si ya la terminó). */
export function pasoLeccion() {
  try {
    if (leccionVista()) return 0
    const n = parseInt(localStorage.getItem(CLAVE_PASO) ?? '0', 10)
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch { return 0 }
}
function guardarPaso(n) {
  try {
    if (leccionVista()) return // repaso desde el ☰: no hay nada que retomar
    if (n > 0) localStorage.setItem(CLAVE_PASO, String(n))
    else localStorage.removeItem(CLAVE_PASO)
  } catch { /* incógnito */ }
}

const TARJETAS = [
  {
    icono: '🌱',
    titulo: '¿Qué es invertir?',
    cuerpo: (
      <>
        Es <strong>poner tu plata a trabajar en un negocio</strong> en vez de tenerla quieta.
        Mil soles guardados en el cajón siguen siendo mil soles el próximo año, pero compran
        menos, porque todo subió de precio. Invertir es entregarlos a una empresa que produce y
        vende, para quedarte con una parte de lo que gane. La diferencia con ahorrar es una sola:
        aquí <strong>no hay nada garantizado</strong>.
      </>
    ),
    pie: 'Ahorrar cuida lo que ya tienes. Invertir arriesga una parte para que crezca. Se necesitan las dos.',
  },
  {
    icono: '🧩',
    titulo: '¿Qué es una acción?',
    cuerpo: (
      <>
        Un <strong>pedacito de una empresa de verdad</strong>. Si compras una acción de Alicorp,
        eres dueño de una parte chiquita de Alicorp: de sus fábricas, de sus marcas y de lo que
        gane. Chiquita en serio — Alicorp tiene cientos de millones de acciones.
      </>
    ),
    pie: 'Por eso ALTO te hace mirar la EMPRESA, no el gráfico: estás comprando el negocio.',
  },
  {
    icono: '💵',
    titulo: '¿A dónde va tu plata?',
    cuerpo: (
      <>
        Casi nunca va a la empresa. En la Bolsa le compras la acción{' '}
        <strong>a otra persona</strong> que la tenía y la quiere vender — como un mercado de
        segunda mano, pero vigilado. La empresa recibe plata solo cuando emite acciones nuevas,
        que pasa cada muchos años.
      </>
    ),
    pie: 'Precio = lo que alguien está dispuesto a pagar hoy. Nada más, y nada menos.',
  },
  {
    icono: '🎁',
    titulo: '¿Qué es un dividendo? (y las dos formas de ganar)',
    cuerpo: (
      <>
        <strong>Que suba el precio:</strong> ganas en papel; recién es plata cuando vendes.{' '}
        <strong>El dividendo:</strong> la empresa reparte entre sus dueños parte de la ganancia
        del año y te llega a la cuenta, sin vender nada — es tu pedacito de lo que ganó. Ojo con
        esto: el dividendo{' '}
        <strong>no es una tasa fija como un plazo fijo del banco</strong> — la empresa decide
        cada año cuánto reparte, y puede repartir menos, o nada.
      </>
    ),
    pie: 'Cuando veas «rinde 4% al año» en ALTO, es lo que pagó, no lo que promete pagar.',
  },
  {
    icono: '⏱️',
    titulo: 'Invertir no es tradear',
    cuerpo: (
      <>
        <strong>Tradear</strong> (o «hacer trading») es comprar y vender rápido —en días, horas o
        minutos— apostando a que el precio se mueva a tu favor. Al que tradea no le importa qué
        hace la empresa: le importa el gráfico. <strong>Invertir</strong> es comprarte un pedazo
        de un negocio y quedarte años mientras ese negocio crece y reparte. Se ven igual en la
        pantalla y no se parecen en nada: uno estudia el precio, el otro estudia la empresa.
      </>
    ),
    pie: 'ALTO es para lo segundo. Aquí no hay velas, ni señales, ni «entra ahora»: hay balances.',
  },
  {
    icono: '🏦',
    titulo: 'Aquí no se compra',
    cuerpo: (
      <>
        ALTO no vende acciones ni ejecuta órdenes, y no gana nada con lo que decidas. Para
        comprar de verdad necesitas una <strong>SAB</strong> (Sociedad Agente de Bolsa): abres
        cuenta, transfieres tu plata y das la orden; te cobra una comisión por operación.
      </>
    ),
    pie: 'Lo decimos con orgullo: aquí se DECIDE, allá se ejecuta. Son dos oficios distintos.',
  },
  {
    icono: '⚠️',
    titulo: 'Puedes perder. Por eso se estudia.',
    cuerpo: (
      <>
        Una acción puede bajar y no volver. Comprar porque «alguien dijo que iba a subir» es
        apostar, y no lo vamos a maquillar. Lo que cambia el juego es entender qué hace la
        empresa, cómo gana y cuánto debe — que es exactamente lo que vas a hacer en los próximos
        minutos.
      </>
    ),
    pie: 'ALTO no recomienda comprar ni vender. Te enseña a mirar, y tú decides.',
  },
]

export const TOTAL_TARJETAS = TARJETAS.length

/**
 * @param onFin     terminó las 5 (marca vista)
 * @param onSaltar  "Saltar": no quiere leerla y quiere entrar YA (marca vista)
 * @param onCerrar  la ✕ / Esc: se sale sin marcarla vista, guardando el avance
 * @param onAtras   volver a la pantalla anterior desde la tarjeta 1 (bienvenida)
 * @param retomar   arrancar donde la dejó (entrada sí, repaso desde el ☰ no)
 */
export default function LeccionExpres({ onFin, onSaltar, onCerrar, onAtras, retomar }) {
  const [i, setI] = useState(() => (retomar ? Math.min(pasoLeccion(), TARJETAS.length - 1) : 0))
  const t = TARJETAS[i]
  const ultima = i === TARJETAS.length - 1

  // Cerrar sin terminar: se guarda la tarjeta para volver justo aquí.
  const cerrar = () => { guardarPaso(i); (onCerrar ?? onSaltar ?? onFin)() }
  const atras = () => { if (i === 0) { if (onAtras) { guardarPaso(0); onAtras() } } else setI(i - 1) }

  // Teclado: ← → pasan las tarjetas y Esc cierra (sin tocar el mouse).
  useEffect(() => {
    const al = (e) => {
      if (e.key === 'ArrowRight') setI((v) => Math.min(TARJETAS.length - 1, v + 1))
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1))
      if (e.key === 'Escape') cerrar()
    }
    window.addEventListener('keydown', al)
    return () => window.removeEventListener('keydown', al)
  })

  const terminar = () => { marcarLeccionVista(); onFin() }

  return (
    <div className="leccion">
      <div className="leccion-inner">
        <div className="leccion-cab">
          <span className="kicker">Lección exprés · {TARJETAS.length} tarjetas de 15 segundos</span>
          <div className="leccion-cab-acciones">
            {/* "Saltar" = no la quiero leer, entro ya. La ✕ = me salgo, pero
                lo leído queda guardado. Son dos intenciones distintas. */}
            {onSaltar && (
              <button className="leccion-saltar" onClick={() => { marcarLeccionVista(); onSaltar() }}>
                Saltar
              </button>
            )}
            {(onCerrar || onSaltar) && (
              <button className="leccion-cerrar" onClick={cerrar} aria-label="Cerrar la lección" title="Cerrar (Esc)">
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="leccion-puntos" aria-hidden="true">
          {TARJETAS.map((x, n) => (
            <span key={x.titulo} className={'leccion-punto' + (n <= i ? ' on' : '')} />
          ))}
        </div>

        {/* key: reinicia la animación de entrada en cada tarjeta */}
        <div className="leccion-card" key={i}>
          <div className="leccion-icono" aria-hidden="true">{t.icono}</div>
          <h2 className="leccion-titulo">{t.titulo}</h2>
          <p className="leccion-cuerpo">{t.cuerpo}</p>
          <p className="leccion-pie">{t.pie}</p>
        </div>

        <div className="leccion-nav">
          <button
            className="btn btn-fantasma"
            onClick={atras}
            disabled={i === 0 && !onAtras}
          >
            ← Atrás
          </button>
          <span className="muted leccion-conteo">{i + 1} de {TARJETAS.length}</span>
          {ultima ? (
            <button className="btn" onClick={terminar}>Listo — entrar a ALTO →</button>
          ) : (
            <button className="btn" onClick={() => setI((v) => v + 1)}>Siguiente →</button>
          )}
        </div>
      </div>
    </div>
  )
}
