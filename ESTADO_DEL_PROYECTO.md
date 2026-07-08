# ESTADO DEL PROYECTO — ALTO Research (app educativa BVL)

> **Documento maestro vivo.** Captura TODO lo construido para que nada se pierda, sin
> importar la ventana de contexto. Si retomas el proyecto (tú, yo en otra sesión, u otra
> herramienta), lee esto primero. Última actualización: **08 jul 2026**. Estado: **EN VIVO (beta pública)**.

## ⛏️ PRODUCCIÓN MINERA MENSUAL (MINEM/BEM) EN LAS FICHAS DE MINAS (08-jul-2026, Fable)
- **Pedido de Jair:** gráficos de producción mensual por metal (estilo líneas con puntos, su imagen
  de referencia) en el "apartado de minas", ene-2025 → abr-2026, con las minas/participaciones de
  cada empresa abajo (quién controla qué, %, si cotizan y dan dividendos).
- **Fuente NUEVA (la pasó Jair): MINEM — Boletín Estadístico Minero** (receta completa en
  `extractor/FUENTES.md`). El cuadro S01.C02 de cada edición trae producción POR EMPRESA del mes
  (top ~10 por metal + OTROS) para el año de la edición Y el año anterior → 12 Excels
  (prepublicaciones jul25-abr26 + anexos may/jun25) arman la serie ene-2025→abr-2026 completa.
- **Nuevo `extractor/fetch_bem.py`** → `app/src/data/mineria.json` (16 entidades, 37 series).
  Caché en `extractor/cache_bem/` (committeada — el robot no re-descarga); auto-descubre ediciones
  nuevas en la colección de gob.pe; NO reescribe el JSON si el BEM no publicó nada (el robot no
  commitea ruido). Sumado a `actualizar_todo.py` (incluido `--rapido`). gob.pe pide UA de navegador.
- **Nuevo `app/src/data/mineria_familia.json` (MANUAL, verificado 08-jul):** por ticker minero:
  entidades BEM a graficar, sus minas y participaciones con %: BVN (Cerro Verde 19.58%, Brocal
  61.43%, La Zanja 100% —Newmont se la cedió—, Coimolache 40.09%; **vendió Yanacocha a Newmont
  2022 por US$300M**), Minsur (San Rafael + Pucamarca + **Marcobre/Mina Justa 60%**), Nexa
  (Cerro Lindo + El Porvenir + Atacocha 62.89%B/99.36%A), Volcan (Yauli + Chungar + Adm. Cerro,
  que absorbió Óxidos de Pasco oct-2023), Shougang (~98.5% de Shougang Corp; **Shouxin 49%**,
  relaves de Marcona), Corona (Sierra Metals 81.84% → **comprada por Alpayana 2025**, OPA por
  Corona anunciada), Santa Luisa (grupo Mitsui ~70/30), SPCC (sucursal 100% de SCCO). Sin
  producción con explicación honesta: PML/PPX/Andex (juniors), Perubar (ya no mina, almacenes),
  SIMSA (bajo el top del BEM).
- **Nuevo `ProduccionMinera.jsx`** en la ficha (solo sector minas, entre Tips y Fundamentos):
  un mini-gráfico por metal (unidades no se mezclan: TMF / g finos / kg finos), grilla punteada,
  líneas con puntos y color POR ENTIDAD consistente entre gráficos (ej. Minsur dorado = estaño,
  Marcobre azul = cobre), leyenda cuando la ficha tiene 2+ entidades (Nexa muestra Cerro Lindo +
  El Porvenir; Volcan sus 3). **Huecos honestos**: mes sin punto = no apareció en el top (produjo
  poco o nada — "no se inventa un cero"); metales con <3 datos van como texto puntual (el estaño
  real de BVN oct-2025: 17.9 TMF — verificado en el Excel crudo). Abajo: "Sus minas" +
  "Participaciones (quién tiene qué)" con links a las fichas que cotizan y si dan dividendos
  (afirmaciones respaldadas por nuestro dividendos.json). Escala desde 0 (no exagera).
- **Términos 164 → 172**: TMF, gramos finos, kg finos, MINEM, relaves, OPA, molibdeno, bismuto.
- Verificado en preview (desktop + 375px sin desborde, consola limpia), auditorías 0 problemas,
  build PWA OK.

## 🔧 FIXES POST-LANZAMIENTO (05–08 jul 2026, Opus)
- **Robot ya no falla al subir ("fetch first"):** el paso "Commit de los datos frescos" del workflow ahora hace
  `git pull --rebase -X theirs origin main` ANTES del `git push`. Antes, si otro commit llegaba mientras el robot
  trabajaba, el push se rechazaba. Se configuró también la identidad de git en el repo (evita el error
  "unable to auto-detect email" durante la rebase). Los runs nocturnos 07 y 08-jul quedaron verdes.
- **PWA auto-actualizable (bug "la web no se actualiza"):** el síntoma era que el navegador mostraba la versión
  cacheada vieja hasta la 2ª recarga. **NO era el pipeline** (el servidor SIEMPRE tenía lo último — verificar con
  `curl` del bundle, no confiar en el navegador). `app/src/main.jsx` ahora registra el Service Worker con
  `registerSW({immediate:true})` + chequeo de versión al cargar / al volver a la pestaña (`visibilitychange`) /
  cada 5 min → aplica y recarga sola. Para un navegador con la versión vieja pegada: **Ctrl+Shift+R** una vez.
- **Analítica de visitas (GoatCounter):** script en `app/index.html`, panel en **altoresearch.goatcounter.com**
  (correo `altoresearch1@gmail.com`). Privada, sin cookies, gratis. Cuenta a los visitantes reales (ignora
  localhost y a veces la bloquea un adblocker propio — probar en incógnito/celular).
