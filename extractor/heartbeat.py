# -*- coding: utf-8 -*-
"""
💓 EL PULSO DE CADA ROBOT — para saber si está vivo sin ir a mirar Actions.

EL PROBLEMA QUE RESUELVE, y pasó de verdad:
Entre el 1 y el 3 de agosto de 2026 el cron de GitHub no disparó ni una sola
corrida programada — unos 25 turnos vencidos. El workflow estaba `active` y los
scripts sanos: simplemente no arrancó. Y no había NINGUNA forma de notarlo
desde la app; se descubrió consultando a mano la API de GitHub Actions.

Con esto cada robot deja escrito cuándo corrió, si le fue bien y qué trajo.

UN ARCHIVO POR ROBOT, Y NO UNO SOLO. Los modos corren en runs SEPARADOS de
GitHub Actions y se solapan (hechos y precios, ambos cada 10 min, a minutos
distintos pero con duraciones que se pisan). Con un archivo único, dos runners
haciendo pull/push casi a la vez chocan en el mismo JSON. Con uno por robot,
cada runner es dueño exclusivo del suyo y el rebase nunca tiene que decidir
nada.

DÓNDE VIVEN: app/src/data/estados/. No es capricho — el workflow commitea con
`git add app/src/data`, así que cualquier cosa fuera de ahí no viajaría al repo
y el pulso no le llegaría a nadie.

LAS TRES FECHAS, que parecen redundantes y no lo son:
  · ultimo_run_utc        — el cron disparó. Si esto se congela, GitHub no está
                            arrancando (el fallo del 1-3 ago).
  · ultimo_ok_utc         — la última vez que terminó bien. Si `run` avanza y
                            `ok` se queda quieto, el robot corre y falla, que es
                            un problema MUY distinto de no correr.
  · ultima_con_cambios_utc — la última vez que de verdad trajo algo nuevo. "Corrí
                            hace 2 minutos" y "actualicé hace 3 días" no son lo
                            mismo, y ninguna de las otras dos lo dice.

SIN EMOJIS EN LOS PRINT (misma razón que en guardas.py): la consola de Windows
usa cp1252 y revienta con UnicodeEncodeError.
"""
import json
import os
from datetime import datetime, timezone

AQUI = os.path.dirname(os.path.abspath(__file__))
DIR_ESTADOS = os.path.normpath(
    os.path.join(AQUI, "..", "app", "src", "data", "estados"))

# Pocos estados a propósito: esto se lee de un vistazo.
OK = "ok"            # corrió y escribió
GUARDA = "guarda"    # la fuente vino vacía y NO se escribió. NO es un error:
                     # es el cortafuegos de guardas.py haciendo su trabajo.
ERROR = "error"      # se cayó


def _ahora():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _leer(ruta):
    if not os.path.exists(ruta):
        return {}
    try:
        with open(ruta, encoding="utf-8") as f:
            doc = json.load(f)
        return doc if isinstance(doc, dict) else {}
    except (ValueError, OSError):
        return {}


def latir(robot, estado=OK, error=None, cambios=None, registros=None,
          duracion_ms=None):
    """
    Deja el pulso de `robot` en app/src/data/estados/<robot>.json.

    `fallos_consecutivos` se resetea con un OK y sube con cualquier otra cosa:
    uno es mala suerte, tres seguidos es que la fuente se cayó.

    NUNCA lanza. Un fallo escribiendo el pulso no puede tumbar al robot que
    estaba haciendo el trabajo de verdad.
    """
    try:
        ruta = os.path.join(DIR_ESTADOS, f"{robot}.json")
        previo = _leer(ruta)
        ahora = _ahora()

        if estado == OK:
            fallos = 0
            ultimo_ok = ahora
        else:
            fallos = int(previo.get("fallos_consecutivos") or 0) + 1
            ultimo_ok = previo.get("ultimo_ok_utc")

        con_cambios = (ahora if cambios
                       else previo.get("ultima_con_cambios_utc"))

        doc = {
            "_comment": ("Pulso de un robot del extractor. `ultimo_run_utc` dice cuándo "
                         "disparó el cron; `ultimo_ok_utc`, cuándo terminó bien; "
                         "`ultima_con_cambios_utc`, cuándo trajo algo nuevo de verdad. "
                         "Lo escribe extractor/heartbeat.py."),
            "robot": robot,
            "estado": estado,
            "ultimo_run_utc": ahora,
            "ultimo_ok_utc": ultimo_ok,
            "ultima_con_cambios_utc": con_cambios,
            "fallos_consecutivos": fallos,
            # Corto a propósito: esto es un semáforo, no un log. El stacktrace
            # completo vive en GitHub Actions.
            "ultimo_error": str(error)[:200] if error else None,
            "registros": registros,
            "duracion_ms": duracion_ms,
            # Qué commit produjo este estado. En Actions viene servido; en local
            # queda en null y no pasa nada.
            "commit": (os.environ.get("GITHUB_SHA") or "")[:7] or None,
        }

        os.makedirs(DIR_ESTADOS, exist_ok=True)
        with open(ruta, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=1)
        print(f"[PULSO] {robot}: {estado}"
              + (f" · {registros} registros" if registros is not None else "")
              + (f" · {fallos} fallos seguidos" if fallos else ""))
    except Exception as e:  # noqa: BLE001 - el pulso jamás tumba al robot
        print(f"[PULSO] no se pudo registrar el pulso de {robot}: {e}")
