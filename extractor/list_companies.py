# -*- coding: utf-8 -*-
"""Lista completa de empresas del dropdown SMV (value -> nombre)."""
import requests, json
from bs4 import BeautifulSoup

URL = "https://www.smv.gob.pe/SIMV/Frm_InformacionFinanciera?data=A70181B60967D74090DCD93C4920AA1D769614EC12"
s = requests.Session()
s.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36"})
r = s.get(URL, timeout=40)
soup = BeautifulSoup(r.text, "lxml")
sel = soup.find("select", {"id": "MainContent_cboDenominacionSocial"})
data = {}
for o in sel.find_all("option"):
    val = o.get("value")
    if val and val != "-1":
        data[val] = o.get_text(strip=True)

with open("empresas_smv.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=1)
print(f"Total: {len(data)} empresas guardadas en empresas_smv.json")

# imprimir todas para identificar sectores
for val, name in data.items():
    print(f"{val}\t{name}")
