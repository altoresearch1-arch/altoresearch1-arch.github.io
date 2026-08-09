# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════════════════
📈 EL GRÁFICO — el precio con lo que se publicó cada día, encima.

    python laboratorio/grafico.py VOLCABC1        → laboratorio/grafico-VOLCABC1.html
    python laboratorio/grafico.py VOLCABC10 260   → con 260 ruedas de ventana

POR QUÉ NO TIENE VELAS, aunque un gráfico de bolsa «deba» tenerlas.
`historicos.json` guarda `[fecha, precio]`: no hay apertura, máximo ni mínimo
viejos. `intradia.json` sí los tiene, pero son 19 días y de esos solo 4 traen a
Volcan. Dibujar velas con eso sería inventar tres de los cuatro números de cada
una. Lo mismo con las barras de volumen: solo existe el volumen de HOY.
En su lugar va la variación diaria, que es un dato real y responde la misma
pregunta —qué días se movió fuerte—. Si algún día `fetch_historicos.py` empieza
a guardar OHLC, las velas salen solas desde ese día en adelante.

LO QUE EL GRÁFICO NO VA A HACER: decir «cayó POR el hecho». Medido sobre las 45
acciones negociadas, el 91% de los movimientos de 4% o más NO tiene ningún Hecho
publicado que el mercado pudiera saber ese día. Así que cuando no hay nada, la
anotación dice «no se publicó nada», que es la verdad y es información: casi
siempre el precio se mueve sin papel de por medio (Invariante #31: nunca
«porque», siempre «puede»).

