// Los textos de la casa se escriben con **negritas** (Jair las usa en tips, en
// tesis y en mentor.json). Un <p> no las entiende, así que aquí se traducen:
// cuatro líneas y ninguna dependencia de markdown.
//
// Vivía dentro de MentorALTO; salió a lib el 23-jul, cuando el guion del tour
// del Cuaderno también empezó a marcar palabras (las 6 columnas de la hoja).
export function conNegritas(texto) {
  return String(texto ?? '')
    .split(/(\*\*[^*]+\*\*)/g)
    .map((trozo, i) =>
      trozo.startsWith('**') && trozo.endsWith('**') && trozo.length > 4
        ? <strong key={i}>{trozo.slice(2, -2)}</strong>
        : trozo,
    )
}
