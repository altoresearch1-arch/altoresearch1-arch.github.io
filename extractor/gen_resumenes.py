# -*- coding: utf-8 -*-
"""
📋 RESÚMENES — el cierre del día, de la semana y del mes.

QUÉ GENERA (app/src/data/resumenes.json), cada uno SELLADO con fecha y hora:

  · DIARIO   — la última rueda: qué se movió, con cuánta plata, a qué hora fue
    la última operación y qué se publicó ese día.
  · SEMANAL  — las últimas 5 ruedas + LA FAVORITA DE LA SEMANA.
  · MENSUAL  — las últimas 20 ruedas + la favorita del mes.

────────────────────────────────────────────────────────────────────────────
LOS DOS CRITERIOS, Y POR QUÉ VAN LOS DOS
────────────────────────────────────────────────────────────────────────────
Cada anomalía se marca por DOS varas distintas, y ninguna filtra a la otra:

  · FUERZA (≥1× su propio vaivén) — el criterio del DETECTOR. Responde "¿esto
    se salió de lo que esta acción suele hacer?".
  · PORCENTAJE (≥3%) — el criterio del que va a TOMAR el movimiento. Un +9%
    son 9% de plata aunque para esa acción sea un martes cualquiera.

Se midieron las dos sobre 10 ruedas reales (14→30 jul 2026) y NO coinciden:
de 22 movimientos de 3% o más, 6 estaban DENTRO del vaivén normal de su
acción. Y al revés — Credicorp tuvo días de 2.1× y 1.8× su vaivén que el corte
de 3% dejó fuera, uno de ellos por 0.0 puntos. Con un solo criterio, el
resumen miente en una dirección o en la otra.

────────────────────────────────────────────────────────────────────────────
QUÉ ES "LA FAVORITA" Y QUÉ NO ES
────────────────────────────────────────────────────────────────────────────
Es **la que más veces se salió de su rango en el periodo**, desempatando por
cuánto acumuló. Es una descripción de lo que YA pasó — la que más dio que
hablar, no la que va a subir. No es una recomendación y no lo va a ser nunca
(Regla de Oro: la app muestra, no aconseja).

Va con su día a día completo: cada rueda con su %, su volumen, la hora de su
última operación y los titulares de ese día con la hora en que salieron.

LÍMITE HONESTO: el histórico de la BVL da un cierre por rueda. Las horas que
aparecen son (a) la hora real de la última operación, que sí viene del
mercado, y (b) la hora de publicación de cada titular. La hora EXACTA de un
salto de precio necesita intradia.json acumulado, que recién arranca.

Uso:  python extractor/gen_resumenes.py
"""
import io, json, math, os, sys, collections
from datetime import datetime, timedelta, timezone

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

AQUI = os.path.dirname(os.path.abspath(__file__))
APP_DATA = os.path.normpath(os.path.join(AQUI, "..", "app", "src", "data"))
LIMA = timezone(timedelta(hours=-5))
SALIDA = os.path.join(APP_DATA, "resumenes.json")

UMBRAL_FUERZA = 1.0    # se salió de su propio vaivén
UMBRAL_PCT = 3.0       # el corte en plata, como lo pidió Jair
RUEDAS = {"dia": 1, "semana": 5, "mes": 20}


def leer(nombre, default=None):
    ruta = os.path.join(APP_DATA, nombre)
    if not os.path.exists(ruta):
        return default
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)


