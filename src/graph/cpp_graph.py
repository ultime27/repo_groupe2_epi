import networkx as nx

def priority_eulerian_circuit(G, source=None):
    adj = {}
    for u in G.nodes():
        edges = list(G.out_edges(u, keys=True, data=True))
        edges.sort(key=lambda e: e[3].get("working_weight", 999999), reverse=True)
        adj[u] = edges
        
    if source is None:
        source = next((n for n in G.nodes() if len(adj[n]) > 0), next(iter(G.nodes())))
        
    v_stack = [source]
    e_stack = []
    circuit = []
    
    while v_stack:
        u = v_stack[-1]
        if adj[u]:
            e = adj[u].pop()
            v_stack.append(e[1])
            e_stack.append((e[0], e[1], e[2]))
        else:
            v_stack.pop()
            if e_stack:
                circuit.append(e_stack.pop())
                
    circuit.reverse()
    return circuit

def _min_key(G, u, v):
    return min(G[u][v], key=lambda k: G[u][v][k].get("length", 0))


def _append_path(G, circuit, path, remaining=None):
    for i, j in zip(path, path[1:]):
        k = _min_key(G, i, j)
        circuit.append((i, j, k))
        if remaining is not None:
            remaining.discard((i, j, k))


def two_phase_social(G):
    required = {
        (u, v, k)
        for u, v, k, d in G.edges(keys=True, data=True)
        if d.get("near_critical") or d.get("major_road")
    }
    source = next((n for n in G.nodes() if G.out_degree(n) > 0), next(iter(G.nodes())))

    circuit = []
    pos = source
    remaining = set(required)
    while remaining:
        out_req = [(pos, v, k) for _, v, k in G.out_edges(pos, keys=True) if (pos, v, k) in remaining]
        if out_req:
            e = min(out_req, key=lambda e: G[e[0]][e[1]][e[2]].get("length", 0))
            circuit.append(e)
            remaining.discard(e)
            pos = e[1]
            continue
        dists, paths = nx.single_source_dijkstra(G, pos, weight="length")
        tails = {u for (u, _v, _k) in remaining if u in dists}
        if not tails:
            break
        target = min(tails, key=lambda t: dists[t])
        _append_path(G, circuit, paths[target], remaining)
        pos = target

    serviced = set(circuit)

    H = nx.MultiDiGraph()
    for u, v, k, d in G.edges(keys=True, data=True):
        if (u, v, k) not in serviced:
            H.add_edge(u, v, key=k, orig_key=k, **d)

    if H.number_of_edges():
        while True:
            comps = list(nx.weakly_connected_components(H))
            if len(comps) == 1:
                break
            base = max(comps, key=len)
            dists, paths = nx.multi_source_dijkstra(G, base, weight="length")
            others = set(H.nodes()) - base
            target = min((n for n in others if n in dists), key=lambda n: dists[n])
            for i, j in zip(paths[target], paths[target][1:]):
                k0 = _min_key(G, i, j)
                H.add_edge(i, j, orig_key=k0, **G[i][j][k0])

        surplus = []
        deficit = []
        for node in H.nodes():
            diff = H.in_degree(node) - H.out_degree(node)
            if diff > 0:
                surplus.append((node, diff))
            elif diff < 0:
                deficit.append((node, -diff))

        flow_graph = nx.DiGraph()
        for node, diff in surplus:
            flow_graph.add_node(node, demand=-diff)
        for node, diff in deficit:
            flow_graph.add_node(node, demand=diff)
        for s_node, _ in surplus:
            lengths = nx.single_source_dijkstra_path_length(G, s_node, weight="length")
            for d_node, _ in deficit:
                if d_node in lengths:
                    flow_graph.add_edge(s_node, d_node, weight=int(round(lengths[d_node] * 10)), capacity=999)
        flow_dict = nx.min_cost_flow(flow_graph)
        for u, flows in flow_dict.items():
            for v, flow in flows.items():
                if flow > 0:
                    path = nx.shortest_path(G, u, v, weight="length")
                    for _ in range(flow):
                        for i, j in zip(path, path[1:]):
                            k0 = _min_key(G, i, j)
                            H.add_edge(i, j, orig_key=k0, **G[i][j][k0])

        dists, paths = nx.single_source_dijkstra(G, pos, weight="length")
        entry = min((n for n in H.nodes() if n in dists), key=lambda n: dists[n])
        _append_path(G, circuit, paths[entry])
        for u, v, k in nx.eulerian_circuit(H, source=entry, keys=True):
            circuit.append((u, v, H[u][v][k].get("orig_key", k)))
        pos = entry

    if pos != source:
        _append_path(G, circuit, nx.shortest_path(G, pos, source, weight="length"))

    total_km = sum(G[u][v][k].get("length", 0) for u, v, k in circuit) / 1000
    return {"circuit": circuit, "total_km": total_km, "G_augmented": G}


