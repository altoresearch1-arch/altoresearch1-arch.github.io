import { useEffect, useState } from 'react'
import config from '../data/config.json'

// 💬 COMENTARIOS Y FEEDBACK (pedido de Jair 09-jul): que la gente diga qué
// quiere que se agregue, qué le gusta y qué no. SIN backend ni cuentas: el
// mensaje se arma aquí y se envía desde el PROPIO correo del usuario (mailto),
// o se copia para mandarlo por donde quiera. Las preguntas que Atlas no supo
// responder llegan aquí como borrador (sessionStorage) — así Atlas APRENDE.

const TIPOS = [
  { id: 'agregar', etiqueta: '💡 Quiero que agreguen algo' },
  { id: 'gusta', etiqueta: '👍 Algo que me gusta' },
  { id: 'nogusta', etiqueta: '👎 Algo que no me gusta' },
  { id: 'atlas', etiqueta: '🧠 Pregunta para que Atlas aprenda' },
  { id: 'error', etiqueta: '🐞 Encontré un error' },
]

export default function Comentarios() {
  const [tipo, setTipo] = useState('agregar')
  const [mensaje, setMensaje] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [sinRespuesta, setSinRespuesta] = useState([])
  const correo = config.feedback?.correo

  // borrador que dejó Atlas ("envía mi pregunta al equipo") + preguntas guardadas
  useEffect(() => {
    try {
      const borrador = sessionStorage.getItem('alto-feedback-borrador')
      if (borrador) {
        setMensaje(borrador)
        setTipo('atlas')
        sessionStorage.removeItem('alto-feedback-borrador')
      }
      setSinRespuesta(JSON.parse(localStorage.getItem('alto-atlas-sin-respuesta')) || [])
    } catch { /* sin storage */ }
  }, [])

  const etiquetaTipo = TIPOS.find((t) => t.id === tipo)?.etiqueta || tipo
  const cuerpo = `${etiquetaTipo}\n\n${mensaje.trim()}\n\n— enviado desde la app ALTO Research`

  const enviarCorreo = () => {
    const url = `mailto:${correo}?subject=${encodeURIComponent('Feedback ALTO Research — ' + etiquetaTipo)}&body=${encodeURIComponent(cuerpo)}`
    window.location.href = url
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(`Para: ${correo}\n\n${cuerpo}`)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* sin permiso de clipboard */ }
  }

  return (
    <div className="comentarios">
      <div className="card">
        <h1 style={{ marginTop: 0 }}>💬 Comentarios y sugerencias</h1>
        <p className="muted">
          Esta app se construye CONTIGO. Dinos qué quieres que agreguemos, qué te gusta,
          qué no te gusta, o mándanos una pregunta que Atlas no supo responder — la
          convertimos en conocimiento en la siguiente actualización.
        </p>

        <div className="coment-tipos">
          {TIPOS.map((t) => (
            <button
              key={t.id}
              className={'coment-tipo' + (tipo === t.id ? ' activo' : '')}
              onClick={() => setTipo(t.id)}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>

        <textarea
          className="coment-texto"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Escribe aquí tu comentario, idea o pregunta…"
          rows={5}
          maxLength={1000}
        />

        {sinRespuesta.length > 0 && tipo === 'atlas' && !mensaje && (
          <div className="coment-pendientes">
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              Preguntas que Atlas no supo responderte (toca una para enviarla):
            </div>
            {sinRespuesta.slice(-5).map((p) => (
              <button key={p} className="ya-chip" onClick={() =>
                setMensaje(`Atlas no supo responder esto y quiero que lo aprenda: "${p}"`)
              }>{p}</button>
            ))}
          </div>
        )}

        <div className="coment-acciones">
          <button className="btn btn-oro" onClick={enviarCorreo} disabled={!mensaje.trim() || !correo}>
            📨 Enviar por correo
          </button>
          <button className="btn" onClick={copiar} disabled={!mensaje.trim()}>
            {copiado ? '✓ Copiado' : '📋 Copiar mensaje'}
          </button>
        </div>

        <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
          Sin cuentas ni servidores (así cuidamos tu privacidad): «Enviar» abre TU propio
          correo con el mensaje listo para {correo}. Si prefieres, cópialo y mándalo por
          donde quieras. Leemos todo — las mejores ideas entran a la app con tu crédito si quieres.
        </p>
      </div>
    </div>
  )
}
