"""
API endpoint: /api/dashboard
Dashboard principal con estadísticas por oficina.
"""
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from _shared import (
    get_data_from_sheet, _clear_cache, OFICINAS_CON_DASHBOARD_HTML
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

            if force_refresh:
                _clear_cache()

            df = get_data_from_sheet(force_refresh=force_refresh)

            # Reemplazar NaN por None
            try:
                df = df.where(pd.notna, None)
            except:
                pass

            if df.empty:
                self._send_json({
                    'oficinas': [],
                    'total_general': 0,
                    'estadisticas': {}
                })
                return

            # Agrupar por oficina
            oficinas_stats = []
            oficinas_con_datos = set()

            if 'Oficina' in df.columns:
                oficinas_unicas = df['Oficina'].dropna().unique()

                for oficina in oficinas_unicas:
                    oficinas_con_datos.add(oficina)
                    df_oficina = df[df['Oficina'] == oficina].copy()

                    total_reportes = len(df_oficina)

                    # Último reporte
                    ultimo_reporte = None
                    if 'Fecha' in df_oficina.columns:
                        df_fechas = df_oficina[df_oficina['Fecha'].notna()].copy()
                        if not df_fechas.empty:
                            ultimo_reporte_idx = df_fechas['Fecha'].idxmax()
                            ultimo_reporte = df_fechas.loc[ultimo_reporte_idx].to_dict()
                            ultimo_reporte = {k: (v if pd.notna(v) else None) for k, v in ultimo_reporte.items()}
                            if 'Fecha' in ultimo_reporte and pd.notna(ultimo_reporte['Fecha']):
                                if hasattr(ultimo_reporte['Fecha'], 'strftime'):
                                    ultimo_reporte['Fecha'] = ultimo_reporte['Fecha'].strftime('%d/%m/%Y')
                                else:
                                    ultimo_reporte['Fecha'] = str(ultimo_reporte['Fecha'])

                    # Responsables únicos
                    responsables = []
                    if 'Responsable' in df_oficina.columns:
                        responsables = sorted(df_oficina['Responsable'].dropna().unique().tolist())
                    elif 'Nombre del Responsable' in df_oficina.columns:
                        responsables = sorted(df_oficina['Nombre del Responsable'].dropna().unique().tolist())

                    # Reportes por semana
                    reportes_por_semana = {}
                    if 'Semana' in df_oficina.columns:
                        semanas = df_oficina['Semana'].dropna().value_counts().head(4)
                        reportes_por_semana = semanas.to_dict()

                    oficinas_stats.append({
                        'nombre': oficina,
                        'total_reportes': total_reportes,
                        'responsables': responsables,
                        'total_responsables': len(responsables),
                        'ultimo_reporte': ultimo_reporte,
                        'reportes_por_semana': reportes_por_semana,
                        'tiene_datos': True
                    })

                oficinas_stats.sort(key=lambda x: x['total_reportes'], reverse=True)

            # Agregar oficinas con dashboard HTML
            for nombre_oficina, info_oficina in OFICINAS_CON_DASHBOARD_HTML.items():
                if nombre_oficina not in oficinas_con_datos:
                    oficinas_stats.append({
                        'nombre': info_oficina['nombre'],
                        'total_reportes': 0,
                        'responsables': [],
                        'total_responsables': 0,
                        'ultimo_reporte': None,
                        'reportes_por_semana': {},
                        'tiene_datos': False,
                        'tiene_dashboard_html': True,
                        'ruta_dashboard': info_oficina['ruta']
                    })

            # Estadísticas generales
            total_general = len(df)
            total_oficinas = len(oficinas_stats)

            reportes_por_mes = {}
            if 'Fecha' in df.columns:
                df_fechas = df[df['Fecha'].notna()].copy()
                if not df_fechas.empty:
                    df_fechas['Mes'] = df_fechas['Fecha'].dt.to_period('M')
                    meses = df_fechas['Mes'].value_counts().head(3)
                    reportes_por_mes = {str(k): int(v) for k, v in meses.items()}

            estadisticas = {
                'total_general': total_general,
                'total_oficinas': total_oficinas,
                'reportes_por_mes': reportes_por_mes,
                'oficina_mas_activa': oficinas_stats[0]['nombre'] if oficinas_stats else None,
                'total_responsables': len(df['Responsable'].dropna().unique()) if 'Responsable' in df.columns else 0
            }

            self._send_json({
                'oficinas': oficinas_stats,
                'total_general': total_general,
                'estadisticas': estadisticas
            })

        except Exception as e:
            import traceback
            traceback.print_exc()
            self._send_json({
                'error': str(e),
                'oficinas': [],
                'total_general': 0,
                'estadisticas': {}
            }, 500)

    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, default=str).encode('utf-8'))
