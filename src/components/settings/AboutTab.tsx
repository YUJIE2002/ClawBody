export default function AboutTab() {
  return (
    <div className="tab-content">
      <h2>About ClawBody</h2>

      <div className="about-hero">
        <span className="about-icon">🎭</span>
        <h3>ClawBody v1.0.0</h3>
        <p>Give Your AI a Body</p>
      </div>

      <div className="about-links">
        <a href="https://github.com/YUJIE2002/ClawBody" target="_blank" rel="noreferrer">
          📦 GitHub Repository
        </a>
        <a href="https://github.com/openclaw/openclaw" target="_blank" rel="noreferrer">
          🦞 OpenClaw Framework
        </a>
        <a href="https://hub.vroid.com" target="_blank" rel="noreferrer">
          🎨 VRoid Hub — Find VRM Models
        </a>
        <a href="https://vroid.com/en/studio" target="_blank" rel="noreferrer">
          ✏️ VRoid Studio — Create Your Own
        </a>
      </div>

      <div className="about-credits">
        <h3>Credits</h3>
        <ul>
          <li><strong>OpenClaw</strong> — AI agent framework</li>
          <li><strong>Tauri</strong> — Desktop app framework</li>
          <li><strong>Three.js + @pixiv/three-vrm</strong> — 3D rendering</li>
          <li><strong>VRoid</strong> — Character creation tools</li>
        </ul>
      </div>

      <div className="about-footer">
        <p>Built with ❤️ by <a href="https://github.com/YUJIE2002" target="_blank" rel="noreferrer">YUJIE2002</a></p>
        <p className="license">MIT License — Do whatever you want with it.</p>
      </div>
    </div>
  );
}
