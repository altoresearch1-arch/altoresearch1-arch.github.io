import { macroDe } from '../lib/macro'
import {
  porAnio, esteAnio, fmtPrecio, mesCorto, fuenteCotizaciones, productoDe,
} from '../lib/cotizacion'

// ─────────────────────────────────────────────────────────────────────────
// 🏛️ EL OTRO MOTOR: tasa, dólar e inflación (23-jul-2026)
// Hermano de PrecioDelMotor.jsx. Aquel explica a las ~25 empresas que viven
// de vender una materia prima; este a los bancos, las inmobiliarias, el
// cemento, los seguros, el retail, el consumo masivo y la refinería que debe
// en dólares. Mismo caño (la API del BCRP), mismo componente visual (.motor),
// misma promesa: ningún número sin la cadena de causa-efecto que lo explica.
// Se reusan a propósito los helpers de cotizacion.js — la serie macro tiene
// exactamente la misma forma que la de un metal.
// Lo que NO hace, a propósito: comparar contra el precio de la acción. Con un
// metal esa resta se sostiene (sube el metal → sube la ganancia → sube la
// acción); con la tasa o la inflación la cadena pasa por demasiadas manos y
// poner las dos flechas lado a lado sugeriría una causalidad que no hay.
// ─────────────────────────────────────────────────────────────────────────

function Flecha({ pct, clase = '' }) {
  if (pct == null) return null
  const sube = pct >= 0
  return (
    <span className={`motor-var ${sube ? 'sube' : 'baja'} ${clase}`}>
      {sube ? '▲' : '▼'} {sube ? '+' : ''}{pct.toFixed(pct >= 100 || pct <= -100 ? 0 : 1)}%
    </span>
  )
}

export default function MotorMacro({ empresa }) {
  const m = macroDe(empresa)
  if (!m) return null
  const anios = porAnio(m)
  if (anios.length < 3) return null
  const anio = esteAnio(m)
  const max = Math.max(...anios.map((a) => a.valor))
  // ¿Viene subiendo o bajando? Con la tasa y la inflación, la DIRECCIÓN
  // importa más que el nivel: nadie sabe si 4.25% es mucho, pero todos
  // entienden "viene bajando desde hace dos años".
  const ultimoCambio = anios[anios.length - 1]?.cambio

  return (
    <div className="motor motor-macro" data-tour="motor-macro">
      {/* "el OTRO motor" solo si de verdad hay uno antes (Petroperú, que
          muestra los dos). En un banco este es EL motor, a secas. */}
      <div className="seccion-titulo">
        {m.icono} {m.nombre} — {m.titular},{' '}
        {productoDe(empresa) ? 'el otro motor' : 'el motor'} de esta empresa
      </div>

      <p className="motor-intro">
        <strong>Qué es:</strong> {m.queEs} Lo publica el BCRP todos los meses y no lo controla
        ninguna empresa de la Bolsa: lo reciben, como el clima.
      </p>

      <p className="motor-txt">{m.porQue}</p>

      {/* ── Año por año ── */}
      <div className="motor-sub">Así estuvo, año por año (promedio del año)</div>
      <div className="motor-barras">
        {anios.map((a) => (
          <div key={a.anio} className="motor-col">
            <div className="motor-valor">{fmtPrecio(a.valor, '')}</div>
            <div
              className={'motor-barra' + (a.parcial ? ' parcial' : '')}
              style={{ height: `${Math.max(8, (a.valor / max) * 100)}%` }}
              title={`${a.anio}: ${fmtPrecio(a.valor, m.unidad)}`}
            />
            <div className="motor-anio">{a.anio}</div>
            <Flecha pct={a.cambio} clase="motor-var-chica" />
          </div>
        ))}
      </div>
      <div className="motor-pieBarras muted">
        En {m.unidad}. La barra de {m.anioParcial} va punteada porque es un año EN CURSO: es el
        promedio de sus {m.mesesDelAnioParcial} primeros meses, no del año completo. Ojo con el
        porcentaje de esta serie: es cuánto cambió el NÚMERO (de 4.75 a 4.25 es −10.5%), no
        “medio punto”.
      </div>

      {/* ── Este año ── */}
      {/* La tasa de referencia se queda MESES clavada en el mismo número (el
          Directorio se reúne y decide no moverla). Cuando eso pasa, la fila de
          "mes más alto / mes más bajo" repite tres veces el mismo dato y el
          texto de abajo diría "viene subiendo" con un +0.0%. Se dice lo que
          de verdad pasó: no se movió. */}
      {anio && anio.alto.valor === anio.bajo.valor && (
        <>
          <div className="motor-sub">Y este año ({m.anioParcial}) no se ha movido</div>
          <p className="motor-txt">
            Lleva todo {m.anioParcial} clavada en{' '}
            <strong>{fmtPrecio(anio.ultimo.valor, m.unidad)}</strong> (de{' '}
            {mesCorto(anio.primero.mes)} a {mesCorto(anio.ultimo.mes)}). Que no se mueva también
            es información: el motor está quieto, así que lo que le pase a esta empresa este año
            no viene por aquí.
          </p>
        </>
      )}
      {anio && anio.alto.valor !== anio.bajo.valor && (
        <>
          <div className="motor-sub">Y este año ({m.anioParcial}) se movió así</div>
          <div className="motor-hitos">
            <div className="motor-hito">
              <span className="muted">arrancó en {mesCorto(anio.primero.mes)}</span>
              <strong>{fmtPrecio(anio.primero.valor, m.unidad)}</strong>
            </div>
            <div className="motor-hito">
              <span className="muted">su mes más alto ({mesCorto(anio.alto.mes)})</span>
              <strong>{fmtPrecio(anio.alto.valor, m.unidad)}</strong>
            </div>
            <div className="motor-hito">
              <span className="muted">su mes más bajo ({mesCorto(anio.bajo.mes)})</span>
              <strong>{fmtPrecio(anio.bajo.valor, m.unidad)}</strong>
            </div>
            <div className="motor-hito">
              <span className="muted">último dato ({mesCorto(anio.ultimo.mes)})</span>
              <strong>{fmtPrecio(anio.ultimo.valor, m.unidad)}</strong>
              <Flecha pct={anio.cambio} />
            </div>
          </div>
          <p className="motor-txt">
            {anio.cambio >= 0
              ? <>Viene <strong>subiendo</strong> dentro del año: {m.direccion.sube}. </>
              : <>Viene <strong>bajando</strong> dentro del año: {m.direccion.baja}. </>}
            {ultimoCambio != null && (
              <>Y contra el año pasado va {ultimoCambio >= 0 ? 'arriba' : 'abajo'}. </>
            )}
            No es una predicción de nada: es dónde está parado hoy el motor con el que se leen
            sus números.
          </p>
        </>
      )}

      <div className="motor-zona motor-zona-media">
        🔎 <strong>Qué mirar en esta empresa por esto:</strong> {m.mirar}. Ese es el número donde
        este motor se hace visible — no en los ingresos totales.
      </div>

      <div className="motor-fuente muted">
        Fuente: BCRP, series mensuales — {m.mercado} · serie {m.serieBCRP} · último mes
        publicado: {mesCorto(m.ultimo.mes)} · actualizado el {fuenteCotizaciones.actualizado}.
      </div>
    </div>
  )
}
