import { NIVELES } from '../lib/nivel'

// Puerta de entrada obligatoria: se muestra UNA sola vez (hasta que elija),
// antes de dejar ver el resto de la app. Pedido de Jair.
// v2 (15-jul): cada tarjeta lleva la identidad de su nivel (color de acento,
// "NIVEL N DE 4" porque ES una escalera real, y chips de lo que desbloquea;
// del 2 en adelante se suma a lo anterior). Entrada escalonada en CSS puro.
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
          Elige lo que más te suena — la app entera se acomoda a tu nivel.
        </p>
        <div className="nivel-cards">
          {NIVELES.map((n, i) => (
            <button
              key={n.id}
              className="nivel-card"
              style={{ '--nivel-color': n.color, '--i': i }}
              onClick={() => onElegir(n.id)}
            >
              <span className="nivel-card-cab">
                <span className="nivel-card-icono" aria-hidden="true">{n.icono}</span>
                <span className="nivel-card-num">Nivel {n.id} de 4</span>
              </span>
              <span className="nivel-card-nombre">{n.nombre}</span>
              <span className="nivel-card-frase">{n.frase}</span>
              <span className="nivel-card-incluye">
                {n.id > 1 && <span className="nivel-chip suma">todo lo anterior +</span>}
                {n.incluye.slice(0, 3).map((x) => (
                  <span key={x} className="nivel-chip">{x}</span>
                ))}
              </span>
            </button>
          ))}
        </div>
        <p className="nivel-gate-pie muted">
          Puedes cambiarlo cuando quieras desde el botón 🎚️ de arriba.
        </p>
      </div>
    </div>
  )
}