def cpp(G, scenario="costs"):
    if scenario == "social":
        return two_phase_social(G)

    surplus = []
    deficit = []

    G_working = G.copy()

    for u, v, k, data in G_working.edges(keys=True, data=True):
        orig_len = data.get("length", 0)
        weight_val = orig_len

        if scenario == "parking":
            if data.get("parking_restricted"):
                weight_val = orig_len * 5.0
                
        G_working[u][v][k]["working_weight"] = weight_val

    for node in G_working.nodes():
        diff = G_working.in_degree(node) - G_working.out_degree(node)
        if diff > 0:
            surplus.append((node, diff))
        elif diff < 0:
            deficit.append((node, -diff))

    flow_graph = nx.DiGraph()
    for node, diff in surplus:
        flow_graph.add_node(node, demand=-diff)
    for node, diff in deficit:
        flow_graph.add_node(node, demand=diff)

    for s_node, _ in surplus:
        try:
            lengths = nx.single_source_dijkstra_path_length(G_working, s_node, weight="working_weight")
            for d_node, _ in deficit:
                if d_node in lengths:
                    dist = lengths[d_node]
                    weight_int = int(round(dist * 10))
                    flow_graph.add_edge(s_node, d_node, weight=weight_int, capacity=999)
        except Exception:
            pass
                
    flow_dict = nx.min_cost_flow(flow_graph)

    G_aug = G_working.copy()

    for u, flows in flow_dict.items():
        for v, flow in flows.items():
            if flow > 0:
                path = nx.shortest_path(G_working, u, v, weight="working_weight")
                for _ in range(flow):
                    for i in range(len(path) - 1):
                        edge_data = min(
                            G_working[path[i]][path[i+1]].values(),
                            key=lambda d: d.get("working_weight", 0)
                        )
                        G_aug.add_edge(path[i], path[i+1], **edge_data, deadhead=True)

    completed_circuit = priority_eulerian_circuit(G_aug)

    total_km = sum(
        G_aug[u][v][k].get("length", 0)
        for u, v, k in completed_circuit
    ) / 1000
    
    return {"circuit": completed_circuit, "total_km": total_km, "G_augmented": G_aug}


def _build_subgraph(G, edge_set):
    H = nx.MultiDiGraph()
    for (u, v, k) in edge_set:
        H.add_edge(u, v, key=k, orig_key=k, **G[u][v][k])
    return H


