// Disclaimer visible (no escondido). Regla de Oro #9: la app educa, no recomienda.
export default function Disclaimer({ compacto = false }) {
  if (compacto) {
    return (
      <p className="muted center" style={{ marginTop: 10 }}>
        Contenido educativo · no es recomendación de inversión · el mercado manda.
      </p>
    )
  }
  return (
    <div className="disclaimer">
      <strong>Esto es contenido educativo.</strong> ALTO Research no recomienda
      qué comprar ni vender. Mostramos empresas <strong>para estudiar</strong>{' '}
      según tu perfil; la decisión es tuya. No es recomendación de inversión ni
      garantía de rendimiento — el mercado manda. Recomendar formalmente
      (precio objetivo, "comprar") corresponde a una SAB regulada por la SMV.
    </div>
  )
}
