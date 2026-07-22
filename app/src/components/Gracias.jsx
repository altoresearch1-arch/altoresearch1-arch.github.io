import config from '../data/config.json'
import PixelAvatar from './PixelAvatar'

// Nombres SOLO para mostrar cómo se verá el muro cuando aún no hay donantes.
// El muro real sale de config.muroApoyo.nombres.
const EJEMPLO_MURO = ['Jair', 'María L.', 'Carlos R.', 'Ana P.', 'Diego', 'Lucía']

// 💛 PESTAÑA GRACIAS / APOYO (pedido de Jair 10-jul): qué logras al apoyar
// (agradecimiento, NO un beneficio de inversión) + "lo que viene" (roadmap
// editable en config.json). El botón de donar reusa el ApoyoModal ya existente
// (Yape + PayPal), que la app abre vía onApoyar. SIN backend ni cuentas.

// Regla de oro (heredada del ApoyoModal): apoyar es una DONACIÓN VOLUNTARIA al
// contenido educativo. La "recompensa" es simbólica (un gracias) — nunca
// desbloquea datos secretos, señales de compra/venta ni asesoría.

const ETIQUETA_ESTADO = {
  trabajando: { texto: 'En marcha', clase: 'trabajando' },
  pronto: { texto: 'Pronto', clase: 'pronto' },
  idea: { texto: 'A pedido', clase: 'idea' },
}

export default function Gracias({ onApoyar }) {
  const roadmap = config.roadmap?.items || []
  const muro = config.muroApoyo?.nombres || []
  const recompensas = config.apoyo?.beneficios || []
  const urgente = config.apoyo?.urgente

  const irAComentarios = () => { location.hash = '#/comentarios' }

  return (
    <div className="gracias">
      {/* Cabecera + agradecimiento */}
      <div className="card gracias-hero">
        <div className="gracias-corazon">💛</div>
        <h1 style={{ marginTop: 0 }}>Gracias por estar aquí</h1>
        <p className="muted">
          ALTO Research es gratis y se construye contigo. Si te ayuda a entender mejor la
          bolsa y quieres que crezca más rápido, puedes apoyarla con lo que gustes. Es
          totalmente voluntario — y cada aporte se va directo a mejorar la app.
        </p>
        <div className="gracias-acciones">
          <button className="btn btn-oro" onClick={onApoyar}>💛 Apoyar la app</button>
          <button className="btn" onClick={irAComentarios}>💬 Dejar una idea</button>
        </div>
      </div>

      {/* 🔥 URGENTE: a dónde va HOY cada aporte (pedido de Jair) */}
      {urgente && (
        <div className="card gracias-urgente">
          <div className="gracias-urgente-cab">
            <span className="gracias-urgente-fuego">🔥</span>
            <div>
              <div className="gracias-urgente-etiqueta">Urgente</div>
              <h2 className="gracias-urgente-tit">{urgente.titulo}</h2>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>{urgente.texto}</p>
          <div className="gracias-urgente-lista">
            {(urgente.puntos || []).map((p, i) => (
              <div key={i} className="gracias-urgente-punto">
                <span className="gracias-urgente-icono">{p.icono}</span>
                <span>{p.texto}</span>
              </div>
            ))}
          </div>
          <div className="gracias-acciones">
            <button className="btn btn-oro" onClick={onApoyar}>💛 Donar y hacerlo posible</button>
          </div>
        </div>
      )}

      {/* Qué logras al apoyar (recompensa simbólica) */}
      <div className="card">
        <h2 className="gracias-h2">¿Y si apoyas? Esto es lo que gana la comunidad</h2>
        <div className="gracias-recompensas">
          {recompensas.map((r) => (
            <div key={r.titulo} className="recompensa">
              <div className="recompensa-icono">{r.icono}</div>
              <div>
                <div className="recompensa-titulo">{r.titulo}</div>
                <div className="muted recompensa-texto">{r.texto}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="gracias-legal">
          Apoyar es una <strong>donación voluntaria</strong> al contenido educativo, no un
          pago por recomendación de inversión ni asesoría. El «gracias» es simbólico: no
          desbloquea datos secretos ni señales de compra o venta. Todos ven lo mismo.
        </p>
      </div>

      {/* Lo que viene (roadmap) */}
      {roadmap.length > 0 && (
        <div className="card">
          <h2 className="gracias-h2">🚀 Lo que viene</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            En esto estamos trabajando o queremos construir. Tu apoyo hace que llegue antes.
          </p>
          <div className="roadmap">
            {roadmap.map((it, i) => {
              const est = ETIQUETA_ESTADO[it.estado] || ETIQUETA_ESTADO.idea
              return (
                <div key={i} className="roadmap-item">
                  <div className="roadmap-icono">{it.icono}</div>
                  <div className="roadmap-cuerpo">
                    <div className="roadmap-cab">
                      <span className="roadmap-titulo">{it.titulo}</span>
                      <span className={'roadmap-estado ' + est.clase}>{est.texto}</span>
                    </div>
                    <div className="muted roadmap-texto">{it.texto}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Muro de apoyo: cada donante tiene su personaje 8-bit (generado del nombre) */}
      <div className="card">
        <h2 className="gracias-h2">🧱 Muro de apoyo</h2>
        {muro.length > 0 ? (
          <>
            <p className="muted" style={{ marginTop: 0 }}>Gracias a quienes hacen posible que esto siga creciendo:</p>
            <div className="muro">
              {muro.map((n) => (
                <div key={n} className="muro-card">
                  <PixelAvatar nombre={n} size={52} />
                  <span className="muro-nombre">{n}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Aún no hay nadie en el muro. <strong>¿Quieres ser el primero?</strong> Al apoyar,
              se te asigna tu propio <strong>personaje de 8 bits</strong> con tu nombre al lado.
            </p>
            <div className="muro-ejemplo-tit">Así se verá:</div>
            <div className="muro es-ejemplo">
              {EJEMPLO_MURO.map((n) => (
                <div key={n} className="muro-card">
                  <PixelAvatar nombre={n} size={52} />
                  <span className="muro-nombre">{n}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="gracias-acciones">
          <button className="btn btn-oro" onClick={onApoyar}>💛 Apoyar la app</button>
        </div>
      </div>
    </div>
  )
}
