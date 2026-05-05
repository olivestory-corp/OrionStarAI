# Search Index

A topic / API / keyword index over the local mirror at
`/Users/danny/Desktop/ROBOT/OrionStarAI/`. Each row says
**"if you are looking for X, start here"**.

## By topic

### Voice / audio

| Looking for | Start at |
|---|---|
| OpenAI Realtime API integration | `00-voice-realtime/end2end_sample/server/src/adapters/OpenAIAdapter.ts` |
| Client-side voice SDK (framework-agnostic TS) | `00-voice-realtime/end2end_sample/client/src/sdk/AgentSDK.ts` |
| Real-time VAD (browser/WebView) | `00-voice-realtime/end2end_sample/client/public/real-time-vad.js` |
| Audio worklet / stream processor | `00-voice-realtime/end2end_sample/client/public/audio-stream-processor.js` |
| Opus encode/decode (Node.js) | `00-voice-realtime/end2end_sample/server/src/utils/opus*.ts` |
| Speaker embedding ONNX (~17 MB) | `00-voice-realtime/end2end_sample/client/public/models/speaker_embedding.onnx` |
| WebSocket protocol (client↔server) | `00-voice-realtime/end2end_sample/shared/types/protocol.ts` |
| System prompts for voice agent scenarios | `00-voice-realtime/end2end_sample/server/src/prompts/systemPrompt.ts` |
| AgentOS SDK voice TTS / ASR API (`AgentCore`) | `01-robot-skill/OrionClaw/docs/AgentOS_SDK_Doc_v0.4.5.md` §4.1–4.7 |
| AgentOS voicebar enable/disable | `01-robot-skill/OrionClaw/docs/AgentOS_SDK_Doc_v0.4.5.md` §4.5 |

### Robot hardware control (RobotAPI 11.3)

| Looking for | Start at |
|---|---|
| Full RobotAPI reference | `01-robot-skill/OrionClaw/docs/RobotAPI.md` |
| RobotService JAR (binary, 1.2 MB) | `00-voice-realtime/end2end_sample/e2e_android/app/libs/robotservice_11.3.jar` |
| Vision (Person / Face) | `RobotAPI.md` "视觉能力" section |
| Camera stream sharing | `RobotAPI.md` "摄像头" section |
| Base motion (linear / angular) | `RobotAPI.md` "基础运动" section |
| Head pan/tilt | `RobotAPI.md` "头部云台运动" section |
| Mapping / localization | `RobotAPI.md` "地图及位置" section |
| Navigation (single-floor) | `RobotAPI.md` "导航" section |
| Multi-floor elevator navigation | `RobotAPI.md` "梯控导航" section |
| Lidar data | `RobotAPI.md` "雷达数据" section |
| Voice migration notice (RobotAPI ASR/TTS removed) | `RobotAPI.md` §"🚨 重要：语音功能迁移说明" |

### Robot hardware control (high-level skill API)

| Looking for | Start at |
|---|---|
| Skill catalogue (19 commands) | `01-robot-skill/OrionClaw/skills/robot-control/SKILL.md` |
| Python wrapper for skill HTTP calls | `01-robot-skill/OrionClaw/skills/robot-control/scripts/robot_cmd.py` |
| Photo capture script (base64 → JPEG) | `01-robot-skill/OrionClaw/skills/robot-control/scripts/take_photo_to_file.py` |
| Charging start/stop/leave | `01-robot-skill/OrionClaw/skills/robot-control/scripts/charging.py` |
| Place list query | `01-robot-skill/OrionClaw/skills/robot-control/scripts/get_places.py` |
| WAV music synthesis (numpy) | `01-robot-skill/OrionClaw/skills/robot-control/scripts/music_gen.py` |
| Dance routine player (JSON-driven) | `01-robot-skill/OrionClaw/skills/robot-control/scripts/dance_player.py` |
| Patrol / march script | `01-robot-skill/OrionClaw/skills/robot-march/scripts/march.py` |
| Sample dance JSON files | `01-robot-skill/OrionClaw/skills/robot-control/scripts/dances/` |

### WebSocket gateway / bridge

