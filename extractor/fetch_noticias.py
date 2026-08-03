# -*- coding: utf-8 -*-
"""
📰 FETCH NOTICIAS — la prensa que rodea a la BVL. Dos redes, no una.

QUÉ ES Y QUÉ NO ES
------------------
Esto NO reemplaza a los Hechos de Importancia (fetch_hechos.py). Los HI son la
fuente PRIMARIA: la empresa está obligada a publicarlos y salen ANTES que la
prensa. Comprobado el 31-jul-2026: "Utilidad bruta de Aceros Arequipa cayó 7%"
apareció en los medios el 27-jul, después de que los EEFF llegaran a la SMV.
Si sales a pescar el movimiento con el titular, llegas segundo.

Entonces, ¿para qué esto? Para lo que los HI NO pueden cubrir: **lo que no le
pertenece a ninguna empresa**. Que el Estado destrabó obras, que el precio
internacional del acero se movió, que El Niño amenaza la construcción. Nada de
eso genera un Hecho de Importancia, y es justo lo que explica que un SECTOR
entero se mueva junto.

LAS DOS REDES (y por qué hacen falta las dos)
---------------------------------------------
· RED DIRIGIDA (Google News RSS) — se pregunta por nombre: "Ferreycorp",
  "precio del cobre". Encuentra lo que uno sabe buscar. Su límite es ese
  mismo: solo trae lo que se le preguntó, y depende de un servicio que no es
  API oficial.
· RED DE BARRIDO (RSS de los medios) — se lee la portada completa de Gestión,
  El Comercio-Economía, Rumbo Minero, Energiminas, Minería en Línea y
  ProActivo, y se marca lo que toca a nuestro universo. Encuentra lo que uno
  NO sabía que tenía que buscar, y sigue funcionando el día que Google News
  devuelva vacío.

Las dos alimentan lo mismo (porEmpresa / temas) y se cruzan por titular, así
que una nota que sale por las dos aparece una sola vez — quedándose con el
enlace directo al medio antes que con el redirect de Google.

EL ARCHIVO CRECE, NO SE REEMPLAZA
---------------------------------
Antes cada corrida pisaba la anterior, y eso desperdiciaba trabajo: el feed de
Rumbo Minero solo tiene 10 titulares a la vez, así que lo publicado el lunes
ya no está el jueves. Ahora cada corrida FUSIONA lo nuevo con lo que ya había
y bota únicamente lo que se pasó de la ventana. Correr el robot todos los días
construye un archivo de 20 días; antes construía una foto de hoy.

QUÉ SE GUARDA (y qué no)
------------------------
SOLO titular, fecha, medio y link. NUNCA el cuerpo de la nota: es material con
derechos de su medio. El lector va a la fuente a leerla — nosotros apuntamos.

CÓMO SE EVITA LA BASURA
-----------------------
Buscar ancho trae porquería: «Auna» trae "Trujillo aúna juventud y poesía",
«Pacasmayo» trae la alcaldía provincial y «Aenza» trae páginas-robot de
TradingView. Por eso cada empresa declara, además de sus consultas, las
PALABRAS QUE EL TITULAR DEBE CONTENER (incluidas sus marcas y minas: El
Brocal, Plaza Vea, Oncosalud, Toquepala). Red ancha + colador fino: así se
puede preguntar por «Interbank» a secas sin llenarse de galerías de
arquitectura. Si un titular no nombra a la empresa, no es noticia de esa
empresa — a lo mucho es un tema de sector, y para eso están los temas.

QUÉ NO HACE
-----------
No decide qué es "candente". Un titular no es candente por sí solo: lo es
cuando la acción se salió de su vaivén normal, y esa cuenta la hace el Radar
(app/src/lib/radar.js) cruzando estos titulares con el precio. Acá solo se
recolecta, honestamente y sin adjetivos.

FRAGILIDAD
----------
Ni Google News RSS ni los feeds de los medios son APIs oficiales: pueden
cambiar o devolver vacío sin aviso. Este script JAMÁS tumba al robot — lo que
falla se salta, lo que ya estaba en noticias.json sobrevive, y sigue. Un día
sin prensa no es una emergencia; un robot caído sí.

ALCANCE: solo las acciones que DE VERDAD se negocian (las que
fetch_historicos.py no marcó `pocoNegociada`). Noticias de una acción que no
puedes comprar ni vender son decoración.

Uso:
  python extractor/fetch_noticias.py              # las dos redes, todo
  python extractor/fetch_noticias.py --temas      # solo sector/macro
  python extractor/fetch_noticias.py --mundo      # solo la capa mundo (Fed, China…)
  python extractor/fetch_noticias.py --feeds      # solo el barrido de portadas
  python extractor/fetch_noticias.py --sin-feeds  # solo la red dirigida
  python extractor/fetch_noticias.py SIDERC1 BVN  # solo esas empresas
"""
import io, json, os, re, sys, time, unicodedata
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

# Perú es UTC-5 todo el año (no hay horario de verano).
LIMA = timezone(timedelta(hours=-5))

import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

AQUI = os.path.dirname(os.path.abspath(__file__))
APP_DATA = os.path.normpath(os.path.join(AQUI, "..", "app", "src", "data"))
SALIDA = os.path.join(APP_DATA, "noticias.json")

RSS = "https://news.google.com/rss/search"
PAIS = {"hl": "es-419", "gl": "PE", "ceid": "PE:es-419"}
# El mundo se pregunta con otro lente: con gl=PE, "recesión Estados Unidos"
# devuelve lo que la prensa limeña dice de EE. UU., que llega tarde y filtrado.
# Con gl=US en español sale la agencia (Reuters, AP, EFE) el mismo día.
MUNDO_PAIS = {"hl": "es-419", "gl": "US", "ceid": "US:es-419"}

DIAS_VENTANA = 20      # más viejo que esto ya no es noticia para un trader
MAX_POR_EMPRESA = 14   # antes 8, y 8 empresas chocaban contra el techo a diario
MAX_POR_TEMA = 14
MAX_POR_MUNDO = 12     # el mundo es contexto: no debe tapar a lo local
PAUSA = 0.3            # cortesía entre consultas

