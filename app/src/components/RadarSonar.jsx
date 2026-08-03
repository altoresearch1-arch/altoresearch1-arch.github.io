import { useMemo, useState } from 'react'
import { RASTREOS, firmaDe, leerFuerza, mundoDe, noticiasDe, noticiasOrdenadas, noticiasConEfecto, pesoDe, posiblesExplicaciones, tickersTocadosPorElMundo } from '../lib/radar'

// 🟢 EL SONAR — el Radar como pantalla de submarino.
//
// QUÉ SIGNIFICA CADA COSA (nada es decoración):
//   · DISTANCIA AL CENTRO = fuerza. El centro es la calma: ahí está la acción
//     que se movió lo que suele moverse. Cuanto más lejos, más se salió de su
//     propio rango. El anillo marcado es 1× — cruzarlo es la anomalía.
//   · ÁNGULO = sector. Cada sector tiene su cuña, así se ve de un vistazo si
//     lo que se prendió es un sector entero o una empresa suelta.
//   · TAMAÑO = cuánto se movió en %.
//   · COLOR = verde sube, rojo baja (fósforo de sonar, como pediste).
//
// Un contacto pegado al centro no es «nada»: es una acción que hizo lo de
// siempre. En un sonar de verdad tampoco todo lo que aparece es un submarino.
//
// LA FIRMA (lib/radar.js → firmaDe): la distancia dice CUÁNTO se movió, pero
// no qué clase de movimiento fue. Un operador de sonar no se queda con el
// tamaño del eco — escucha si viene solo o en cardumen, si acelera, si se dio
// vuelta. Eso es lo que agregan las marcas: se movió sola o la arrastró el
// sector, fue de a poco o saltó un martes, está en su techo del año, ayer
// todavía estaba dentro del rango… y la que más importa, que esa caída era el
// dividendo saliendo del precio y no el mercado castigándola.

const RADIO = 165          // radio del plato
const CENTRO = 200
const FUERZA_MAX = 3       // más allá de 3× ya no se distingue: se pega al borde
const R_MINIMO = 18        // nadie se sienta exactamente en el centro

const NOMBRE_SECTOR = {
  minas: 'MINAS', acereras: 'ACERERAS', cemento: 'CEMENTO', bancos: 'BANCOS',
  electricas: 'ELÉCTRICAS', alimentos: 'ALIMENTOS', retail: 'RETAIL',
  textil: 'TEXTIL', pesqueras: 'PESCA', fondos: 'FONDOS', diversas: 'DIVERSAS',
}

// S/ 579085 -> "579,085". Con decimales el número deja de leerse de un vistazo.
const miles = (n) => (n == null ? '—' : Math.round(n).toLocaleString('es-PE'))

// Desorden estable: el mismo ticker cae SIEMPRE en el mismo sitio dentro de
// su cuña. Con Math.random los contactos saltarían en cada repintado y el
// sonar sería inservible para seguir a una acción con la vista.
function semilla(texto) {
  let h = 0
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) | 0
  return Math.abs(h % 1000) / 1000
}

