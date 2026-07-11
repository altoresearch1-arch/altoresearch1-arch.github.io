import noticiasData from '../data/noticias_extranjero.json'

// 📰 Noticias de empresas EXTRANJERAS (pedido de Jair 11-jul). Las que no
// cotizan en BVL (Rio2) no tienen Hechos de Importancia, así que sus noticias
// solo salen en su web oficial. El Gran Hermano las recolecta con
// extractor/fetch_extranjero.py --solo-noticias → noticias_extranjero.json.
// Para las que sí cotizan en BVL (PPX), es un complemento a sus Hechos.

export default function NoticiasExtranjero({ ticker }) {
  const reg = noticiasData.noticias?.[ticker]
  if (!reg || !reg.items?.length) return null
  let host = reg.sitio
  try { host = new URL(reg.sitio).host.replace(/^www\./, '') } catch { /* deja el texto */ }

  return (
    <div className="noticias-ext">
      <div className="seccion-titulo">📰 Últimas noticias (de su web oficial)</div>
      <ul className="lista-limpia">
        {reg.items.map((n, i) => (
          <li key={i} className="noticia-ext">
            <a href={n.url} target="_blank" rel="noopener noreferrer">
              {n.fecha && <span className="noticia-ext-fecha">{n.fecha}</span>}
              <span className="noticia-ext-tit">{n.titulo}</span>
              <span className="noticia-ext-flecha"> ↗</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>
        Titulares de <strong>{host}</strong>, recolectados por el Gran Hermano. Es un emisor
        extranjero: sus comunicados no siempre llegan por la BVL. Toca para leer el original.
      </p>
    </div>
  )
}
