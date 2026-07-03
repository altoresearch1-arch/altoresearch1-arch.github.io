# ALTO Research

App web **educativa** de la Bolsa de Valores de Lima (BVL). El usuario hace un quiz
(perfil × sector) y descubre **empresas para estudiar**. Es contenido educativo —
**no** es recomendación de inversión.

🌐 **En vivo:** https://altoresearch1-arch.github.io/

## Estructura

- **`app/`** — frontend React + Vite (PWA estática).
  - Desarrollo: `npm --prefix app run dev` (puerto 5173)
  - Build: `npm --prefix app run build` → `app/dist/`
- **`extractor/`** — scripts Python que bajan datos de BVL/SMV/stockanalysis y generan
  los JSON que consume la app (`app/src/data/`).
  - Todo en un comando: `python extractor/actualizar_todo.py`
  - Requisitos: `pip install -r extractor/requirements.txt`

## Robot diario (automático, en la nube)

Un workflow de GitHub Actions (`.github/workflows/deploy.yml`) corre de **lunes a
viernes por la noche (hora de Perú)**: baja los datos frescos de la BVL, corre la
auditoría, los guarda en el repo y republica la web. La PC no necesita estar prendida.

También se puede lanzar a mano desde la pestaña **Actions → Run workflow**.

## Reglas de oro

Cero datos inventados · fuentes oficiales · lenguaje simple · **la app educa, no
recomienda**. (Detalle en `ALTO_PROYECTO_COMPLETO.md`.)
