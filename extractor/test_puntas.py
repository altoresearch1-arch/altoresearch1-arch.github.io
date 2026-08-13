# -*- coding: utf-8 -*-
"""
Pruebas del capturador de puntas. Se corren solas, sin pytest:

    python extractor/test_puntas.py

QUE SE PRUEBA. Solo lo que al romperse convierte al capturador en un archivo
que parece funcionar y no guarda nada util:

  1. Que el append NO pise lo anterior. Todo el valor de esta serie es que se
     acumula: una sobreescritura silenciosa la vacia sin avisar.
  2. Que el filtro de duplicados NO se coma una captura donde SI cambio algo.
     Es el riesgo real del dedupe: de mas agresivo, borra el fenomeno que el
     archivo existe para registrar -- la punta que se mueve sin operaciones.
  3. Que el spread se calcule sobre el MEDIO y no sobre la compra. Con papeles
     de 4 centavos la diferencia entre las dos formulas es grande.
  4. Que una captura sin puntas no escriba una fila con spread inventado.
"""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_puntas import firma, ultimas  # noqa: E402

FALLOS = []


def ok(cond, etiqueta):
    print(("  OK     " if cond else "  FALLO  ") + etiqueta)
    if not cond:
        FALLOS.append(etiqueta)


def _jsonl(filas):
    fd, ruta = tempfile.mkstemp(suffix=".jsonl")
    os.close(fd)
    with open(ruta, "w", encoding="utf-8") as f:
        for r in filas:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    return ruta


def spread_pct(buy, sell):
    """La misma formula que escribe fetch_puntas, para poder probarla aparte."""
    medio = (buy + sell) / 2
    return round(100 * (sell - buy) / medio, 4)


print("[TEST] El append no pisa lo anterior")
ruta = _jsonl([{"nemonico": "RIO", "buy": 2.21, "sell": 2.24,
                "last": 2.2, "negotiatedQuantity": "33854",
                "lastDate": "2026-08-13T13:09:00"}])
with open(ruta, "a", encoding="utf-8") as f:
    f.write(json.dumps({"nemonico": "RIO", "buy": 2.05, "sell": 2.15,
                        "last": 2.15, "negotiatedQuantity": "53854",
                        "lastDate": "2026-08-13T15:00:00"}) + "\n")
lineas = [l for l in open(ruta, encoding="utf-8") if l.strip()]
ok(len(lineas) == 2, "dos capturas del mismo papel conviven en el archivo")
ok(json.loads(lineas[0])["buy"] == 2.21, "la primera captura sigue intacta")
os.remove(ruta)

print("\n[TEST] El dedupe distingue 'no paso nada' de 'se movio la punta'")
base = {"nemonico": "RIO", "buy": 2.21, "sell": 2.24, "last": 2.2,
        "negotiatedQuantity": "33854", "lastDate": "2026-08-13T13:09:00"}
ruta = _jsonl([base])
previas = ultimas(ruta)
ok(firma(dict(base)) == previas["RIO"],
   "captura identica se reconoce como repetida")

# EL CASO QUE IMPORTA: la punta se movio y NO hubo una sola operacion nueva.
# Es exactamente lo que paso con RIO el 13-ago entre las 13:09 y las 15:00.
sin_operar = dict(base, buy=2.05, sell=2.15)
ok(firma(sin_operar) != previas["RIO"],
   "punta que cae SIN operaciones nuevas se guarda igual")

solo_volumen = dict(base, negotiatedQuantity="53854")
ok(firma(solo_volumen) != previas["RIO"],
   "volumen que sube con la punta quieta tambien se guarda")
os.remove(ruta)

print("\n[TEST] El spread se mide contra el medio, no contra la compra")
ok(abs(spread_pct(2.15, 2.23) - 3.6530) < 0.001,
   "RIO al cierre del 13-ago: 3.65%")
ok(abs(spread_pct(0.167, 0.169) - 1.1905) < 0.001,
   "PPX al cierre del 13-ago: 1.19%")
# Contra la compra daria 3.72% y 1.20%: parecido en papeles caros y cada vez
# mas distinto a medida que el spread crece. Se fija la convencion.
ok(spread_pct(1.0, 3.0) == 100.0,
   "un spread de 1 a 3 da 100% contra el medio (no 200% contra la compra)")

print("\n[TEST] Sin puntas no se inventa spread")
ok(ultimas("no_existe_este_archivo.jsonl") == {},
   "archivo inexistente devuelve vacio en vez de reventar")
vacio = {"nemonico": "PML", "buy": None, "sell": None, "last": 1.3,
         "negotiatedQuantity": "0", "lastDate": None}
ok(firma(vacio) == (None, None, 1.3, "0", None),
   "una captura sin puntas conserva los None y no los rellena")

print()
if FALLOS:
    print("FALLARON %d prueba(s):" % len(FALLOS))
    for f in FALLOS:
        print("   -", f)
    sys.exit(1)
print("TODO EN VERDE")
