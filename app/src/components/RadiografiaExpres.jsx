import { useState } from 'react'
import { historicoDe, cambio6M, veredictoPE, dividendosDe, pagaDividendos } from '../lib/finanzas'
import { deudaInfo, esCiclico, lenteDe, aniosTexto, PALABRA_DEUDA } from '../lib/lente'
import { NIVELES } from '../lib/nivel'

// 🩻 Radiografía exprés: la empresa en 10 segundos — SIEMPRE los datos, en
// todos los niveles (pedido de Jair 15-jul: "deja esos globos").
// Lo que cambia es el PORQUÉ:
// · Niveles 1-2: el medidor de movimiento y la valoración con fórmula NO
//   existen abajo (NIVEL_SECCION los pone en 3). Esos tiles muestran solo
//   el veredicto y, al tocarlos, invitan a subir de nivel — la curiosidad
//   hace que el usuario suba solo.
// · Niveles 3-4: cada tile baja con scroll suave a su sección de detalle.
// Cero datos nuevos: todo sale de los mismos cálculos verificados de
// Sparkline/DividendoResumen/Valoracion/Termometro/lib/lente.
// Regla de Oro #1: si un dato falta, el tile lo dice — no se inventa.
//
// 🚨 REGLA QUE NACE DEL PLAN EDUCATIVO (#113): las ADVERTENCIAS jamás se
// esconden por nivel. El nivel esconde profundidad, nunca peligro. Por eso
// el "P/E referencial (precio viejo)" y el asterisco de ciclo (#44) se ven
// también en niveles 1-2, aunque el resto de la nota sea el anzuelo.

const ETIQUETA_MOVIMIENTO = {
  tranquila: { valor: 'Tranquila', nota: 'se mueve poco día a día' },
  'se mueve': { valor: 'Se mueve', nota: 'sube y baja como una típica' },
  'montaña rusa': { valor: 'Montaña rusa', nota: 'salta MUCHO día a día' },
  'poco negociada': { valor: 'Poco negociada', nota: 'casi no cambia de manos' },
}

const ETIQUETA_VALORACION = {
  BARATA: { valor: 'Barata', nota: 'frente a su sector (P/E)', tono: 'bien' },
  'EN RANGO': { valor: 'En rango', nota: 'precio normal para su sector', tono: 'neutro' },
  CARA: { valor: 'Cara', nota: 'frente a su sector (P/E)', tono: 'mal' },
}

function Tile({ icono, k, valor, nota, tono = 'neutro', destino, gancho, onTocar }) {
  const ir = () => {
    if (onTocar) return onTocar()
    document.getElementById(destino)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <button type="button" className={'rx-tile rx-' + tono} onClick={ir}>
      <span className="rx-k">{icono} {k}</span>
      <span className="rx-v">{valor}</span>
      <span className={'rx-nota' + (gancho ? ' rx-nota-gancho' : '')}>{nota}</span>
    </button>
  )
}

