import { useEffect, useState } from 'react'

// Favoritos ("mi lista para estudiar") — guardados en el navegador/celular
// (localStorage). Sin cuentas ni servidores: privado y simple.

const CLAVE = 'alto-favoritos'
const EVENTO = 'alto-favoritos-cambio'

export function leerFavoritos() {
  try {
    const crudo = JSON.parse(localStorage.getItem(CLAVE))
    return Array.isArray(crudo) ? crudo : []
  } catch {
    return []
  }
}

export function esFavorito(ticker) {
  return leerFavoritos().includes(ticker)
}

export function alternarFavorito(ticker) {
  const lista = leerFavoritos()
  const nueva = lista.includes(ticker)
    ? lista.filter((t) => t !== ticker)
    : [...lista, ticker]
  try {
    localStorage.setItem(CLAVE, JSON.stringify(nueva))
  } catch {
    /* modo incógnito sin storage: el corazón funciona solo en la sesión */
  }
  window.dispatchEvent(new CustomEvent(EVENTO))
  return nueva
}

// Hook: lista de favoritos siempre al día (se entera de cambios en otras vistas).
export function useFavoritos() {
  const [favoritos, setFavoritos] = useState(leerFavoritos)
  useEffect(() => {
    const al = () => setFavoritos(leerFavoritos())
    window.addEventListener(EVENTO, al)
    window.addEventListener('storage', al) // otra pestaña
    return () => {
      window.removeEventListener(EVENTO, al)
      window.removeEventListener('storage', al)
    }
  }, [])
  return favoritos
}
