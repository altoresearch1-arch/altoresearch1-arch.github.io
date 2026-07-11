import documentosData from '../data/documentos.json'
import documentosExtData from '../data/documentos_extranjero.json'

// 📚 DOCUMENTOS OFICIALES (pedido de Jair 09-jul): debajo de Sentinel, los
// links DIRECTOS a los originales que la empresa presentó a su regulador — para
// las peruanas, la SMV (Análisis y Discusión de la Gerencia, Estados Financieros
// y Notas; para las minas +los 4 trimestres de 2025). Para las EXTRANJERAS que
// cotizan en BVL pero reportan en su país (AUNA/NYSE-SEC, PPX/PML/RIO en TSX-V
// de Canadá/SEDAR+), los links los recolecta extractor/fetch_extranjero.py →
// documentos_extranjero.json. Sin intermediarios: el clic abre el PDF oficial.

const NOMBRES = {
  gerencia: '🗣 Análisis y Discusión de la Gerencia',
  eeff: '📊 Estados Financieros',
  notas: '📝 Notas a los Estados Financieros',
  // extranjeras
  release: '📄 Reporte de resultados',
  presentacion: '📽 Presentación',
  regulador: '🏛 Filings ante el regulador',
}

const ORDEN_EXT = ['eeff', 'gerencia', 'release', 'presentacion', 'regulador']

const legible = (p) => {
  const m = String(p).match(/^(\d{4})-T(\d)$/)
  return m ? `T${m[2]} ${m[1]}` : p
}

export default function DocumentosOficiales({ ticker }) {
  const reg = documentosData.documentos?.[ticker]
  const ext = documentosExtData.documentos?.[ticker]
  const tieneSMV = reg && Object.keys(reg).length > 0
  const tieneExt = ext && ext.docs && ORDEN_EXT.some((k) => ext.docs[k])
  if (!tieneSMV && !tieneExt) return null

  return (
    <div className="docs-oficiales">
      <div className="seccion-titulo">📚 Documentos oficiales (léelos tú mismo)</div>

      {/* Documentos de la SMV (empresas peruanas) */}
      {tieneSMV && Object.keys(reg).sort().reverse().map((p) => (
        <div key={p} className="docs-periodo">
          <span className="docs-periodo-tag">{legible(p)}</span>
          <div className="docs-botones">
            {['gerencia', 'eeff', 'notas'].filter((k) => reg[p][k]).map((k) => (
              <a key={k} className="docs-btn" href={reg[p][k]} target="_blank" rel="noopener noreferrer">
                {NOMBRES[k]} ↗
              </a>
            ))}
          </div>
        </div>
      ))}

      {/* Documentos del extranjero (SEC / SEDAR+ + web de inversionistas) */}
      {tieneExt && (
        <div className="docs-periodo">
          <span className="docs-periodo-tag">{legible(ext.periodo)}{ext.moneda ? ` · ${ext.moneda}` : ''}</span>
          <div className="docs-botones">
            {ORDEN_EXT.filter((k) => ext.docs[k]).map((k) => (
              <a key={k} className="docs-btn" href={ext.docs[k]} target="_blank" rel="noopener noreferrer">
                {NOMBRES[k]} ↗
              </a>
            ))}
          </div>
        </div>
      )}

      <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
        {tieneExt && !tieneSMV
          ? `Emisor extranjero: reporta a ${ext.fuente} (no a la SMV) — la misma fuente que leen el Gran Hermano y Atlas. El clic abre o descarga el PDF oficial.`
          : 'Los originales, tal como la empresa los presentó al regulador (SMV) — la misma fuente que leen el Gran Hermano y Atlas. El clic abre o descarga el PDF oficial.'}
      </p>
    </div>
  )
}
