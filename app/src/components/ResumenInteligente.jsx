import bpaData from '../data/bpa_historico.json'
import ctxData from '../data/bpa_contexto.json'
import { peInfo, precioDe, cambio6M, yieldNumerico, dividendosDe, pagaDividendos } from '../lib/finanzas'
import Glosado from './Glosado'

// 🧠 RESUMEN INTELIGENTE (pedido de Jair 21-jul, nombre elegido por él):
// el 4º modo de la gráfica BPA — reúne en una sola lectura el BPA, el precio,
// el dividendo, la CAJA y la DEUDA (la que vence pronto vs la "deuda futura"),
// explicando cada número en cristiano. TODO sale de datos ya verificados
// (empresas.json XBRL SMV, precios BVL, dividendos, metales BCRP) — si un dato
// no existe, su bloque no se escribe (Regla #1: no se inventa). Sin veredictos
// de compra/venta (Regla #9): semáforos EDUCATIVOS con la fórmula a la vista.

const SIMBOLO = { USD: 'US$', PEN: 'S/' }
const NOMBRE_METAL = { cobre: 'Cobre', oro: 'Oro', plata: 'Plata', zinc: 'Zinc',
                       plomo: 'Plomo', estano: 'Estaño', niquel: 'Níquel' }
const EMOJI_METAL = { oro: '🥇', plata: '🥈', cobre: '🔵', zinc: '⚫',
                      plomo: '🔘', estano: '🟤', niquel: '⚪' }

// 683262000 -> "683.3" · 3407000000 -> "3,407" (en millones, sin símbolo)
function fmtM(unidades) {
  const m = unidades / 1e6
  return m >= 1000
    ? m.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : m.toFixed(1)
}

function fmtPct(p) {
  const abs = Math.abs(p)
  return (p > 0 ? '+' : p < 0 ? '−' : '') + abs.toFixed(abs >= 10 ? 0 : 1) + '%'
}

// "US$ 683.3 M (corr. US$ 7.7 M + no corr. US$ 675.6 M)" -> { corr, noCorr } en M
function desgloseDeuda(textoDeuda) {
  const m = /corr\.\s*(?:US\$|S\/)\s*([\d,]+(?:\.\d+)?)\s*M\s*\+\s*no corr\.\s*(?:US\$|S\/)\s*([\d,]+(?:\.\d+)?)\s*M/.exec(textoDeuda || '')
  if (!m) return null
  const n = (s) => parseFloat(s.replace(/,/g, ''))
  return { corr: n(m[1]), noCorr: n(m[2]) }
}

// Flechita ▲/▼ coloreada (o nada si no hay variación calculable)
function Delta({ pct, etiqueta }) {
  if (pct == null || !isFinite(pct)) return null
  const cls = pct > 0 ? 'sube' : pct < 0 ? 'baja' : ''
  return (
    <span className={'bpa-delta ' + cls}>
      {pct > 0 ? '▲' : pct < 0 ? '▼' : '='} {fmtPct(pct)}
      {etiqueta && <span className="bpa-delta-vs"> {etiqueta}</span>}
    </span>
  )
}

