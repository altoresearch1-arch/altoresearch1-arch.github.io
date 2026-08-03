// 🔴 EL SELLO — de cuándo es el número que estás mirando.
//
// Esto no es un adorno de "app moderna": es la única forma honesta de mostrar
// un dato que a veces tiene 20 segundos y a veces tiene tres días. Un precio
// sin fecha miente por omisión, y en una pantalla que se llama Sonar la
// diferencia entre "ahora" y "el viernes" es toda la información.
//
// Los cinco estados salen de lib/vivo.js y cada uno dice algo distinto:
//   vivo    — la BVL contestó hace segundos, hay rueda
//   cerrado — contestó, pero la rueda está cerrada: es el último cierre
//   vacio   — contestó bien y SIN cotizaciones (le pasa a la BVL de verdad;
//             el 03-ago-2026 su propia web decía "no hay datos disponibles")
//   error   — no se pudo llegar
//   inicial — todavía preguntando
export default function SelloVivo({ vivo, fecha, compacto = false }) {
  const { estado, actualizado, error } = vivo || {}

  if (estado === 'vivo') {
    return (
      <span className="sello-vivo" title={`Precio pedido directamente a la BVL a las ${actualizado}. Se refresca solo cada 45 segundos mientras hay rueda.`}>
        <i className="sello-punto" aria-hidden="true" />
        EN VIVO
        {!compacto && actualizado && (
          <span className="sello-hora"> · {actualizado.slice(0, 5)}</span>
        )}
      </span>
    )
  }

  if (estado === 'vacio') {
    return (
      <span className="sello-vivo apagado" title="La BVL respondió correctamente pero sin ninguna cotización. No es una falla de la app: su propia web muestra lo mismo. Se sigue mostrando el último dato del robot.">
        ⚪ la BVL no está publicando
        {!compacto && fecha && <span className="sello-hora"> · se ve el {fecha}</span>}
      </span>
    )
  }

  if (estado === 'error') {
    return (
      <span className="sello-vivo apagado" title={`No se pudo llegar a la BVL (${error}). Se muestra el último dato que bajó el robot.`}>
        ⚠ sin conexión con la BVL
        {!compacto && fecha && <span className="sello-hora"> · se ve el {fecha}</span>}
      </span>
    )
  }

  // 'cerrado' e 'inicial': el cierre de siempre, dicho como siempre.
  return (
    <span className="muted">
      {estado === 'inicial' ? 'consultando la BVL…' : `cierre del ${fecha || '—'}`}
    </span>
  )
}
