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
        {/* El logo respira con el mismo aura dorada del inicio (auraLogo). La
            puerta de entrada tenía una moneda apagada de 56 px mientras el
            fondo se movía detrás: se veía como una pantalla de sistema, no
            como la portada de ALTO. */}
        <div className="bienvenida-moneda">
          <img
            className="nivel-gate-logo"
            src={`${import.meta.env.BASE_URL}logo-alto.jpg`}
            alt="ALTO Research"
          />
        </div>
        <div className="kicker">ALTO Research</div>
        <h1>
          Aquí se aprende a estudiar <span className="oro">empresas de la Bolsa de Lima</span>
        </h1>
        <p className="lead bienvenida-lead">
          Acá no se compra nada ni se recomienda nada, y no cuesta. Son 115 empresas peruanas con
          sus números oficiales, explicados en criollo.
        </p>

        {/* La pregunta en voz alta (pedido de Jair, 24-jul). Antes las dos
            puertas estaban ahí sueltas y había que deducir que eran una
            pregunta; decirla convierte el par de botones en una respuesta.
            Y desde el 25-jul son TRES, porque «primera vez: sí o no» dejaba
            fuera a la mayoría real: el que ha leído del tema, escuchó mil
            veces la palabra y nunca entendió bien. Ese no es un novato ni un
            experto, y mandarlo a cualquiera de los dos lados se siente mal.
            Las tres puertas llevan a sitios distintos: la conversación desde
            cero, la conversación arrancando un escalón más arriba, o los
            niveles de una vez. */}
        <p className="bienvenida-pregunta">¿Has invertido alguna vez?</p>

        <div className="bienvenida-puertas">
          <button className="bienvenida-puerta principal" onClick={() => onNovato('cero')}>
            <span className="bienvenida-icono" aria-hidden="true">🐣</span>
            <span className="bienvenida-nombre">
              {paso > 0
                ? 'Sigue donde te quedaste'
                : 'No, nunca — y por eso estoy aquí'}
            </span>
            <span className="bienvenida-frase">
              {paso > 0 ? (
                <>
                  Dejaste la lección en la tarjeta {paso + 1} de {TOTAL_TARJETAS}. Retomas ahí
                  mismo, no desde el principio.
                </>
              ) : (
                <>
                  Hablamos de cosas que ya escuchaste: el dólar, el cobre, Bitcoin. Si algo no lo
                  conoces, te lo cuento y seguimos.
                </>
              )}
            </span>
          </button>
          <button className="bienvenida-puerta" onClick={() => onNovato('medias')}>
            <span className="bienvenida-icono" aria-hidden="true">🌗</span>
            <span className="bienvenida-nombre">Más o menos, pero nunca lo entendí bien</span>
            <span className="bienvenida-frase">
              La misma conversación, saltándose lo obvio: empieza donde se te traba.
            </span>
          </button>
          <button className="bienvenida-puerta" onClick={onYaSe}>
            <span className="bienvenida-icono" aria-hidden="true">🎚️</span>
            <span className="bienvenida-nombre">Sí, ya invierto</span>
            <span className="bienvenida-frase">
              Eliges nivel y la app entera se acomoda, hasta los documentos de la SMV.
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
