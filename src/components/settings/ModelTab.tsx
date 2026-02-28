import { useState, useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { type AppConfig, copyModel, listModels, deleteModel } from "../../lib/config";

interface Props {
  config: AppConfig;
  updateConfig: (patch: Partial<AppConfig>) => void;
}

export default function ModelTab({ config, updateConfig }: Props) {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const list = await listModels();
      setModels(list);
    } catch (err) {
      console.error("[ModelTab] Failed to list models:", err);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleImport = async () => {
    const selected = await open({
      title: "Select a VRM Model",
      filters: [{ name: "VRM Models", extensions: ["vrm"] }],
      multiple: false,
    });
    if (!selected) return;

    setLoading(true);
    try {
      const filename = await copyModel(selected);
      updateConfig({ modelPath: filename });
      await refresh();
    } catch (err) {
      console.error("[ModelTab] Failed to import model:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (filename: string) => {
    updateConfig({ modelPath: filename });
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete model "${filename}"?`)) return;
    try {
      await deleteModel(filename);
      if (config.modelPath === filename) {
        updateConfig({ modelPath: "" });
      }
      await refresh();
    } catch (err) {
      console.error("[ModelTab] Failed to delete model:", err);
    }
  };

  return (
    <div className="tab-content">
      <h2>模型管理</h2>
      <p className="tab-desc">Import and switch VRM models for your companion.</p>

      <button className="btn primary" onClick={handleImport} disabled={loading}>
        {loading ? "Importing..." : "📂 Import VRM Model"}
      </button>

      <div className="model-list">
        <h3>Available Models</h3>
        {models.length === 0 ? (
          <p className="empty-hint">No models imported yet. Click the button above or place a .vrm file in public/models/ for development.</p>
        ) : (
          models.map((m) => (
            <div key={m} className={`model-item${config.modelPath === m ? " active" : ""}`}>
              <span className="model-name" onClick={() => handleSelect(m)}>
                {config.modelPath === m ? "✅ " : ""}
                {m}
              </span>
              <button className="btn-icon danger" onClick={() => handleDelete(m)} title="Delete">🗑️</button>
            </div>
          ))
        )}
      </div>

      <div className="current-model">
        <h3>Current Model</h3>
        <code>{config.modelPath || "(default test model)"}</code>
      </div>
    </div>
  );
}