LA HORA MANDA. Un Hecho publicado 19:12 no está en el cierre de ese día: se
atribuye a la rueda siguiente. La hora no viene en el JSON, sale de la ruta del
PDF, y sin leerla un tercio de las marcas quedarían un día corridas.
═══════════════════════════════════════════════════════════════════════════════
"""
import json, os, sys, statistics as st

from motor import cargar, series_frescas, fechas_eeff, construir_panel
from eventos import familia, hora_publicacion, ultimo_de, por_familia
from etiquetas import por_ticker
from similares import preparar, buscar, prueba_nula, veredicto

sys.stdout.reconfigure(encoding='utf-8')

AQUI = os.path.dirname(os.path.abspath(__file__))
VENTANA = 130          # ruedas a la vista (~6 meses)
NOTABLE = 4.0          # % de variación diaria que merece anotación


def percentil(v, q):
    """Percentil por interpolación lineal. Sin numpy: son listas de cientos."""
    v = sorted(v)
    if not v:
        return 0.0
    k = (len(v) - 1) * q / 100
    i = int(k)
    return v[i] if i + 1 >= len(v) else v[i] + (v[i + 1] - v[i]) * (k - i)


def construir(ticker, ventana=VENTANA):
    series, _ = series_frescas()
    if ticker not in series:
        return None
    vals = series[ticker][-ventana:]
    fechas = [f for f, _ in vals]

    # ── los hechos, colocados en la rueda que el mercado pudo usar ──────
    hechos_por_rueda = {}
    for h in cargar('hechos.json')['hechos'].get(ticker, {}).get('hechos', []):
        f, hora = h['fecha'], hora_publicacion(h)
        if f in fechas and (hora is None or hora < 15):
            destino = f                       # salió durante la rueda
        else:
            posteriores = [x for x in fechas if x > f]
            destino = posteriores[0] if posteriores else None
        if destino:
            hechos_por_rueda.setdefault(destino, []).append(
                {'titulo': (h.get('titulo') or h.get('categoria') or '')[:96],
                 'fam': familia(h), 'fecha': f,
                 'hora': f'{hora:02d}h' if hora is not None else None,
                 'pdf': h.get('pdf')})

    noticias = {}
    for n in cargar('noticias.json')['porEmpresa'].get(ticker) or []:
        noticias.setdefault(n['fecha'], []).append(
            {'titulo': (n.get('titulo') or '')[:96], 'medio': n.get('medio', '')})

    # ── la serie, rueda por rueda ───────────────────────────────────────
    puntos = []
    for i, (f, p) in enumerate(vals):
        prev = vals[i - 1][1] if i else None
        chg = ((p / prev - 1) * 100) if prev else 0.0
        puntos.append({'f': f, 'p': p, 'chg': round(chg, 2),
                       'h': hechos_por_rueda.get(f, []),
                       'n': noticias.get(f, [])})

    # ── qué anotar: los movimientos grandes, sin amontonarse ────────────
    grandes = sorted([q for q in puntos if abs(q['chg']) >= NOTABLE],
                     key=lambda q: -abs(q['chg']))
    notas, usados = [], []
    for q in grandes:
        i = fechas.index(q['f'])
        if any(abs(i - j) < 6 for j in usados):
            continue
        usados.append(i)
        h = q['h'][0] if q['h'] else None
        nt = q['n'][0] if q['n'] else None
        notas.append({
            'i': i, 'f': q['f'], 'chg': q['chg'],
            'que': (f"📄 {h['titulo']}" if h else
                    (f"📰 {nt['titulo']} ({nt['medio']})" if nt else None)),
            'fam': h['fam'] if h else None,
            'fuente': ('hecho' if h else ('noticia' if nt else 'nada')),
        })
        if len(notas) >= 7:
            break
    notas.sort(key=lambda x: x['i'])

    # ── la coincidencia, medida en ESTA acción ──────────────────────────
    conteo = [q for q in puntos if abs(q['chg']) >= NOTABLE]
    con_papel = [q for q in conteo if q['h']]

    # ── el cono: no un pronóstico, la DISPERSIÓN histórica ──────────────
    # Dos repartos distintos y hay que mirarlos juntos:
    #   · el propio  → todo lo que esta acción hizo en 10 ruedas, sin condicionar.
    #     Es el ancho normal de la bestia y casi siempre es más ancho de lo que
    #     uno se imagina.
    #   · el condicionado → solo las ruedas parecidas al estado de HOY. Más
    #     angosto, pero con 25 casos y sujeto a la prueba nula: si el centro no
    #     le gana al azar, el cono sirve para el ancho, no para la dirección.
    cono = None
    panel = construir_panel(series, fechas_eeff(), con_futuro=False)
    dela = [r for r in panel if r['t'] == ticker]
    if dela:
        escala = preparar(panel)
        o = max(dela, key=lambda r: r['f'])
        propios = [r['fwd'] for r in dela if r['fwd'] is not None]
        vec = buscar(o, panel, escala, k=25)
        pozo = [r for r in panel if r['fwd'] is not None and r['f'] < o['f']]
        nula = prueba_nula(vec, pozo) if vec else None
        cond = [r['fwd'] for _, r in vec]
        cono = {
            'p0': o['p'], 'horizonte': 10,
            'propia': {f'p{q}': round(percentil(propios, q), 2) for q in (10, 25, 50, 75, 90)},
            'propia_n': len(propios),
            'cond': {f'p{q}': round(percentil(cond, q), 2) for q in (10, 25, 50, 75, 90)},
            'cond_n': len(cond),
            'sube': round(100 * sum(1 for v in cond if v > 0) / len(cond)) if cond else None,
            'veredicto': veredicto(nula) if nula else 'sin pozo para juzgar',
            'azar_mediana': round(nula['azar_mediana'], 2) if nula else None,
        } if propios and cond else None

    emp = next((e for e in cargar('empresas.json')['empresas']
                if e.get('ticker') == ticker), {})
    ult = ultimo_de(ticker, hasta=fechas[-1])
    base = por_familia().get(ult['fam']) if ult else None

    return {
        'ticker': ticker, 'nombre': emp.get('nombre', ticker),
        'sector': emp.get('sector', '—'),
        'puntos': puntos, 'notas': notas,
        'grandes': len(conteo), 'con_papel': len(con_papel),
        'ultimo_hecho': ult,
        'base10': (round(base['horizontes'][10]['mediana'], 2) if base else None),
        'base10_gana': (round(base['horizontes'][10]['gana']) if base else None),
        'base_n': (base['n'] if base else None),
        'vol': round(st.pstdev([q['chg'] for q in puntos[-21:]]), 2),
        'cono': cono,
        'etiquetas': [e for e in por_ticker(ticker, hasta=fechas[-1])
                      if e.get('hipotesis')],
    }


PLANTILLA = """<title>{nombre} — el precio y lo que se publicó</title>

