import { useEffect, useState } from 'react'
import { TOTAL_TARJETAS } from './LeccionExpres'

// Menú de navegación (☰): descongestiona la topbar (antes: 8 elementos en un
// renglón). En celular es una HOJA INFERIOR (al alcance del pulgar, como app
// nativa); en escritorio, un panel bajo el botón. El mismo componente: el CSS
// decide la forma por media query (.menu-nav).
// Cierra por: toque al fondo, Escape, o al elegir un destino.
const ITEMS = [
  { id: 'inicio', icono: '🏠', label: 'Inicio', hash: '#/' },
  { id: 'explorar', icono: '🔎', label: 'Explorar empresas', hash: '#/explorar' },
  { id: 'cuaderno', icono: '📓', label: 'Mi Cuaderno', hash: '#/cuaderno', beta: true },
  { id: 'glosario', icono: '📖', label: 'Glosario', hash: '#/glosario' },
  { id: 'ia', icono: '🧠', label: 'Atlas', hash: '#/ia', beta: true },
  { id: 'comentarios', icono: '💬', label: 'Comentarios', hash: '#/comentarios' },
  { id: 'gracias', icono: '💛', label: 'Gracias', hash: '#/gracias' },
]

const MS_CIERRE = 180 // espejo de .menu-nav-fondo.cerrando en styles.css

export default function MenuNav({ vista, onIr, onApoyar, onTour, onLeccion, onEnganche, onColores, onCerrar }) {
  const [cerrando, setCerrando] = useState(false)

  // Cierre con animación de salida (más corta que la entrada, como debe ser)
  const cerrar = () => {
    if (cerrando) return
    setCerrando(true)
    setTimeout(onCerrar, MS_CIERRE)
  }

  useEffect(() => {
    const porTecla = (e) => {
      if (e.key === 'Escape') cerrar()
    }
    document.addEventListener('keydown', porTecla)
    return () => document.removeEventListener('keydown', porTecla)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className={'menu-nav-fondo' + (cerrando ? ' cerrando' : '')}
      onPointerDown={cerrar}
    >
      <nav
        className="menu-nav"
        aria-label="Menú principal"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="menu-nav-asa" aria-hidden="true" />
        {ITEMS.map((it, i) => (
          <button
            key={it.id}
            className={'menu-nav-item' + (vista === it.id ? ' activo' : '')}
            style={{ '--i': i }}
            onClick={() => {
              onIr(it.hash)
              cerrar()
            }}
          >
            <span className="menu-nav-icono" aria-hidden="true">{it.icono}</span>
            {it.label}
            {it.beta && <span className="nav-beta">beta</span>}
            {vista === it.id && <span className="menu-nav-check" aria-hidden="true">•</span>}
          </button>
        ))}
        <div className="menu-nav-sep" aria-hidden="true" />
        <button
          className="menu-nav-item"
          style={{ '--i': ITEMS.length }}
          onClick={() => {
            onTour()
            cerrar()
          }}
        >
          <span className="menu-nav-icono" aria-hidden="true">❓</span>
          Tour guiado
        </button>
        {/* 🐣 La lección exprés no se ve una sola vez y se pierde: queda aquí
            para volver a ella (o para enseñársela a alguien) — #135. */}
        <button
          className="menu-nav-item"
          style={{ '--i': ITEMS.length + 1 }}
          onClick={() => {
            onLeccion()
            cerrar()
          }}
        >
          <span className="menu-nav-icono" aria-hidden="true">🐣</span>
          Lección exprés ({TOTAL_TARJETAS} tarjetas)
        </button>
        {/* 📋 El plan NO es de un solo uso: el banco tiene 162 preguntas y una
            ronda usa 8. Volver es encontrar cosas nuevas, no repetir. Su sitio
            principal es el inicio (ver PlanInversor.jsx); acá queda el atajo
            para el que ya sabe lo que busca. */}
        {onEnganche && (
          <button
            className="menu-nav-item"
            style={{ '--i': ITEMS.length + 2 }}
            onClick={() => {
              onEnganche()
              cerrar()
            }}
          >
            <span className="menu-nav-icono" aria-hidden="true">📋</span>
            Plan para nuevo inversor
          </button>
        )}
        {/* 🎨 Los colores. Existían solo al pie del desplegable del badge de
            nivel, y ahí no los encontró nadie: ese menú se abre para cambiar
            de nivel, no para pintar. Acá se ven. */}
        {onColores && (
          <button
            className="menu-nav-item"
            style={{ '--i': ITEMS.length + 3 }}
            onClick={() => {
              onColores()
              cerrar()
            }}
          >
            <span className="menu-nav-icono" aria-hidden="true">🎨</span>
            Colores de la app
          </button>
        )}
        <button
          className="menu-nav-item menu-nav-apoyo"
          style={{ '--i': ITEMS.length + 4 }}
          onClick={() => {
            onApoyar()
            cerrar()
          }}
        >
          <span className="menu-nav-icono" aria-hidden="true">💛</span>
          Apóyanos
        </button>
      </nav>
    </div>
  )
}
