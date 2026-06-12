export interface Sector {
  id: string;
  name: string;
}

export interface NetworkStats {
  n_nodes: number;
  n_edges: number;
  total_km: number;
  n_unbalanced: number;
}

export type Position = [number, number];
export type TripPoint = [number, number, number]; 

export interface NetworkResponse {
  sector: string;
  stats: NetworkStats;
  bbox: [number, number, number, number];
  center: [number, number];
  paths: Position[][];
  major_paths?: Position[][];
  critical_pois?: Position[];
}

export interface RouteStats {
  circuit_km: number;
  network_km: number;
  deadhead_km: number;
  deadhead_pct: number;
  n_segments: number;
  hours: number;
  cost_eur: number;
  n_vehicles: number;
  per_vehicle_km: number[];
}

export interface RouteResponse {
  sector: string;
  stats: RouteStats;
  trips: TripPoint[][];
  duration: number;
}
