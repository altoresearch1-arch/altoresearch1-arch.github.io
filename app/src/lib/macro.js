import cotizacionesData from '../data/cotizaciones.json'
import { claveLente } from './lente'

// ─────────────────────────────────────────────────────────────────────────
// 🏛️ EL MOTOR DE LOS QUE NO VENDEN MATERIA PRIMA (23-jul-2026)
// «El precio del metal» (#116) explicaba el motor de ~25 empresas. Las otras
// 90 también tienen uno, y el BCRP lo publica en la MISMA API: la tasa de
// referencia, el tipo de cambio y la inflación. No es un dato de adorno —
// es literalmente de qué depende que ganen o pierdan:
//   · un banco vive del margen entre lo que cobra y lo que paga: el precio
//     del dinero ES su materia prima;
//   · una inmobiliaria vende departamentos que casi nadie paga al contado:
//     su cliente real es la cuota mensual, y la cuota la fija la tasa;
//   · un retail cobra en soles a gente cuyo sueldo sube más lento que los
//     precios: la inflación le sube el ticket Y le baja el cliente;
//   · una refinería que debe en dólares y vende en soles gana o pierde
//     plata sin mover un barril, solo porque cambió el tipo de cambio
//     (el caso Petroperú, #49 del plan educativo).
//
// Cada lente que aparece aquí tiene su texto ESCRITO A MANO: la cadena de
// causa-efecto es distinta en cada uno y una frase genérica no enseña nada.
// Un lente que no está en este mapa no muestra el bloque (Regla de Oro #1:
// mejor nada que un texto de relleno).
// ─────────────────────────────────────────────────────────────────────────

const POR_LENTE = {
  bancos: {
    serie: 'tasa',
    titular: 'el precio del dinero',
    porQue: 'Un banco compra dinero barato (los depósitos de la gente) y lo vende caro '
      + '(los préstamos). Esta tasa es el piso de las dos puntas: cuando el BCRP la sube, '
      + 'lo primero que sube es lo que el banco COBRA por prestar, y lo que PAGA por los '
      + 'depósitos sube después y menos. Por eso a los bancos les suele ir bien mientras '
      + 'la tasa está alta — y por eso también hay que mirar la mora: con tasas altas, '
      + 'más clientes dejan de pagar.',
    mirar: 'el margen financiero y la mora',
  },
  inmobiliaria: {
    serie: 'tasa',
    titular: 'la cuota del comprador',
    porQue: 'Casi nadie compra un departamento al contado: compra una CUOTA mensual a 20 años. '
      + 'Esta tasa es la que decide cuánto es esa cuota, así que cuando sube, el mismo '
      + 'departamento se vuelve inalcanzable para miles de familias sin que la empresa haya '
      + 'cambiado nada. Es el motor real de sus ventas — más que el precio del metro cuadrado.',
    mirar: 'las unidades vendidas, no solo los ingresos',
  },
  cemento: {
    serie: 'tasa',
    titular: 'la obra que se financia',
    porQue: 'El cemento se despacha cuando alguien construye, y casi toda construcción se hace '
      + 'con crédito: el autoconstructor con su préstamo, la inmobiliaria con su financiamiento, '
      + 'el Estado con su presupuesto. Cuando el dinero está caro, las obras se posponen y los '
      + 'despachos caen — con las mismas plantas y la misma gente. Ojo: esta cadena tarda meses '
      + 'en llegar, no es del mes a mes.',
    mirar: 'los despachos en toneladas',
  },
  seguros: {
    serie: 'tasa',
    titular: 'lo que rinde la plata que guarda',
    porQue: 'Una aseguradora cobra las primas hoy y paga los siniestros después: mientras tanto '
      + 'invierte esa plata, y buena parte va a bonos. Con tasas altas, esa cartera rinde más y '
      + 'el negocio financiero de la aseguradora mejora — aunque el negocio de asegurar siga '
      + 'igual. Son dos motores en la misma empresa y conviene no confundirlos.',
    mirar: 'el resultado de inversiones aparte del técnico',
  },
  retail: {
    serie: 'inflacion',
    titular: 'el bolsillo de su cliente',
    porQue: 'La inflación al retail le hace dos cosas a la vez, y opuestas: le sube el ticket '
      + '(vende lo mismo por más soles, así que los ingresos crecen sin vender más unidades) y '
      + 'le encoge al cliente (el sueldo casi nunca sube al ritmo de los precios, así que compra '
      + 'menos cosas o se pasa a la marca barata). Por eso unos ingresos que crecen 5% con una '
      + 'inflación de 4% no son crecimiento: son casi lo mismo de siempre.',
    mirar: 'las ventas «same-store» y el margen, no los ingresos totales',
  },
  alimentos: {
    serie: 'inflacion',
    titular: 'el precio de la canasta',
    porQue: 'El consumo masivo vive de que la gente compre todos los días, y su producto está '
      + 'JUSTO en la canasta que mide la inflación. Cuando los precios suben, la empresa traslada '
      + 'parte al público (por eso factura más) pero también paga más caros sus insumos y su '
      + 'planilla. Lo que hay que mirar no es cuánto facturó: es si el margen aguantó.',
    mirar: 'el margen bruto, no la facturación',
  },
  hidrocarburos: {
    serie: 'tc',
    titular: 'la moneda en la que debe',
    porQue: 'Aquí está el caso más didáctico de la BVL: una refinería compra crudo y se endeuda '
      + 'en DÓLARES, pero vende combustible en SOLES en el mercado peruano. Cuando el dólar sube, '
      + 'su deuda en soles crece de un día para otro sin que haya pedido un préstamo nuevo, y la '
      + 'pérdida aparece en el estado de resultados como «diferencia de cambio». Es plata perdida '
      + 'sin haber movido un solo barril.',
    mirar: 'la línea de diferencia de cambio en su resultado',
  },
}

// Qué significa que el número SUBA, para el lente que lo está mirando. Se dice
// siempre: un macro sin dirección es un número suelto.
const DIRECCION = {
  tasa: { sube: 'dinero más caro', baja: 'dinero más barato' },
  tc: { sube: 'el dólar más caro (el sol se debilita)', baja: 'el dólar más barato (el sol se fortalece)' },
  inflacion: { sube: 'los precios corriendo más rápido', baja: 'los precios corriendo más lento' },
}

export function macroDe(empresa) {
  if (!empresa) return null
  const lente = claveLente(empresa)
  const cfg = POR_LENTE[lente]
  if (!cfg) return null
  const serie = cotizacionesData.macro?.[cfg.serie]
  if (!serie) return null
  return { clave: cfg.serie, ...cfg, ...serie, direccion: DIRECCION[cfg.serie] }
}
