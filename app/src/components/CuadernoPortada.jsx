import { useMemo } from 'react'
import { useCartera, filasDe, proyecciones, fmtS, fechaCorta } from '../lib/cartera'

// ─────────────────────────────────────────────────────────────────────────
// 📓 LA PUERTA DEL CUADERNO en el inicio — llamativa a propósito (pedido de
// Jair 17-jul): borde dorado que respira, y el contenido cambia según el
// usuario. Sin cartera: la invitación ("estrénalo"). Con cartera: su
// patrimonio ya calculado y el próximo dividendo — el inicio lo saluda
// con SUS números.
// ─────────────────────────────────────────────────────────────────────────
export default function CuadernoPortada({ onAbrir }) {
  const cartera = useCartera()
  const resumen = useMemo(() => {
    if (!cartera.length) return null
    const { filas, totalValor, ganTotal } = filasDe(cartera)
    const prox = proyecciones(filas)[0] || null
    return { totalValor, ganTotal, prox, n: cartera.length }
  }, [cartera])

  return (
    <button className="card cuaderno-portada" onClick={onAbrir} data-tour="cuaderno">
      <span className="cp-brillo" aria-hidden="true" />
      <div className="cp-icono" aria-hidden="true">📓</div>
      {!resumen ? (
        <div className="cp-cuerpo">
          <div className="cp-titulo">Mi Cuaderno <span className="nav-beta">nuevo</span></div>
          <div className="cp-texto">
            Anota tus acciones y el cuaderno las cuida solo: precio de hoy, tu ganancia,
            próximos dividendos y las noticias de TUS empresas. 🛰 Hasta puede
            <b> leer la captura de tu broker</b> — todo en tu equipo, sin cuentas.
          </div>
          <div className="cp-cta">Estrenar mi cuaderno →</div>
        </div>
      ) : (
        <div className="cp-cuerpo">
          <div className="cp-titulo">Mi Cuaderno</div>
          <div className="cp-numeros">
            <span className="cp-patrimonio">{fmtS(resumen.totalValor)}</span>
            <span className={'cp-gan ' + (resumen.ganTotal >= 0 ? 'pos' : 'neg')}>
              {resumen.ganTotal >= 0 ? '▲ +' : '▼ '}{resumen.ganTotal.toFixed(1)}%
            </span>
          </div>
          <div className="cp-texto">
            {resumen.n} empresa{resumen.n === 1 ? '' : 's'}
            {resumen.prox && <> · próximo dividendo ~{fechaCorta(resumen.prox.fecha)}: <b>{resumen.prox.t}</b>, {fmtS(resumen.prox.soles)} para ti</>}
          </div>
          <div className="cp-cta">Abrir mi cuaderno →</div>
        </div>
      )}
    </button>
  )
}