# ── PRENSA POR EMPRESA ─────────────────────────────────────────────────────
# ticker -> (consultas, debe)
#
#   consultas — la lista COMPLETA de búsquedas que se le mandan a Google News,
#     con sus comillas donde toca (comillas = frase exacta; sin comillas = más
#     ancho). Son varias por empresa a propósito: la primera pregunta por el
#     nombre formal y las otras por sus marcas, minas y filiales, que es donde
#     de verdad se escribe la noticia ("Pucaccasa, la apuesta de Minsur" nunca
#     habría salido preguntando solo «Minsur»).
#
#   debe — las palabras que el TITULAR debe contener para que la nota cuente
#     como suya. Es el colador que permite tirar la red ancha. Un '*' al final
#     admite prefijo (siderur* = siderurgia, siderúrgico). Una tupla dentro de
#     la tupla exige TODAS ("pacasmayo" + "cemento": así la alcaldía de
#     Pacasmayo no entra como noticia de la cementera).
#
# Escritas a mano una por una: valen más que cualquier heurística, y el ajuste
# fino importa — «Buenaventura minera» traía CERO y
# «"Compañía de Minas Buenaventura"» trae el EBITDA del trimestre.
PRENSA = {
    "SIDERC1": (['"Siderperú"', 'Siderperú Gerdau acero Chimbote'],
                ("siderperu", "gerdau")),
    "CORAREI1": (['"Aceros Arequipa"', 'Aceros Arequipa acero antidumping OR producción'],
                 ("aceros arequipa", "corarei*", "corarec*")),
    "CPACASC1": (['"Cementos Pacasmayo"', 'Pacasmayo cemento despachos OR resultados'],
                 ("cementos pacasmayo", "cpac*", ("pacasmayo", "cemento"))),
    "UNACEMC1": (['"UNACEM"', 'UNACEM cemento despachos OR Celepsa'],
                 ("unacem", "celepsa")),
    "FERREYC1": (['"Ferreycorp"', 'Ferreyros Caterpillar Perú maquinaria'],
                 ("ferreycorp", "ferreyros", "unimaq", "orvisa")),
    "BVN": (['"Compañía de Minas Buenaventura"', 'Buenaventura minera resultados Perú',
             '"El Brocal" OR Yumpag OR Uchucchacua OR Tantahuatay'],
            ("buenaventura", "el brocal", "yumpag", "uchucchacua", "tantahuatay",
             "coimolache", "orcopampa", "julcani", "san gabriel")),
    "NEXAPEC1": (['"Nexa Resources"', 'Nexa Perú zinc Cerro Lindo OR El Porvenir'],
                 ("nexa", "cerro lindo", "el porvenir", "cajamarquilla")),
    "CVERDEC1": (['"Cerro Verde"', 'Cerro Verde Freeport Arequipa cobre'],
                 ("cerro verde", "freeport")),
    "MINSURI1": (['"Minsur"', 'Minsur estaño San Rafael OR Mina Justa OR Pucaccasa'],
                 ("minsur", "san rafael", "mina justa", "pucamarca", "marcobre",
                  "pucaccasa", "raura")),
    "VOLCABC1": (['Volcan minera', '"Volcan Compañía Minera" OR Volcan Glencore Alpamarca'],
                 ("volcan", "alpamarca", "chungar", "yauli")),
    "PODERC1": (['"Minera Poderosa"', 'Poderosa oro Pataz minería'],
                ("poderosa", "pataz")),
    "SCCO": (['"Southern Copper"', 'Southern Perú cobre Tía María OR Toquepala OR Cuajone'],
             ("southern", "tia maria", "toquepala", "cuajone", "ilo")),
    "ATACOBC1": (['Atacocha minera', '"Nexa Atacocha" OR Atacocha Pasco zinc'],
                 ("atacocha",)),
    "PML": (['"Panoro Minerals"', 'Panoro Cotabambas cobre Antilla'],
            ("panoro", "cotabambas", "antilla")),
    "PPX": (['"PPX Mining"', 'PPX Mining Igor oro Perú'], ("ppx",)),
    "CREDITC1": (['"Banco de Crédito" BCP', 'BCP Perú banca utilidad OR créditos'],
                 ("bcp", "banco de credito", "credicorp")),
    "BBVAC1": (['"BBVA Perú"', 'BBVA Perú banco utilidad OR créditos'], ("bbva",)),
    "BAP": (['"Credicorp"', 'Credicorp resultados OR utilidad NYSE'],
            ("credicorp", "bcp", "prima afp", "pacifico seguros", "yape")),
    "IFS": (['"Intercorp Financial Services"', 'Interbank banco Perú',
             'Interseguro OR Inteligo Perú'],
            ("intercorp financial", "interbank", "interseguro", "inteligo", "plin")),
    "INRETC1": (['"InRetail" Perú', 'InRetail Plaza Vea OR Mifarma OR Real Plaza'],
                ("inretail", "plaza vea", "mifarma", "inkafarma", "real plaza",
                 "vivanda", "makro", "economax")),
    "AENZAC1": (['Aenza constructora Perú', '"Aenza" OR "Graña y Montero" obras'],
                ("aenza", "grana y montero", "cumbra", "vial y vives", "unna")),
    "ALICORC1": (['"Alicorp"', 'Alicorp resultados OR consumo masivo Perú'],
                 ("alicorp", "primor", "bolivar detergente", "don vittorio")),
    "BACKUSI1": (['"Backus"', 'Backus cerveza Perú AB InBev'],
                 ("backus", "cristal cerveza", "pilsen callao")),
    "CASAGRC1": (['"Casa Grande" azucarera OR Gloria', 'Casagrande azúcar Perú caña',
                  'agroindustria azucarera Perú Coazucar OR Cartavio'],
                 ("casa grande", "casagrande", "coazucar", "cartavio", "casagrc*")),
    "ENGIEC1": (['"Engie Energía Perú"', 'Engie Perú energía Chilca OR Nodo Energético'],
                ("engie",)),
    "ORYGENC1": (['"Orygen"', 'Orygen Perú energía Wayra OR Callahuanca'],
                 ("orygen", "wayra", "callahuanca", "yanango", "chimay")),
    "PLUZENC1": (['"Pluz Energía"', 'Pluz Energía Lima electricidad OR tarifas'],
                 ("pluz", "enel distribucion peru")),
    "AUNA": (['"Auna" clínicas Perú salud',
              'Auna SA resultados OR "Clínica Delgado" OR Oncosalud'],
             ("oncosalud", "clinica delgado", "clinica vallesur", "clinica bellavista",
              ("auna", "salud"), ("auna", "clinic*"), ("auna", "bvl"),
              ("auna", "nyse"), ("auna", "accion*"), ("auna", "utilidad"))),
    "IPCHBC1": (['"Inversiones Pacasmayo"', 'Inversiones Pacasmayo holding acciones'],
                ("inversiones pacasmayo",)),
    "FIBPRIME": (['"Fibra Prime"', 'Fibra Prime fideicomiso inmobiliario Perú'],
                 ("fibra prime",)),
    # None a propósito: un ETF no tiene prensa propia, solo la de su canasta.
    "ETFPERUD": (None, ()), "ETFPESOV": (None, ()),
}

# Sufijos legales que no ayudan a buscar (fallback si el ticker no está arriba)
BASURA_NOMBRE = re.compile(
    r"\b(S\.?A\.?A\.?|S\.?A\.?C\.?|S\.?A\.?|Corp\.?|Ltd\.?|Inc\.?|Perú|del Perú)\b\.?",
    re.IGNORECASE)

# ── Los TEMAS: el motor de sector que ningún Hecho de Importancia cubre ────
# Cada tema dice a qué sectores del Radar les pega, para que la app pueda
# ponerlo al lado del sector que se movió.
#
#   consultas — lo que se le pregunta a Google News.
#   claves    — con qué palabras se reconoce el tema en el barrido de
#               portadas. Mismo idioma que `debe`: '*' admite prefijo.
#
# Sectores válidos (los de empresas.json): minas, bancos, alimentos,
# electricas, cemento, retail, fondos, acereras, diversas.
TEMAS = [
    {"id": "acero", "titulo": "Acero y siderurgia", "icono": "🏗️",
     "consultas": ["precio del acero OR siderurgia Perú",
                   "antidumping acero Perú OR importaciones de acero"],
     "sectores": ["acereras"],
     "claves": ("acero", "siderur*", "antidumping", "acerera*")},

    {"id": "cemento", "titulo": "Cemento y despachos", "icono": "🧱",
     "consultas": ["despachos de cemento Perú OR venta de cemento",
                   "construcción Perú autoconstrucción OR sector construcción"],
     "sectores": ["cemento"],
     "claves": ("cemento", "autoconstruccion", "sector construccion", "cementera*")},

    {"id": "obras", "titulo": "Obras públicas e inversión", "icono": "🚧",
     "consultas": ["obras públicas Perú inversión OR reconstrucción",
                   "infraestructura Perú concesiones OR ProInversión"],
     "sectores": ["cemento", "acereras", "diversas"],
     "claves": ("obras publicas", "proinversion", "infraestructura", "concesion*",
                "reconstruccion", "inversion publica")},

    {"id": "cobre", "titulo": "Cobre", "icono": "🟠",
     "consultas": ["precio del cobre mercado", "cobre China demanda OR cobre LME"],
     "sectores": ["minas"],
     "claves": ("cobre", "lme", "cuprifero*")},

    {"id": "preciosos", "titulo": "Oro y plata", "icono": "🥇",
     "consultas": ["cotización del oro mercado internacional",
                   "onza de oro OR cotización de la plata"],
     "sectores": ["minas"],
     "claves": ("onza", "aurifero*", "lingote*", ("oro", "cotizacion"),
                ("oro", "precio"), ("plata", "cotizacion"), ("plata", "precio"))},

    {"id": "zinc", "titulo": "Zinc, estaño y plomo", "icono": "🔩",
     "consultas": ["precio del zinc OR precio del estaño",
                   "zinc Perú producción OR plomo Perú"],
     "sectores": ["minas"],
     "claves": ("zinc", "estano", "plomo", "polimetalic*")},

    {"id": "mineria", "titulo": "Minería en Perú", "icono": "⛏️",
     "consultas": ["minería Perú producción OR conflicto minero",
                   "MINEM inversión minera Perú",
                   "cartera de proyectos mineros Perú"],
     "sectores": ["minas"],
     "claves": ("mineria", "minero*", "minem", "ingemmet", "socavon", "reinfo",
                "mineria ilegal")},

    {"id": "tasas", "titulo": "Tasas, dólar e inflación", "icono": "🏛️",
     "consultas": ["BCRP tasa de referencia OR inflación Perú",
                   "tipo de cambio dólar Perú sol"],
     "sectores": ["bancos", "cemento", "retail"],
     "claves": ("bcrp", "tasa de referencia", "inflacion", "tipo de cambio",
                "dolar", "banco central de reserva", "pbi")},

    {"id": "banca", "titulo": "Banca y crédito", "icono": "🏦",
     "consultas": ["SBS Perú morosidad OR créditos banca",
                   "Asbanc colocaciones OR banca peruana utilidades"],
     "sectores": ["bancos"],
     "claves": ("sbs", "morosidad", "colocaciones", "banca peruana", "credito*",
                "asbanc")},

    {"id": "bvl", "titulo": "La bolsa peruana", "icono": "📈",
     "consultas": ["Bolsa de Valores de Lima OR BVL índice",
                   "MSCI Perú OR mercado emergente bolsa Perú"],
     "sectores": [],
     "claves": ("bvl", "bolsa de valores de lima", "msci", "bursatil", "smv",
                "accionistas")},

    {"id": "energia", "titulo": "Energía y tarifas", "icono": "⚡",
     "consultas": ["tarifa eléctrica Perú OR Osinergmin",
                   "generación eléctrica Perú demanda OR gas natural Camisea"],
     "sectores": ["electricas"],
     "claves": ("osinergmin", "tarifa electrica", "electricidad", "camisea",
                "gas natural", "generacion electrica", "coes", "hidroelectric*",
                "energia renovable")},

    {"id": "consumo", "titulo": "Consumo y retail", "icono": "🛒",
     "consultas": ["consumo privado Perú OR ventas minoristas Perú",
                   "supermercados Perú OR centros comerciales Perú inversión"],
     "sectores": ["retail", "alimentos"],
     "claves": ("consumo masivo", "retail", "centro comercial", "supermercado*",
                "canal moderno", "bodega*")},

    {"id": "agro", "titulo": "Agro y azúcar", "icono": "🌾",
     "consultas": ["agroexportación Perú campaña", "azúcar Perú caña de azúcar"],
     "sectores": ["alimentos"],
     "claves": ("agroexport*", "azucar", "cana de azucar", "agroindustri*",
                "agrario", "midagri")},

    {"id": "comercio", "titulo": "Comercio exterior y Chancay", "icono": "🚢",
     "consultas": ["puerto de Chancay OR exportaciones Perú",
                   "aranceles Estados Unidos Perú comercio"],
     "sectores": ["minas", "alimentos", "diversas"],
     "claves": ("chancay", "exportacion*", "arancel*", "comercio exterior",
                "callao puerto", "tlc")},

    {"id": "politica", "titulo": "Política y riesgo país", "icono": "🗳️",
     "consultas": ["riesgo país Perú economía", "MEF Perú presupuesto OR reforma económica"],
     "sectores": [],
     # 'eleccion*' se fue: traía "¿Cuánto cobran los miembros de mesa en las
     # Elecciones?" — periodismo de servicio, no mercado.
     "claves": ("riesgo pais", "ministro de economia", "mef", "confianza empresarial",
                "grado de inversion", "calificadora*", "presupuesto publico")},

    {"id": "clima", "titulo": "Clima: El Niño y lluvias", "icono": "🌧️",
     "consultas": ["fenómeno El Niño Perú pronóstico", "lluvias Perú daños huaicos"],
     "sectores": ["cemento", "alimentos", "electricas"],
     "claves": ("el nino", "fenomeno el nino", "huaico*", "sequia", "senamhi",
                "friaje")},
]