<style>
  :root{{
    --ground:#F7F7F4;--panel:#FFFFFF;--panel-2:#F1F2EE;
    --ink:#15191A;--ink-2:#47514F;--ink-3:#78837F;
    --rule:#E1E4DE;--rule-2:#EDEFEA;
    --sube:#008C82;--baja:#BE5A18;
    --sube-soft:rgba(0,140,130,.13);--baja-soft:rgba(190,90,24,.13);
    --serif:ui-serif,"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
    --sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    --mono:ui-monospace,"Cascadia Mono",Consolas,"SF Mono",Menlo,monospace;
  }}
  @media (prefers-color-scheme:dark){{
    :root{{--ground:#101416;--panel:#171C1F;--panel-2:#1D2427;
      --ink:#E9ECEA;--ink-2:#A8B2AF;--ink-3:#7C8784;--rule:#262D30;--rule-2:#1F2629;
      --sube:#12A192;--baja:#D2762F;
      --sube-soft:rgba(18,161,146,.16);--baja-soft:rgba(210,118,47,.16);}}
  }}
  :root[data-theme="dark"]{{--ground:#101416;--panel:#171C1F;--panel-2:#1D2427;
    --ink:#E9ECEA;--ink-2:#A8B2AF;--ink-3:#7C8784;--rule:#262D30;--rule-2:#1F2629;
    --sube:#12A192;--baja:#D2762F;
    --sube-soft:rgba(18,161,146,.16);--baja-soft:rgba(210,118,47,.16);}}
  :root[data-theme="light"]{{--ground:#F7F7F4;--panel:#FFFFFF;--panel-2:#F1F2EE;
    --ink:#15191A;--ink-2:#47514F;--ink-3:#78837F;--rule:#E1E4DE;--rule-2:#EDEFEA;
    --sube:#008C82;--baja:#BE5A18;
    --sube-soft:rgba(0,140,130,.13);--baja-soft:rgba(190,90,24,.13);}}

  body{{background:var(--ground);color:var(--ink);font-family:var(--sans);line-height:1.6;
    -webkit-font-smoothing:antialiased;}}
  .wrap{{max-width:62rem;margin:0 auto;padding:clamp(1.25rem,3.5vw,2.75rem) clamp(.9rem,3vw,2rem) 4rem;
    display:flex;flex-direction:column;gap:clamp(1.25rem,2.5vw,2rem);}}

  .tape{{display:flex;flex-wrap:wrap;align-items:baseline;gap:.5rem 1.5rem;
    border-bottom:1px solid var(--rule);padding-bottom:1rem;}}
  .tape h1{{font-family:var(--serif);font-size:clamp(1.5rem,3.5vw,2.1rem);font-weight:600;
    margin:0;letter-spacing:-.01em;line-height:1.15;}}
  .tk{{font-family:var(--mono);font-size:.78rem;color:var(--ink-3);letter-spacing:.08em;}}
  .px{{font-family:var(--mono);font-size:clamp(1.4rem,3vw,1.9rem);font-weight:600;
    font-variant-numeric:tabular-nums;margin-left:auto;}}
  .dt{{font-family:var(--mono);font-size:.95rem;font-variant-numeric:tabular-nums;}}
  .up{{color:var(--sube);}} .dn{{color:var(--baja);}}

  .tiras{{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:.75rem;}}
  .tira{{background:var(--panel);border:1px solid var(--rule);border-radius:3px;
    padding:.7rem .85rem;display:flex;flex-direction:column;gap:.2rem;}}
  .tira .k{{font-family:var(--mono);font-size:.66rem;letter-spacing:.09em;
    text-transform:uppercase;color:var(--ink-3);}}
  .tira .v{{font-family:var(--mono);font-size:1.15rem;font-weight:600;
    font-variant-numeric:tabular-nums;}}
  .tira .s{{font-size:.76rem;color:var(--ink-3);line-height:1.35;}}

  figure{{margin:0;background:var(--panel);border:1px solid var(--rule);border-radius:3px;
    padding:clamp(.75rem,2vw,1.15rem);display:flex;flex-direction:column;gap:.7rem;}}
  .plot{{overflow-x:auto;}}
  .plot svg{{display:block;width:100%;height:auto;min-width:min(100%,32rem);}}
  figcaption{{font-size:.8rem;color:var(--ink-3);line-height:1.5;margin:0;}}
  .legend{{display:flex;flex-wrap:wrap;gap:.35rem 1.1rem;font-family:var(--mono);
    font-size:.7rem;color:var(--ink-2);}}
  .legend span{{display:inline-flex;align-items:center;gap:.35rem;}}
  .sw{{width:.65rem;height:.65rem;border-radius:2px;flex-shrink:0;}}

  text{{font-family:var(--mono);fill:var(--ink-3);}}
  .lbl{{font-size:11px;}} .val{{font-size:11.5px;fill:var(--ink-2);}}
  .val-b{{font-size:11.5px;font-weight:600;}}
  .grid{{stroke:var(--rule-2);stroke-width:1;}}
  .zero{{stroke:var(--ink-3);stroke-width:1;opacity:.5;}}

  h2{{font-family:var(--serif);font-size:1.25rem;font-weight:600;margin:0;letter-spacing:-.01em;}}
  .movs{{display:flex;flex-direction:column;gap:0;background:var(--panel);
    border:1px solid var(--rule);border-radius:3px;overflow:hidden;}}
  .mov{{display:grid;grid-template-columns:5.5rem 4.5rem 1fr;gap:.75rem;align-items:baseline;
    padding:.6rem .85rem;border-bottom:1px solid var(--rule-2);font-size:.86rem;}}
  .mov:last-child{{border-bottom:none;}}
  .mov .f{{font-family:var(--mono);font-size:.74rem;color:var(--ink-3);}}
  .mov .c{{font-family:var(--mono);font-weight:600;font-variant-numeric:tabular-nums;}}
  .mov .q{{color:var(--ink-2);line-height:1.45;}}
  .mov .nada{{color:var(--ink-3);font-style:italic;}}
  .fam{{font-family:var(--mono);font-size:.64rem;letter-spacing:.06em;text-transform:uppercase;
    color:var(--ink-3);display:block;margin-top:.15rem;}}

  .niv{{width:100%;border-collapse:collapse;font-family:var(--mono);font-size:.82rem;
    font-variant-numeric:tabular-nums;}}
  .niv th,.niv td{{padding:.42rem .6rem;border-bottom:1px solid var(--rule-2);
    text-align:right;white-space:nowrap;color:var(--ink-2);}}
  .niv th{{color:var(--ink-3);font-weight:500;font-size:.68rem;letter-spacing:.07em;
    text-transform:uppercase;}}
  .niv td:first-child,.niv th:first-child{{text-align:left;}}
  .niv tr.medio td{{color:var(--ink);font-weight:600;
    border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);}}
  .niv tr:last-child td{{border-bottom:none;}}
  .aviso{{background:var(--baja-soft);border-left:2px solid var(--baja);
    padding:.6rem .8rem;font-size:.84rem;color:var(--ink-2);border-radius:2px;}}
  .nota{{background:var(--panel);border:1px solid var(--rule);border-radius:3px;
    padding:clamp(.85rem,2vw,1.2rem);display:flex;flex-direction:column;gap:.6rem;
    font-size:.88rem;color:var(--ink-2);}}
  .nota b{{color:var(--ink);}}
  .nota ul{{margin:0;padding-left:1.1rem;display:flex;flex-direction:column;gap:.45rem;}}
  footer{{border-top:1px solid var(--rule);padding-top:1rem;font-size:.8rem;color:var(--ink-3);}}

  #tip{{position:fixed;z-index:9;pointer-events:none;opacity:0;transition:opacity .1s;
    background:var(--ink);color:var(--ground);font-family:var(--mono);font-size:.72rem;
    line-height:1.45;padding:.4rem .55rem;border-radius:3px;max-width:17rem;
    box-shadow:0 4px 14px rgba(0,0,0,.18);}}
  #tip.on{{opacity:1;}}
  [data-tip]{{cursor:crosshair;}}
  @media (prefers-reduced-motion:reduce){{*{{transition:none!important;}}}}
