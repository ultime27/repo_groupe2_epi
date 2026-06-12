import type { NetworkResponse, RouteResponse, Sector } from "@/lib/types";
import type { CostParams, FleetCost } from "@/lib/cost";

const eur = (n: number) => n.toLocaleString("fr", { maximumFractionDigits: 0 });

const formatHours = (h: number) => {
  const totalMin = Math.round(h * 60);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
};

interface ParamRow {
  symbol: React.ReactNode;
  label: string;
  value: number;
  unit: string;
}

const SCENARIOS = [
  {
    id: "costs",
    tag: "1",
    name: "Optimisation stricte des coûts",
    subtitle: "Rentabilité pure",
    weight: "W = L (distance réelle)",
    body:
      "Le poids de chaque arc est égal à sa longueur réelle. Le solveur minimise les kilomètres parcourus à vide (deadheading). Avec plusieurs engins, répartir le travail en parallèle garde chaque véhicule sous les 8 h réglementaires et évite les heures supplémentaires majorées.",
    pros: "Coût et consommation les plus bas, peu d'émissions et d'heures supplémentaires.",
    cons: "Ne tient pas compte des priorités : une petite rue peut être déneigée avant une école ou un hôpital.",
  },
  {
    id: "social",
    tag: "2",
    name: "Priorité sociale et services critiques",
    subtitle: "Heuristique en deux phases",
    weight: "Phase 1 : lieux critiques - Phase 2 : réseau restant",
    body:
      "Phase 1 : on repère les lieux prioritaires (hôpitaux, casernes, écoles) et on construit d'abord un parcours qui les relie par le plus court chemin. Phase 2 : les rues restantes sont ajoutées en eulérisant le sous-graphe par flot de coût minimum, puis raccordées à la tournée.",
    pros: "Les secours et les abords des écoles sont dégagés dès le début de la tournée.",
    cons: "Le circuit est plus morcelé : le trajet à vide augmente (jusqu'à ~22 %) et on risque de dépasser les 8 h.",
  },
  {
    id: "parking",
    tag: "3",
    name: "Fluidité et stationnement",
    subtitle: "Gestion des rues étroites",
    weight: "W = L x 5 sur les rues étroites",
    body:
      "On regarde l'attribut lanes du réseau : une rue résidentielle étroite (une voie ou moins) est jugée à risque de blocage. Son poids est multiplié par 5, ce qui pousse le solveur à faire passer les trajets à vide par les grands axes plutôt que par ces rues.",
    pros: "Réduit les blocages dans les petites rues résidentielles.",
    cons: "Peu d'effet quand le quartier est homogène (Outremont) : la pénalité ne change presque rien.",
  },
];

const COMPARE = [
  {
    sector: "Outremont",
    detail: "69,5 km - 224 nœuds",
    rows: [
      { sc: "costs", total: 80.8, dead: 11.3, pct: 14.0 },
      { sc: "social", total: 87.8, dead: 18.3, pct: 20.8 },
      { sc: "parking", total: 81.0, dead: 11.5, pct: 14.2 },
    ],
  },
  {
    sector: "Verdun",
    detail: "101,8 km - 299 nœuds",
    rows: [
      { sc: "costs", total: 110.3, dead: 8.6, pct: 7.8 },
      { sc: "social", total: 130.2, dead: 28.5, pct: 21.9 },
      { sc: "parking", total: 111.6, dead: 9.8, pct: 8.8 },
    ],
  },
  {
    sector: "Anjou",
    detail: "220,6 km - 723 nœuds",
    rows: [
      { sc: "costs", total: 265.0, dead: 44.4, pct: 16.8 },
      { sc: "social", total: 282.0, dead: 61.4, pct: 21.8 },
      { sc: "parking", total: 268.3, dead: 47.7, pct: 17.8 },
    ],
  },
  {
    sector: "Rivière-des-Prairies",
    detail: "706,8 km - 1910 nœuds",
    rows: [
      { sc: "costs", total: 785.8, dead: 79.0, pct: 10.1 },
      { sc: "social", total: 846.1, dead: 139.3, pct: 16.5 },
      { sc: "parking", total: 787.6, dead: 80.8, pct: 10.3 },
    ],
  },
];

const SC_LABEL: Record<string, string> = {
  costs: "Coûts",
  social: "Social",
  parking: "Parking",
};

function Sub({ children }: { children: React.ReactNode }) {
  return <sub style={{ fontSize: "0.7em" }}>{children}</sub>;
}