# ═══ 🌍 EL MUNDO — la capa que llega ANTES que cualquier estado financiero ══
#
# POR QUÉ EXISTE. De las 32 acciones que de verdad se negocian, 10 son minas y
# ninguna le pone precio a lo que vende: se lo ponen en Londres y en Chicago.
# Súmale las 2 acereras (que compiten contra el acero chino) y los 3 fondos
# (que siguen al mercado entero) y son más de un tercio del plato con la causa
# fuera del país. Hasta acá el robot preguntaba TODO con gl=PE: la mitad de lo
# que mueve la BVL no entraba por ninguna de las dos redes.
#
# EN QUÉ SE DIFERENCIA DE UN TEMA. Un tema de sector apunta a un sector
# ("acereras"). Un tema de mundo apunta a EMPRESAS y, sobre todo, dice POR QUÉ
# CANAL les llega — que es lo único que hace honesta la frase «esta noticia
# puede afectar a X». Sin el canal, es un adivino; con el canal, es una cadena
# que el lector puede seguir y romper si no le convence:
#
#     Fed baja tasas → el dólar se debilita → el cobre sube → Cerro Verde
#
# LO QUE NO ES, Y HAY QUE DECIRLO EN PANTALLA. Nada de esto se midió contra el
# precio. `estudio_noticias.py` ya mostró que ni siquiera los titulares de la
# propia empresa predicen su cierre; un titular de la Fed, menos. Esto NO
# ordena por importancia ni anuncia un movimiento: pone al lado del contacto la
# cadena por la que el mundo podría estarle llegando, para que el que mira
# sepa a dónde ir a buscar. Por eso todo se rotula «puede», nunca «va a».
#
# Los canales están escritos a mano, uno por uno, igual que PRENSA y TEMAS: no
# hay heurística que sepa que las ventas de oro de Minsur van a Norteamérica.
MUNDO = [
    {"id": "fed", "titulo": "La Fed y las tasas en EE. UU.", "icono": "🏛️",
     "queEs": "Lo que decide (o lo que los analistas creen que va a decidir) la "
              "Reserva Federal manda sobre el dólar, y el dólar le pone precio a "
              "casi todo lo que la BVL vende.",
     "consultas": ["Reserva Federal tasas de interés decisión",
                   "Fed recorte de tasas expectativa analistas",
                   "dólar tasas Estados Unidos mercados"],
     # El colador: con gl=US el feed en español se llena de prensa regional
     # latinoamericana. "Inversiones en agosto: qué bonos convienen" no es
     # noticia de la Fed, y "riesgo para el plan de Milei" es de Argentina.
     "debe": ("fed", "reserva federal", "powell", "fomc", "tasa de interes",
              "tasas de interes", "tipos de interes", "recorte de tasas"),
     # `claves` es para RECONOCER el tema en una portada entera (la red de
     # barrido). Más estricto que `debe`: acá nadie preguntó por la Fed, así
     # que el titular tiene que nombrarla solo.
     "claves": ("fed", "reserva federal", "powell", "fomc", "recorte de tasas",
                "politica monetaria", ("tasas", "estados unidos")),
     "sectores": ["bancos", "minas", "fondos"],
     "afecta": [
         {"via": "marca el rumbo de las tasas globales y el BCRP suele acompañar: "
                 "de ahí sale lo que ganan prestando",
          "tickers": ["CREDITC1", "BBVAC1", "BAP", "IFS"]},
         {"via": "un dólar más débil suele empujar hacia arriba el precio de los "
                 "metales, que es todo lo que venden",
          "tickers": ["CVERDEC1", "SCCO", "BVN", "MINSURI1", "NEXAPEC1",
                      "VOLCABC1", "PODERC1", "ATACOBC1"]},
         {"via": "cobran o deben en dólares: cuando el tipo de cambio se mueve, "
                 "su resultado en soles se mueve sin que cambie el negocio",
          "tickers": ["SIDERC1", "CORAREI1"]},
         {"via": "siguen al mercado peruano entero, así que les llega todo lo de "
                 "afuera al mismo tiempo",
          "tickers": ["ETFPERUD", "ETFPESOV"]},
     ]},

    {"id": "recesion", "titulo": "¿Recesión en EE. UU.?", "icono": "📉",
     "queEs": "Si la economía más grande frena, frena la demanda industrial. El "
              "cobre es el termómetro: se usa en todo lo que se construye.",
     "consultas": ["recesión Estados Unidos economía pronóstico",
                   "empleo Estados Unidos desaceleración economía",
                   "PBI Estados Unidos crecimiento trimestre"],
     # Sin esto entraban "IMEF advierte desaceleración en Yucatán" y
     # "Coparmex alerta desaceleración del empleo formal": son de México y no
     # dicen nada de la economía que nos importa acá.
     "debe": ("estados unidos", "eeuu", "ee. uu", "eua", "estadounidense",
              "wall street", "reserva federal", "recesion global"),
     "claves": ("recesion", ("pib", "estados unidos"), ("empleo", "estados unidos"),
                ("desaceleracion", "estados unidos"), ("economia", "estadounidense"),
                ("desempleo", "estados unidos")),
     "sectores": ["minas", "fondos"],
     "afecta": [
         {"via": "el cobre es el termómetro industrial del mundo: si EE. UU. "
                 "frena, cae la demanda y con ella el precio",
          "tickers": ["CVERDEC1", "SCCO", "NEXAPEC1", "ATACOBC1", "PML"]},
         {"via": "sus ventas de oro van a Norteamérica y dependen de pocos "
                 "clientes: una recesión toca directo el comprador",
          "tickers": ["MINSURI1"]},
         {"via": "tiene inversiones en Florida (patios de chatarra) para "
                 "asegurar materia prima",
          "tickers": ["CORAREI1"]},
         {"via": "un mercado emergente es de lo primero que se vende cuando el "
                 "mundo se asusta",
          "tickers": ["ETFPERUD", "ETFPESOV"]},
     ]},

    {"id": "medioriente", "titulo": "Medio Oriente", "icono": "🕌",
     "queEs": "Un conflicto sube dos cosas a la vez: el oro, porque el miedo "
              "compra refugio, y la energía, porque el petróleo se encarece. Lo "
              "primero es ingreso para unas; lo segundo es costo para todas.",
     # Las consultas preguntan por el HECHO, no por el efecto. Antes decían
     # "precio del petróleo" y devolvían la nota de cierre del crudo — el
     # resultado, no la noticia. "Irán ataque" y "Ormuz" traen el evento, que
     # es lo que sale primero y lo que de verdad mueve el oro.
     "consultas": ["Irán ataque bombardeo Israel Estados Unidos",
                   "Estrecho de Ormuz tensión suministro",
                   "Medio Oriente escalada mercados reacción",
                   "petróleo Brent Medio Oriente suministro"],
     "debe": ("medio oriente", "iran", "israel", "petroleo", "crudo", "brent",
              "wti", "gas natural", "onza", "geopolitic*", "ormuz", "houthi*",
              "hezbola", "hamas", "teheran"),
     # "iran" e "israel" van solos sin miedo: el matcher usa bordes de palabra,
     # así que «aspiran» y «retiran» no pegan.
     "claves": ("medio oriente", "iran", "israel", "houthi*", "hormuz", "brent",
                "wti", ("petroleo", "precio*"), ("crudo", "precio*"),
                ("oro", "refugio"), ("oro", "maximo*")),
     "sectores": ["minas", "electricas", "acereras", "cemento"],
     "afecta": [
         {"via": "el oro sube cuando hay miedo, y es lo que sacan de la tierra",
          "tickers": ["BVN", "PODERC1", "MINSURI1", "PPX"]},
         {"via": "el petróleo y el gas les ponen el costo de generar",
          "tickers": ["ENGIEC1", "ORYGENC1", "PLUZENC1"]},
         {"via": "hornos y clinker: la energía es una parte grande de lo que les "
                 "cuesta producir",
          "tickers": ["SIDERC1", "CORAREI1", "CPACASC1", "UNACEMC1"]},
     ]},

    {"id": "oro", "titulo": "El oro", "icono": "🥇",
     "queEs": "El oro sube cuando el mundo se asusta y cuando el dólar se "
              "debilita — o sea, con lo que hace la Fed Y con lo que pasa en "
              "Medio Oriente al mismo tiempo. Es el ingreso directo de cuatro "
              "de las mineras del plato: lo que ellas venden vale lo que el oro "
              "diga esa mañana en Londres.",
     # Las consultas se reescribieron el 02-ago-2026 tras medirlas una por una:
     #   · "precio del oro récord máximo histórico" traía 100 titulares y CERO
     #     dentro de la ventana de 20 días. Preguntar por "récord" le pide a
     #     Google el archivo, no la noticia.
     #   · "cotización del oro onza" traía 27 recientes y los 27 eran
     #     "Precios del oro hoy, 2 de agosto…" — el molde diario del robot. Los
     #     bota el filtro de relleno, y hace bien: el precio ya lo tiene la app.
     # Lo que sí funciona es preguntar por el oro JUNTO A SU CAUSA, que es como
     # se escribe la nota que vale: el oro y la Fed, el oro y la guerra.
     "consultas": ["oro reacción decisión de la Fed dólar",
                   "oro sube tensión guerra inversores refugio",
                   "oro analistas proyección mercado esta semana",
                   "bancos centrales compra de oro reservas"],
     # 'oro' va con borde de palabra (el matcher lo garantiza), así que no pega
     # con "La Oroya" ni con "tesoro". Se pide además que hable de mercado:
     # "oro olímpico" y "bodas de oro" no son noticia de Buenaventura.
     "debe": (("oro", "precio*"), ("oro", "cotizacion"), ("oro", "onza"),
              ("oro", "maximo*"), ("oro", "record"), ("oro", "dolar*"),
              ("oro", "refugio"), ("oro", "reserva*"), ("oro", "mercado*"),
              "onza de oro", "lingote*"),
     "claves": (("oro", "onza"), ("oro", "record"), ("oro", "maximo*"),
                ("oro", "cotizacion"), ("oro", "refugio"), "onza de oro",
                ("oro", "sube"), ("oro", "cae"), ("oro", "dispara"),
                ("oro", "dolar*"), ("oro", "fed"), ("oro", "metales"),
                ("metales preciosos", "precio*"), ("plata", "maximo*")),
     "sectores": ["minas"],
     "afecta": [
         {"via": "el oro es lo que sacan de la tierra: su precio ES su ingreso, "
                 "y lo fija Londres, no Lima",
          "tickers": ["BVN", "PODERC1", "MINSURI1", "PPX"]},
         {"via": "un oro en máximos suele arrastrar a toda la minería del "
                 "índice, aunque no saquen oro",
          "tickers": ["ETFPERUD", "ETFPESOV"]},
     ]},

    {"id": "china", "titulo": "China: demanda y acero", "icono": "🇨🇳",
     "queEs": "China compra la mitad del cobre del mundo y exporta el acero que "
              "sobra. Es cliente de unas y competencia de otras — y de ahí salen "
              "los antidumping.",
     "consultas": ["China demanda de cobre economía",
                   "China exportaciones de acero sobreoferta",
                   "estímulo económico China construcción"],
     # "Chile busca US$100 mil millones para la industria del cobre" salió de
     # preguntar por cobre y China, y no es noticia de China.
     "debe": ("china", "chin*", "pekin", "beijing"),
     "claves": (("china", "cobre"), ("china", "acero"), ("china", "economia"),
                ("china", "manufactur*"), ("china", "estimulo"),
                ("china", "demanda"), ("chino*", "acero")),
     "sectores": ["minas", "acereras"],
     "afecta": [
         {"via": "es el comprador más grande del planeta para lo que producen",
          "tickers": ["CVERDEC1", "SCCO", "NEXAPEC1", "VOLCABC1", "ATACOBC1"]},
         {"via": "el acero chino barato es su competencia directa en el mercado "
                 "peruano: es el origen de las medidas antidumping",
          "tickers": ["SIDERC1", "CORAREI1"]},
     ]},

    {"id": "aranceles", "titulo": "Aranceles y comercio", "icono": "🚢",
     "queEs": "Un arancel no cambia cuánto acero hay en el mundo: cambia a dónde "
              "va. Cuando EE. UU. cierra una puerta, ese acero busca otra — y "
              "algunas dan al Perú.",
     "consultas": ["aranceles Estados Unidos acero importaciones",
                   "guerra comercial aranceles mercados",
                   "antidumping acero medida comercial"],
     "debe": ("arancel*", "antidumping", "acero", "comercio exterior",
              "guerra comercial", "seccion 232", "cuota*"),
     "claves": ("arancel*", "antidumping", "guerra comercial", "seccion 232",
                ("acero", "importacion*"), ("acero", "comercio")),
     "sectores": ["acereras", "minas", "diversas"],
     "afecta": [
         {"via": "cada arancel redirige el acero del mundo, y parte termina "
                 "compitiendo con el suyo acá",
          "tickers": ["SIDERC1", "CORAREI1"]},
         {"via": "exportan a un mundo que se está poniendo más caro de cruzar",
          "tickers": ["CVERDEC1", "SCCO", "MINSURI1", "NEXAPEC1"]},
     ]},
]