export default function ResumenInteligente({ ticker, empresa, metales }) {
  const emp = bpaData.empresas?.[ticker]
  const serie = emp?.serie || {}
  const aniosSerie = Object.keys(serie).sort()
  const simBpa = SIMBOLO[emp?.moneda] || emp?.moneda || ''

  // ── BPA anual: último año con dato + variación vs el anterior ──
  const ultimoAnio = aniosSerie[aniosSerie.length - 1]
  const bpaUltimo = ultimoAnio != null ? serie[ultimoAnio] : null
  const anioPrev = aniosSerie[aniosSerie.length - 2]
  const bpaPrev = anioPrev != null ? serie[anioPrev] : null
  const bpaPct = bpaUltimo != null && bpaPrev != null && bpaPrev > 0
    ? ((bpaUltimo - bpaPrev) / bpaPrev) * 100 : null

  // ── precio / P/E / dividendo (helpers de finanzas.js — nunca duplicar fórmulas) ──
  const px = precioDe(ticker)
  const seisM = cambio6M(ticker)
  const pe = peInfo(ticker)
  const yld = yieldNumerico(ticker)
  const dv = dividendosDe(ticker)
  const reparte = pagaDividendos(ticker)

  // ── caja y deuda (XBRL SMV, empresas.json) ──
  const raw = empresa?.evEbitdaRaw || {}
  const simEstados = SIMBOLO[empresa?.monedaEstados] || empresa?.monedaEstados || ''
  const efectivo = raw.efectivo ?? null              // en unidades
  const deuda = raw.deudaFinanciera ?? null          // en unidades
  const utilidadTrim = raw.utilidadNeta ?? null      // del TRIMESTRE
  const partes = desgloseDeuda(empresa?.metricas?.deuda) // en millones
  const fechaBalance = empresa?._extraccion?.fechaCierre || null
  const esBanco = empresa?.sector === 'bancos'

  // Semáforo caja vs deuda que vence pronto (solo si hay ambos datos y no es banco)
  let semaforo = null
  if (!esBanco && efectivo != null && deuda != null) {
    if (deuda === 0) {
      semaforo = { luz: '🟢', texto: <>Deuda financiera: <strong>cero</strong>. Financia su operación sin préstamos — la caja entera queda libre.</> }
    } else if (partes) {
      const corrU = partes.corr * 1e6
      if (corrU === 0) {
        semaforo = { luz: '🟢', texto: <>Nada de su deuda vence dentro de 12 meses: toda es <Glosado text="deuda no corriente" /> (a futuro).</> }
      } else {
        const cob = efectivo / corrU
        const frase = <>La caja ({simEstados} {fmtM(efectivo)} M) cubre <strong>{cob >= 10 ? Math.round(cob) : cob.toFixed(1)}×</strong> la deuda que vence pronto ({simEstados} {partes.corr.toFixed(1)} M)</>
        if (cob >= 1) semaforo = { luz: '🟢', texto: <>{frase}: podría pagarla hoy sin pedir prestado.</> }
        else if (cob >= 0.5) semaforo = { luz: '🟡', texto: <>{frase}: no alcanza completa — lo normal es que renueve parte o la pague con lo que genere el año.</> }
        else semaforo = { luz: '🔴', texto: <>{frase}: la caja de hoy no alcanza — tendrá que renovar deuda o generar bastante caja este año. Pregúntate cómo piensa hacerlo.</> }
      }
    }
  }

  // ¿En cuántos años la pagaría? (ejercicio educativo con la fórmula a la vista)
  let aniosPagar = null
  if (!esBanco && deuda != null && deuda > 0 && utilidadTrim != null) {
    aniosPagar = utilidadTrim > 0 ? deuda / (utilidadTrim * 4) : -1 // -1 = en pérdida
  }

  // ── factores del periodo: metales BCRP para mineras (últimos 2 trimestres con dato) ──
  const factoresMetal = (metales || []).slice(0, 3).map((m) => {
    const tri = ctxData.metales?.[m]?.trimestral || {}
    const claves = Object.keys(tri).sort()
    if (claves.length < 2) return null
    const kUlt = claves[claves.length - 1]
    const vUlt = tri[kUlt]
    const vPrev = tri[claves[claves.length - 2]]
    if (vUlt == null || vPrev == null || vPrev <= 0) return null
    return { metal: m, periodo: kUlt, pct: ((vUlt - vPrev) / vPrev) * 100 }
  }).filter(Boolean)

  // ── 💡 la lectura junta: frases desde slots verificados (estilo redactor) ──
  const frases = []
  if (bpaPct != null) {
    frases.push(bpaPct >= 0
      ? `Ganó ${fmtPct(bpaPct)} más por acción en ${ultimoAnio} que en ${anioPrev}.`
      : `Ganó ${fmtPct(Math.abs(bpaPct)).replace('+', '')} menos por acción en ${ultimoAnio} que en ${anioPrev} — el porqué suele estar en sus factores de abajo o en la charla de la gerencia.`)
  } else if (bpaUltimo != null && bpaUltimo < 0) {
    frases.push(`En ${ultimoAnio} perdió dinero por acción.`)
  }
  if (semaforo) {
    frases.push(semaforo.luz === '🟢'
      ? '🟢 Su caja alcanza para lo que le vence este año.'
      : semaforo.luz === '🟡'
        ? '🟡 Su caja cubre solo parte de lo que le vence este año.'
        : '🔴 Su caja de hoy no alcanza para lo que le vence este año.')
  }
  if (partes && partes.corr + partes.noCorr > 0) {
    const pFuturo = Math.round((partes.noCorr / (partes.corr + partes.noCorr)) * 100)
    frases.push(pFuturo >= 70
      ? `El ${pFuturo}% de su deuda vence después de 12 meses: el apuro inmediato es bajo, pero esa deuda futura igual se paga algún día.`
      : `Solo el ${pFuturo}% de su deuda es a futuro: buena parte vence este año.`)
  }

  const hayAlgo = bpaUltimo != null || px?.precio != null || efectivo != null || deuda != null
  if (!hayAlgo) {
    return <p className="muted">La SMV no tiene suficientes datos de esta empresa para armar el resumen.</p>
  }

  return (
    <div className="bpa-ri">
      <p className="bpa-ri-intro muted">
        Lo esencial en una sola lectura, con datos oficiales (SMV · BVL · BCRP).
        Nada de esto es recomendación de compra o venta.
      </p>

      {/* ── tarjetas rápidas ── */}
      <div className="bpa-tarjetas">
        {bpaUltimo != null && (
          <div className="bpa-tarjeta">
            <div className="bpa-tarjeta-t"><Glosado text="BPA" /> {ultimoAnio}</div>
            <div className={'bpa-tarjeta-v' + (bpaUltimo < 0 ? ' perdida' : '')}>
              {bpaUltimo < 0 ? '−' : ''}{simBpa} {Math.abs(bpaUltimo).toFixed(Math.abs(bpaUltimo) >= 0.1 ? 2 : 3)}
            </div>
            <Delta pct={bpaPct} etiqueta={`vs ${anioPrev}`} />
          </div>
        )}
        {px?.precio != null && (
          <div className="bpa-tarjeta">
            <div className="bpa-tarjeta-t">Precio hoy</div>
            <div className="bpa-tarjeta-v">{px.moneda} {px.precio}</div>
            <Delta pct={seisM} etiqueta="en 6 meses" />
          </div>
        )}
        {pe && !pe.perdida && (
          <div className="bpa-tarjeta">
            <div className="bpa-tarjeta-t"><Glosado text="P/E" /></div>
            <div className="bpa-tarjeta-v">{pe.pe.toFixed(1)}×</div>
            {pe.referencial && <span className="bpa-delta">⚠ referencial</span>}
          </div>
        )}
        {reparte && yld != null && (
          <div className="bpa-tarjeta">
            <div className="bpa-tarjeta-t"><Glosado text="Yield" /></div>
            <div className="bpa-tarjeta-v">{yld.toFixed(1)}%</div>
            <span className="bpa-delta">💰 sí reparte</span>
          </div>
        )}
      </div>

      {/* ── 🏦 la caja ── */}
      {efectivo != null && (
        <div className="bpa-ri-bloque">
          <div className="bpa-ri-titulo">🏦 ¿Cuánto dinero tienen en caja?</div>
          <div className="bpa-ri-cifra">{simEstados} {fmtM(efectivo)} M</div>
          <p className="muted bpa-ri-exp">
            Efectivo y equivalentes{fechaBalance ? ` al ${fechaBalance}` : ''} (su balance en la SMV).
            {esBanco
              ? ' En un banco la caja es grande por naturaleza: incluye el encaje y las reservas con que respalda los depósitos.'
              : ' Es su colchón: con eso paga deudas, invierte o aguanta un mal año sin pedir prestado.'}
          </p>
        </div>
      )}

      {/* ── 🏗 la deuda: hoy y a futuro ── */}
      {deuda != null && (
        <div className="bpa-ri-bloque">
          <div className="bpa-ri-titulo">🏗 ¿Cuánto deben — hoy y a futuro?</div>
          <div className="bpa-ri-cifra"><Glosado text="deuda financiera" />: {simEstados} {fmtM(deuda)} M</div>
          {partes && partes.corr + partes.noCorr > 0 && (
            <>
              <div className="bpa-ri-split" aria-hidden="true">
                <div className="bpa-ri-split-corr" style={{ width: `${Math.max(2, (partes.corr / (partes.corr + partes.noCorr)) * 100)}%` }} />
                <div className="bpa-ri-split-nocorr" style={{ width: `${Math.max(2, (partes.noCorr / (partes.corr + partes.noCorr)) * 100)}%` }} />
              </div>
              <div className="bpa-ri-partes">
                <div>
                  <span className="bpa-ri-parte-punto corr" /> Vence pronto (≤ 12 meses): <strong>{simEstados} {partes.corr.toFixed(1)} M</strong>
                  <div className="muted bpa-ri-exp">La <Glosado text="deuda corriente" />: hay que pagarla (o renovarla) ya.</div>
                </div>
                <div>
                  <span className="bpa-ri-parte-punto nocorr" /> Deuda futura (&gt; 12 meses): <strong>{simEstados} {partes.noCorr.toFixed(1)} M</strong>
                  <div className="muted bpa-ri-exp">La <Glosado text="deuda no corriente" />: da aire hoy, pero algún día toca pagarla.</div>
                </div>
              </div>
            </>
          )}
          {esBanco ? (
            <p className="muted bpa-ri-exp">
              ⚠ OJO: es un banco — deber mucho es parte de su negocio (capta depósitos y
              emite bonos PARA prestar). Aquí no aplica el semáforo caja-vs-deuda: lo que
              se mira en un banco es su patrimonio y la mora de sus préstamos.
            </p>
          ) : (
            <>
              {semaforo && <p className="bpa-ri-semaforo">{semaforo.luz} {semaforo.texto}</p>}
              {aniosPagar != null && (
                <p className="muted bpa-ri-exp">
                  {aniosPagar === -1
                    ? <>Con pérdida en el último trimestre no se puede estimar en cuántos años pagaría su deuda con utilidades.</>
                    : <>Si repitiera la utilidad del último trimestre todo el año y la dedicara ÍNTEGRA
                        a la deuda, la pagaría en <strong>{aniosPagar < 1 ? 'menos de 1 año' : `~${aniosPagar.toFixed(1)} años`}</strong> — ejercicio
                        educativo (deuda ÷ utilidad anualizada), no una predicción.</>}
                </p>
              )}
            </>
          )}
        </div>
      )}
      {deuda == null && efectivo != null && (
        <p className="muted bpa-ri-exp">Sin dato de deuda financiera en su XBRL de la SMV — no se inventa.</p>
      )}

      {/* ── ⛏ factores del periodo (mineras) ── */}
      {(factoresMetal.length > 0 || reparte != null) && (
        <div className="bpa-ri-bloque">
          <div className="bpa-ri-titulo">{factoresMetal.length ? '⛏ Factores del periodo' : '💰 Dividendo'}</div>
          <div className="bpa-ri-factores">
            {factoresMetal.map((f) => (
              <div key={f.metal} className="bpa-ri-factor">
                {EMOJI_METAL[f.metal] || '⛏'} {NOMBRE_METAL[f.metal] || f.metal}
                <Delta pct={f.pct} etiqueta={`(${f.periodo})`} />
              </div>
            ))}
            <div className="bpa-ri-factor">
              {factoresMetal.length > 0 && <>💰 Dividendo: </>}
              {reparte ? `Sí reparte${dv?.anualNum ? ` (${dv.anualSim || ''} ${dv.anualNum} por acción al año)` : ''}` : 'No reparte hoy'}
            </div>
          </div>
          {factoresMetal.length > 0 && (
            <p className="muted bpa-ri-exp">
              Precio promedio del metal (BCRP/LME) del último trimestre con dato vs el
              anterior. En una minera, el metal mueve los ingresos — y por esa vía, el BPA.
            </p>
          )}
        </div>
      )}

      {/* ── 💡 la lectura junta ── */}
      {frases.length > 0 && (
        <div className="bpa-interpreta">
          <div className="bpa-interpreta-t">💡 Cómo se lee todo junto</div>
          <p>{frases.join(' ')}</p>
        </div>
      )}

      <p className="muted bpa-ri-fuente">
        Fuentes: SMV (XBRL{fechaBalance ? `, balance al ${fechaBalance}` : ''}) · precios BVL ·
        dividendos stockanalysis + BVL{factoresMetal.length ? ' · metales BCRP' : ''} · moneda original de sus estados.
      </p>
    </div>
  )
}
