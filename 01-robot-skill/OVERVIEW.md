# Category 01 — Robot Skill

OrionStar's two complementary takes on "let an AI agent control a robot
without writing a native Android app every time": a Python-skill-driven
gateway, and a workspace-friendly skill pack for the same idea.

This category also happens to host the **two canonical reference
documents** anyone touching an OrionStar robot needs:
`AgentOS_SDK_Doc_v0.4.5.md` and `RobotAPI.md`.

## Repos in this category

| Repo | License | Size | Role |
|---|---|---|---|
| `OrionClaw/` | none | 7.0 MB | Full skill pack: Kotlin APK + Node WS gateway + Python skills + reference docs |
| `orionstar-rob-dev-claw/` | none | 2.6 MB | Slim skill pack consumable from a DeepV Code workspace |

## Reference documents inside `OrionClaw/`

These are the most valuable files in the entire mirror:

| File | Size | What it is |
|---|---|---|
| `OrionClaw/docs/AgentOS_SDK_Doc_v0.4.5.md` | 74 KB | Canonical AgentOS Android SDK reference — quick-start, Action registration, AppAgent / PageAgent, voicebar control, TTS APIs, LLM interface, perception, FAQ |
| `OrionClaw/docs/RobotAPI.md` | 101 KB | Canonical RobotService 11.3 reference — vision, camera, base motion, head pan/tilt, mapping, navigation, multi-floor elevator navigation, lidar |

A copy of both documents is also kept under
`/Users/danny/Desktop/GANGJIN/G1F/docs/offline-voice-research/orionstar-sdk-references/`
for the G1F project.

## Architecture (OrionClaw)

```
Operator / AI agent on a PC
        │
        │  POST {gateway}/robot/cmd?token=...
        │  body: {deviceId, cmd, args, timeoutMs}
        ↓
robot-ws-ingress  (Node.js OpenClaw plugin, port 18795)
        │
        │  WebSocket forward (deviceId match)
        ↓
OrionClaw APK (on the robot)
        │
        │  RobotApi.getInstance().<call>
        ↓
robotservice_11.3.jar
        ↓
Robot hardware
```

### `OrionClaw/OrionClaw/` (Kotlin app)

- Android app, package built from Gradle/Kotlin DSL.
- Bundles `app/libs/robotservice.jar` (1.25 MB).
- Receives intent extras at launch: `gatewayHost`, `token`, `deviceId`.
- Acts as a thin WebSocket client that translates incoming JSON commands
  into `RobotApi` calls.

### `OrionClaw/robot-ws-ingress/` (Node.js gateway plugin)

- TypeScript source: `index.ts` (24 KB) and pre-built `index.js` (29 KB).
- OpenClaw plugin manifest: `openclaw.plugin.json`.
- Exposes a HTTP endpoint at port 18795 by default; relays commands to
  the matching device via WebSocket.
- Runs as an OpenClaw plugin — see [docs.openclaw.ai](https://docs.openclaw.ai).

### `OrionClaw/skills/` (Python scripts driven by AI agents)

- `robot-control/SKILL.md` — full skill manifest (12 KB) with safety
  rules and a 19-command whitelist; this is the document the AI agent
  reads to know what it is allowed to call.
- `robot-control/scripts/`:
  - `robot_cmd.py` — generic command sender
  - `get_places.py` — list registered POI names on the current map
  - `take_photo_to_file.py` — capture and decode base64 → JPEG file
  - `charging.py` — start / stop / leave charging dock
  - `dance_player.py` — JSON-driven action sequence player
  - `music_gen.py` — numpy-based WAV synthesizer (sine / square / sawtooth / triangle)
  - `dances/` — sample dance JSON files (`dance_hello`, `dance_ai_intro`, `dance_ode_to_joy`)
- `robot-march/SKILL.md` + `scripts/march.py` — patrol/march route skill.

### Skill command summary (HTTP)

19 commands, all routed via `POST {gateway}/robot/cmd?token=...`:

| Category | Commands |
|---|---|
| Voice | `tts.play` |
| Info | `robot.status`, `robot.getPosition`, `robot.getPlaceList` |
| Navigation | `nav.start` (async), `nav.stop` |
| Motion | `base.turn`, `head.move`, `head.reset` |
| Sensor | `camera.takePhoto` (returns base64 JPEG) |
| Media | `audio.play` (URL only, requires local HTTP server), `audio.stop` |
| Display | `screen.show`, `screen.update`, `screen.flash`, `screen.hide` |
| Charging | `charge.start` (async), `charge.stop`, `charge.leave` |

Per-command argument shapes and safety rules are documented in
`OrionClaw/skills/robot-control/SKILL.md`.

### `OrionClaw/workspace-template/`

- `robot-agents-addon.md` — append to a workspace `AGENTS.md` to teach
  an AI agent the robot rules.
- `robot-tools-addon.md` — append to a workspace `TOOLS.md` to declare
  the gateway connection.

## `orionstar-rob-dev-claw/` (the slim cousin)

- Designed to be cloned into a DeepV Code workspace.
- Contains only:
  - `SKILL.md` (5.8 KB) — same skill manifest, lighter
  - `references/agentos-sdk.md` — same content as `AgentOS_SDK_Doc_v0.4.5.md`
  - `references/robot-api.md` — same content as `RobotAPI.md`
  - `references/dev-setup.md` — workspace setup notes
  - `assets/robotservice_11.3.jar` — the same 1.23 MB JAR
  - `.deepvcode/settings.json` — minimal DeepV Code workspace config

If you only need the reference documents and the JAR, this repo is
smaller; if you need the full sample (gateway + APK + Python scripts),
use `OrionClaw/`.

## When this is the right reference

- You want to control an OrionStar robot from an external AI agent
  (Claude / GPT / Gemini) instead of building a native APK with all the
  business logic baked in.
- You need a remote-control API for operators (PC-side dashboard).
- You want JSON-driven dance / march routines.
- You need the canonical AgentOS SDK or RobotAPI reference for any
  reason at all — those are the highest-value files in this mirror.

## When this is the wrong reference

- You are building a fixed-workflow kiosk app on the robot itself —
  the gateway round-trip is overkill. Use the AgentOS SDK directly
  (see `01-robot-skill/OrionClaw/docs/AgentOS_SDK_Doc_v0.4.5.md`).
- You need offline operation — the gateway is required.
