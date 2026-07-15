import { historicoDe, cambio6M, veredictoPE, dividendosDe, pagaDividendos } from '../lib/finanzas'

// 🩻 Radiografía exprés: la empresa en 4 datos y 10 segundos, arriba de todo
// en la ficha. Sirve a TODOS los públicos: el nuevo lee las palabras simples,
// el curioso toca un dato y baja al detalle completo (cada tile es un botón
// que hace scroll a su sección). Cero datos nuevos: todo sale de los mismos
// cálculos verificados de Sparkline/DividendoResumen/Valoracion/Termometro.
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

function Tile({ icono, k, valor, nota, tono = 'neutro', destino }) {
  const ir = () => {
    document.getElementById(destino)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <button type="button" className={'rx-tile rx-' + tono} onClick={ir}>
      <span className="rx-k">{icono} {k}</span>
      <span className="rx-v">{valor}</span>
      <span className="rx-nota">{nota}</span>
    </button>
  )
}

export default function RadiografiaExpres({ empresa }) {
  const t = empresa.ticker

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

  return (
    <div className="rx">
      <div className="rx-cab">
        <span className="rx-tit">La empresa en 10 segundos</span>
        <span className="rx-ayuda muted">toca un dato para ver el detalle</span>
      </div>
      <div className="rx-fila">
        <Tile icono="📈" k="Últimos 6 meses" {...tPrecio} destino="sec-precio" />
        <Tile icono="💰" k="Dividendos" {...tDiv} destino="sec-dividendos" />
        <Tile icono="💎" k="¿Barata o cara?" {...tVal} destino="sec-valoracion" />
        {mov && <Tile icono="🌡️" k="¿Cuánto se mueve?" {...mov} tono="neutro" destino="sec-movimiento" />}
      </div>
    </div>
  )
}
