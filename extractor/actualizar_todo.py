# -*- coding: utf-8 -*-
"""
ORQUESTADOR — un solo comando para actualizar TODO en el orden correcto.

Uso:
  python extractor/actualizar_todo.py            # DIARIO completo (incluye EPS anual del SMV)
  python extractor/actualizar_todo.py --rapido       # DIARIO del robot: salta el SMV (EPS anual estático)
  python extractor/actualizar_todo.py --hechos       # SOLO hechos de importancia + BEM (robot cada 30 min)
  python extractor/actualizar_todo.py --precios      # precios + intradía + barrido de prensa (robot cada 30 min en rueda)
  python extractor/actualizar_todo.py --precios --sin-prensa   # solo precios + intradía (las corridas de 10 min intermedias)
  python extractor/actualizar_todo.py --trimestral   # cambio de trimestre (Q2, Q3…)
  python extractor/actualizar_todo.py --con-build    # además corre npm run build (PWA)

  El robot nocturno de GitHub Actions usa --rapido: el EPS anual (SMV) NO cambia día a día y el
  SMV es lento/flaky desde la nube, así que ese paso se corre solo en el modo completo o --trimestral.

DIARIO (en orden, SECUENCIAL — no paralelizar: la SMV se atora con sesiones
simultáneas y fetch_anual_eps ya falló una vez así):
  1. fetch_precios       -> precios.json        (cierres BVL)
  2. fetch_historicos    -> historicos.json     (sparkline + termómetro)
  3. fetch_hechos        -> hechos.json         (HI por empresa 📰)
  4. div_stockanalysis   -> dividendos.json     (dividendos base)
  5. fetch_beneficios    -> dividendos.json     (parcha FIBRAs/chicas + CORRIGE moneda)
  6. fetch_bem           -> mineria.json        (producción minera mensual MINEM; solo baja ediciones nuevas)
  6c. fetch_cotizaciones -> cotizaciones.json   (precio del metal/petróleo/harina/azúcar; BCRP, series mensuales)
  6b. fetch_produccion   -> produccion.json     (producción/ventas del trimestre del HI de la empresa; parsea el PDF, caché por URL)
  6d. fetch_pagos_dividendos -> pagos_dividendos.json (fecha y monto de cada pago, del acuerdo oficial; el que paga EN PARTES ya no descuadra)
  7. fetch_anual_eps     -> eps_anual.json      (ganancia anual + TC, para el P/E)
  8. fix_eps             -> eps_anual.json      (parcha EPS distorsionados; SIEMPRE tras el 7)
  8b. fetch_bpa_historico -> bpa_historico.json (gráfica BPA anual + trimestral; tras fix_eps
                            y con empresas.json ya fresco, de donde siembra el trimestre vivo)
  8c. fetch_noticias     -> noticias.json       (prensa 📰 por DOS redes: consultas dirigidas a
                            Google News + barrido de las portadas RSS de la prensa peruana.
                            Titulares por empresa + TEMAS de sector/macro, que es lo que ningún
                            HI cubre, + la capa 🌍 MUNDO (Fed, recesión en EE. UU., Medio
                            Oriente, China, aranceles) con el CANAL por el que cada una podría
                            llegarle a cada empresa — 10 de las 32 negociables son minas y no
                            le ponen precio a lo que venden. Tras fetch_historicos: de ahí saca
                            qué acciones se negocian de verdad. El archivo se FUSIONA)
  9. auditoria           -> reporte             (falla si hay problemas estructurales)

TRIMESTRAL (cuando salga el Q2 2026, ~ago-set):
  0. Editar extractor/empresas_config.json: "trimestre": 2  (y "anio" si cambia)
  1. run_batch           -> empresas.json       (fundamentos SMV del nuevo trimestre;
                            los que fallen por timeout se reintentan con run_uno.py TICKER)
  2..8 igual que el diario.

Cada paso imprime OK/FALLÓ y el orquestador sigue (excepto auditoría con problemas).
"""
import os, subprocess, sys, time

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, ".."))

