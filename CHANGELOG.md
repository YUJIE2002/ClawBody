# Changelog

All notable changes to ClawBody will be documented in this file.

## [1.0.0] - 2026-03-01

### 🎉 Initial Release

**Core Features:**
- 3D VRM character rendering (Three.js + @pixiv/three-vrm)
- Transparent desktop overlay (frameless, always-on-top)
- OpenClaw Gateway WebSocket integration (protocol v3)
- Real-time AI chat with streaming responses

**Character Animation:**
- 11 idle actions (blink, look around, head tilt, nod, weight shift, stretch, sigh, bounce, look up)
- Breathing animation with configurable intensity
- Emotion-driven facial expressions (happy, sad, angry, surprised, thinking, embarrassed, sleepy)
- Lip sync with CJK character support and viseme mapping

**Voice:**
- Voice input (Speech-to-Text via Web Speech API)
- Voice output (Text-to-Speech with system voices)
- Wake word detection ("Hey Siri" style, configurable phrase)
- Auto-speak AI responses with lip sync

**Settings:**
- Model management (import, switch, delete VRM files)
- Connection settings (gateway URL, token, test button)
- Appearance (window size, opacity, scale, always-on-top)
- Pose controls (arm angle, elbow bend)
- Animation controls (breathing, head sway, speed)
- Camera controls (FOV, height, distance, look-at)
- Voice & camera settings (STT language, TTS voice, wake word)

**Platforms:**
- Windows (NSIS installer)
- macOS (DMG, both Intel and Apple Silicon)

**Deployment:**
- Compatible with local OpenClaw and remote VPS deployments
- Supports both `ws://` and `wss://` connections