# ── LA RED DE BARRIDO: portadas completas de la prensa que sí cubre esto ───
# Se lee TODO el feed y se marca lo que toca a nuestro universo. Es la red que
# encuentra lo que uno no sabía preguntar, y el seguro para el día que Google
# News devuelva vacío. Probados el 01-ago-2026; si uno cae, se salta solo.
FEEDS = [
    ("Gestión", "https://gestion.pe/arcio/rss/"),
    ("Gestión", "https://gestion.pe/arcio/rss/category/economia/"),
    ("Gestión", "https://gestion.pe/arcio/rss/category/tu-dinero/"),
    ("El Comercio", "https://elcomercio.pe/arcio/rss/category/economia/"),
    ("Rumbo Minero", "https://www.rumbominero.com/feed/"),
    ("Energiminas", "https://energiminas.com/feed/"),
    ("Minería en Línea", "https://mineriaenlinea.com/feed/"),
    ("ProActivo", "https://proactivo.com.pe/feed/"),
]

# ── LA RED DE BARRIDO DEL MUNDO ────────────────────────────────────────────
# El mismo mecanismo que arriba, pero para la capa 🌍. Hasta acá el mundo
# dependía SOLO de la red dirigida, o sea de lo que Google News decidiera
# mostrar en español ese día — y se notaba: 37 titulares repartidos en 30
# medios, casi todos prensa regional rebotando el cable de otro (Emisora Costa
# del Sol 93.1 FM, rosariofinanzas.ar, La Region Tamaulipas). Para el Perú
# había seis portadas ancladas y especializadas; para el mundo, la lotería.
#
# Estas cinco se probaron el 02-ago-2026 y respondieron: Bloomberg Línea (100
# items), El País-Economía (39), Expansión (49), FXStreet (30), France24-ES
# (30). Se descartaron en la misma prueba: El Economista MX (HTTP 403), Reuters
# (ya no publica RSS público) y DW Economía (devuelve 0 items).
#
# CNBC se quedó fuera aunque era la mejor fuente de todas: publica en inglés y
# los coladores de este robot están escritos en español normalizado. Meterla
# pedía duplicar cada `claves` en dos idiomas, y media casa en inglés en una
# app que es toda en español es peor que una fuente menos.
FEEDS_MUNDO = [
    ("Bloomberg Línea", "https://www.bloomberglinea.com/arc/outboundfeeds/rss/?outputType=xml"),
    ("El País", "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada"),
    ("FXStreet", "https://www.fxstreet.es/rss/news"),
    ("France 24", "https://www.france24.com/es/econom%C3%ADa/rss"),
    ("Expansión", "https://e00-expansion.uecdn.es/rss/economia.xml"),
]

