import { candentes, leerFuerza } from '../lib/radar'

// 🔥 LO CANDENTE — las que se salieron de su vaivén normal, con lo que se
// publicó alrededor. El orden importa y es al revés de lo que uno esperaría:
// NO se buscan noticias calientes y luego se mira el precio. Se buscan
// movimientos fuera de rango y RECIÉN ahí se pregunta qué se publicó. Si
// dejáramos que el titular decida, todos se creen urgentes (ver lib/radar.js).

const diasDesde = (iso) => {
  const d = Math.round((new Date() - new Date(iso)) / 86400000)
  return isFinite(d) && d >= 0 ? d : null
}

const haceCuanto = (dias) =>
  dias == null ? '' : dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`

export default function RadarCandente({ filas, ruedas, plazo, onVerEmpresa }) {
  const lista = candentes(filas, ruedas)

  if (!lista.length) {
    return (
      <div className="card radar-candente">
        <h3 style={{ margin: '0 0 6px' }}>🔥 Lo candente</h3>
        <p className="muted" style={{ margin: 0 }}>
          En {plazo.etiqueta} ninguna acción se salió de su vaivén normal. No es
          que no se hayan movido: es que se movieron lo que suelen moverse, y eso
          no es una señal — es un martes. Prueba otro plazo.
        </p>
      </div>
    )
  }

  return (
    <div className="card radar-candente">
      <h3 style={{ margin: '0 0 4px' }}>🔥 Lo candente</h3>
      <p className="muted" style={{ margin: '0 0 14px', fontSize: 13 }}>
        Las {lista.length} que en {plazo.etiqueta} se movieron <b>más de lo que
        ellas suelen moverse</b>, y lo que se publicó alrededor. Ojo con el
        orden: no se buscó la noticia caliente para después mirar el precio —
        fue al revés, porque todos los titulares se creen urgentes y el precio no.
      </p>

      {lista.map(({ fila, noticias, hecho }) => {
        const fz = leerFuerza(fila.fuerzas[ruedas], fila.normales[ruedas])
        const pct = fila.retornos[ruedas]
        return (
          <div key={fila.ticker} className="cand">
            <button className="cand-cab" onClick={() => onVerEmpresa(fila.ticker)}>
              <span className="cand-tk">{fila.ticker}</span>
              <span className="cand-nom muted">{fila.nombre}</span>
              <span className={'cand-pct ' + (pct >= 0 ? 'sube' : 'baja')}>
                {pct >= 0 ? '+' : '−'}{Math.abs(pct).toFixed(1)}%
              </span>
              <span className="cand-fz">{fz?.icono} {fz?.texto}</span>
            </button>

            {hecho && (
              <a
                className="cand-item cand-hecho"
                href={hecho.pdf || undefined}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => { if (!hecho.pdf) e.preventDefault() }}
              >
                <span className="cand-icono">📄</span>
                <span>
                  <b>Hecho de Importancia</b> {haceCuanto(hecho.dias)}
                  {hecho.categoria && <> · {hecho.categoria.toLowerCase()}</>}
                  {hecho.titulo && <span className="muted"> — {hecho.titulo}</span>}
                </span>
              </a>
            )}

            {noticias.map((n) => (
              <a
                key={n.url}
                className="cand-item"
                href={n.url}
                target="_blank"
                rel="noreferrer"
              >
                <span className="cand-icono">{n.icono}</span>
                <span>
                  {n.titulo}
                  <span className="muted">
                    {' '}— {n.medio || 'prensa'} · {haceCuanto(diasDesde(n.fecha))}
                  </span>
                </span>
              </a>
            ))}

            {!hecho && !noticias.length && (
              <p className="cand-nada muted">
                Se movió fuera de su rango y <b>no hay nada publicado</b> — ni
                Hecho de Importancia ni prensa. Eso también es información.
              </p>
            )}
          </div>
        )
      })}

      <p className="muted" style={{ fontSize: 12, marginTop: 14, marginBottom: 0 }}>
        Que la noticia y el movimiento caigan en los mismos días <b>no significa
        que una causó al otro</b>. Acá están las dos cosas puestas al lado; el
        porqué lo pones tú, y para eso está el documento oficial.
      </p>
    </div>
  )
}
