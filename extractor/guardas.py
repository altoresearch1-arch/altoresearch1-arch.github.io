# -*- coding: utf-8 -*-
"""
🛡️ EL CORTAFUEGOS DE ESCRITURA — que una fuente caída no borre lo bueno.

EL ACCIDENTE QUE ESTO EVITA (visto el 03-ago-2026, en vivo):
La BVL respondió 200 con `content: []` durante toda la mañana — su propia web
decía "En este momento, no hay datos disponibles". No fue un error de red ni
del script: el endpoint contestó bien, sin cotizaciones. fetch_precios.py hizo
lo que le tocaba con esa respuesta: marcó las 115 empresas como "NO encontrado"
y escribió {"precio": null} para todas, encima de los precios buenos del día
anterior. Hubo que restaurar con `git checkout`.

En producción eso corre CADA 10 MINUTOS y commitea. O sea que una mañana mala
de la BVL puede vaciar precios.json, subirlo al repo y dejar la web sin
precios, sin que nadie se entere hasta verlo.

LA REGLA, y es una sola: un archivo de datos NO se sobrescribe con menos de lo
que ya tenía. Si la corrida trajo cero, o trajo mucho menos que la anterior, se
avisa y se sale LIMPIO (código 0, para no tumbar al robot ni marcar el workflow
en rojo por algo que no es culpa nuestra).

POR QUÉ 80% Y NO 100%: que una o dos empresas no aparezcan es normal — dejan de
cotizar, cambian de nemónico, o la BVL las omite ese día. Exigir el 100%
convertiría cada rareza en un aborto. Perder más de una quinta parte del
universo de golpe, en cambio, no le pasa a un mercado: le pasa a una fuente
caída.

ESTO NO REEMPLAZA MIRAR EL DATO. Es la última línea, no la primera.
"""
import json
import os

# SIN EMOJIS EN LOS PRINT DE ESTE ARCHIVO. La consola de Windows usa cp1252
# y un emoji la hace reventar con UnicodeEncodeError -- o sea que la guarda
# fallaria justo en el momento en que tiene que proteger. Se probo: pasa de
# verdad. Texto plano y listo.
MINIMO_PCT = 0.8


def _cuantos(ruta, clave, campo="encontrado"):
    """Cuántos registros ÚTILES tiene el archivo que ya está en disco."""
    if not os.path.exists(ruta):
        return None  # primera corrida: no hay con qué comparar, se deja pasar
    try:
        with open(ruta, encoding="utf-8") as f:
            doc = json.load(f)
    except (ValueError, OSError):
        return None  # ilegible: mejor dejar escribir que quedarse con basura
    datos = doc.get(clave) or {}
    return sum(1 for v in datos.values() if isinstance(v, dict) and v.get(campo))


def cambio_real(ruta, clave, datos_nuevos):
    """
    ¿El contenido ÚTIL cambió respecto de lo que ya está en disco?

    Compara solo `clave`, ignorando el resto del documento — y ese "resto" es
    justo el problema: varios archivos estampan un `generado` con la hora en
    cada corrida, así que el archivo SIEMPRE difiere aunque el dato sea
    idéntico. Eso anula la guarda del workflow (`git diff --cached --quiet`) y
    hace que se commitee 48 veces al día sin novedad. Comprobado el
    03-ago-2026: precios.json salió idéntico e intradia.json figuró como
    modificado, solo por el sello de hora.

    Sin archivo previo devuelve True: todo es nuevo.
    """
    if not os.path.exists(ruta):
        return True
    try:
        with open(ruta, encoding="utf-8") as f:
            viejo = json.load(f)
    except (ValueError, OSError):
        return True
    return viejo.get(clave) != datos_nuevos


def se_puede_escribir(ruta, clave, n_nuevos, etiqueta, minimo_pct=MINIMO_PCT):
    """
    ¿Es seguro sobrescribir `ruta` con `n_nuevos` registros útiles?

    Devuelve True si sí. Si no, imprime el motivo y devuelve False — el que
    llama debe salir con código 0 SIN escribir.
    """
    if n_nuevos <= 0:
        print(f"\n[GUARDA] ABORTA {etiqueta}: la fuente no devolvió NADA útil.")
        print(f"    No se toca {os.path.basename(ruta)} — se conserva lo anterior.")
        return False

    antes = _cuantos(ruta, clave)
    if antes is None:
        return True
    if antes == 0:
        return True  # lo que había ya estaba vacío: cualquier cosa es mejor

    piso = int(antes * minimo_pct)
    if n_nuevos < piso:
        print(f"\n[GUARDA] ABORTA {etiqueta}: llegaron {n_nuevos} registros y el archivo "
              f"tenía {antes} (piso: {piso}).")
        print("    Una caída así no es del mercado, es de la fuente.")
        print(f"    No se toca {os.path.basename(ruta)} — se conserva lo anterior.")
        return False

    if n_nuevos < antes:
        # Baja tolerable: se escribe igual, pero queda dicho en el log.
        print(f"\n[GUARDA] {etiqueta}: {n_nuevos} registros contra {antes} de antes. "
              "Dentro del margen, se escribe.")
    return True
