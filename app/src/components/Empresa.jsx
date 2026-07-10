import empresasData from '../data/empresas.json'
import quiz from '../data/quiz.json'
import preciosData from '../data/precios.json'
import tipsData from '../data/tips.json'
import tesisData from '../data/tesis.json'
import catalizadoresData from '../data/catalizadores.json'
import guiasData from '../data/guias.json'
import dividendosData from '../data/dividendos.json'
import Glosado from './Glosado'
import Valoracion from './Valoracion'
import Simulador from './Simulador'
import DividendoResumen from './DividendoResumen'
import DividendoSimulador from './DividendoSimulador'
import Disclaimer from './Disclaimer'
import Sparkline from './Sparkline'
import Termometro from './Termometro'
import HechosImportancia from './HechosImportancia'
import Sentinel from './Sentinel'
import DocumentosOficiales from './DocumentosOficiales'
import ProduccionMinera from './ProduccionMinera'
import { CountUp, Reveal } from '../lib/anim'
import { useFavoritos, alternarFavorito } from '../lib/favoritos'
import { peInfo } from '../lib/finanzas'
import { useState } from 'react'

// P/E = precio ÷ BPA anual (SMV), vía peInfo de lib/finanzas. Si el precio es
// viejo (ilíquida) el P/E se MUESTRA igual, con ⚠ — pedido de Jair: el BPA
// existe (ej. Santa Luisa) y ocultarlo era perder el dato.
function calcularPE(ticker) {
  const info = peInfo(ticker)
  if (!info) return null
  if (info.perdida) return 'No aplica: tuvo pérdida en 2025 (no hay P/E).'
  if (info.referencial) {
    return `P/E ≈ ${info.pe.toFixed(1)} ⚠ referencial: su último precio es del ${fechaCorta(info.fechaPrecio)} (negocia poco)`
  }
  return `P/E ≈ ${info.pe.toFixed(1)} (precio de hoy ÷ BPA anual 2025)`
}

// Formatea "2026-06-22" -> "22/06/2026"
function fechaCorta(iso) {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

// Ficha de empresa — template "Gold Standard" de ALTO.
// Regla #1: lo no verificado se muestra como "Pendiente de verificar (SMV)", nunca inventado.

function Valor({ dato, etiqueta }) {
  const tieneValor = dato && dato.valor != null && dato.valor !== ''
  return (
    <div className="fund">
      <div className="k"><Glosado text={etiqueta} /></div>
      {tieneValor ? (
        <div className="v"><Glosado text={dato.valor} /></div>
      ) : (
        <div className="v vacio">Pendiente de verificar (SMV)</div>
      )}
      {dato?.fuente && (
        <div className="muted" style={{ marginTop: 4 }}><Glosado text={dato.fuente} /></div>
      )}
    </div>
  )
}

// ⭐ Guardar en "mi lista para estudiar" (localStorage, ver lib/favoritos.js)
function BotonFavorito({ ticker }) {
  const favoritos = useFavoritos()
  const es = favoritos.includes(ticker)
  return (
    <button
      className={'btn-fav' + (es ? ' on' : '')}
      title={es ? 'Quitar de mi lista' : 'Guardar en mi lista para estudiar'}
      onClick={() => alternarFavorito(ticker)}
    >
      {es ? '★ Guardada' : '☆ Guardar'}
    </button>
  )
}

// Compartir la ficha (Web Share en el celular; copia el link en escritorio)
function BotonCompartir({ empresa }) {
  const [copiado, setCopiado] = useState(false)
  const compartir = async () => {
    const url = `${location.origin}${location.pathname}#/empresa/${empresa.ticker}`
    const texto = `${empresa.ticker} — ${empresa.nombre} · ficha educativa en ALTO Research (BVL)`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ALTO Research', text: texto, url })
        return
      } catch { /* usuario canceló: no pasa nada */ }
    } else {
      try {
        await navigator.clipboard.writeText(url)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 1800)
      } catch { /* sin permiso de clipboard */ }
    }
  }
  return (
    <button className="btn-fav" onClick={compartir} title="Compartir esta ficha">
      {copiado ? '✓ Link copiado' : '↗ Compartir'}
    </button>
  )
}

const ICONO_CATAL = {
  resultados: '📊', dividendo: '💰', operativo: '⚙️',
  legal: '⚖️', expansion: '📈', riesgo: '⚠️',
}

const NOMBRE_ESCENARIO = {
  favorable: 'Favorable',
  neutral: 'Neutral',
  presion: 'Presión',
  riesgo: 'Alto riesgo',
}

