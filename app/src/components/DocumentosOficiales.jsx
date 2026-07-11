import documentosData from '../data/documentos.json'

// 📚 DOCUMENTOS OFICIALES (pedido de Jair 09-jul): debajo de Sentinel, los
// links DIRECTOS a los originales que la empresa presentó a la SMV — el
// Análisis y Discusión de la Gerencia, los Estados Financieros y las Notas.
// Para las minas, además los 4 trimestres de 2025. Sin intermediarios: el
// clic abre el PDF del regulador (links públicos de ConsultasP8, recolectados
// por extractor/fetch_docs_urls.py).

const NOMBRES = {
  gerencia: '🗣 Análisis y Discusión de la Gerencia',
  eeff: '📊 Estados Financieros',
  notas: '📝 Notas a los Estados Financieros',
}

const legible = (p) => {
  const m = String(p).match(/^(\d{4})-T(\d)$/)
  return m ? `T${m[2]} ${m[1]}` : p
}

export default function DocumentosOficiales({ ticker }) {
  const reg = documentosData.documentos?.[ticker]
  if (!reg || Object.keys(reg).length === 0) return null
  // el trimestre actual primero; luego 2025 de T4 a T1 (solo minas)
  const periodos = Object.keys(reg).sort().reverse()

  return (
    <div className="docs-oficiales">
      <div className="seccion-titulo">📚 Documentos oficiales (léelos tú mismo)</div>
      {periodos.map((p) => (
        <div key={p} className="docs-periodo">
          <span className="docs-periodo-tag">{legible(p)}</span>
          <div className="docs-botones">
            {['gerencia', 'eeff', 'notas'].filter((k) => reg[p][k]).map((k) => (
              <a
                key={k}
                className="docs-btn"
                href={reg[p][k]}
                target="_blank"
                rel="noopener noreferrer"
              >
                {NOMBRES[k]} ↗
              </a>
            ))}
          </div>
        </div>
      ))}
      <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
        Los originales, tal como la empresa los presentó al regulador (SMV) — la misma
        fuente que leen el Gran Hermano y Atlas. El clic abre o descarga el PDF oficial.
      </p>
    </div>
  )
}
