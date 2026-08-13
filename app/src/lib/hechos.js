import hechosData from '../data/hechos.json'

// ═════════════════════════════════════════════════════════════════════════
// 📄 LOS HECHOS DE IMPORTANCIA — la ÚNICA puerta para pedirlos
//
// POR QUÉ EXISTE. Los Hechos tienen dos representaciones con distinta frescura:
// el archivo que deja el robot (cambia cuando se vuelve a publicar la web) y lo
// que el navegador baja del endpoint de la BVL cada 45 s. Mientras solo el
// Radar veía la versión viva, la app mostraba dos verdades: el Sonar decía
// «📄 HI 07:08» de una empresa y al abrir esa misma empresa su lista de Hechos
// no lo tenía.
//
// El criterio, que vale también para lo que venga después: la puerta única no
// se pone por simetría, se pone donde EXISTE una segunda representación más
// fresca del mismo dato. Por eso `historicos.json` la tiene (lib/series.js) y
// `dividendos.json` no — no existe un dividendo intradía.
//
// EL DEDUPE NO VA POR PDF, y es la trampa de este archivo: el que llega en
// vivo puede no traer documento todavía (`bajarHechosVivos` solo pone `pdf` si
// la BVL ya publicó la ruta), y el mismo Hecho, cuando el robot lo hornee, sí
// lo va a traer. Con el PDF de clave serían dos Hechos distintos y el usuario
// vería el suyo repetido. La clave es fecha + texto.
// ═════════════════════════════════════════════════════════════════════════

const TODOS = hechosData.hechos || {}

const clave = (h) => `${h.fecha}|${(h.titulo || h.categoria || '').trim().toLowerCase()}`

// Más nuevo primero. Con fecha empatada gana el que trae hora — es el vivo, y
// es el que puede decir a qué hora de la rueda salió.
const porFechaYHora = (a, b) => `${b.fecha} ${b.hora || ''}`.localeCompare(`${a.fecha} ${a.hora || ''}`)

// La lista de Hechos de una empresa. Sin `vivos` devuelve exactamente lo que
// hay en el archivo: el mismo comportamiento de siempre para las pantallas que
// no encienden la capa viva.
export function hechosDe(ticker, vivos = null) {
  const horneados = TODOS[ticker]?.hechos || []
  const frescos = vivos?.[ticker] || []
  if (!frescos.length) return horneados
  const vistos = new Set(frescos.map(clave))
  return [...frescos, ...horneados.filter((h) => !vistos.has(clave(h)))].sort(porFechaYHora)
}

// El más reciente, que es lo único que mira el Sonar.
export const ultimoHechoDe = (ticker, vivos = null) => hechosDe(ticker, vivos)[0] || null

// El resto de la ficha de la empresa en el archivo (rpj, url del listado…).
export const fichaHechosDe = (ticker) => TODOS[ticker] || null

// rpjCode de la BVL -> ticker nuestro, para que lib/vivo.js pueda traducir lo
// que baja del endpoint sin importar el archivo por su cuenta.
export function mapaRpj() {
  const m = new Map()
  for (const [ticker, h] of Object.entries(TODOS)) {
    if (h?.rpj) m.set(h.rpj, ticker)
  }
  return m
}
