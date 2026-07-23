import { leccionVista, pasoLeccion, TOTAL_TARJETAS } from './LeccionExpres'

// ─────────────────────────────────────────────────────────────────────────
// 🐣 «¿ERES NUEVO? ¿NO ENTENDISTE ALGO? MÍRALO DE NUEVO» (pedido de Jair)
// La Lección Exprés quedaba reabrible SOLO desde el menú ☰, y el ☰ es
// justamente el sitio donde no mira quien no entendió nada: el que se pierde
// no va a buscar en un menú, se va. Así que la puerta de vuelta se pone a la
// vista, en el inicio, y dice las dos razones para volver — la del que recién
// llega y la del que ya anduvo un rato y se atoró.
// El texto cambia según en qué está el usuario, porque no es lo mismo
// ofrecerle "otra vez" a quien nunca la abrió que a quien la dejó a medias.
// ─────────────────────────────────────────────────────────────────────────
export default function RepasoLeccion({ onAbrir }) {
  const vista = leccionVista()
  const paso = pasoLeccion()

  const titulo = vista
    ? '¿No entendiste algo?'
    : paso > 0
      ? 'Dejaste la lección a medias'
      : '¿Eres nuevo por aquí?'

  const cuerpo = vista ? (
    <>
      Vuelve a las cinco tarjetas cuando quieras. Nadie entiende todo la primera vez, y
      releer no es retroceder: es como se aprende esto.
    </>
  ) : paso > 0 ? (
    <>
      Te quedaste en la tarjeta {paso + 1} de {TOTAL_TARJETAS}. Retomas ahí mismo, no desde
      el principio.
    </>
  ) : (
    <>
      Cinco tarjetas de 15 segundos: qué es una acción, a dónde va tu plata, las dos formas
      de ganar y por qué aquí no se compra.
    </>
  )

  return (
    <div className="repaso-leccion" data-tour="repaso-leccion">
      <span className="repaso-leccion-icono" aria-hidden="true">🐣</span>
      <div className="repaso-leccion-txt">
        <strong>{titulo}</strong>
        <span className="muted"> {cuerpo}</span>
      </div>
      <button className="btn btn-fantasma repaso-leccion-btn" onClick={onAbrir}>
        {vista ? 'Míralo de nuevo' : paso > 0 ? 'Seguir la lección' : 'Ver la lección'} →
      </button>
    </div>
  )
}
