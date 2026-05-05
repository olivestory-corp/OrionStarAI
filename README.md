# OrionStarAI GitHub Mirror & Index

**Public mirror**: https://github.com/olivestory-corp/OrionStarAI
**Local path**: `/Users/danny/Desktop/ROBOT/OrionStarAI/`

A mirror and structured index of the public repositories under the
[OrionStarAI](https://github.com/OrionStarAI) GitHub organization, captured
on **2026-05-05**.

This directory exists so that engineering work that depends on OrionStar's
robot SDK, voice stack, or LLM models can proceed offline, with a stable
snapshot, and with a Claude-Code-friendly index. Each subdirectory contains
the upstream repository as cloned via `git clone --depth 1`, with `LICENSE`,
`README*`, and source files preserved as-is from the upstream.

The non-upstream files in this tree (this `README.md`, `INDEX.md`,
`CLAUDE.md`, the per-category `OVERVIEW.md` files, and `_meta/repos.json`)
are independent index/metadata documents — they catalogue facts (names,
sizes, licenses, public APIs) rather than reproducing upstream content.

> **Source of truth**: each subdirectory's own `README.md` is the upstream
> repository's README. When in doubt, read that file.

## Mirror notice

This repository is a **study mirror** of public repositories under
[github.com/OrionStarAI](https://github.com/OrionStarAI). The original
work belongs to **Beijing OrionStar Technology Co., Ltd.** Each upstream
project's `LICENSE` file (where present) is preserved untouched in its
subdirectory. For repositories without an upstream `LICENSE` file, treat
the contents as reference material only — re-implement patterns rather
than redistribute the code.

The HEAD commit hashes captured at mirror time are recorded in
[`_meta/PROVENANCE.md`](_meta/PROVENANCE.md), along with refresh commands
that pull the current upstream HEAD.

## License

This mirror has a two-tier licensing model:

- **Index / metadata files** authored for this mirror — `README.md`,
  `INDEX.md`, `CLAUDE.md`, the per-category `OVERVIEW.md` files,
  `_meta/PROVENANCE.md`, `_meta/repos.json`, and `.gitignore` — are
  released under the [MIT License](LICENSE), © 2026 Olive Story Corp.
- **Upstream content** under the category subdirectories
  (`00-voice-realtime/`, `01-robot-skill/`, `02-llm-models/`,
  `03-ai-coding-tools/`, `04-infra/`) retains its original copyright
  and license. Refer to each subdirectory's own `LICENSE` file (where
  present) and to [`_meta/PROVENANCE.md`](_meta/PROVENANCE.md).

## At a glance

| Category | Repos | Total size | Why it matters |
|---|---|---|---|
| `00-voice-realtime/` | 2 | 63 MB | OrionStar's next-gen voice stack — OpenAI Realtime API end-to-end |
| `01-robot-skill/` | 2 | 10 MB | Cloud-side Python skill paradigm + **official AgentOS SDK 0.4.5 doc + RobotAPI 11.3 doc** |
| `02-llm-models/` | 3 | 7 MB | Orion-14B / Orion-MoE / OrionStar-Yi-34B (model cards + inference scripts) |
| `03-ai-coding-tools/` | 3 | 26 MB | DeepV Code (CLI + VSCode), DeepV Code Server-mini, DeepV-Ki (repo→wiki) |
| `04-infra/` | 2 | 2 MB | vllm_server, claudecode-vertex-proxy |
| **Total** | **12** | **~108 MB** | |

## Directory tree

```
OrionStarAI/
├── README.md                    ← you are here
├── INDEX.md                     ← keyword/topic search matrix
├── CLAUDE.md                    ← guide for Claude Code agents
├── _meta/
│   └── repos.json               ← structured metadata (lang, stars, license, ...)
│
├── 00-voice-realtime/
│   ├── OVERVIEW.md
│   ├── AgentOS2-Live/           ← multilingual announcement (umbrella repo)
│   └── end2end_sample/          ← React + Node.js + WebSocket + GPT-4o Realtime
│
├── 01-robot-skill/
│   ├── OVERVIEW.md
│   ├── OrionClaw/               ← Kotlin APK + Node WS gateway + Python skills
│   │   └── docs/
│   │       ├── AgentOS_SDK_Doc_v0.4.5.md  ← ★ official SDK doc (74 KB)
│   │       └── RobotAPI.md                 ← ★ official RobotAPI 11.3 (101 KB)
│   └── orionstar-rob-dev-claw/  ← skill pack for DeepV Code workspaces
│
├── 02-llm-models/
│   ├── OVERVIEW.md
│   ├── Orion/                   ← Orion-14B series (base/chat/long-chat/RAG/plugin)
│   ├── Orion-MoE/               ← Orion-MoE 8x7B sparse MoE
│   └── OrionStar-Yi-34B-Chat/   ← Yi-34B fine-tune
│
├── 03-ai-coding-tools/
│   ├── OVERVIEW.md
│   ├── DeepVCode/               ← Claude Code alternative (CLI + VS Code ext)
│   ├── DeepVCode-Server-mini/   ← multi-LLM proxy backend
│   └── DeepV-Ki/                ← repo → interactive wiki (RAG Q&A)
│
└── 04-infra/
    ├── OVERVIEW.md
    ├── vllm_server/             ← vLLM Docker inference image
    └── claudecode-vertex-proxy/ ← Claude Code → GCP Vertex AI proxy
```

## How to use

### 1. As a knowledge base for an existing robot project

If you are integrating an OrionStar GreetingBot Mini, the most valuable
files are the two official documents preserved under
`01-robot-skill/OrionClaw/docs/`:

- `AgentOS_SDK_Doc_v0.4.5.md` — the canonical reference for the AgentOS
  Android SDK (Maven coordinates, Action registration, voicebar control,
  TTS, LLM, perception, navigation hooks).
- `RobotAPI.md` — the canonical reference for `robotservice_11.3.jar`
  (vision, camera, base motion, head pan/tilt, mapping, navigation, lidar,
  multi-floor elevator navigation).

These also exist (identical) under
`01-robot-skill/orionstar-rob-dev-claw/references/` and partially under
`00-voice-realtime/end2end_sample/e2e_android/RobotAPI.md`.

### 2. As a reference for an OrionStar-independent voice agent

If you are building a voice/AI assistant on a non-OrionStar device but
want a battle-tested architectural template:

- `00-voice-realtime/end2end_sample/client/src/sdk/AgentSDK.ts` — a clean,
  framework-agnostic TypeScript SDK that wraps the OpenAI Realtime API
  with VAD, audio playback, tool calling, and a bridge pattern for host
  hardware. The bridge interfaces (`IVADBridge`, `IAudioPlayerBridge`,
  `IRobotBridge`) make it portable to any device class.
- `00-voice-realtime/end2end_sample/server/src/adapters/OpenAIAdapter.ts`
  — Realtime-API session orchestration with cost accounting.
- `00-voice-realtime/end2end_sample/client/public/real-time-vad.js` and
  `audio-stream-processor.js` — drop-in real-time voice activity detection
  in browser/WebView contexts.

### 3. To run any sample locally

Each upstream repo has its own `README.md` with prerequisites. Generally:

- TypeScript/Node repos: `npm install && npm run dev`
- Python LLM repos: install via `transformers`/`vllm`, see model card
- Android repos: open in Android Studio, place `robotservice_*.jar` in
  `app/libs/`, build APK

## Licensing notes

| Repo | License (upstream `LICENSE` file) |
|---|---|
| Orion | Apache-2.0 |
| Orion-MoE | Apache-2.0 |
| OrionStar-Yi-34B-Chat | Apache-2.0 (model also subject to Yi license) |
| vllm_server | Apache-2.0 |
| claudecode-vertex-proxy | Apache-2.0 |
| DeepVCode | Apache-2.0 |
| DeepV-Ki | MIT |
| DeepVCode-Server-mini | NOASSERTION (custom; see repo) |
| AgentOS2-Live | (no LICENSE file) |
| end2end_sample | (no LICENSE file; README states *"for demonstration and testing purposes"*) |
| OrionClaw | (no LICENSE file) |
| orionstar-rob-dev-claw | (no LICENSE file) |

For repos without a `LICENSE` file, treat them as study/reference material
only and re-implement rather than redistribute. Each `LICENSE` file is
preserved in the upstream subdirectory it came from.

## Provenance

Each upstream repo retains its `.git/` directory so you can verify the
exact commit it was cloned from:

```bash
cd <category>/<repo>
git log -1 --format='%H %ci' HEAD
git remote -v
```

To refresh a snapshot:

```bash
cd <category>/<repo>
git pull --depth 1
```

## Related local documents

- `/Users/danny/Desktop/GANGJIN/G1F/docs/offline-voice-research/` —
  full research package on the AgentOS SDK, RobotAPI, and the various
  voice migration options (Y / W / Z / Hybrid / ClawX), including
  decision matrices and Phase plans for the G1F project.
- `/Users/danny/Desktop/ROBOT/agentos_docs/` — earlier Korean-language
  index of official AgentOS portal/CMS/SDK documents.

## See also

- [INDEX.md](INDEX.md) — search matrix by topic / API name / use case
- [CLAUDE.md](CLAUDE.md) — guide for Claude Code agents working in this tree
- Per-category overviews: [00](00-voice-realtime/OVERVIEW.md) ·
  [01](01-robot-skill/OVERVIEW.md) ·
  [02](02-llm-models/OVERVIEW.md) ·
  [03](03-ai-coding-tools/OVERVIEW.md) ·
  [04](04-infra/OVERVIEW.md)
