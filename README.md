# Reportes Semanales - DIPRESEH

Dashboard de Reportes Semanales de la Municipalidad de Arica - DIPRESEH.

Aplicación standalone desplegada en **Vercel** que consume datos en tiempo real desde Google Sheets.

## Tecnologías

- **Backend**: Python serverless functions (Vercel)
- **Frontend**: HTML + Tailwind CSS + JavaScript
- **Datos**: Google Sheets (CSV público)
- **Exportación**: jsPDF + AutoTable para generación de PDFs

## Estructura

```
api/           → Serverless functions (Python)
  _shared.py   → Utilidades compartidas (caché, procesamiento CSV)
  datos.py     → GET /api/datos — reportes con filtros
  dashboard.py → GET /api/dashboard — stats por oficina
  hojas.py     → GET /api/hojas — listar hojas configuradas
  todas_las_hojas.py → GET /api/todas-las-hojas — combinar hojas

public/        → Archivos estáticos
  index.html   → Vista principal de reportes
  css/         → Estilos (styles.css, glass-effect.css, navbar.css)
  js/          → Scripts (reportes.js, gradient-background.js, navbar.js)
  img/         → Logos e imágenes
```

## Despliegue

```bash
# Instalar Vercel CLI (si no la tienes)
npm i -g vercel

# Desplegar
vercel --prod
```

## Variables de Entorno (opcionales)

| Variable | Descripción |
|---|---|
| `REPORTES_SEMANALES_CSV_URL` | URL del CSV de Google Sheets (por defecto usa la URL hardcodeada) |

## Desarrollo Local

```bash
# Con Vercel CLI
vercel dev
```