def _zone_circuit(G, H, scenario, weight="working_weight"):
    if scenario == "social":
        required = {
            (u, v, k)
            for u, v, k, d in H.edges(keys=True, data=True)
            if d.get("near_critical") or d.get("major_road")
        }
    else:
        required = set()

    source = next((n for n in H.nodes() if H.out_degree(n) > 0), None)
    if source is None:
        return [], 0.0

    circuit = []
    pos = source
    remaining = set(required)

    while remaining:
        out_req = [
            (pos, v, k)
            for _, v, k in H.out_edges(pos, keys=True)
            if (pos, v, k) in remaining
        ]
        if out_req:
            e = min(out_req, key=lambda e: H[e[0]][e[1]][e[2]].get("length", 0))
            circuit.append(e)
            remaining.discard(e)
            pos = e[1]
            continue
        dists, paths = nx.single_source_dijkstra(G, pos, weight=weight)
        tails = {u for (u, _v, _k) in remaining if u in dists}
        if not tails:
            break
        target = min(tails, key=lambda t: dists[t])
        _append_path(G, circuit, paths[target], remaining)
        pos = target

    serviced = set(circuit)

    R = nx.MultiDiGraph()
    for u, v, k, d in H.edges(keys=True, data=True):
        if (u, v, k) not in serviced:
            R.add_edge(u, v, key=k, **d)

    if R.number_of_edges():
        while True:
            comps = list(nx.weakly_connected_components(R))
            if len(comps) == 1:
                break
            base = max(comps, key=len)
            dists, paths = nx.multi_source_dijkstra(G, base, weight=weight)
            others = set(R.nodes()) - base
            cand = [n for n in others if n in dists]
            if not cand:
                break
            target = min(cand, key=lambda n: dists[n])
            for i, j in zip(paths[target], paths[target][1:]):
                k0 = _min_key(G, i, j)
                R.add_edge(i, j, orig_key=k0, **G[i][j][k0])

        surplus, deficit = [], []
        for node in R.nodes():
            diff = R.in_degree(node) - R.out_degree(node)
            if diff > 0:
                surplus.append((node, diff))
            elif diff < 0:
                deficit.append((node, -diff))
        if surplus and deficit:
            flow_graph = nx.DiGraph()
            for node, diff in surplus:
                flow_graph.add_node(node, demand=-diff)
            for node, diff in deficit:
                flow_graph.add_node(node, demand=diff)
            for s_node, _ in surplus:
                lengths = nx.single_source_dijkstra_path_length(G, s_node, weight=weight)
                for d_node, _ in deficit:
                    if d_node in lengths:
                        flow_graph.add_edge(
                            s_node, d_node,
                            weight=int(round(lengths[d_node] * 10)), capacity=999,
                        )
            flow_dict = nx.min_cost_flow(flow_graph)
            for u, flows in flow_dict.items():
                for v, flow in flows.items():
                    if flow > 0:
                        path = nx.shortest_path(G, u, v, weight=weight)
                        for _ in range(flow):
                            for i, j in zip(path, path[1:]):
                                k0 = _min_key(G, i, j)
                                R.add_edge(i, j, orig_key=k0, **G[i][j][k0])

        dists, paths = nx.single_source_dijkstra(G, pos, weight=weight)
        cand = [n for n in R.nodes() if n in dists]
        if cand:
            entry = min(cand, key=lambda n: dists[n])
            _append_path(G, circuit, paths[entry])
            for u, v, k in nx.eulerian_circuit(R, source=entry, keys=True):
                circuit.append((u, v, R[u][v][k].get("orig_key", k)))
            pos = entry

    if pos != source:
        try:
            _append_path(G, circuit, nx.shortest_path(G, pos, source, weight=weight))
        except nx.NetworkXNoPath:
            pass

    total_km = sum(G[u][v][k].get("length", 0) for u, v, k in circuit) / 1000
    return circuit, total_km


def cpp_multi(G, n_vehicles=1, scenario="costs"):
    n = max(1, int(n_vehicles))
    if n == 1:
        res = cpp(G, scenario=scenario)
        return {
            "circuits": [res["circuit"]],
            "per_vehicle_km": [round(res["total_km"], 3)],
            "total_km": round(res["total_km"], 3),
            "G_augmented": res["G_augmented"],
        }

    for u, v, k, d in G.edges(keys=True, data=True):
        w = d.get("length", 0)
        if scenario == "parking" and d.get("parking_restricted"):
            w = w * 5.0
        G[u][v][k]["working_weight"] = w

    from src.graph.partition import partition_edges

    zones = partition_edges(G, n)

    circuits = []
    per_km = []
    for edge_set in zones:
        H = _build_subgraph(G, edge_set)
        circuit, km = _zone_circuit(G, H, scenario)
        if circuit:
            circuits.append(circuit)
            per_km.append(round(km, 3))

    if not circuits:
        res = cpp(G, scenario=scenario)
        circuits = [res["circuit"]]
        per_km = [round(res["total_km"], 3)]

    return {
        "circuits": circuits,
        "per_vehicle_km": per_km,
        "total_km": round(sum(per_km), 3),
        "G_augmented": G,
    }