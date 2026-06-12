import math


def _node_pt(G, n):
    nd = G.nodes[n]
    return [float(nd["x"]), float(nd["y"])]


def _sq(a, b):
    dx = a[0] - b[0]
    dy = a[1] - b[1]
    return dx * dx + dy * dy


def _edge_coords(data, u_pt, v_pt):
    geom = data.get("geometry")
    if geom is not None:
        try:
            coords = [[float(x), float(y)] for x, y in geom.coords]
            if len(coords) >= 2:
                if _sq(coords[0], u_pt) > _sq(coords[-1], u_pt):
                    coords.reverse()
                return coords
        except Exception:
            pass
    return [list(u_pt), list(v_pt)]


def network_to_paths(G):
    paths = []
    for u, v, _k, data in G.edges(keys=True, data=True):
        paths.append(_edge_coords(data, _node_pt(G, u), _node_pt(G, v)))
    return paths


def major_roads_to_paths(G):
    paths = []
    for u, v, _k, data in G.edges(keys=True, data=True):
        if data.get("major_road"):
            paths.append(_edge_coords(data, _node_pt(G, u), _node_pt(G, v)))
    return paths


def graph_bounds(G):
    xs, ys = [], []
    for _n, nd in G.nodes(data=True):
        xs.append(float(nd["x"]))
        ys.append(float(nd["y"]))
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    return {
        "bbox": [minx, miny, maxx, maxy],
        "center": [(minx + maxx) / 2.0, (miny + maxy) / 2.0],
    }


def _haversine_m(a, b):
    lon1, lat1, lon2, lat2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    dlon, dlat = lon2 - lon1, lat2 - lat1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2.0 * 6371000.0 * math.asin(math.sqrt(h))


def circuit_to_trip(G, circuit, speed_kmh=10.0):
    pts = []
    for (u, v, k) in circuit:
        data = G[u][v][k]
        coords = _edge_coords(data, _node_pt(G, u), _node_pt(G, v))
        if not coords:
            continue
        if pts and pts[-1] == coords[0]:
            pts.extend(coords[1:])
        else:
            pts.extend(coords)

    speed_ms = speed_kmh * 1000.0 / 3600.0
    trip = []
    t = 0.0
    prev = None
    for p in pts:
        if prev is not None and speed_ms > 0:
            t += _haversine_m(prev, p) / speed_ms
        trip.append([round(p[0], 6), round(p[1], 6), round(t, 1)])
        prev = p
    return trip