# ── Medios que generan páginas automáticas por ticker: son ruido, no noticia.
# (Visto 31-jul-2026: "Desglose de los ingresos de Corporacion Aceros Arequipa
#  SA, BVL:CORAREC1 - TradingView" — eso no lo escribió nadie. Y TradingKey
#  llenaba a Pacasmayo con "Análisis de PE, PB y Valor Razonable" en serie.)
# Se van también las redes: un post de Facebook no es una fuente de prensa.
MEDIOS_RUIDO = ("tradingview", "tradingkey", "simplywall.st", "marketscreener",
                "investing.com", "msn.com", "stockinvest", "wallmine", "barchart",
                "insidertrades", "zacks.com", "benzinga", "stocktwits",
                "facebook.com", "twitter.com", "x.com/", "youtube.com", "tiktok.com",
                "archdaily",
                # Granjas de traducción automática: el 01-ago-2026 metieron 5 de
                # los 6 primeros titulares del tema «oro y plata», todas sobre
                # el precio del oro EN VIETNAM. No es prensa, es relleno.
                "vietnam.vn", ".vn/", "vietnamnet")

# ── Titulares-plantilla: los escribe un robot todos los días con el mismo
# molde y solo cambia la fecha ("Precios del oro hoy, 1 de agosto..."). No son
# noticia: son una cotización con forma de titular, y si entran se comen el
# muro — el precio ya lo tiene la app, y mejor.
#
# Va también el periodismo de servicio, que es el otro relleno diario: "Link
# oficial de la ONPE con DNI", "¿Cuánto se paga de multa por no ser miembro de
# mesa?". Está bien escrito y no le sirve de nada a alguien mirando la bolsa.
# (Medido el 01-ago-2026: 4 de los 6 primeros del tema «política» eran eso.)
#
# Y el cable diario de la BVL ("Bolsa de Valores de Lima presenta pérdidas en
# sintonía con Wall Street"), que sale idéntico todos los días: eso ya lo
# cuenta HoyBVL con el número real, no con un adjetivo.
TITULARES_RELLENO = re.compile(
    r"(precios? (del|de la|de los) [\wáéíóúñ]+ (hoy|en per[uú])\b)"
    r"|(tipo de cambio [\wáéíóúñ]{0,12} ?(hoy|en per[uú])\b)"
    r"|(en cu[aá]nto cerr[oó] el d[oó]lar)|(a cu[aá]nto (est[aá]|cerr[oó]) el d[oó]lar)"
    r"|(\bhor[oó]scopo\b)|(\bloter[ií]a\b)|(\bquiniela\b)|(\btinka\b)"
    r"|(\bmiembros? de mesa\b)|(link oficial)|(consulta (aqu[ií]|si eres|tu |el ))"
    r"|(horarios? de atenci[oó]n)|(a qu[eé] hora (abre|abren|cierra|cierran))"
    r"|(¿abren? los)|(¿abrir[aá]n)"
    r"|(bolsa de valores de lima (presenta|inicia|cierra|abre|opera))"
    r"|(mercado del oro en la (ma[ñn]ana|tarde))"
    # Los moldes de la prensa financiera internacional: los mismos de siempre
    # con otro nombre. FXStreet e Investing publican varios al día.
    # "Pronóstico del precio del oro: XAU/USD apunta a…" no es una noticia, es
    # un gráfico con forma de titular — y el precio ya lo tiene la app, mejor.
    r"|(pron[oó]stico (del|de la) (precio|cotizaci[oó]n))"
    r"|(an[aá]lisis t[eé]cnico)|(niveles? clave)"
    r"|(futuros de (las acciones|wall street))"
    r"|(antes de la apertura del mercado)"
    r"|(qu[eé] esperar (del|de los) mercados?)",
    re.IGNORECASE)


def sesion():
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
    })
    return s


