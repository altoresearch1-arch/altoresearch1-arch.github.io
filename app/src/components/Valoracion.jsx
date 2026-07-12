import preciosData from '../data/precios.json'
import epsAnualData from '../data/eps_anual.json'
import escenariosData from '../data/escenarios.json'
import Glosado from './Glosado'

// ¿La acción está barata, en rango o cara? Método: P/E actual vs el rango justo del
// sector. P/E = precio (BVL) ÷ ganancia anual por acción (SMV). Educativo y con la fórmula.

function fmt(n, sim) {
  return `${sim} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Montos de "empresa entera" (capitalización, deuda, EBITDA) vienen en cientos de
// millones: mostrarlos con 2 decimales completos es ilegible. Se abrevian en M/MM,
// igual que ya lo hace enrich_tips.py en las tarjetas de tips ("US$ 66.7 M").
function fmtGrande(n, sim) {
  const signo = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${signo}${sim} ${(abs / 1e9).toFixed(2)} MM`
  if (abs >= 1e6) return `${signo}${sim} ${(abs / 1e6).toFixed(1)} M`
  if (abs >= 1e3) return `${signo}${sim} ${(abs / 1e3).toFixed(1)} mil`
  return fmt(n, sim)
}

export default function Valoracion({ empresa }) {
  const px = preciosData.precios?.[empresa.ticker]
  const ea = epsAnualData.eps?.[empresa.ticker]
  const rango = escenariosData.rangoPE?.[empresa.sector]
  if (!px || px.precio == null || !ea || ea.epsAnual == null || !rango) return null

  // EPS anual llevado a la moneda del precio
  const sim = px.moneda === 'US$' ? 'US$' : 'S/'
  const monedaPrecio = px.moneda === 'US$' ? 'USD' : 'PEN'
  const tienePerdida = ea.epsAnual <= 0
  let eps = ea.epsAnual
  let nota = null
  let pe = null
  let estado = null
  let clase = 'val-perdida'
  if (!tienePerdida) {
    if (monedaPrecio !== ea.moneda) {
      const fx = epsAnualData.tipoCambioUSDPEN
      if (ea.moneda === 'USD' && monedaPrecio === 'PEN') eps = eps * fx
      else if (ea.moneda === 'PEN' && monedaPrecio === 'USD') eps = eps / fx
      nota = `(la ganancia se pasó a ${sim} con el tipo de cambio ${fx})`
    }
    pe = px.precio / eps
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
  }

  // EV/EBITDA = (valor de mercado + deuda neta) ÷ EBITDA anualizado. A diferencia del
  // P/E, SÍ funciona aunque la empresa tenga pérdida NETA (usa ganancia OPERATIVA) —
  // por eso se calcula aparte y se muestra para todas, incluso cuando arriba dice
  // "no se puede valorar por P/E".
  // La depreciación y amortización (D&A) sale del flujo de caja del XBRL de la SMV.
  // PERO ~70 de 94 empresas (todas las mineras grandes, Alicorp, Gloria, Unacem…)
  // presentan su flujo de caja en forma ABREVIADA: reportan el efectivo de operación
  // en una sola línea y NUNCA taguean la depreciación por separado. No es que la
  // pongan bajo otro nombre — sencillamente no está en el archivo estructurado (ni en
  // el trimestral ni en el anual; verificado con BVN/Volcan/Minsur/Brocal/Alicorp).
  // Por eso, cuando falta la D&A caemos al EV/EBIT (ganancia OPERATIVA sin sumarle la
  // depreciación): usa solo datos que sí están en la fuente y así la valoración por
  // "empresa entera" aparece para TODAS, sin inventar el número que la SMV no publicó.
  const r = empresa.evEbitdaRaw
  const rangoEV = escenariosData.rangoEVEBITDA?.[empresa.sector]
  let ev = null       // EV/EBITDA con veredicto barata/cara vs el rango del sector
  let evEbit = null   // EV/EBIT informativo (cuando la empresa no publicó la D&A)

  // ¿Es de fiar el nº de acciones? Se deriva de evEbitdaRaw.eps (EPS trimestral del
  // XBRL individual), que en algunas empresas viene DISTORSIONADO por clase de acción
  // o por ser holding (Minsur, Backus, Volcan…): eso desinfla la capitalización y
  // falsea el EV. Lo validamos contra el EPS anual confiable (ea.epsAnual, de
  // stockanalysis / EE.FF. corregidos): si, anualizado y en la misma moneda, difieren
  // por más de ~4x, es señal de distorsión y preferimos NO mostrar un EV inventado.
  let capConfiable = false
  if (r && r.eps && ea.epsAnual) {
    const fx = epsAnualData.tipoCambioUSDPEN
    const mEst = empresa.monedaEstados
    let epsRawAnual = r.eps * 4
    let convOk = true
    if (mEst === ea.moneda) { /* misma moneda, sin conversión */ }
    else if (mEst === 'USD' && ea.moneda === 'PEN') epsRawAnual *= fx
    else if (mEst === 'PEN' && ea.moneda === 'USD') epsRawAnual /= fx
    else convOk = false  // CAD / desconocida: no verificable → mejor no arriesgar
    if (convOk) {
      const ratio = Math.abs(epsRawAnual) / Math.abs(ea.epsAnual)
      capConfiable = ratio >= 0.25 && ratio <= 4
    }
  }

  const simEstados = ea.moneda === 'USD' ? 'US$' : 'S/'

  if (capConfiable && r && r.utilidadOperativa != null && r.utilidadNeta != null) {
    const fx = epsAnualData.tipoCambioUSDPEN
    const acciones = r.utilidadNeta / r.eps
    // precio llevado a la moneda de los estados
    let precioEst = px.precio
    if (px.moneda === 'US$' && ea.moneda === 'PEN') precioEst = px.precio * fx
    else if (px.moneda === 'S/' && ea.moneda === 'USD') precioEst = px.precio / fx
    const capitalizacion = acciones * precioEst
    const deudaNeta = (r.deudaFinanciera || 0) - (r.efectivo || 0)
    const valorEmpresa = capitalizacion + deudaNeta
    if (r.dya != null && rangoEV) {
      // Camino ideal: sí tenemos la depreciación → EV/EBITDA de verdad, con veredicto.
      const ebitdaAnual = (r.utilidadOperativa + r.dya) * 4
      if (ebitdaAnual > 0 && valorEmpresa > 0) {
        const ratio = valorEmpresa / ebitdaAnual
        let evEstado = 'en rango'
        if (ratio < rangoEV.bajo) evEstado = 'barata'
        else if (ratio > rangoEV.alto) evEstado = 'cara'
        ev = { ratio, estado: evEstado, rango: rangoEV, capitalizacion, deudaNeta, ganancia: ebitdaAnual }
      }
    } else {
      // Fallback honesto: sin D&A no se puede armar el EBITDA. Mostramos EV/EBIT.
      // Corre un poco MÁS ALTO que el EV/EBITDA (no se le suma la depreciación), así
      // que NO lo comparamos contra los rangos del sector (que son de EV/EBITDA) para
      // no marcar "cara" a todo el mundo por error: va sin veredicto, solo el número.
      const ebitAnual = r.utilidadOperativa * 4
      if (ebitAnual > 0 && valorEmpresa > 0) {
        evEbit = { ratio: valorEmpresa / ebitAnual, capitalizacion, deudaNeta, ganancia: ebitAnual, rango: rangoEV }
      }
    }
  }

  return (
    <div className={'val ' + clase}>
      <div className="val-tit">
        💎 ¿Barata o cara? {estado && <span className="val-estado">{estado}</span>}
      </div>

      {tienePerdida ? (
        <div className="val-txt">
          No se puede valorar por <Glosado text="P/E" />: la empresa tuvo <strong>pérdida</strong> en 2025
          (no hay ganancia con qué dividir el precio).
          {(ev || evEbit) && <> Mira el múltiplo de empresa entera de abajo — ese usa la ganancia <strong>operativa</strong>, así que sí funciona con pérdida neta.</>}
        </div>
      ) : (
        <>
          <div className="val-txt">
            El <Glosado text="P/E" /> es el más usado para saber si el precio de hoy es razonable: te dice
            cuántos años de la ganancia actual de la empresa estarías pagando por tener una acción.
            Menos = más barata; más = más cara — siempre comparado contra su sector.
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
        </>
      )}

      {ev && (
        <div className="val-ev">
          <div className="val-txt">
            <Glosado text="El EV/EBITDA mira la empresa ENTERA: lo que costaría comprarla toda, con su deuda incluida, frente a su ganancia operativa (antes de intereses, impuestos, depreciación y amortización) — el motor real del negocio, sin maquillaje contable. A diferencia del P/E, sí funciona con pérdida neta y no se deja engañar por empresas muy endeudadas: menos = más barata." />
          </div>
          <div className="val-formula">
            EV/EBITDA = (valor de mercado + deuda neta) ÷ ganancia operativa anualizada ={' '}
            ({fmtGrande(ev.capitalizacion, simEstados)} + {fmtGrande(ev.deudaNeta, simEstados)}) ÷{' '}
            {fmtGrande(ev.ganancia, simEstados)} = <strong>{ev.ratio.toFixed(1)}</strong>
          </div>
          <div className="val-barra">
            <span className="val-rango-txt">
              Rango justo del sector: <strong>{ev.rango.bajo}–{ev.rango.alto}</strong> ·{' '}
              {ev.estado === 'barata' && `${ev.ratio.toFixed(1)} está por DEBAJO → más barata de lo normal`}
              {ev.estado === 'cara' && `${ev.ratio.toFixed(1)} está por ENCIMA → más cara de lo normal`}
              {ev.estado === 'en rango' && `${ev.ratio.toFixed(1)} cae DENTRO → precio normal para el sector`}
            </span>
          </div>
        </div>
      )}

      {evEbit && (
        <div className="val-ev">
          <div className="val-txt">
            <Glosado text="Aquí no se pudo calcular el EV/EBITDA: esta empresa presentó su flujo de caja en forma resumida y no publicó su depreciación y amortización, así que no hay con qué sumarla. En su lugar mostramos el EV/EBIT: la empresa entera (valor de mercado + deuda neta) frente a su ganancia operativa. Es primo del EV/EBITDA pero un poco más exigente (no le devuelve la depreciación), por eso corre algo más alto — va sin veredicto de “barata/cara” para no marcarla mal por esa diferencia." />
          </div>
          <div className="val-formula">
            EV/EBIT = (valor de mercado + deuda neta) ÷ ganancia operativa anualizada ={' '}
            ({fmtGrande(evEbit.capitalizacion, simEstados)} + {fmtGrande(evEbit.deudaNeta, simEstados)}) ÷{' '}
            {fmtGrande(evEbit.ganancia, simEstados)} = <strong>{evEbit.ratio.toFixed(1)}</strong>
          </div>
          {evEbit.rango && (
            <div className="val-barra">
              <span className="val-rango-txt">
                Referencia (rango de <Glosado text="EV/EBITDA" /> del sector, no de <Glosado text="EV/EBIT" />):{' '}
                <strong>{evEbit.rango.bajo}–{evEbit.rango.alto}</strong>{' '}
                · como este <Glosado text="EV/EBIT" /> no lleva la <Glosado text="depreciación y amortización" /> de
                vuelta, suele salir por ENCIMA de ese rango aunque la empresa no esté cara — úsalo para comparar
                entre empresas parecidas, no contra este número.
              </span>
            </div>
          )}
        </div>
      )}

      {!tienePerdida && px.sinNegociacionReciente && (
        <div className="val-aviso">
          ⚠️ Ojo: el precio es de un cierre antiguo (la acción casi no se negocia), así que este P/E puede no ser fiable.
        </div>
      )}
      {!tienePerdida && rango.ciclico && (
        <div className="val-aviso">
          ⚠️ Cuidado: en este sector el P/E ENGAÑA. Con el ciclo alto (metal/acero/pesca caros)
          la ganancia se infla y la acción parece barata justo cuando podría estar cara.
        </div>
      )}
    </div>
  )
}
