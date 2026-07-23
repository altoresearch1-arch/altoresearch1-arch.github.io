import { useState } from 'react'

// ❓ Burbuja del tour (abajo a la izquierda, espejo de la pill de apoyo):
// SIEMPRE está ahí por si quieres el tour — y la primera vez se presenta
// sola con un globito de saludo. Cerrar el saludo no la mata: queda la ❓.
// Un saludo por pantalla (inicio/ficha), recordado en localStorage.
const SALUDOS = {
  empresa: { clave: 'ficha', titulo: '¿Te explico esta ficha?', texto: 'Te llevo de la mano y te explico todo, pasito a pasito.' },
  explorar: { clave: 'explorar', titulo: '¿Te explico cómo explorar?', texto: 'Cómo buscar, filtrar y batir 2 empresas en duelo — pasito a pasito.' },
  cuaderno: { clave: 'cuaderno', titulo: '¿Te muestro tu Cuaderno?', texto: 'Cargo una cartera de ejemplo y te enseño cada parte, de la mano.' },
  comparar: { clave: 'comparar', titulo: '¿Te explico el duelo?', texto: 'Cómo leer la carrera, la tabla y cuándo comparar dos empresas NO tiene sentido.' },
  resultados: { clave: 'resultados', titulo: '¿De dónde salieron estas?', texto: 'Te explico tu perfil, por qué estas empresas y qué hacer ahora.' },
  inicio: { clave: 'inicio', titulo: '¿Primera vez por aquí?', texto: 'Te llevo de la mano y te explico todo, pasito a pasito.' },
}

export default function BurbujaTour({ vista, onAbrir }) {
  const info = SALUDOS[vista] || SALUDOS.inicio
  const clave = 'alto-tour-saludo-' + info.clave
  const [saludo, setSaludo] = useState(() => {
    try { return !localStorage.getItem(clave) } catch { return true }
  })

  const cerrarSaludo = () => {
    setSaludo(false)
    try { localStorage.setItem(clave, '1') } catch { /* sin storage */ }
  }

  const abrir = () => {
    cerrarSaludo()
    onAbrir()
  }

  return (
    <div className="burbuja-tour-wrap">
      {saludo && (
        <div className="burbuja-tour-saludo">
          <button className="burbuja-tour-x" onClick={cerrarSaludo} aria-label="Cerrar">✕</button>
          <strong>👋 {info.titulo}</strong>
          <p>{info.texto}</p>
          <button className="btn btn-oro burbuja-tour-si" onClick={abrir}>
            🚶 Sí, dame el tour
          </button>
        </div>
      )}
      <button
        className="burbuja-tour"
        onClick={abrir}
        aria-label="Abrir el tour guiado"
        title="Tour guiado: te explicamos esta pantalla"
      >
        ❓
      </button>
    </div>
  )
}
