import { useEffect, useRef, useState } from 'react'
import { responder, PREGUNTAS_INICIALES } from '../lib/cerebro'
import empresasData from '../data/empresas.json'

// ATLAS — la IA de ALTO (beta). Enseña y aprende. Chat estilo NotebookLM pero
// 100% nuestro: corre EN el navegador del usuario, sin servidores ni APIs de
// pago, y responde SOLO con los datos verificados de la app (por eso no puede
// irse de tema ni inventar). Lo que no sabe, el usuario lo manda al equipo con
// un toque (pestaña Comentarios) y Atlas lo aprende en la siguiente
// actualización. (Antes se llamó Yachay; Jair lo bautizó Atlas el 09-jul.)

// "**negrita**" → <b> (única marca que usa el cerebro)
function conNegritas(texto) {
  return texto.split(/\*\*(.+?)\*\*/g).map((p, i) => (i % 2 === 1 ? <b key={i}>{p}</b> : p))
}

const nombreDe = (t) => {
  const n = empresasData.empresas.find((e) => e.ticker === t)?.nombre || t
  return n.replace(/\s+(S\.?A\.?A?\.?|S\.?A\.?C\.?)\s*$/i, '')
}

export default function Atlas({ onVerEmpresa }) {
  const [mensajes, setMensajes] = useState(() => {
    const bienvenida = responder('')
    return [{ de: 'atlas', ...bienvenida }]
  })
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const finRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [mensajes, pensando])

  const preguntar = (q) => {
    const limpia = String(q || '').trim()
    if (!limpia || pensando) return
    setTexto('')
    setMensajes((prev) => [...prev, { de: 'usuario', texto: limpia }])
    setPensando(true)
    // pequeña pausa "de pensar": la respuesta es instantánea (es local),
    // pero sin pausa el chat se siente irreal
    setTimeout(() => {
      const resp = responder(limpia)
      setMensajes((prev) => [...prev, { de: 'atlas', ...resp }])
      setPensando(false)
    }, 350 + Math.random() * 350)
  }

  // APRENDER: la pregunta sin respuesta viaja a la pestaña Comentarios ya escrita
  const enviarAlEquipo = (pregunta) => {
    try {
      sessionStorage.setItem('alto-feedback-borrador',
        `Atlas no supo responder esto y quiero que lo aprenda: "${pregunta}"`)
    } catch { /* sin storage: la pestaña abre vacía */ }
    location.hash = '#/comentarios'
  }

  const ultimo = mensajes.length - 1

  return (
    <div className="yachay">
      <div className="yachay-cab card">
        <div className="yachay-avatar" aria-hidden="true">🧠</div>
        <div>
          <h1 style={{ margin: 0 }}>
            Atlas <span className="yachay-beta">IA · BETA</span>
          </h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            La IA de ALTO que <b>enseña y aprende</b>. Responde <b>solo</b> con los datos
            verificados de la app ({empresasData.empresas.length} empresas de la BVL, el glosario
            completo y nuestros informes). Educa, <b>no recomienda</b> — y lo que no sabe,
            se lo mandas al equipo con un toque y lo aprende.
          </p>
        </div>
      </div>

      <div className="yachay-chat card">
        {mensajes.map((m, i) => (
          <div key={i} className={`ya-msg ya-${m.de === 'usuario' ? 'usuario' : 'yachay'}`}>
            {m.de === 'atlas' && <span className="ya-quien">🧠 Atlas</span>}
            <div className="ya-burbuja">
              {String(m.texto).split('\n').map((linea, j) => (
                <div key={j} className="ya-linea">{conNegritas(linea)}</div>
              ))}
              {m.ticker && (
                <button className="ya-ficha" onClick={() => onVerEmpresa(m.ticker)}>
                  📄 Ver la ficha completa de {nombreDe(m.ticker)} →
                </button>
              )}
              {m.accion && (
                <button className="ya-ficha" onClick={() => { location.hash = m.accion.hash }}>
                  {m.accion.label}
                </button>
              )}
              {m.aprender && (
                <button className="ya-ficha" onClick={() => enviarAlEquipo(m.aprender)}>
                  📨 Enviar mi pregunta al equipo (para que Atlas la aprenda)
                </button>
              )}
            </div>
            {m.de === 'atlas' && i === ultimo && !pensando && (m.chips?.length > 0) && (
              <div className="ya-chips">
                {m.chips.map((c) => (
                  <button key={c} className="ya-chip" onClick={() => preguntar(c)}>{c}</button>
                ))}
              </div>
            )}
          </div>
        ))}
        {pensando && (
          <div className="ya-msg ya-yachay">
            <span className="ya-quien">🧠 Atlas</span>
            <div className="ya-burbuja ya-pensando">
              <span className="ya-punto" /><span className="ya-punto" /><span className="ya-punto" />
            </div>
          </div>
        )}
        <div ref={finRef} />
      </div>

      <form
        className="yachay-form"
        onSubmit={(e) => { e.preventDefault(); preguntar(texto) }}
      >
        <input
          ref={inputRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Pregúntame por una empresa o un término… (ej. ¿qué hace Alicorp?)"
          aria-label="Escribe tu pregunta para Atlas"
          maxLength={140}
        />
        <button type="submit" className="btn btn-oro" disabled={pensando || !texto.trim()}>
          Preguntar
        </button>
      </form>

      <div className="yachay-pie muted">
        Atlas es una beta que responde con la base de datos de ALTO (BVL/SMV e informes propios,
        verificados a mano). No usa internet ni servicios externos: tus preguntas no salen de tu
        dispositivo, salvo que TÚ decidas enviarlas al equipo para que Atlas las aprenda.
        Puede quedarse corto, pero nunca inventa. Nada de esto es recomendación de inversión.
      </div>

      {mensajes.length === 1 && (
        <div className="ya-sugerencias-extra">
          {PREGUNTAS_INICIALES.filter((p) => !mensajes[0].chips?.includes(p)).map((p) => (
            <button key={p} className="ya-chip" onClick={() => preguntar(p)}>{p}</button>
          ))}
        </div>
      )}
    </div>
  )
}