# Datos que cambian A DIARIO: solo BVL/stockanalysis (rápidos y confiables, ~3-4 min).
PASOS_RAPIDOS = [
    "fetch_precios.py",
    "fetch_historicos.py",
    # 🔗 Que ninguna del config se quede fuera de la app. Va justo después de
    # históricos: si se agregó una empresa (o 36 ETF), acá entra a empresas.json
    # sin esperar al trimestral. Idempotente: si no falta nadie, no escribe.
    "sincronizar_universo.py",
    "fetch_hechos.py",
    "gen_lecturas.py",    # 🛰️ lee los PDF de los 2 últimos hechos de c/u (caché: solo los nuevos)
    "div_stockanalysis.py",
    "fetch_beneficios.py",
    "fetch_bem.py",       # producción minera MINEM (mensual; con caché, solo baja lo nuevo)
    "fetch_cotizaciones.py",  # 🥇 precio del metal/petróleo/harina/azúcar (BCRP, mensual y rápido)
    "fetch_produccion.py", # 📣 producción/ventas del trimestre del HI de la empresa (parsea el PDF; caché por URL)
    # 💰 CUÁNDO y CUÁNTO paga cada dividendo, del acuerdo oficial. Va DESPUÉS de
    # fetch_hechos (de ahí saca los PDF). Sin esto, una empresa que paga en partes
    # —Nexa: mitad en junio, mitad en octubre— contaba como recibido el total y el
    # pago pendiente no aparecía en el flujo del cuaderno.
    "fetch_pagos_dividendos.py",
    # 📰 Prensa por dos redes (Google News dirigido + barrido de portadas RSS).
    # Va AL FINAL y DESPUÉS de fetch_historicos: solo consulta las acciones que
    # de verdad se negocian, y eso lo lee de historicos.json (`pocoNegociada`).
    # Es el paso más lento de la lista (~3 min: ~95 consultas), y lo vale — es
    # el único que trae el porqué de sector. Si una fuente no responde, se
    # salta y el resto sigue: nunca tumba al robot.
    "fetch_noticias.py",
    # 📋 Resúmenes del día / semana / mes con la favorita. VA AL FINAL: necesita
    # precios, históricos, hechos e intradía ya frescos, y las dos redes de
    # prensa ya fusionadas.
    "gen_resumenes.py",
]

# EPS anual (SMV, ~ESTÁTICO: el 2025 ya cerró) + su corrección. El SMV es LENTO y flaky
# desde la nube (consulta el XBRL de cada empresa, ~15 min). No hace falta a diario → se
# corre en el modo completo (local / --trimestral), NO en el robot nocturno (--rapido).
PASOS_EPS = [
    "fetch_anual_eps.py",
    "fix_eps.py",
    # 📈 BPA histórico: la gráfica trimestral de la ficha. NO estaba en ninguna lista
    # (detectado 30-jul-2026): por eso el Q2 de las mineras no apareció solo y hubo
    # que correrlo a mano. Va DESPUÉS de fix_eps —usa sus TICKERS distorsionados— y
    # necesita el empresas.json ya actualizado: de ahí siembra el trimestre en curso.
    "fetch_bpa_historico.py",
    "fetch_gerencia.py",  # 🗣 charla de la gerencia (SMV, trimestral; caché por expediente)
    "fetch_notas.py",     # 📝 notas a los EEFF: actual todas + 2025 minas (SMV, caché)
    "fetch_docs_urls.py", # 📚 links directos a los originales (SMV, caché 2025)
]

PASOS_DIARIO = PASOS_RAPIDOS + PASOS_EPS

# Modos INTRADÍA del robot (livianos, corren varias veces al día en horario de
# mercado; el BEM es MENSUAL pero fetch_bem tiene caché y no commitea ruido):
PASOS_HECHOS = ["fetch_hechos.py", "gen_lecturas.py", "fetch_bem.py", "fetch_produccion.py",
                "fetch_pagos_dividendos.py"]
# La prensa acompaña a los PRECIOS, no a los HECHOS: los titulares LLEGAN
# DESPUÉS del Hecho de Importancia (comprobado 31-jul-2026), así que refrescar
# noticias cada 30 min sería ~1,800 consultas diarias a Google News para llegar
# igual de tarde. Por eso la dirigida corre SOLO en el cierre.
#
# Y en el intradía va SOLO el barrido de portadas (--feeds): son 8 lecturas
# (~15 s) contra las ~95 consultas (~3 min) de la red dirigida, y es la red
# que de verdad sirve a mediodía — Gestión y Rumbo Minero publican en el
# momento, mientras que Google News tarda en indexar. La red dirigida completa
# corre de noche, cuando el tiempo no cuesta. Como el archivo se fusiona y no
# se reemplaza, el barrido de mediodía SUMA a lo de anoche en vez de pisarlo.
# CADA 10 MINUTOS en horario de rueda. Tres cosas y ni una más:
#   · fetch_precios  — UNA llamada al mercado entero. Trae precio, rango del
#     día, volumen y hora de la última operación, y acumula en intradia.json.
#   · fetch_noticias --feeds — los 13 feeds RSS (8 de Perú + 5 del mundo). La
#     red dirigida de Google News NO: serían ~4,560 consultas diarias.
#
# fetch_historicos SE FUE DE ACÁ (02-ago-2026) y es a propósito: son 115
# llamadas a la BVL por corrida, o sea ~5,520 al día contra un API que no es
# nuestro, para refrescar una serie de CIERRES que intradía no cambia. El dato
# vivo ya viene en precios.json (`previous` + `last`, en una sola llamada) y en
# intradia.json. El histórico se rehace en el cierre, que es cuando nace la
# fila del día.
PASOS_PRECIOS = ["fetch_precios.py", ("fetch_noticias.py", ["--feeds"]),
                 # 📋 El resumen se re-sella en cada corrida: así el de las 4
                 # de la tarde ya está escrito cuando cierra la rueda, sin que
                 # nadie tenga que acordarse de correr nada.
                 "gen_resumenes.py"]


