"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Controls } from "@/components/Controls";
import { CostControls } from "@/components/CostControls";
import { Stats } from "@/components/Stats";
import { Summary } from "@/components/Summary";
import { getNetwork, getRoute, getSectors } from "@/lib/api";
import { computeFleetCost, DEFAULT_COST_PARAMS, type CostParams } from "@/lib/cost";
import type { NetworkResponse, RouteResponse, Sector } from "@/lib/types";

const MapView = dynamic(
  () => import("@/components/MapView").then((m) => m.MapView),
  { ssr: false }
);

export default function Home() {
  const [scenario, setScenario] = useState<string>("costs");
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selected, setSelected] = useState("");
  const [network, setNetwork] = useState<NetworkResponse | null>(null);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [loadingNetwork, setLoadingNetwork] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [costParams, setCostParams] = useState<CostParams>(DEFAULT_COST_PARAMS);
  const [nVehicles, setNVehicles] = useState(1);
  const [autoReplay, setAutoReplay] = useState(false);
  const [finished, setFinished] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useState<"carte" | "resume">("carte");

  // Paramètres de coût lus via ref ils n'influent pas sur l'algo de passage
  // donc pas de recalcul de tournée
  const paramsRef = useRef(costParams);
  useEffect(() => {
    paramsRef.current = costParams;
  }, [costParams]);

  const hasRouteRef = useRef(false);
  useEffect(() => {
    hasRouteRef.current = !!route;
  }, [route]);

  useEffect(() => {
    let cancelled = false;
    getSectors()
      .then((s) => {
        if (cancelled) return;
        setSectors(s);
        if (s.length) setSelected(s[0].id);
      })
      .catch((e) => setError(`API injoignable (${e.message}). Le backend est-il lancé ?`));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setRoute(null);
    setPlaying(false);
    setFinished(false);
    setError(null);
    setNetwork(null);
    setLoadingNetwork(true);
    getNetwork(selected)
      .then((n) => {
        if (!cancelled) setNetwork(n);
      })
      .catch((e) => {
        if (!cancelled) setError(`Réseau indisponible : ${e.message}`);
      })
      .finally(() => {
        if (!cancelled) setLoadingNetwork(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const runRoute = useCallback(() => {
    if (!selected) return;
    setLoadingRoute(true);
    setError(null);
    setFinished(false);
    getRoute(selected, { ...paramsRef.current, scenario, n_vehicles: nVehicles })
      .then((r) => {
        setRoute(r);
        setResetNonce((n) => n + 1);
        setPlaying(true);
      })
      .catch((e) => setError(`Calcul de tournée impossible : ${e.message}`))
      .finally(() => setLoadingRoute(false));
  }, [selected, scenario, nVehicles]);

  // Scénario et nombre de déneigeuses changent l'algo de passage
  // on relance le calcul automatiquement si une tournée existe déjà
  const runRouteRef = useRef(runRoute);
  useEffect(() => {
    runRouteRef.current = runRoute;
  }, [runRoute]);

  useEffect(() => {
    if (!hasRouteRef.current) return;
    const id = setTimeout(() => runRouteRef.current(), 400);
    return () => clearTimeout(id);
  }, [scenario, nVehicles]);

  // Réseau d'un secteur chargé on calcule la tournée automatiquement
  // plus de bouton Lancer manuel
  useEffect(() => {
    if (!network) return;
    runRouteRef.current();
  }, [network]);

  const onPlay = () => {
    if (finished) {
      setResetNonce((n) => n + 1);
      setFinished(false);
    }
    setPlaying(true);
  };
  const onPause = () => setPlaying(false);
  const onStop = () => {
    setResetNonce((n) => n + 1);
    setFinished(false);
    setPlaying(false);
  };
  const onFinished = useCallback(() => {
    setPlaying(false);
    setFinished(true);
  }, []);

  const cost = route
    ? computeFleetCost(route.stats.per_vehicle_km, costParams)
    : null;

  const currentSector = sectors.find((s) => s.id === selected) ?? null;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-brand">
          <h1>Déneigement de Montréal</h1>
          <span>ERO1</span>
        </div>

        <div className="topbar-sector">
          <label htmlFor="topbar-sector">Secteur</label>
          <select
            id="topbar-sector"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={loadingNetwork || loadingRoute || sectors.length === 0}
          >
            {sectors.length === 0 && <option>Chargement...</option>}
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <nav className="topbar-tabs">
          <button
            className={view === "carte" ? "tab active" : "tab"}
            onClick={() => setView("carte")}
          >
            Carte
          </button>
          <button
            className={view === "resume" ? "tab active" : "tab"}
            onClick={() => setView("resume")}
          >
            Résumé
          </button>
        </nav>
      </header>

      {view === "carte" ? (
        <div className="app">
          <aside className="sidebar">
            <Controls
              scenario={scenario}
              onScenarioChange={setScenario}
              loadingNetwork={loadingNetwork}
              loadingRoute={loadingRoute}
              hasRoute={!!route}
              playing={playing}
              onPlay={onPlay}
              onPause={onPause}
              onStop={onStop}
              autoReplay={autoReplay}
              onAutoReplayChange={setAutoReplay}
              speed={speed}
              onSpeedChange={setSpeed}
            />

            {error && <p className="error">{error}</p>}

            <Stats
              network={network?.stats ?? null}
              route={route?.stats ?? null}
              fleet={cost}
            />

            <CostControls
              params={costParams}
              onChange={setCostParams}
              onReset={() => setCostParams(DEFAULT_COST_PARAMS)}
              nVehicles={nVehicles}
              onNVehicles={setNVehicles}
            />

            <div className="spacer" />

            <p className="hint">
              Sélectionne un secteur puis lance la déneigeuse : le réseau provient
              d&apos;OpenStreetMap, la tournée est calculée par flot de coût minimum
              (problème du postier chinois) et animée le long du circuit eulérien.
            </p>
          </aside>

          <div className="map-wrap">
            <MapView
              network={network}
              route={route}
              playing={playing}
              resetNonce={resetNonce}
              autoReplay={autoReplay}
              speed={speed}
              onFinished={onFinished}
            />
          </div>
        </div>
      ) : (
        <Summary
          sector={currentSector}
          network={network}
          route={route}
          fleet={cost}
          params={costParams}
          scenario={scenario}
        />
      )}
    </div>
  );
}