export default function RadarSonar({ filas, ruedas, plazo, onVerEmpresa }) {
  const [sel, setSel] = useState(null)
  const [verTodos, setVerTodos] = useState(false)
  // Para qué se enciende el sonar hoy. Arranca en «todo el plato»: el filtro
  // es una ayuda, no una opinión sobre qué deberías estar mirando.
  const [rastreo, setRastreo] = useState('todo')
  // 'fuerza' = qué se salió de su rango (detectar). 'pct' = qué se movió más
  // en plata (tomar). Arranca en fuerza porque es lo que el plato ya dibuja.
  const [orden, setOrden] = useState('fuerza')

  const { contactos, sectores } = useMemo(() => {
    const conDatos = filas.filter((f) => f.fuerzas[ruedas] != null && f.retornos[ruedas] != null)
    const secs = [...new Set(conDatos.map((f) => f.sector))].sort()
    const paso = 360 / Math.max(secs.length, 1)
    const maxRet = Math.max(...conDatos.map((f) => Math.abs(f.retornos[ruedas])), 1)

    const contactos = conDatos.map((f) => {
      const fz = f.fuerzas[ruedas]
      const ret = f.retornos[ruedas]
      const i = secs.indexOf(f.sector)
      // dentro de su cuña, con margen para que no se monten en el borde
      const s = semilla(f.ticker)
      const ang = (i * paso) + paso * (0.18 + s * 0.64) - 90 // -90: arrancar arriba
      const rad = (ang * Math.PI) / 180
      const dist = R_MINIMO + (Math.min(Math.abs(fz), FUERZA_MAX) / FUERZA_MAX) * (RADIO - R_MINIMO)
      const firma = firmaDe(f, ruedas)
      return {
        ...f,
        fz,
        ret,
        x: CENTRO + Math.cos(rad) * dist,
        y: CENTRO + Math.sin(rad) * dist,
        r: 4.5 + (Math.abs(ret) / maxRet) * 9,
        sube: ret >= 0,
        anomalia: Math.abs(fz) >= 1,
        firma,                                        // las marcas, con su cuenta
        marcas: new Set(firma.map((m) => m.id)),      // para los rastreos
      }
    })

    const sectores = secs.map((sector, i) => {
      const ang = (i * paso) + paso / 2 - 90
      const rad = (ang * Math.PI) / 180
      return {
        sector,
        x: CENTRO + Math.cos(rad) * (RADIO + 22),
        y: CENTRO + Math.sin(rad) * (RADIO + 22),
        // línea divisoria al inicio de la cuña
        lx: CENTRO + Math.cos(((i * paso - 90) * Math.PI) / 180) * RADIO,
        ly: CENTRO + Math.sin(((i * paso - 90) * Math.PI) / 180) * RADIO,
      }
    })
    return { contactos, sectores }
  }, [filas, ruedas])

  const elegido = contactos.find((c) => c.ticker === sel) || null
  // DOS ÓRDENES, y hacen falta los dos.
  //   · por FUERZA es el orden del DETECTOR: qué se salió de su rango.
  //   · por % es el orden del que va a TOMAR el movimiento: un +9% son 9% de
  //     plata aunque para esa acción sea un martes cualquiera, y ordenar solo
  //     por fuerza dejaba un +2% a 1.5× por encima de un +9% a 0.9×.
  const porFuerza = [...contactos].sort((a, b) => Math.abs(b.fz) - Math.abs(a.fz))
  const porPct = [...contactos].sort((a, b) => Math.abs(b.ret) - Math.abs(a.ret))
  const ordenados = orden === 'pct' ? porPct : porFuerza
  const tocadasPorElMundo = useMemo(() => tickersTocadosPorElMundo(), [])

  // Cuántos contactos responde cada rastreo, HOY y a ESTE plazo. El número va
  // escrito en el botón: un filtro que promete y devuelve una pantalla vacía
  // es peor que no tener filtro. Los que traen 0 se apagan, no se esconden —
  // que un día nadie se haya dado vuelta también es información.
  const cuentas = Object.fromEntries(
    RASTREOS.map((r) => [r.id, contactos.filter((c) => r.prueba(c)).length]),
  )
  const activo = RASTREOS.find((r) => r.id === rastreo) || RASTREOS[0]
  const visibles = ordenados.filter((c) => activo.prueba(c))
  const enElFiltro = new Set(visibles.map((c) => c.ticker))
  const fueraDeRango = visibles.filter((c) => c.anomalia)
  const enRango = visibles.filter((c) => !c.anomalia)
  // Titulares con el efecto medido, y cuáles PODRÍAN explicar el movimiento
  // Se ordenan por peso antes de cortar en 4: si una empresa tuvo una semana
  // de notas de prensa, sus resultados del trimestre no se pueden quedar en el
  // quinto lugar sin salir en pantalla.
  const noticias = elegido
    ? [...noticiasConEfecto(elegido.ticker, ruedas)]
      .sort((a, b) => (pesoDe(b) - pesoDe(a))
        || (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
      .slice(0, 4)
    : []
  const explican = elegido ? posiblesExplicaciones(elegido.ticker, ruedas, elegido.sube) : []

  return (
    <div className="card sonar-card">
      <div className="sonar-cab">
        <h3 style={{ margin: 0 }}>🟢 Sonar</h3>
        <span className="muted">
          {contactos.length} contactos en {plazo.etiqueta} ·{' '}
          <b className={cuentas.anillo ? 'sonar-alerta' : ''}>
            {cuentas.anillo} fuera de rango
          </b>
        </span>
      </div>

      {/* ── LOS RASTREOS: la pregunta con la que uno se sienta a mirar ──────
          El plato siempre muestra lo mismo; lo que cambia de un día a otro es
          qué estás buscando. Cada botón se apoya en una marca de la firma
          (lib/radar.js), ninguno inventa un criterio nuevo. */}
      <div className="sonar-rastreos" role="group" aria-label="Qué buscar en el sonar">
        {RASTREOS.map((r) => (
          <button
            key={r.id}
            className={'sonar-rastreo' + (r.id === rastreo ? ' activo' : '')
              + (cuentas[r.id] ? '' : ' vacio')}
            onClick={() => { setRastreo(r.id); setSel(null) }}
            disabled={!cuentas[r.id]}
            title={r.ayuda}
          >
            {r.icono} {r.etiqueta} <span className="sonar-rastreo-n">{cuentas[r.id]}</span>
          </button>
        ))}
      </div>
      {rastreo !== 'todo' && (
        <p className="muted sonar-rastreo-ayuda">{activo.ayuda}</p>
      )}

      {/* EL ORDEN. No es una preferencia estética: son dos preguntas distintas
          y la lista no puede responder las dos a la vez. */}
      <div className="sonar-orden">
        <span className="muted">ordenar por</span>
        <button className={'sonar-orden-b' + (orden === 'fuerza' ? ' activo' : '')}
                onClick={() => setOrden('fuerza')}
                title="Cuánto se salió de su propio rango. Es el orden del detector.">
          🔥 fuerza
        </button>
        <button className={'sonar-orden-b' + (orden === 'pct' ? ' activo' : '')}
                onClick={() => setOrden('pct')}
                title="Cuánto se movió en plata, sin importar si es normal para ella.">
          % movimiento
        </button>
      </div>

      <div className="sonar-cuerpo">
        <div className="sonar-plato">
          <svg viewBox="0 0 400 400" role="img" aria-label="Sonar del mercado">
            <defs>
              <radialGradient id="sonarFondo">
                <stop offset="0%" stopColor="#0b2a18" />
                <stop offset="100%" stopColor="#050d09" />
              </radialGradient>
              <linearGradient id="sonarHaz" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3ddc84" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#3ddc84" stopOpacity="0" />
              </linearGradient>
            </defs>

            <circle cx={CENTRO} cy={CENTRO} r={RADIO} fill="url(#sonarFondo)" />

            {/* Anillos: el de 1× es EL umbral, por eso va marcado distinto */}
            {[1, 2, 3].map((n) => (
              <circle
                key={n}
                cx={CENTRO}
                cy={CENTRO}
                r={R_MINIMO + (n / FUERZA_MAX) * (RADIO - R_MINIMO)}
                className={'sonar-anillo' + (n === 1 ? ' umbral' : '')}
              />
            ))}
            <text x={CENTRO + 4} y={CENTRO - R_MINIMO - (1 / FUERZA_MAX) * (RADIO - R_MINIMO) + 12}
                  className="sonar-etq-anillo">1× su vaivén</text>

            {/* Divisorias y nombres de sector */}
            {sectores.map((s) => (
              <line key={s.sector} x1={CENTRO} y1={CENTRO} x2={s.lx} y2={s.ly} className="sonar-radio" />
            ))}
            {sectores.map((s) => (
              <text key={s.sector} x={s.x} y={s.y} className="sonar-etq-sector"
                    textAnchor="middle" dominantBaseline="middle">
                {NOMBRE_SECTOR[s.sector] || s.sector}
              </text>
            ))}

            {/* El haz que barre */}
            <g className="sonar-haz-g" style={{ transformOrigin: `${CENTRO}px ${CENTRO}px` }}>
              <path
                d={`M ${CENTRO} ${CENTRO} L ${CENTRO + RADIO} ${CENTRO - 52} A ${RADIO} ${RADIO} 0 0 1 ${CENTRO + RADIO} ${CENTRO + 52} Z`}
                fill="url(#sonarHaz)"
              />
            </g>

            {/* Los contactos */}
            {contactos.map((c) => (
              <g
                key={c.ticker}
                className={'sonar-contacto'
                  + (c.anomalia ? ' anomalia' : '')
                  + (c.sube ? ' sube' : ' baja')
                  + (sel === c.ticker ? ' elegido' : '')
                  // El rastreo no borra contactos del plato: los apaga. Así se
                  // ve CUÁNTOS quedaron fuera de la pregunta, que es la mitad
                  // de la respuesta.
                  + (enElFiltro.has(c.ticker) ? '' : ' apagado')}
                onClick={() => setSel(sel === c.ticker ? null : c.ticker)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') setSel(sel === c.ticker ? null : c.ticker) }}
              >
                <title>{`${c.ticker} · ${c.ret >= 0 ? '+' : '−'}${Math.abs(c.ret).toFixed(1)}%`}</title>
                {c.anomalia && <circle cx={c.x} cy={c.y} r={c.r + 6} className="sonar-eco" />}
                {/* Blanco de clic generoso: el punto más chico mide 4.5px de
                    radio y acertarle con el dedo sería una lotería. Este
                    círculo invisible le da 18px a todos por igual. */}
                <circle cx={c.x} cy={c.y} r={Math.max(c.r + 10, 18)} className="sonar-blanco" />
                <circle cx={c.x} cy={c.y} r={c.r} className="sonar-punto" />
                {/* La etiqueta se pinta para TODOS; el CSS la muestra siempre
                    en los que cruzaron el anillo y al pasar por encima en el
                    resto. Así ningún contacto es anónimo. */}
                <text x={c.x} y={c.y - c.r - 5} className="sonar-etq" textAnchor="middle">
                  {c.ticker}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Lectura del contacto elegido */}
        <div className="sonar-lectura">
          {/* Sin nada elegido el panel NO se queda vacío: lista los contactos
              que cruzaron el anillo, con su precio y su último titular. Es lo
              que uno querría ver al abrir la pantalla. */}
          {!elegido && (() => {
            // Fila de la lista. La misma para los dos grupos: TODO contacto
            // del sonar se puede abrir, no solo el que cruzó el anillo.
            const Fila = ({ c, tenue }) => {
              // El que ENCABEZA: el que puede explicar el movimiento, no el
              // que se publicó más tarde. Acá solo cabe un titular, y cuando
              // ese lugar se lo llevaba una nota de prensa la línea entera
              // mentía: «SIDERC1 +10.5% · 🏢 recertificación como Buen
              // Empleador».
              const n = noticiasOrdenadas(c.ticker)[0]
              const cuantas = noticiasDe(c.ticker).length
              return (
                <button
                  className={'sonar-item' + (tenue ? ' tenue' : '')}
                  onClick={() => setSel(c.ticker)}
                >
                  <span className="sonar-item-cab">
                    <b className="sonar-item-tk">{c.ticker}</b>
                    <span className="sonar-item-px">{c.moneda} {c.precio}</span>
                    <span className={'sonar-item-pct ' + (c.sube ? 'sube' : 'baja')}>
                      {c.sube ? '+' : '−'}{Math.abs(c.ret).toFixed(1)}%
                    </span>
                  </span>
                  <span className="sonar-item-fz">
                    {c.anomalia ? '🔥 ' : ''}{Math.abs(c.fz).toFixed(1)}× su vaivén
                    {c.hecho?.dias != null && c.hecho.dias <= 12 && (
                      <span className="sonar-item-hi"> · 📄 hecho hace {c.hecho.dias}d</span>
                    )}
                    {cuantas > 0 && (
                      <span className="sonar-item-n"> · {cuantas} titular{cuantas > 1 ? 'es' : ''}</span>
                    )}
                    {/* Que hoy hay una cadena desde afuera hacia esta acción.
                        Solo el aviso — la cadena entera se lee al abrirla. */}
                    {tocadasPorElMundo.has(c.ticker) && (
                      <span className="sonar-item-mundo" title="Hay noticias de afuera que pueden llegarle. Ábrela para ver por qué canal."> · 🌍</span>
                    )}
                  </span>
                  {/* CON CUÁNTA PLATA. No descarta la subida: dice de qué
                      tamaño era tomable. */}
                  {c.volumen && (
                    <span className="sonar-item-vol"
                          title={`Volumen de la última rueda. ${c.volumen.ultima ? 'Última operación a las ' + c.volumen.ultima.slice(11, 16) + '.' : ''}`}>
                      {c.moneda} {miles(c.volumen.monto)} · {c.volumen.operaciones} op{c.volumen.operaciones === 1 ? '' : 's'}
                      {c.volumen.operaciones < 20 && <b className="sonar-vol-flaco"> · poca contraparte</b>}
                    </span>
                  )}
                  {/* LA FIRMA en versión corta. Tres marcas como mucho: esto es
                      una lista para barrer con la vista, no la ficha. La
                      explicación con su cuenta está en `title` y completa
                      cuando se abre el contacto. */}
                  {c.firma.length > 0 && (
                    <span className="sonar-marcas">
                      {c.firma.slice(0, 3).map((m) => (
                        <span key={m.id} className={'sonar-marca m-' + m.id} title={m.texto}>
                          {m.icono} {m.corto}
                        </span>
                      ))}
                    </span>
                  )}
                  {n && <span className="sonar-item-nota">{n.icono} {n.titulo}</span>}
                  {!n && !c.hecho && (
                    <span className="sonar-item-nota muted">sin nada publicado</span>
                  )}
                </button>
              )
            }
            return (
              <div className="sonar-lista">
                {fueraDeRango.length > 0 && (
                  <>
                    <div className="sonar-lista-tit">Cruzaron el anillo</div>
                    {fueraDeRango.map((c) => <Fila key={c.ticker} c={c} />)}
                  </>
                )}
                {enRango.length > 0 && (
                  <>
                    <div className="sonar-lista-tit tenue">
                      {fueraDeRango.length ? 'El resto'
                        : rastreo === 'todo' ? 'Todos los contactos' : activo.etiqueta}
                      <span className="muted"> · {enRango.length}</span>
                    </div>
                    {enRango.slice(0, verTodos ? enRango.length : 5)
                      .map((c) => <Fila key={c.ticker} c={c} tenue />)}
                    {enRango.length > 5 && (
                      <button className="muro-mas" onClick={() => setVerTodos((v) => !v)}>
                        {verTodos ? 'ver solo los 5 primeros'
                          : `ver los ${enRango.length - 5} restantes`}
                      </button>
                    )}
                  </>
                )}
                <p className="muted sonar-ayuda">
                  <b>Centro</b> = se movió lo normal · <b>anillo</b> = 1× su vaivén ·{' '}
                  <b>cuña</b> = sector · <b>tamaño</b> = cuánto se movió. Cualquier
                  contacto se abre, cruzara el anillo o no. Las marcas
                  (🧍 sola · ⚡ un día · 🔄 se dio vuelta · 🔺 techo del año ·{' '}
                  💸 dividendo) salen de los mismos cierres: pásales el cursor
                  para ver la cuenta.
                </p>
              </div>
            )
          })()}

          {elegido && (() => {
            const fz = leerFuerza(elegido.fz, elegido.normales[ruedas])
            return (
              <div className="sonar-ficha">
                <button className="sonar-volver" onClick={() => setSel(null)}>
                  ← todos los contactos
                </button>
                <div className="sonar-ficha-cab">
                  <b className="sonar-ficha-tk">{elegido.ticker}</b>
                  <span className={'sonar-ficha-pct ' + (elegido.sube ? 'sube' : 'baja')}>
                    {elegido.sube ? '+' : '−'}{Math.abs(elegido.ret).toFixed(1)}%
                  </span>
                </div>
                <div className="muted sonar-ficha-nom">{elegido.nombre}</div>
                {/* El precio: cuánto cuesta entrar, con su fecha. Es cierre de
                    la BVL, no precio en vivo — y se dice. */}
                <div className="sonar-precio">
                  <span className="sonar-precio-val">{elegido.moneda} {elegido.precio}</span>
                  <span className="muted"> · cierre del {elegido.fechaCierre}</span>
                </div>
                <div className="sonar-ficha-fz">{fz?.icono} {fz?.texto}</div>

                {/* ── CON CUÁNTA PLATA se movió, y el rango real del día ─────
                    Esto no juzga la subida: la subida es buena igual. Dice de
                    qué TAMAÑO era tomable, que es otra pregunta. */}
                {elegido.volumen && (
                  <div className="sonar-vol">
                    <div className="sonar-vol-fila">
                      <span><b>{elegido.moneda} {miles(elegido.volumen.monto)}</b> negociados</span>
                      <span>{elegido.volumen.operaciones} operacion{elegido.volumen.operaciones === 1 ? '' : 'es'}</span>
                      {elegido.volumen.ultima && (
                        <span className="muted">última {elegido.volumen.ultima.slice(11, 16)}</span>
                      )}
                    </div>
                    {elegido.volumen.minimo != null && elegido.volumen.maximo != null && (
                      <div className="muted sonar-vol-rango">
                        En el día fue de {elegido.moneda} {elegido.volumen.minimo} a{' '}
                        {elegido.volumen.maximo}
                        {elegido.volumen.apertura != null && <> · abrió en {elegido.volumen.apertura}</>}
                      </div>
                    )}
                    {elegido.volumen.operaciones < 20 && (
                      <div className="sonar-vol-aviso">
                        Con {elegido.volumen.operaciones} operaciones en toda la rueda, hay
                        poca contraparte: entrar es fácil y salir es donde se paga.
                      </div>
                    )}
                  </div>
                )}

                {/* ── LA FIRMA COMPLETA, cada marca con la cuenta que la
                    sostiene. Va ANTES de los titulares a propósito: esto sale
                    de los cierres reales de la BVL, y lo que se publicó
                    alrededor es siempre más blando que eso. */}
                {elegido.firma.length > 0 && (
                  <div className="firma">
                    <div className="firma-tit muted">Qué clase de movimiento fue</div>
                    {elegido.firma.map((m) => (
                      <div key={m.id} className={'firma-item f-' + m.id}>
                        <span className="firma-icono">{m.icono}</span>
                        <span>
                          <b>{m.corto}</b>
                          <span className="firma-txt"> — {m.texto}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── 🌍 LO QUE LE PUEDE ESTAR LLEGANDO DE AFUERA ──────────
                    Va SEPARADO de la firma y con otro rótulo a propósito. La
                    firma es medida: cada marca trae su cuenta sacada de los
                    cierres. Esto NO se midió contra nada — es una cadena
                    escrita a mano. Mezclarlas le daría a una hipótesis el
                    mismo peso visual que a un hecho, y esa es justamente la
                    confusión que el Radar entero existe para evitar. */}
                {(() => {
                  const mundo = mundoDe(elegido.ticker)
                  if (!mundo.length) return null
                  return (
                    <div className="mundo-ficha">
                      <div className="mundo-ficha-tit">
                        🌍 Puede estarle llegando de afuera
                      </div>
                      <div className="mundo-ficha-sub muted">
                        Cadenas escritas a mano, <b>sin medir contra el precio</b>.
                        Dicen dónde mirar, no qué pasó.
                      </div>
                      {mundo.map((m) => (
                        <div key={m.id} className="mundo-ficha-item">
                          <div className="mundo-ficha-cab">
                            {m.icono} <b>{m.titulo}</b>
                          </div>
                          <div className="mundo-ficha-via">↳ {m.via}</div>
                          {m.ultimo && (
                            <a className="mundo-ficha-nota" href={m.ultimo.url}
                               target="_blank" rel="noreferrer">
                              {m.ultimo.titulo}
                              <span className="muted"> · {m.ultimo.medio} · {m.ultimo.fecha}</span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {/* Dónde está parada dentro de su propio año. Es el contexto
                    más barato que existe y el que más cambia la lectura: el
                    mismo +6% no significa lo mismo pegado al techo que
                    rebotando del piso. */}
                {elegido.rango52 && (
                  <div className="firma-rango">
                    <div className="firma-rango-barra">
                      <i style={{ left: `${Math.min(100, Math.max(0, elegido.rango52.lugar))}%` }} />
                    </div>
                    <div className="firma-rango-pies muted">
                      <span>piso 12m · {elegido.moneda} {elegido.rango52.min}</span>
                      <span>techo · {elegido.moneda} {elegido.rango52.max}</span>
                    </div>
                  </div>
                )}

                {elegido.hecho?.dias != null && elegido.hecho.dias <= 12 && (
                  <a className="cand-item cand-hecho" href={elegido.hecho.pdf || undefined}
                     target="_blank" rel="noreferrer"
                     onClick={(e) => { if (!elegido.hecho.pdf) e.preventDefault() }}>
                    <span className="cand-icono">📄</span>
                    <span>
                      <b>Hecho de Importancia</b>{' '}
                      {elegido.hecho.dias === 0 ? 'hoy' : elegido.hecho.dias === 1 ? 'ayer'
                        : `hace ${elegido.hecho.dias} días`}
                      {elegido.hecho.categoria && <> · {elegido.hecho.categoria.toLowerCase()}</>}
                    </span>
                  </a>
                )}

                {/* ⚠ LA MARCA que pediste: «tal vez sea por esto». Solo
                    aparece si hay titulares DENTRO de la ventana del
                    movimiento y en la misma dirección. Nunca dice «porque». */}
                {explican.length > 0 && (
                  <div className="quiza">
                    <div className="quiza-tit">
                      ⚠ Tal vez {elegido.sube ? 'esté subiendo' : 'esté cayendo'} por esto
                    </div>
                    <div className="quiza-sub muted">
                      {explican.length === 1 ? 'Este titular salió' : `Estos ${explican.length} titulares salieron`}{' '}
                      <b>dentro</b> de {plazo.etiqueta} que llevamos midiendo, y desde
                      entonces la acción se movió en esa dirección. <b>Es una
                      coincidencia de fechas medida, no una causa comprobada.</b>
                    </div>
                    {explican.slice(0, 3).map((n) => (
                      <a key={n.url} className="quiza-item" href={n.url} target="_blank" rel="noreferrer">
                        <span className="quiza-efecto">
                          {n.desdeElTitular >= 0 ? '+' : '−'}{Math.abs(n.desdeElTitular).toFixed(1)}%
                        </span>
                        <span className="quiza-txt">
                          {n.titulo}
                          <span className="muted"> · {n.medio} · desde el {n.fecha}</span>
                        </span>
                      </a>
                    ))}
                  </div>
                )}

                {noticias.length > 0 && (
                  <div className="sonar-otros-tit muted">
                    {explican.length ? 'Lo demás publicado' : 'Publicado alrededor'}
                  </div>
                )}
                {noticias.filter((n) => !explican.slice(0, 3).some((e) => e.url === n.url)).map((n) => (
                  <a key={n.url} className="cand-item" href={n.url} target="_blank" rel="noreferrer">
                    <span className="cand-icono">{n.icono}</span>
                    <span>
                      {n.titulo}<span className="muted"> · {n.medio}</span>
                      {!n.dentroDeVentana && (
                        <span className="quiza-fuera"> · anterior a {plazo.etiqueta} medida</span>
                      )}
                    </span>
                  </a>
                ))}

                {!noticias.length && !elegido.hecho && (
                  <p className="cand-nada muted">Nada publicado alrededor de este movimiento.</p>
                )}

                <button className="btn sonar-ficha-btn" onClick={() => onVerEmpresa(elegido.ticker)}>
                  Ver la ficha completa →
                </button>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
