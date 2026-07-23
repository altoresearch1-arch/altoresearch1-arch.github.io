import { useState } from 'react'
import { lenteDe } from '../lib/lente'
import { NIVELES, NIVEL_SECCION, verSeccion } from '../lib/nivel'

// ─────────────────────────────────────────────────────────────────────────
// ✅ ¿ESTÁS LISTO PARA DECIDIR? (mejora #104 — el escalón 6 de la escalera)
// La ficha respondía "¿está barata?" y se acababa: el usuario se quedaba con
// la última pregunta en la boca ("¿y entonces qué hago?") y se la iba a
// responder TikTok. Este cierre es compatible con la Regla de Oro #9 porque
// NO responde si comprar: responde si el usuario ya puede decidirlo SOLO.
// Cada casilla en blanco enlaza a la sección donde está su respuesta; si esa
// sección vive en un nivel superior, lo dice en vez de mandarte a la nada.
// Las marcas se guardan por empresa en el navegador (sin cuentas, sin nube).
// ─────────────────────────────────────────────────────────────────────────

const CLAVE = (ticker) => `alto-listo-${ticker}`

function leer(ticker) {
  try {
    return JSON.parse(localStorage.getItem(CLAVE(ticker)) || '[]')
  } catch {
    return []
  }
}

export default function ListoParaDecidir({ empresa, nivel, onSubirNivel }) {
  const [marcadas, setMarcadas] = useState(() => leer(empresa.ticker))
  const l = lenteDe(empresa)
  const bancario = l && l.deudaAplica === false

  const alternar = (id) => {
    const n = marcadas.includes(id) ? marcadas.filter((x) => x !== id) : [...marcadas, id]
    setMarcadas(n)
    try { localStorage.setItem(CLAVE(empresa.ticker), JSON.stringify(n)) } catch { /* sin storage */ }
  }

  const items = [
    {
      id: 'vive', texto: 'Sé de qué vive esta empresa y quién manda en su negocio',
      sel: '.vive-de', seccion: null,
      pista: l ? `Vive de ${l.viveDe}; aquí manda ${l.queManda}.` : null,
    },
    {
      id: 'trimestre', texto: 'Sé por qué ganó (o perdió) más este trimestre',
      sel: '.gerencia-tarjeta', seccion: 'gerencia',
      pista: 'Está en sus propias palabras, en la tarjeta 🗣.',
    },
    {
      id: 'riesgo', texto: 'Puedo nombrar su riesgo número 1',
      sel: '[data-tour="riesgos"]', seccion: 'riesgos',
      pista: 'Si no puedes nombrarlo, todavía no la conoces.',
    },
    {
      id: 'deuda',
      texto: bancario
        ? 'Sé por qué en este negocio la deuda NO se mide como en el resto'
        : 'Sé si su deuda es del tipo peligroso PARA SU SECTOR',
      sel: '#sec-deuda', seccion: 'deuda',
      pista: bancario
        ? 'Sus pasivos son los depósitos de la gente: su materia prima.'
        : 'La misma deuda es cómoda en una eléctrica y una soga en una minera.',
    },
    {
      id: 'pe', texto: 'Entiendo por qué su P/E dice lo que dice',
      sel: '#sec-valoracion', seccion: 'valoracion',
      pista: 'Barato y caro no son adjetivos: son una división con contexto.',
    },
    {
      id: 'vigilar', texto: 'Sé qué evento vigilar el próximo trimestre',
      sel: '[data-tour="catalizadores"]', seccion: 'catalizadores',
      pista: 'Los catalizadores te dicen dónde poner el ojo.',
    },
  ]

  const ir = (sel) => {
    const el = document.querySelector(sel)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const listas = items.filter((it) => marcadas.includes(it.id)).length
  const total = items.length

  return (
    <div className="listo" data-tour="listo">
      <div className="seccion-titulo">✅ ¿Estás listo para decidir?</div>
      <p className="listo-intro muted">
        Esta app <strong>nunca</strong> te va a decir si comprar. Lo que sí puede decirte es si ya
        estás listo para decidirlo <strong>tú</strong>. Marca honestamente lo que sabes de{' '}
        {empresa.ticker}:
      </p>
      <ul className="listo-lista">
        {items.map((it) => {
          const marcada = marcadas.includes(it.id)
          const disponible = !it.seccion || verSeccion(nivel ?? 4, it.seccion)
          const nivelNecesario = NIVEL_SECCION[it.seccion]
          const infoNivel = NIVELES.find((n) => n.id === nivelNecesario)
          return (
            <li key={it.id} className={'listo-item' + (marcada ? ' on' : '')}>
              <label className="listo-check">
                <input type="checkbox" checked={marcada} onChange={() => alternar(it.id)} />
                <span>{it.texto}</span>
              </label>
              {!marcada && (
                <div className="listo-ayuda muted">
                  {it.pista && <span>{it.pista} </span>}
                  {disponible ? (
                    <button className="listo-link" onClick={() => ir(it.sel)}>
                      ir a la respuesta ↓
                    </button>
                  ) : (
                    <button
                      className="listo-link"
                      onClick={() => onSubirNivel && onSubirNivel(nivelNecesario)}
                    >
                      se abre en el nivel {infoNivel ? `${infoNivel.icono} ${infoNivel.nombre}` : nivelNecesario} →
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <div className="listo-pie">
        {listas === total ? (
          <p className="listo-final">
            🎉 Las seis marcadas. Ya no necesitas que nadie te diga qué hacer con {empresa.ticker}:
            tienes con qué decidirlo tú — y con qué explicárselo a alguien más, que es la prueba
            definitiva de que lo entendiste.
          </p>
        ) : (
          <p className="muted">
            Llevas <strong>{listas} de {total}</strong>. Las que están en blanco no son un
            reproche: son exactamente lo que te falta leer antes de decidir nada.
          </p>
        )}
      </div>
    </div>
  )
}
