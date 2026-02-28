import { useState } from "react";
import type { AppConfig } from "../../lib/config";

interface Props {
  config: AppConfig;
  updateConfig: (patch: Partial<AppConfig>) => void;
}

export default function ConnectionTab({ config, updateConfig }: Props) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const ws = new WebSocket(config.gatewayUrl);
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => { ws.close(); resolve(); };
        ws.onerror = () => reject();
        setTimeout(() => { ws.close(); reject(); }, 5000);
      });
      setTestResult("ok");
    } catch {
      setTestResult("fail");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="tab-content">
      <h2>OpenClaw 连接</h2>
      <p className="tab-desc">Configure the connection to your OpenClaw gateway.</p>

      <div className="form-group">
        <label>Gateway WebSocket URL</label>
        <input
          type="text"
          value={config.gatewayUrl}
          onChange={(e) => updateConfig({ gatewayUrl: e.target.value })}
          placeholder="ws://localhost:4100/ws"
        />
      </div>

      <div className="form-row">
        <button className="btn primary" onClick={handleTest} disabled={testing}>
          {testing ? "Testing..." : "🔌 Test Connection"}
        </button>
        {testResult === "ok" && <span className="status-ok">✅ Connected</span>}
        {testResult === "fail" && <span className="status-fail">❌ Failed to connect</span>}
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={config.autoReconnect}
            onChange={(e) => updateConfig({ autoReconnect: e.target.checked })}
          />
          Auto-reconnect when disconnected
        </label>
      </div>

      <div className="info-box">
        <p>💡 Make sure your OpenClaw gateway is running. Default port is 4100.</p>
        <p>If you haven't set up OpenClaw yet, visit <a href="https://github.com/openclaw/openclaw" target="_blank" rel="noreferrer">github.com/openclaw/openclaw</a></p>
      </div>
    </div>
  );
}
