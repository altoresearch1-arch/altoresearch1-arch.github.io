import { useMemo, useState } from 'react'
import { temasDelMundo } from '../lib/radar'

// 🌍 EL MUNDO — la capa que llega ANTES que cualquier estado financiero.
//
// POR QUÉ ESTÁ ARRIBA DEL RANKING Y NO AL FINAL: de las 32 acciones del plato,
// 10 son minas que no le ponen precio a lo que venden — se lo ponen en Londres
// y en Chicago. Con las acereras y los fondos, más de un tercio de la BVL tiene
// la causa fuera del país. Durante meses la app preguntó TODO con el lente de
// Perú y esa mitad no entraba por ninguna red.
//
// LO QUE HACE DISTINTO A ESTE BLOQUE: no dice «esta noticia movió a Cerro
// Verde». Dice por qué CANAL podría llegarle, y deja la cadena a la vista para
// que se pueda romper:
//
//     la Fed baja tasas → el dólar se debilita → el cobre sube → Cerro Verde
//
// Un adivino no se puede contradecir; una cadena sí. Esa es toda la diferencia
// entre esto y un horóscopo de mercado.
//
// TONO (Regla de Oro): «puede tocar a», nunca «afectó a». Nada de esto se midió
// contra el precio, y se dice en pantalla.

export default function RadarMundo({ onVerEmpresa, tickersVisibles }) {
  const temas = useMemo(() => temasDelMundo(), [])
  const [abierto, setAbierto] = useState(null)

  if (!temas.length) return null

  // Solo se ofrecen para abrir los tickers que hoy están en el plato: mandar a
  // la ficha de una acción que el Radar descartó por precio congelado sería
  // prometer algo que la otra pantalla no puede cumplir.
  const enPlato = (tk) => !tickersVisibles || tickersVisibles.has(tk)

  return (
    <div className="card mundo-card">
      <div className="mundo-cab">
        <h3 style={{ margin: 0 }}>🌍 El mundo</h3>
        <span className="muted">
          {temas.length} frentes abiertos · últimos 10 días
        </span>
      </div>
      <p className="muted mundo-intro">
        Lima no le pone precio al cobre, al oro ni al estaño. <b>10 de las 32
        acciones del plato son minas</b>, y lo que les mueve el ingreso se
        cotiza afuera. Acá está lo que pasó afuera y —lo importante— <b>por qué
        canal</b> podría llegar hasta cada empresa.
      </p>

      {temas.map((t) => {
        const abierta = abierto === t.id
        return (
          <div key={t.id} className={'mundo-tema' + (abierta ? ' abierto' : '')}>
            <button className="mundo-tema-cab" onClick={() => setAbierto(abierta ? null : t.id)}>
              <span className="mundo-icono">{t.icono}</span>
              <span className="mundo-tema-tit">
                {t.titulo}
                <span className="muted"> · {t.items.length} titular{t.items.length > 1 ? 'es' : ''}</span>
              </span>
              <span className="mundo-flecha">{abierta ? '▾' : '▸'}</span>
            </button>

            <p className="mundo-quees muted">{t.queEs}</p>

            {/* LA CADENA, agrupada por canal. Un ticker nunca aparece solo:
                siempre debajo del «por dónde le llega». */}
            <div className="mundo-canales">
              {(t.afecta || []).map((c, i) => {
                const tickers = c.tickers.filter(enPlato)
                if (!tickers.length) return null
                return (
                  <div key={i} className="mundo-canal">
                    <div className="mundo-via">↳ {c.via}</div>
                    <div className="mundo-tickers">
                      {tickers.map((tk) => (
                        <button key={tk} className="mundo-tk" onClick={() => onVerEmpresa(tk)}>
                          {tk}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Los titulares: el más nuevo siempre visible, el resto al abrir.
                Sin esto el bloque mide media pantalla y nadie lo lee. */}
            {t.items.slice(0, abierta ? t.items.length : 1).map((n) => (
              <a key={n.url} className="mundo-nota" href={n.url} target="_blank" rel="noreferrer">
                <span className="mundo-nota-fecha">{n.fecha.slice(5)}</span>
                <span className="mundo-nota-txt">
                  {n.titulo}
                  <span className="muted"> · {n.medio}</span>
                </span>
              </a>
            ))}
            {!abierta && t.items.length > 1 && (
              <button className="mundo-mas" onClick={() => setAbierto(t.id)}>
                ver los {t.items.length - 1} titulares restantes
              </button>
            )}
          </div>
        )
      })}

      <p className="muted mundo-pie">
        <b>Esto no predice nada y no se midió contra el precio.</b> Se comprobó
        con 2,259 titulares de un año que ni las noticias de la propia empresa
        anticipan su cierre (<code>estudio_noticias.py</code>); una de la Fed,
        menos. Las cadenas están escritas a mano y son <b>discutibles a
        propósito</b>: si no te convence un eslabón, tienes razón en dudarlo.
        Sirven para saber dónde mirar, no para decidir.
      </p>
    </div>
  )
}