def main():
    emp = {e["ticker"]: e for e in (leer("empresas.json") or {}).get("empresas", [])}
    his = (leer("historicos.json") or {}).get("historicos", {})
    pre = (leer("precios.json") or {}).get("precios", {})
    noti = leer("noticias.json") or {}
    hechos = (leer("hechos.json") or {}).get("hechos", {})
    intra = (leer("intradia.json") or {}).get("dias", {})

    # ── Universo: las que de verdad se negocian (misma regla que el Radar)
    series = {}
    for tk, h in his.items():
        if tk not in emp or h.get("pocoNegociada"):
            continue
        v = [x for x in (h.get("valores") or []) if x[1] > 0]
        if len(v) < 25:
            continue
        series[tk] = {"v": v, "vol": h.get("volatilidadAnualPct"),
                      "sector": emp[tk].get("sector"), "nombre": emp[tk].get("nombre")}
    if not series:
        print("Sin series suficientes; no se genera nada.")
        return

    fechas = sorted({f for s in series.values() for f, _ in s["v"]})

    # ── Noticias por (fecha) y por (ticker, fecha), con su hora si la tienen
    n_tk = collections.defaultdict(list)
    n_mundo = collections.defaultdict(list)
    for tk, items in (noti.get("porEmpresa") or {}).items():
        for n in items:
            n_tk[(tk, n["fecha"])].append(n)
    for mid, m in (noti.get("mundo") or {}).items():
        tks = {t for a in m.get("afecta", []) for t in a.get("tickers", [])}
        for n in m.get("items", []):
            for t in tks:
                n_mundo[(t, n["fecha"])].append({**n, "tema": m.get("titulo")})
    hi = collections.defaultdict(list)
    for tk, d in hechos.items():
        for h in d.get("hechos", []):
            if h.get("fecha"):
                hi[(tk, h["fecha"])].append(h)

    def vaiven(vol, ruedas):
        return (vol * math.sqrt(ruedas / 252)) if vol else None

    def movimiento(tk, ruedas, hasta_idx=None):
        """Retorno y fuerza de las últimas `ruedas` sesiones de ese ticker."""
        v = series[tk]["v"]
        fin = len(v) - 1 if hasta_idx is None else hasta_idx
        ini = fin - ruedas
        if ini < 0:
            return None
        a, b = v[ini][1], v[fin][1]
        if not a or not b:
            return None
        r = (b / a - 1) * 100
        vn = vaiven(series[tk]["vol"], ruedas)
        return {"pct": round(r, 2), "desde": v[ini][0], "hasta": v[fin][0],
                "precioDesde": a, "precioHasta": b,
                "vaiven": round(vn, 2) if vn else None,
                "fuerza": round(r / vn, 2) if vn else None}

    def volumen_de(tk, fecha):
        d = (intra.get(fecha) or {}).get(tk)
        if d:
            return {"monto": d.get("monto"), "ops": d.get("ops"),
                    "cantidad": d.get("cantidad"), "ultima": d.get("ultima"),
                    "apertura": d.get("apertura"), "min": d.get("min"), "max": d.get("max"),
                    "moneda": d.get("moneda")}
        p = pre.get(tk) or {}
        if p.get("fecha") == fecha and p.get("operaciones"):
            return {"monto": p.get("montoNegociado"), "ops": p.get("operaciones"),
                    "cantidad": p.get("cantidadNegociada"),
                    "ultima": p.get("ultimaOperacion"), "apertura": p.get("apertura"),
                    "min": p.get("minimo"), "max": p.get("maximo"), "moneda": p.get("moneda")}
        return None

    def prensa_de(tk, fecha):
        """Titulares y hechos de ESE día, con hora cuando el RSS la trajo."""
        out = []
        for h in hi.get((tk, fecha), []):
            out.append({"tipo": "hecho", "titulo": h.get("titulo") or "(sin título)",
                        "hora": None, "pdf": h.get("pdf"), "peso": 3})
        for n in n_tk.get((tk, fecha), []):
            out.append({"tipo": "prensa", "titulo": n["titulo"], "medio": n.get("medio"),
                        "hora": (n.get("cuando") or "")[11:16] or None,
                        "url": n.get("url"), "peso": n.get("peso", 1),
                        "icono": n.get("icono")})
        for n in n_mundo.get((tk, fecha), [])[:2]:
            out.append({"tipo": "mundo", "titulo": n["titulo"], "medio": n.get("medio"),
                        "hora": (n.get("cuando") or "")[11:16] or None,
                        "url": n.get("url"), "tema": n.get("tema"), "peso": n.get("peso", 1)})
        return sorted(out, key=lambda x: (-x["peso"], x.get("hora") or ""))

    def dia_de(tk, fecha, idx):
        m = movimiento(tk, 1, idx)
        if not m:
            return None
        return {"fecha": fecha, **m, "volumen": volumen_de(tk, fecha),
                "prensa": prensa_de(tk, fecha)}

    # ══ RESUMEN DE UNA RUEDA ═══════════════════════════════════════════════
    ultima = fechas[-1]
    idx_de = {tk: {f: i for i, (f, _) in enumerate(series[tk]["v"])} for tk in series}

    filas_dia = []
    for tk in series:
        i = idx_de[tk].get(ultima)
        if i is None:
            continue
        d = dia_de(tk, ultima, i)
        if not d:
            continue
        d.update({"ticker": tk, "nombre": series[tk]["nombre"], "sector": series[tk]["sector"]})
        filas_dia.append(d)

    def clasifica(filas):
        porFuerza = [f for f in filas if f.get("fuerza") is not None
                     and abs(f["fuerza"]) >= UMBRAL_FUERZA]
        porPct = [f for f in filas if abs(f["pct"]) >= UMBRAL_PCT]
        soloF = [f["ticker"] for f in porFuerza if abs(f["pct"]) < UMBRAL_PCT]
        soloP = [f["ticker"] for f in porPct
                 if f.get("fuerza") is None or abs(f["fuerza"]) < UMBRAL_FUERZA]
        return {
            "porFuerza": sorted(porFuerza, key=lambda f: -abs(f["fuerza"])),
            "porPct": sorted(porPct, key=lambda f: -abs(f["pct"])),
            "soloLasVeElVaiven": soloF,   # las que el corte de 3% se perdería
            "soloLasVeElPorcentaje": soloP,  # las que son normales para ellas
        }

    diario = {"fecha": ultima, "contactos": len(filas_dia), **clasifica(filas_dia)}

    # ══ FAVORITA DE UN PERIODO ═════════════════════════════════════════════
    def favorita(ruedas, etiqueta):
        ventana = fechas[-ruedas:]
        marcador = []
        for tk in series:
            cruces, dias, acumulado = 0, [], None
            for f in ventana:
                i = idx_de[tk].get(f)
                if i is None or i == 0:
                    continue
                d = dia_de(tk, f, i)
                if not d:
                    continue
                if d.get("fuerza") is not None and abs(d["fuerza"]) >= UMBRAL_FUERZA:
                    cruces += 1
                dias.append(d)
            tot = movimiento(tk, min(ruedas, len(series[tk]["v"]) - 1))
            if not dias or not tot:
                continue
            # OJO: el volumen histórico NO existe hacia atrás. El endpoint de
            # mercado solo sabe de HOY, y intradia.json arrancó el 02-ago-2026.
            # Para un periodo anterior a esa fecha, lo correcto es decir "no
            # tengo el dato" — un 0 se leería como "no se negoció", que es lo
            # contrario de la verdad.
            con_vol = [d["volumen"] for d in dias if d.get("volumen")]
            vol_total = round(sum(v.get("monto") or 0 for v in con_vol)) if con_vol else None
            ops_total = sum(v.get("ops") or 0 for v in con_vol) if con_vol else None
            marcador.append({
                "ticker": tk, "nombre": series[tk]["nombre"], "sector": series[tk]["sector"],
                "cruces": cruces, "total": tot, "dias": dias,
                "montoPeriodo": vol_total, "opsPeriodo": ops_total,
            })
        if not marcador:
            return None
        # LA FAVORITA: la que más veces se salió de su rango. A igual número de
        # cruces gana la que más acumuló — y si tampoco, la que movió más plata,
        # porque una subida que nadie negoció no es la protagonista de nada.
        marcador.sort(key=lambda m: (-m["cruces"], -abs(m["total"]["pct"]),
                                     -(m["montoPeriodo"] or 0)))
        gan = marcador[0]
        return {
            "periodo": etiqueta,
            "desde": ventana[0], "hasta": ventana[-1], "ruedas": len(ventana),
            "criterio": ("la que más veces se salió de su propio vaivén en el periodo; "
                         "a igual número de cruces, la que más acumuló, y luego la que "
                         "movió más plata. Describe lo que YA pasó — no es una "
                         "recomendación ni un pronóstico."),
            "favorita": gan,
            "tabla": [{"ticker": m["ticker"], "cruces": m["cruces"],
                       "pct": m["total"]["pct"], "fuerza": m["total"]["fuerza"],
                       "monto": m["montoPeriodo"], "ops": m["opsPeriodo"]}
                      for m in marcador[:12]],
        }

    ahora = datetime.now(LIMA)
    doc = {
        "_comment": ("Resúmenes del día, la semana y el mes. Cada anomalía va medida por "
                     "DOS varas que no coinciden: fuerza (≥1× su vaivén, el criterio del "
                     "detector) y porcentaje (≥3%, el criterio de quien toma el "
                     "movimiento). 'favorita' = la que más veces se salió de su rango en "
                     "el periodo; es descripción de lo que pasó, NO una recomendación. "
                     "Generado por extractor/gen_resumenes.py."),
        "generado": ahora.isoformat(timespec="minutes"),
        "generadoLegible": ahora.strftime("%d/%m/%Y %H:%M") + " hora de Lima",
        "umbrales": {"fuerza": UMBRAL_FUERZA, "pct": UMBRAL_PCT},
        "diario": diario,
        "semanal": favorita(RUEDAS["semana"], "semana"),
        "mensual": favorita(RUEDAS["mes"], "mes"),
    }
    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)

    print(f"✅ {SALIDA}")
    print(f"   Sellado: {doc['generadoLegible']}")
    print(f"\n📅 RUEDA DEL {ultima} · {diario['contactos']} acciones")
    print(f"   {len(diario['porFuerza'])} salieron de su vaivén · "
          f"{len(diario['porPct'])} movieron 3% o más")
    if diario["soloLasVeElVaiven"]:
        print(f"   ⚠ el corte de 3% se perdería: {', '.join(diario['soloLasVeElVaiven'])}")
    if diario["soloLasVeElPorcentaje"]:
        print(f"   ⚠ normales para ellas pese al 3%: {', '.join(diario['soloLasVeElPorcentaje'])}")
    for clave, ico in (("semanal", "🏆"), ("mensual", "📆")):
        r = doc[clave]
        if not r:
            continue
        g = r["favorita"]
        print(f"\n{ico} FAVORITA DE LA {clave.upper()} ({r['desde']} → {r['hasta']}): "
              f"{g['ticker']} · {g['total']['pct']:+.1f}% · "
              f"{g['cruces']} cruces · "
              + (f"{g['opsPeriodo']} ops · {g['montoPeriodo']:,}"
                 if g['montoPeriodo'] is not None
                 else "volumen del periodo: sin dato (intradia.json arrancó hoy)"))


if __name__ == "__main__":
    main()
