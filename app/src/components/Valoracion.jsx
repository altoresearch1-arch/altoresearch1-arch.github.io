import preciosData from '../data/precios.json'
import epsAnualData from '../data/eps_anual.json'
import escenariosData from '../data/escenarios.json'
import Glosado from './Glosado'

// ¿La acción está barata, en rango o cara? Método: P/E actual vs el rango justo del
// sector. P/E = precio (BVL) ÷ ganancia anual por acción (SMV). Educativo y con la fórmula.

function fmt(n, sim) {
  return `${sim} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function Valoracion({ empresa }) {
  const px = preciosData.precios?.[empresa.ticker]
  const ea = epsAnualData.eps?.[empresa.ticker]
  const rango = escenariosData.rangoPE?.[empresa.sector]
  if (!px || px.precio == null || !ea || ea.epsAnual == null || !rango) return null

  // EPS anual llevado a la moneda del precio
  const sim = px.moneda === 'US$' ? 'US$' : 'S/'
  const monedaPrecio = px.moneda === 'US$' ? 'USD' : 'PEN'
  let eps = ea.epsAnual
  let nota = null
  if (eps <= 0) {
    return (
      <div className="val val-perdida">
        <div className="val-tit">💎 ¿Barata o cara?</div>
        <div className="val-txt">
          No se puede valorar por P/E: la empresa tuvo <strong>pérdida</strong> en 2025
          (no hay ganancia con qué dividir el precio).
        </div>
      </div>
    )
  }
  if (monedaPrecio !== ea.moneda) {
    const fx = epsAnualData.tipoCambioUSDPEN
    if (ea.moneda === 'USD' && monedaPrecio === 'PEN') eps = eps * fx
    else if (ea.moneda === 'PEN' && monedaPrecio === 'USD') eps = eps / fx
    nota = `(la ganancia se pasó a ${sim} con el tipo de cambio ${fx})`
  }

  const pe = px.precio / eps
  let estado, clase
  if (pe < rango.bajo) {
    estado = 'BARATA'
    clase = 'val-barata'
  } else if (pe > rango.alto) {
    estado = 'CARA'
    clase = 'val-cara'
  } else {
    estado = 'EN RANGO'
    clase = 'val-rango'
  }

  // EV/EBITDA = (valor de mercado + deuda neta) ÷ EBITDA anualizado. En la moneda de los estados.
  const r = empresa.evEbitdaRaw
  const rangoEV = escenariosData.rangoEVEBITDA?.[empresa.sector]
  let ev = null
  if (
    r && rangoEV && r.eps && r.eps > 0 && r.utilidadOperativa != null &&
    r.dya != null && r.utilidadNeta != null
  ) {
    const fx = epsAnualData.tipoCambioUSDPEN
    const acciones = r.utilidadNeta / r.eps
    // precio llevado a la moneda de los estados
    let precioEst = px.precio
    if (px.moneda === 'US$' && ea.moneda === 'PEN') precioEst = px.precio * fx
    else if (px.moneda === 'S/' && ea.moneda === 'USD') precioEst = px.precio / fx
    const capitalizacion = acciones * precioEst
    const deudaNeta = (r.deudaFinanciera || 0) - (r.efectivo || 0)
    const valorEmpresa = capitalizacion + deudaNeta
    const ebitdaAnual = (r.utilidadOperativa + r.dya) * 4
    if (ebitdaAnual > 0) {
      const ratio = valorEmpresa / ebitdaAnual
      let evEstado = 'en rango'
      if (ratio < rangoEV.bajo) evEstado = 'barata'
      else if (ratio > rangoEV.alto) evEstado = 'cara'
      ev = { ratio, estado: evEstado, rango: rangoEV }
    }
  }

  return (
    <div className={'val ' + clase}>
      <div className="val-tit">
        💎 ¿Barata o cara? <span className="val-estado">{estado}</span>
      </div>
      <div className="val-formula">
        P/E = precio ÷ ganancia anual por acción ={' '}
        {fmt(px.precio, sim)} ÷ {fmt(eps, sim)} = <strong>{pe.toFixed(1)}</strong>
        {nota && <span className="muted"> {nota}</span>}
      </div>
      <div className="val-barra">
        <span className="val-rango-txt">
          Rango justo del sector: <strong>{rango.bajo}–{rango.alto}</strong> ·{' '}
          {estado === 'BARATA' && `${pe.toFixed(1)} está por DEBAJO → más barata de lo normal`}
          {estado === 'CARA' && `${pe.toFixed(1)} está por ENCIMA → más cara de lo normal`}
          {estado === 'EN RANGO' && `${pe.toFixed(1)} cae DENTRO → precio normal para el sector`}
        </span>
      </div>
      {ev && (
        <div className="val-ev">
          <span className="val-ev-k">EV/EBITDA = <strong>{ev.ratio.toFixed(1)}</strong></span>{' '}
          <span className="muted">
            (valor de mercado + deuda neta) ÷ ganancia operativa anualizada · rango sector{' '}
            {ev.rango.bajo}–{ev.rango.alto} →{' '}
          </span>
          <span className={'val-ev-estado ' + (ev.estado === 'barata' ? 'evb' : ev.estado === 'cara' ? 'evc' : 'evr')}>
            {ev.estado.toUpperCase()}
          </span>
          <div className="muted" style={{ marginTop: 2 }}>
            <Glosado text="El EV/EBITDA mira la empresa entera (con su deuda neta), no solo el precio de la acción. Menor = más barata." />
          </div>
        </div>
      )}

      {px.sinNegociacionReciente && (
        <div className="val-aviso">
          ⚠️ Ojo: el precio es de un cierre antiguo (la acción casi no se negocia), así que este P/E puede no ser fiable.
        </div>
      )}
      {rango.ciclico && (
        <div className="val-aviso">
          ⚠️ Cuidado: en este sector el P/E ENGAÑA. Con el ciclo alto (metal/acero/pesca caros)
          la ganancia se infla y la acción parece barata justo cuando podría estar cara.
        </div>
      )}
    </div>
  )
}
