import { useState } from 'react'
import preciosData from '../data/precios.json'
import escenariosData from '../data/escenarios.json'

// Simulador EDUCATIVO "¿qué pasaría si?". NO predice ni recomienda.
// Modelo REALISTA: movimiento % desde el precio ACTUAL según cuánto suele moverse
// ese tipo de acción (minas mucho; consumo/textil poco). En su moneda (US$ o S/).

const NIVELES = [
  { id: 'bien', etiqueta: 'Si todo va bien', clase: 'nivel-bien', emoji: '🟢' },
  { id: 'regular', etiqueta: 'Si va regular', clase: 'nivel-regular', emoji: '🟡' },
  { id: 'mal', etiqueta: 'Si va mal', clase: 'nivel-mal', emoji: '🔴' },
]

function fmt(n, sim) {
  return `${sim} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtPct(x) {
  const s = (x * 100).toFixed(0)
  return (x > 0 ? '+' : '') + s + '%'
}

export default function Simulador({ empresa }) {
  const px = preciosData.precios?.[empresa.ticker]
  const mov = escenariosData.movimiento?.[empresa.sector]
  const condSector = escenariosData.condiciones?.[empresa.sector] || {}
  const condEmpresa = escenariosData.condicionesEmpresa?.[empresa.ticker] || {}
  const notaSector = escenariosData.notaSector?.[empresa.sector]

  // moneda en que cotiza la acción
  const sim = px?.moneda === 'US$' ? 'US$' : 'S/'
  const [monto, setMonto] = useState(sim === 'US$' ? 300 : 1000)

  if (!px || px.precio == null || !mov) return null

  const precio = px.precio
  const acciones = monto > 0 ? monto / precio : 0
  // 🚨 ANTES aquí había un amortiguador (damp 0.4) para las ilíquidas "porque
  // se mueven poco". Enseñaba lo contrario de la verdad: que una acción que
  // casi no negocia es más tranquila y por lo tanto más segura. La realidad
  // es que NO se mueve… hasta que se mueve de golpe (en la propia app hay
  // casos: FOSSAL 0.76→2.40, Andex 0.18→0.90), y su riesgo de verdad es no
  // encontrar a quién venderle. Se quitó el amortiguador y en su lugar el
  // escenario cambia de MENSAJE (error E2 del análisis educativo).
  const damp = 1

  return (
    <div className="sim">
      <div className="seccion-titulo">🎯 Simulador: ¿qué pasaría si invierto?</div>

      <div className="sim-monto">
        <label>Si invierto</label>
        <div className="sim-input">
          <span>{sim}</span>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="cualquier monto"
            value={monto}
            onChange={(e) => setMonto(Number(e.target.value) || 0)}
          />
        </div>
        <div className="muted">
          ≈ {acciones.toFixed(0)} acciones a {fmt(precio, sim)} c/u
          {px.sinNegociacionReciente && ' · precio del último cierre disponible'}
        </div>
      </div>

      <div className="sim-niveles">
        {NIVELES.map((n) => {
          const cambio = mov[n.id] * damp
          const precioEsc = precio * (1 + cambio)
          const valor = acciones * precioEsc
          const dif = valor - monto
          const cond = condEmpresa[n.id] || condSector[n.id]
          return (
            <div key={n.id} className={'sim-card ' + n.clase}>
              <div className="sim-card-top">
                <span className="sim-nivel">{n.emoji} {n.etiqueta}</span>
                <span className="sim-pe muted">{fmtPct(cambio)}</span>
              </div>
              <div className="sim-precio">{fmt(precioEsc, sim)}<span className="muted"> /acción</span></div>
              <div className="sim-valor">
                Tu inversión valdría <strong>{fmt(valor, sim)}</strong>{' '}
                <span className={dif >= 0 ? 'sim-sube' : 'sim-baja'}>
                  ({dif >= 0 ? '+' : ''}{fmt(dif, sim)})
                </span>
              </div>
              {cond && (
                <div className="sim-cond" title={cond}>
                  <span className="sim-cond-q">¿cuándo?</span> {cond}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {px.sinNegociacionReciente && (
        <div className="sim-nota sim-nota-iliquida">
          ⚠️ Esta acción casi no se negocia, y eso cambia el ejercicio de arriba: aquí el riesgo
          principal <strong>no es el porcentaje</strong> — es que el día que quieras vender no haya
          nadie del otro lado, o que tengas que rematarla mucho más barata. Y cuando por fin se
          mueve, suele hacerlo <strong>de golpe</strong>, no de a pocos. Que no se mueva no significa
          que sea tranquila: significa que casi nadie la compra.
        </div>
      )}

      {notaSector && <div className="sim-nota">ℹ️ {notaSector}</div>}

      <div className="sim-disclaimer">
        <strong>Esto es un ejercicio educativo, NO una predicción ni una recomendación.</strong>{' '}
        Los porcentajes son un estimado de cuánto SUELE moverse este tipo de acción, no lo que
        va a pasar. El precio real lo decide el mercado y puede ser muy distinto — puedes perder
        dinero. ALTO no recomienda comprar.
      </div>
    </div>
  )
}
