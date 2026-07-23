// ─────────────────────────────────────────────────────────────────────────
// 🚪 LA BIENVENIDA (mejora #135 — Parte IV §29, "los primeros 5 minutos")
// Lo que había antes: SelectorNivel de frente, preguntando "¿qué tan metido
// estás en esto?". Es el momento de abandono #1 del análisis: le pide al que
// nunca invirtió que se autoevalúe en algo que todavía no sabe qué es, y de
// paso le esconde de qué se trata la app hasta DESPUÉS de contestar.
// Lo que hay ahora: primero se dice qué es esto en una frase, y recién luego
// se abren dos caminos — el 🐣 (lección exprés y adentro, en nivel Aprender) y
// el de quien ya sabe (ahí sí, las 4 tarjetas de nivel de siempre, intactas).
// La puerta de niveles no desaparece: se MUEVE al final del primer recorrido,
// cuando el usuario ya sabe qué está eligiendo (ver PuertaTardia.jsx).
// ─────────────────────────────────────────────────────────────────────────
import { pasoLeccion, TOTAL_TARJETAS } from './LeccionExpres'

export default function Bienvenida({ onNovato, onYaSe, onMirar }) {
  // Si ya empezó la lección y se salió, el 🐣 no le pide volver a empezar.
  const paso = pasoLeccion()
  return (
    <div className="nivel-gate">
      <div className="nivel-gate-inner bienvenida">
        <img
          className="nivel-gate-logo"
          src={`${import.meta.env.BASE_URL}logo-alto.jpg`}
          alt="ALTO Research"
        />
        <div className="kicker">ALTO Research</div>
        <h1>Aquí se aprende a estudiar empresas de la Bolsa de Lima</h1>
        <p className="lead bienvenida-lead">
          No se compra, no se recomienda, no cuesta. Son 115 empresas peruanas con sus números
          oficiales, explicados en criollo.
        </p>

        <div className="bienvenida-puertas">
          <button className="bienvenida-puerta principal" onClick={onNovato}>
            <span className="bienvenida-icono" aria-hidden="true">🐣</span>
            <span className="bienvenida-nombre">
              {paso > 0
                ? 'Sigue donde te quedaste'
                : 'Nunca he invertido — empieza aquí'}
            </span>
            <span className="bienvenida-frase">
              {paso > 0 ? (
                <>
                  Dejaste la lección en la tarjeta {paso + 1} de {TOTAL_TARJETAS}. Retomas ahí
                  mismo, no desde el principio.
                </>
              ) : (
                <>
                  Cinco tarjetas de 15 segundos y entras. Qué es una acción, a dónde va tu plata y
                  por qué aquí no se compra.
                </>
              )}
            </span>
          </button>
          <button className="bienvenida-puerta" onClick={onYaSe}>
            <span className="bienvenida-icono" aria-hidden="true">🎚️</span>
            <span className="bienvenida-nombre">Ya sé algo de esto</span>
            <span className="bienvenida-frase">
              Elige tu nivel y la app entera se acomoda: de «cuánto podría ganar» hasta
              documentos de la SMV.
            </span>
          </button>
        </div>

        {/* La tercera salida: el que no quiere contestar NADA tampoco debería
            quedarse afuera. Entra en «Aprender» y cambia con el 🎚️ si quiere. */}
        {onMirar && (
          <button className="bienvenida-mirar" onClick={onMirar}>
            Solo quiero mirar la app →
          </button>
        )}

        <p className="nivel-gate-pie muted">
          Sea cual sea el camino, puedes cambiar de nivel cuando quieras con el 🎚️ de arriba.
        </p>
      </div>
    </div>
  )
}
