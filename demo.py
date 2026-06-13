import os
import sys
import time
import socket
import subprocess
import webbrowser

def log(message):
    print(f"[{time.strftime('%H:%M:%S')}] {message}", flush=True)

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

log("Démarrage du script de supervision SAÉ ERO1")

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
    log("Création de l'environnement virtuel...")
    subprocess.run([sys.executable, "-m", "venv", "venv"])

if not os.path.exists(pip_venv):
    log("Réparation de l'environnement : installation de pip...")
    subprocess.run([python_venv, "-m", "ensurepip", "--upgrade"])
    subprocess.run([python_venv, "-m", "pip", "install", "--upgrade", "pip"])

log("Installation des dépendances Python (FastAPI, OSMnx, NetworkX...) dans le venv...")
subprocess.run([pip_venv, "install", "fastapi", "uvicorn[standard]", "osmnx", "networkx", "pydantic"])
log("Environnement Python opérationnel.")


log("Vérification de la présence locale de Node.js / NPM...")
has_npm = True
try:
    subprocess.run([npm_cmd, "--version"], shell=use_shell, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    log("NPM détecté localement sur la machine hôte.")
except Exception:
    has_npm = False
    log("NPM introuvable localement. Basculement sur l'infrastructure Docker.")

web_abs_path = os.path.abspath("web")

if has_npm:
    if not os.path.exists(os.path.join("web", "node_modules")):
        log("Dossier 'node_modules' absent. Exécution de 'npm install' en local...")
        subprocess.run([npm_cmd, "install"], cwd="web", shell=use_shell)
else:
    log("Téléchargement / Vérification de l'image Docker node:24-slim...")
    subprocess.run(["docker", "pull", "node:24-slim"])
    
    if not os.path.exists(os.path.join("web", "node_modules")):
        log("Dossier 'node_modules' absent. Exécution de 'npm install' via le conteneur Docker...")
        subprocess.run(["docker", "run", "--rm", "-v", f"{web_abs_path}:/app", "-w", "/app", "node:24-slim", "npm", "install"])

log("Vérification de l'état des ports 3000 et 8000...")
for port in [3000, 8000]:
    if is_port_in_use(port):
        log(f"[!] Le port {port} est occupé. Nettoyage du processus fantôme...")
        kill_port_owner(port)
        time.sleep(1)

log("Lancement du processus d'API Backend (FastAPI sur port 8000)...")
backend_proc = subprocess.Popen(
    [python_venv, os.path.join("api", "server.py")],
    shell=False
)

log("Lancement du processus d'interface Frontend (Next.js sur port 3000)...")
if has_npm:
    frontend_proc = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd="web",
        shell=use_shell,
        stdout=subprocess.DEVNULL,
    )
else:
    frontend_proc = subprocess.Popen(
        ["docker", "run", "--rm", "-v", f"{web_abs_path}:/app", "-w", "/app", "-p", "3000:3000", "node:24-slim", "npm", "run", "dev"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

log("Attente active de l'initialisation des ports réseaux...")
attempts = 0
while attempts < 20:
    log(f"Vérification des ports - Tentative {attempts + 1}/20...")
    if is_port_in_use(3000) and is_port_in_use(8000):
        log("Tous les services répondent correctement.")
        time.sleep(1)
        log("Ouverture automatique du navigateur web.")
        webbrowser.open("http://127.0.0.1:3000")
        break
    time.sleep(1)
    attempts += 1

log("Application pleinement active. Utilisez CTRL+C dans ce terminal pour tout éteindre.")

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    log("Signal d'interruption capturé. Arrêt des services en cours...")
finally:
    if os.name == 'nt':
        subprocess.run(f'taskkill /F /T /PID {backend_proc.pid}', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if has_npm:
            subprocess.run(f'taskkill /F /T /PID {frontend_proc.pid}', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            frontend_proc.terminate()
    else:
        backend_proc.terminate()
        frontend_proc.terminate()
    log("Nettoyage terminé. Ports libérés.")