| Looking for | Start at |
|---|---|
| OpenClaw plugin TypeScript source | `01-robot-skill/OrionClaw/robot-ws-ingress/index.ts` |
| Plugin manifest | `01-robot-skill/OrionClaw/robot-ws-ingress/openclaw.plugin.json` |
| WebView-to-RobotApi JavaScript bridge (Android) | `00-voice-realtime/end2end_sample/e2e_android/README.md` |
| Kotlin WebView bridge implementation pattern | `00-voice-realtime/end2end_sample/e2e_android/app/src/main/java/com/e2e/orionstar/bridge/RobotNavigationBridge.kt` |

### Android app (Kotlin) integration

| Looking for | Start at |
|---|---|
| AgentOS SDK Maven coordinates | `01-robot-skill/OrionClaw/docs/AgentOS_SDK_Doc_v0.4.5.md` §1.2.1–1.2.2 |
| AppAgent / PageAgent setup | `01-robot-skill/OrionClaw/docs/AgentOS_SDK_Doc_v0.4.5.md` §1.2.4–1.2.5 |
| Action registration JSON | `01-robot-skill/OrionClaw/docs/AgentOS_SDK_Doc_v0.4.5.md` §1.2.3 |
| WebView container (loads URL → controls robot) | `00-voice-realtime/end2end_sample/e2e_android/` |
| OrionClaw APK (gateway client) | `01-robot-skill/OrionClaw/OrionClaw/` |
| Boot-launch intent filter | `01-robot-skill/OrionClaw/docs/RobotAPI.md` §"开机启动配置" |

### LLM models (open weights)

| Looking for | Start at |
|---|---|
| Orion-14B foundation + chat + long-chat (200K~320K) | `02-llm-models/Orion/README.md` |
| Orion-14B-Chat-RAG (RAG fine-tuned) | `02-llm-models/Orion/README.md` |
| Orion-14B-Chat-Plugin (function call) | `02-llm-models/Orion/README.md` |
| Orion-14B Int4 quantized (70% size, 30% faster) | `02-llm-models/Orion/README.md` |
| Multilingual benchmarks (zh / en / ja / ko) | `02-llm-models/Orion/README.md` |
| Orion-MoE 8x7B sparse (MMLU 85.9) | `02-llm-models/Orion-MoE/README.md` |
| Orion-MoE architecture table | `02-llm-models/Orion-MoE/README.md` §1 |
| OrionStar-Yi-34B-Chat | `02-llm-models/OrionStar-Yi-34B-Chat/README.md` |
| Tech report (arXiv 2401.12246) | `02-llm-models/Orion/README.md` (linked) |

### Inference infrastructure

| Looking for | Start at |
|---|---|
| Self-hosted vLLM Docker image | `04-infra/vllm_server/` |
| OpenAI-compatible API serving | `04-infra/vllm_server/README.md` §2.2 |
| Required env vars (`MODEL_ABSOLUTE_ROOT`, `MODEL_DIR`) | `04-infra/vllm_server/README.md` §2.4 |
| Claude Code → GCP Vertex AI proxy | `04-infra/claudecode-vertex-proxy/main.py` |
| Proxy startup scripts (mac/linux/win) | `04-infra/claudecode-vertex-proxy/start_proxy.sh` / `.cmd` |

### AI coding tools

| Looking for | Start at |
|---|---|
| DeepV Code CLI (Claude Code alternative) | `03-ai-coding-tools/DeepVCode/README.md` |
| MCP protocol support | `03-ai-coding-tools/DeepVCode/README.md` |
| Hooks (PreToolExecution / PostToolExecution / OnSession*) | `03-ai-coding-tools/DeepVCode/README.md` |
| VS Code extension | `03-ai-coding-tools/DeepVCode/README.md` |
| Multi-LLM proxy (Vertex / OpenRouter) | `03-ai-coding-tools/DeepVCode-Server-mini/README.md` |
| Repository → Wiki generator (RAG) | `03-ai-coding-tools/DeepV-Ki/README.md` |
| Mermaid diagram auto-generation | `03-ai-coding-tools/DeepV-Ki/README.md` |
| GitLab / GitHub / Bitbucket OAuth | `03-ai-coding-tools/DeepV-Ki/README.md` |

## By API name (for grep targets)

