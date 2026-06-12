import math
import random


def _node_xy(G, n):
    nd = G.nodes[n]
    return float(nd["x"]), float(nd["y"])


def _kmeans(points, k, iters=50, seed=42):
    n = len(points)
    rng = random.Random(seed)

    centers = [points[rng.randrange(n)]]
    while len(centers) < k:
        d2 = []
        for p in points:
            dm = min((p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 for c in centers)
            d2.append(dm)
        total = sum(d2)
        if total <= 0:
            centers.append(points[rng.randrange(n)])
            continue
        r = rng.random() * total
        acc = 0.0
        for p, dd in zip(points, d2):
            acc += dd
            if acc >= r:
                centers.append(p)
                break

    assign = [0] * n
    for _ in range(iters):
        changed = False
        for i, p in enumerate(points):
            best, best_d = 0, None
            for ci, c in enumerate(centers):
                dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2
                if best_d is None or dd < best_d:
                    best_d, best = dd, ci
            if assign[i] != best:
                assign[i] = best
                changed = True
        sums = [[0.0, 0.0, 0] for _ in range(k)]
        for i, p in enumerate(points):
            c = assign[i]
            sums[c][0] += p[0]
            sums[c][1] += p[1]
            sums[c][2] += 1
        for ci in range(k):
            if sums[ci][2] > 0:
                centers[ci] = (sums[ci][0] / sums[ci][2], sums[ci][1] / sums[ci][2])
        if not changed:
            break

    return assign


def partition_nodes(G, k, seed=42):
    nodes = list(G.nodes())
    if k <= 1 or len(nodes) <= 1:
        return {n: 0 for n in nodes}
    k = min(k, len(nodes))

    xy = [_node_xy(G, n) for n in nodes]
    lat0 = sum(y for _x, y in xy) / len(xy)
    coslat = math.cos(math.radians(lat0))
    points = [(x * coslat, y) for x, y in xy]

    labels = _kmeans(points, k, seed=seed)
    return {n: labels[i] for i, n in enumerate(nodes)}


def _node_weight(G, n):
    return sum(d.get("length", 0.0) for _u, _v, d in G.out_edges(n, data=True))


def _balance_loads(G, nodes, labels, k, tol=0.02, max_moves=10000):
    idx = {n: i for i, n in enumerate(nodes)}
    zone = list(labels)

    weight = [_node_weight(G, n) for n in nodes]

    nbrs = [set() for _ in nodes]
    for u, v in G.edges():
        iu, iv = idx.get(u), idx.get(v)
        if iu is not None and iv is not None and iu != iv:
            nbrs[iu].add(iv)
            nbrs[iv].add(iu)

    loads = [0.0] * k
    counts = [0] * k
    for i in range(len(nodes)):
        loads[zone[i]] += weight[i]
        counts[zone[i]] += 1

    target = sum(loads) / k if k else 0.0

    for _ in range(max_moves):
        spread = max(loads) - min(loads)
        if target <= 0 or spread <= target * tol:
            break

        best = None
        for i in range(len(nodes)):
            a = zone[i]
            if counts[a] <= 1:
                continue
            w = weight[i]
            cand_zones = {zone[j] for j in nbrs[i] if zone[j] != a}
            for b in cand_zones:
                if loads[a] <= loads[b]:
                    continue
                if w >= loads[a] - loads[b]:
                    continue
                improvement = (loads[a] - loads[b]) - abs(
                    (loads[a] - w) - (loads[b] + w)
                )
                if best is None or improvement > best[0]:
                    best = (improvement, i, a, b)

        if best is None or best[0] <= 0:
            break

        _, i, a, b = best
        w = weight[i]
        zone[i] = b
        loads[a] -= w
        loads[b] += w
        counts[a] -= 1
        counts[b] += 1

    return {n: zone[i] for i, n in enumerate(nodes)}


def partition_nodes_balanced(G, k, seed=42):
    node_zone = partition_nodes(G, k, seed=seed)
    if k <= 1:
        return node_zone
    nodes = list(node_zone.keys())
    labels = [node_zone[n] for n in nodes]
    return _balance_loads(G, nodes, labels, k)


def partition_edges(G, k, seed=42):
    node_zone = partition_nodes_balanced(G, k, seed=seed)
    n_zones = (max(node_zone.values()) + 1) if node_zone else 1
    zones = [set() for _ in range(n_zones)]
    for u, v, key in G.edges(keys=True):
        z = node_zone.get(u, 0)
        zones[z].add((u, v, key))
    return [z for z in zones if z]
