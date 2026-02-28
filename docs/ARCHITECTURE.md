# Architecture

> Technical architecture of ClawBody — a desktop AI companion with a VRM 3D body.

## Overview

ClawBody is a desktop overlay application that gives an AI agent a visible, animated 3D body on the user's desktop. It bridges the OpenClaw agent framework with a VRM character renderer.

```
┌─────────────────────────────────────────────────────┐
│                    ClawBody App                      │
│                                                     │
│  ┌──────────────┐          ┌─────────────────────┐  │
│  │  Tauri Shell  │          │   React Frontend    │  │
│  │   (Rust)      │◄────────►│                     │  │
│  │              │  IPC      │  ┌───────────────┐  │  │
│  │  • Window    │           │  │  VRM Viewer   │  │  │
│  │    mgmt      │           │  │  (Three.js)   │  │  │
│  │  • System    │           │  │               │  │  │
│  │    tray      │           │  │  • Render     │  │  │
│  │  • Native    │           │  │  • Animate    │  │  │
│  │    APIs      │           │  │  • Emotions   │  │  │
│  └──────────────┘           │  └───────────────┘  │  │
│                             │                     │  │
│                             │  ┌───────────────┐  │  │
│                             │  │ OpenClaw Hook │  │  │
│                             │  │  (WebSocket)  │  │  │
│                             │  └───────┬───────┘  │  │
│                             └──────────┼──────────┘  │
└────────────────────────────────────────┼─────────────┘
                                         │ WebSocket
                                         ▼
                              ┌─────────────────────┐
                              │  OpenClaw Gateway    │
                              │                     │
                              │  • AI Agent Engine  │
                              │  • TTS / STT        │
                              │  • Emotion Engine   │
                              │  • Tool Execution   │
                              └─────────────────────┘
```

## Layer Breakdown

### 1. Tauri Shell (Rust)

The native application shell providing:
- **Transparent window** — frameless, always-on-top, with alpha channel support
- **System tray** — right-click menu for settings, quit, toggle visibility
- **Window management** — drag, resize, snap to edges
- **IPC bridge** — bidirectional communication between Rust and frontend

Key files:
- `src-tauri/src/lib.rs` — Tauri commands and setup
- `src-tauri/tauri.conf.json` — Window and bundle configuration

### 2. React Frontend (TypeScript)

The UI layer running inside the Tauri webview:
- **VRMViewer** — Three.js scene with VRM model rendering
- **Emotion System** — Maps AI emotions to VRM blend shape expressions
- **OpenClaw Hook** — WebSocket client for real-time AI communication
- **VRM Loader** — Model loading, caching, and resource management

Key files:
- `src/components/VRMViewer.tsx` — 3D rendering engine
- `src/hooks/useOpenClaw.ts` — Gateway communication
- `src/lib/emotion.ts` — Emotion → expression mapping
- `src/lib/vrm-loader.ts` — Model loading utilities

### 3. OpenClaw Gateway (External)

The AI brain running separately:
- Sends emotion, speech, and action events via WebSocket
- Receives user interaction events from ClawBody
- Manages TTS audio generation and STT transcription
- Runs the AI agent logic (tool use, memory, reasoning)

## Data Flow

```
User speaks → STT (OpenClaw) → AI processes → Response generated
                                                    │
                                            ┌───────┴───────┐
                                            │               │
                                      Emotion event    TTS audio
                                            │               │
                                            ▼               ▼
                                      VRM expression   Mouth animation
                                      change           + audio playback
```

## Key Design Decisions

### Why Tauri over Electron?
- **Binary size:** ~5MB vs ~150MB+ for Electron
- **Memory usage:** ~30MB vs ~100MB+ for Electron
- **Native performance:** Rust backend, system webview
- **Transparency:** Better native window transparency support

### Why VRM?
- **Standard format:** Open standard for 3D avatar models
- **Ecosystem:** Large library of free VRM models (VRoid Hub)
- **Expression system:** Built-in blend shapes for emotions
- **Lightweight:** Optimized for real-time rendering

### Why WebSocket for OpenClaw?
- **Real-time:** Bidirectional streaming for live emotion/speech
- **Simple:** No complex IPC or plugin system needed
- **Decoupled:** ClawBody doesn't depend on OpenClaw internals
- **Extensible:** Easy to add new message types

## Platform Considerations

| Platform | Window Transparency | System Tray | Notes |
|----------|-------------------|-------------|-------|
| Windows  | ✅ Native          | ✅           | Best transparency support |
| macOS    | ✅ Native          | ✅           | Requires title bar style override |
| Linux    | ⚠️ Compositor-dependent | ✅    | Works on X11 + compositing WMs |
