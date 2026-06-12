import osmnx as ox
import unicodedata
import os
import json
import math

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_DATA_DIR = os.path.join(_ROOT, "data")

_SECTORS = {
    "outremont": ("outremont.graphml", "Outremont, Montreal, Quebec, Canada"),
    "o": ("outremont.graphml", "Outremont, Montreal, Quebec, Canada"),
    "verdun": ("verdun.graphml", "Verdun, Montreal, Quebec, Canada"),
    "v": ("verdun.graphml", "Verdun, Montreal, Quebec, Canada"),
    "anjou": ("anjou.graphml", "Anjou, Montreal, Quebec, Canada"),
    "a": ("anjou.graphml", "Anjou, Montreal, Quebec, Canada"),
    "riviere-des-prairies-pointe-aux-trembles": (
        "riviere-des-prairies-pointe-aux-trembles.graphml",
        "Riviere-des-Prairies-Pointe-aux-Trembles, Montreal, Quebec, Canada",
    ),
    "riviere": (
        "riviere-des-prairies-pointe-aux-trembles.graphml",
        "Riviere-des-Prairies-Pointe-aux-Trembles, Montreal, Quebec, Canada",
    ),
    "r": (
        "riviere-des-prairies-pointe-aux-trembles.graphml",
        "Riviere-des-Prairies-Pointe-aux-Trembles, Montreal, Quebec, Canada",
    ),
}

_CRITICAL_AMENITIES = [
    "hospital", "clinic", "school", "college", "university",
    "fire_station", "police", "kindergarten",
]

_MAJOR_ROADS = ("primary", "secondary", "trunk", "motorway")


def _load_or_download(filepath, place_name):
    if os.path.exists(filepath):
        return ox.load_graphml(filepath)
    G = ox.graph_from_place(place_name, network_type="drive")
    os.makedirs(os.path.dirname(filepath) or ".", exist_ok=True)
    ox.save_graphml(G, filepath)
    return G


def accomodate_graph(G):
    for u, v, key, data in G.edges(keys=True, data=True):
        G[u][v][key].setdefault('snow_level', 1.0)
        G[u][v][key].setdefault('weight', 1.0)


def _load_critical_pois(place_name, cache_path):
    if os.path.exists(cache_path):
        try:
            with open(cache_path, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    coords = []
    ok = False
    try:
        gdf = ox.features_from_place(place_name, tags={"amenity": _CRITICAL_AMENITIES})
        for geom in gdf.geometry:
            if geom is None or geom.is_empty:
                continue
            p = geom.representative_point()
            coords.append([float(p.x), float(p.y)])
        ok = True
    except Exception as exc:
        print(f"POI critiques indisponibles ({exc}) ; social retombe sur les grands axes.")
    if ok:
        try:
            os.makedirs(os.path.dirname(cache_path) or ".", exist_ok=True)
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(coords, f)
        except Exception:
            pass
    return coords


def _is_residential_narrow(data):
    hw = data.get("highway", "")
    hw = " ".join(hw) if isinstance(hw, list) else str(hw)
    if "residential" not in hw.lower() and "living_street" not in hw.lower():
        return False
    lanes = data.get("lanes")
    if isinstance(lanes, list):
        lanes = lanes[0] if lanes else None
    try:
        return int(lanes) <= 1
    except (TypeError, ValueError):
        return True


def tag_priority_edges(G, place_name, graph_path):
    if graph_path.endswith(".graphml"):
        cache_path = graph_path[: -len(".graphml")] + "_critical.json"
    else:
        cache_path = graph_path + ".critical.json"

    coords = _load_critical_pois(place_name, cache_path)
    G.graph["critical_pois"] = coords
    crit_nodes = set()
    if coords:
        ids, xs, ys = [], [], []
        for n, nd in G.nodes(data=True):
            try:
                xs.append(float(nd["x"])); ys.append(float(nd["y"])); ids.append(n)
            except (KeyError, TypeError, ValueError):
                pass
        for lon, lat in coords:
            coslat = math.cos(math.radians(lat))
            best, best_d = None, None
            for nid, x, y in zip(ids, xs, ys):
                dx = (x - lon) * coslat
                dy = y - lat
                d = dx * dx + dy * dy
                if best_d is None or d < best_d:
                    best_d, best = d, nid
            if best is not None:
                crit_nodes.add(best)

    has_pois = bool(crit_nodes)
    n_crit = 0
    n_major = 0
    for u, v, k, data in G.edges(keys=True, data=True):
        hw = data.get("highway", "")
        hw = " ".join(hw) if isinstance(hw, list) else str(hw)
        major = any(t in hw.lower() for t in _MAJOR_ROADS)
        if has_pois:
            near = (u in crit_nodes) or (v in crit_nodes)
        else:
            near = major
        data["near_critical"] = near
        data["major_road"] = major
        data["parking_restricted"] = _is_residential_narrow(data)
        n_crit += int(near)
        n_major += int(major)
    print(f"Priorisation taggee : {n_crit} arcs critiques ({'POI reels' if has_pois else 'repli grands axes'}), {n_major} arcs grands axes, {len(coords)} POI.")
    return G


def init_graph(city=""):
    city = unicodedata.normalize("NFD", city.lower()).encode("ascii", "ignore").decode("utf-8")
    if city not in _SECTORS:
        print("Please choose from: Outremont, Verdun, Anjou, Riviere-des-Prairies-Pointe-aux-Trembles.")
        return None

    filename, place_name = _SECTORS[city]
    filepath = os.path.join(_DATA_DIR, filename)
    G = _load_or_download(filepath, place_name)
    accomodate_graph(G)
    tag_priority_edges(G, place_name, filepath)
    print("Graph loaded successfully.")
    return G