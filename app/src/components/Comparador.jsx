import { useState } from 'react'
import empresasData from '../data/empresas.json'
import quiz from '../data/quiz.json'
import Glosado from './Glosado'
import Sparkline from './Sparkline'
import Disclaimer from './Disclaimer'
import { peNumerico, precioDe, dividendosDe, historicoDe } from '../lib/finanzas'
import { Reveal } from '../lib/anim'

// Comparador: 2 empresas lado a lado, solo HECHOS de nuestras fuentes
// (SMV, BVL, stockanalysis). Sin veredicto: cuál "gana" lo decides tú
// estudiándolas — la app educa, no recomienda.

function fechaCorta(iso) {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

const PENDIENTE = <span className="comp-pend">Pendiente (SMV)</span>

function datosDe(ticker) {
  const e = empresasData.empresas.find((x) => x.ticker === ticker)
  if (!e) return null
  const px = precioDe(ticker)
  const dv = dividendosDe(ticker)
  const h = historicoDe(ticker)
  const pe = peNumerico(ticker)
  const f = e.fundamentos
  return {
    e,
    sector: quiz.sectores[e.sector] || e.sector,
    precio: px?.precio != null ? `${px.moneda} ${px.precio}` : null,
    precioFecha: px?.fecha ? fechaCorta(px.fecha) : null,
    desactualizado: !!px?.sinNegociacionReciente,
    pe: pe != null ? pe.toFixed(1) : null,
    divAnual: dv?.anual || null,
    yield: dv?.yield || null,
    frecuencia: dv?.frecuencia || null,
    deuda: f?.deuda?.valor || null,
    fcf: f?.fcf?.valor || null,
    margen: f?.margen?.valor || null,
    epsQ: f?.eps?.valor || null,
    vol: h?.volatilidadEtiqueta || null,
    volPct: h?.volatilidadAnualPct ?? null,
    rango52: h?.min52 != null
      ? `${(h.moneda || '').trim() || px?.moneda || ''} ${h.min52} – ${h.max52}`.trim()
      : null,
  }
}

function Fila({ nombre, a, b, glosar = true }) {
  const render = (v) =>
    v == null || v === '' ? PENDIENTE : glosar ? <Glosado text={String(v)} /> : v
  return (
    <div className="comp-fila">
      <div className="comp-k"><Glosado text={nombre} /></div>
      <div className="comp-v">{render(a)}</div>
      <div className="comp-v">{render(b)}</div>
    </div>
  )
}

export default function Comparador({ tickers, onVolver, onVerEmpresa }) {
  const lista = empresasData.empresas.map((x) => x.ticker)
  const [tA, setTA] = useState(tickers?.[0] || lista[0])
  const [tB, setTB] = useState(tickers?.[1] || lista[1])
  const A = datosDe(tA)
  const B = datosDe(tB)
  if (!A || !B) return null

  const Selector = ({ valor, setValor, otro }) => (
    <select className="comp-select" value={valor} onChange={(ev) => setValor(ev.target.value)}>
      {lista.filter((t) => t !== otro).map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  )

  return (
    <div>
      <button className="btn btn-fantasma" onClick={onVolver} style={{ marginBottom: 14 }}>
        ← Volver al explorador
      </button>

      <div className="card">
        <h1 style={{ marginBottom: 4 }}>⚖ Frente a frente</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Mismos datos, lado a lado. Cuál encaja contigo lo decides tú — depende
          de tu perfil, no de un ranking.
        </p>

        <div className="comp-cabecera">
          <div className="comp-k" />
          <div className="comp-empresa">
            <Selector valor={tA} setValor={setTA} otro={tB} />
            <div className="muted comp-nombre">{A.e.nombre}</div>
            <button className="btn-mini" onClick={() => onVerEmpresa(tA)}>ver ficha ›</button>
          </div>
          <div className="comp-empresa">
            <Selector valor={tB} setValor={setTB} otro={tA} />
            <div className="muted comp-nombre">{B.e.nombre}</div>
            <button className="btn-mini" onClick={() => onVerEmpresa(tB)}>ver ficha ›</button>
          </div>
        </div>

        <div className="comp-graficos">
          <div><Sparkline ticker={tA} compacto /></div>
          <div><Sparkline ticker={tB} compacto /></div>
        </div>

        <Reveal>
          <div className="comp-tabla">
            <Fila nombre="Sector" a={A.sector} b={B.sector} glosar={false} />
            <Fila
              nombre="Precio de cierre"
              a={A.precio && `${A.precio}${A.desactualizado ? ' ⚠' : ''} (${A.precioFecha})`}
              b={B.precio && `${B.precio}${B.desactualizado ? ' ⚠' : ''} (${B.precioFecha})`}
              glosar={false}
            />
            <Fila nombre="P/E" a={A.pe} b={B.pe} glosar={false} />
            <Fila nombre="Dividendo anual" a={A.divAnual} b={B.divAnual} glosar={false} />
            <Fila nombre="Yield" a={A.yield} b={B.yield} glosar={false} />
            <Fila nombre="Deuda" a={A.deuda} b={B.deuda} glosar={false} />
            <Fila nombre="FCF (Flujo de Caja Libre)" a={A.fcf} b={B.fcf} glosar={false} />
            <Fila nombre="Margen" a={A.margen} b={B.margen} glosar={false} />
            <Fila nombre="EPS del trimestre" a={A.epsQ} b={B.epsQ} glosar={false} />
            <Fila
              nombre="¿Cuánto se mueve?"
              a={A.vol && `${A.vol}${A.volPct != null ? ` (${A.volPct}%)` : ''}`}
              b={B.vol && `${B.vol}${B.volPct != null ? ` (${B.volPct}%)` : ''}`}
              glosar={false}
            />
            <Fila nombre="Rango 52 semanas" a={A.rango52} b={B.rango52} glosar={false} />
          </div>
        </Reveal>

        <p className="muted" style={{ marginTop: 14, fontSize: 12.5 }}>
          ⚠ = precio desactualizado (no negocia seguido). "Pendiente (SMV)" = el
          dato no está en nuestras fuentes; nunca lo inventamos. El P/E se
          calcula con la ganancia anual 2025 — en empresas cíclicas puede engañar.
          Cuidado con comparar deudas de sectores distintos: cada sector se lee diferente.
        </p>
      </div>

      <Disclaimer />
    </div>
  )
}
