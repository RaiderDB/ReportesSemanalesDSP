"""
API endpoint: /api/datos
Obtiene reportes semanales con filtros opcionales.
"""
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import sys
import os

# Agregar directorio padre al path para importar _shared
sys.path.insert(0, os.path.dirname(__file__))
from _shared import (
    get_data_from_sheet, obtener_datos_de_multiples_hojas,
    df_to_reportes_list, _clear_cache
)
import pandas as pd


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)

            force_refresh = params.get('refresh', [''])[0] in ('1', 'true', 'True', 'si', 'SI')
            oficina = params.get('oficina', [''])[0]
            fecha_inicio = params.get('start', [''])[0]
            fecha_fin = params.get('end', [''])[0]
            hojas_param = params.get('hojas', [''])[0].strip()

            gids_a_usar = None
            if hojas_param:
                gids_a_usar = [gid.strip() for gid in hojas_param.split(',') if gid.strip()]

            # Obtener datos
            if force_refresh:
                _clear_cache()

            if gids_a_usar:
                df = obtener_datos_de_multiples_hojas(gids_a_usar, usar_cache=not force_refresh)
            else:
                df = get_data_from_sheet(force_refresh=force_refresh)

            if df.empty:
                self._send_json({'reportes': [], 'total': 0, 'oficinas': []})
                return

            # Obtener oficinas antes de filtrar
            oficinas = []
            if 'Oficina' in df.columns:
                oficinas = sorted(df['Oficina'].dropna().unique().tolist())

            # Filtrar por oficina
            if oficina and oficina != 'todas' and 'Oficina' in df.columns:
                df = df[df['Oficina'].str.contains(oficina, case=False, na=False)].copy()

            # Filtrar por fechas
            if fecha_inicio and fecha_fin:
                try:
                    start = pd.to_datetime(fecha_inicio).date()
                    end = pd.to_datetime(fecha_fin).date()

                    if 'Fecha_date' in df.columns:
                        df_filtrado = df[df['Fecha_date'].notna()].copy()
                        if not df_filtrado.empty:
                            df = df_filtrado[
                                (df_filtrado['Fecha_date'] >= start) &
                                (df_filtrado['Fecha_date'] <= end)
                            ].copy()
                    elif 'Fecha' in df.columns:
                        df_filtrado = df[df['Fecha'].notna()].copy()
                        if not df_filtrado.empty:
                            df_filtrado['Fecha_date'] = pd.to_datetime(df_filtrado['Fecha'], errors='coerce', dayfirst=True).dt.date
                            df_filtrado = df_filtrado[df_filtrado['Fecha_date'].notna()]
                            if not df_filtrado.empty:
                                df = df_filtrado[
                                    (df_filtrado['Fecha_date'] >= start) &
                                    (df_filtrado['Fecha_date'] <= end)
                                ].copy()
                except Exception as e:
                    print(f"[ERROR] Error filtrando fechas: {e}")

            # Ordenar por fecha descendente
            if 'Fecha' in df.columns:
                try:
                    df = df.sort_values('Fecha', ascending=False, na_position='last')
                except:
                    pass

            reportes = df_to_reportes_list(df)

            self._send_json({
                'reportes': reportes,
                'total': len(reportes),
                'oficinas': oficinas
            })

        except Exception as e:
            import traceback
            traceback.print_exc()
            self._send_json({'error': str(e), 'reportes': [], 'total': 0, 'oficinas': []}, 500)

    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, default=str).encode('utf-8'))
