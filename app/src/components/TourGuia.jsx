import { useEffect, useMemo, useState } from 'react'
import { prefiereQuieto } from '../lib/anim'

// 🚶 TOUR GUIADO (pedido de Jair 15-jul: "que te lleve de la mano y explique
// todo como si fuera un bebé, con opción a cerrarlo y que esté ahí siempre").
// Patrón coachmark estilo driver.js pero NUESTRO (CSS puro, cero librerías):
// un velo oscurece todo menos el elemento del paso (recuadro dorado que se
// DESLIZA de un paso al otro) y una tarjeta lo explica en cristiano.
// - Los pasos cuyo elemento no existe se saltan solos (Mi lista vacía,
//   gancho de niveles altos, CTA de subir en nivel 4…).
// - Esc cierra; ← → navegan; el foco sigue al elemento si la página se mueve.

// Pasos del INICIO — lenguaje de bebé, cero jerga.
export const PASOS_INICIO = [
  {
    sel: '.nav .nivel-badge',
    icono: '🎚️', titulo: 'Tu nivel',
    texto: 'La app entera se acomoda a ti. Este botón dice tu modo actual — tócalo cuando quieras ver más cosas (o menos). Puedes cambiarlo mil veces, nada se pierde.',
  },
  {
    sel: '.cinta',
    icono: '📟', titulo: 'La bolsa, respirando',
    texto: 'Esta tira que desfila son las empresas que negociaron en el último cierre de la Bolsa de Lima. Verde ▲ = subió, rojo ▼ = bajó. Toca cualquiera y te lleva a su ficha.',
  },
  {
    sel: '.buscar-inicio',
    icono: '🔎', titulo: 'Busca cualquier empresa',
    texto: '¿Escuchaste un nombre por ahí? Escríbelo aquí — "BVN", "Southern", hasta "cerveza" — y te llevamos directo a su ficha.',
  },
  {
    sel: '.hero-actions .btn-oro',
    icono: '🎯', titulo: 'El quiz (el mejor comienzo)',
    texto: 'Responde 4 preguntas facilitas — sin números ni trampas — y te mostramos empresas que encajan con tu forma de ser. De ahí eliges cuál estudiar.',
  },
  {
    sel: '.gancho',
    icono: '🎣', titulo: 'Datos que pican',
    texto: 'Cositas reales del mercado que van cambiando solas: quién saltó, quién paga más dividendos… Si una te da curiosidad, tócala.',
  },
  {
    sel: '.milista',
    icono: '⭐', titulo: 'Tu lista',
    texto: 'Las empresas que guardaste con la estrellita viven aquí. Si alguna publica una noticia importante, te avisamos con un din-don.',
  },
  {
    sel: '.hoy',
    icono: '📊', titulo: 'Así cerró la BVL',
    texto: 'Quiénes subieron y bajaron más en el último cierre. Ojo: un día no hace tendencia — esto es para curiosear, no para correr a comprar.',
  },
  {
    sel: '.empdia',
    icono: '🎁', titulo: 'La empresa del día',
    texto: 'Cada día te presentamos una empresa distinta de la bolsa. Visítanos seguido y en unos meses las conoces todas.',
  },
  {
    sel: '[data-tour="nav-cuaderno"]',
    icono: '📓', titulo: 'Mi Cuaderno',
    texto: 'Tu cartera vive aquí: anota (o importa con una foto) las acciones que tienes y el Cuaderno te calcula tu patrimonio, tus próximos dividendos, un calendario y más — todo privado, en tu teléfono. Ábrelo y toca el ❓: tiene su propio tour con una cartera de ejemplo.',
  },
  {
    sel: '.nav-menu',
    icono: '☰', titulo: 'Todo lo demás',
    texto: 'El glosario (diccionario de palabras raras), Atlas — nuestra IA que enseña —, 📓 Mi Cuaderno, comentarios y más. Todo vive detrás de este botón.',
  },
  {
    sel: '.apoyo-pill',
    icono: '💛', titulo: 'Esto es gratis',
    texto: 'La app es gratis y sin anuncios. Si un día te sirve de verdad, un yape nos ayuda a mantenerla viva. Y listo — ese fue el tour. Cuando abras una empresa, el botón ❓ te explica esa pantalla también.',
  },
]

// ⚠ Los pasos de la FICHA ya NO viven aquí: se arman por NIVEL y con los datos
// reales de la empresa en lib/guiontour.js (sesión 2 del plan educativo, #1/#3/
// #101). Este archivo se queda con los tours de pantalla que no dependen de una
// empresa concreta.

