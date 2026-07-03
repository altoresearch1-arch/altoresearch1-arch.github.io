# -*- coding: utf-8 -*-
"""
ORQUESTADOR — un solo comando para actualizar TODO en el orden correcto.

Uso:
  python extractor/actualizar_todo.py            # actualización DIARIA (robot)
  python extractor/actualizar_todo.py --trimestral   # cambio de trimestre (Q2, Q3…)
  python extractor/actualizar_todo.py --con-build    # además corre npm run build (PWA)

DIARIO (en orden, SECUENCIAL — no paralelizar: la SMV se atora con sesiones
simultáneas y fetch_anual_eps ya falló una vez así):
  1. fetch_precios       -> precios.json        (cierres BVL)
  2. fetch_historicos    -> historicos.json     (sparkline + termómetro)
  3. fetch_hechos        -> hechos.json         (HI por empresa 📰)
  4. div_stockanalysis   -> dividendos.json     (dividendos base)
  5. fetch_beneficios    -> dividendos.json     (parcha FIBRAs/chicas + CORRIGE moneda)
  6. fetch_anual_eps     -> eps_anual.json      (ganancia anual + TC, para el P/E)
  7. fix_eps             -> eps_anual.json      (parcha EPS distorsionados; SIEMPRE tras el 6)
  8. auditoria           -> reporte             (falla si hay problemas estructurales)

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

PASOS_DIARIO = [
    "fetch_precios.py",
    "fetch_historicos.py",
    "fetch_hechos.py",
    "div_stockanalysis.py",
    "fetch_beneficios.py",
    "fetch_anual_eps.py",
    "fix_eps.py",
]


def correr(script, args=None):
    inicio = time.time()
    cmd = [sys.executable, os.path.join(AQUI, script)] + (args or [])
    print(f"\n{'='*60}\n>> {script}\n{'='*60}", flush=True)
    r = subprocess.run(cmd, cwd=RAIZ)
    dur = time.time() - inicio
    estado = "OK" if r.returncode == 0 else f"FALLÓ (código {r.returncode})"
    print(f"<< {script}: {estado} en {dur:.0f}s", flush=True)
    return r.returncode == 0


def main():
    trimestral = "--trimestral" in sys.argv
    con_build = "--con-build" in sys.argv
    fallos = []

    if trimestral:
        print("MODO TRIMESTRAL: fundamentos SMV completos (run_batch).")
        print("(¿Ya cambiaste 'trimestre' en empresas_config.json? Ctrl+C si no.)")
        time.sleep(5)
        if not correr("run_batch.py"):
            fallos.append("run_batch.py — reintentar los caídos con: python extractor/run_uno.py TICKER")

    for p in PASOS_DIARIO:
        if not correr(p):
            fallos.append(p)

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
