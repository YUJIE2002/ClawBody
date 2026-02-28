<div align="center">

# 🦴 ClawBody

### Give Your AI a Body

*A desktop companion that renders a living, breathing 3D avatar powered by AI.*

*让你的 AI 拥有一个身体 — 桌面 3D 虚拟伙伴，由 AI 驱动。*

[![CI](https://github.com/guyujie/clawbody/actions/workflows/ci.yml/badge.svg)](https://github.com/guyujie/clawbody/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-orange)](https://tauri.app)
[![Powered by OpenClaw](https://img.shields.io/badge/Powered%20by-OpenClaw-purple)](https://github.com/nickcamillo/openclaw)

<br />

<!-- TODO: Replace with actual screenshot -->
<img src="docs/assets/screenshot-placeholder.png" alt="ClawBody Screenshot" width="300" />

*Screenshot coming soon — imagine a cute VRM character sitting on your desktop, reacting to your AI's emotions in real-time.*

</div>

---

## What is ClawBody?

ClawBody puts a **3D VRM avatar on your desktop** that acts as the visual body of your AI agent. It sits as a transparent overlay — no window chrome, no background — just your character floating on screen.

The character is connected to [OpenClaw](https://github.com/nickcamillo/openclaw), an AI agent framework. When the AI thinks, the character thinks. When it speaks, the mouth moves. When it's happy, it smiles. It's not a static pet — it's a living interface to your AI.

```
┌──────────────────────────┐
│                          │
│   Your Desktop           │
│                          │
│              ┌────────┐  │
│              │  VRM   │  │
│              │ Avatar │  │    ← Transparent overlay, always on top
│              │  (◕‿◕) │  │    ← Reacts to AI emotions in real-time
│              └────────┘  │
│                          │
│   [Browser] [IDE] [Term] │
└──────────────────────────┘
```

## Features

| Feature | Status | Description |
|---------|--------|-------------|
| 🖼️ VRM Character Rendering | 🚧 | Three.js + @pixiv/three-vrm 3D avatar display |
| 🪟 Transparent Desktop Overlay | 🚧 | Frameless, always-on-top, click-through capable |
| 😊 Emotion Expressions | 🚧 | AI emotions → VRM blend shape animations |
| 🗣️ Lip Sync | 🚧 | Mouth animation synchronized with TTS audio |
| 🧠 OpenClaw Integration | 🚧 | WebSocket bridge to AI agent gateway |
| 💤 Idle Animations | 🚧 | Breathing, blinking, subtle head movement |
| 🎤 Voice Input (STT) | 📋 | Speak to your AI through the companion |
| 🔊 Voice Output (TTS) | 📋 | AI speaks back with animated character |
| 🖱️ Draggable Window | 🚧 | Drag the character anywhere on screen |
| 📌 System Tray | 🚧 | Quick access via tray icon |
| 🎭 Custom VRM Models | 📋 | Load any VRM model from VRoid Hub or custom |
| 🔌 Plugin System | 📋 | Extensible animation and behavior plugins |

> 🚧 = In Progress &nbsp; 📋 = Planned

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Desktop Shell** | [Tauri v2](https://tauri.app) (Rust) | Lightweight native window with transparency |
| **3D Rendering** | [Three.js](https://threejs.org/) + [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) | VRM character rendering and animation |
| **Frontend** | React + TypeScript | UI components and state management |
| **AI Brain** | [OpenClaw](https://github.com/nickcamillo/openclaw) | Agent framework — emotions, speech, tools |

## Quick Start

### Prerequisites

- **Node.js** 20+
- **Rust** 1.75+ (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- Platform-specific deps (see [Development Guide](docs/DEVELOPMENT.md))

### Install & Run

```bash
# Clone the repository
git clone https://github.com/guyujie/clawbody.git
cd clawbody

# Install dependencies
npm install

# Run in development mode
cargo tauri dev
```

### Add a VRM Model

1. Download a model from [VRoid Hub](https://hub.vroid.com/) or create one with [VRoid Studio](https://vroid.com/en/studio)
2. Place it at `public/models/default.vrm`
3. Restart the app — your character appears!

## Architecture

```
 ┌─────────────────────────────────────────┐
 │              ClawBody App               │
 │                                         │
 │  ┌─────────────┐    ┌───────────────┐   │
 │  │ Tauri (Rust) │◄──►│ React + Three │  │
 │  │             │ IPC │               │   │
 │  │ • Window    │     │ • VRM Render  │   │
 │  │ • Tray      │     │ • Animations  │   │
 │  │ • Native    │     │ • Emotions    │   │
 │  └─────────────┘    └───────┬───────┘   │
 │                              │ WS        │
 └──────────────────────────────┼───────────┘
                                │
                    ┌───────────▼──────────┐
                    │   OpenClaw Gateway   │
                    │                      │
                    │  AI · TTS · STT ·    │
                    │  Tools · Memory      │
                    └──────────────────────┘
```

For detailed architecture documentation, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Project Structure

```
clawbody/
├── src/                    # React + TypeScript frontend
│   ├── components/         #   UI components
│   │   └── VRMViewer.tsx   #   Three.js VRM renderer
│   ├── hooks/              #   React hooks
│   │   └── useOpenClaw.ts  #   OpenClaw WebSocket bridge
│   ├── lib/                #   Utility modules
│   │   ├── emotion.ts      #   Emotion → expression mapping
│   │   └── vrm-loader.ts   #   VRM model loading
│   └── styles/             #   Stylesheets
├── src-tauri/              # Rust backend (Tauri v2)
│   ├── src/lib.rs          #   Commands + setup
│   └── tauri.conf.json     #   Window config
├── docs/                   # Documentation
└── public/models/          # VRM models (gitignored)
```

## Development

See the full [Development Guide](docs/DEVELOPMENT.md) for:
- Detailed setup instructions per platform
- Project structure walkthrough
- Debugging tips
- How to add new emotions and animations

## Screenshots

<div align="center">

*Coming soon!*

<!-- TODO: Add actual screenshots
| Idle | Happy | Speaking |
|------|-------|----------|
| ![idle](docs/assets/idle.png) | ![happy](docs/assets/happy.png) | ![speaking](docs/assets/speaking.png) |
-->

</div>

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Whether you're into **3D rendering**, **Rust**, **AI**, or **UI/UX** — there's room for you here.

## License

[MIT](LICENSE) — do whatever you want with it.

## Acknowledgments

- [OpenClaw](https://github.com/nickcamillo/openclaw) — The AI agent framework that powers the brain
- [Tauri](https://tauri.app) — Lightweight desktop app framework
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) — VRM rendering for Three.js
- [VRoid Hub](https://hub.vroid.com/) — VRM model community

---

<div align="center">

**Powered by [OpenClaw](https://github.com/nickcamillo/openclaw)** ⚡

*Built with obsessive attention to detail by humans and their AI children.*

</div>

---

<details>
<summary>🇨🇳 中文说明</summary>

## ClawBody — 让你的 AI 拥有一个身体

ClawBody 是一个桌面伴侣应用，它在你的桌面上渲染一个 3D VRM 虚拟角色。这个角色由 [OpenClaw](https://github.com/nickcamillo/openclaw) AI 智能体框架驱动。

### 特性

- 🖼️ VRM 3D 角色渲染（Three.js）
- 🪟 透明桌面覆盖层（无边框、始终置顶）
- 😊 情感表达（AI 情绪 → VRM 表情动画）
- 🗣️ 口型同步（配合 TTS 语音输出）
- 🧠 OpenClaw 集成（WebSocket 实时通信）
- 💤 待机动画（呼吸、眨眼、微微摇头）

### 技术栈

- **Tauri v2**（Rust）— 轻量级桌面框架
- **Three.js + @pixiv/three-vrm** — 3D 渲染
- **React + TypeScript** — 前端
- **OpenClaw** — AI 智能体框架

### 快速开始

```bash
git clone https://github.com/guyujie/clawbody.git
cd clawbody
npm install
cargo tauri dev
```

详细开发文档见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。

### 许可证

MIT — 随便用。

</details>