// Pasos del COMPARADOR (#4) — la pantalla más densa de la app y hasta hoy la
// única sin tour. El hilo: elige el par → mira la carrera → lee la tabla →
// y sobre todo, entiende CUÁNDO comparar dos empresas no tiene sentido.
export const PASOS_COMPARADOR = [
  {
    sel: '.comp-cabecera',
    icono: '⚖️', titulo: 'Las dos que se baten',
    texto: 'Arriba eliges quién pelea. Puedes cambiar cualquiera de las dos sin salir de aquí, y el link de la barra se actualiza solo: si lo compartes, tu amigo ve el mismo duelo.',
  },
  {
    sel: '.comp-sector-aviso',
    icono: '🔍', titulo: 'Ojo: no se leen igual',
    texto: 'Cuando las dos viven de cosas distintas, te avisamos aquí con la razón concreta del par. No es un detalle: comparar la deuda de un banco con la de una minera es como comparar la harina del panadero con la deuda del taxista. Mismo número, significado distinto.',
  },
  {
    sel: '.comp-carrera',
    icono: '🏁', titulo: 'La carrera',
    texto: 'Las dos acciones puestas en la misma pista: ambas arrancan en 100 y se ve quién va ganando en el período que elijas. Así se comparan precios distintos (una de S/ 2 y otra de S/ 300) sin engañarse.',
  },
  {
    sel: '.comp-tabla',
    icono: '📊', titulo: 'Dato por dato',
    texto: 'Los mismos números para las dos, lado a lado. Las barras muestran MAGNITUD relativa, no cuál es mejor — y donde falta un dato decimos "Pendiente (SMV)" en vez de inventarlo. Toca las notas grises: explican qué significa cada fila.',
  },
  {
    sel: '.comp-duelo',
    icono: '💰', titulo: 'Duelo de dividendos',
    texto: 'Cuál te devuelve más al año por cada sol invertido. Si ves un yield gigante (>20%), casi siempre es un pago extraordinario que no se repite o un precio viejo — no un regalo.',
  },
  {
    sel: '.comp-tesis-par',
    icono: '📜', titulo: 'La historia de cada una',
    texto: 'Los números no deciden solos: aquí está en una línea de qué vive cada una. Si no entiendes el negocio, ningún ratio te va a salvar.',
  },
  {
    sel: '.comp-tabla',
    icono: '🧠', titulo: 'Y ahora, decide TÚ',
    texto: 'No hay ganador declarado a propósito: no existe "la mejor" en abstracto, existe la que encaja con tu plazo, tu estómago y tu perfil. El duelo sirve para elegir cuál estudiar primero. 🎉',
  },
]

// Pasos de RESULTADOS del quiz (#5) — hoy el usuario ve 3 empresas y no sabe
// de dónde salieron. Aquí se explica el cruce perfil × sector y, sobre todo,
// que esto es un punto de partida y no una recomendación.
export const PASOS_RESULTADOS = [
  {
    sel: '.perfil-tag',
    icono: '🧭', titulo: 'Tu perfil',
    texto: 'Esto salió de tus 4 respuestas: qué tanto aguantas los sustos, en cuánto tiempo piensas, y si prefieres que te paguen o que crezca. No es un test de personalidad — es una brújula para saber qué mirar primero.',
  },
  {
    sel: '.lead',
    icono: '📖', titulo: 'Qué significa',
    texto: 'La descripción de tu perfil en cristiano. Si no te suena a ti, rehaz el quiz sin miedo: nadie te está calificando y las respuestas no se guardan en ningún servidor.',
  },
  {
    sel: '.aviso-perfil',
    icono: '⚠️', titulo: 'La trampa de tu perfil',
    texto: 'Cada perfil tiene su error clásico y te lo decimos aquí mismo, antes de que lo cometas. Este avisito vale más que las tres empresas de abajo.',
  },
  {
    sel: '[data-tour="res-empresas"]',
    icono: '🃏', titulo: 'Por qué estas empresas',
    texto: 'Son las del sector que elegiste que MEJOR encajan con tu perfil: "coincidencia alta" es que casi todo cuadra, "parcial" es que cuadra a medias. No son las mejores de la bolsa ni una recomendación de compra: son un punto de partida para estudiar.',
  },
  {
    sel: '[data-tour="res-reintentar"]',
    icono: '↻', titulo: 'Muéstrame otras',
    texto: '"Intentar de nuevo" rota a otras empresas del mismo perfil — hay más de tres. "Rehacer el quiz" empieza de cero si sientes que respondiste apurado.',
  },
  {
    sel: '[data-tour="res-todas"]',
    icono: '📚', titulo: 'No te encierres en tu perfil',
    texto: 'Abajo están TODAS las empresas agrupadas por sector, cada sector con un tip para leerlo. Toca cualquiera y entras a su ficha, donde el ❓ te da el tour de esa empresa. 🎉',
  },
]

