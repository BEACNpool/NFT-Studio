#!/usr/bin/env python3
"""Actual urllib redirect rejection against an owned loopback fixture only."""
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from pathlib import Path
from threading import Thread
import sys,json
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from retrieve import get
calls=[]
class Fixture(BaseHTTPRequestHandler):
 def do_GET(self):
  calls.append(self.path)
  if self.path=='/redirect':
   self.send_response(302);self.send_header('Location','http://127.0.0.1:'+str(self.server.server_port)+'/target');self.end_headers()
  else:self.send_response(200);self.end_headers();self.wfile.write(b'target')
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Fixture);thread=Thread(target=server.serve_forever);thread.start()
try:
 try:get('http://127.0.0.1:'+str(server.server_port)+'/redirect',32)
 except ValueError as e:assert 'before contacting' in str(e)
 else:raise AssertionError('Redirect should reject')
 assert calls==['/redirect'],calls
 print(json.dumps({'redirectResponseRejected':True,'destinationRequests':0,'network':'owned loopback fixture only'}))
finally:server.shutdown();server.server_close();thread.join()
