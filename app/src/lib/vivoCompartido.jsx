import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useMercadoVivo } from './vivo'

// ═════════════════════════════════════════════════════════════════════════
// 🔴 LA CAPA VIVA, UNA SOLA PARA TODA LA APP
//
// LA REGLA QUE ESTO HACE CUMPLIR: la aplicación no puede mostrar dos frescuras
// del mismo dato. Mientras el motor vivía dentro del Radar, el Sonar decía
// «📄 HI 07:08» y esa misma empresa, abierta, no tenía ese Hecho: prometer
// tiempo real en una pantalla y entregar el archivo del último despliegue en la
// siguiente no es una limitación de implementación, es una incoherencia que el
// usuario ve.
//
// ALMACÉN Y GATILLO VAN SEPARADOS, y es lo que evita el otro extremo. El
// almacén vive acá arriba, para todos; el gatillo lo encienden los CONSUMIDORES.
// Una pestaña olvidada en el glosario no tiene por qué estar preguntándole a la
// BVL cada 45 segundos: sin nadie que muestre dato vivo, el motor está apagado.
//
// Lo que NO se toca: el motor sigue siendo `useMercadoVivo` con todo lo que ya
// tenía —backoff al fallar, silencio con la pestaña de fondo, y una sola
// consulta fuera del horario de rueda—. Un `setInterval` de 45 s pelado sería
// más corto de escribir y le estaría preguntando a la BVL un domingo a las tres
// de la mañana.
// ═════════════════════════════════════════════════════════════════════════

const Ctx = createContext(null)

const VACIO = { precios: null, hechos: null, estado: 'inicial', actualizado: null, error: null }

export function ProveedorVivo({ children }) {
  // Cuántas pantallas montadas están mostrando dato vivo ahora mismo.
  const [consumidores, setConsumidores] = useState(0)
  const vivo = useMercadoVivo({ activo: consumidores > 0 })

  // Estable: si cambiara de identidad, cada repintado desmontaría y volvería a
  // montar la suscripción, y el contador subiría y bajaría solo.
  const suscribir = useCallback(() => {
    setConsumidores((n) => n + 1)
    return () => setConsumidores((n) => Math.max(0, n - 1))
  }, [])

  return <Ctx.Provider value={{ ...vivo, suscribir }}>{children}</Ctx.Provider>
}

// Para la pantalla que MUESTRA dato vivo: lee y además enciende el motor
// mientras esté montada.
export function useVivo() {
  const ctx = useContext(Ctx)
  const suscribir = ctx?.suscribir
  useEffect(() => (suscribir ? suscribir() : undefined), [suscribir])
  return ctx || VACIO
}

// Para la pantalla que aprovecha el dato vivo SI ya lo hay, pero no justifica
// encender la red por su cuenta.
export function useVivoPasivo() {
  return useContext(Ctx) || VACIO
}
