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
          placeholder="ws://localhost:18789 or wss://your-domain:port"
        />
      </div>

      <div className="form-group">
        <label>Gateway Token</label>
        <input
          type="password"
          value={config.gatewayToken}
          onChange={(e) => updateConfig({ gatewayToken: e.target.value })}
          placeholder="Paste your gateway token here"
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
        <p>💡 Default Gateway port is <strong>18789</strong>. Find your token in <code>~/.openclaw/openclaw.json</code></p>
        <p><strong>Local:</strong> <code>ws://localhost:18789</code></p>
        <p><strong>Remote VPS (SSH tunnel):</strong> <code>ssh -L 18789:localhost:18789 your-server</code>, then use <code>ws://localhost:18789</code></p>
        <p><strong>Remote VPS (direct):</strong> If your gateway exposes a public WSS endpoint, use <code>wss://your-domain:port</code></p>
        <p>⚠️ For <code>wss://</code> connections, ensure the gateway has a valid TLS certificate (e.g., via reverse proxy with nginx/caddy).</p>
      </div>
    </div>
  );
}