export function Summary({
  sector,
  network,
  route,
  fleet,
  params,
  scenario,
}: {
  sector: Sector | null;
  network: NetworkResponse | null;
  route: RouteResponse | null;
  fleet: FleetCost | null;
  params: CostParams;
  scenario: string;
}) {
  const paramRows: ParamRow[] = [
    { symbol: <span>v</span>, label: "Vitesse d'exploitation", value: params.vitesse, unit: "km/h" },
    { symbol: <span>T<Sub>seuil</Sub></span>, label: "Seuil des heures normales", value: params.seuil_h, unit: "h" },
    { symbol: <span>C<Sub>fixe</Sub></span>, label: "Coût fixe + amortissement", value: params.cout_fixe, unit: "$/jour" },
    { symbol: <span>C<Sub>k</Sub></span>, label: "Coût kilométrique", value: params.cout_km, unit: "$/km" },
    { symbol: <span>C<Sub>h,reg</Sub></span>, label: "Coût horaire normal (machine + chauffeur)", value: params.cout_h_normal, unit: "$/h" },
    { symbol: <span>C<Sub>h,sup</Sub></span>, label: "Coût horaire majoré", value: params.cout_h_sup, unit: "$/h" },
    { symbol: <span>gamma</span>, label: "Consommation de carburant", value: params.conso_l_h, unit: "L/h" },
    { symbol: <span>P<Sub>carb</Sub></span>, label: "Prix du carburant", value: params.prix_essence, unit: "$/L" },
  ];

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
    <div className="summary">
      <div className="summary-inner">
        <header className="summary-head">
          <h1>Synthèse de l'étude</h1>
          <p>
            Optimisation des opérations de déneigement de la Ville de Montréal.
            On traite le réseau comme un problème du postier chinois orienté
            (DCPP), résolu par partitionnement K-Means puis par un flot de coût
            minimum.
            {sector && (
              <>
                {" "}Secteur affiché : <strong>{sector.name}</strong>.
              </>
            )}
          </p>
        </header>

        <section className="summary-card">
          <h2>Fonction de coût d'exploitation</h2>
          <p className="summary-text">
            Pour chaque véhicule <em>i</em> de la flotte (N<sub>v</sub> engins),
            le coût d'une journée dépend de sa distance d<sub>i</sub> et de son
            temps de service t<sub>i</sub> = d<sub>i</sub> / v. Le coût total est
            la somme sur toute la flotte :
          </p>

          <div className="formula">
            <span className="f-sum">
              <span className="f-sum-top">N<sub>v</sub></span>
              <span className="f-sum-sigma">SOMME</span>
              <span className="f-sum-bot">i = 1</span>
            </span>
            <span className="f-body">
              C<sub>fixe</sub>
              <span className="op">+</span> C<sub>k</sub> x d<sub>i</sub>
              <span className="op">+</span> C<sub>h,reg</sub> x min(t<sub>i</sub>, T<sub>seuil</sub>)
              <span className="op">+</span> C<sub>h,sup</sub> x max(0, t<sub>i</sub> - T<sub>seuil</sub>)
              <span className="op">+</span> gamma x P<sub>carb</sub> x t<sub>i</sub>
            </span>
          </div>

          <p className="summary-text muted">
            Les heures sont séparées en heures <strong>normales</strong> (&lt;= T<sub>seuil</sub>),
            facturées C<sub>h,reg</sub>, et heures <strong>supplémentaires</strong>,
            majorées C<sub>h,sup</sub>. Le dernier terme correspond au carburant
            (consommation x prix x durée).
          </p>

          <table className="param-table">
            <thead>
              <tr>
                <th>Symbole</th>
                <th>Paramètre</th>
                <th className="num-col">Valeur</th>
                <th>Unité</th>
              </tr>
            </thead>
            <tbody>
              {paramRows.map((r, i) => (
                <tr key={i}>
                  <td className="sym">{r.symbol}</td>
                  <td>{r.label}</td>
                  <td className="num-col">{r.value}</td>
                  <td className="muted">{r.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {route && fleet && parts ? (
          <section className="summary-card">
            <h2>Décomposition du coût de la tournée courante</h2>
            <div className="breakdown">
              <div className="bd-item">
                <span className="bd-k">Part fixe ({fleet.nVehicles} x C<sub>fixe</sub>)</span>
                <span className="bd-v">{eur(parts.fixed)} $</span>
              </div>
              <div className="bd-item">
                <span className="bd-k">Distance (C<sub>k</sub> x somme d<sub>i</sub>)</span>
                <span className="bd-v">{eur(parts.distance)} $</span>
              </div>
              <div className="bd-item">
                <span className="bd-k">Heures normales</span>
                <span className="bd-v">{eur(parts.hoursNormal)} $</span>
              </div>
              <div className="bd-item">
                <span className="bd-k">Heures supplémentaires</span>
                <span className="bd-v">{eur(parts.hoursOver)} $</span>
              </div>
              <div className="bd-item">
                <span className="bd-k">Carburant (gamma x P x t)</span>
                <span className="bd-v">{eur(parts.fuel)} $</span>
              </div>
              <div className="bd-item bd-total">
                <span className="bd-k">Coût total</span>
                <span className="bd-v">{eur(total)} $</span>
              </div>
            </div>
            <div className="kpi-row">
              <div className="kpi">
                <span className="kpi-v">{route.stats.circuit_km.toFixed(1)} km</span>
                <span className="kpi-k">Distance totale</span>
              </div>
              <div className="kpi">
                <span className="kpi-v">
                  {route.stats.deadhead_km.toFixed(1)} km
                  <small> - {route.stats.deadhead_pct}%</small>
                </span>
                <span className="kpi-k">À vide (deadhead)</span>
              </div>
              <div className="kpi">
                <span className="kpi-v">{fleet.nVehicles}</span>
                <span className="kpi-k">Déneigeuses</span>
              </div>
              <div className="kpi">
                <span className="kpi-v">{formatHours(fleet.perVehicleHours)}</span>
                <span className="kpi-k">Durée (en parallèle)</span>
              </div>
            </div>
          </section>
        ) : (
          <section className="summary-card">
            <h2>Décomposition du coût de la tournée courante</h2>
            <p className="summary-text muted">
              Sélectionne un secteur dans le bandeau pour calculer une tournée
              et afficher le détail de son coût.
            </p>
          </section>
        )}

        <section className="summary-card">
          <h2>Les trois scénarios de priorisation</h2>
          <div className="scenario-grid">
            {SCENARIOS.map((s) => (
              <div
                key={s.id}
                className={s.id === scenario ? "scenario active" : "scenario"}
              >
                <div className="scenario-head">
                  <span className="scenario-tag">{s.tag}</span>
                  <div>
                    <h3>{s.name}</h3>
                    <span className="scenario-sub">{s.subtitle}</span>
                  </div>
                  {s.id === scenario && <span className="scenario-badge">actif</span>}
                </div>
                <code className="scenario-weight">{s.weight}</code>
                <p>{s.body}</p>
                <p className="pro">+ {s.pros}</p>
                <p className="con">- {s.cons}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="summary-card">
          <h2>Résultats de référence sur les quatre secteurs</h2>
          <p className="summary-text muted">
            Résultats de référence (kilomètres parcourus, distance à vide et part
            du deadhead) pour chaque secteur et chaque scénario.
          </p>
          <table className="compare-table">
            <colgroup>
              <col style={{ width: "30%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Secteur</th>
                <th>Scénario</th>
                <th className="num-col">Distance</th>
                <th className="num-col">Deadhead</th>
                <th className="num-col">%</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((c) =>
                c.rows.map((r, ri) => (
                  <tr
                    key={`${c.sector}-${r.sc}`}
                    className={[
                      r.sc === scenario ? "row-active" : "",
                      ri === 0 ? "sector-start" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {ri === 0 && (
                      <td rowSpan={c.rows.length} className="sector-cell">
                        <span className="sector-name">{c.sector}</span>
                        <span className="muted">{c.detail}</span>
                      </td>
                    )}
                    <td>{SC_LABEL[r.sc]}</td>
                    <td className="num-col">{r.total.toFixed(1)} km</td>
                    <td className="num-col">{r.dead.toFixed(1)} km</td>
                    <td className="num-col">{r.pct.toFixed(1)} %</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="summary-card">
          <h2>Les étapes de l'algorithme</h2>
          <ol className="method-list">
            <li>
              <strong>Modélisation.</strong> Le réseau OSM devient un graphe
              orienté G = (V, A) ; chaque rue à double sens est coupée en deux
              arcs opposés pour respecter les sens uniques.
            </li>
            <li>
              <strong>Partitionnement K-Means.</strong> Avec plus d'une
              déneigeuse (N &gt; 1), les intersections sont regroupées en N zones
              compactes (projection Web Mercator par cos(latitude)), puis
              équilibrées par échanges entre zones voisines.
            </li>
            <li>
              <strong>Eulérisation.</strong> Un flot de coût minimum
              (min_cost_flow) sur les nœuds en surplus ou en déficit ajoute les
              arcs à vide nécessaires ; le graphe complété devient eulérien.
            </li>
            <li>
              <strong>Circuit.</strong> L'algorithme de Hierholzer parcourt ce
              graphe et produit un circuit fermé qui passe par chaque rue au
              moins une fois ; c'est le trajet animé sur la carte.
            </li>
          </ol>
          {network && (
            <p className="summary-text muted">
              Secteur affiché : {network.stats.n_nodes.toLocaleString("fr")}{" "}
              intersections, {network.stats.n_edges.toLocaleString("fr")} tronçons,{" "}
              {network.stats.total_km.toFixed(1)} km de voirie.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