// Pasos de EXPLORAR — las empresas + el «modo enfrentamiento» (pedido de Jair
// 17-jul). Lenguaje de bebé, cero jerga; el paso estrella es el duelo ⚖.
export const PASOS_EXPLORAR = [
  {
    sel: '.explorar-busqueda',
    icono: '🔎', titulo: 'Busca entre todas',
    texto: 'Aquí están TODAS las empresas de la Bolsa de Lima que seguimos. Escribe un ticker o un nombre — «BVN», «Gloria», hasta «cemento» — y la lista se filtra al toque.',
  },
  {
    sel: '.explorar-chips',
    icono: '🏷️', titulo: 'Filtra por sector',
    texto: 'Toca un sector (minas, bancos, alimentos…) y verás solo esas. «Todos» te las devuelve completas.',
  },
  {
    sel: '.explorar-filtros',
    icono: '🎛️', titulo: 'Afina la búsqueda',
    texto: 'Deja solo las que pagan dividendos o las que se negocian seguido, y ordénalas por nombre o por cuánto rinden. Se combinan como quieras.',
  },
  {
    sel: '.empresa-item',
    icono: '🃏', titulo: 'Cada tarjeta',
    texto: 'Un vistazo de cada empresa: su sector, si paga dividendos y a cuánto cerró. Tócala y entras a su ficha completa.',
  },
  {
    sel: '.empresa-item .btn-estrella',
    icono: '⭐', titulo: 'Guárdala',
    texto: 'La estrellita la manda a tu lista del inicio, vigilada: si publica una noticia importante, te suena un aviso.',
  },
  {
    sel: '.empresa-item .btn-comparar',
    icono: '⚖️', titulo: 'Modo enfrentamiento',
    texto: 'Lo mejor de aquí: toca el ⚖ en DOS empresas y se baten en duelo — precio, dividendos, tamaño, producción minera… lado a lado, para decidir cuál estudiar primero. ¡Y listo, ese es Explorar! 🎉',
  },
]

// Pasos de MI CUADERNO (pedido de Jair 17-jul). Al arrancar, el Cuaderno carga
// una cartera de EJEMPLO (simulación) para que todo esté lleno y se pueda
// mostrar de la mano; al cerrar el tour la borra sola (si el usuario no metió
// la suya). Los pasos cuyo elemento no exista se saltan igual.
export const PASOS_CUADERNO = [
  {
    sel: '.cd-patrimonio',
    icono: '📓', titulo: 'Tu Cuaderno (con ejemplo)',
    texto: 'Para mostrarte cómo se ve lleno, cargué una cartera de EJEMPLO — no es real, y al cerrar el tour la borro sola. Este número grande es tu patrimonio: todo lo que tienes sumado, latiendo con los precios del día.',
  },
  {
    sel: '.cd-botonera',
    icono: '🛰', titulo: 'Así armas la tuya',
    texto: 'Aquí empiezas: «Importar de mi broker» lee una foto o PDF de tu estado de cuenta y reconoce tus acciones solo; «+ Agregar» las pones a mano. Todo se guarda en tu teléfono — sin cuentas ni nube.',
  },
  {
    sel: '[data-tour="cd-acciones"]',
    icono: '📄', titulo: 'Tu hoja de acciones',
    texto: 'Cada empresa que tienes, con cuánto va ganando o perdiendo. Tócala para ver el detalle, ponerle una nota o editar cuántas tienes y a qué precio las compraste.',
  },
  {
    sel: '[data-tour="cd-flujo"]',
    icono: '💰', titulo: 'Tu lluvia de dividendos',
    texto: 'Los próximos pagos que caerían a tu bolsillo, mes a mes, según lo que cada empresa suele repartir. El mes más gordo lleva su corona 👑. Son estimados con el patrón real — no promesas.',
  },
  {
    sel: '[data-tour="cd-calendario"]',
    icono: '📅', titulo: 'Calendario inteligente',
    texto: 'Las fechas que te importan — cortes de dividendo, pagos, juntas — marcadas en el mes. Toca un día con puntito y te dice qué pasa.',
  },
  {
    sel: '[data-tour="cd-pulso"]',
    icono: '🛰', titulo: 'El pulso de tus empresas',
    texto: 'Las noticias oficiales (Hechos de Importancia) de TUS empresas, con el semáforo del lector: 🟢 buena pinta, 🔴 ojo, 🟡 neutra. Llegan solas, sin que las busques.',
  },
  {
    sel: '[data-tour="cd-vigilar"]',
    icono: '👀', titulo: 'Lo que debes vigilar',
    texto: 'Avisos armados desde tus propias empresas: demasiado dinero en una sola, un dividendo que se acerca, algo que cambió. Como un amigo que te pica el hombro.',
  },
  {
    sel: '[data-tour="cd-recordatorios"]',
    icono: '⏰', titulo: 'Tus recordatorios',
    texto: 'Apúntate lo que no quieras olvidar — «revisar Ferreycorp tras sus resultados» — y queda guardado aquí. Tú mandas.',
  },
  {
    sel: '[data-tour="cd-torta"]',
    icono: '🥧', titulo: 'Tu torta',
    texto: 'Cómo está repartido tu dinero entre empresas y sectores. Si una tajada se ve enorme, es señal de que estás muy concentrado en una sola apuesta.',
  },
  {
    sel: '.cd-pie',
    icono: '🔒', titulo: 'Todo es tuyo y privado',
    texto: 'Nada de esto sale de tu navegador: sin cuentas, sin nube, sin que nadie lo vea. Y listo — ya conoces tu Cuaderno. Borro la cartera de ejemplo y te dejo empezar la tuya. 🎉',
  },
]

