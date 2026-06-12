import { COST_FIELDS, type CostParams } from "@/lib/cost";

interface Props {
  params: CostParams;
  onChange: (p: CostParams) => void;
  onReset: () => void;
  nVehicles: number;
  onNVehicles: (n: number) => void;
}

export function CostControls({
  params,
  onChange,
  onReset,
  nVehicles,
  onNVehicles,
}: Props) {
  const set = (key: keyof CostParams, value: number) => {
    if (!Number.isFinite(value)) return;
    onChange({ ...params, [key]: value });
  };

  return (
    <div className="card">
      <h3>Flotte and couts</h3>

      <div className="cost-field">
        <div className="cost-field-head">
          <label htmlFor="n_vehicles">Nombre de deneigeuses</label>
          <input
            className="num"
            id="n_vehicles"
            type="number"
            min={1}
            max={30}
            step={1}
            value={nVehicles}
            onChange={(e) =>
              onNVehicles(Math.min(30, Math.max(1, Math.round(e.target.valueAsNumber) || 1)))
            }
          />
          <span className="unit"></span>
        </div>
        <input
          className="range"
          type="range"
          min={1}
          max={30}
          step={1}
          value={nVehicles}
          onChange={(e) => onNVehicles(e.target.valueAsNumber)}
          aria-label="Nombre de deneigeuses"
        />
      </div>

      <div className="divider" />

      {COST_FIELDS.map((f) => (
        <div className="cost-field" key={f.key}>
          <div className="cost-field-head">
            <label htmlFor={f.key}>{f.label}</label>
            <input
              className="num"
              id={f.key}
              type="number"
              min={f.min}
              max={f.max}
              step={f.step}
              value={params[f.key]}
              onChange={(e) => set(f.key, e.target.valueAsNumber)}
            />
            <span className="unit">{f.unit}</span>
          </div>
          <input
            className="range"
            type="range"
            min={f.min}
            max={f.max}
            step={f.step}
            value={params[f.key]}
            onChange={(e) => set(f.key, e.target.valueAsNumber)}
            aria-label={f.label}
          />
        </div>
      ))}
      <button className="btn" onClick={onReset} style={{ marginTop: 8 }}>
        Valeurs par defaut
      </button>
    </div>
  );
}