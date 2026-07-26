import { progresoPlan, PLAN, paso as pasoDelPlan } from '../lib/enganche'

// ─────────────────────────────────────────────────────────────────────────
// 📋 EL PLAN PARA NUEVO INVERSOR, EN EL INICIO (pedido de Jair, 25-jul)
// Antes esto vivía SOLO dentro del ☰ y se llamaba «¿Qué has escuchado?».
// Dos problemas en una sola línea: el ☰ es donde no mira el que recién llega
// (el que se pierde no abre menús, se va), y el nombre describía la mecánica
// —hacer preguntas— en vez de decir para qué sirve. Nadie abre una app para
// que le pregunten cosas; sí la abre por un plan para empezar a invertir.
// Así que se saca del menú, se pone a la vista del inicio como está
// «Explícamelo», y se llama por lo que es.
//
// La tarjeta cambia según en qué va, porque no es lo mismo ofrecerle empezar
// a quien nunca lo abrió que a quien lleva 5 de 8 pasos ganados.
// ─────────────────────────────────────────────────────────────────────────
export default function PlanInversor({ onAbrir, onVerPlan }) {
  const { ganados, total, completo, empezado, siguiente } = progresoPlan()
  const paso = siguiente ? pasoDelPlan(siguiente) : null

  const titulo = completo
    ? 'Tienes el plan completo'
    : ganados > 0
      ? `Tu plan va ${ganados} de ${total}`
      : 'Plan para nuevo inversor'

  const cuerpo = completo ? (
    <>
      Los {total} pasos ganados. Ábrelo cuando quieras: cada paso trae la frase con la que tú lo
      reconociste y cómo se mueve en el mercado.
    </>
  ) : ganados > 0 ? (
    <>
      Te falta <strong>{paso?.titulo}</strong> y {total - ganados - 1 > 0 ? `${total - ganados - 1} más` : 'nada más'}.
      Se gana como los otros: reconociendo una frase que ya escuchaste por ahí.
    </>
  ) : (
    <>
      Las <strong>{total} preguntas</strong> que le puedes hacer a cualquier empresa de la bolsa,
      aprendidas con cosas que ya escuchaste: un titular, algo de TikTok, una frase de tu casa.
      {empezado && ' Retomas donde ibas.'}
    </>
  )

  return (
    <div className="plan-inversor" data-tour="plan-inversor">
      <div className="plan-inversor-cab">
        <span className="plan-inversor-icono" aria-hidden="true">📋</span>
        <div className="plan-inversor-txt">
          <strong>{titulo}</strong>
          <span className="muted"> {cuerpo}</span>
        </div>
      </div>

      {/* Los 8 ladrillos: el mismo dibujo que ve dentro de la conversación, así
          que el inicio y el plan hablan el mismo idioma. */}
      <div className="plan-inversor-fila" aria-label={`${ganados} de ${total} pasos`}>
        {PLAN.map((p, i) => (
          <span
            key={p.id}
            className={'eng-ladrillo' + (i < ganados ? ' on' : '')}
            title={p.titulo}
          >
            {i < ganados ? p.icono : ''}
          </span>
        ))}
      </div>

      <div className="plan-inversor-nav">
        {!completo && (
          <button className="btn btn-oro" onClick={onAbrir}>
            {ganados > 0 ? 'Seguir el plan' : 'Empezar el plan'} →
          </button>
        )}
        {(completo || ganados > 0) && (
          <button className={'btn' + (completo ? ' btn-oro' : ' btn-fantasma')} onClick={onVerPlan}>
            Ver mi plan
          </button>
        )}
      </div>
    </div>
  )
}
