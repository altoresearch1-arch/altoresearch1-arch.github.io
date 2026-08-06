# -*- coding: utf-8 -*-
"""
Pruebas de las dos guardas del EPS. Se corren solas, sin pytest:

    python extractor/test_eps.py

POR QUE EXISTEN. La SMV publica la "utilidad por acción" mal de dos maneras
distintas, y las dos llegaron a la ficha:

  1. EN OTRA UNIDAD -- Hermes (01-ago-2026): utilidad S/ 14,670,000 con un EPS
     de 14,670, o sea MIL acciones. La ficha mostro "S/ 14,670.0000" para una
     accion de S/ 9.25.
  2. EN CERO SIN LLENAR -- Southern (05-ago-2026): US$ 723.9 M de utilidad y un
     EPS de 0.000 en el mismo archivo. La ficha mostro "US$ 0.0000" y el P/E la
     dio por PERDIDA, porque trataba el cero como resultado negativo.

Las dos guardas se parecen y por eso se prueban juntas: lo que hay que sostener
es que NINGUNA tapa a la otra. Un eps de 0 es falsy y se le escapa a la primera;
un eps en otra unidad no es cero y se le escapa a la segunda.

Que se prueba: solo lo que al romperse deja las guardas DECORATIVAS -- siguen
existiendo, siguen devolviendo algo, y ya no atajan el dato malo.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_batch import eps_es_plausible, eps_es_cero_sin_llenar  # noqa: E402
from smv_extractor import elegir_eps_por_clase  # noqa: E402

fallos = []


def check(cond, nombre):
    print(("  OK   " if cond else "  FALLA") + "  " + nombre)
    if not cond:
        fallos.append(nombre)


print("\n[TEST] El 0.000 sin llenar se ataja (caso Southern)")
# El caso real: SPCCPI1, Q2 2026. Utilidad de verdad, EPS en cero.
check(eps_es_cero_sin_llenar({"epsBasico": 0.0, "utilidadNeta": 723943000.0}) is True,
      "utilidad real con EPS 0.000: es campo sin llenar")
check(eps_es_cero_sin_llenar({"epsBasico": 0.0, "utilidadNeta": -11925000.0}) is True,
      "PERDIDA real con EPS 0.000: tambien es campo sin llenar")

print("\n[TEST] No se ataja lo que si puede ser un cero legitimo")
check(eps_es_cero_sin_llenar({"epsBasico": 0.0, "utilidadNeta": 0.0}) is False,
      "utilidad 0 y EPS 0: coherente, no se juzga")
check(eps_es_cero_sin_llenar({"epsBasico": 0.0, "utilidadNeta": None}) is False,
      "sin utilidad tagueada: no hay con que comparar")
check(eps_es_cero_sin_llenar({"epsBasico": None, "utilidadNeta": 100.0}) is False,
      "sin EPS tagueado: es ausencia, no un cero")

print("\n[TEST] Un EPS normal pasa por las dos guardas")
# Nexa Peru, Q2 2026: 48.3 M de utilidad y EPS 0.038 -> 1,272 M de acciones.
sano = {"epsBasico": 0.038, "utilidadNeta": 48339000.0}
check(eps_es_cero_sin_llenar(sano) is False, "Nexa: no es un cero")
check(eps_es_plausible(sano) is True, "Nexa: la escala es plausible")
check(eps_es_plausible({"epsBasico": -0.01, "utilidadNeta": -829000.0}) is True,
      "un EPS negativo es un resultado, no un error")

print("\n[TEST] Ninguna guarda tapa a la otra")
# Si eps_es_cero_sin_llenar se 'simplificara' a `not eps`, se comeria los
# ausentes; si eps_es_plausible se 'arreglara' para juzgar el 0, dividiria
# entre cero. Cada una atiende SU caso y deja pasar el del otro.
hermes = {"epsBasico": 14670, "utilidadNeta": 14670000.0}
check(eps_es_plausible(hermes) is False,
      "Hermes (mil acciones implicitas): lo ataja la guarda de escala")
check(eps_es_cero_sin_llenar(hermes) is False,
      "Hermes no es un cero: la guarda del cero lo deja pasar")
southern = {"epsBasico": 0.0, "utilidadNeta": 723943000.0}
check(eps_es_cero_sin_llenar(southern) is True,
      "Southern: lo ataja la guarda del cero")
check(eps_es_plausible(southern) is True,
      "Southern se le escapa a la de escala (el 0 es falsy) -- por eso hay dos")

print("\n[TEST] La guarda de escala no revienta con un cero")
# Dividir entre epsBasico=0 seria ZeroDivisionError justo en la empresa mala.
try:
    eps_es_plausible(southern)
    check(True, "eps_es_plausible(0) no lanza ZeroDivisionError")
except ZeroDivisionError:
    check(False, "eps_es_plausible(0) lanza ZeroDivisionError")

print("\n[TEST] Entre clases de accion, un valor real le gana al 0 de relleno")
# El caso Southern, tal cual viene en su XBRL: la clase que NO cotiza trae 0.0 y
# la que SI cotiza (inversion) trae el numero. La preferencia ciega por
# OrdinaryShares devolvia 0.0 y dejaba la ficha en "US$ 0.0000".
spcc = [("OrdinarySharesMember", 0.0), ("AccionesDeInversionMiembro", 6.095)]
check(elegir_eps_por_clase(spcc) == 6.095,
      "OrdinaryShares en 0 y otra clase con valor: gana el valor")
check(elegir_eps_por_clase(list(reversed(spcc))) == 6.095,
      "el orden en que vienen las clases no cambia el resultado")

print("\n[TEST] Con dos clases NO nulas sigue mandando la accion comun")
# Esto es lo que no hay que romper al arreglar lo de arriba: cuando las dos
# clases traen numero, la comun sigue siendo la buena.
check(elegir_eps_por_clase([("OrdinarySharesMember", 1.5),
                            ("AccionesDeInversionMiembro", 1.4)]) == 1.5,
      "las dos con valor: gana OrdinaryShares")

print("\n[TEST] El 0 legitimo sigue llegando a quien sabe juzgarlo")
# Si TODAS las clases son 0, elegir_eps_por_clase no lo tapa: devuelve 0 y el
# juicio queda para eps_es_cero_sin_llenar, que si tiene la utilidad neta.
check(elegir_eps_por_clase([("OrdinarySharesMember", 0.0)]) == 0.0,
      "una sola clase en 0: devuelve 0, no None")
check(elegir_eps_por_clase([("OrdinarySharesMember", 0.0),
                            ("AccionesDeInversionMiembro", 0.0)]) == 0.0,
      "todas las clases en 0: devuelve 0, no None")
check(elegir_eps_por_clase([]) is None,
      "sin candidatos: None (ausencia, distinto de cero)")

print("\n[TEST] Sin dimension (miembro vacio) tambien se elige")
check(elegir_eps_por_clase([("", 0.42)]) == 0.42,
      "un unico candidato sin clase: se devuelve")
check(elegir_eps_por_clase([("", 0.0), ("AccionesDeInversionMiembro", 2.0)]) == 2.0,
      "sin clase en 0 y otra con valor: gana el valor")

print("\n[TEST] Las dos mitades del arreglo encajan (Southern de punta a punta)")
# 1) elegir_eps_por_clase rescata el 6.095 en vez del 0.0 de relleno, y
# 2) por eso eps_es_cero_sin_llenar ya no tiene nada que atajar.
eps_southern = elegir_eps_por_clase(spcc)
check(eps_southern == 6.095, "paso 1: se rescata el EPS real")
check(eps_es_cero_sin_llenar({"epsBasico": eps_southern,
                              "utilidadNeta": 723943000.0}) is False,
      "paso 2: con el EPS real ya no hay cero que atajar")
check(eps_es_plausible({"epsBasico": eps_southern,
                        "utilidadNeta": 723943000.0}) is True,
      "paso 3: la escala del EPS rescatado es plausible")

print("\n" + ("TODO EN VERDE" if not fallos else f"FALLARON {len(fallos)}: {fallos}"))
sys.exit(1 if fallos else 0)
