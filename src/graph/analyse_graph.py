import networkx as nx

def analyse_graph(G):
    if not nx.is_strongly_connected(G):
        scc = max(nx.strongly_connected_components(G), key=len)
        G = G.subgraph(scc).copy()
    n_nodes = G.number_of_nodes()
    total_km = sum(d.get("length", 0) for _, _, d in G.edges(data=True)) / 1000
    n_edges = G.number_of_edges()
    n_unbalanced = sum(1 for n in G.nodes() if G.in_degree(n) != G.out_degree(n))
    return {
        "n_nodes": n_nodes,
        "n_edges": n_edges,
        "total_km": total_km,
        "n_unbalanced": n_unbalanced,
        "graph": G
    }