const ALTO_TARJETA = 230 // alto estimado de la tarjeta para decidir arriba/abajo

export default function TourGuia({ pasos, onCerrar }) {
  // solo los pasos cuyo elemento SÍ está en pantalla ahora mismo — y VISIBLE
  // (getClientRects() queda vacío si está display:none, ej. los nav-links en
  // móvil): así el paso de un elemento oculto se salta en vez de enfocar la nada
  const lista = useMemo(
    () => pasos.filter((p) => {
      const el = document.querySelector(p.sel)
      if (!el) return false
      // Además de existir tiene que OCUPAR espacio: los envoltorios cuyo
      // contenido no se pintó (ej. la producción minera de un banco) dejan un
      // div vacío de alto 0 — y un paso apuntando a la nada rompe el hilo.
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }),
    [pasos],
  )
  const [i, setI] = useState(0)
  const [caja, setCaja] = useState(null)
  const quieto = prefiereQuieto()
  const paso = lista[i]

  // medir el elemento del paso (tras el scroll suave) y seguirlo si algo se mueve
  useEffect(() => {
    if (!paso) return
    const el = document.querySelector(paso.sel)
    if (!el) return
    setCaja(null) // la tarjeta espera a la medida nueva
    el.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'center' })
    let raf
    const medir = () => {
      const r = el.getBoundingClientRect()
      setCaja({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    const t = setTimeout(medir, quieto ? 60 : 430)
    const seguir = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(medir)
    }
    window.addEventListener('resize', seguir)
    window.addEventListener('scroll', seguir, true)
    // el layout puede moverse SIN scroll (ej. el gancho rota y cambia de alto):
    // re-medición periódica barata para que el foco quede pegado al objetivo
    const iv = setInterval(medir, 350)
    return () => {
      clearTimeout(t)
      clearInterval(iv)
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', seguir)
      window.removeEventListener('scroll', seguir, true)
    }
  }, [i, paso, quieto])

  // teclado: Esc cierra, las flechas navegan
  useEffect(() => {
    const tecla = (e) => {
      if (e.key === 'Escape') onCerrar()
      if (e.key === 'ArrowRight') setI((v) => Math.min(v + 1, lista.length - 1))
      if (e.key === 'ArrowLeft') setI((v) => Math.max(v - 1, 0))
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [lista.length, onCerrar])

  if (!paso) return null
  const ultimo = i === lista.length - 1

  // tarjeta debajo del foco si hay sitio; si no, encima; siempre dentro de pantalla
  const vh = window.innerHeight
  let topTarjeta = vh / 2 - ALTO_TARJETA / 2
  if (caja) {
    const cabeAbajo = caja.top + caja.height + 12 + ALTO_TARJETA < vh
    topTarjeta = cabeAbajo
      ? caja.top + caja.height + 12
      : Math.max(10, caja.top - ALTO_TARJETA - 12)
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={`Tour: ${paso.titulo}`}>
      {/* atrapa los clics para que nada de atrás se toque por accidente */}
      <div className="tour-atrapa" />
      {caja && (
        <div
          className="tour-foco"
          style={{
            top: caja.top - 7,
            left: caja.left - 7,
            width: caja.width + 14,
            height: caja.height + 14,
          }}
        />
      )}
      <div className="tour-tarjeta" style={{ top: topTarjeta }} key={i}>
        <div className="tour-cab">
          <span className="tour-icono" aria-hidden="true">{paso.icono}</span>
          <strong className="tour-titulo">{paso.titulo}</strong>
          <button className="tour-x" onClick={onCerrar} aria-label="Cerrar el tour">✕</button>
        </div>
        <p className="tour-texto">{paso.texto}</p>
        <div className="tour-pie">
          <span className="tour-cuenta">{i + 1} de {lista.length}</span>
          <div className="tour-botones">
            {i > 0 && (
              <button className="btn btn-fantasma" onClick={() => setI(i - 1)}>←</button>
            )}
            <button
              className="btn btn-oro"
              onClick={() => (ultimo ? onCerrar() : setI(i + 1))}
            >
              {ultimo ? '¡Listo! 🎉' : 'Siguiente →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
