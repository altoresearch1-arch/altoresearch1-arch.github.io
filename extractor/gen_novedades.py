# -*- coding: utf-8 -*-
"""
NOVEDADES — genera app/public/novedades.json: un resumen LIVIANO (~20 KB) que la
app consulta EN VIVO (fetch sin caché) para avisarle al usuario cuando una
empresa de su lista ★ tiene algo nuevo (hecho de importancia o mes nuevo del BEM).

¿Por qué en public/ y no en src/data/? Los JSON de src/data van EMPAQUETADOS en
el bundle (solo cambian con un deploy + recarga). Este archivo se sirve SUELTO
en la raíz de la web → la app abierta lo puede volver a pedir cada pocos minutos
y enterarse de novedades sin recargar.

IMPORTANTE: el contenido es DETERMINÍSTICO (sale solo de los datos, sin reloj).
Si no hay datos nuevos, el archivo queda BYTE-IDÉNTICO → el robot no commitea
ni redespliega por gusto. NO agregar timestamps de "ahora" aquí.

Corre al final de extractor/actualizar_todo.py en todos los modos.
"""
import io, json, os, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, ".."))
DATA = os.path.join(RAIZ, "app", "src", "data")
SALIDA = os.path.join(RAIZ, "app", "public", "novedades.json")


def leer(nombre):
    with open(os.path.join(DATA, nombre), encoding="utf-8") as f:
        return json.load(f)


def main():
    hechos = leer("hechos.json")
    precios = leer("precios.json")
    try:
        mineria = leer("mineria.json")
    except Exception:
        mineria = {}

    # Último hecho de importancia por empresa (los hechos vienen ordenados
    # del más nuevo al más viejo; igual se toma el máximo por fecha por si acaso).
    ultimo_por_ticker = {}
    for ticker, info in (hechos.get("hechos") or {}).items():
        lista = info.get("hechos") or []
        if not lista:
            continue
        h = max(lista, key=lambda x: x.get("fecha") or "")
        ultimo_por_ticker[ticker] = {
            "fecha": h.get("fecha"),
            "titulo": (h.get("titulo") or "").strip(),
            "categoria": (h.get("categoria") or "").strip(),
        }

    # Fecha de precios más reciente (para "precios actualizados a las 12/3").
    fechas_px = [p.get("fecha") for p in (precios.get("precios") or {}).values() if p.get("fecha")]

    novedades = {
        "_comment": "Resumen en vivo para avisos en la app (generado por extractor/gen_novedades.py). Determinístico: sin timestamps de reloj.",
        "hechos": ultimo_por_ticker,
        "preciosFecha": max(fechas_px) if fechas_px else None,
        "bemUltimoMes": (mineria.get("meses") or [None])[-1],
    }

    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    nuevo = json.dumps(novedades, ensure_ascii=False, indent=1, sort_keys=True)
    viejo = None
    if os.path.exists(SALIDA):
        with open(SALIDA, encoding="utf-8") as f:
            viejo = f.read()
    if nuevo == viejo:
        print(f"novedades.json sin cambios ({len(ultimo_por_ticker)} empresas con hechos).")
        return
    with open(SALIDA, "w", encoding="utf-8", newline="\n") as f:
        f.write(nuevo)
    print(f"novedades.json escrito: {len(ultimo_por_ticker)} empresas con hechos, "
          f"precios al {novedades['preciosFecha']}, BEM {novedades['bemUltimoMes']}.")


if __name__ == "__main__":
    main()