def correr(script, args=None):
    inicio = time.time()
    cmd = [sys.executable, os.path.join(AQUI, script)] + (args or [])
    print(f"\n{'='*60}\n>> {script}\n{'='*60}", flush=True)
    # UTF-8 A LA FUERZA, y en un solo sitio para los 20 scripts. La consola de
    # Windows usa cp1252: cualquier print con emoji revienta con
    # UnicodeEncodeError y tumba el paso entero. En GitHub Actions (Linux) no
    # pasa, así que el fallo solo aparece corriendo el robot a mano acá — que
    # es justo cuando uno está depurando y menos ganas tiene de pelear con eso.
    entorno = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    r = subprocess.run(cmd, cwd=RAIZ, env=entorno)
    dur = time.time() - inicio
    estado = "OK" if r.returncode == 0 else f"FALLÓ (código {r.returncode})"
    print(f"<< {script}: {estado} en {dur:.0f}s", flush=True)
    return r.returncode == 0


def main():
    trimestral = "--trimestral" in sys.argv
    con_build = "--con-build" in sys.argv
    rapido = "--rapido" in sys.argv
    solo_hechos = "--hechos" in sys.argv
    solo_precios = "--precios" in sys.argv
    # El barrido de prensa NO va en cada corrida de 10 minutos: Gestión y Rumbo
    # Minero no publican a esa velocidad, y el propio repo midió que la prensa
    # llega DESPUÉS del Hecho de Importancia. Con leer las portadas cada 30 min
    # se agarra lo mismo con un tercio de las lecturas. Las corridas de :03 y
    # :33 la traen; las de :13, :23, :43 y :53 corren con --sin-prensa.
    sin_prensa = "--sin-prensa" in sys.argv
    fallos = []

    if trimestral:
        print("MODO TRIMESTRAL: fundamentos SMV completos (run_batch).")
        print("(¿Ya cambiaste 'trimestre' en empresas_config.json? Ctrl+C si no.)")
        time.sleep(5)
        if not correr("run_batch.py"):
            fallos.append("run_batch.py — reintentar los caídos con: python extractor/run_uno.py TICKER")

    # Modos intradía (robot cada 30 min / mediodía): solo lo pedido, en 1-2 min.
    if solo_hechos and not trimestral:
        print("MODO HECHOS: solo hechos de importancia + BEM (intradía).")
        pasos = PASOS_HECHOS
    elif solo_precios and not trimestral:
        print("MODO PRECIOS: solo precios + históricos (intradía).")
        pasos = [x for x in PASOS_PRECIOS
                 if not (sin_prensa and isinstance(x, tuple) and x[0] == "fetch_noticias.py")]
    elif rapido and not trimestral:
        # --rapido (robot nocturno): salta el EPS anual del SMV (estático + lento desde la nube).
        print("MODO RÁPIDO: se omiten fetch_anual_eps + fix_eps (SMV). El EPS anual queda como está.")
        pasos = PASOS_RAPIDOS
    else:
        pasos = PASOS_DIARIO
    # Un paso puede ser "script.py" o ("script.py", [args]) — el intradía usa
    # lo segundo para correr la prensa en su modo liviano.
    for p in pasos:
        script, extra = p if isinstance(p, tuple) else (p, None)
        if not correr(script, extra):
            fallos.append(script + (" " + " ".join(extra) if extra else ""))

    # 🌎 Noticias de empresas EXTRANJERAS (Rio2 etc.): salen en su web, no en la BVL.
    # Diario basta (no en el intradía de 30 min, para no golpear los sitios externos).
    # Headless y con caché por empresa: si un sitio se cae, conserva lo anterior.
    if not (solo_hechos or solo_precios):
        if not correr("fetch_extranjero.py", ["--solo-noticias"]):
            fallos.append("fetch_extranjero.py --solo-noticias")

    # novedades.json (app/public/): resumen liviano que la APP consulta en vivo
    # para avisar al usuario si una empresa de su lista ★ tiene algo nuevo.
    if not correr("gen_novedades.py"):
        fallos.append("gen_novedades.py")

    audit_ok = correr("auditoria.py")

    if con_build:
        print(f"\n{'='*60}\n>> npm run build (PWA)\n{'='*60}", flush=True)
        r = subprocess.run("npm run build", cwd=os.path.join(RAIZ, "app"), shell=True)
        if r.returncode != 0:
            fallos.append("npm run build")

    print(f"\n{'#'*60}")
    if fallos:
        print(f"TERMINADO CON FALLOS: {', '.join(fallos)}")
    else:
        print("TODO OK." + ("" if audit_ok else " (auditoría con avisos/problemas: leer arriba)"))
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