export default function Empresa({ ticker, onVolver, volverTexto = '← Volver a resultados' }) {
  const e = empresasData.empresas.find((x) => x.ticker === ticker)
  if (!e) {
    return (
      <div className="card">
        <p>No se encontró la empresa.</p>
        <button className="btn" onClick={onVolver}>← Volver</button>
      </div>
    )
  }

  const nombreSector = quiz.sectores[e.sector] || e.sector
  const f = e.fundamentos
  // Precio de cierre de la BVL (del día anterior)
  const px = preciosData.precios?.[e.ticker]
  const tienePrecio = px && px.precio != null
  const precioTexto = tienePrecio ? `${px.moneda} ${px.precio}` : 'Sin cotización'
  // ¿Reparte dividendos? Si no, no mostramos el simulador de dividendos (solo el de precio)
  // y el DividendoResumen de arriba avisa "no da dividendos".
  const dvE = dividendosData.empresas?.[e.ticker]
  const pagaDividendos = !!(dvE && ((dvE.anualNum && dvE.anualNum > 0)
    || dvE.porAnio?.['2025'] || dvE.porAnio?.['2026']))

  return (
    <div>
      <div className="ficha-nav">
        <button className="btn btn-fantasma" onClick={onVolver}>
          {volverTexto}
        </button>
        <div className="row" style={{ gap: 8 }}>
          <BotonFavorito ticker={e.ticker} />
          <BotonCompartir empresa={e} />
        </div>
      </div>

      <div className="card">
        {/* Cabecera */}
        <div className="ficha-head">
          <div>
            <div className="ticker" style={{ fontSize: 24 }}>{e.ticker}</div>
            <div className="muted">{e.nombre}</div>
            <div className="row" style={{ marginTop: 8 }}>
              <span className="badge parcial">{nombreSector}</span>
              {e.perfiles?.map((p) => (
                <span key={p} className="badge alta">{quiz.perfiles[p]?.nombre || p}</span>
              ))}
            </div>
          </div>
          <div className="precio">
            <div className="k muted">Precio de <Glosado text="cierre" /></div>
            <div className="valor">
              {tienePrecio
                ? <>{px.moneda} <CountUp valor={px.precio} decimales={String(px.precio).includes('.') ? String(px.precio).split('.')[1].length : 0} /></>
                : precioTexto}
            </div>
            {tienePrecio && (
              <div className="muted" style={{ marginTop: 2 }}>
                {px.sinNegociacionReciente
                  ? `Último cierre disponible · ${fechaCorta(px.fecha)}`
                  : `Cierre del ${fechaCorta(px.fecha)}`}
                <br />
                BVL · {px.nemonico}
              </div>
            )}
          </div>
        </div>

        {/* Tesis: honesta, de una línea (tesis.json reemplaza el 'pendiente') */}
        {(tesisData.tesis?.[e.ticker] || e.tesis) && (
          <div className="tesis">
            {tesisData.tesis?.[e.ticker]
              ? <Glosado text={tesisData.tesis[e.ticker]} />
              : e.tesis.pendiente
                ? <em className="muted">{e.tesis.texto}</em>
                : <Glosado text={e.tesis.texto} />}
          </div>
        )}

        {/* Gráfico de precio (cierres reales BVL) + termómetro de volatilidad */}
        <Sparkline ticker={e.ticker} />
        <Termometro ticker={e.ticker} />

        {/* Dividendos (resumen) + ¿Barata o cara? + simuladores — lo más importante, arriba */}
        <Reveal><DividendoResumen empresa={e} /></Reveal>
        <Reveal><Valoracion empresa={e} /></Reveal>
        <Reveal>
          {pagaDividendos ? (
            <div className="sim-par">
              <Simulador empresa={e} />
              <DividendoSimulador empresa={e} />
            </div>
          ) : (
            <Simulador empresa={e} />
          )}
        </Reveal>

        {/* Tips para estudiarla */}
        {tipsData.tips?.[e.ticker]?.length > 0 && (
          <Reveal>
            <div className="seccion-titulo">💡 Tips para estudiarla</div>
            <ul className="lista-limpia">
              {tipsData.tips[e.ticker].map((t, i) => (
                <li key={i}><Glosado text={t} /></li>
              ))}
            </ul>
            <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>
              Tips educativos para saber qué mirar — no son recomendación de compra.
            </p>
          </Reveal>
        )}

        {/* ⛏️ Producción mensual del MINEM + minas y participaciones. Aparece si el
            ticker tiene familia minera (cubre a Shougang, que es sector acereras). */}
        <Reveal><ProduccionMinera ticker={e.ticker} /></Reveal>

        {/* Fundamentos */}
        <Reveal>
          <div className="seccion-titulo">Fundamentos · <Glosado text="individual" /> (<Glosado text="SMV" />)</div>
          {f ? (
            <div className="grid-fund">
              <Valor dato={f.deuda} etiqueta="Deuda" />
              <Valor dato={f.fcf} etiqueta="FCF (Flujo de Caja Libre)" />
              <Valor dato={f.eps} etiqueta="EPS (moneda original)" />
              <Valor dato={f.margen} etiqueta="Margen" />
            </div>
          ) : (
            <p className="muted">Pendiente de cargar desde la SMV.</p>
          )}
        </Reveal>

        {/* Cómo leer estos números, según el sector (siempre abierto) */}
        {guiasData.guias?.[e.sector] && (
          <Reveal>
          <div className="guia-sector">
            <div className="guia-cabecera">
              📖 Cómo leer estos números (en {nombreSector})
            </div>
            <div className="guia-cuerpo">
              <p className="guia-intro"><Glosado text={guiasData.guias[e.sector].intro} /></p>
              {guiasData.guias[e.sector].metricas.map((m, i) => {
                const esDividendo = m.k.toLowerCase().startsWith('dividendo')
                const esPE = m.k.toUpperCase().startsWith('P/E')
                const dv = esDividendo ? dividendosData.empresas?.[e.ticker] : null
                const datoDiv =
                  dv && dv.anual
                    ? `${dv.anual} al año por acción${dv.yield ? ` (rinde ${dv.yield})` : ''}`
                    : null
                const dato =
                  (esPE ? calcularPE(e.ticker) : null) ||
                  datoDiv ||
                  (m.metrica && e.metricas ? e.metricas[m.metrica] : null)
                return (
                  <div key={i} className="guia-metrica">
                    <span className="guia-k">{m.k}</span>
                    <span className="guia-v"><Glosado text={m.v} /></span>
                    {dato && (
                      <span className="guia-dato">
                        📊 {e.ticker}: <strong><Glosado text={dato} /></strong>
                      </span>
                    )}
                    {esDividendo && !datoDiv && (
                      <span className="guia-sindato">No reparte dividendo de forma regular</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          </Reveal>
        )}

        {/* Balance destacado (si existe) */}
        {e.balanceDestacado?.length > 0 && (
          <>
            <div className="seccion-titulo">Del estado de situación financiera</div>
            <ul className="lista-limpia">
              {e.balanceDestacado.map((b, i) => (
                <li key={i}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span><Glosado text={b.k} /></span>
                    <strong className="oro"><Glosado text={b.v} /></strong>
                  </div>
                  {b.nota && (
                    <div className="muted" style={{ marginTop: 2 }}><Glosado text={b.nota} /></div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Catalizadores: eventos que podrían mover el precio (documentado/rumor) */}
        {(catalizadoresData.catalizadores?.[e.ticker]?.length > 0 || e.catalizadores?.length > 0) && (
          <Reveal>
            <div className="seccion-titulo">⚡ Catalizadores (eventos que vienen)</div>
            {catalizadoresData.catalizadores?.[e.ticker]?.length > 0 ? (
              <ul className="lista-limpia">
                {catalizadoresData.catalizadores[e.ticker].map((c, i) => (
                  <li key={i} className="catal">
                    <span className={'catal-tag ' + (c.etiqueta === 'rumor' ? 'rumor' : 'doc')}>
                      {ICONO_CATAL[c.tipo] || '•'} {c.etiqueta === 'rumor' ? 'Rumor' : 'Documentado'}
                    </span>
                    <span><Glosado text={c.texto} /></span>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="lista-limpia">
                {e.catalizadores.map((c, i) => (
                  <li key={i}><em className="muted"><Glosado text={c.texto} /></em></li>
                ))}
              </ul>
            )}
          </Reveal>
        )}

        {/* Hechos de Importancia: comunicados oficiales SMV/BVL (hechos.json) */}
        <Reveal><HechosImportancia ticker={e.ticker} /></Reveal>

        {/* 🛰️ Sentinel: suelta el PDF de un hecho y te dice si pinta buena o mala */}
        <Reveal><Sentinel ticker={e.ticker} /></Reveal>

        {/* 📚 Los documentos ORIGINALES de la SMV (gerencia, EEFF, notas; minas +2025) */}
        <Reveal><DocumentosOficiales ticker={e.ticker} /></Reveal>

        {/* Escenarios (solo si Jair los llenó; si no, ya está el Simulador arriba) */}
        {e.escenarios &&
          ['favorable', 'neutral', 'presion', 'riesgo'].some(
            (k) => e.escenarios[k] && e.escenarios[k] !== 'Pendiente'
          ) && (
          <>
            <div className="seccion-titulo">Escenarios</div>
            <div className="escenarios">
              {['favorable', 'neutral', 'presion', 'riesgo'].map((k) => (
                <div key={k} className={'escenario ' + k}>
                  <div className="e-tit">{NOMBRE_ESCENARIO[k]}</div>
                  <div className="muted"><Glosado text={e.escenarios[k] || 'Pendiente'} /></div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Riesgos — documentado vs rumor */}
        {e.riesgos?.length > 0 && (
          <>
            <div className="seccion-titulo">Riesgos</div>
            {e.riesgos.map((r, i) => (
              <div key={i} className="riesgo-row">
                <span className={'pill-fuente ' + (r.tipo === 'rumor' ? 'rumor' : 'doc')}>
                  {r.tipo === 'rumor' ? 'Rumor' : 'Documentado'}
                </span>
                <span><Glosado text={r.texto} /></span>
              </div>
            ))}
          </>
        )}

        {/* Fuentes */}
        {e.fuentes?.length > 0 && (
          <>
            <div className="seccion-titulo">Fuentes</div>
            <ul className="lista-limpia">
              {e.fuentes.map((s, i) => (
                <li key={i} className="muted">{s}</li>
              ))}
            </ul>
            <p className="muted" style={{ marginTop: 8 }}>
              Jerarquía: filings SMV → reporte auditado → comunicaciones oficiales →
              medios locales verificados.
            </p>
          </>
        )}
      </div>

      <Disclaimer />
    </div>
  )
}