</style>

<div class="wrap">
  <div class="tape">
    <div>
      <h1>{nombre}</h1>
      <span class="tk">{ticker} · {sector} · rueda {rueda}</span>
    </div>
    <div class="px {clase_dia}">S/{precio}</div>
    <div class="dt {clase_dia}">{var_dia}</div>
  </div>

  <div class="tiras">{tiras}</div>

  <figure>
    <div class="legend">
      <span><span class="sw" style="background:var(--sube)"></span>subió</span>
      <span><span class="sw" style="background:var(--baja)"></span>bajó</span>
      <span style="color:var(--ink-3)">◆ rueda con hecho de importancia publicado</span>
    </div>
    <div class="plot" id="p-precio"></div>
    <figcaption>Cierres de la BVL, {ruedas} ruedas. Los rombos marcan las ruedas en
      que el mercado ya podía leer un Hecho de Importancia — colocados según la hora
      real de publicación, no según la fecha del archivo. Pasa el cursor por
      cualquier rueda.</figcaption>
  </figure>

  {niveles}

  <figure>
    <div class="plot" id="p-var"></div>
    <figcaption>Variación de cada rueda contra la anterior. Va acá en lugar del
      volumen porque el volumen viejo no existe en el repo: solo se guarda el de hoy.</figcaption>
  </figure>

  <h2>Los movimientos grandes, y qué se había publicado</h2>
  <div class="movs">{movimientos}</div>

  <div class="nota">
    <p><b>De los {grandes} movimientos de {notable}% o más de esta acción en la ventana,
      {con_papel} coincidieron con un Hecho publicado.</b> En toda la BVL la proporción
      es 9%: <b>el 91% de los saltos grandes ocurre sin ningún papel de por medio</b>.
      Por eso, cuando no hay nada, acá dice «no se publicó nada» en vez de buscarle una
      explicación.</p>
    {hipotesis}
  </div>

  <footer>
    Sin velas y sin barras de volumen a propósito: el histórico guarda solo el cierre,
    y el volumen únicamente del día de hoy. Dibujarlos sería inventar los números que
    faltan. Esto no es una recomendación de compra ni de venta.
  </footer>
