import { lenteDe } from '../lib/lente'
import {
  productoDe, porAnio, racha, esteAnio, contraLaAccion, zonaDelCiclo,
  fmtPrecio, mesCorto, fuenteCotizaciones,
} from '../lib/cotizacion'

// ─────────────────────────────────────────────────────────────────────────
// 🥇 EL PRECIO DE SU MOTOR (mejora #116 — pedido de Jair, 22-jul-2026):
// "pon así estuvieron en ese año y fueron subiendo cada año; a inicios de
//  2026 bajaron y subieron mucho — y esto cambia el precio de la acción".
// Tres bloques, en ese orden:
//   1. AÑO POR AÑO: una barra por año con su promedio y su ▲/▼ contra el
//      anterior. Es la respuesta a "¿viene subiendo?".
//   2. ESTE AÑO: el vaivén — de cuánto arrancó, a cuánto llegó, y cuánto hay
//      entre su mes más alto y el más bajo (el promedio esconde el viaje).
//   3. ¿Y LA ACCIÓN?: las dos restas puestas lado a lado, últimos 12 meses.
//      Sin correlaciones ni estadística: números que el usuario puede rehacer.
// Datos del BCRP (oficiales). Si falta un pedazo, ese bloque no se dibuja.
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

export default function PrecioDelMotor({ empresa }) {
  const prod = productoDe(empresa)
  if (!prod) return null
  const l = lenteDe(empresa)
  const anios = porAnio(prod)
  if (anios.length < 3) return null

  const seguidos = racha(prod)
  const anio = esteAnio(prod)
  const vs = contraLaAccion(empresa, prod)
  const ciclo = zonaDelCiclo(prod)
  const max = Math.max(...anios.map((a) => a.valor))

  return (
    <div className="motor" data-tour="motor">
      <div className="seccion-titulo">
        {prod.icono} El precio {prod.conArticulo} — el motor de esta empresa
      </div>

      <p className="motor-intro">
        {l && <>Esta empresa vive de <strong>{l.viveDe}</strong>. </>}
        Por eso este precio manda más que cualquier decisión de su gerencia: la empresa no lo
        controla, lo recibe. Está en <strong>{prod.unidadLarga}</strong> y lo fija el mercado
        internacional ({prod.mercado}).
        {prod.rol === 'ambos' && (
          <> <strong>Ojo con este caso:</strong> aquí el petróleo entra por los dos lados — es su
            materia prima Y la referencia del precio al que vende. Lo que le queda es la
            DIFERENCIA entre ambos, así que un petróleo caro no es automáticamente bueno para
            ella (a diferencia de una minera, que sí vende el metal caro).</>
        )}
      </p>

      {/* ── 1. Así estuvo cada año ── */}
      <div className="motor-sub">Así estuvo, año por año (promedio del año)</div>
      <div className="motor-barras">
        {anios.map((a) => (
          <div key={a.anio} className="motor-col">
            <div className="motor-valor">{fmtPrecio(a.valor, '')}</div>
            <div
              className={'motor-barra' + (a.parcial ? ' parcial' : '')}
              style={{ height: `${Math.max(8, (a.valor / max) * 100)}%` }}
              title={`${a.anio}: ${fmtPrecio(a.valor, prod.unidad)}`}
            />
            <div className="motor-anio">{a.anio}</div>
            <Flecha pct={a.cambio} clase="motor-var-chica" />
          </div>
        ))}
      </div>
      <div className="motor-pieBarras muted">
        En {prod.unidad}. La barra de {prod.anioParcial} va punteada porque es un año EN CURSO:
        es el promedio de sus {anios[anios.length - 1] && prod.mesesDelAnioParcial} primeros meses,
        no del año completo.
      </div>

      {seguidos.anios >= 2 && (
        <p className="motor-racha">
          📈 Viene <strong>{seguidos.anios} años seguidos subiendo</strong>
          {seguidos.enCursoSube && <> (y {prod.anioParcial}, en curso, también va arriba)</>}. Ojo
          con la conclusión fácil: que haya subido {seguidos.anios} años no dice nada de lo que hará el siguiente — los precios de
          las materias primas van en CICLOS, y cada ciclo de subida de la historia terminó en algún
          momento. Lo útil de esta racha no es predecir: es entender que las ganancias que la
          empresa muestra hoy están calculadas con el precio de esta parte del ciclo.
        </p>
      )}

      {/* ── 2. Y esto es lo que hizo este año ── */}
      {anio && (
        <>
          <div className="motor-sub">Y este año ({prod.anioParcial}) se movió así</div>
          <div className="motor-esteanio">
            <div className="motor-hito">
              <span className="muted">arrancó en {mesCorto(anio.primero.mes)}</span>
              <strong>{fmtPrecio(anio.primero.valor, prod.unidad)}</strong>
            </div>
            <div className="motor-hito">
              <span className="muted">su mes más alto ({mesCorto(anio.alto.mes)})</span>
              <strong>{fmtPrecio(anio.alto.valor, prod.unidad)}</strong>
            </div>
            <div className="motor-hito">
              <span className="muted">su mes más bajo ({mesCorto(anio.bajo.mes)})</span>
              <strong>{fmtPrecio(anio.bajo.valor, prod.unidad)}</strong>
            </div>
            <div className="motor-hito">
              <span className="muted">último dato ({mesCorto(anio.ultimo.mes)})</span>
              <strong>{fmtPrecio(anio.ultimo.valor, prod.unidad)}</strong>
              <Flecha pct={anio.cambio} />
            </div>
          </div>
          <p className="motor-txt">
            Entre su mejor y su peor mes de este año hay un <strong>{anio.vaiven.toFixed(0)}%</strong> de
            diferencia{anio.subioDespues
              ? ' — primero cayó y después se recuperó'
              : ' — primero subió y después cedió'}. Ese vaivén es la parte que el promedio anual
            esconde, y es exactamente lo que hace que una minera con la misma mina, la misma
            gente y el mismo plan gane mucho un trimestre y poco el siguiente.
          </p>
        </>
      )}

      {/* ── 3. ¿Y qué tiene que ver con el precio de la acción? ── */}
      {vs && (
        <div className="motor-accion">
          <div className="motor-sub">¿Y esto qué tiene que ver con el precio de la acción?</div>
          <div className="motor-duelo">
            <div className="motor-duelo-lado">
              <div className="muted">{prod.nombre}</div>
              <Flecha pct={vs.producto} />
              <div className="muted motor-duelo-detalle">
                {mesCorto(vs.desde)} → {mesCorto(vs.hasta)}
              </div>
            </div>
            <div className="motor-duelo-vs">vs</div>
            <div className="motor-duelo-lado">
              <div className="muted">Acción de {empresa.ticker}</div>
              <Flecha pct={vs.accion} />
              <div className="muted motor-duelo-detalle">
                {vs.precioIni.moneda} {vs.precioIni.precio} → {vs.precioFin.moneda} {vs.precioFin.precio}
              </div>
            </div>
          </div>
          {prod.rol === 'ambos' ? (
            <p className="motor-txt">
              Aquí la cadena NO es directa: como el crudo es a la vez su costo y la referencia del
              precio al que vende, lo que manda es el <strong>margen</strong> entre comprar crudo y
              vender combustible, no el precio suelto. Por eso estas dos cifras pueden moverse en
              sentidos distintos sin que nada esté mal — para esta empresa, mira su margen en los
              fundamentos antes que el precio del barril.
            </p>
          ) : (
            <p className="motor-txt">
              La cadena es esta: <strong>sube el precio {prod.conArticulo}</strong> → la empresa
              cobra más por lo mismo que ya producía y sus costos casi no se mueven →{' '}
              <strong>su ganancia sube mucho más que el precio</strong> → los que compran acciones
              pagan por esa ganancia → <strong>sube la acción</strong>. Por eso el vaivén de la
              acción suele ser MÁS grande que el del propio precio, para arriba y para abajo.
              {Math.abs(vs.accion) > Math.abs(vs.producto) * 1.2 && (
                <> Aquí se ve en números: el precio {prod.conArticulo} se movió{' '}
                  {vs.producto.toFixed(0)}% y la acción {vs.accion.toFixed(0)}%.</>
              )}
            </p>
          )}
          <p className="motor-txt muted">
            Ojo con leer esto como una fórmula: en el mismo periodo también pesaron sus costos, su
            producción, su deuda y el humor del mercado. Son dos restas puestas lado a lado para que
            veas la relación — no una regla de tres.
          </p>
        </div>
      )}

      {/* Contexto de ciclo (#53): dónde está el precio de hoy vs su propia historia */}
      {ciclo && (
        <div className={'motor-zona motor-zona-' + ciclo.zona}>
          🌡 <strong>Dónde está hoy:</strong> el precio promedio {prod.conArticulo} en los
          últimos 5 años cerrados ({ciclo.anios[0]}–{ciclo.anios[ciclo.anios.length - 1]}) fue{' '}
          {fmtPrecio(ciclo.promedio5a, prod.unidad)}. Hoy está{' '}
          <strong>{ciclo.pct >= 0 ? `${ciclo.pct.toFixed(0)}% por encima` : `${Math.abs(ciclo.pct).toFixed(0)}% por debajo`}</strong> de
          ese promedio — zona <strong>{ciclo.zona}</strong> de su propio ciclo.
          {ciclo.zona === 'alta' && ' Con el precio en zona alta, sus ganancias de hoy son las de una temporada buena: es el momento en que un P/E bajo engaña más.'}
          {ciclo.zona === 'baja' && ' Con el precio en zona baja, sus ganancias de hoy son las de una temporada mala: es el momento en que un P/E alto (o una pérdida) asusta más de lo que debería.'}
          {ciclo.zona === 'media' && ' Está cerca de su propio promedio: sus ganancias de hoy no vienen ni de una temporada excepcional ni de una mala.'}
        </div>
      )}

      <div className="motor-fuente muted">
        Fuente: {fuenteCotizaciones.fuente} · serie {prod.serieBCRP} · último mes publicado:{' '}
        {mesCorto(prod.ultimo.mes)}. Son promedios MENSUALES: el precio de un día concreto puede
        estar bastante arriba o abajo de estos números.
      </div>
    </div>
  )
}
