import { useState } from 'react'
import config from '../data/config.json'

// Modal de apoyo voluntario (Yape + PayPal), estilo ALTO.
// Regla A.4: donación voluntaria al contenido educativo, NO pago por recomendación.
export default function ApoyoModal({ onCerrar }) {
  const { yapeNombre, yapeNumero, yapeQr, paypalCorreo, frase, subfrase } = config.apoyo
  const [copiado, setCopiado] = useState('')
  const [qrFalla, setQrFalla] = useState(false)

  const tieneNumero = yapeNumero && yapeNumero.trim() !== ''
  const qrSrc = yapeQr ? `${import.meta.env.BASE_URL}${yapeQr}` : null

  const copiar = (texto, etiqueta) => {
    navigator.clipboard?.writeText(texto)
    setCopiado(etiqueta)
    setTimeout(() => setCopiado(''), 1800)
  }

  const paypalUrl =
    'https://www.paypal.com/cgi-bin/webscr?cmd=_donations' +
    '&business=' + encodeURIComponent(paypalCorreo) +
    '&item_name=' + encodeURIComponent('Apoyo a ALTO Research (contenido educativo)') +
    '&currency_code=USD'

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-apoyo" onClick={(e) => e.stopPropagation()}>
        <button className="modal-cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>

        <div className="apoyo-corazon">💛</div>
        <h2 className="apoyo-titulo">{frase}</h2>
        <p className="muted center">{subfrase}</p>

        {/* Tarjeta Yape: si hay QR, mostramos la imagen oficial (ya trae logo, QR y nombre) */}
        {qrSrc && !qrFalla ? (
          <img
            className="yape-card-img"
            src={qrSrc}
            alt={`Yape de ${yapeNombre} — escanea para apoyar`}
            onError={() => setQrFalla(true)}
          />
        ) : (
          <div className="yape-card">
            <div className="yape-logo">yape</div>
            <div className="yape-qr-box">
              <div className="yape-qr-falta">
                Escanea el QR de Yape
                <br />
                <span>(pendiente de cargar)</span>
              </div>
              <div className="yape-paga">Paga aquí con Yape</div>
            </div>
            <div className="yape-nombre">{yapeNombre}</div>
          </div>
        )}

        {/* Número */}
        {tieneNumero && (
          <div className="apoyo-fila">
            <div>
              <div className="k muted">CELULAR</div>
              <div className="apoyo-dato">{yapeNumero}</div>
            </div>
            <button className="btn" onClick={() => copiar(yapeNumero, 'numero')}>
              {copiado === 'numero' ? '¡Copiado!' : 'Copiar número'}
            </button>
          </div>
        )}

        <div className="apoyo-sep">o también por PayPal</div>

        {/* PayPal */}
        <div className="apoyo-fila">
          <div>
            <div className="k muted">CORREO PAYPAL</div>
            <div className="apoyo-dato" style={{ fontSize: 15 }}>{paypalCorreo}</div>
          </div>
          <button className="btn" onClick={() => copiar(paypalCorreo, 'correo')}>
            {copiado === 'correo' ? '¡Copiado!' : 'Copiar'}
          </button>
        </div>
        <a className="btn btn-oro apoyo-paypal" href={paypalUrl} target="_blank" rel="noreferrer">
          Donar con PayPal
        </a>

        <p className="apoyo-legal">
          Contenido educativo · es una <strong>donación voluntaria</strong> al contenido,
          no un pago por recomendación de inversión ni asesoría. Cualquier apoyo es voluntario.
        </p>
      </div>
    </div>
  )
}
