export interface CostParams {
  cout_fixe: number;
  cout_km: number;
  cout_h_normal: number;
  cout_h_sup: number;
  vitesse: number;
  seuil_h: number;
  conso_l_h: number;
  prix_essence: number;
}

export const DEFAULT_COST_PARAMS: CostParams = {
  cout_fixe: 650.0,
  cout_km: 1.1,
  cout_h_normal: 60.0,
  cout_h_sup: 82.5,
  vitesse: 10.0,
  seuil_h: 8.0,
  conso_l_h: 30.0,
  prix_essence: 1.85,
};

export interface CostField {
  key: keyof CostParams;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

export const COST_FIELDS: CostField[] = [
  { key: "cout_fixe", label: "Coût Fixe + Amortissement ($)", min: 0, max: 2000, step: 50 },
  { key: "cout_km", label: "Coût par Kilomètre ($/km)", min: 0.0, max: 5.0, step: 0.1 },
  { key: "cout_h_normal", label: "Coût Horaire Normal (Machine + Chauffeur) ($/h)", min: 0.0, max: 200, step: 5 },
  { key: "cout_h_sup", label: "Coût Horaire Majoré (Machine + Chauffeur) ($/h)", min: 0.0, max: 200, step: 5 },
  { key: "vitesse", label: "Vitesse d'Exploitation (km/h)", min: 5, max: 30, step: 1 },
  { key: "seuil_h", label: "Seuil Heures Normales (h)", min: 1, max: 12, step: 1 },
  { key: "conso_l_h", label: "Consommation Carburant (L/h)", min: 10, max: 80, step: 5 },
  { key: "prix_essence", label: "Prix du Carburant ($/L)", min: 0.5, max: 5.0, step: 0.05 },
];

export interface FleetCost {
  fixed: number;
  distance: number;
  hoursNormal: number;
  hoursOver: number;
  fuel: number;
  nVehicles: number;
  perVehicleKm: number;
  perVehicleHours: number;
}

export function computeFleetCost(
  perVehicleKm: number[],
  params: CostParams = DEFAULT_COST_PARAMS
): FleetCost {
  const speed = params.vitesse > 0 ? params.vitesse : 10.0;
  const kms = perVehicleKm.length > 0 ? perVehicleKm : [0];
  const vehicles = kms.length;

  let fixed = 0;
  let distance = 0;
  let hoursNormal = 0;
  let hoursOver = 0;
  let fuel = 0;
  let totalKm = 0;
  let maxHours = 0;

  for (const km of kms) {
    const hours = km / speed;
    const normalHours = Math.min(hours, params.seuil_h);
    const overHours = hours > params.seuil_h ? hours - params.seuil_h : 0;

    fixed += params.cout_fixe;
    distance += params.cout_km * km;
    hoursNormal += params.cout_h_normal * normalHours;
    hoursOver += params.cout_h_sup * overHours;
    // Carburant consommation L/h x prix $/L x heures du véhicule
    fuel += params.conso_l_h * params.prix_essence * hours;

    totalKm += km;
    if (hours > maxHours) maxHours = hours;
  }

  return {
    fixed,
    distance,
    hoursNormal,
    hoursOver,
    fuel,
    nVehicles: vehicles,
    perVehicleKm: totalKm / vehicles,
    perVehicleHours: maxHours,
  };
}