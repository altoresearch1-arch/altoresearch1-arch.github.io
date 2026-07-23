import { useEffect, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────
// 🐣 LA LECCIÓN EXPRÉS (mejora #135 del plan educativo, Parte IV §29)
// El momento de abandono #1 de toda la app era la puerta de niveles: le
// preguntaba al usuario cero "¿qué tan metido estás en esto?" sobre algo que
// todavía no sabe qué es. Esta es la otra puerta: cinco tarjetas de quince
// segundos que responden las cuatro preguntas invisibles que NADIE hace en
// voz alta y que, sin responder, hacen que se vaya en el minuto uno:
//   1. ¿qué es una acción?          (invisible #1)
//   2. ¿a dónde va mi plata?        (invisible #2 — la de MECANISMO)
//   3. ¿ganar es lo mismo que cobrar dividendo?  (invisible #6)
//   4. ¿dónde compro?               (agujero #139: la respuesta es "en una SAB")
//   5. ¿esto es apostar?            (invisible #13 — la identidad de ALTO)
// Regla de la casa: no se promete, no se recomienda, no se esconde el riesgo.
// La quinta tarjeta dice "puedes perder" en letra grande a propósito.
// ─────────────────────────────────────────────────────────────────────────

export const CLAVE_LECCION = 'alto-leccion-expres'

export function leccionVista() {
  try { return localStorage.getItem(CLAVE_LECCION) === '1' } catch { return false }
}
export function marcarLeccionVista() {
  try { localStorage.setItem(CLAVE_LECCION, '1') } catch { /* incógnito */ }
}

const TARJETAS = [
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
    titulo: 'Hay dos formas de ganar — y no son iguales',
    cuerpo: (
      <>
        <strong>Que suba el precio:</strong> ganas en papel; recién es plata cuando vendes.{' '}
        <strong>El dividendo:</strong> la empresa reparte parte de su ganancia y te llega a la
        cuenta, sin vender nada. Ojo con esto: el dividendo{' '}
        <strong>no es una tasa fija como un plazo fijo del banco</strong> — la empresa decide
        cada año cuánto reparte, y puede repartir menos, o nada.
      </>
    ),
    pie: 'Cuando veas «rinde 4% al año» en ALTO, es lo que pagó, no lo que promete pagar.',
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

export default function LeccionExpres({ onFin, onSaltar }) {
  const [i, setI] = useState(0)
  const t = TARJETAS[i]
  const ultima = i === TARJETAS.length - 1

  // Flechas del teclado: la lección se puede pasar sin tocar el mouse.
  useEffect(() => {
    const al = (e) => {
      if (e.key === 'ArrowRight') setI((v) => Math.min(TARJETAS.length - 1, v + 1))
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1))
    }
    window.addEventListener('keydown', al)
    return () => window.removeEventListener('keydown', al)
  }, [])

  const terminar = () => { marcarLeccionVista(); onFin() }

  return (
    <div className="leccion">
      <div className="leccion-inner">
        <div className="leccion-cab">
          <span className="kicker">Lección exprés · 5 tarjetas de 15 segundos</span>
          {onSaltar && (
            <button className="leccion-saltar" onClick={() => { marcarLeccionVista(); onSaltar() }}>
              Saltar
            </button>
          )}
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
            onClick={() => setI((v) => Math.max(0, v - 1))}
            disabled={i === 0}
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
