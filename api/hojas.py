"""
API endpoint: /api/hojas
Lista las hojas configuradas y disponibles.
"""
from http.server import BaseHTTPRequestHandler
import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from _shared import GOOGLE_SHEET_REPORTES_SEMANALES, HOJAS_CONFIG, construir_url_hoja


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        try:
            hojas_info = []

            hojas_info.append({
                'gid': 'default',
                'nombre': 'Hoja por Defecto',
                'url': GOOGLE_SHEET_REPORTES_SEMANALES,
                'descripcion': 'Hoja principal de reportes semanales'
            })

            for gid, nombre in HOJAS_CONFIG.items():
                hojas_info.append({
                    'gid': gid,
                    'nombre': nombre,
                    'url': construir_url_hoja(gid),
                    'descripcion': f'Hoja: {nombre}'
                })

            self._send_json({
                'hojas': hojas_info,
                'total': len(hojas_info),
                'instrucciones': {
                    'como_usar': 'Para usar múltiples hojas, agrega el parámetro ?hojas=gid1,gid2,gid3 al endpoint /api/datos',
                    'ejemplo': '/api/datos?hojas=1660346099,1234567890',
                }
            })

        except Exception as e:
            self._send_json({'error': str(e), 'hojas': []}, 500)

    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, default=str).encode('utf-8'))
