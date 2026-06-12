import os
import networkx as nx
import osmnx as ox

names = [
    "outremont",
    "verdun",
    "anjou",
    "Rivière-des-prairies-Pointe-aux-Trembles",
]
places = {
    "outremont": "365243902",
    "verdun": "366831077",
    "anjou": "366167758",
    "Rivière-des-prairies-Pointe-aux-Trembles": "361322383",
}


def load_graph(name):
    return ox.load_graphml(filepath=f"sectors/{name}/graph.graphml")


if __name__ == "__main__":
    for name in names:
        filepath = f"sectors/{name}/graph.graphml"

        if not os.path.exists(filepath):
            os.makedirs(f"sectors/{name}", exist_ok=True)
            print(f"Téléchargement du réseau pour {name}...")

            result = ox.geocoder.geocode_to_gdf(
                name + ", Montréal, Québec, Canada"
            )
            display_name = result["display_name"].iloc[0]
            G = ox.graph_from_place(display_name, network_type="drive")

            ox.save_graphml(G, filepath=filepath)
            gdf_nodes, gdf_edges = ox.graph_to_gdfs(G)
            gdf_edges.to_file(
                f"sectors/{name}/edges.geojson", driver="GeoJSON"
            )
        else:
            print(f"Le graphe pour {name} est déjà en cache local.")