</div>
<div id="tip" role="status"></div>

<script>
const D = {payload};
const SVGNS="http://www.w3.org/2000/svg";
const el=(n,a={{}},t)=>{{const e=document.createElementNS(SVGNS,n);
  for(const k in a)e.setAttribute(k,a[k]);if(t!=null)e.textContent=t;return e;}};
const nf=(v,d=2)=>(v>=0?"+":"−")+Math.abs(v).toFixed(d);
const MES=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const fecha=f=>`${{+f.slice(8,10)}} ${{MES[+f.slice(5,7)-1]}}`;

const tip=document.getElementById("tip");
const mostrar=(e,html)=>{{tip.innerHTML=html;tip.classList.add("on");
  const r=tip.getBoundingClientRect();
  let x=e.clientX+14,y=e.clientY-r.height-10;
  if(x+r.width>innerWidth-8)x=e.clientX-r.width-14;
  if(y<8)y=e.clientY+18;
  tip.style.left=x+"px";tip.style.top=y+"px";}};
const cebar=(n,html)=>{{n.setAttribute("data-tip","");
  n.addEventListener("pointerenter",e=>mostrar(e,html));
  n.addEventListener("pointermove",e=>mostrar(e,html));
  n.addEventListener("pointerleave",()=>tip.classList.remove("on"));}};

const P=D.puntos,N=P.length;
const globo=q=>{{
  let s=`<b>${{fecha(q.f)}}</b> · S/${{q.p.toFixed(3)}} · ${{nf(q.chg)}}%`;
  q.h.forEach(h=>{{s+=`<br>📄 ${{h.titulo}}`;}});
  q.n.forEach(n=>{{s+=`<br>📰 ${{n.titulo}}`;}});
  if(!q.h.length&&!q.n.length)s+=`<br><span style="opacity:.65">no se publicó nada</span>`;
  return s;}};

