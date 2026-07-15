import { useState } from 'react'
import { historicoDe, cambio6M, veredictoPE, dividendosDe, pagaDividendos } from '../lib/finanzas'
import { NIVELES } from '../lib/nivel'

// 🩻 Radiografía exprés: la empresa en 10 segundos — SIEMPRE los 4 datos,
// en todos los niveles (pedido de Jair 15-jul: "deja esos 4 globos").
// Lo que cambia es el PORQUÉ:
// · Niveles 1-2: el medidor de movimiento y la valoración con fórmula NO
//   existen abajo (NIVEL_SECCION los pone en 3). Esos dos tiles muestran solo
//   el veredicto y, al tocarlos, invitan a subir de nivel — la curiosidad
//   hace que el usuario suba solo.
// · Niveles 3-4: cada tile baja con scroll suave a su sección de detalle.
// Cero datos nuevos: todo sale de los mismos cálculos verificados de
// Sparkline/DividendoResumen/Valoracion/Termometro.
// Regla de Oro #1: si un dato falta, el tile lo dice — no se inventa.

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
  const [pregunta, setPregunta] = useState(false)

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
  const val = veredictoPE(t, empresa.sector)
  const tVal = val == null
    ? { valor: 'Sin dato', nota: 'faltan precio o ganancia anual', tono: 'neutro' }
    : val.perdida
      ? { valor: 'Tuvo pérdida', nota: 'no hay P/E que comparar', tono: 'mal' }
      : { ...ETIQUETA_VALORACION[val.estado], nota: val.referencial ? 'P/E referencial (precio viejo)' : ETIQUETA_VALORACION[val.estado].nota }

  // 4) Movimiento (volatilidad real de 12 meses)
  const mov = h?.volatilidadEtiqueta ? ETIQUETA_MOVIMIENTO[h.volatilidadEtiqueta] : null

  const n3 = NIVELES.find((n) => n.id === 3)
  const tocarGancho = anzuelo ? () => setPregunta(true) : null

  return (
    <div className="rx">
      <div className="rx-cab">
        <span className="rx-tit">La empresa en 10 segundos</span>
        <span className="rx-ayuda muted">
          {anzuelo ? 'toca un dato' : 'toca un dato para ver el detalle'}
        </span>
      </div>
      <div className="rx-fila">
        <Tile icono="📈" k="Últimos 6 meses" {...tPrecio} destino="sec-precio" />
        <Tile icono="💰" k="Dividendos" {...tDiv} destino="sec-dividendos" />
        <Tile
          icono="💎" k="¿Barata o cara?"
          valor={tVal.valor} tono={tVal.tono}
          nota={anzuelo ? '🔍 toca: ¿por qué?' : tVal.nota}
          gancho={anzuelo}
          destino="sec-valoracion"
          onTocar={tocarGancho}
        />
        {mov && (
          <Tile
            icono="🌡️" k="¿Cuánto se mueve?"
            valor={mov.valor} tono="neutro"
            nota={anzuelo ? '🔍 toca: hay un medidor' : mov.nota}
            gancho={anzuelo}
            destino="sec-movimiento"
            onTocar={tocarGancho}
          />
        )}
      </div>
      {anzuelo && pregunta && (
        <div className="rx-invita" style={{ '--nivel-color': n3.color }}>
          <div className="rx-invita-texto">
            <strong>{n3.icono} El porqué vive en el nivel 3</strong>
            <div className="muted">
              El medidor de movimiento, la fórmula de por qué está{' '}
              {val && !val.perdida ? `«${tVal.valor.toLowerCase()}»` : 'barata o cara'} y además
              catalizadores, escenarios y riesgos.
            </div>
          </div>
          <div className="rx-invita-botones">
            <button className="btn btn-oro" onClick={() => onSubirNivel?.(3)}>
              Subir a «{n3.nombre}» →
            </button>
            <button className="rx-invita-luego" onClick={() => setPregunta(false)}>
              ahora no
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
