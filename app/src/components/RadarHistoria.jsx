import { useMemo, useState } from 'react'
import { historiaDelPlazo } from '../lib/radar'

// 📚 LO QUE PASÓ ANTES — la memoria del Radar.
//
// El resto de la pantalla dice qué se movió HOY. Este bloque dice si lo que
// buscas cabe en el plazo que estás mirando, y sale de recorrer 18 meses de
// cierres reales en ventanas deslizantes. Fue lo que destapó dos cosas que
// nadie hubiera adivinado a ojo:
//   · a 1 día y 1 semana lideran las ACERERAS, no las minas;
//   · buscar +5% en un solo día pasa el 3% de las veces.
//
// Y la tabla de empresas va con las DOS caras. Mirar solo «cuántas veces
// pasó de +5%» premia a la más volátil: PML lo hace el 45% de las veces a
// dos semanas… y cae -5% el 30%, con volatilidad de 80%. Eso no es cazar,
// es una moneda al aire. Por eso manda el SALDO.

const NOMBRE_SECTOR = {
  minas: 'Minas', acereras: 'Acereras', cemento: 'Cemento', bancos: 'Bancos',
  electricas: 'Eléctricas', alimentos: 'Alimentos', retail: 'Retail',
  textil: 'Textil', pesqueras: 'Pesqueras', fondos: 'Fondos y ETF', diversas: 'Diversas',
}
const nombreSector = (s) => NOMBRE_SECTOR[s] || s

const TOPE_INICIAL = 8

export default function RadarHistoria({ ruedas, plazo, onVerEmpresa }) {
  const h = useMemo(() => historiaDelPlazo(ruedas), [ruedas])
  const [verTodas, setVerTodas] = useState(false)

  if (!h) return null

  const empresas = verTodas ? h.empresas : h.empresas.slice(0, TOPE_INICIAL)
  const topeBarra = Math.max(...h.empresas.map((e) => Math.max(e.sube5, e.baja5)), 1)

  return (
    <div className="card historia">
      <h3 style={{ margin: '0 0 4px' }}>📚 Lo que pasó antes, a este plazo</h3>
      <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
        {h.ventanas.toLocaleString('es-PE')} ventanas de <b>{plazo.etiqueta}</b>{' '}
        recorridas sobre los cierres reales de la BVL, del {h.desde} al {h.hasta}.
      </p>

      {/* El dato que decide si el plazo te sirve */}
      <div className="hist-titular">
        <div className="hist-numero">{h.liderPasa5.toFixed(0)}%</div>
        <div className="hist-texto">
          de las veces, <b>el sector líder</b> superó el <b>+5%</b> en {plazo.etiqueta}.
          {h.liderPasa5 < 15 && (
            <> Dicho claro: a este plazo el 5% <b>casi no ocurre</b>, ni siquiera
            en el mejor sector del mercado.</>
          )}
          {h.liderPasa5 >= 15 && h.liderPasa5 < 45 && (
            <> Ocurre, pero no es lo normal: hay que elegir bien.</>
          )}
          {h.liderPasa5 >= 45 && (
            <> Es un plazo donde el 5% es alcanzable — aunque el {(100 - h.liderPasa5).toFixed(0)}%
            de las veces ni el mejor sector lo dio.</>
          )}{' '}
          El líder típico hizo <b>{h.liderTipico >= 0 ? '+' : '−'}
          {Math.abs(h.liderTipico).toFixed(1)}%</b>.
        </div>
      </div>

      {/* Quién manda a este plazo */}
      <div className="hist-tit">Quién lideró más seguido</div>
      <div className="hist-sectores">
        {h.sectores.map((s) => (
          <div key={s.sector} className="hist-sector">
            <span className="hist-sector-nom">{nombreSector(s.sector)}</span>
            <span className="hist-sector-barra">
              <i style={{ width: `${(s.pct / h.sectores[0].pct) * 100}%` }} />
            </span>
            <span className="hist-sector-pct">{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>

      {/* Empresa por empresa, con las dos caras */}
      <div className="hist-tit">
        Empresa por empresa — cuántas veces se movió ±5%
      </div>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: 12 }}>
        Ordenadas por <b>saldo</b> (veces que subió 5% menos veces que cayó 5%),
        no por cuántas veces subió. Mirar solo la subida premia a la más
        volátil: es la que más sube <i>y</i> la que más se derrumba.
      </p>
      <div className="hist-tabla">
        <div className="hist-fila hist-cab">
          <span>empresa</span>
          <span className="hist-num">+5%</span>
          <span className="hist-num">−5%</span>
          <span className="hist-num">saldo</span>
          <span className="hist-num">vol.</span>
        </div>
        {empresas.map((e) => (
          <button key={e.ticker} className="hist-fila" onClick={() => onVerEmpresa?.(e.ticker)}>
            <span className="hist-emp">
              <b>{e.ticker}</b>
              <span className="muted"> {e.nombre}</span>
              <span className="hist-sec">{nombreSector(e.sector)}</span>
            </span>
            <span className="hist-num sube">
              <i className="hist-mini sube-bg" style={{ width: `${(e.sube5 / topeBarra) * 100}%` }} />
              {e.sube5.toFixed(0)}%
            </span>
            <span className="hist-num baja">
              <i className="hist-mini baja-bg" style={{ width: `${(e.baja5 / topeBarra) * 100}%` }} />
              {e.baja5.toFixed(0)}%
            </span>
            <span className={'hist-num hist-saldo ' + (e.saldo >= 0 ? 'sube' : 'baja')}>
              {e.saldo >= 0 ? '+' : '−'}{Math.abs(e.saldo).toFixed(0)}pp
            </span>
            <span className="hist-num muted">
              {e.volatilidadAnualPct != null ? `${e.volatilidadAnualPct.toFixed(0)}%` : '—'}
            </span>
          </button>
        ))}
      </div>
      {h.empresas.length > TOPE_INICIAL && (
        <button className="muro-mas" onClick={() => setVerTodas((v) => !v)}>
          {verTodas ? 'ver solo las 8 primeras' : `ver las ${h.empresas.length - TOPE_INICIAL} restantes`}
        </button>
      )}

      <p className="muted" style={{ fontSize: 12, marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>
        <b>Cuidado con leer esto como una promesa.</b> Son 18 meses en los que
        la BVL subió: por eso casi todas salen con saldo positivo. No es que
        sean buenas — es que el periodo lo fue, y un tramo de bajada daría lo
        contrario. Esto describe lo que pasó, no lo que va a pasar.
      </p>
    </div>
  )
}
