import { Component } from 'react'

// 🧯 EL CERCO — un fallo en una pantalla no se lleva la app entera.
//
// Hasta hoy no había ninguno: cualquier error de render en el Cuaderno —una
// posición guardada con un número raro, por ejemplo— dejaba la pantalla en
// blanco y con ella el Sonar, la ficha de empresa y todo lo demás. React lo
// avisaba por consola en cada arranque; nadie más lo veía.
//
// VA UNO POR PANTALLA, no uno global. Si el Cuaderno se cae, el Radar y la
// ficha siguen siendo perfectamente utilizables y no hay motivo para
// perderlos. Se consigue con un solo componente porque lleva `key={vista}`:
// al cambiar de pantalla React lo desmonta y monta uno nuevo, así el error de
// la anterior no se queda pegado.
//
// EL TONO, que acá también manda: no se pide perdón ni se echa la culpa al
// usuario, y no se promete que recargando se arregla. Se dice qué pasó, qué
// sigue funcionando y qué puede hacer.
export default class CercoError extends Component {
  constructor(props) {
    super(props)
    this.state = { fallo: null }
  }

  static getDerivedStateFromError(error) {
    return { fallo: error }
  }

  componentDidCatch(error, info) {
    // Queda en la consola con el nombre de la pantalla: sin servidor al que
    // mandarlo, es lo único honesto que se puede hacer con el detalle.
    console.error(`[ALTO] falló la pantalla «${this.props.nombre}»`, error, info)
  }

  render() {
    if (!this.state.fallo) return this.props.children
    return (
      <div className="card cerco">
        <h3 style={{ margin: '0 0 6px' }}>Esta pantalla no se pudo dibujar</h3>
        <p className="muted" style={{ margin: '0 0 12px' }}>
          Algo salió mal al armar <b>{this.props.nombre}</b>. El resto de la app
          sigue funcionando: puedes irte a otra sección desde el menú de arriba.
          Tus datos guardados no se tocaron.
        </p>
        <button className="btn" onClick={() => this.setState({ fallo: null })}>
          Intentar de nuevo
        </button>
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          {String(this.state.fallo?.message || this.state.fallo)}
        </p>
      </div>
    )
  }
}
