import { NIVELES } from '../lib/nivel'

// Puerta de entrada obligatoria: se muestra UNA sola vez (hasta que elija),
// antes de dejar ver el resto de la app. Pedido de Jair.
export default function SelectorNivel({ onElegir }) {
  return (
    <div className="nivel-gate">
      <div className="nivel-gate-inner">
        <img
          className="nivel-gate-logo"
          src={`${import.meta.env.BASE_URL}logo-alto.jpg`}
          alt="ALTO Research"
        />
        <div className="kicker">ALTO Research</div>
        <h1>¿Qué tan metido estás en esto?</h1>
        <p className="lead">
          Elige lo que más te suena — así te mostramos solo lo que te sirve.
          Puedes cambiarlo cuando quieras.
        </p>
        <div className="nivel-cards">
          {NIVELES.map((n) => (
            <button key={n.id} className="nivel-card" onClick={() => onElegir(n.id)}>
              <span className="nivel-card-icono">{n.icono}</span>
              <span className="nivel-card-nombre">{n.nombre}</span>
              <span className="nivel-card-frase">{n.frase}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
