import type { AppConfig } from "../../lib/config";

interface Props {
  config: AppConfig;
  updateConfig: (patch: Partial<AppConfig>) => void;
}

export default function AppearanceTab({ config, updateConfig }: Props) {
  return (
    <div className="tab-content">
      <h2>外观设置</h2>
      <p className="tab-desc">Customize how your companion looks on the desktop.</p>

      <div className="form-group">
        <label>Window Width: {config.windowWidth}px</label>
        <input
          type="range"
          min={200} max={800} step={10}
          value={config.windowWidth}
          onChange={(e) => {
            const w = Number(e.target.value);
            updateConfig({ windowWidth: w, windowHeight: Math.round(w * 1.5) });
          }}
        />
        <div className="range-labels"><span>200px</span><span>800px</span></div>
      </div>

      <div className="form-group">
        <label>Opacity: {Math.round(config.opacity * 100)}%</label>
        <input
          type="range"
          min={30} max={100} step={5}
          value={config.opacity * 100}
          onChange={(e) => updateConfig({ opacity: Number(e.target.value) / 100 })}
        />
        <div className="range-labels"><span>30%</span><span>100%</span></div>
      </div>

      <div className="form-group">
        <label>Character Scale: {config.characterScale.toFixed(1)}x</label>
        <input
          type="range"
          min={50} max={200} step={10}
          value={config.characterScale * 100}
          onChange={(e) => updateConfig({ characterScale: Number(e.target.value) / 100 })}
        />
        <div className="range-labels"><span>0.5x</span><span>2.0x</span></div>
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={config.alwaysOnTop}
            onChange={(e) => updateConfig({ alwaysOnTop: e.target.checked })}
          />
          Always on Top
        </label>
      </div>
    </div>
  );
}
