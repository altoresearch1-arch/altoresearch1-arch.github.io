import Glosado from './Glosado'
import { deudaInfo, umbralesDe, aniosTexto, PALABRA_DEUDA } from '../lib/lente'

// 💳 ¿Puede pagar su deuda? (mejora #41 del plan educativo)
// El número que faltaba: la deuda deja de ser un monto suelto y se convierte
// en AÑOS de caja. Y el veredicto lo pone el LENTE, no una regla universal:
// 3 años son cómodos en un hospital o una eléctrica, y una alerta en una
// minera (su caja se juzga con el metal barato, no con el de hoy).
// En bancos, seguros, AFP y fondos NO se mide así — y decirlo es la lección.

function fmtGrande(n, sim) {
  const signo = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${signo}${sim} ${(abs / 1e9).toFixed(2)} MM`
  if (abs >= 1e6) return `${signo}${sim} ${(abs / 1e6).toFixed(1)} M`
  if (abs >= 1e3) return `${signo}${sim} ${(abs / 1e3).toFixed(1)} mil`
  return `${signo}${sim} ${abs.toFixed(2)}`
}

export default function PuedePagarDeuda({ empresa }) {
  const info = deudaInfo(empresa)
  if (!info) return null
  const l = info.lente
  const u = umbralesDe(empresa)

  // ── Bancos, seguros, AFP y fondos: error de categoría, no opinión ──
  if (info.aplica === false) {
    return (
      <div className="deuda deuda-noaplica">
        <div className="deuda-tit">
          💳 ¿Puede pagar su deuda?{' '}
          <span className="deuda-estado deuda-noaplica-badge">NO SE MIDE ASÍ</span>
        </div>
        <div className="deuda-lente">
          {l.icono} Se lee como <strong>{l.nombre.toLowerCase()}</strong> · vive de {l.viveDe}
        </div>
        <p className="deuda-txt"><Glosado text={l.deudaComoSeLee} /></p>
        {l.queMirarEnSuLugar?.length > 0 && (
          <>
            <div className="deuda-sub">Lo que sí hay que mirarle:</div>
            <ul className="lista-limpia deuda-lista">
              {l.queMirarEnSuLugar.map((q, i) => (
                <li key={i}><Glosado text={q} /></li>
              ))}
            </ul>
          </>
        )}
        <div className="deuda-error">⚠ Error común: {l.errorTipico}.</div>
      </div>
    )
  }

  const p = info.estado ? PALABRA_DEUDA[info.estado] : null
  const clase = info.estado ? ' deuda-' + info.estado : ''

  return (
    <div className={'deuda' + clase}>
      <div className="deuda-tit">
        💳 ¿Puede pagar su deuda?{' '}
        {p && <span className="deuda-estado">{p.corto.toUpperCase()}</span>}
      </div>
      <div className="deuda-lente">
        {l.icono} Se lee como <strong>{l.nombre.toLowerCase()}</strong> · vive de {l.viveDe}
      </div>

      {info.sinDato || info.sinGanancia ? (
        <p className="deuda-txt">
          {info.sinGanancia ? (
            <>
              Debe <strong>{fmtGrande(info.deudaNeta, info.sim)}</strong> netos, pero {info.motivo}.
              Con la empresa en pérdida operativa, cualquier deuda pesa: lo que toca vigilar es
              cuándo vence y si tiene caja para llegar.
            </>
          ) : (
            <>No se puede calcular: {info.motivo}. No inventamos el número que la fuente no da.</>
          )}
        </p>
      ) : info.cajaNeta ? (
        <>
          <p className="deuda-txt">
            <strong>No debe neto: le sobra caja.</strong> Después de restar sus deudas financieras
            todavía le quedan <strong>{fmtGrande(info.sobra, info.sim)}</strong> en el bolsillo. Esta
            empresa no tiene un problema de deuda — sus riesgos están en otro lado (mira sus riesgos
            y su margen).
          </p>
        </>
      ) : info.manual ? (
        <>
          <div className="deuda-formula">
            Debe <strong>{info.anios.toFixed(1)} años</strong> de su ganancia anual
            <span className="muted"> · {info.manual.fuente} ({info.manual.fecha})</span>
          </div>
          <p className="deuda-txt">
            Su cifra no sale del XBRL de la SMV sino de su propio reporte, por eso va con fecha:
            un número de hace un año no sirve para juzgar el de hoy.
            {info.manual.meta && <> Y el dato a vigilar: {info.manual.meta}.</>}
          </p>
        </>
      ) : (
        <>
          <div className="deuda-formula">
            <Glosado text="deuda neta" /> ÷ ganancia operativa anual ={' '}
            {fmtGrande(info.deudaNeta, info.sim)} ÷ {fmtGrande(info.ganancia, info.sim)} ={' '}
            <strong>{info.techo ? 'como mucho ' : ''}{aniosTexto(info.anios)}</strong>
          </div>
          <p className="deuda-txt">
            Si dedicara TODA su ganancia operativa a pagar lo que debe (y no hiciera nada más),
            tardaría <strong>{info.techo ? 'como mucho ' : ''}{aniosTexto(info.anios)}</strong>.
          </p>
          {info.estado === 'incierto' && (
            <p className="deuda-txt deuda-incierto">
              <strong>Y aquí paramos, honestamente:</strong> ese número es un TECHO, no el dato
              real. Esta empresa no publicó su depreciación (ver abajo), así que la ganancia que
              usamos es menor de la que de verdad genera y los años salen de más. Si el techo
              hubiera dado cómodo, cómodo sería; como no, lo correcto es decir que{' '}
              <strong>con esta fuente no se puede afirmar</strong> si su deuda es pesada. Lo que sí
              sabemos: debe {fmtGrande(info.deudaNeta, info.sim)} netos — el paso siguiente es
              mirar cuándo vence eso (en las notas de sus estados financieros).
            </p>
          )}
        </>
      )}

      {/* La prueba del fondo del ciclo: la resta que vale más que tres
          párrafos de advertencia (el aviso cíclico con número). */}
      {info.aniosEstres != null && (
        <div className="deuda-estres">
          🌀 <strong>La prueba del ciclo:</strong> este cálculo usa la ganancia de HOY, con{' '}
          {l.motor} en su nivel actual. Si esa ganancia se redujera a la mitad — algo que en este
          tipo de negocio ya pasó otras veces — la misma deuda pasaría a{' '}
          <strong>{info.aniosEstres.toFixed(1)} años</strong>
          {info.estadoEstres !== info.estado
            ? <> y el veredicto cambiaría a «{PALABRA_DEUDA[info.estadoEstres].corto.toLowerCase()}».</>
            : <>, así que el veredicto aguantaría igual.</>}
        </div>
      )}

      {u && info.anios != null && (
        <div className="deuda-barra">
          <span className="deuda-rango-txt">
            Para {l.nombre.toLowerCase()}: cómodo por debajo de <strong>{u.verde} años</strong> ·
            a vigilar hasta <strong>{u.ambar}</strong> · por encima necesitas una razón muy buena
            y documentada.
          </span>
        </div>
      )}

      <p className="deuda-txt deuda-comose">
        <strong>Cómo se lee aquí:</strong> <Glosado text={l.deudaComoSeLee} />
      </p>

      {info.sinDya && !info.sinDato && (
        <div className="deuda-aviso">
          ⚠️ Esta empresa presentó su flujo de caja resumido y no publicó su depreciación, así que
          la ganancia usada va sin ella: el resultado sale MÁS exigente (más años) que el real.
          Preferimos pasarnos de cautos antes que inventar el dato.
        </div>
      )}

      {info.anios != null && !info.manual && (
        <div className="deuda-metodo muted">
          Método: se usa el ÚLTIMO trimestre presentado a la SMV multiplicado por 4. Si ese
          trimestre fue atípico (una veda, una parada de planta, un año de obra flojo), el
          resultado también lo será — míralo junto a la serie de sus resultados, no solo.
        </div>
      )}

      <div className="deuda-error">⚠ Error común: {l.errorTipico}.</div>
      {l.caso && <div className="deuda-caso">📚 {l.caso}</div>}
    </div>
  )
}
