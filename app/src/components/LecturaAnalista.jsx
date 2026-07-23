import Glosado from './Glosado'
import { combosDe } from '../lib/analista'
import { lenteDe } from '../lib/lente'

// 🧠 LECTURA DE ANALISTA (mejora #43 — sesión 3 del plan educativo).
// La materialización literal de la regla de Jair: NUNCA un indicador solo.
// Cada tarjeta cruza dos o tres números que ya están en la ficha y dice qué
// significan JUNTOS — que casi siempre es distinto de lo que dicen sueltos
// (un P/E bajo en una cíclica con margen récord no es una ganga; un yield
// alto sin flujo de caja no es un yield).
// Los combos se arman en lib/analista.js con slots verificados: si a una
// empresa le falta un dato, ese combo sencillamente no aparece.

const TONO = {
  ojo: { clase: 'analista-ojo', etiqueta: 'Ojo con esto' },
  bien: { clase: 'analista-bien', etiqueta: 'A favor' },
  neutro: { clase: 'analista-neutro', etiqueta: 'Cómo se lee' },
}

export default function LecturaAnalista({ empresa }) {
  const combos = combosDe(empresa)
  if (!combos.length) return null
  const l = lenteDe(empresa)

  return (
    <div className="analista" data-tour="analista">
      <div className="seccion-titulo">🧠 Lectura de analista</div>
      <p className="analista-intro">
        Ningún número significa nada solo. Un P/E bajo puede ser una ganga o un pico de ciclo;
        un dividendo alto puede ser salud o una liquidación en cuotas. Lo que cambia el
        veredicto es <strong>con qué otro número lo cruzas</strong>. Esto es lo que se puede
        cruzar hoy en {empresa.ticker}
        {l && <> con lente de {l.nombre.toLowerCase()} {l.icono}</>}:
      </p>

      <div className="analista-lista">
        {combos.map((c) => {
          const tono = TONO[c.tono] || TONO.neutro
          return (
            <div key={c.id} className={'analista-card ' + tono.clase}>
              <div className="analista-cab">
                <span className="analista-icono">{c.icono}</span>
                <span className="analista-tit">{c.titulo}</span>
                <span className="analista-tag">{tono.etiqueta}</span>
              </div>
              <p className="analista-txt"><Glosado text={c.texto} /></p>
              <div className="analista-porque">
                📌 <strong>La regla que te llevas:</strong> <Glosado text={c.porque} />
              </div>
            </div>
          )
        })}
      </div>

      <p className="analista-pie muted">
        Estas lecturas se arman solas con los datos que ya viste arriba (SMV, BVL, MINEM,
        dividendos): no hay opinión nuestra ni recomendación de compra. Y solo aparece el
        cruce que tiene TODOS sus datos — si a esta empresa le falta uno, ese combo no se
        escribe en vez de completarse a ojo.
      </p>
    </div>
  )
}