- **NEXA — catalizador Boliden-Votorantim (verificado con MINING.COM/Mining Journal/RTTNews/StockTitan):** Boliden
  confirmó el 02-jul que está en CONVERSACIONES para comprarle a Votorantim su participación de control (~65%) en
  Nexa (~US$1,300M). SIN acuerdo/precio/fecha. Agregado a `catalizadores.json` (NEXAPEC1) con honestidad (Regla #7).
- **Pendientes de Jair:** número de Yape (`config.json`→`apoyo.yapeNumero`); video promo TikTok (quedó a medias:
  QR con Python `qrcode` + placa final vertical PIL + guion sin voz con "GRATIS"); agregar ETFs/empresas cuando pida.

## 🚀 LANZADA (03-jul-2026) — EN VIVO + robot diario en la nube
- **URL EN VIVO:** **https://altoresearch1-arch.github.io/** (HTTPS forzado por GitHub Pages).
- **Cuenta GitHub:** `altoresearch1-arch`. **Repo (público):** `altoresearch1-arch/altoresearch1-arch.github.io`
  (mismo nombre que el usuario → URL raíz limpia = sitio de usuario). Esta PC ya tiene `origin` + credencial (GCM):
  `git push origin main` publica. Rama = `main`. `.gitignore` de raíz creado (excluye node_modules/dist/
  settings.local.json/__pycache__/secretos). Auditorías estructural + total en 0 problemas antes de subir.
- **ROBOT DIARIO** = `.github/workflows/deploy.yml`, cron `0 3 * * 2-6` UTC = **Lun–Vie 22:00 Perú** (tras el cierre
  BVL). Dos jobs: `actualizar-datos` (corre `extractor/actualizar_todo.py --rapido`, commitea los JSON frescos con
  `[skip ci]`) y `desplegar` (build PWA + publica en Pages). En `push` solo despliega. La PC NO se prende.
  Deps: `extractor/requirements.txt` (requests/bs4/lxml). Botón "Run workflow" para correrlo a mano.
- **`--rapido` (nuevo 03-jul):** el nocturno SALTA `fetch_anual_eps`+`fix_eps` (SMV). El EPS anual 2025 es ESTÁTICO
  y el SMV es LENTO/flaky desde la nube (el run completo se quedó 20+ min en ese paso). El `--rapido` corre solo
  BVL/stockanalysis en **~9 min**. El EPS se refresca con `--trimestral` o el comando completo local. **VALIDADO
  EN VIVO:** run `--rapido` verde en 9 min → commiteó datos frescos del 03-jul y desplegó.
- **Config GitHub aplicada:** Pages source = "GitHub Actions"; Actions → Workflow permissions = "Read and write"
  (el robot necesita write para commitear datos).
- **VERIFICADO en vivo:** el robot corre desde runners de EE.UU. y la BVL responde (bajó 767 cotizaciones con fecha
  de hoy). Deploy en push OK (~37s). NOTA: el 1er deploy de un sitio Pages nuevo puede fallar 1-2 veces
  ("Deployment failed, try again later" = backend provisionándose) → reintentar con un run NUEVO (no re-run del
  mismo run: colisiona por 2 artifacts "github-pages"). Riesgo a vigilar: `fetch_anual_eps` toca el SMV (flaky
  desde la nube); si `actualizar-datos` falla una noche, no se redespliega pero el sitio queda con los últimos datos.
- **mensajeDia** de hoy: "La constancia supera al talento." (Jair lo edita en `app/src/data/config.json`).
- **PENDIENTE de Jair:** número de Yape (`config.json` → `apoyo.yapeNumero`, hoy vacío; el QR ya está).

## 🎯 PRÓXIMA SESIÓN — 3 prioridades antes de lanzar (pedido de Jair, 03-jul)
Jair abrirá otra sesión enfocada en: **(1) cazar bugs, (2) reforzar seguridad, (3) LANZAR.** Contexto para arrancar:
- **BUGS a revisar / que NO son bugs:** los errores de consola tipo `[hmr] Failed to reload …` que se ven
  en el dev server **NO son bugs** — salen cuando los scripts de Python escriben los JSON mientras Vite
  intenta recargar en caliente; se limpian **reiniciando el dev server**. La app renderiza bien (verificado
  ficha por ficha). Zonas a QA manual: las 114 fichas + responsive móvil (375px), el flujo del quiz, y las
  fichas `sin_documentos` (AUNA/SCCO/PML/PPX/Pucalá) que muestran solo precio+HI+dividendos. Correr
  `python extractor/auditoria.py` y `python extractor/auditoria_total.py` (ambas en 0 problemas al 03-jul).
- **SEGURIDAD (superficie chica, es estático):** la app es **React estático sin backend, sin login, sin
  datos de usuario, sin secretos en el cliente**. Datos = JSON públicos educativos. Puntos a cerrar antes
  de publicar: (a) que NO haya llaves/tokens en el repo (el extractor solo usa APIs públicas BVL/SMV/
  stockanalysis, sin auth); (b) hosting con **HTTPS**; (c) si se usa GitHub Actions, el `GITHUB_TOKEN` con
  permisos mínimos (solo push a la rama de deploy); (d) el modal de Apoyo tiene Yape/PayPal (info pública,
  ok); (e) headers básicos (CSP) los pone el hosting (Netlify/Cloudflare/Pages). No hay CORS ni cookies.
- **LANZAR:** hosting estático (GitHub Pages / Netlify / Cloudflare Pages, gratis) + **robot diario con
  GitHub Actions** que corre `fetch_precios` → `fetch_historicos` → `fetch_hechos` → `div_stockanalysis`
  → `fetch_beneficios` → `fetch_anual_eps` → `fix_eps` → `npm run build` y redeploya. La PC de Jair NO
  necesita estar prendida (la nube lo corre). PROBAR primero que los scripts corran desde los runners de
  GitHub (EE.UU.): BVL/stockanalysis/TC son APIs y deberían andar; el SMV (solo trimestral) puede ser
  flaky → ese se corre a mano. Falta de Jair: cuenta GitHub + elegir hosting + **número de Yape** para
  el botón "copiar número" (el QR ya está en `config.json`).

## ⭐ PULIDO UI FINAL (03-jul-2026, Opus) — moneda anti-estrés + header + dividendos
- **Moneda anti-estrés (guiño al coin de Team Fortress 2):** el **logo gigante del inicio ES la moneda**:
  al clickarlo salta, se da la vuelta (flip 3D `rotateX`) y suena un "cling" **sintetizado con Web Audio**
  (cero archivos). Componente `app/src/components/MonedaFidget.jsx` (reemplaza al `<img>` del hero en
  App.jsx). El giro va sobre el WRAP para no chocar con la animación `auraLogo` (respira) del logo. Sin
  contador de giros (Jair lo pidió quitar). El sonido solo suena con clic REAL de mouse (política de audio
  del navegador). Respeta prefers-reduced-motion.
- **Header transparente:** el `.topbar` era sticky con fondo `rgba(10,10,10,0.72)`+blur → esa banda oscura
  era la "línea negra que desentonaba". Ahora `background: transparent` (styles.css). Nota: al ser
  transparente + sticky, el contenido pasa levísimamente por detrás al hacer scroll (aceptado por Jair;
  alternativas si molesta: blur suave sin color, o quitar el sticky).
- **Gráfico de dividendos:** los números de las barras (2025 vs 2026) chocaban con el título; se subió la
  altura del contenedor (100→128px, anclaje abajo) en `DividendoGrafico.jsx` → los números bajan con aire.
  Y el bloque del anuncio (📌/⚠️) se separó del gráfico (marginBottom 22 en `DividendoResumen.jsx`).

## ⭐ AUNA (PILOTO MERCADO AMERICANO) + PPX + "MUY ALTA VOLATILIDAD" (03-jul-2026, Opus) — **114 valores**
- **AUNA = primer paso a EE.UU.** (pedido de Jair). No presenta XBRL individual a la SMV porque cotiza
  en NYSE; sus datos salen de su reporte CONSOLIDADO (SEC/IR), no de la SMV. Traídos de la web y
  CONFIRMADOS: grupo de SALUD (hospitales/clínicas/oncología) en Perú, Colombia y México; ingresos 2025
  **S/4,385M**, EBITDA ajustado **~21%**, **FCF S/582M (+35%)**, EPS $1.32, pero **apalancamiento 3.6x**
  (su gran riesgo, plan bajarlo debajo de 3x); reporta en SOLES aunque su acción se compra en US$ en NYSE;
  no reparte dividendos. Tesis/tips/catalizadores/escenarios reescritos con esos números. (Se corrigió el
  tip viejo que decía "reporta en dólares" — es SOLES.) **Pendiente**: integrar sus fundamentos consolidados
  al esquema `empresas.json` (hoy siguen como sin_documentos; los números viven en la tesis/tips).
- **PPX (nuevo, +1): PPX Mining Corp** — junior de oro/plata (proyecto Igor, La Libertad), penny stock
  US$0.14 (SÍ negocia). sin_documentos (emisor extranjero) → solo HI. tesis/tips con **MUY ALTA VOLATILIDAD**.
- **"MUY ALTA VOLATILIDAD" a SCCO/PML/Pucalá/PPX** (pedido de Jair): aviso ⚠️ como primer tip. Calibrado y
  HONESTO: PML/PPX/Pucalá son apuestas especulativas de verdad; **SCCO** es un gigante estable, así que su
  aviso dice que es la acción LOCAL (BVL) la que casi no negocia y tiene precio errático (la de referencia
  es la de Nueva York) — no se le miente llamando volátil a la empresa.

## ⭐ TANDA 10 + TIPS RICOS + AUDITORÍA TOTAL (03-jul-2026, Opus) — **113 valores**
- **TANDA 10 (11, 102 → 113), las últimas relevantes** (verificado en BVL que el mercado peruano ya
  queda cubierto): **estatales** Petroperú (petrolera, deuda US$5,070M por Talara, NO paga dividendos),
  SEDAPAL (agua de Lima, monopolio natural), COFIDE (banca de 2º piso) → diversas/bancos; **eléctricas**
  Electrosur, Electro Sur Este (regionales estatales); **infraestructura** Red Vial 5/Norvial (peaje,
  gran pagadora trimestral), Inca Rail (tren a Machu Picchu, dejó de pagar tras caída del turismo);
  **industriales** IEQSA (aluminio, en pérdida Q1), Paramonga (azúcar/papel → alimentos); Compartamos
  (microfinanzas, Gentera → bancos); La Positiva Vida (seguros vida, hermana de La Positiva → diversas).
  Casi todas sin precio (no negocian) → ficha con fundamentos+dividendos. Con tesis/tips/catalizadores/
  escenarios. Petroperú extrajo OK (no sin_documentos). **El mercado peruano líquido/relevante queda
  esencialmente agotado**: lo que sobra son liquidaciones, subsidiarias de bancos extranjeros que no
  cotizan, aseguradoras chicas y agro en crisis (ver scan en el chat).
- **TIPS ENRIQUECIDOS a ~7-9 por empresa** (pedido de Jair "5-10 datos por empresa"): `enrich_tips.py`
  agregó 226 tips con DATOS CONFIRMADOS (P/E vs rango del sector, yield+frecuencia del dividendo, deuda,
  FCF, margen, liquidez real, moneda) — cero invención, sin duplicar lo que ya decía cada tip. Promedio
  5.0 → 7.0. Formato pulido (S/ 1,649 M) y frase de liquidez "0 días" reescrita.
- **TÉRMINOS 112 → 160** (barrido QUIRÚRGICO de las 113 fichas): +40 con escaneo sistemático (comisión,
  tasas de interés, regulado, tarifa, bono, flujo de caja, estacional, VAD, afiliados, mora, corto/largo
  plazo, Osinergmin, tipo de cambio, NYSE, ADR, cartera, colocaciones, refinería, ley del mineral,
  inflación, Indecopi, dumping, SUNASS, impago, cobertura, arancel, peaje, concesión, banca de 2º piso,
  monopolio natural, zafra, galvanizado, refinación, estados individuales, fecha de corte, reaseguros…).
  Segundo pase por frecuencia confirmó que lo que queda sin glosar son palabras comunes (se paró ahí a
  propósito: quirúrgico, no invasivo).
- **NUEVO `extractor/auditoria_total.py`** (auditoría profunda de coherencia, más allá de la estructural):
  placeholders reales, contradicciones tesis↔dividendos, tips duplicados/pobres, sectores rotos, P/E,
  términos vacíos. **Resultado final: 0 problemas serios, 55 avisos legítimos** (4 sin_documentos + ~24
  sin precio + 3 P/E fuera de rango explicados + yields>20% que la app avisa sola). El detector se afinó
  tras un primer run con falsos positivos ("dependiente"≠placeholder; "no reparte"≠afirmar que paga).
- **Auditoría estructural (`auditoria.py`): 0 problemas en las 113.** Navegador: consola LIMPIA, fichas
  (incl. tanda 10) renderizan con tips ricos y tooltips. Reparto sectores: minas 16, diversas ~30,
  alimentos 12, bancos ~11, eléctricas 12, AFP 4, fondos 4, resto igual.

## ⭐ TANDA 9 + SECTOR AFP + CONTEXTO (03-jul-2026, Opus) — **102 valores**
- **TANDA 9 (13, 89 → 102), las relevantes que faltaban** (pedido de Jair: "no líquidas pero
  dividendos bestiales"). El scan por liquidez las había saltado porque no negocian reciente
  (precio None), pero SÍ pagan dividendos y tienen estados SMV. **Bancos (+4):** Mibanco (microfinanzas
  #1 de LatAm, Credicorp 98.65%), BanBif (grupo Fierro/IFC), Banco Falabella (grupo Falabella, hermano
  de Saga/Inverfal), Banco Ripley. **Seguros:** Interseguro (líder rentas vitalicias ~30%, Intercorp)
  → diversas. **Eléctricas (+3):** Electroperú (la gran generadora estatal, Mantaro ~12% del país),
  Electro Dunas, San Gabán. **Diversas:** Los Portales (inmobiliaria grupo Raffo; ya NO tiene
  estacionamientos, los vendió a Apparka en 2023). **AFP (SECTOR NUEVO, +4):** Prima (Credicorp),
  Integra (#1, Sura), Profuturo (Scotiabank, ganó la licitación SBS = todos los afiliados nuevos
  hasta 2027), Habitat (la más chica y barata, chilena). Casi todas SIN precio (no negocian) → la
  ficha muestra fundamentos + dividendos, sin precio (honesto, Regla #1).
- **SECTOR "afp" integrado ENTERO** (como "fondos"): escenarios (movimiento+condiciones+notaSector,
  SIN rangoPE a propósito — no se leen por P/E), guía "cómo leer una AFP" (comisión, fondo administrado,
  afiliados, riesgo regulatorio, encaje), quiz (opción + sectorTip), ORDEN_SECTORES en Explorar/Resultados.
- **INSIGHT "retiros de AFP → la BVL cae" (pedido de Jair, VERIFICADO en prensa):** para pagar los
  retiros, las AFP (≈19% de su cartera son acciones) VENDEN, y como la bolsa es ilíquida tumban precios;
  Renta4 marcó mineras/eléctricas/constructoras como las más golpeadas. Se agregó como riesgo DOBLE en
  las 4 AFP (encoge el fondo del que cobran + las obliga a vender) y como aviso en las mineras grandes
  (BVN, Cerro Verde, Volcan, Minsur, Brocal): "presión temporal de mercado, NO cambio del negocio".
- **CONTEXTO extra con investigación web (pedido de Jair "que la gente se enganche"):** Quimpac (único
  productor integrado de SAL del Perú, ~400 mil ton/año), Electroperú (Mantaro prende ~1 de cada 8 focos
  del país), Mibanco (microfinanzas #1 de LatAm), Interseguro (líder rentas vitalicias), **Hidrostal
  (empresa PERUANA que INVENTÓ la bomba de tornillo helicoidal, patente 1961, hoy en +100 países; nació
  para bombear peces vivos en la pesca)**, Eternit (techos/tanques del Perú por +50 años; dejó el ASBESTO
  en 2017), y dato distintivo en cada AFP. Términos: 102 → 112 (AFP, retiro de AFP, SBS, rentas
  vitalicias, microfinanzas, banca de consumo, hidrología, habilitación urbana, encaje).
- **Auditoría: 0 problemas estructurales en las 102** (sector afp OK); 38 avisos (casi todos "sin precio"
  esperados + yields/PE conocidos). Verificado en navegador: Explorar "102 empresas" + chip AFP, ficha AFP
  con tooltips AFP/SBS + riesgo retiro, BVN con aviso de retiros.
- PENDIENTE (de Jair): agregar más contexto web al resto de empresas nuevas (Perubar, BanBif, Banco
  Falabella/Ripley, Mapfre, Pacífico, Pichincha, Proempresa, Inverfal, Futura, IDE, Electro Dunas, San
  Gabán) — se hicieron las de mejor gancho primero.

## ⭐ TANDA 8 + TOOLTIPS AMPLIADOS + PROPIEDAD (02-jul-2026, Opus) — **89 valores**
- **TANDA 8 (4, 85 → 89), nombres locales con estados SMV:** FPROEMP1 (Financiera Proempresa,
  microfinanzas SBS → bancos), INVFALC1 (Inverfal Perú, holding del grupo Falabella, `esHolding`
  → diversas), FUTURAI1 (Futura Consorcio Inmobiliario) e IIDEI1 (Inmobiliaria IDE) → diversas.
  Todas ilíquidas, datos SMV/BVL/EPS confirmados, con tesis/tips/catalizadores/escenarios.
  Dividendos verificados: Inverfal paga ~4.6% (holding, US$), Inmob. IDE ~13% regular, Futura
  algunos años (S/0.22 en 2025), Proempresa nada desde 2020. FPROEMP1 P/E 94 es REAL (2025 flojo,
  Q1 2026 repuntó) — explicado en tip/catalizador. Auditoría: 0 problemas estructurales, 14 avisos
  conocidos. condicionesEmpresa 11 → 15.
- **TOOLTIPS (Glosado) AMPLIADOS — pedido de Jair ("la gente que abre por primera vez se espanta"):**
  (a) **AHORA pasan por `Glosado` TODOS los textos de la ficha, arriba y abajo** (pedido de Jair
  "no dejes nada"): tesis, tips, intro de la guía, escenarios, riesgos y el fallback de catalizadores
  (antes esos NO tenían tooltip). Fundamentos/balance/guía-métricas/catalizadores ya lo tenían.
  (b) **`terminos.json` 57 → 102 términos** (+45): holding, resultado/utilidad operativa, cíclico,
  siniestralidad, primas, junior, ETF, FIBRA, penny stock, dividendo extraordinario, polimetálica,
  autoconstrucción, acción de inversión, patrimonio negativo, refinanciar, apalancamiento,
  desapalancar, antidumping, provisión/provisionar/sin provisionar, **streaming** + **step-down**
  (contrato de Nexa), free float, flotante, ramp-up, CET1, subsidiaria, filial, matriz, y los de
  CONTEXTO que pidió Jair: **cascarón bursátil**, **Bayóvar**, **fosfatos**, **SUNAT**,
  **controversia tributaria**, reparo, contingencia. (c) **Contexto específico añadido**: el caso
  SUNAT de BVN (controversia por ventas de oro 2007-2010, ya pagó ~S/2,134M — CONFIRMADO por prensa,
  contrastado con Nexa cuyo caso sigue abierto US$164M sin provisionar). Todo automático: cualquier
  término nuevo aparece solo. Verificado en vivo (Nexa 77, Inverfal 70, FOSSAL 81 con cascarón/Bayóvar,
  BVN 75 con SUNAT). PENDIENTE opcional: bloque dedicado de "Contratos" (vigentes/terminados) por empresa.
- **PROPIEDAD ENTRE EMPRESAS — investigado (de tus INFORMES + web), reporte pasado a Jair, PENDIENTE
  su OK para implementar.** Dos modelos: 💵 A vía dividendos (Cerro Verde/Brocal→BVN; BCP/Pacífico→
  Credicorp) vs 🔄 B aporte directo/intercompañía (Atacocha→Nexa; Corona presta US$66M a Sierra
  Metals; Backus presta S/910M a AB InBev). Relaciones DENTRO de la app (mostrar % en ambos lados):
  NEXAPEC1→ATACOBC1 (62.89% B/99.36% A), BVN→CVERDEC1 (19.58%) y →BROCALC1 (61.43%), BAP→CREDITC1
  (97.69%) →PACIFIC1 (~96-98%) →CRECAPC1, IFS→INTERBC1 (99%), BACKUSI1→SNJUANI1 (97.03%),
  INVFALC1→SAGAC1 (98.79%), SCCO→SPCCPI1 (sucursal 100%). No listadas: MINSURI1→Marcobre/Mina Justa
  (60%), BVN→Yanacocha/Coimolache. Diseño propuesto: `relaciones.json` + bloque "🧬 Familia
  empresarial" bidireccional en la ficha (link si la otra está en la app; texto si no).
- **Correcciones de propiedad aplicadas a tesis (confirmadas por informes de Jair + web):**
  Atacocha la controla Nexa 62.89% B/99.36% A y NO reparte dividendos (BVL/stockanalysis = 0 —
  Jair creía que pagaba; no hay registro); Cerro Verde Freeport **55.08%** (no 53.6%), Sumitomo 21%,
  BVN 19.58% (socia minoritaria); Brocal BVN 61.43% (58.9% del dividendo va a BVN). Volcan ya estaba
  bien (grupo Integra/Transition Metals, no Glencore desde 2024).
- **BUG arreglado en `auditoria.py`** (de la tanda 7): `sys.stdout.reconfigure(utf-8)` para no
  crashear con emojis en consola Windows cuando el robot la llama sin `-X utf8`.

## ⭐ TANDA 7 (02-jul-2026, Opus) — **85 valores** (78 → 85)
- **7 nuevas, "un poco de todo" (pedido de Jair: aprender a hacer tesis + escenarios):**
  aseguradoras **MAPFSGC1** (Mapfre Perú) y **PACIFIC1** (Pacífico, del grupo Credicorp) →
  sector diversas; **BPICHPC1** (Banco Pichincha, grupo ecuatoriano) → bancos ahora 5;
  industriales **QUIMPAI1** (Quimpac, químicos, acción de inversión), **HIDROSI1** (Hidrostal,
  bombas), **ETERNII1** (Eternit, fibrocemento) → diversas; **PERUBAI1** (Perubar, zinc/plomo
  de Glencore) → minas 11. Todas MUY ilíquidas (última negociación 2025/ppos-2026); la app ya
  avisa `sinNegociacionReciente`. NO se metieron las azucareras en crisis (Tumán/Andahuasi/Cayaltí)
  — decisión de Jair. El resto del mercado local líquido YA estaba agotado (verificado en vivo:
  lo que queda sin tener son ETFs/acciones extranjeras del segmento RV3).
- **Datos 7/7 CONFIRMADOS** (fuente oficial, cero inventado): fundamentos SMV Q1 2026 (`run_uno.py`),
  precios/históricos/hechos BVL, dividendos (stockanalysis + `fetch_beneficios`), EPS anual + P/E.
  Highlights: Pacífico EPS anual S/4.275 (P/E ~9.7, payout 91%, paga S/2.73 may-2026); Mapfre paga
  ~1.9%; **Quimpac paga US$0.0397 pero su yield sale 26.61%** → la app dispara sola el aviso de
  "rendimiento extraordinario / precio desactualizado" (yield>20%); B. Pichincha con **EPS anual
  2025 NEGATIVO** (−0.041, el P/E se oculta) aunque el Q1 2026 quedó apenas en azul; Eternit y
  Hidrostal SIN deuda; Perubar rentable pero con caja finísima (US$224 mil).
- **Tesis + 5 tips + catalizadores + escenarios por-empresa (`condicionesEmpresa`) escritos para las 7**,
  anclados a los números reales y con honestidad dura. Aseguradoras se leen como Rímac/Positiva
  (primas/siniestralidad, no "ventas"); Pichincha como banco (no por P/E). `condicionesEmpresa`
  pasó de 4 → 11 (las 4 previas + las 7 nuevas).
- **Nota de datos:** Mapfre y Pacífico caen al parser HTML de entidades reguladas SBS (igual que
  Rímac/Positiva): margen/deuda/FCF salen null con la nota estándar — consistente, esperado.
- **BUG ARREGLADO en `auditoria.py`**: crasheaba con UnicodeEncodeError al imprimir los emojis
  (✅❌⚠️) en la consola cp1252 de Windows cuando el robot la llama sin `-X utf8` (el audit YA
  había pasado, moría solo al reportar). Se fuerza `sys.stdout.reconfigure(encoding="utf-8")`.
- **Auditoría al cierre: 0 problemas estructurales, 13 avisos legítimos** (sin_documentos esperados
  de AUNA/SCCO/PML/Pucalá + yields extraordinarios reales, incl. Quimpac 26.61%). App verificada en
  el navegador: fichas de Pacífico y Quimpac renderizan tesis, precio (marcado viejo), sparkline,
  termómetro "poco negociada" y el aviso de yield alto. Reparto de sectores: minas 11, diversas 12,
  alimentos 8, eléctricas 5, bancos 5, fondos 4, acereras/cemento/retail/textil 3, pesqueras 2.

## ⭐ PASE PREMIUM (01-jul-2026, Fable) — qué se agregó
- **Precios históricos REALES de la BVL (el pendiente grande, RESUELTO):** endpoint oficial
  `GET dataondemand.bvl.com.pe/v1/stock-quote/share-values/<NEM>?startDate=&endDate=` (receta
  completa en `extractor/FUENTES.md`). Nuevo script `extractor/fetch_historicos.py` →
  `historicos.json` (~12 meses de cierres diarios por empresa, 48/48 OK). **Sumarlo al robot diario.**
  Quirks manejados: la BVL rellena días sin negociar repitiendo el cierre y manda 0.0 sin
  cotización (se filtran); si la acción cambia de precio <35% de los días → `pocoNegociada: true`.
- **Sparkline** (`Sparkline.jsx`): gráfico dorado del precio en la ficha (3M/6M/1A, % del
  período, mín/máx, fechas, fuente BVL). Aviso honesto en ilíquidas ("la línea se queda plana…").
  Modo `compacto` para el comparador.
- **Termómetro de volatilidad** (`Termometro.jsx`): volatilidad anualizada REAL calculada de los
  cierres (en el extractor): tranquila <22% / se mueve / montaña rusa ≥45%. Si es ilíquida dice
  **"poco negociada"** SIN número (sería engañoso) y explica el riesgo de liquidez. Educativo,
  no predice.
- **Explorador** (`Explorar.jsx`, vista propia en el nav): buscador (sin tildes), chips por
  sector, filtros "paga dividendos" / "negocia seguido", orden (sector/A-Z/yield), badges de
  yield e iliquidez, y selección de 2 empresas → barra flotante → **Comparador**.
- **Comparador** (`Comparador.jsx`): 2 empresas frente a frente (precio+fecha, P/E, dividendo,
  yield, deuda, FCF, margen, EPS, volatilidad, rango 52s) + 2 sparklines compactos. Sin
  veredicto (educa, no recomienda). P/E numérico compartido en `lib/finanzas.js`.
- **PWA instalable**: vite-plugin-pwa (autoUpdate), manifest negro/dorado, íconos generados del
  logo en `app/public/iconos/` (192/512/maskable/apple 180), metas en index.html. Funciona
  offline con lo precacheado (~1 MB). `npm run build` genera `sw.js` solo.
- **Micro-animaciones** (`lib/anim.jsx`, sin dependencias — CSS + hooks): fade-up entre vistas,
  reveal al hacer scroll (`<Reveal>`), precio que cuenta hacia arriba (`<CountUp>`), línea del
  sparkline que se dibuja, transición entre preguntas del quiz. TODO respeta
  `prefers-reduced-motion`.
- **Reveal del quiz**: pantalla "Leyendo tus respuestas…" (1.5 s, anillo dorado) → el perfil
  hace "pop" → resultados en cascada.
- **Móvil**: topbar envuelve (el nav creció), sin desborde horizontal (verificado 375px).
- ✅ Resuelto (1-jul-2026): **NEXAPEC1 tenía fundamentos vacíos** en `empresas.json` — la causa
  fue un `ReadTimeout` puntual del portal SMV en el run del 30-jun (los 3 reintentos toparon con
  timeout), NO un cambio de formato XBRL. Se creó `extractor/run_uno.py <TICKER>` que re-extrae
  UNA sola empresa y parcha su entrada en `empresas.json` + `salida_smv.json` sin re-descargar
  las 48. Nexa regenerada OK (USD, deuda US$29.5M, margen bruto 57.1% — cuadra con la tesis).
  Único fallo restante: AUNA con `sin_documentos` (la SMV no publica su XBRL individual Q1 2026).

## ⭐ AUDITORÍA GENERAL + CORRECCIONES (02-jul-2026, Fable) — pedido de Jair
- **Moneda de dividendos CORREGIDA en 14 empresas** (hallazgo de Jair: "Nexa paga en dólares"):
  stockanalysis CONVIERTE el dividendo a la moneda de cotización; la BVL trae la moneda REAL
  (`coin`). `fetch_beneficios.py` ahora además de llenar vacíos **reconstruye la entrada si la
  moneda difiere**: Nexa, Aceros, Exalmar, Minsur, Brocal, Engie, Poderosa, El Comercio, Tradi,
  Peruana de Energía, Cervesur, Hermes, INDECO, Andex → todos declaran en US$.
  Validado: Hermes US$0.8252 (BVL) = "2.83214 PEN" (stockanalysis) al TC ✓. El yield se
  convierte con el TC cuando la moneda difiere del precio; DividendoSimulador ya convertía bien.
- **REGRESIÓN detectada y cerrada para siempre**: re-correr `fetch_anual_eps` PISABA las
  correcciones manuales de EPS del 26-jun (Minsur volvió a P/E 0.1, InRetail a 102.7).
  Nuevo `extractor/fix_eps.py`: parcha eps_anual.json con el EPS ttm implícito de stockanalysis
  (Previous Close ÷ PE) para la lista TICKERS (Minsur 7.5, Backus 9.6, InRetail 14.4, IFS 11.5,
  Volcan 3.9, Corona 4.7, + BAP 14.8 y Cervesur 3.4). **Correr SIEMPRE después de fetch_anual_eps.**
- **Nuevo `extractor/auditoria.py`**: chequea presencia (fichas/datos 78/78), sectores completos
  (quiz/guias/escenarios), monedas dividendo vs BVL, P/E y yields fuera de rango. Hoy: 0 problemas
  estructurales, 12 avisos legítimos (4 sin_documentos esperados + yields extraordinarios reales).
- **PERENBC1 explicado**: su P/E 2.0 + dividendos de US$ 3.62/acción en 12m (yield 66%) = ganancia
  extraordinaria 2025 repartida; tesis/tips reescritos. La app ahora muestra un **aviso automático**
  cuando el yield >20%: "casi siempre viene de un pago EXTRAORDINARIO… no asumas que se repite".
- **Nuevo `extractor/actualizar_todo.py`** (para el Q2 en ~1.5-2 meses): UN comando corre todo en
  orden (secuencial — la SMV se atora en paralelo): `--trimestral` agrega run_batch (tras cambiar
  "trimestre" en el config); `--con-build` regenera la PWA. Termina con la auditoría.

## ⭐ TANDA 6 + DIVIDENDOS BVL "BENEFICIOS" (02-jul-2026, Fable) — **78 valores**
- **67 → 78.** Tanda 6 (11, los conocidos que negocian poco — ventana 30-120 días):
  SAGAC1 (Saga Falabella, P/E ~4.8 pero deuda S/517M y FCF -87M — tesis honesta),
  POSITIC1 (La Positiva), HERMESC1 (blindados, margen 26%, deuda S/572M), INDECOI1
  (cables Nexans, USD), GBVLAC1 (¡la propia Bolsa/nuam!), CRECAPC1, COCESUI1 (holding
  arequipeño), CONCESI1 (holding Yura/Gloria), FOSSALC1 (cascarón de fosfatos Bayóvar,
  osciló 0.76→2.40), ANDEXBC1 (junior local, 0.18→0.90), PUCALAC1 (Agro Pucalá,
  **sin_documentos** — no presentó Q1 a la SMV; tesis centrada en gobernanza).
  Holdings marcados: CONCESI1, COCESUI1, FOSSALC1, CRECAPC1, GBVLAC1. COLCA no está en SMV → fuera.
- **DIVIDENDOS DESDE LA BVL (pedido de Jair: "FIBPRIME da bastantes y salía que no"):**
  el mismo `GET /v1/issuers` trae `listValue[].listBenefit` = historial COMPLETO de
  beneficios por valor (benefitType DE = efectivo, con benefitValue + coin + fechas
  acuerdo/corte/registro/ENTREGA). Nuevo `extractor/fetch_beneficios.py`: corre DESPUÉS de
  div_stockanalysis y PARCHA dividendos.json solo donde stockanalysis no llega (nunca pisa).
  Resultado: **FIBPRIME 47 pagos, yield 8.71%, MENSUAL**; FIBCCAP 7.0% trimestral; y
  Volcan/Aenza/Morococha/Integratel/Centenario ganaron su historial antiguo (0 reciente, honesto).
- Robot diario queda: fetch_precios → fetch_historicos → fetch_hechos → div_stockanalysis →
  **fetch_beneficios** → fetch_anual_eps → build. (eps_anual falló una vez en silencio
  cuando corría en paralelo con run_uno contra la SMV — correr secuencial.)

## ⭐ TANDA 5: SECTOR "FONDOS" + GIGANTES EXTRANJEROS (02-jul-2026, Fable) — 67 empresas
- **59 → 67.** Sector NUEVO **"fondos"** (4): FIBPRIME (FIBRA Prime, Grupo Coril, rpj T00002),
  FIBCCAP (Fibra Credicorp Capital, T00003), ETFPERUD (ETF Van Eck acciones Perú, BVL029),
  ETFPESOV (ETF bonos soberanos, BVL038). + **BAP** (Credicorp Ltd., bancos, esHolding — ¡SÍ
  publica XBRL individual a la SMV!, activos S/ 44,496M), **SCCO** (Southern Copper matriz,
  minas, sin_documentos como AUNA), **PML** (Panoro, minera JUNIOR, solo apuesta,
  sin_documentos), **ENPACII1** (Energía del Pacífico, eléctricas, USD, EPS Q1 = 0.0000).
- Sector "fondos" integrado ENTERO: quiz (opción nueva en la pregunta de sector + sectorTip),
  guias.json (cómo leer un fondo: canasta/TER/rentas/tasas/liquidez), escenarios.json
  (movimiento + condiciones + notaSector; **SIN rangoPE a propósito** — Valoracion se oculta
  sola, el P/E de empresa no aplica a fondos), ORDEN_SECTORES en Explorar.jsx y Resultados.jsx.
- FIBRAs/ETFs no están en el catálogo SMV ni en stockanalysis (los 4 con entrada manual
  en empresas.json motivo "no_aplica_es_fondo"); sus distribuciones se ven por los HI 📰.
  stockanalysis cubre BAP/SCCO/PML/ETFs (6/8).
- Corrección Regla #6: los tips de ENPACII1 se escribieron antes del dato y decían "pérdida
  ligera"; el dato real es EPS US$ 0.0000 → corregidos tips/tesis/catalizadores.

## ⭐ TANDA 4 + HECHOS DE IMPORTANCIA EN LA FICHA (02-jul-2026, Fable)
- **59 empresas** (48 → 59). Tanda 4 (11): SEALDC1 (SEAL Arequipa), PERENBC1, EGEPIBC1
  (Enel Piura) en eléctricas; LUISAI1 (Santa Luisa/Mitsui), MOROCOI1 (SIMSA) en minas;
  SNJACIC1 (San Jacinto/Gloria), LAREDOC1 (Laredo/Manuelita) en alimentos; ETNAI1 (baterías),
  INTPEBC1 (Integratel ex-Telefónica), INVCENC1 (Centenario), AIHC1 (Andino, holding) en
  diversas. **RECORD S.A. se EXCLUYÓ: está EN LIQUIDACIÓN según la SMV.** ENPACII1 excluida
  (centavo sin negociación). Selección = todo lo local que negoció en 30 días (análisis del
  mercado completo BVL, 756 valores: el resto son ETFs/extranjeras/fondos/clases duplicadas).
- Datos completos 11/11: SMV Q1 (run_uno.py), precios, dividendos, EPS anual, históricos,
  tesis/tips/catalizadores escritos (anclados en números reales + perfiles stockanalysis;
  PERENBC1 no está en stockanalysis). Honestidad dura donde toca: MOROCOI1 e INTPEBC1 tienen
  PATRIMONIO NEGATIVO y sus tesis lo dicen sin filtro. ⚠️ PERENBC1 P/E 2.0 (EPS anual 9.04)
  huele a ganancia extraordinaria 2025 — revisar con criterio de Jair.
- **HI por empresa DESCIFRADO (API BVL, mejor que el portal SMV):**
  `GET /v1/issuers` → rpjCode de cada emisor (mapeados los 59 en empresas_config.json campo
  `bvlRpj`); `POST /v1/corporate-actions {rpjCode,page,size,search:"",startDate,endDate}` →
  historial COMPLETO de HI con PDF (documents.bvl.com.pe). Descubierto interceptando el XHR
  de la página de emisores con Chrome. Nuevo `extractor/fetch_hechos.py` → `hechos.json`
  (últimos 12 meses por ticker, 59/59 OK). El `hechos_importancia.py` del SMV queda de respaldo.
- **📰 Nueva sección en la ficha:** "Hechos de Importancia (comunicados oficiales)" —
  últimos 5 con fecha/categoría/link al PDF + "ver los N del último año". Pendiente #4 del
  handoff RESUELTO (y sin esperar acumulación: ya hay historial).
- Pendiente de la tanda 4: escenarios por-empresa, afinar perfiles/criterio de Jair.

## ⭐ ACTUALIZACIÓN 2 (01-jul-2026, Fable) — "full libertad"
- **Rutas por hash** (`App.jsx`): cada vista tiene URL propia (`#/empresa/BVN`, `#/explorar`,
  `#/comparar/A/B`, `#/glosario`, `#/quiz`). Links directos compartibles, botón atrás del
  navegador/celular funciona, scroll-arriba al cambiar de vista. El hash es la fuente de verdad.
- **📊 "Así cerró la BVL"** (`HoyBVL.jsx`, en inicio): top 3 subieron / top 3 bajaron del último
  cierre vs el previo (precios.json ya traía `previo`), + conteo subieron/bajaron/sin cambio.
  Excluye las `sinNegociacionReciente` (su variación sería vieja). Nota educativa "un día no
  hace tendencia". Se actualiza solo con el robot diario.
- **⭐ Favoritos "Mi lista para estudiar"** (`lib/favoritos.js`, localStorage, sin cuentas):
  botón ★ en la ficha y en cada fila del Explorador, chip-filtro "★ Mi lista (n)" en Explorar,
  y strip de chips en el inicio (`MiLista.jsx`). Sobrevive reinicios; privado del usuario.
- **🎯 Empresa del día** (`EmpresaDelDia.jsx`, en inicio): rotación DETERMINÍSTICA por fecha
  (mismo día = misma empresa para todos), con tesis y botón "Estudiarla". Invita a descubrir.
- **Rango de 12 meses** (dentro de `Sparkline.jsx`): barra dorada con marcador de dónde está el
  precio actual entre su mín y máx del año ("está al 52% del camino…"). Cierres reales BVL.
- **↗ Compartir** en la ficha: Web Share API en el celular; en escritorio copia el link
  `#/empresa/TICKER` al portapapeles ("✓ Link copiado").
- **Buscador en el Glosario**: filtra términos por nombre o definición (sin tildes), muestra
  resultados planos con su rama y el ejemplo abierto.
- Verificado: consola limpia, build de producción OK (PWA regenerada), flujos probados
  (favorito → inicio → filtro, link directo, history.back, glosario).
- **Precio de la acción el día de cada dividendo del año pasado** (pedido de Jair, 01-jul):
  `fetch_historicos.py` ahora baja desde el **1 de enero del año pasado** (~18 meses; la
  volatilidad/rango 52s/liquidez se siguen midiendo SOLO con los últimos 12). Nuevo helper
  `precioEnFecha()` en `lib/finanzas.js` (cierre real ≤14 días antes de la fecha, si no → null).
  `DividendoResumen` muestra bajo cada pago del año pasado: "la acción costaba S/ X ese día".
  Años sin histórico (2024 y antes) no muestran nada — Regla #1. El cuadro de comparación
  ahora hace pop "✓ ¡Listas para comparar!" y abre el comparador solo (máx. 2, avisado).
- **Fondo vivo** (`FondoVivo.jsx` + `.aurora` en CSS, a pedido de Jair, iterado 3 veces):
  "polvo dorado" en canvas (**260** partículas escritorio / 110 celular) que parpadea, deriva
  hacia arriba y SE ENCIENDE + se aparta cerca del cursor (dorado claro, más grandes), luz
  que sigue el mouse (halo 300px), aurora dorada que respira (2 gradientes animados solo con
  transform → GPU), y **FLECHAS DE ÍNDICE BURSÁTIL** (iterado 02-jul a pedido de Jair,
  estilo la flecha del logo): zigzag con tramos de avance (0.3–0.75 s) y retrocesos cortos
  (0.1–0.26 s) como un chart real, con PUNTA DE FLECHA orientada en la cabeza — DORADAS
  (#d4af37, la marca) las que suben / rojas tenues las que bajan; hasta 8 a la vez en
  escritorio / 4 en celular (~30% pasan rápidas), cola que se desvanece.
  Eficiente: pausa total cuando la pestaña está oculta (visibilitychange + Chrome congela
  rAF), tope de devicePixelRatio 2, y se APAGA entero con prefers-reduced-motion.

---

## 1. Qué es
App web **educativa** de la Bolsa de Valores de Lima (BVL). El usuario hace un quiz
(perfil × sector) y descubre **empresas para estudiar** — NO se recomienda comprar.
Producto = credibilidad. Negro y dorado (#D4AF37). Logo en `app/public/logo-alto.jpg`.
Visión y filosofía completas en `ALTO_PROYECTO_COMPLETO.md`.

## 2. Arquitectura
- **`app/`** — frontend React + Vite (estático). Correr: `npm --prefix app run dev` (puerto 5173).
  Build: `npm --prefix app run build`. Node se instaló con winget.
- **`extractor/`** — scripts Python que bajan datos de la SMV/BVL/stockanalysis y generan
  los JSON que consume la app. Librerías: requests, beautifulsoup4, lxml, pypdf.
- **`INFORMES REALIZADOS ALTO RESEARCH/`** (en el Escritorio) — informes PDF propios de Jair
  (NEXA, BVN, Cerro Verde, etc.) + DATOS_VERIFICADOS.md. Base de las tesis y catalizadores.

## 3. Las 9 Reglas de Oro (innegociables)
1. Cero datos inventados (lo que falta queda vacío/"pendiente"). 2. Jerarquía de fuentes.
3. EPS en moneda original. 4. Estados INDIVIDUALES SMV. 5. Lenguaje simple. 6. Verificar
contra la fuente. 7. No mezclar rumor con hecho. 8. Nunca prometer rendimientos.
9. La app educa, NO recomienda. (Detalle en `ALTO_PROYECTO_COMPLETO.md` Parte F.)

## 4. Las 48 empresas (17 → 32 → 47 → +Scotiabank, por liquidez real BVL)
> **+SCOTIAC1 (Scotiabank Perú, banco, smvId 40)** agregado el 30-jun a pedido: bancos ahora son 4.
> Ilíquido (último cierre 01/06); ficha completa con tesis/tips/catalizadores.
> **Tanda 3 (47, 30-jun-2026):** +4 minas (Poderosa, Southern Sucursal, Corona, Atacocha),
> +2 alimentos (Cartavio, Pomalca — azúcar), +2 eléctricas (Hidrandina, Pluz), y sector NUEVO
> **diversas** (7): GR Holding*, AUNA, Bosques Amazónicos, Inv. Portuarias Chancay* (megapuerto),
> Rímac Seguros, El Comercio, Tradi. (`*`=holding). Reparto actual: minas 10, alimentos 8, diversas 7,
> eléctricas 5, bancos/textil/acereras/cemento/retail 3, pesqueras 2.
> Notas: **AUNA** no presenta EE.FF. individuales a la SMV (cotiza en NYSE) → ficha con fundamentos
> pendientes (solo precio). **Corona** EPS corregido con stockanalysis (extractor sacó 0). **Bosques**
> margen "no representativo" (ingresos casi nulos → run_batch ahora suprime |margen|>300%). Varias de la
> tanda 3 son MUY ilíquidas (la app avisa "sin negociación reciente"). Se eliminó la sección "Histórico
> trimestral" de la ficha.
> **Tesis, tips y catalizadores de las 15 YA escritos** (30-jun), nutridos de los perfiles de
> stockanalysis (vía requests) + datos Q1. Catalizadores = resultados 2T + dividendos reales (que son
> Hechos de Importancia) + drivers documentados (ej. Poderosa: seguridad en Pataz; Chancay: ramp-up del
> megapuerto; Pluz: revisión tarifaria VAD).
> **Hechos de Importancia de la SMV — DESCIFRADO (30-jun):** portal `/SIMV/` → "Hechos de importancia
> general" (`Frm_hechosdeImportanciaAll`). Usa token de sesión que expira (se saca fresco de /SIMV/) y es
> un formulario ASP.NET de DOS POSTBACKS. Se maneja con **requests** (Chrome NO hace falta). Ya hay un
> extractor: `extractor/hechos_importancia.py` → `hechos_importancia.json`. FUNCIONA (probado: HI real de
> El Comercio, "Acuerdo de Junta de subsidiaria" 30-jun). Diseño: el buscador solo da los HI del DÍA (el
> filtro de fechas del form ASP.NET no aplica y no hay paginación), así que el script ACUMULA por empresa
> con dedup por N° de expediente → corriéndolo A DIARIO (junto al robot de precios) arma el historial solo.
> Pendiente: (a) sumar este script al robot diario cuando se publique; (b) opcional, mostrar los HI en la
> ficha (hoy el JSON casi vacío, esperar a que acumule). Receta en `extractor/FUENTES.md`.

### Las 32 empresas (ampliado de 17 → 32 el 26-jun-2026, por liquidez real BVL)
- **Minas (6):** NEXAPEC1, BVN, CVERDEC1, **VOLCABC1, MINSURI1, BROCALC1**
- **Bancos (3):** BBVAC1, CREDITC1(=BCP), INTERBC1
- **Alimentos y Bebidas (6):** ALICORC1, GLORIAI1, LAIVEBC1, **BACKUSI1, SNJUANI1, CASAGRC1**
- **Textil (3):** CRETEXC1, MICHEI1, FILAMEI1
- **Acereras (3):** CORAREI1, SIDERC1, SHPC1(Shougang, es minera de hierro)
- **Pesqueras (2):** AUSTRAC1, EXALMC1 (solo 2 cotizan en Mercado Principal)
- **Eléctricas (NUEVO, 3):** LUSURC1, ENGIEC1, ORYGENC1
- **Cemento/Construcción (NUEVO, 3):** CPACASC1, UNACEMC1*, FERREYC1*
- **Retail/Holdings (NUEVO, 3):** INRETC1*, IFS*, AENZAC1
- `*` = **HOLDING** (esHolding=true en config): su estado individual SMV son dividendos de
  subsidiarias, NO ventas. run_batch oculta el margen distorsionado y lo reemplaza por nota.
- Selección por liquidez: se descartó meter más a textil/acereras/pesqueras (no hay 3 líquidas más).
- Config: `extractor/empresas_config.json` (smvId, bvlNemonico, perfiles, monedaForzada, esHolding).
- **Pendiente de las 15 nuevas:** escenarios por-empresa (condicionesEmpresa) y revisar perfiles
  tentativos. Tesis, catalizadores y TIPS ya escritos. Tips enriquecidos con stockanalysis (perfiles de
  empresa, vía Chrome para Orygen/Casa Grande + requests para el resto): hallazgos como que Volcan tiene
  puerto y generación eléctrica, Minsur también hace cemento, UNACEM genera electricidad, Casa Grande
  cultiva uva/arándano, San Juan es filial directa de AB InBev.
- **Resumen de dividendos (DividendoResumen) rehecho (26-jun):** muestra los pagos INDIVIDUALES con su
  fecha (estilo stockanalysis, NO sumados), marca los del año en curso con "● este año", y una nota
  dinámica "este año ya pagó N veces; el año pasado pagó M veces — veremos si mantiene el ritmo". Usa
  el campo 'historial' de dividendos.json (ya existía).
- **Mini-gráfica de dividendos (DividendoGrafico.jsx, 26-jun):** A LADO de la lista de pagos, versión
  LIMPIA: solo 2 barras (2025 vs 2026) con el dividendo de cada año, nº de pagos, el precio de la acción
  HOY y el yield. 2026 va punteado ("en curso"). Muestra "▲ subió +X%" SOLO si 2026 ya superó a todo
  2025 (honesto: no inventa una caída por un año a medias). Idea de Jair (para enganchar).
  LIMITACIÓN: el precio de la acción en la FECHA de cada pago histórico no está en nuestras fuentes
  (el API de historial de stockanalysis da 500 para tickers BVL; la tabla de dividendos solo trae
  fecha+monto). Por eso se muestra el precio de HOY, no el del día del pago 2025.

## 5. Datos de la app (`app/src/data/`) — todos editables por Jair
| Archivo | Qué tiene | Lo genera |
|---|---|---|
| `empresas.json` | Fundamentos SMV Q1 2026 (deuda, FCF, EPS, capex, margen, balance) | `run_batch.py` |
| `precios.json` | Precio de cierre del día anterior (BVL) | `fetch_precios.py` |
| `historicos.json` | Cierres diarios ~12 meses + volatilidad real + pocoNegociada (BVL) | `fetch_historicos.py` |
| `dividendos.json` | Dividendos por año, yield, payout (stockanalysis) | `div_stockanalysis.py` |
| `eps_anual.json` | Ganancia anual 2025 + tipo de cambio USD/PEN (para P/E) | `fetch_anual_eps.py` |
| `escenarios.json` | Movimiento % por sector, condiciones bien/regular/mal, rangos P/E y EV/EBITDA | manual |
| `tesis.json` | Tesis honesta de 1 línea por empresa | manual |
| `tips.json` | 5 tips por empresa | manual |
| `catalizadores.json` | Eventos que vienen (documentado/rumor) | manual |
| `guias.json` | "Cómo leer estos números" por sector (profundo) | manual |
| `terminos.json` | Diccionario para tooltips (hover) | manual |
| `glosario.json` | Glosario en árbol | manual |
| `quiz.json` | Preguntas, perfiles, sectores, sectorTips | manual |
| `pildoras.json` | "¿Sabías que?" | manual |
| `config.json` | Marca, apoyo (Yape/PayPal), **mensajeDia** (Jair edita cada día) | manual |

## 6. Funciones de la app (qué ve el usuario)
- **Inicio:** logo, mensaje del día (editable), píldora "¿Sabías que?", botones (quiz / glosario
  / empresa al azar), disclaimer, botón flotante de apoyo.
- **Quiz:** 4 preguntas con descripción en cada opción + tip rotativo por pregunta. Botón
  "empresa al azar".
- **Resultados:** perfil × sector → empresas que coinciden + "explora todas" (con tip y precio).
- **Ficha de empresa (orden actual):**
  1. Cabecera (ticker, precio de cierre día anterior, badges)
  2. **Tesis** honesta
  3. **Resumen de dividendos** (paga?, 2025, 2026, posible pendiente)
  4. **¿Barata o cara?** (P/E + EV/EBITDA con fórmula, vs rango del sector, aviso de "P/E engaña" en cíclicos)
  5. **Dos simuladores lado a lado:** "¿Qué pasaría si invierto?" (precio: bien/regular/mal con
     condiciones) y "Simulador de dividendos" (en S/ y US$)
  6. Tips para estudiarla
  7. Fundamentos (SMV): deuda, FCF, EPS, margen
  8. Guía "Cómo leer estos números" (siempre abierta, con el dato real de la empresa por fila)
  9. Balance, Catalizadores (⚡), Fuentes
- **Tooltips:** cualquier palabra técnica se explica al pasar el cursor (Glosado + terminos.json).
- **Apoyo:** modal con QR de Yape (Jair Ulises Aguilar Parco) + PayPal (jair_aguilarp@hotmail.com).
- **Glosario** en árbol.

## 7. Cómo se actualizan los datos
- **Estados financieros (Q1 2026):** cuando salga el Q2, cambiar `trimestre` en
  `empresas_config.json` y correr `python extractor/run_batch.py`.
- **Precio:** `python extractor/fetch_precios.py` (cada día tras el cierre).
- **Histórico + volatilidad:** `python extractor/fetch_historicos.py` (cada día, junto al precio).
- **Dividendos:** `python extractor/div_stockanalysis.py`.
- **P/E (ganancia anual + tipo de cambio):** `python extractor/fetch_anual_eps.py`.
- Verificar todo: `python extractor/verify_all.py`.

## 8. Fuentes de datos (ver `extractor/FUENTES.md`, guardar SIEMPRE los enlaces)
- SMV estados: https://www.smv.gob.pe/SIMV/Frm_InformacionFinanciera
- BVL precios: `POST https://dataondemand.bvl.com.pe/v1/stock-quote/market`
- **Dividendos (principal): stockanalysis.com/quote/bvl/<NEM>/dividend/** (el overview tiene P/E real)
- BVL dividendos (respaldo, omite pagos): entrder1.htm y pubdif/infmen/202512e4.htm
- Tipo de cambio: open.er-api.com/v6/latest/USD

## 9. Hallazgos importantes (no olvidar)
- **Alicorp:** la SMV etiqueta su XBRL en USD por ERROR; es SOLES (forzado en config). Verificado
  contra estados separados auditados.
- **EPS:** sí está en el XBRL (BasicEarningsLossPerShare, contexto dimensional por clase de acción).
- **Bancos:** no presentan XBRL (se usa la página de detalle HTML); no tienen FCF/capex.
- **Dividendos:** la BVL se salta pagos (Michell ene-2026, Cerro Verde). stockanalysis es completo.
- **Rangos P/E calibrados** con stockanalysis (jun 2026): minas 9–15, bancos 7–12, alimentos 9–14,
  eléctricas 8–15, cemento 9–16, retail 9–16.
- **Monedas:** mineras y Exalmar reportan/cotizan en US$; el resto en S/.
- **BUG DE PRECIOS CORREGIDO (26-jun-2026):** `fetch_precios.py` usaba `sell` (orden de venta/ask)
  como "cierre". Lo correcto es `last` (precio realmente transado) con `lastDate`. Ej. BVN mostraba
  31.55 (ask) en vez de 30.31 (cierre real). Ahora usa last y cae a previous+previousDate si no negoció.
- **EPS distorsionados por clase de acción/moneda:** Minsur, Backus, InRetail, IFS y Volcan daban
  P/E absurdos (ej. Minsur 0.1). Se corrigieron en `eps_anual.json` con el EPS ttm real de
  stockanalysis (P/E: Minsur 7.2, Backus 9.7, InRetail 14.0, IFS 10.4, Volcan 3.7).
- **HOLDINGS (InRetail, IFS, UNACEM Corp, Ferreycorp):** el estado individual SMV NO refleja el
  negocio (son dividendos de subsidiarias; margen sale ~100%+). La Regla #4 "individuales" se pensó
  para operativas. Solución: esHolding en config → run_batch pone nota en margen e ingresos.
  Pendiente opcional: cargar datos CONSOLIDADOS para estas 4.
- **Brocal NO es junior:** es productora mediana (cobre/plata/plomo) controlada por Buenaventura
  (61%) y casi sin deuda. Perfil ajustado de apuesta→mixto/dividendos. (Juniors = PPX, PML.)
- **UI (26-jun):** (a) FCF en BANCOS ahora muestra nota "no aplica, se mide por CAPITAL/CET1 y ROE"
  (run_batch, si esBanco). (b) Empresas SIN dividendos (Volcan, Aenza): NO se muestra simulador de
  dividendos (solo el de precio), y el DividendoResumen de arriba avisa "Esta empresa no reparte
  dividendos" (sale incluso si ni está en dividendos.json/404).

## 10. Pendiente
- **Publicar** la app (link real + robot diario de precios con GitHub Actions). ← gran paso.
- Cargar el **criterio de Jair** restante (afinar tesis, catalizadores, escenarios por empresa).
- Pasar el **número de Yape** (el QR ya está; falta el número para "copiar número").
- Opcional: scraper de **Hechos de Importancia** SMV; beta/fechas de resultados al simulador;
  versión oficial con TODAS las empresas de la BVL.

## 11. Cómo NO perder memoria (anti-amnesia)
- **La verdad vive en los archivos**, no en el chat: este doc + el código + los JSON + los .md
  de `extractor/`. Mientras existan, nada se pierde aunque la conversación se resuma.
- Claude guarda memoria persistente en
  `~/.claude/projects/.../memory/` (MEMORY.md + notas). Se carga sola cada sesión.
- Para retomar: leer este `ESTADO_DEL_PROYECTO.md` y `ALTO_PROYECTO_COMPLETO.md`.
