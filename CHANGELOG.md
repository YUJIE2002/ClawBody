# Changelog

All notable changes to ClawBody will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-01

### 🎉 Initial Release

The first stable release of ClawBody — Give Your AI a Body.

### Added

- **VRM Character Rendering** — Three.js + @pixiv/three-vrm 3D avatar with transparent desktop overlay
- **Emotion System** — 8 emotion states (neutral, happy, sad, angry, surprised, thinking, embarrassed, sleepy) extracted from AI text via tags, emoji, and keyword heuristics
- **Idle Animation System** — 11 idle actions (blink, double blink, look left/right/up, head tilt, nod, weight shift, mini stretch, sigh, happy bounce) with weighted random scheduling
- **Lip Sync** — Character-level viseme estimation for mouth animation during TTS, supporting Latin and CJK characters
- **OpenClaw Gateway Integration** — Full WebSocket client implementing the OpenClaw Gateway Protocol v3 (handshake, JSON-RPC, streamed chat events), supports both `ws://` and `wss://`
- **Voice Input (STT)** — Speech-to-text via Web Speech API with language selection and auto-send option
- **Voice Output (TTS)** — Text-to-speech with configurable voice, rate, pitch, and lip sync
- **Camera Vision** — Webcam frame capture (320×240 JPEG) attached to chat messages for AI vision
- **Wake Word Detection** — Always-on speech recognition scanning for configurable wake phrase (e.g., "顾衍")
- **Settings Panel** — Full GUI dashboard with 5 tabs: Model, Connection, Appearance, Voice & Camera, About
- **Model Management** — Import/switch/delete VRM models via settings, stored in app data directory
- **Appearance Controls** — Window size, opacity, character scale, always-on-top toggle, pose (arm/elbow), animation (breathing/head sway/speed), camera (FOV/height/distance/look-at)
- **Config Persistence** — JSON config stored via Tauri Rust backend, auto-merge with defaults for backward compatibility
- **Context Menu** — Right-click floating menu (Settings, Toggle Always on Top, Quit)
- **Window Dragging** — Left-click drag on empty areas to move the window
- **CI/CD** — GitHub Actions: lint + typecheck on push/PR, multi-platform build (Windows/macOS x64/ARM64), release workflow on tag push
- **One-Click Setup** — `node scripts/setup.mjs` checks prerequisites, installs deps, downloads default model

### Technical

- **Frontend:** React 19, TypeScript 5.7, Vite 6
- **3D:** Three.js 0.172, @pixiv/three-vrm 3.3
- **Desktop:** Tauri v2 (Rust), transparent frameless window
- **Plugins:** tauri-plugin-shell, tauri-plugin-dialog