/* ── precio ── */
(function(){{
  const W=980,H=390,mL=48,mR=74,mT=74,mB=32;
  const C=D.cono,FUT=C?C.horizonte:0,TOT=N-1+FUT;
  const ps=P.map(q=>q.p);
  const extra=C?[C.p0*(1+C.cond.p90/100),C.p0*(1+C.cond.p10/100)]:[];
  const lo=Math.min(...ps,...extra),hi=Math.max(...ps,...extra);
  const pad=(hi-lo)*.14||.1;
  const y0=lo-pad,y1=hi+pad;
  const x=i=>mL+i*(W-mL-mR)/TOT;
  const y=v=>mT+((y1-v)/(y1-y0))*(H-mT-mB);
  const pasoX=(W-mL-mR)/TOT;
  const s=el("svg",{{viewBox:`0 0 ${{W}} ${{H}}`,role:"img"}});

  const paso=(y1-y0)/4;
  for(let k=0;k<=4;k++){{const v=y0+k*paso;
    s.appendChild(el("line",{{x1:mL,x2:W-mR,y1:y(v),y2:y(v),class:"grid"}}));
    s.appendChild(el("text",{{x:mL-8,y:y(v)+4,class:"lbl","text-anchor":"end"}},v.toFixed(3)));}}
  [0,Math.floor(N/4),Math.floor(N/2),Math.floor(3*N/4),N-1].forEach(i=>
    s.appendChild(el("text",{{x:x(i),y:H-12,class:"lbl",
      "text-anchor":i===0?"start":(i===N-1?"end":"middle")}},fecha(P[i].f))));

  const linea=P.map((q,i)=>`${{i?"L":"M"}}${{x(i)}},${{y(q.p)}}`).join("");
  s.appendChild(el("path",{{d:linea+`L${{x(N-1)}},${{y(y0)}}L${{x(0)}},${{y(y0)}}Z`,
    fill:"var(--sube-soft)"}}));
  s.appendChild(el("path",{{d:linea,fill:"none",stroke:"var(--sube)","stroke-width":2,
    "stroke-linejoin":"round"}}));

  /* ── el cono ──────────────────────────────────────────────────────────
     Solo la rueda 10 está MEDIDA; las intermedias se interpolan por √t, que
     es como se ensancha la dispersión de un precio. Se dibuja así para que se
     lea el ancho, no para fingir que sabemos la rueda 4. */
  if(C){{
    const banda=(qa,qb,op)=>{{
      const arr=[],vol=[];
      for(let k=0;k<=FUT;k++){{
        const f=Math.sqrt(k/FUT);
        arr.push([x(N-1+k),y(C.p0*(1+C.cond[qa]/100*f))]);
        vol.push([x(N-1+k),y(C.p0*(1+C.cond[qb]/100*f))]);
      }}
      const d=arr.map((p,i)=>`${{i?"L":"M"}}${{p[0]}},${{p[1]}}`).join("")+
        vol.reverse().map(p=>`L${{p[0]}},${{p[1]}}`).join("")+"Z";
      s.appendChild(el("path",{{d:d,fill:"var(--ink-3)",opacity:op}}));
    }};
    banda("p90","p10",".12");
    banda("p75","p25",".18");
    const med=[];
    for(let k=0;k<=FUT;k++)med.push([x(N-1+k),y(C.p0*(1+C.cond.p50/100*Math.sqrt(k/FUT)))]);
    s.appendChild(el("path",{{d:med.map((p,i)=>`${{i?"L":"M"}}${{p[0]}},${{p[1]}}`).join(""),
      fill:"none",stroke:"var(--ink-3)","stroke-width":1.5,"stroke-dasharray":"4 3"}}));
    s.appendChild(el("line",{{x1:x(N-1),x2:x(N-1),y1:mT,y2:H-mB,
      stroke:"var(--ink-3)","stroke-width":1,opacity:".5"}}));
    [["p90","var(--sube)"],["p50","var(--ink-2)"],["p10","var(--baja)"]].forEach(([q,col])=>{{
      const v=C.p0*(1+C.cond[q]/100);
      s.appendChild(el("text",{{x:W-mR+6,y:y(v)+4,class:"val-b",fill:col}},v.toFixed(3)));
    }});
    s.appendChild(el("text",{{x:W-6,y:mT-8,class:"lbl","text-anchor":"end"}},
      `80% de los casos, ${{FUT}} ruedas →`));
  }}

  // Las anotaciones se amontonan cuando dos saltos caen cerca (junio tiene tres
  // en dos semanas). Se reparten en tres filas: cada etiqueta busca la primera
  // fila donde su ancho estimado no pise a otra ya colocada.
  const FILAS=[[],[],[]];
  D.notas.forEach(nt=>{{
    const col=nt.chg>=0?"var(--sube)":"var(--baja)";
    const txt=`${{fecha(nt.f)}}  ${{nf(nt.chg)}}%`;
    const ancho=txt.length*6.4+10;
    const anc=nt.i>N*.7?"end":"start";
    const x0=anc==="end"?x(nt.i)-ancho:x(nt.i);
    let fila=FILAS.findIndex(f=>f.every(r=>x0>r[1]||x0+ancho<r[0]));
    if(fila<0)fila=2;
    FILAS[fila].push([x0,x0+ancho]);
    const yl=16+fila*17;
    s.appendChild(el("line",{{x1:x(nt.i),x2:x(nt.i),y1:yl+5,y2:y(P[nt.i].p)-7,
      stroke:col,"stroke-width":1,"stroke-dasharray":"3 3",opacity:".55"}}));
    s.appendChild(el("text",{{x:x(nt.i)+(anc==="end"?-6:6),y:yl,class:"val-b",
      "text-anchor":anc,fill:col}},txt));
    s.appendChild(el("circle",{{cx:x(nt.i),cy:y(P[nt.i].p),r:4,fill:col,
      stroke:"var(--panel)","stroke-width":2}}));
  }});

  P.forEach((q,i)=>{{
    if(q.h.length){{
      const yy=y(q.p)-14;
      const d=el("path",{{d:`M${{x(i)}},${{yy-5}}L${{x(i)+5}},${{yy}}L${{x(i)}},${{yy+5}}L${{x(i)-5}},${{yy}}Z`,
        fill:"var(--ink-3)",stroke:"var(--panel)","stroke-width":1}});
      s.appendChild(d);
    }}
    const hit=el("rect",{{x:x(i)-pasoX/2,y:mT-48,width:pasoX,
      height:H-mT-mB+48,fill:"transparent"}});
    cebar(hit,globo(q));
    s.appendChild(hit);
  }});
  document.getElementById("p-precio").appendChild(s);
}})();