# ── Texto normalizado: sin tildes y en minúsculas. Sin esto, «Compañía» y
# «Compania» son dos cosas distintas y el colador deja pasar (o bota) al azar.
def norm(txt):
    limpio = unicodedata.normalize("NFD", txt or "")
    limpio = "".join(c for c in limpio if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", limpio.lower()).strip()


def _re_clave(clave):
    """Una clave a regex con bordes de palabra. 'siderur*' = prefijo (pega con
    siderurgia y siderúrgico); sin '*' exige la palabra completa, que es lo que
    evita que «oro» pegue con «La Oroya» o «tesoro»."""
    c = norm(clave)
    prefijo = c.endswith("*")
    if prefijo:
        c = c[:-1]
    fin = "" if prefijo else r"(?![a-z0-9])"
    return re.compile(r"(?<![a-z0-9])" + re.escape(c) + fin)


_CACHE_RE = {}


def coincide(texto_norm, clave):
    """¿El titular contiene esta clave? Una tupla exige TODAS sus partes."""
    if isinstance(clave, tuple):
        return all(coincide(texto_norm, c) for c in clave)
    rx = _CACHE_RE.get(clave)
    if rx is None:
        rx = _CACHE_RE[clave] = _re_clave(clave)
    return rx.search(texto_norm) is not None


def alguna(texto_norm, claves):
    return any(coincide(texto_norm, c) for c in claves)


def etiquetar(titulo):
    t = norm(titulo)
    for nombre, icono, claves in TIPOS:
        if any(k in t for k in claves):
            return nombre, icono, PESOS[nombre]
    return "general", "📰", PESOS["general"]


# ── Etiqueta por palabras clave: mismo vocabulario que catalizadores.json,
# para que la app pueda usar el ícono que ya conoce. Es clasificación por
# palabras, no comprensión — por eso "tipo" es una pista, no un veredicto.
#
# EL ORDEN IMPORTA Y ES LA MITAD DEL TRABAJO. Gana el primero que pega, así
# que todo lo que mueve un precio se pregunta ANTES que 'corporativo'. Por eso
# "BCP explica el aumento del uso de tarjetas de crédito" sale operativo y no
# nota de prensa, aunque diga "inclusión financiera".
TIPOS = [
    # Va PRIMERO y no es un detalle: casi todo anuncio de dividendo dice
    # "con cargo a utilidades acumuladas", y con 'resultados' arriba se lo
    # tragaba entero — el único tipo que la medición respaldó (2.87×) quedaba
    # etiquetado como el montón.
    ("dividendo", "💰", ("dividendo", "reparto", "junta de accionistas")),
    ("resultados", "📊", ("utilidad", "ingresos", "ganancia", "perdida", "resultados",
                          "ebitda", "trimestre", "facturacion", "ventas", "margen",
                          "semestre", "balance")),
    ("legal", "⚖️", ("demanda", "multa", "sancion", "arbitraje", "indecopi", "sunat",
                     "fiscalia", "tribunal", "ciadi", "juicio", "apelacion")),
    ("riesgo", "⚠️", ("huelga", "paro ", "conflicto", "derrame", "accidente", "cierre",
                      "suspende", "bloqueo", "protesta", "caida", "falla", "comunidad",
                      "comuneros", "invasion", "atentado", "extorsion", "mutilar")),
    ("expansion", "🏗️", ("inversion", "invertira", "proyecto", "planta", "amplia",
                          "expansion", "adquiere", "compra de", "fusion", "opa",
                          "permiso", "eia", "construccion de")),
    ("operativo", "⚙️", ("produccion", "despachos", "toneladas", "contrato", "licitacion",
                         "exporta", "gerente", "directorio", "concesion", "suministro",
                         "tarifa", "credito", "colocaciones", "morosidad", "demanda de",
                         "capacidad", "mina ", "planta ")),
    # ── LA NOTA DE PRENSA. No es mentira ni es basura: es la empresa contando
    # algo bueno de sí misma. Pero un premio del MINAM, una recertificación de
    # Buen Empleador o una alianza con UNICEF NO mueven una acción, y cuando el
    # Radar las pone al lado de un +10.5% está diciendo una tontería. Se
    # recogen igual (a veces son lo único que hay), pero pesan CERO: nunca
    # encabezan y nunca se ofrecen como explicación de un movimiento.
    ("corporativo", "🏢", ("sostenib", "sustentabilid", "responsabilidad social",
                           "buen empleador",
                           "great place", "voluntariado", "donacion", "dono ",
                           "aniversario", "premio", "galardon", "reconocimiento",
                           "reconocimientos", "becas", "huella de carbono", "unicef",
                           "campana escolar", "firman convenio", "suscriben convenio",
                           "firman alianza", "alianza estrategica", "ranking merco",
                           "se suma a", "celebra", "reafirma su compromiso")),
]

# ── EL PESO: cuánto te dice a TI este titular sobre por qué se movió algo.
#
# LO QUE NO ES, Y ESTO SE MIDIÓ: no es un predictor. La primera versión de esta
# tabla decía que legal y riesgo pesaban lo máximo porque "un juicio y una
# huelga mueven una acción". Sonaba obvio. Se comprobó contra un año de prensa
# (2,259 titulares) y los cierres reales — extractor/estudio_noticias.py — y
# midiendo cada titular contra lo que ESA acción hace un día cualquiera:
#
#     dividendo 2.87 · operativo 1.26 · resultados 1.25 · corporativo 1.25
#     general 1.21 · expansion 1.11 · riesgo 1.10 · legal 0.88
#     (1.00 = un martes sin noticias)
#
# Tres cosas dijo esa medición y las tres van acá:
#   1. legal y riesgo NO son los que más mueven: legal está POR DEBAJO de un día
#      cualquiera. En este mercado la mayoría de lo "legal" es regulatorio
#      menudo — una multa de Indecopi de S/ 20,790 a un banco que gana miles de
#      millones no mueve nada, y "multa" salió 0.76. Bajan a 2.
#   2. dividendo es el único que se separa de verdad (2.87×). Se queda en 3, y
#      es lo único que esta tabla se ganó con datos.
#   3. corporativo mide 1.25, IGUAL que todo lo demás. Se queda en 0 igual, y el
#      motivo cambia: no es que no mueva el precio —eso no se pudo demostrar—
#      es que no te dice NADA sobre por qué. Poner «recertificación como Buen
#      Empleador» al lado de un +10.5% no informa aunque coincida. Ese 0 es una
#      decisión editorial declarada, no un hallazgo.
PESOS = {"dividendo": 3,
         "resultados": 2, "operativo": 2, "legal": 2, "riesgo": 2, "expansion": 2,
         "general": 1,
         "corporativo": 0}


def partir_titular(bruto):
    """Google News arma el título como 'Titular - Medio'. Los separamos para
    poder mostrar la fuente aparte (y para filtrar los medios-robot)."""
    if " - " in bruto:
        titulo, medio = bruto.rsplit(" - ", 1)
        return titulo.strip(), medio.strip()
    return bruto.strip(), ""


def util(titulo, medio, url):
    """El colador común a las dos redes: fuera medios-robot y titulares-molde."""
    fuente = norm(medio + " " + url)
    if any(m in fuente for m in MEDIOS_RUIDO):
        return False
    return not TITULARES_RELLENO.search(titulo)


def leer_items(s, url, params=None):
    """Un RSS cualquiera -> lista de (titulo_bruto, url, datetime). None si
    FALLÓ (None y lista vacía son cosas distintas: fallo != no hay noticias)."""
    try:
        r = s.get(url, params=params, timeout=30)
        r.raise_for_status()
        raiz = ET.fromstring(r.content)
    except Exception as e:
        return None, type(e).__name__

    salida = []
    for it in raiz.findall(".//item"):
        bruto = (it.findtext("title") or "").strip()
        enlace = (it.findtext("link") or "").strip()
        if not bruto or not enlace:
            continue
        try:
            dt = parsedate_to_datetime(it.findtext("pubDate") or "")
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        except Exception:
            continue
        salida.append((bruto, enlace, dt))
    return salida, None


# ── EL FILTRO APRENDIDO, con su propia compuerta ───────────────────────────
# extractor/estudio_noticias.py entrena un filtro con la prensa vieja y los
# cierres reales, y escribe filtro_noticias.json. Ese archivo trae su propia
# nota: `fueraDeMuestra.separa`, que dice si el filtro le ganó al azar en los
# meses que nunca vio.
#
# HOY VALE FALSE, y por eso acá no pasa nada. Se probaron 3,369 titulares de 19
# meses y 108 configuraciones: el mejor sacó +5.2 puntos sobre la base, pero
# barajando los precios al azar —rompiendo a propósito toda relación entre
# titular y movimiento— el azar llegaba a +6.2 y ganaba 1 de cada 10 veces. Un
# filtro que no le gana a los datos revueltos no es un filtro, es una ilusión
# ordenada. Así que queda escrito, medido y APAGADO.
#
# La compuerta no es decoración: el archivo de prensa ahora crece todos los
# días (fetch_noticias fusiona en vez de pisar). Cuando haya corpus suficiente,
# basta con volver a correr `estudio_noticias.py --aprender`: si esa vez le
# gana al azar, `separa` pasa a true y el filtro se enciende solo, sin tocar
# una línea. Y si no, sigue apagado. La decisión la toma la medición, no yo.
def _cargar_filtro():
    ruta = os.path.join(APP_DATA, "filtro_noticias.json")
    if not os.path.exists(ruta):
        return None
    try:
        with open(ruta, encoding="utf-8") as f:
            d = json.load(f)
    except Exception:
        return None
    if not (d.get("fueraDeMuestra") or {}).get("separa"):
        return None
    return d.get("palabras") or None


FILTRO_APRENDIDO = _cargar_filtro()


def ajustar_por_filtro(titulo, peso):
    """Sube o baja un escalón según lo aprendido. Nunca resucita a un peso 0
    (esa es una decisión editorial, no estadística) ni pasa de 3."""
    if not FILTRO_APRENDIDO or peso == 0:
        return peso
    t = norm(titulo)
    lifts = [v for k, v in FILTRO_APRENDIDO.items() if k in t]
    if not lifts:
        return peso
    mejor = max(lifts)
    if mejor >= 1.4:
        return min(3, peso + 1)
    if mejor <= 0.7:
        return max(1, peso - 1)
    return peso


def a_noticia(titulo, medio, url, dt):
    tipo, icono, peso = etiquetar(titulo)
    peso = ajustar_por_filtro(titulo, peso)
    # OJO: no se guarda "hace N días". Sería un dato calculado HOY que
    # envejece dentro del JSON y mentiría mañana — la antigüedad la saca la
    # app de la fecha, que sí es un hecho.
    return {
        "fecha": dt.astimezone(timezone.utc).date().isoformat(),
        # LA HORA, que hasta el 02-ago-2026 se tiraba. El RSS siempre la trajo
        # y `.date()` se la comía. Sin ella, "salió el mismo día que se movió"
        # es lo máximo que se puede afirmar; con ella se puede preguntar si el
        # titular salió ANTES o DESPUÉS del salto — que es la única forma de
        # que una coincidencia de fechas deje de ser una casualidad barata.
        #
        # Va en hora de LIMA y en campo aparte: 'fecha' se queda en UTC como
        # siempre para no romper lo que ya está guardado ni la fusión, que
        # compara fechas entre corridas.
        "cuando": dt.astimezone(LIMA).isoformat(timespec="minutes"),
        "titulo": titulo,
        "medio": medio,
        "url": url,
        "tipo": tipo,
        "icono": icono,
        # Cuánto puede explicar un movimiento (0 = nada). El Radar ordena y
        # filtra por esto: es lo que separa "candente" de "salió en el diario".
        "peso": peso,
    }


# ═══ RED 1: la dirigida (Google News) ══════════════════════════════════════

def consultar(s, texto, hoy, debe=None, pais=None):
    """Una consulta al RSS de Google News. `debe` es el colador: si viene, el
    titular tiene que nombrar a la empresa. `pais` cambia el lente (Perú por
    defecto, EE. UU. para los temas de mundo). Devuelve None si falló."""
    items, err = leer_items(s, RSS, {"q": texto, **(pais or PAIS)})
    if items is None:
        print(f"    ⚠ falló la consulta ({err}) — sigo con lo que había")
        return None

    salida = []
    for bruto, url, dt in items:
        dias = (hoy - dt).days
        if dias > DIAS_VENTANA or dias < 0:
            continue
        titulo, medio = partir_titular(bruto)
        if not util(titulo, medio, url):
            continue
        if debe and not alguna(norm(titulo), debe):
            continue
        salida.append(a_noticia(titulo, medio, url, dt))
    return salida


# ═══ RED 2: el barrido de portadas ═════════════════════════════════════════

def barrer_feeds(s, hoy, coladores):
    """Lee las portadas enteras y reparte cada titular a quien le toque: a una
    empresa si la nombra, a un tema si habla de lo suyo. Un mismo titular puede
    caer en los dos (el antidumping es de Siderperú Y del acero) — eso está
    bien: son dos vistas distintas del mismo hecho, y la app los cruza."""
    por_empresa = {}
    temas = {}
    leidos = 0

    for medio, url in FEEDS:
        items, err = leer_items(s, url)
        if items is None:
            print(f"  ⚠ {medio:18} no respondió ({err}) — sigo")
            continue
        usados = 0
        for bruto, enlace, dt in items:
            dias = (hoy - dt).days
            if dias > DIAS_VENTANA or dias < 0:
                continue
            # OJO: acá NO se parte por " - ". El feed del medio ya dice de qué
            # medio es, y partir rompería titulares con guion en el medio.
            titulo = bruto.strip()
            if not util(titulo, medio, enlace):
                continue
            t = norm(titulo)
            n = a_noticia(titulo, medio, enlace, dt)
            pegado = False
            for ticker, debe in coladores.items():
                if debe and alguna(t, debe):
                    por_empresa.setdefault(ticker, []).append(dict(n))
                    pegado = True
            for tema in TEMAS:
                if alguna(t, tema["claves"]):
                    temas.setdefault(tema["id"], []).append(dict(n))
                    pegado = True
            if pegado:
                usados += 1
        leidos += usados
        print(f"  {medio:18} {len(items):3} en portada -> {usados} nos tocan")
        time.sleep(PAUSA)

    return por_empresa, temas, leidos


# ═══ FUSIÓN: lo nuevo + lo que ya había ════════════════════════════════════

def clave_titular(n):
    """Dos coberturas del mismo hecho comparten titular casi exacto aunque el
    enlace difiera (Google redirige, el medio no). Se cruza por titular, no por
    URL, si no la misma nota entra dos veces."""
    return norm(n.get("titulo", ""))[:70]


def fusionar(nuevos, previos, hoy, limite, debe=None, prefiere=None):
    """El archivo CRECE: lo nuevo manda, lo viejo sobrevive mientras esté
    dentro de la ventana. Así una corrida diaria arma 20 días de prensa en vez
    de la foto de hoy — que era lo que se perdía cuando el feed de un medio
    solo guarda sus últimos 10 titulares.

    TODO el colador (medios-robot, titulares-molde y las palabras que el titular
    debe contener) se le pasa TAMBIÉN a lo que ya estaba guardado. Sin eso, cada
    mejora del filtro solo servía para adelante y la basura vieja se quedaba
    clavada hasta vencerse sola: el archivo todavía mostraba "La independencia
    del Perú también se escribió desde Trujillo" como noticia del BBVA, porque
    la había guardado la versión anterior del robot, que miraba el nombre del
    medio en vez del titular."""
    fuera = set()
    salida = []
    for n in list(nuevos or []) + list(previos or []):
        if not n.get("titulo") or not n.get("url") or not n.get("fecha"):
            continue
        if not util(n["titulo"], n.get("medio", ""), n["url"]):
            continue
        if debe and not alguna(norm(n["titulo"]), debe):
            continue
        try:
            dt = datetime.fromisoformat(n["fecha"]).replace(tzinfo=timezone.utc)
        except Exception:
            continue
        if (hoy - dt).days > DIAS_VENTANA:
            continue
        k = clave_titular(n)
        if k in fuera:
            continue
        fuera.add(k)
        # Se reetiqueta TODO, también lo que venía guardado: así, cuando el
        # vocabulario mejora, el archivo entero se corrige solo en vez de
        # arrastrar la clasificación con la que se guardó.
        n["tipo"], n["icono"], n["peso"] = etiquetar(n["titulo"])
        salida.append(n)

    # EL TOPE, en dos pasos y a propósito:
    #   · se CORTA por peso y luego por fecha, para que una nota de prensa de
    #     hoy no eche del archivo a los resultados del trimestre. UNACEM tenía
    #     5 de 9 titulares en modo "reconocimiento del MINAM": sin esto, un mes
    #     movido se guardaría entero en premios.
    #   · se GUARDA por fecha, porque el archivo es una línea de tiempo. Quién
    #     encabeza lo decide el Radar, que es el único que sabe si la acción se
    #     movió.
    #   · y a igual peso Y MISMO DÍA gana el medio ANCLADO. Este desempate
    #     existe solo para la capa 🌍: sin él, anclar Bloomberg Línea y El País
    #     no servía de nada — sus titulares competían de igual a igual con el
    #     medio regional que rebota el mismo cable, y como casi todos comparten
    #     fecha, el corte quedaba al azar del recorrido. Va DESPUÉS de la fecha
    #     a propósito: un Bloomberg de hace una semana no debe tapar a un
    #     titular de hoy, por bueno que sea el medio.
    ancla = prefiere or set()
    salida.sort(key=lambda n: (n.get("peso", 1), n["fecha"],
                               norm(n.get("medio", "")) in ancla), reverse=True)
    salida = salida[:limite]
    salida.sort(key=lambda n: n["fecha"], reverse=True)
    return salida


def consultas_de(ticker, nombre_legal):
    """Las consultas LISTAS para mandar, y el colador. Si el ticker no está en
    la tabla escrita a mano, se cae al nombre legal sin sus sufijos."""
    if ticker in PRENSA:
        return PRENSA[ticker]  # consultas puede ser None a propósito (ETF)
    limpio = BASURA_NOMBRE.sub("", nombre_legal or "").strip(" -.,")
    limpio = re.sub(r"\s{2,}", " ", limpio)
    if not limpio:
        return None, ()
    return [f'"{limpio}"'], (limpio,)


def barrer_mundo(s, hoy):
    """Las portadas internacionales, repartidas entre los temas de 🌍 MUNDO.

    DOS DIFERENCIAS con el barrido peruano, las dos a propósito:

    1) Acá NO hay reparto a empresas. Ninguna portada de El País va a nombrar a
       Siderperú, y si lo hiciera ya la agarra la red peruana. El mundo entra
       como CONTEXTO de un tema, jamás como noticia de una acción — si entrara
       por la puerta de la empresa, la app terminaría diciendo «Cerro Verde: la
       Fed sube tasas», que es la frase exacta que este diseño existe para
       evitar.

    2) Se exige PESO > 0 — el filtro de noticias buenas, en su versión dura. En
       Perú un titular de peso 0 (la nota de prensa: un premio, una
       recertificación, un convenio con UNICEF) se guarda igual, porque a veces
       es lo único que hay de esa empresa y verlo tiene valor. En el mundo no:
       si un titular internacional no es capaz de mover nada, no es contexto de
       mercado, es relleno — y acá CADA línea le está colgando una cadena a
       ocho acciones peruanas. El costo de un falso positivo es mucho más alto.
    """
    mundo = {}
    leidos = 0
    for medio, url in FEEDS_MUNDO:
        items, err = leer_items(s, url)
        if items is None:
            print(f"  ⚠ {medio:18} no respondió ({err}) — sigo")
            continue
        usados = 0
        for bruto, enlace, dt in items:
            dias = (hoy - dt).days
            if dias > DIAS_VENTANA or dias < 0:
                continue
            titulo, medio_real = partir_titular(bruto)
            if not util(titulo, medio_real or medio, enlace):
                continue
            leidos += 1
            n = a_noticia(titulo, medio_real or medio, enlace, dt)
            if n["peso"] <= 0:
                continue
            t_norm = norm(titulo)
            for tema in MUNDO:
                if alguna(t_norm, tema["claves"]):
                    mundo.setdefault(tema["id"], []).append(dict(n))
                    usados += 1
        print(f"  {medio:18} {len(items):3} en portada -> {usados} al mundo")
    return mundo, leidos


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    solo_temas = "--temas" in sys.argv
    solo_mundo = "--mundo" in sys.argv
    solo_feeds = "--feeds" in sys.argv
    sin_feeds = "--sin-feeds" in sys.argv

    with open(os.path.join(AQUI, "empresas_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    with open(os.path.join(APP_DATA, "historicos.json"), encoding="utf-8") as f:
        historicos = json.load(f).get("historicos", {})

    # Lo que ya teníamos: no es un paracaídas, es el archivo. Se fusiona.
    previo = {"porEmpresa": {}, "temas": {}}
    if os.path.exists(SALIDA):
        try:
            with open(SALIDA, encoding="utf-8") as f:
                previo = json.load(f)
        except Exception:
            pass
    prev_emp = previo.get("porEmpresa") or {}
    prev_tem = previo.get("temas") or {}
    prev_mun = previo.get("mundo") or {}

    # Solo las que se negocian de verdad (misma regla que el Radar).
    objetivo = []
    for e in cfg["empresas"]:
        t = e["ticker"]
        if args and t not in args:
            continue
        h = historicos.get(t)
        if not h or h.get("pocoNegociada"):
            continue
        consultas, debe = consultas_de(t, e.get("nombre"))
        if consultas:
            objetivo.append((t, consultas, debe))

    s = sesion()
    hoy = datetime.now(timezone.utc)
    coladores = {t: debe for t, _, debe in objetivo}

    nuevos_emp = {}
    nuevos_tem = {}
    nuevos_mundo = {}

    # ── Red 2 primero, a propósito: así el enlace que sobrevive al cruce es el
    # directo al medio y no el redirect de Google News.
    if not sin_feeds and not args and not solo_mundo:
        print(f"🛰️  BARRIDO DE PORTADAS ({len(FEEDS)} feeds)")
        fe, ft, _ = barrer_feeds(s, hoy, coladores)
        for k, v in fe.items():
            nuevos_emp.setdefault(k, []).extend(v)
        for k, v in ft.items():
            nuevos_tem.setdefault(k, []).extend(v)

    # ── Red 1: la dirigida
    if not solo_feeds and not solo_temas and not solo_mundo:
        n_consultas = sum(len(c) for _, c, _ in objetivo)
        print(f"\n📰 EMPRESAS ({len(objetivo)} que se negocian · {n_consultas} consultas)")
        for ticker, consultas, debe in objetivo:
            traidos = []
            fallaron = 0
            for q in consultas:
                items = consultar(s, q, hoy, debe)
                if items is None:
                    fallaron += 1
                else:
                    traidos.extend(items)
                time.sleep(PAUSA)
            if fallaron == len(consultas):
                continue  # todas fallaron: no se toca lo que había
            nuevos_emp.setdefault(ticker, []).extend(traidos)
            print(f"  {ticker:10} {len(consultas)} consultas -> {len(traidos)} titulares")

    if not solo_feeds and not args and not solo_mundo:
        print(f"\n🌎 TEMAS de sector y macro ({len(TEMAS)})")
        for tema in TEMAS:
            traidos = []
            for q in tema["consultas"]:
                items = consultar(s, q, hoy)
                if items is not None:
                    traidos.extend(items)
                time.sleep(PAUSA)
            nuevos_tem.setdefault(tema["id"], []).extend(traidos)
            print(f"  {tema['id']:11} -> {len(traidos)} titulares")

    if not sin_feeds and not args and not solo_temas:
        print(f"  ")
        print(f"🛰️  BARRIDO DEL MUNDO ({len(FEEDS_MUNDO)} portadas internacionales)")
        fm, _ = barrer_mundo(s, hoy)
        for k, v in fm.items():
            nuevos_mundo.setdefault(k, []).extend(v)

    if not solo_feeds and not args and not solo_temas:
        print(f"\n🌍 MUNDO ({len(MUNDO)}) — con el lente de afuera (gl=US)")
        for tema in MUNDO:
            traidos = []
            for q in tema["consultas"]:
                items = consultar(s, q, hoy, debe=tema.get("debe"),
                                  pais=MUNDO_PAIS)
                if items is not None:
                    traidos.extend(items)
                time.sleep(PAUSA)
            nuevos_mundo.setdefault(tema["id"], []).extend(traidos)
            print(f"  {tema['id']:11} -> {len(traidos)} titulares")

    # ── Fusión con lo que ya había ────────────────────────────────────────
    por_empresa = {}
    for ticker in set(list(prev_emp.keys()) + list(nuevos_emp.keys())):
        por_empresa[ticker] = fusionar(
            nuevos_emp.get(ticker), prev_emp.get(ticker), hoy, MAX_POR_EMPRESA,
            debe=coladores.get(ticker) or PRENSA.get(ticker, (None, ()))[1] or None)

    temas = {}
    for tema in TEMAS:
        tid = tema["id"]
        # A los temas NO se les pasa `claves` acá a propósito: esas palabras
        # están hechas para RECONOCER el tema en una portada entera, no para
        # validar lo que ya trajo una consulta dirigida. Si se usaran de
        # colador, "Gobierno destraba 12 proyectos de saneamiento" —que salió
        # justo de preguntar por obras públicas— se caería por no decir la
        # palabra exacta. El colador de los temas es la consulta misma.
        items = fusionar(nuevos_tem.get(tid),
                         (prev_tem.get(tid) or {}).get("items"), hoy, MAX_POR_TEMA)
        temas[tid] = {
            "titulo": tema["titulo"], "icono": tema["icono"],
            "sectores": tema["sectores"],
            "consulta": " · ".join(tema["consultas"]),
            "items": items,
        }

    # 🌍 El mundo, con su cadena de transmisión escrita al lado. `afecta` viaja
    # al JSON tal cual: es lo que la app usa para decir «puede tocar a BVN» Y
    # por qué canal. Sin el canal la frase no se publica — la app no muestra un
    # ticker suelto colgado de un titular.
    mundo = {}
    for tema in MUNDO:
        tid = tema["id"]
        # A DIFERENCIA de los temas de sector, acá el colador SÍ se aplica en
        # la fusión: la consulta de un tema de sector ya es específica ("obras
        # públicas Perú"), pero la de mundo es ancha a propósito y sin el
        # colador el archivo se llenaría de prensa regional que ya pasó el
        # filtro una vez.
        items = fusionar(nuevos_mundo.get(tid),
                         (prev_mun.get(tid) or {}).get("items"), hoy,
                         MAX_POR_MUNDO, debe=tema.get("debe"),
                         prefiere={norm(m) for m, _ in FEEDS_MUNDO})
        mundo[tid] = {
            "titulo": tema["titulo"], "icono": tema["icono"],
            "queEs": tema["queEs"],
            "sectores": tema["sectores"],
            "afecta": tema["afecta"],
            "consulta": " · ".join(tema["consultas"]),
            "items": items,
        }

    salida = {
        "_comment": (
            "Titulares de prensa (SOLO título, fecha, medio y link — nunca el cuerpo "
            "de la nota, que es material con derechos de su medio). Generado por "
            "extractor/fetch_noticias.py con DOS redes: consultas dirigidas a Google "
            "News RSS y un barrido de las portadas RSS de la prensa peruana. El "
            "archivo se FUSIONA en cada corrida (no se reemplaza) y solo bota lo que "
            "pasó la ventana de días. NO reemplaza a hechos.json: los Hechos de "
            "Importancia son la fuente primaria y salen antes. Qué titular es "
            "'candente' NO se decide acá: lo decide el Radar cruzándolo con el "
            "precio (app/src/lib/radar.js)."
        ),
        "fuente": ("Google News RSS + RSS de "
                   + ", ".join(sorted({m for m, _ in FEEDS}))
                   + " — ninguna es API oficial"),
        "generado": hoy.astimezone().strftime("%Y-%m-%d %H:%M"),
        "ventanaDias": DIAS_VENTANA,
        "porEmpresa": por_empresa,
        "temas": temas,
        "mundo": mundo,
    }
    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=1)

    n_emp = sum(len(v) for v in por_empresa.values())
    n_tem = sum(len(v.get("items", [])) for v in temas.values())
    n_mun = sum(len(v.get("items", [])) for v in mundo.values())
    con_algo = sum(1 for v in por_empresa.values() if v)
    tocadas = {t for m in mundo.values() for a in m["afecta"] for t in a["tickers"]}
    print(f"\n✅ {SALIDA}")
    print(f"   {n_emp} titulares de empresa ({con_algo} empresas con prensa) "
          f"· {n_tem} de sector/macro · {n_mun} del mundo "
          f"(cadenas hacia {len(tocadas)} empresas) · ventana {DIAS_VENTANA} días")


if __name__ == "__main__":
    main()
