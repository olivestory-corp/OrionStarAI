# Category 00 — Voice / Realtime

OrionStar's next-generation voice stack: end-to-end voice interaction
through the OpenAI Realtime API, with no separate ASR / LLM / TTS
pipeline.

## Repos in this category

| Repo | License | Size | Role |
|---|---|---|---|
| `AgentOS2-Live/` | none | 128 KB | Multilingual umbrella announcement; points to `end2end_sample` |
| `end2end_sample/` | none | 63 MB | Reference implementation: React client + Node.js server + Android WebView bridge + GPT-4o Realtime |

## Why both repos exist

- **AgentOS2-Live** is documentation only. It hosts the multilingual
  press-release-style README (中 / 英 / 泰 / 한국어 / 日) that points
  developers at the actual code.
- **end2end_sample** holds the actual code, models, and Android
  bridge. Its README explicitly calls itself a "demo of AgentOS2-Live".

## What you can read here

### Architecture documents (in-tree)

- `end2end_sample/README.md` — full project overview, prerequisites
  (Node 18+, npm 9+, OpenAI key), `npm run dev` instructions.
- `end2end_sample/client/README.md` — frontend module README.
- `end2end_sample/server/README.md` — backend module README.
- `end2end_sample/e2e_android/README.md` — Android WebView bridge
  setup, the JavaScript SDK API for navigation, and the navigation
  status code table.
- `end2end_sample/e2e_android/RobotAPI.md` — same content as the
  RobotAPI 11.3 reference under `01-robot-skill/OrionClaw/docs/`.

### Source code highlights

| Path | What it is |
|---|---|
| `end2end_sample/client/src/sdk/AgentSDK.ts` | Framework-agnostic TypeScript SDK class extending `EventEmitter`. Exposes `initialize`, `connect`, `startListening`, `toggleMute`, PTT mode, etc. Bridge pattern (`IVADBridge`, `IAudioPlayerBridge`, `IRobotBridge`) for host injection. |
| `end2end_sample/client/src/components/RobotFace.tsx` | Animated robot face React component reacting to user/assistant speech. |
| `end2end_sample/client/src/components/HomePage.tsx` | Main scene selector page. |
| `end2end_sample/client/src/scenes/` | Scenario definitions (Face Register, Advice 3C electronics shopping). |
| `end2end_sample/client/public/real-time-vad.js` | Voice activity detection (browser/WebView). |
| `end2end_sample/client/public/audio-stream-processor.js` | Web Audio API worklet for streaming PCM. |
| `end2end_sample/server/src/index.ts` | Node.js entry point. |
| `end2end_sample/server/src/websocket.ts` | WebSocket server. |
| `end2end_sample/server/src/wsManager.ts` | Connection manager. |
| `end2end_sample/server/src/adapters/OpenAIAdapter.ts` | Realtime API session orchestrator with cost calculation logic. |
| `end2end_sample/server/src/adapters/BaseModelAdapter.ts` | Abstract adapter interface (so non-OpenAI backends can be added). |
| `end2end_sample/server/src/utils/opusEncoder.ts` / `opusDecoder.ts` | Opus codec for bandwidth-efficient transport. |
| `end2end_sample/server/src/prompts/systemPrompt.ts` | Scenario-specific system prompts. |
| `end2end_sample/shared/types/protocol.ts` | Unified client↔server protocol types. |
| `end2end_sample/e2e_android/app/libs/robotservice_11.3.jar` | RobotService SDK JAR (binary, 1.2 MB). |

### Static assets / models

| Path | Size | What it is |
|---|---|---|
| `end2end_sample/client/public/models/speaker_embedding.onnx` | 17 MB | On-device speaker embedding ONNX model |
| `end2end_sample/client/public/models/speaker_embedding_int8.onnx` | 13 MB | INT8-quantized variant |
| `end2end_sample/client/public/models/face_landmark_68_model-shard1` | 357 KB | face-api.js facial landmarks |
| `end2end_sample/client/public/models/face_recognition_model-shard{1,2}` | 6.5 MB | face-api.js recognition |
| `end2end_sample/client/public/models/tiny_face_detector_model-shard1` | 193 KB | face-api.js detector |

### Helper scripts

| Path | Purpose |
|---|---|
| `end2end_sample/scripts/check_model.py` | Validates ONNX model integrity |
| `end2end_sample/scripts/quantize_speaker_model.py` | Converts speaker embedding to INT8 |
| `end2end_sample/scripts/generate-ssl-cert.sh` | Generates self-signed cert for HTTPS/WSS |

### Container / deployment

- `end2end_sample/Dockerfile` — multi-stage build (4 KB)
- `end2end_sample/docker-compose.yml` — single-service compose
- `end2end_sample/server/ecosystem.config.js` — PM2 config
- `end2end_sample/ssl/localhost.conf` — SSL config for local dev

## Key takeaways

- **No ASR/LLM/TTS pipeline**: the Realtime API does voice-in → voice-out
  directly, including function calls, in a single WebSocket session.
- **Bridge pattern**: the client SDK injects three host-specific
  bridges, so the same SDK runs in browser, WebView, or any host that
  can implement audio/VAD/robot interfaces.
- **Cost is non-trivial**: see `OpenAIAdapter.calculateCost()` for the
  in-tree pricing logic; per-minute pricing on gpt-4o-realtime is
  significantly higher than non-realtime alternatives.

## When this is the right reference

- You are building a low-latency voice assistant (any platform).
- You need a working pattern for VAD + WebSocket + Realtime API.
- You are evaluating whether to migrate an existing voice agent to
  the end-to-end Realtime model.
- You are studying how to wrap robot hardware as Realtime API tools.

## When this is the wrong reference

- You need a fully offline voice assistant — Realtime API requires
  network. See sibling category `01-robot-skill/` for skill-level
  control over a separate stack, or look elsewhere for offline
  ASR/LLM/TTS components.
- You only need TTS — overkill, use a plain Cloud TTS or `AgentCore.tts()`.
