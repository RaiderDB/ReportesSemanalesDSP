"""
Utilidades compartidas para las serverless functions de Reportes Semanales.
"""
import requests
import pandas as pd
from io import StringIO
import traceback
import time
import os

# ==========================================
# Configuración
# ==========================================
REQUEST_TIMEOUT = 30
CACHE_TTL = 300  # 5 minutos

# URL base de Google Sheets
GOOGLE_SHEET_BASE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRy9VF6sTD47qB_EsdB55otMF8mlRXhfJJtMlZ-QJhmmCITBRuODF9SEv_aLdojx8WYU802aKGwuvDz/pub"

# URL del CSV (se puede sobreescribir con variable de entorno)
GOOGLE_SHEET_REPORTES_SEMANALES = os.environ.get(
    'REPORTES_SEMANALES_CSV_URL',
    'https://docs.google.com/spreadsheets/d/1wQMpmaEPcn4L64QnFt-hiXeQ0uRAupKIp7mRCpAA4s8/export?format=csv&gid=1660346099'
)

# Configuración de múltiples hojas
HOJAS_CONFIG = {}

# Oficinas con dashboard HTML propio
OFICINAS_CON_DASHBOARD_HTML = {
    'OF. Resolución de Conflictos en Seguridad': {
        'nombre': 'OF. Resolución de Conflictos en Seguridad',
        'ruta': '/seguridad-comunitaria/resolucion-conflictos',
        'tiene_datos': False
    },
}

# ==========================================
# Caché simple en memoria (warm functions)
# ==========================================
_cache = {}

def _get_cached(key):
    """Obtiene un valor cacheado si no ha expirado."""
    if key in _cache:
        entry = _cache[key]
        if time.time() - entry['ts'] < CACHE_TTL:
            return entry['data']
    return None

def _set_cached(key, data):
    """Almacena un valor en caché."""
    _cache[key] = {'data': data, 'ts': time.time()}

def _clear_cache():
    """Limpia todo el caché."""
    _cache.clear()


# ==========================================
# Funciones de datos
# ==========================================
def construir_url_hoja(gid):
    """Construye la URL CSV para una hoja específica."""
    return f"{GOOGLE_SHEET_BASE_URL}?gid={gid}&single=true&output=csv"


def obtener_csv_desde_url(url, headers=None):
    """Obtiene CSV desde URL."""
    try:
        request_headers = headers or {}
        default_headers = {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
        default_headers.update(request_headers)
        response = requests.get(url, timeout=REQUEST_TIMEOUT, headers=default_headers)
        response.raise_for_status()
        response.encoding = 'utf-8'
        return response.text
    except Exception as e:
        print(f"[ERROR] Error obteniendo CSV desde {url}: {e}")
        raise


def procesar_csv(csv_text):
    """Procesa el CSV y retorna DataFrame."""
    try:
        lines = csv_text.strip().split('\n')
        header_index = 0
        keywords = ['Fecha', 'Nombre del Responsable', 'Oficina', 'Semana',
                     'Actividades Realizadas', 'Comentarios']
        for i, line in enumerate(lines[:20]):
            if any(keyword.lower() in line.lower() for keyword in keywords):
                header_index = i
                break

        df = pd.read_csv(StringIO(csv_text), header=header_index, low_memory=False)
        df.columns = df.columns.str.strip()

        column_mapping = {}
        if 'Nombre del Responsable' in df.columns:
            column_mapping['Nombre del Responsable'] = 'Responsable'
        if 'Actividades Realizadas' in df.columns:
            column_mapping['Actividades Realizadas'] = 'Actividades'
        if 'Fecha de Registro' in df.columns:
            column_mapping['Fecha de Registro'] = 'Fecha_Registro'

        df = df.rename(columns=column_mapping)
        df = df.dropna(how='all')

        if 'Fecha' in df.columns:
            df['Fecha'] = pd.to_datetime(df['Fecha'], errors='coerce', dayfirst=True)
            df['Fecha_date'] = df['Fecha'].dt.date

        return df
    except Exception as e:
        print(f"Error procesando CSV: {e}")
        traceback.print_exc()
        return pd.DataFrame()


def get_data_from_sheet(force_refresh=False, sheet_url=None):
    """Obtiene datos del Google Sheet con caché."""
    if sheet_url is None:
        sheet_url = GOOGLE_SHEET_REPORTES_SEMANALES

    cache_key = f"sheet_{sheet_url}"

    if not force_refresh:
        cached = _get_cached(cache_key)
        if cached is not None:
            return cached

    try:
        url = sheet_url
        if force_refresh:
            separator = '&' if '?' in url else '?'
            url = f"{url}{separator}_t={int(time.time())}"

        csv_text = obtener_csv_desde_url(url)
        df = procesar_csv(csv_text)
        _set_cached(cache_key, df)
        return df
    except Exception as e:
        print(f"Error obteniendo datos: {e}")
        traceback.print_exc()
        return pd.DataFrame()


def obtener_datos_de_multiples_hojas(gids=None, usar_cache=True):
    """Obtiene y combina datos de múltiples hojas."""
    if gids is None or not gids:
        return get_data_from_sheet(force_refresh=not usar_cache)

    dataframes = []
    for gid in gids:
        try:
            url = construir_url_hoja(gid)
            if not usar_cache:
                separator = '&' if '?' in url else '?'
                url = f"{url}{separator}_t={int(time.time())}"

            csv_text = obtener_csv_desde_url(url)
            df = procesar_csv(csv_text)
            if not df.empty:
                df['Hoja_Origen'] = HOJAS_CONFIG.get(gid, f'Hoja_{gid}')
                dataframes.append(df)
        except Exception as e:
            print(f"[WARNING] Error obteniendo datos de hoja {gid}: {e}")
            continue

    if dataframes:
        return pd.concat(dataframes, ignore_index=True)
    return pd.DataFrame()


def df_to_reportes_list(df):
    """Convierte DataFrame a lista de diccionarios formateados."""
    reportes = []
    for _, row in df.iterrows():
        reporte = {}
        for col in df.columns:
            valor = row[col]
            if 'Fecha' in col and pd.notna(valor):
                try:
                    if isinstance(valor, str):
                        fecha_dt = pd.to_datetime(valor, errors='coerce', dayfirst=True)
                        if pd.notna(fecha_dt):
                            reporte[col] = fecha_dt.strftime('%d/%m/%Y')
                        else:
                            reporte[col] = str(valor)
                    elif hasattr(valor, 'strftime'):
                        reporte[col] = valor.strftime('%d/%m/%Y')
                    else:
                        reporte[col] = str(valor)
                except:
                    reporte[col] = str(valor)
            else:
                reporte[col] = str(valor) if pd.notna(valor) else ''
        reportes.append(reporte)
    return reportes


def make_json_response(data, status=200):
    """Crea respuesta JSON para Vercel serverless."""
    import json
    body = json.dumps(data, ensure_ascii=False, default=str)
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        'body': body
    }
