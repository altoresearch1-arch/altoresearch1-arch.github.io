import { useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────
// 🗂 SECCIÓN PLEGABLE DEL INICIO (pedido de Jair 25-jul: «que no haya tanto
// contenido en pantalla, ordénalo»)
//
// El inicio había crecido hasta doce bloques sueltos, uno debajo del otro,
// todos gritando a la vez: el plan, el hero, el buscador, el cuaderno, tu
// lista, el cierre de la BVL, la empresa del día, la lección, las
// actualizaciones. Nada estaba mal; lo que estaba mal era que todo pesara lo
// mismo. Así que se agrupan por PARA QUÉ sirven y cada grupo se puede cerrar.
//
// Dos reglas, y las dos vienen de la filosofía de la app (aprende a tu tiempo):
//  1. Nada se borra: lo que se pliega sigue estando, a un toque.
//  2. El usuario manda y la app se acuerda — su elección se guarda por
//     sección, así que el que cierra «el mercado hoy» no lo vuelve a ver
//     abierto mañana. Lo que la app propone es solo el estado INICIAL.
// ─────────────────────────────────────────────────────────────────────────
const CLAVE = 'alto-seccion-'

function leerAbierta(id, porDefecto) {
  try {
    const v = localStorage.getItem(CLAVE + id)
    return v == null ? porDefecto : v === '1'
  } catch {
    return porDefecto
  }
}

export default function SeccionInicio({
  id,
  icono,
  titulo,
  resumen, // lo que se ve cuando está cerrada: para qué sirve abrirla
  abiertaPorDefecto = true,
  children,
}) {
  const [abierta, setAbierta] = useState(() => leerAbierta(id, abiertaPorDefecto))

  const alternar = () => {
    setAbierta((v) => {
      const n = !v
      try { localStorage.setItem(CLAVE + id, n ? '1' : '0') } catch { /* sin storage */ }
      return n
    })
  }

  return (
    <section className={'sec-inicio' + (abierta ? ' abierta' : '')} data-sec={id}>
      <button
        className="sec-inicio-cab"
        onClick={alternar}
        aria-expanded={abierta}
        aria-controls={`sec-${id}`}
      >
        <span className="sec-inicio-icono" aria-hidden="true">{icono}</span>
        <span className="sec-inicio-tit">{titulo}</span>
        {!abierta && resumen && <span className="sec-inicio-resumen">{resumen}</span>}
        <span className="sec-inicio-flecha" aria-hidden="true">{abierta ? '▾' : '▸'}</span>
      </button>
      {abierta && (
        <div className="sec-inicio-cuerpo" id={`sec-${id}`}>
          {children}
        </div>
      )}
    </section>
  )
}
