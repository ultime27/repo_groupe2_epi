const API_BASE_URL = "http://127.0.0.1:8000";

export async function getSectors() {
  const res = await fetch(`${API_BASE_URL}/api/sectors`);
  if (!res.ok) throw new Error("Impossible de charger les secteurs");
  
  const data = await res.json();
  return data.sectors || [];
}


export async function getNetwork(sectorId: string) {
  const res = await fetch(`${API_BASE_URL}/api/network/${sectorId}`);
  if (!res.ok) throw new Error(`Impossible de charger le réseau du secteur: ${sectorId}`);
  return res.json();
}

export async function getRoute(sectorId: string, params: any) {
  const res = await fetch(`${API_BASE_URL}/api/route/${sectorId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Échec du calcul de la tournée opérationnelle");
  return res.json();
}