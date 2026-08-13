# -*- coding: utf-8 -*-
"""
Pruebas del cortafuegos de escritura. Se corren solas, sin pytest:

    python extractor/test_guardas.py

POR QUE ESTAN EN PYTHON Y NO CON EL RESTO. Las demas pruebas del proyecto
corren con vitest (app/src/lib/radar.test.js), pero la guarda es del extractor
y vitest no puede tocarla. Son dos runners y no hay forma de que sea uno solo:
escribir este test en JavaScript seria probar una reimplementacion, no la
guarda que de verdad corre cada 10 minutos.

Que se prueba: solo lo que al romperse deja la guarda DECORATIVA -- sigue
existiendo, sigue devolviendo True, y ya no protege de nada.
"""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from guardas import cambio_real, se_puede_escribir  # noqa: E402


def _archivo(datos, clave="precios", extra=None):
    """Deja un JSON temporal con la forma real de precios.json."""
    doc = {clave: datos}
    if extra:
        doc.update(extra)
    fd, ruta = tempfile.mkstemp(suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(doc, f)
    return ruta


def _precios(n_utiles, n_total):
    """n_total entradas, de las cuales solo n_utiles tienen encontrado=True."""
    d = {}
    for i in range(n_total):
        util = i < n_utiles
        d[f"TK{i}"] = {"precio": 1.5 if util else None, "encontrado": util}
    return d


fallos = []


def check(cond, nombre):
    print(("  OK   " if cond else "  FALLA") + "  " + nombre)
    if not cond:
        fallos.append(nombre)


print("\n[TEST] La guarda cuenta registros con encontrado=True, JAMAS len()")
# El archivo en disco tiene 152 entradas pero solo 100 utiles: es exactamente
# la forma que tiene precios.json cuando la BVL devolvio content: [] y se
# escribio precio:null sobre todas. Con len() el piso seria 121 y una corrida
# sana de 90 abortaria; contando encontrado, el piso es 80 y pasa.
ruta = _archivo(_precios(100, 152))
check(se_puede_escribir(ruta, "precios", 90, "prueba") is True,
      "90 registros contra 100 utiles (piso 80): se escribe")
check(se_puede_escribir(ruta, "precios", 79, "prueba") is False,
      "79 registros contra 100 utiles: aborta")
os.unlink(ruta)

print("\n[TEST] Cero registros utiles aborta siempre")
ruta = _archivo(_precios(100, 152))
check(se_puede_escribir(ruta, "precios", 0, "prueba") is False,
      "la fuente no trajo nada: no se toca el archivo")
os.unlink(ruta)

print("\n[TEST] Un archivo YA corrupto no bloquea la recuperacion")
# Las 152 entradas en null: lo que habia ya no servia, cualquier cosa es mejor.
ruta = _archivo(_precios(0, 152))
check(se_puede_escribir(ruta, "precios", 5, "prueba") is True,
      "archivo con todo en null: se deja escribir")
os.unlink(ruta)

print("\n[TEST] Sin archivo previo se deja pasar (primera corrida)")
check(se_puede_escribir("no_existe_este_archivo.json", "precios", 3, "prueba") is True,
      "primera corrida: no hay con que comparar")

print("\n[TEST] cambio_real ignora el sello de hora")
# El bug real: intradia.json estampa `generado` con la hora al minuto, asi que
# el archivo SIEMPRE difiere y se commiteaban 48 veces al dia sin novedad.
datos = {"2026-08-04": {"BVN": 31.7}}
ruta = _archivo(datos, clave="dias", extra={"generado": "2026-08-04 10:00"})
check(cambio_real(ruta, "dias", datos) is False,
      "mismos datos, otra hora: NO es un cambio")
check(cambio_real(ruta, "dias", {"2026-08-04": {"BVN": 31.9}}) is True,
      "precio distinto: si es un cambio")
os.unlink(ruta)

print("\n[TEST] Los print de guardas.py y heartbeat.py sobreviven a cp1252")
# INVARIANTES #6: la consola de Windows usa cp1252 y un emoji la revienta con
# UnicodeEncodeError -- la guarda fallaria justo cuando tiene que proteger.
aqui = os.path.dirname(os.path.abspath(__file__))
for archivo in ("guardas.py", "heartbeat.py"):
    ruta = os.path.join(aqui, archivo)
    if not os.path.exists(ruta):
        continue
    malas = []
    with open(ruta, encoding="utf-8") as f:
        for i, linea in enumerate(f, 1):
            if "print(" not in linea:
                continue
            try:
                linea.encode("cp1252")
            except UnicodeEncodeError:
                malas.append(i)
    check(not malas, f"{archivo}: sin caracteres que revienten la consola {malas or ''}")

print("\n" + ("TODO EN VERDE" if not fallos else f"FALLARON {len(fallos)}: {fallos}"))
sys.exit(1 if fallos else 0)
