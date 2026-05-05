# Category 04 — Infrastructure / Adapters

Two small repositories that exist to plug other systems into yours:
self-hosted LLM inference and a Claude-Code routing proxy.

## Repos in this category

| Repo | License | Size | Stars | Last update |
|---|---|---|---|---|
| `vllm_server/` | Apache-2.0 | 0.2 MB | 9 | 2026-01-07 |
| `claudecode-vertex-proxy/` | Apache-2.0 | 1.8 MB | 243 | 2026-04-30 |

## `vllm_server/` — vLLM inference Docker image

A Docker recipe (and helper scripts) that produces an
OpenAI-compatible inference server, built on top of the
[vLLM](https://github.com/vllm-project/vllm) framework.

**What you get** (per the in-tree README):

| Item | Value |
|---|---|
| Inference engine | vLLM (built from source inside the image) |
| API surface | OpenAI-compatible (chat / completions) |
| Base image | Ubuntu 22.04 |
| Tested host OSes | CentOS 7.9, Ubuntu 20.04, Windows (with WSL recommended) |
| Configuration | Environment variables `MODEL_ABSOLUTE_ROOT`, `MODEL_DIR` |

**Volume mapping rule** (per the README): host path
`$MODEL_ABSOLUTE_ROOT` mounts at `/workspace/models` inside the
container. The container locates the model via
`/workspace/models/$MODEL_DIR`. The host root must be a *real*
absolute path, not a symlink.

**Intended use** (per the README): launch a local LLM inference
service for any model that vLLM supports — including the
`02-llm-models/` family above (Orion-14B, Orion-MoE 8x7B).

## `claudecode-vertex-proxy/` — Claude Code → GCP Vertex AI

A Python proxy that lets the Claude Code CLI use Anthropic models
via Google Cloud Vertex AI instead of Anthropic's direct API.

**What's in the repo**:

| File | Purpose |
|---|---|
| `main.py` (44 KB) | The proxy server itself |
| `requirements.txt` | Python deps |
| `start_proxy.sh` | macOS / Linux launcher |
| `start_proxy.cmd` | Windows launcher |
| `README.md` (Chinese) / `README_EN.md` (English) | Setup |
| `LICENSE` | Apache-2.0 |

**Stack** (per the README badges): Python 3.8+, Apache-2.0,
multi-platform (Windows / Linux / macOS), Google Cloud Vertex AI,
Anthropic Claude.

**Why someone would use it**: as the README's logo and badges
indicate, the proxy lets Claude Code pull from Vertex's Anthropic
models — useful when an organization already has Vertex billing or
must keep traffic inside GCP.

## When this category is the right reference

- You want to self-host inference for an OrionStar (or any) open-weight
  model and need a working Docker recipe — start at `vllm_server/`.
- You want to run Claude Code through a corporate / shared GCP project
  rather than the direct Anthropic API — start at
  `claudecode-vertex-proxy/`.

## When this category is the wrong reference

- You need GPU provisioning or autoscaling — these are reference
  recipes, not platform components. Layer them onto Kubernetes /
  Cloud Run / SkyPilot yourself.
- You need an inference engine that is not vLLM (e.g. TGI, llama.cpp
  server) — wrong tool.
