import os
import sys
import time
import socket
import subprocess
import webbrowser

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def kill_port_owner(port):
    if os.name == 'nt':
        try:
            output = subprocess.check_output(f'netstat -ano | findstr :{port}', shell=True).decode()
            pids = set([line.strip().split()[-1] for line in output.splitlines() if line.strip()])
            for pid in pids:
                if pid != '0':
                    subprocess.run(f'taskkill /F /PID {pid}', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass
    else:
        subprocess.run(f'fuser -k {port}/tcp', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

if os.name == 'nt': 
    python_venv = os.path.join("venv", "Scripts", "python.exe")
    pip_venv = os.path.join("venv", "Scripts", "pip.exe")
    npm_cmd = "npm.cmd"
    use_shell = True
else: 
    python_venv = os.path.join("venv", "bin", "python")
    pip_venv = os.path.join("venv", "bin", "pip")
    npm_cmd = "npm"
    use_shell = False

if not os.path.exists("venv"):
    subprocess.run([sys.executable, "-m", "venv", "venv"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run([pip_venv, "install", "fastapi", "uvicorn[standard]", "osmnx", "networkx", "pydantic"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

if not os.path.exists(os.path.join("web", "node_modules")):
    subprocess.run([npm_cmd, "install"], cwd="web", shell=use_shell, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

for port in [3000, 8000]:
    if is_port_in_use(port):
        kill_port_owner(port)
        time.sleep(1)

backend_proc = subprocess.Popen(
    [python_venv, os.path.join("api", "server.py")],
    shell=False
)

frontend_proc = subprocess.Popen(
    [npm_cmd, "run", "dev"],
    cwd="web",
    shell=use_shell,
    stdout=subprocess.DEVNULL,
)

attempts = 0
while attempts < 20:
    if is_port_in_use(3000) and is_port_in_use(8000):
        time.sleep(1)
        webbrowser.open("http://127.0.0.1:3000")
        break
    time.sleep(1)
    attempts += 1

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    pass
finally:
    if os.name == 'nt':
        subprocess.run(f'taskkill /F /T /PID {backend_proc.pid}', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(f'taskkill /F /T /PID {frontend_proc.pid}', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        backend_proc.terminate()
        frontend_proc.terminate()
