interface Props {
  scenario: string;
  onScenarioChange: (scenarioId: string) => void;
  loadingNetwork: boolean;
  loadingRoute: boolean;
  hasRoute: boolean;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  autoReplay: boolean;
  onAutoReplayChange: (value: boolean) => void;
  speed: number;
  onSpeedChange: (value: number) => void;
}

export function Controls({
  scenario,
  onScenarioChange,
  loadingNetwork,
  loadingRoute,
  hasRoute,
  playing,
  onPlay,
  onPause,
  onStop,
  autoReplay,
  onAutoReplayChange,
  speed,
  onSpeedChange,
}: Props) {
  return (
    <>
      <div className="field">
        <label htmlFor="scenario">Stratégie de priorisation</label>
        <select
          id="scenario"
          value={scenario}
          onChange={(e) => onScenarioChange(e.target.value)}
          disabled={loadingNetwork || loadingRoute}
        >
          <option value="costs">1 - Coûts (distance)</option>
          <option value="social">2 - Priorité sociale</option>
          <option value="parking">3 - Fluidité logistique</option>
        </select>
      </div>

      {loadingRoute && <p className="hint">Calcul de la tournée...</p>}

      {hasRoute && (
        <div className="player">
          <h3>Lecture</h3>
          <div className="row">
            <button
              className={playing ? "btn pause" : "btn play"}
              onClick={playing ? onPause : onPlay}
              title={playing ? "Pause" : "Lecture"}
            >
              {playing ? "⏸" : "▶"}
            </button>
            <button className="btn stop" onClick={onStop} title="Stop et retour au départ">
              ⏹
            </button>
          </div>

          <div className="speed-row">
            <span className="speed-label">Vitesse</span>
            <input
              id="speed"
              type="range"
              min={0.25}
              max={4}
              step={0.25}
              value={speed}
              onChange={(e) => onSpeedChange(Number(e.target.value))}
            />
            <span className="speed-val">{speed}</span>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={autoReplay}
              onChange={(e) => onAutoReplayChange(e.target.checked)}
            />
            Lecture en boucle
          </label>
        </div>
      )}

      {loadingNetwork && <p className="hint">Téléchargement / chargement du réseau OSM...</p>}
    </>
  );
}