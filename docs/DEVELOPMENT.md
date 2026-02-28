# Development Guide

> Everything you need to set up and develop ClawBody locally.

## Prerequisites

| Tool | Version | Installation |
|------|---------|-------------|
| **Node.js** | 20+ | [nodejs.org](https://nodejs.org/) |
| **Rust** | 1.75+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Tauri CLI** | 2.x | `cargo install tauri-cli` |

### Platform-Specific Dependencies

#### Ubuntu / Debian
```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl wget file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

#### macOS
```bash
xcode-select --install
```

#### Windows
- Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 11)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/guyujie/clawbody.git
cd clawbody

# Install frontend dependencies
npm install

# Run in development mode (hot-reload)
cargo tauri dev
```

The app will open with a transparent window. Place a VRM model at `public/models/default.vrm` to see a character.

## Project Structure

```
clawbody/
├── src/                    # React frontend
│   ├── components/         # React components
│   │   └── VRMViewer.tsx   # Three.js VRM renderer
│   ├── hooks/              # React hooks
│   │   └── useOpenClaw.ts  # OpenClaw WebSocket bridge
│   ├── lib/                # Utility modules
│   │   ├── emotion.ts      # Emotion mapping system
│   │   └── vrm-loader.ts   # VRM loading helpers
│   ├── styles/             # CSS
│   │   └── global.css      # Global transparent styles
│   ├── App.tsx             # Root component
│   └── main.tsx            # Entry point
├── src-tauri/              # Tauri Rust backend
│   ├── src/
│   │   ├── lib.rs          # Tauri commands and plugins
│   │   └── main.rs         # Entry point
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── public/
│   └── models/             # VRM model files (gitignored)
└── docs/                   # Documentation
```

## Development Workflow

### Running the Dev Server

```bash
cargo tauri dev
```

This starts:
1. Vite dev server (port 1420) with hot-reload
2. Tauri app window pointing to the dev server
3. Rust backend with auto-rebuild on changes

### Building for Production

```bash
cargo tauri build
```

Outputs platform-specific installers in `src-tauri/target/release/bundle/`.

### Frontend Only (No Tauri)

For rapid frontend iteration:

```bash
npm run dev
```

Open `http://localhost:1420` in a browser. The VRM viewer works standalone — just no native window features.

## Adding a VRM Model

1. Get a VRM model from [VRoid Hub](https://hub.vroid.com/) or create one with [VRoid Studio](https://vroid.com/en/studio)
2. Place it at `public/models/default.vrm`
3. The viewer will automatically load it on startup

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_OPENCLAW_WS_URL` | `ws://localhost:4100/ws` | OpenClaw gateway WebSocket URL |

## Debugging

### Frontend
- Open DevTools: right-click → Inspect (in dev mode)
- Check the console for `[ClawBody]` prefixed logs

### Backend (Rust)
- Logs go to stderr by default
- Use `RUST_LOG=debug cargo tauri dev` for verbose Rust logs

### Transparency Issues
- **Linux:** Ensure you're running a compositor (e.g., picom, compton)
- **macOS:** Transparency should work out of the box
- **Windows:** Ensure WebView2 runtime is installed

## Testing

```bash
# TypeScript type checking
npm run typecheck

# Rust checks
cd src-tauri && cargo clippy
```
