import json
from http.server import BaseHTTPRequestHandler
from protected_importer import import_product

class handler(BaseHTTPRequestHandler):
    def _headers(self,status=200):
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin','*')
        self.send_header('Access-Control-Allow-Methods','POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers','Content-Type')
        self.send_header('Cache-Control','no-store')
        self.end_headers()

    def do_OPTIONS(self):
        self._headers(204)

    def do_POST(self):
        try:
            n=int(self.headers.get('Content-Length','0') or '0')
            body=json.loads(self.rfile.read(n) or b'{}')
            url=body.get('url')
            if not isinstance(url,str) or not url.startswith(('https://','http://')):
                raise ValueError('invalid_url')
            data=import_product(url)
            self._headers(200)
            self.wfile.write(json.dumps(data,ensure_ascii=False).encode('utf-8'))
        except ValueError as e:
            self._headers(400)
            self.wfile.write(json.dumps({'error':str(e)},ensure_ascii=False).encode('utf-8'))
        except Exception as e:
            self._headers(502)
            self.wfile.write(json.dumps({'error':'protected_import_failed','detail':str(e)},ensure_ascii=False).encode('utf-8'))
