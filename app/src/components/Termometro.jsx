import { historicoDe } from '../lib/finanzas'
import Glosado from './Glosado'

// Termómetro de volatilidad — educativo y 100% calculado de cierres reales BVL
// (extractor/fetch_historicos.py). Si la acción casi no negocia, el número de
// volatilidad sería engañoso, así que se dice "poco negociada" (la verdad).

const EXPLICA = {
  tranquila:
    'Su precio se movió poco día a día en los últimos 12 meses. Menos sustos, pero también suele moverse lento.',
  'se mueve':
    'Se mueve como una acción típica: hay días buenos y días malos. Hay que tener estómago para las bajadas.',
  'montaña rusa':
    'Su precio salta MUCHO día a día. Puede subir fuerte… y caer igual de fuerte. Solo para quien tolera vaivenes.',
  'poco negociada':
    'Casi nadie la compra/vende a diario en la BVL. El riesgo aquí no es el vaivén: es que cuando quieras venderla, puede no haber comprador al toque.',
}

export default function Termometro({ ticker }) {
  const h = historicoDe(ticker)
  if (!h?.volatilidadEtiqueta) return null

  const etiqueta = h.volatilidadEtiqueta
  const ilquida = etiqueta === 'poco negociada'
  const vol = h.volatilidadAnualPct
  const pos = ilquida ? null : Math.min(97, Math.max(3, (vol / 80) * 100))

  return (
    <div className="termo">
      <div className="termo-cab">
        <span className="termo-tit">🌡️ ¿Cuánto se mueve?</span>
      </div>

      {!ilquida && (
        <div className="termo-barra">
          <div className="termo-zona termo-z1" />
          <div className="termo-zona termo-z2" />
          <div className="termo-zona termo-z3" />
          <div className="termo-marca" style={{ left: `${pos}%` }} />
        </div>
      )}
      {!ilquida && (
        <div className="termo-leyenda">
          <span>Tranquila</span>
          <span>Se mueve</span>
          <span>Montaña rusa</span>
        </div>
      )}

      <p className="termo-txt">{EXPLICA[etiqueta]}</p>
      <p className="termo-fuente muted">
        {ilquida
          ? `Negoció con cambio de precio solo ${h.diasConCambio} días en los últimos 12 meses (BVL).`
          : <>Calculado con la <Glosado text="volatilidad" /> de los cierres diarios reales de los últimos 12 meses (BVL). No predice nada: describe cómo se movió.</>}
      </p>
    </div>
  )
}