export default function RadiografiaExpres({ empresa, nivel = 4, onSubirNivel }) {
  const t = empresa.ticker
  // Niveles 1-2: el porqué (medidor + fórmula) vive en el nivel 3 — anzuelo.
  const anzuelo = nivel <= 2
  // Qué nivel invita cada tile (null = no hay invitación abierta)
  const [invita, setInvita] = useState(null)

  // 1) Últimos 6 meses (cierres reales BVL)
  const pct = cambio6M(t)
  const h = historicoDe(t)
  const ilquida = h?.volatilidadEtiqueta === 'poco negociada'
  const tPrecio = pct != null
    ? {
        valor: `${pct >= 0 ? '▲ subió' : '▼ bajó'} ${Math.abs(pct).toFixed(1)}%`,
        nota: 'cierres reales BVL',
        tono: pct >= 0 ? 'bien' : 'mal',
      }
    : ilquida
      ? { valor: 'Poco negociada', nota: 'sin precio fresco que comparar', tono: 'neutro' }
      : { valor: 'Sin serie', nota: 'la BVL no publica su histórico', tono: 'neutro' }

  // 2) Dividendos
  const dv = dividendosDe(t)
  const paga = pagaDividendos(t)
  const tDiv = paga
    ? { valor: 'Sí paga', nota: dv?.yield ? `rinde ${dv.yield} al año` : 'ver pagos abajo', tono: 'bien' }
    : { valor: 'No reparte', nota: 'sin dividendos regulares', tono: 'neutro' }

  // 3) ¿Barata o cara? (P/E vs rango del sector — método de Valoracion.jsx)
  const lente = lenteDe(empresa)
  const ciclico = esCiclico(empresa)
  const val = veredictoPE(t, empresa.sector)
  const tVal = val == null
    ? { valor: 'Sin dato', nota: 'faltan precio o ganancia anual', tono: 'neutro' }
    : val.perdida
      ? { valor: 'Tuvo pérdida', nota: 'no hay P/E que comparar', tono: 'mal' }
      : ETIQUETA_VALORACION[val.estado]
  // (#44) El asterisco de ciclo SUBE al globo: "Barata" pelada en una cíclica
  // era el mayor riesgo educativo de la app. (#113) Y el aviso de precio
  // viejo se ve SIEMPRE, con anzuelo o sin él.
  const conAsterisco = ciclico && val && !val.perdida
  const avisos = []
  if (conAsterisco) avisos.push(`* es ${lente.nombre.toLowerCase()}: su ganancia sube y baja con ${lente.motor}`)
  if (val?.referencial) avisos.push('⚠ P/E referencial: precio viejo')
  const notaVal = avisos.length
    ? avisos.join(' · ')
    : anzuelo ? '🔍 toca: ¿por qué?' : tVal.nota

  // 4) ¿Debe mucho? — el globo nuevo (#42): la deuda entra por fin a los
  //    10 segundos que TODOS ven, con el veredicto de SU lente.
  const deu = deudaInfo(empresa)
  let tDeuda = null
  if (deu) {
    if (deu.aplica === false) {
      tDeuda = { valor: 'No se mide así', nota: `es ${deu.lente.nombre.toLowerCase()}: ${deu.lente.deudaCorto}`, tono: 'neutro' }
    } else if (deu.cajaNeta) {
      tDeuda = { valor: 'Le sobra caja', nota: 'tiene más efectivo que deuda', tono: 'bien' }
    } else if (deu.sinGanancia) {
      tDeuda = { valor: 'Sin ganancia', nota: 'debe y hoy no genera con qué pagar', tono: 'mal' }
    } else if (deu.sinDato) {
      tDeuda = { valor: 'Sin dato', nota: 'la SMV no publica lo necesario', tono: 'neutro' }
    } else if (deu.estado === 'incierto') {
      // Sin la depreciación, el cálculo solo da un TECHO: no alcanza para
      // pronunciar un veredicto (y decirlo es la lección honesta).
      tDeuda = {
        valor: 'No se puede afirmar',
        nota: 'sí debe, pero la SMV no publica lo que falta para juzgarlo',
        tono: 'neutro',
      }
    } else {
      const p = PALABRA_DEUDA[deu.estado]
      // Mismo asterisco que en "¿Barata o cara?": en una cíclica el veredicto
      // de deuda está calculado con la ganancia del PICO. Si con la ganancia
      // a la mitad cambiaría de color, el globo lo dice — no se esconde.
      const cambia = deu.estadoEstres && deu.estadoEstres !== deu.estado
      tDeuda = {
        valor: p.corto + (cambia ? '*' : ''),
        nota: cambia
          ? `${aniosTexto(deu.anios)} · * con ${lente.motor} barato serían ${deu.aniosEstres.toFixed(1)}`
          : `${aniosTexto(deu.anios)} de su ganancia`,
        tono: p.tono,
      }
    }
  }

  const nInvita = NIVELES.find((n) => n.id === invita)
  const tocar = (n) => () => setInvita(n)

  return (
    <div className="rx">
      <div className="rx-cab">
        <span className="rx-tit">La empresa en 10 segundos</span>
        <span className="rx-ayuda muted">
          {anzuelo ? 'toca un dato' : 'toca un dato para ver el detalle'}
        </span>
      </div>
      {lente && (
        <div className="rx-lente">
          {lente.icono} Se lee como <strong>{lente.nombre.toLowerCase()}</strong>
          <span className="muted"> · vive de {lente.viveDe}</span>
        </div>
      )}
      <div className="rx-fila">
        <Tile icono="📈" k="Últimos 6 meses" {...tPrecio} destino="sec-precio" />
        <Tile icono="💰" k="Dividendos" {...tDiv} destino="sec-dividendos" />
        <Tile
          icono="💎" k="¿Barata o cara?"
          valor={tVal.valor + (conAsterisco ? '*' : '')} tono={tVal.tono}
          nota={notaVal}
          gancho={anzuelo && !avisos.length}
          destino="sec-valoracion"
          onTocar={anzuelo ? tocar(3) : null}
        />
        {tDeuda && (
          <Tile
            icono="💳" k="¿Debe mucho?"
            valor={tDeuda.valor} tono={tDeuda.tono}
            nota={nivel === 1 ? tDeuda.nota + ' · toca: ¿es grave?' : tDeuda.nota}
            destino="sec-deuda"
            onTocar={nivel === 1 ? tocar(2) : null}
          />
        )}
        {mov(h) && (
          <Tile
            icono="🌡️" k="¿Cuánto se mueve?"
            valor={mov(h).valor} tono="neutro"
            /* (#113) "poco negociada" es una ADVERTENCIA de plata real (podrías
               no poder vender), no un tecnicismo: nunca la tapa el anzuelo. */
            nota={anzuelo && !ilquida ? '🔍 toca: hay un medidor' : mov(h).nota}
            gancho={anzuelo && !ilquida}
            destino="sec-movimiento"
            onTocar={anzuelo ? tocar(3) : null}
          />
        )}
      </div>
      {nInvita && (
        <div className="rx-invita" style={{ '--nivel-color': nInvita.color }}>
          <div className="rx-invita-texto">
            <strong>{nInvita.icono} {invita === 2
              ? 'El porqué de la deuda vive en el nivel 2'
              : 'El porqué vive en el nivel 3'}</strong>
            <div className="muted">
              {invita === 2 ? (
                <>Cuántos años de caja le tomaría pagarla, cómo se lee esa deuda en{' '}
                  {lente?.nombre.toLowerCase() || 'su sector'} y el error que casi todos cometen con
                  este número.</>
              ) : (
                <>El medidor de movimiento, la fórmula de por qué está{' '}
                  {val && !val.perdida ? `«${tVal.valor.toLowerCase()}»` : 'barata o cara'} y además
                  catalizadores, escenarios y riesgos.</>
              )}
            </div>
          </div>
          <div className="rx-invita-botones">
            <button className="btn btn-oro" onClick={() => onSubirNivel?.(invita)}>
              Subir a «{nInvita.nombre}» →
            </button>
            <button className="rx-invita-luego" onClick={() => setInvita(null)}>
              ahora no
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Movimiento (volatilidad real de 12 meses)
function mov(h) {
  return h?.volatilidadEtiqueta ? ETIQUETA_MOVIMIENTO[h.volatilidadEtiqueta] : null
}
