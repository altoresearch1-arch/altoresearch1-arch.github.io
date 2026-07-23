import { useEffect, useMemo, useState } from 'react'
import quiz from '../data/quiz.json'
import empresasData from '../data/empresas.json'
import preciosData from '../data/precios.json'
import tipsData from '../data/tips.json'
import { calcularPerfil, mejoresEmpresas } from '../lib/scoring'
import { prefiereQuieto, Reveal } from '../lib/anim'
import Disclaimer from './Disclaimer'

// Orden de sectores como en el quiz
const ORDEN_SECTORES = ['minas', 'bancos', 'afp', 'alimentos', 'electricas', 'cemento', 'retail', 'diversas', 'fondos', 'textil', 'acereras', 'pesqueras']

function precioCorto(ticker) {
  const px = preciosData.precios?.[ticker]
  if (!px || px.precio == null) return null
  return `${px.moneda} ${px.precio}`
}

// Pantalla de resultados: cruce PERFIL x SECTOR -> empresas para estudiar.
export default function Resultados({ respuestas, onVerEmpresa, onReiniciar }) {
  const { perfil, sector } = useMemo(
    () => calcularPerfil(respuestas, quiz.preguntas),
    [respuestas]
  )

  const todas = mejoresEmpresas(empresasData.empresas, perfil, sector, 3)
  // "intentar de nuevo" rota a otra empresa del mismo perfil
  const [offset, setOffset] = useState(0)
  const mostradas = useMemo(() => {
    if (todas.length === 0) return []
    return Array.from({ length: Math.min(3, todas.length) }, (_, k) => {
      return todas[(k + offset) % todas.length]
    })
  }, [todas, offset])

  const infoPerfil = quiz.perfiles[perfil]
  const nombreSector = quiz.sectores[sector]

  // Reveal del perfil: pequeña pausa de suspenso antes de mostrar el resultado
  // (se salta si el usuario pidió menos movimiento).
  const [revelado, setRevelado] = useState(prefiereQuieto())
  useEffect(() => {
    if (revelado) return
    const t = setTimeout(() => setRevelado(true), 1500)
    return () => clearTimeout(t)
  }, [revelado])

  // Todas las empresas agrupadas por sector (para "explorar todas")
  const porSector = useMemo(() => {
    const g = {}
    for (const e of empresasData.empresas) {
      ;(g[e.sector] = g[e.sector] || []).push(e)
    }
    return g
  }, [])

  if (!revelado) {
    return (
      <div className="card revelando">
        <div className="revel-anillo" />
        <div className="revel-texto">Leyendo tus respuestas…</div>
        <div className="revel-sub muted">perfil × sector → empresas para estudiar</div>
      </div>
    )
  }

  return (
    <div>
      <div className="card">
        <span className="perfil-tag perfil-pop">Tu perfil: {infoPerfil?.nombre}</span>
        <h1 style={{ marginTop: 8 }} className="anim-sube" >
          Empresas de <span className="oro">{nombreSector}</span> para estudiar
        </h1>
        <p className="lead anim-sube" style={{ animationDelay: '120ms' }}>{infoPerfil?.descripcion}</p>

        {/* La vacuna del error #1 del inversionista de ingresos (E4 del
            análisis educativo): dividendo ≠ ausencia de riesgo. Buenaventura
            paga dividendos Y se mueve con el oro; Quimpac rinde 26% y casi no
            se negocia. Se dice justo aquí, en el momento del resultado. */}
        {perfil === 'dividendos' && (
          <div className="aviso-perfil">
            ⚠️ Ojo con la trampa más común de este perfil: <strong>cobrar dividendos no significa
            que la acción no se mueva.</strong> Varias de las que mejor pagan son mineras que suben
            y bajan con el metal, o acciones que casi no se negocian y donde un yield altísimo suele
            ser un pago extraordinario o un precio viejo. El dividendo es un ingreso, no un seguro.
          </div>
        )}

        {mostradas.map(({ empresa, coincidencia }, i) => (
          <div
            key={empresa.ticker}
            className="card empresa-item anim-sube"
            style={{ animationDelay: `${200 + i * 110}ms` }}
            onClick={() => onVerEmpresa(empresa.ticker)}
          >
            <div>
              <div className="ticker">{empresa.ticker}</div>
              <div className="muted">{empresa.nombre}</div>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <span className={'badge ' + (coincidencia === 'alta' ? 'alta' : 'parcial')}>
                {coincidencia === 'alta'
                  ? 'Coincidencia alta'
                  : coincidencia === 'parcial'
                    ? 'Coincidencia parcial'
                    : 'Para explorar'}
              </span>
              <span className="oro">›</span>
            </div>
          </div>
        ))}

        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn btn-fantasma" onClick={() => setOffset((o) => o + 1)}>
            ↻ Intentar de nuevo
          </button>
          <button className="btn" onClick={onReiniciar}>
            Rehacer el quiz
          </button>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12 }}>
        Te mostramos varias empresas a propósito: la idea es que las{' '}
        <strong>estudies</strong> y decidas tú, no que te digamos cuál comprar.
      </p>

      {/* Explora TODAS las empresas, con un tip por sector */}
      <Reveal>
      <div className="card" style={{ marginTop: 18 }}>
        <h2 style={{ marginBottom: 4 }}>📚 Explora todas las empresas</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          No te quedes solo con tu perfil: aquí están todas, con un tip para
          leer cada sector. Toca cualquiera para estudiarla.
        </p>

        {ORDEN_SECTORES.filter((s) => porSector[s]?.length).map((s) => (
          <div key={s} className="sector-bloque">
            <div className="sector-cabecera">
              <span className="sector-nombre oro">{quiz.sectores[s]}</span>
            </div>
            {quiz.sectorTips?.[s] && (
              <div className="sector-tip">💡 {quiz.sectorTips[s]}</div>
            )}
            {porSector[s].map((e) => {
              const px = precioCorto(e.ticker)
              return (
                <div
                  key={e.ticker}
                  className="card empresa-item"
                  onClick={() => onVerEmpresa(e.ticker)}
                >
                  <div style={{ flex: 1 }}>
                    <div className="ticker">{e.ticker}</div>
                    <div className="muted">{e.nombre}</div>
                    {tipsData.tips?.[e.ticker]?.[0] && (
                      <div className="empresa-tip">💡 {tipsData.tips[e.ticker][0]}</div>
                    )}
                  </div>
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    {px && <span className="muted">{px}</span>}
                    <span className="oro">›</span>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      </Reveal>

      <Disclaimer />
    </div>
  )
}
