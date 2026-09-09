"""Small client for the configured Blender MCP add-on's loopback transport.

Usage: python scripts/blender_mcp_client.py get_scene_info
       python scripts/blender_mcp_client.py execute_code --file blender/build_fixture_assets.py
The Blender add-on must already be running on localhost:9876.
"""
import argparse
import json
from pathlib import Path
import socket

parser = argparse.ArgumentParser()
parser.add_argument('command')
parser.add_argument('--file')
parser.add_argument('--params', default='{}')
parser.add_argument('--params-file', help='JSON parameters without shell quoting')
parser.add_argument('--timeout', type=float, default=180)
args = parser.parse_args()
params = json.loads(Path(args.params_file).read_text(encoding='utf-8') if args.params_file else args.params)
if args.file:
    path = Path(args.file).resolve()
    params['code'] = "exec(compile(" + repr(path.read_text(encoding='utf-8')) + ", " + repr(str(path)) + ", 'exec'), {'__file__': " + repr(str(path)) + ", '__name__': '__main__'})"
with socket.create_connection(('127.0.0.1', 9876), timeout=10) as connection:
    connection.settimeout(args.timeout)
    connection.sendall(json.dumps({'type': args.command, 'params': params}).encode('utf-8'))
    response = bytearray()
    while True:
        chunk = connection.recv(65536)
        if not chunk:
            raise RuntimeError('Blender disconnected before returning a complete response')
        response.extend(chunk)
        try:
            result = json.loads(response.decode('utf-8'))
            break
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
print(json.dumps(result, ensure_ascii=True, indent=2))
if result.get('status') == 'error':
    raise SystemExit(1)
