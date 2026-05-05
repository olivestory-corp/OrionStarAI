# CLAUDE.md — guide for Claude Code agents

This tree is a local snapshot of OrionStarAI's public GitHub organization,
captured 2026-05-05. Use it as **read-only reference material** unless the
user explicitly asks you to modify a sample.

## What this directory is for

Treat this directory the way you would treat `node_modules/` or a
vendored SDK: a stable copy of upstream sources you can grep, read, and
diff against, but **not the place to write project code**. The user's
own projects live elsewhere — for example
`/Users/danny/Desktop/GANGJIN/G1F/`.

When the user asks an OrionStar-related question, the answer is almost
always findable in this tree without going to the network.

## Quick decision tree

```
Q: User question is about ...
├── ... AgentOS Android SDK / AgentCore / Action / PageAgent
│      → 01-robot-skill/OrionClaw/docs/AgentOS_SDK_Doc_v0.4.5.md
│
├── ... robotservice_*.jar / RobotApi / navigation / face / camera / lidar
│      → 01-robot-skill/OrionClaw/docs/RobotAPI.md
│
├── ... voice that bypasses AgentOS / OpenAI Realtime / e2e voice agent
│      → 00-voice-realtime/end2end_sample/
│
├── ... high-level robot skills (Python, dance, music, march)
│      → 01-robot-skill/OrionClaw/skills/
│
├── ... Orion-14B / Orion-MoE / Yi-34B model weights, benchmarks, license
│      → 02-llm-models/<repo>/README.md
│
├── ... AI coding tooling (DeepVCode, DeepV-Ki)
│      → 03-ai-coding-tools/<repo>/README.md
│
└── ... self-hosted inference / Vertex AI proxy
       → 04-infra/<repo>/README.md
```

If still unsure, start at [INDEX.md](INDEX.md) and search by topic, API
name, or skill command.

## Recommended search patterns

These commands answer the most common questions quickly. Run from the
root of this directory.

```bash
# Find every mention of an AgentOS API
grep -rn "AgentCore\." 01-robot-skill/OrionClaw/docs/

# Find every mention of a RobotApi method
grep -rn "RobotApi\." 01-robot-skill/OrionClaw/docs/RobotAPI.md

# Find every Realtime API event handler in the sample server
grep -n "case '" 00-voice-realtime/end2end_sample/server/src/adapters/OpenAIAdapter.ts

# Find every public method on AgentSDK
grep -nE "^\s*(public|async|export)" 00-voice-realtime/end2end_sample/client/src/sdk/AgentSDK.ts

# Find every skill command name
grep -nE "^\| \`[a-z]+\.[a-z]+" 01-robot-skill/OrionClaw/skills/robot-control/SKILL.md
```

## Conventions you should follow when answering

1. **Cite the file path with line numbers** when you reference something
   from this tree, in `path:line` form. The user navigates by path.
2. **Distinguish "from the official doc" vs "from a sample"**. The two
   official documents under `01-robot-skill/OrionClaw/docs/` are
   authoritative; everything else is illustrative.
3. **Don't reproduce long upstream excerpts** when answering. Quote a
   line or two for context, then point at the file.
4. **Don't edit upstream files in place**. If the user wants a modified
   version, copy it to their own project tree first. Each upstream repo
   keeps its `.git` so accidental edits are easy to spot.
5. When the user asks about a topic that has *both* a Chinese
   document and an English equivalent, prefer the document the upstream
   has matched to its current API surface — usually
   `AgentOS_SDK_Doc_v0.4.5.md` and `RobotAPI.md` are the canonical
   versions even though they are in Chinese.

## Companion local resources

- `/Users/danny/Desktop/GANGJIN/G1F/docs/offline-voice-research/` —
  long-form research and decision documents about migrating off
  AgentOS for the G1F robot project. Documents 09–12 reference this
  tree heavily. If the user asks about *options Y / W / Z / Hybrid /
  ClawX*, that is the right place to read first.
- `/Users/danny/Desktop/ROBOT/agentos_docs/` — earlier index of
  OrionStar's portal/CMS/SDK documents (Korean), still useful for
  background.

## Refreshing the snapshot

The user may ask "is this still current?" The answer requires a
network call:

```bash
cd 01-robot-skill/OrionClaw   # or any repo
git fetch --depth 1 origin
git log HEAD..origin/HEAD --oneline    # any new commits upstream?
```

To update everything:

```bash
for r in $(find . -mindepth 2 -maxdepth 2 -type d -name '.git' -exec dirname {} \;); do
  echo "== $r =="
  ( cd "$r" && git pull --depth 1 )
done
```

## Things you do not need to verify

The following facts are stable as of 2026-05-05 and have been recorded
explicitly so you don't need to re-derive them:

- AgentOS SDK Maven artifact: `com.orionstar.agent:sdk:0.4.5-SNAPSHOT`
  (from `01-robot-skill/OrionClaw/docs/AgentOS_SDK_Doc_v0.4.5.md`)
- AgentOS Maven repo URL: `https://npm.ainirobot.com/repository/maven-public/`
  (credentials documented in the same file as `agentMaven` / `agentMaven`)
- RobotAPI version: 11.3 (`robotservice_11.3.jar`)
- AgentOS product baseline: `V1.3.0.250515`
- The voice/NLP functions that used to live in RobotAPI (ASR, TTS, NLP)
  have been **migrated to AgentOS SDK**; RobotAPI itself now only covers
  hardware (vision, motion, navigation, sensors). See
  `RobotAPI.md` §"🚨 重要：语音功能迁移说明".

If any of those change in a future snapshot, update both this file and
[README.md](README.md).
