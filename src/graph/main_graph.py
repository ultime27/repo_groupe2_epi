from src.graph.init_graph import init_graph
from src.graph.analyse_graph import analyse_graph
from src.graph.cpp_graph import cpp
from src.calcul import cout_vehicule

def graph_main(city):
    G_raw = init_graph(city)
    if G_raw is None:
        return None

    km_brut = sum(d.get("length", 0) for _, _, d in G_raw.edges(data=True)) / 1000

    result_analyse = analyse_graph(G_raw)
    G = result_analyse["graph"]
    result_cpp = cpp(G)
    cost = cout_vehicule(result_cpp["total_km"])

    km_non_couverts = km_brut - result_analyse["total_km"]

    return {
        "city": city,
        "analyse": result_analyse,
        "cpp": result_cpp,
        "cost": cost,
        "uncovered": {
            "km": round(km_non_couverts, 2),
            "pct": round(100 * km_non_couverts / km_brut, 1) if km_brut > 0 else 0
        }
    }