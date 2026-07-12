import { useEffect, useState } from 'react'

// Nivel de experiencia del usuario: lo elige al entrar (puerta obligatoria,
// ver SelectorNivel.jsx) y filtra qué secciones de la ficha ve (Empresa.jsx).
// Es ACUMULATIVO: nivel 3 ve todo lo de 1+2+3. Guardado en localStorage,
// sin cuentas — mismo patrón que lib/favoritos.js.

const CLAVE = 'alto-nivel'
const EVENTO = 'alto-nivel-cambio'

export const NIVELES = [
  {
    id: 1,
    icono: '💸',
    nombre: '¿Cuánto podría ganar?',
    frase: 'Quiero ver cómo se movería mi dinero',
    detalle: 'Precio, cuánto ganarías o perderías, y si reparte dividendos — sin tecnicismos.',
  },
  {
    id: 2,
    icono: '🟡',
    nombre: 'Explícamela fácil',
    frase: 'Nunca he invertido, quiero entender primero',
    detalle: 'Tips para estudiar la empresa, sus fundamentos y cómo leer sus números.',
  },
  {
    id: 3,
    icono: '📊',
    nombre: 'Quiero analizarla',
    frase: 'Ya sé lo básico, quiero explorar y comparar',
    detalle: 'Catalizadores, escenarios, riesgos y producción minera (si aplica).',
  },
  {
    id: 4,
    icono: '🧠',
    nombre: 'Lobo de wall street',
    frase: 'Dame acceso completo, con IA y documentos oficiales',
    detalle: 'Sentinel, hechos de importancia, documentos SMV, noticias y todo lo demás.',
  },
]

// Qué secciones de la ficha requieren qué nivel mínimo. Lo que no aparece
// aquí es nivel 1 (base: siempre visible — precio, tesis, valoración, simulador).
export const NIVEL_SECCION = {
  tips: 2,
  guiaSector: 2,
  fundamentos: 2,
  produccionMinera: 3,
  balanceDestacado: 3,
  catalizadores: 3,
  escenarios: 3,
  riesgos: 3,
  relojDatos: 4,
  hechos: 4,
  noticiasExtranjero: 4,
  sentinel: 4,
  documentosOficiales: 4,
  fuentes: 4,
}

export function verSeccion(nivel, clave) {
  return nivel >= (NIVEL_SECCION[clave] || 1)
}

export function leerNivel() {
  try {
    const n = parseInt(localStorage.getItem(CLAVE), 10)
    return NIVELES.some((x) => x.id === n) ? n : null
  } catch {
    return null
  }
}

export function guardarNivel(id) {
  try {
    localStorage.setItem(CLAVE, String(id))
  } catch {
    /* modo incógnito sin storage: el nivel funciona solo en la sesión */
  }
  window.dispatchEvent(new CustomEvent(EVENTO))
}

// Hook: [nivel actual (null = todavía no eligió), función para cambiarlo]
export function useNivel() {
  const [nivel, setNivelState] = useState(leerNivel)
  useEffect(() => {
    const al = () => setNivelState(leerNivel())
    window.addEventListener(EVENTO, al)
    window.addEventListener('storage', al) // otra pestaña
    return () => {
      window.removeEventListener(EVENTO, al)
      window.removeEventListener('storage', al)
    }
  }, [])
  return [nivel, guardarNivel]
}