/* ── variación diaria ── */
(function(){{
  const W=980,H=170,mL=48,mR=16,mT=16,mB=26;
  const mx=Math.max(...P.map(q=>Math.abs(q.chg)),4);
  const x=i=>mL+i*(W-mL-mR)/(N-1);
  const y=v=>mT+((mx-v)/(2*mx))*(H-mT-mB);
  const s=el("svg",{{viewBox:`0 0 ${{W}} ${{H}}`,role:"img"}});
  [mx,0,-mx].forEach(v=>{{
    s.appendChild(el("line",{{x1:mL,x2:W-mR,y1:y(v),y2:y(v),
      class:v===0?"zero":"grid"}}));
    s.appendChild(el("text",{{x:mL-8,y:y(v)+4,class:"lbl","text-anchor":"end"}},
      nf(v,0)+"%"));}});
  const w=Math.max((W-mL-mR)/N-1.5,1.2);
  P.forEach((q,i)=>{{
    const col=q.chg>=0?"var(--sube)":"var(--baja)";
    const alto=Math.abs(y(q.chg)-y(0));
    const r=el("rect",{{x:x(i)-w/2,y:Math.min(y(q.chg),y(0)),width:w,
      height:Math.max(alto,.8),fill:col,opacity:Math.abs(q.chg)>=4?"1":".55",rx:1}});
    cebar(r,globo(q));
    s.appendChild(r);}});
  document.getElementById("p-var").appendChild(s);
}})();
</script>
"""


def tira(k, v, s, clase=''):
    return (f'<div class="tira"><span class="k">{k}</span>'
            f'<span class="v {clase}">{v}</span><span class="s">{s}</span></div>')


def render(d):
    P = d['puntos']
    ult, prev = P[-1], P[-2]
    clase = 'up' if ult['chg'] >= 0 else 'dn'
    ventana_pct = (ult['p'] / P[0]['p'] - 1) * 100
    ps = [q['p'] for q in P]

    tiras = [
        tira('en la ventana', f'{ventana_pct:+.1f}%',
             f'de S/{P[0]["p"]:.3f} a S/{ult["p"]:.3f}',
             'up' if ventana_pct >= 0 else 'dn'),
        tira('rango', f'{min(ps):.3f}–{max(ps):.3f}',
             f'{len(P)} ruedas de cierre'),
        tira('movimiento típico', f'±{d["vol"]:.2f}%',
             'desviación de las últimas 20 ruedas'),
        tira('saltos ≥4%', f'{d["grandes"]}',
             f'{d["con_papel"]} con un hecho publicado'),
    ]
    if d['ultimo_hecho']:
        u = d['ultimo_hecho']
        sub = (f'tasa base: {d["base10"]:+.2f}% a 10 ruedas, '
               f'{d["base10_gana"]}% en verde (n={d["base_n"]})'
               if d['base10'] is not None else 'sin tasa base medida')
        tiras.append(tira('último hecho', u['fam'], f'{u["fecha"]} · {sub}'))

    movs = []
    for n in d['notas']:
        c = 'up' if n['chg'] >= 0 else 'dn'
        if n['que']:
            que = (f'<span class="q">{n["que"]}'
                   + (f'<span class="fam">{n["fam"]}</span>' if n['fam'] else '')
                   + '</span>')
        else:
            que = ('<span class="q nada">no se publicó nada ese día — '
                   'ni hecho ni titular</span>')
        movs.append(f'<div class="mov"><span class="f">{n["f"]}</span>'
                    f'<span class="c {c}">{n["chg"]:+.2f}%</span>{que}</div>')

    hip = ''
    for e in d['etiquetas']:
        h = e['hipotesis']
        hip += (f'<p>📒 <b>Hipótesis abierta en el cuaderno</b> — anotada el '
                f'{e["fecha"]} con precio de referencia S/{h.get("precio_ref", "?")}: '
                f'dice «<b>{h["direccion"]}</b>» a {h["ruedas"]} ruedas. Se puntúa sola '
                f'contra el precio, gane o pierda. Corre '
                f'<code>python laboratorio/etiquetas.py</code> para ver el marcador.</p>')

    niveles = ''
    C = d['cono']
    if C:
        p0 = C['p0']
        filas = []
        for q, etq in (('p90', '9 de cada 10 quedaron por DEBAJO de'),
                       ('p75', '3 de cada 4 por debajo de'),
                       ('p50', 'la mitad por encima, la mitad por debajo'),
                       ('p25', '1 de cada 4 por debajo de'),
                       ('p10', '1 de cada 10 por debajo de')):
            cl = ' class="medio"' if q == 'p50' else ''
            filas.append(
                f'<tr{cl}><td>{etq}</td>'
                f'<td>S/{p0*(1+C["cond"][q]/100):.3f}</td>'
                f'<td>{C["cond"][q]:+.2f}%</td>'
                f'<td>S/{p0*(1+C["propia"][q]/100):.3f}</td>'
                f'<td>{C["propia"][q]:+.2f}%</td></tr>')
        niveles = f'''<figure>
    <table class="niv">
      <thead><tr><th>a {C['horizonte']} ruedas desde S/{p0:.3f}</th>
        <th colspan="2">situaciones parecidas (n={C['cond_n']})</th>
        <th colspan="2">su propia historia (n={C['propia_n']})</th></tr></thead>
      <tbody>{''.join(filas)}</tbody>
    </table>
    <div class="aviso"><b>El centro de este cono no dice nada.</b> La prueba nula
      lo deja en «{C['veredicto']}»: un grupo de ruedas al azar del mismo pozo dio
      una mediana de {C['azar_mediana']:+.2f}%, prácticamente lo mismo. Lo que el
      cono sí dice es el <b>ancho</b>: ese es el rango en que esta acción se movió,
      y es la parte que sirve para dimensionar una posición.</div>
    <figcaption>Percentiles de lo que pasó en los casos históricos, aplicados al
      precio de hoy. No es un pronóstico: es dónde terminó el precio las veces
      anteriores. De los {C['cond_n']} casos parecidos, {C['sube']}% terminaron
      por encima del precio de partida.</figcaption>
  </figure>'''

    payload = json.dumps({'puntos': P, 'notas': d['notas'], 'cono': d['cono']},
                         ensure_ascii=False, separators=(',', ':'))
    return PLANTILLA.format(
        niveles=niveles,
        nombre=d['nombre'], ticker=d['ticker'], sector=d['sector'],
        rueda=ult['f'], precio=f'{ult["p"]:.3f}',
        var_dia=f'{ult["chg"]:+.2f}%', clase_dia=clase,
        ruedas=len(P), tiras=''.join(tiras), movimientos=''.join(movs),
        grandes=d['grandes'], con_papel=d['con_papel'], notable=int(NOTABLE),
        hipotesis=hip, payload=payload)


if __name__ == '__main__':
    tk = sys.argv[1] if len(sys.argv) > 1 else 'VOLCABC1'
    ven = int(sys.argv[2]) if len(sys.argv) > 2 else VENTANA
    d = construir(tk, ven)
    if not d:
        print(f'{tk}: no está entre las acciones que se negocian.')
        sys.exit(1)
    destino = os.path.join(AQUI, f'grafico-{tk}.html')
    with open(destino, 'w', encoding='utf-8') as f:
        f.write(render(d))
    print(f'✅ {destino}')
    print(f'   {d["nombre"]} · {len(d["puntos"])} ruedas · '
          f'{d["grandes"]} saltos ≥{NOTABLE}% · {d["con_papel"]} con hecho publicado')
    for n in d['notas']:
        print(f'   {n["f"]}  {n["chg"]:+6.2f}%  ' +
              (n['que'][:66] if n['que'] else '— no se publicó nada'))
