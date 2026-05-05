# Provenance

Each subdirectory under this tree was cloned from its upstream OrionStarAI
repository on **2026-05-05** via `git clone --depth 1`. After capturing
the commit hashes below, the per-repo `.git/` directories were removed
to make this a flat directory tree. To verify the snapshot or refresh,
re-clone from the URL listed.

| Path | Upstream | HEAD commit on capture | LICENSE in upstream |
|---|---|---|---|
| `00-voice-realtime/AgentOS2-Live` | https://github.com/OrionStarAI/AgentOS2-Live.git | `9a6bc9001e749643f9c4f7bd15b84e8747fa92aa` | **no LICENSE** |
| `00-voice-realtime/end2end_sample` | https://github.com/OrionStarAI/end2end_sample.git | `6385ce093f297a1286fdaf257a44d817252e2c7f` | **no LICENSE** |
| `01-robot-skill/OrionClaw` | https://github.com/OrionStarAI/OrionClaw.git | `23f55b25496ff5c5a394fdf362fe4819fd0aa779` | **no LICENSE** |
| `01-robot-skill/orionstar-rob-dev-claw` | https://github.com/OrionStarAI/orionstar-rob-dev-claw.git | `725953e5862ec0b712817c0968b7abae70faa745` | **no LICENSE** |
| `02-llm-models/Orion-MoE` | https://github.com/OrionStarAI/Orion-MoE.git | `bcdb1c2d6c30b387a772ae0a0427ff8feca33bae` | LICENSE present |
| `02-llm-models/Orion` | https://github.com/OrionStarAI/Orion.git | `3b23aeab356cfd6c55c34bf1e02f858eaa15cac8` | LICENSE present |
| `02-llm-models/OrionStar-Yi-34B-Chat` | https://github.com/OrionStarAI/OrionStar-Yi-34B-Chat.git | `6fee2fa5711690d1af0c200b340d899ca95ffdf0` | LICENSE present |
| `03-ai-coding-tools/DeepV-Ki` | https://github.com/OrionStarAI/DeepV-Ki.git | `7db1f643e6811bbf90dbe2633a2e8c290df5bd84` | LICENSE present |
| `03-ai-coding-tools/DeepVCode-Server-mini` | https://github.com/OrionStarAI/DeepVCode-Server-mini.git | `8d1ae79841f331f54c28ac9a5865b25121d98f4d` | LICENSE present |
| `03-ai-coding-tools/DeepVCode` | https://github.com/OrionStarAI/DeepVCode.git | `981a357915f42aad24fcd1f0e46349f7f5fde755` | LICENSE present |
| `04-infra/claudecode-vertex-proxy` | https://github.com/OrionStarAI/claudecode-vertex-proxy.git | `65f9b39685b2115f53d128536a8692e2ecb6eaaf` | LICENSE present |
| `04-infra/vllm_server` | https://github.com/OrionStarAI/vllm_server.git | `78f02f2f7c66894e52ec619e68f95f202f091802` | LICENSE present |

## Refresh snapshot

```bash
# To pull the latest from any subdirectory's upstream:
# 00-voice-realtime/AgentOS2-Live
git clone --depth 1 https://github.com/OrionStarAI/AgentOS2-Live.git 00-voice-realtime/AgentOS2-Live.fresh
# 00-voice-realtime/end2end_sample
git clone --depth 1 https://github.com/OrionStarAI/end2end_sample.git 00-voice-realtime/end2end_sample.fresh
# 01-robot-skill/OrionClaw
git clone --depth 1 https://github.com/OrionStarAI/OrionClaw.git 01-robot-skill/OrionClaw.fresh
# 01-robot-skill/orionstar-rob-dev-claw
git clone --depth 1 https://github.com/OrionStarAI/orionstar-rob-dev-claw.git 01-robot-skill/orionstar-rob-dev-claw.fresh
# 02-llm-models/Orion-MoE
git clone --depth 1 https://github.com/OrionStarAI/Orion-MoE.git 02-llm-models/Orion-MoE.fresh
# 02-llm-models/Orion
git clone --depth 1 https://github.com/OrionStarAI/Orion.git 02-llm-models/Orion.fresh
# 02-llm-models/OrionStar-Yi-34B-Chat
git clone --depth 1 https://github.com/OrionStarAI/OrionStar-Yi-34B-Chat.git 02-llm-models/OrionStar-Yi-34B-Chat.fresh
# 03-ai-coding-tools/DeepV-Ki
git clone --depth 1 https://github.com/OrionStarAI/DeepV-Ki.git 03-ai-coding-tools/DeepV-Ki.fresh
# 03-ai-coding-tools/DeepVCode-Server-mini
git clone --depth 1 https://github.com/OrionStarAI/DeepVCode-Server-mini.git 03-ai-coding-tools/DeepVCode-Server-mini.fresh
# 03-ai-coding-tools/DeepVCode
git clone --depth 1 https://github.com/OrionStarAI/DeepVCode.git 03-ai-coding-tools/DeepVCode.fresh
# 04-infra/claudecode-vertex-proxy
git clone --depth 1 https://github.com/OrionStarAI/claudecode-vertex-proxy.git 04-infra/claudecode-vertex-proxy.fresh
# 04-infra/vllm_server
git clone --depth 1 https://github.com/OrionStarAI/vllm_server.git 04-infra/vllm_server.fresh
```
