#!/usr/bin/env python3
"""Use coturn's client to exchange test packets. Never prints credentials or raw logs."""
import argparse
import base64
import hashlib
import hmac
import os
from pathlib import Path
import re
import secrets
import subprocess
import socket
import ssl
import time

parser = argparse.ArgumentParser()
parser.add_argument('--host', default='phoneapp.bawebtech.com')
parser.add_argument('--transport', choices=['udp', 'tcp', 'tls'], default='udp')
parser.add_argument('--server-name', help='Expected TLS hostname when connecting to a private test IP')
args = parser.parse_args()
values = dict(line.split('=', 1) for line in Path('.env.server').read_text().splitlines() if '=' in line and not line.startswith('#'))
username = f'{int(time.time()) + 300}:relay-check-{secrets.token_hex(4)}'
password = base64.b64encode(hmac.new(values['TURN_SECRET'].encode(), username.encode(), hashlib.sha1).digest()).decode()
command = ['turnutils_uclient', '-u', username, '-w', password, '-y', '-c', '-n', '5', '-z', '100', '-p', '5349' if args.transport == 'tls' else '3478']
if args.transport in ['tcp', 'tls']:
    command += ['-t']
if args.transport == 'tls':
    command += ['-S', '-E', '/etc/ssl/certs/ca-certificates.crt']
Path('artifacts/private').mkdir(parents=True, exist_ok=True)
log = Path(f'artifacts/private/turn-{args.transport}-{int(time.time())}.log')
try:
    if args.transport == 'tls':
        # Verify the server hostname/chain separately; coturn's test client also requires a client key.
        with socket.create_connection((args.host, 5349), timeout=5) as raw:
            with ssl.create_default_context().wrap_socket(raw, server_hostname=args.server_name or args.host):
                pass
        cert = Path('artifacts/private/turn-client.pem')
        key = Path('artifacts/private/turn-client.key')
        if not cert.exists() or not key.exists():
            subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', str(key), '-out', str(cert), '-subj', '/CN=phoneapp-turn-test', '-days', '1'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            os.chmod(key, 0o600)
        command += ['-i', str(cert), '-k', str(key)]
    command.append(args.host)
    result = subprocess.run(command, capture_output=True, text=True, timeout=20)
    output = result.stdout + result.stderr
    code = result.returncode
except subprocess.TimeoutExpired as error:
    decode = lambda value: value.decode(errors='replace') if isinstance(value, bytes) else (value or '')
    output = decode(error.stdout) + decode(error.stderr)
    code = -1
except (OSError, ssl.SSLError, subprocess.CalledProcessError) as error:
    output = f'{type(error).__name__}: transport/TLS setup failed. Check reachability, certificate, and local tools.'
    code = -1
log.write_text(output)
os.chmod(log, 0o600)
received = [int(n) for n in re.findall(r'tot_recv_msgs=(\d+)', output)]
sent = [int(n) for n in re.findall(r'tot_send_msgs=(\d+)', output)]
passed = code == 0 and max(sent, default=0) >= 10 and max(received, default=0) == max(sent, default=0)
print(f'{"PASS" if passed else "NOT VERIFIED"}: TURN {args.transport.upper()} packet exchange to {args.host}; sent={max(sent, default=0)}, received={max(received, default=0)}; exit={code}.')
print(f'Private diagnostic log: {log}. This is a server-side test, not a physical-phone test.')
raise SystemExit(0 if passed else 1)
