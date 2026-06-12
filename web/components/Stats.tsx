import type { NetworkStats, RouteStats } from "@/lib/types";
import type { FleetCost } from "@/lib/cost";

function Line({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="stat">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

const eur = (n: number) => n.toLocaleString("fr", { maximumFractionDigits: 0 });

const formatHours = (h: number) => {
  const totalMin = Math.round(h * 60);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
};

export function Stats({
  network,
  route,
  fleet,
}: {
  network: NetworkStats | null;
  route: RouteStats | null;
  fleet: FleetCost | null;
}) {
  const parts = fleet && {
    fixed: Math.round(fleet.fixed),
    distance: Math.round(fleet.distance),
    hoursNormal: Math.round(fleet.hoursNormal),
    hoursOver: Math.round(fleet.hoursOver),
    fuel: Math.round(fleet.fuel),
  };
  const total = parts
    ? parts.fixed + parts.distance + parts.hoursNormal + parts.hoursOver + parts.fuel
    : 0;

  return (
    <>
      {network && (
        <div className="card">
          <h3>Reseau du secteur</h3>
          <Line k="Intersections" v={network.n_nodes.toLocaleString("fr")} />
          <Line k="Troncons" v={network.n_edges.toLocaleString("fr")} />
          <Line k="Longueur totale" v={`${network.total_km.toFixed(1)} km`} />
          <Line k="Noeuds desequilibres" v={network.n_unbalanced.toLocaleString("fr")} />
        </div>
      )}

      {route && fleet && parts && (
        <div className="card">
          <h3>Tournee and flotte</h3>
          <Line k="Distance totale" v={`${route.circuit_km.toFixed(1)} km`} />
          <Line
            k="dont a vide (deadhead)"
            v={`${route.deadhead_km.toFixed(1)} km (${route.deadhead_pct}%)`}
          />
          <Line k="Deneigeuses" v={fleet.nVehicles} />
          <Line k="Distance / deneigeuse" v={`${fleet.perVehicleKm.toFixed(1)} km`} />
          <Line k="Duree (en parallel)" v={formatHours(fleet.perVehicleHours)} />
          <div className="divider" />
          <Line k={`Part fixe (${fleet.nVehicles} x)`} v={`${eur(parts.fixed)} $`} />
          <Line k="Part distance" v={`${eur(parts.distance)} $`} />
          <Line k="Heures normales" v={`${eur(parts.hoursNormal)} $`} />
          <Line k="Heures sup." v={`${eur(parts.hoursOver)} $`} />
          <Line k="Carburant" v={`${eur(parts.fuel)} $`} />
          <div className="divider" />
          <div className="stat">
            <span className="k">
              Cout total ({fleet.nVehicles} deneigeuse{fleet.nVehicles > 1 ? "s" : ""})
            </span>
            <span className="cost">{eur(total)} $</span>
          </div>
        </div>
      )}
    </>
  );
}