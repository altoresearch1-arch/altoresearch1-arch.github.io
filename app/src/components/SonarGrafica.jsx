// 📈 CÓMO SUBIÓ Y BAJÓ — la ventana que el Sonar está midiendo, dibujada.
//
// El punto en el plato dice CUÁNTO se movió; esto dice CÓMO llegó ahí. No es
// lo mismo un +9% que subió derechito que un +9% que se desplomó y rebotó, y
// hasta ahora los dos se pintaban idénticos.
//
// NO TRAE NINGÚN DATO NUEVO: usa `fila.serie`, exactamente la misma de la que
// salen el % y la fuerza (ya con la cola reparada y el precio de hoy pegado).
// Por eso la gráfica no puede contradecir al número que tiene al lado — si
// algún día se contradicen, el bug está en la serie y no en el dibujo.
//
// Se lee de izquierda a derecha y nada más. Sin ejes, sin grilla: es un
// vistazo, no un terminal de trading. Los únicos números que aparecen son los
// tres que uno miraría igual — de dónde salió, el techo y el piso de la
// ventana.

const ANCHO = 300
const ALTO = 84
const MARGEN = 6 // para que el punto del final no se corte contra el borde

export default function SonarGrafica({ serie, ruedas, moneda, sube, etiqueta }) {
  // La ventana del plazo elegido: `ruedas` saltos = ruedas+1 cierres.
  const pts = (serie || []).slice(-(ruedas + 1)).filter(([, v]) => v > 0)
  // Con menos de 3 puntos no hay forma: una recta entre dos precios no cuenta
  // cómo se movió, y dibujarla igual sería fingir información.
  if (pts.length < 3) return null

  const vals = pts.map(([, v]) => v)
  const max = Math.max(...vals)
  const min = Math.min(...vals)
  const rango = max - min || max * 0.01 || 1

  const x = (i) => MARGEN + (i / (pts.length - 1)) * (ANCHO - MARGEN * 2)
  const y = (v) => MARGEN + (1 - (v - min) / rango) * (ALTO - MARGEN * 2)

  const linea = pts.map(([, v], i) => `${x(i)},${y(v)}`).join(' ')
  const area = `${MARGEN},${ALTO} ${linea} ${ANCHO - MARGEN},${ALTO}`

  const inicio = vals[0]
  const fin = vals[vals.length - 1]
  const idMax = vals.indexOf(max)
  const idMin = vals.indexOf(min)
  const color = sube ? 'var(--fosforo, #3ddc84)' : 'var(--fosforo-baja, #ff6b5a)'
  const id = `grad-${sube ? 'sube' : 'baja'}`

  return (
    <div className="sonar-grafica">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img"
           aria-label={`Cómo se movió en ${etiqueta}: de ${moneda} ${inicio} a ${moneda} ${fin}`}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* De dónde salió: la referencia contra la que se mide todo el %.
            Punteada porque no es un dato del gráfico, es el origen. */}
        <line x1={MARGEN} y1={y(inicio)} x2={ANCHO - MARGEN} y2={y(inicio)}
              className="sgraf-base" />

        <polygon points={area} fill={`url(#${id})`} />
        <polyline points={linea} className="sgraf-linea" style={{ stroke: color }} />

        {/* El techo y el piso de la ventana. Son los dos precios que uno
            busca con la vista, así que se marcan en vez de hacer contarlos. */}
        <circle cx={x(idMax)} cy={y(max)} r="2.5" className="sgraf-extremo" />
        <circle cx={x(idMin)} cy={y(min)} r="2.5" className="sgraf-extremo" />

        {/* Dónde está ahora */}
        <circle cx={x(pts.length - 1)} cy={y(fin)} r="4"
                className="sgraf-fin" style={{ fill: color }} />
      </svg>

      <div className="sgraf-pies muted">
        <span>desde {moneda} {inicio}</span>
        <span className="sgraf-rango">
          piso {moneda} {min} · techo {moneda} {max}
        </span>
      </div>
    </div>
  )
}