| API / type | Defined in |
|---|---|
| `AgentCore` (object) | AgentOS SDK; documented at `01-robot-skill/OrionClaw/docs/AgentOS_SDK_Doc_v0.4.5.md` |
| `AgentCore.tts(text, timeoutMillis, callback)` | §4.6 |
| `AgentCore.ttsSync(text, timeoutMillis)` | §4.6 |
| `AgentCore.stopTTS()` | §4.6 |
| `AgentCore.playTtsAudioFile(text, ...)` | §4.7 |
| `AgentCore.isEnableVoiceBar` | §4.5 |
| `RobotApi.getInstance()` | RobotAPI 11.3 |
| `RobotApi.startNavigation(reqId, name, listener)` | RobotAPI.md §导航 |
| `RobotApi.stopNavigation(reqId, listener)` | RobotAPI.md §导航 |
| `RobotApi.getPlaceList(reqId, listener)` | RobotAPI.md §地图及位置 |
| `RobotApi.getPosition(reqId, listener)` | RobotAPI.md §地图及位置 |
| `RobotApi.isEstimate(reqId, listener)` | RobotAPI.md §地图及位置 |
| `PersonApi` | RobotAPI.md §视觉能力 |
| `class AgentSDK extends EventEmitter` | `00-voice-realtime/end2end_sample/client/src/sdk/AgentSDK.ts` |
| `interface AgentSDKConfig` | same file |
| `interface IVADBridge` / `IAudioPlayerBridge` / `IRobotBridge` | `client/src/types/` (see AgentSDK.ts imports) |
| `class OpenAIAdapter extends BaseModelAdapter` | `00-voice-realtime/end2end_sample/server/src/adapters/OpenAIAdapter.ts` |
| `class WebSocketManager` / `class TurnManager` / `class AudioManager` / `class VADManager` | `client/src/sdk/core/` and `client/src/sdk/audio/` and `client/src/sdk/vad/` |

## By skill command (HTTP `/robot/cmd`)

These are the command names accepted by the OrionClaw gateway. Full
documentation is in `01-robot-skill/OrionClaw/skills/robot-control/SKILL.md`.

| Command | Category |
|---|---|
| `tts.play` | voice |
| `robot.status` | info |
| `robot.getPosition` | info |
| `robot.getPlaceList` | info |
| `nav.start` | navigation (async) |
| `nav.stop` | navigation |
| `base.turn` | motion |
| `head.move` | motion (pitch only; 0=up-most, 80=down-most) |
| `head.reset` | motion |
| `camera.takePhoto` | sensor (returns base64 JPEG) |
| `audio.play` | media (requires URL via local HTTP) |
| `audio.stop` | media |
| `screen.show` | display (full-screen with breathing animation) |
| `screen.update` | display |
| `screen.flash` | display |
| `screen.hide` | display |
| `charge.start` | charging (async) |
| `charge.stop` | charging |
| `charge.leave` | charging |

## By language

| Language | Repos |
|---|---|
| TypeScript | end2end_sample, DeepVCode, DeepVCode-Server-mini, OrionClaw/robot-ws-ingress |
| Kotlin | end2end_sample/e2e_android, OrionClaw/OrionClaw |
| Python | Orion, Orion-MoE, OrionStar-Yi-34B-Chat, DeepV-Ki, claudecode-vertex-proxy, OrionClaw/skills/*/scripts |
| Dockerfile | vllm_server |
| Markdown only | AgentOS2-Live (umbrella), Orion-MoE (notebook + README), orionstar-rob-dev-claw |

## By license (for downstream reuse)

| License | Repos |
|---|---|
| Apache-2.0 | Orion, Orion-MoE, OrionStar-Yi-34B-Chat, vllm_server, claudecode-vertex-proxy, DeepVCode |
| MIT | DeepV-Ki |
| Custom (NOASSERTION) | DeepVCode-Server-mini |
| **No LICENSE file** | AgentOS2-Live, end2end_sample, OrionClaw, orionstar-rob-dev-claw |

For "no LICENSE file" repositories, default to *study and reference only* —
re-implement patterns rather than redistribute the code itself.

## By recency (last upstream update)

| Repo | Last updated |
|---|---|
| claudecode-vertex-proxy | 2026-04-30 |
| DeepV-Ki | 2026-04-21 |
| DeepVCode | 2026-04-17 |
| Orion | 2026-04-16 |
| OrionStar-Yi-34B-Chat | 2026-04-16 |
| OrionClaw | 2026-04-15 |
| DeepVCode-Server-mini | 2026-04-08 |
| orionstar-rob-dev-claw | 2026-03-30 |
| AgentOS2-Live | 2026-03-19 |
| end2end_sample | 2026-02-13 |
| vllm_server | 2026-01-07 |
| Orion-MoE | 2026-01-07 |
