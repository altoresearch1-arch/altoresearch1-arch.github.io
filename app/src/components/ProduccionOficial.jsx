import { useState } from 'react'
import produccionData from '../data/produccion.json'
import Glosado from './Glosado'

// 📣 Producción y volumen de ventas del trimestre — el dato COMPLETO (mina por
// mina) que la propia empresa publica como Hecho de Importancia en la BVL.
// Lo parsea fetch_produccion.py del PDF oficial → produccion.json (Regla #1:
// solo lo que se leyó limpio del documento; nada se inventa). Aparece en las
// mineras que publican esta tabla (hoy BVN). Nivel 3.

const EMOJI_METAL = {
  oro: '🥇', plata: '🥈', cobre: '🟠', zinc: '🛡️', plomo: '🔋',
  hierro: '🧲', estano: '🥫', molibdeno: '🔧',
}

function emojiDe(metal) {
  const base = metal.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const clave = Object.keys(EMOJI_METAL).find((k) => base.startsWith(k))
  return EMOJI_METAL[clave] || '⛏️'
}

function fmt(v) {
  if (v == null) return '—'
  return typeof v === 'number' ? v.toLocaleString('es-PE') : v
}

// Una tabla por metal: unidad · este trimestre · acumulado del año · guía anual
function TablaMetal({ metal, filas, conGuia, etTrim, etAcum }) {
  return (
    <div className="prodof-metal">
      <div className="prodof-metal-cab">{emojiDe(metal)} {metal}</div>
      <div className="prodof-tabla-wrap">
        <table className="prodof-tabla">
          <thead>
            <tr>
              <th>Unidad</th>
              <th className="num">{etTrim}</th>
              <th className="num">{etAcum}</th>
              {conGuia && <th className="num">Guía 2026</th>}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i} className={f.esTotal ? 'prodof-total' : ''}>
                <td>
                  {f.unidad}
                  {f.pct && <span className="prodof-pct">{f.pct}</span>}
                </td>
                <td className="num">{fmt(f.trim)}</td>
                <td className="num">{fmt(f.acum)}</td>
                {conGuia && <td className="num prodof-guia">{f.guia || '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ProduccionOficial({ ticker }) {
  const [verMas, setVerMas] = useState(false)
  const d = produccionData.empresas?.[ticker]
  if (!d) return null

  const trim = d.trimestre || 'último trimestre'
  const metalesProd = Object.entries(d.produccion || {})
  if (!metalesProd.length) return null
  const metalesVenta = Object.entries(d.ventas || {})
  const precios = d.precios || []
  const comentarios = d.comentarios || []

  return (
    <div className="prodof">
      <div className="prodof-cab">
        <div className="prodof-titulo">
          📣 Producción oficial del {trim}
        </div>
        <a className="prodof-pdf" href={d.pdf} target="_blank" rel="noreferrer">
          📄 Documento oficial (PDF ↗)
        </a>
      </div>
      <p className="muted prodof-intro">
        Esto lo reporta <strong>la propia empresa</strong> como Hecho de Importancia:
        su producción completa, <Glosado text="mina por mina" /> — mucho más detalle que
        el top del BEM de arriba. «{trim.split(' ')[0]}» es el trimestre;
        «6M» es lo acumulado del año. La <Glosado text="guía" /> es la meta anual que
        la propia empresa proyecta.
      </p>

      {metalesProd.map(([metal, filas]) => (
        <TablaMetal key={metal} metal={metal} filas={filas} conGuia
          etTrim={trim.replace(' ', '').replace('2026', '26')} etAcum="Año (6M)" />
      ))}

      <button className="prodof-vermas" onClick={() => setVerMas((v) => !v)}>
        {verMas ? '▲ Ver menos' : '▼ Ver volumen de ventas, precios y comentarios'}
      </button>

      {verMas && (
        <div className="prodof-extra">
          {metalesVenta.length > 0 && (
            <>
              <div className="prodof-sub">💵 Volumen vendido por metal</div>
              {metalesVenta.map(([metal, filas]) => (
                <TablaMetal key={metal} metal={metal} filas={filas}
                  etTrim={trim.replace(' ', '').replace('2026', '26')} etAcum="Año (6M)" />
              ))}
            </>
          )}

          {precios.length > 0 && (
            <>
              <div className="prodof-sub">🏷️ Precio promedio realizado</div>
              <div className="prodof-tabla-wrap">
                <table className="prodof-tabla">
                  <thead>
                    <tr><th>Metal</th><th className="num">Trimestre</th><th className="num">Año (6M)</th></tr>
                  </thead>
                  <tbody>
                    {precios.map((p, i) => (
                      <tr key={i}>
                        <td>{p.metal}</td>
                        <td className="num">{fmt(p.trim)}</td>
                        <td className="num">{fmt(p.acum)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {comentarios.length > 0 && (
            <>
              <div className="prodof-sub">🗣️ Comentarios de operaciones</div>
              <ul className="prodof-coment">
                {comentarios.map((c, i) => (
                  <li key={i}>
                    <strong>{c.unidad}:</strong>
                    <ul>
                      {c.notas.map((n, j) => <li key={j}>{n}</li>)}
                    </ul>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <p className="muted prodof-fuente">
        Fuente: el Hecho de Importancia que {ticker} presentó a la BVL el {d.fecha}.
        Lo leímos del PDF oficial, tal cual — si un dato no se pudo leer con certeza,
        no se muestra (no se inventa).
      </p>
    </div>
  )
}
