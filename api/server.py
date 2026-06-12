#!/usr/bin/env python3
import os
import sys
import uvicorn

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.graph.init_graph import init_graph
from src.graph.analyse_graph import analyse_graph
from src.graph.cpp_graph import cpp_multi
from src.calcul import (
    COUT_FIXE,
    COUT_H_NORMAL,
    COUT_H_SUP,
    COUT_KM,
    SEUIL_H,
    VITESSE,
    cout_vehicule,
)
from api.geo import network_to_paths, major_roads_to_paths, graph_bounds, circuit_to_trip

SECTORS = [
    {"id": "outremont", "name": "Outremont"},
    {"id": "verdun", "name": "Verdun"},
    {"id": "anjou", "name": "Anjou"},
    {"id": "riviere", "name": "Rivière-des-Prairies-Pointe-aux-Trembles"},
]
SECTOR_IDS = {s["id"] for s in SECTORS}
SCENARIOS = ["costs", "social", "parking"]

class CostParams(BaseModel):
    scenario: str = "costs"
    cout_fixe: float = COUT_FIXE
    cout_km: float = COUT_KM
    cout_h_normal: float = COUT_H_NORMAL
    cout_h_sup: float = COUT_H_SUP
    vitesse: float = VITESSE
    seuil_h: float = SEUIL_H
    conso_l_h: float = 30.0
    prix_essence: float = 1.85
    n_vehicles: int = 1

app = FastAPI(title="ERO1 - Déneigement API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_graphs = {}
_stats = {}

def _analysed(sector_id: str):
    if sector_id not in SECTOR_IDS:
        raise HTTPException(status_code=404, detail=f"Secteur inconnu : {sector_id}")
    if sector_id in _graphs:
        return _graphs[sector_id], _stats[sector_id]

    G_raw = init_graph(sector_id)
    if G_raw is None:
        raise HTTPException(status_code=502, detail="Échec du chargement du graphe OSM")

    res = analyse_graph(G_raw)
    G = res["graph"]
    stats = {
        "n_nodes": res["n_nodes"],
        "n_edges": res["n_edges"],
        "total_km": round(res["total_km"], 2),
        "n_unbalanced": res["n_unbalanced"],
    }
    _graphs[sector_id] = G
    _stats[sector_id] = stats
    return G, stats

@app.get("/")
def health():
    return {"status": "ok", "service": "ero1-deneigement"}

@app.get("/api/sectors")
def get_sectors():
    return {"sectors": SECTORS}

@app.get("/api/network/{sector_id}")
def get_network(sector_id: str):
    G, stats = _analysed(sector_id)
    bounds = graph_bounds(G)
    return {
        "sector": sector_id,
        "stats": stats,
        "bbox": bounds["bbox"],
        "center": bounds["center"],
        "paths": network_to_paths(G),
        "major_paths": major_roads_to_paths(G),
        "critical_pois": G.graph.get("critical_pois", []),
    }

@app.post("/api/route/{sector_id}")
def post_route(sector_id: str, params: CostParams = CostParams()):
    G, stats = _analysed(sector_id)
    n_vehicles = max(1, int(params.n_vehicles))
    try:
        result = cpp_multi(G, n_vehicles=n_vehicles, scenario=params.scenario)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Échec du calcul de tournée : {exc}")

    speed = params.vitesse if params.vitesse else VITESSE
    G_aug = result["G_augmented"]
    trips = [
        circuit_to_trip(G_aug, circuit, speed_kmh=speed)
        for circuit in result["circuits"]
    ]
    per_vehicle_km = result["per_vehicle_km"]
    n_used = len(trips)

    circuit_km = round(result["total_km"], 2)
    network_km = stats["total_km"]
    deadhead_km = round(max(0.0, circuit_km - network_km), 2)
    # Durée opérationnelle = tournée la plus longue véhicules en parallèle
    max_km = max(per_vehicle_km) if per_vehicle_km else 0.0
    hours = max_km / speed if speed else 0.0

    # Coût flotte = somme des coûts par véhicule
    # coût fixe une fois par véhicule et coûts variables selon les km réels
    cost = sum(
        cout_vehicule(
            km,
            cout_fixe=params.cout_fixe,
            cout_km=params.cout_km,
            cout_h_normal=params.cout_h_normal,
            cout_h_sup=params.cout_h_sup,
            vitesse=params.vitesse,
            seuil_h=params.seuil_h,
            conso_l_h=params.conso_l_h,
            prix_essence=params.prix_essence,
        )
        for km in per_vehicle_km
    )

    duration = max((t[-1][2] for t in trips if t), default=0.0)

    return {
        "sector": sector_id,
        "scenario_applied": params.scenario,
        "params": params.model_dump(),
        "stats": {
            "circuit_km": circuit_km,
            "network_km": network_km,
            "deadhead_km": deadhead_km,
            "deadhead_pct": round(100.0 * deadhead_km / circuit_km, 1) if circuit_km else 0.0,
            "n_segments": sum(len(c) for c in result["circuits"]),
            "hours": round(hours, 2),
            "cost_eur": round(cost, 2),
            "n_vehicles": n_used,
            "per_vehicle_km": [round(km, 2) for km in per_vehicle_km],
        },
        "trips": trips,
        "duration": duration,
    }

if __name__ == "__main__":
    uvicorn.run("api.server:app", host="127.0.0.1", port=8000, reload=True)