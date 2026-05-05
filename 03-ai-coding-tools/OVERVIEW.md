# Category 03 — AI Coding Tools

OrionStar's three repositories around AI-driven software development —
two focused on the developer's editor (CLI + VS Code) and one focused
on documenting an existing repo as an interactive wiki.

## Repos in this category

| Repo | License | Size | Stars | Last update |
|---|---|---|---|---|
| `DeepVCode/` | Apache-2.0 | 18 MB | 406 | 2026-04-17 |
| `DeepVCode-Server-mini/` | NOASSERTION | 0.4 MB | 263 | 2026-04-08 |
| `DeepV-Ki/` | MIT | 7.3 MB | 298 | 2026-04-21 |

## `DeepVCode/` — Claude Code-style coding agent

A TypeScript/Node CLI plus a VS Code extension. Per the in-tree
README, it is positioned as a project-aware coding agent rather than
a single-file completion tool.

**Distribution**:
- npm package: `deepv-code`
- VS Code extension

**Stated capabilities** (per the in-tree README):

| Area | What it offers |
|---|---|
| Tools | `read_file`, `write_file`, `replace`, `delete_file`, `glob`, `grep` (ripgrep), `read_many_files`, `shell` (bash/powershell), `web_fetch`, `web_search` (Google), MCP tools, `task` (sub-agent), `todo_write`, `memory` |
| Hooks | `PreToolExecution`, `PostToolExecution`, `OnSessionStart`, `OnSessionEnd` |
| Sessions | Persistent dialogue history with checkpoint-based file rollback |
| Extensibility | Hooks · Skills · MCP servers |
| Languages | TypeScript, JavaScript, Python, Go, Rust, Java + others |

**Requirements** (per the README): Node.js 20.0.0+, ANSI-color terminal.

The README is comprehensive (~13 KB) and documents CLI commands,
slash commands, the project architecture, the MCP protocol surface,
and a configuration reference.

## `DeepVCode-Server-mini/` — multi-LLM proxy backend

A small TypeScript proxy that bridges multiple LLM providers (e.g.
Vertex AI, OpenRouter) behind a single standardized API. Designed to
be used by `DeepVCode/` clients but standalone-runnable.

License is recorded as `NOASSERTION` on GitHub — see the repo's own
LICENSE file (or absence thereof) before reusing.

## `DeepV-Ki/` — Repository → Interactive Wiki

Per the in-tree README, `DeepV-Ki` consumes a repository URL and
produces a generated wiki:

| Feature | Notes |
|---|---|
| Wiki generation | Multilingual output (10+ languages incl. Chinese / English / Japanese) |
| Architecture diagrams | Auto-generated Mermaid (flow / sequence / class) with interactive zoom & pan |
| RAG Q&A | "Ask" mode answers questions grounded in the repo's source |
| DeepResearch | Multi-round investigation mode with auto-generated research plans |
| Multi-LLM | OpenAI, Google Gemini, Azure, AWS Bedrock, Ollama (local) |
| Repo support | GitHub, GitLab (SaaS / self-hosted), Bitbucket, Gerrit, private |
| Stack | Python 3.12+ (backend) + Next.js 15 (frontend), pnpm + uv |

**Configuration**: documented env vars include `OPENAI_API_KEY`,
`GOOGLE_API_KEY`, `DASHSCOPE_API_KEY`, `OPENROUTER_API_KEY`, GitLab
OAuth credentials, `SESSION_SECRET_KEY`, `PORT`. See the in-tree
`README.md` for the full table.

**Quickstart**: `./start_dev.sh` after `cp .env.example .env` and
filling in the LLM API key. Default ports: 3000 (frontend), 8001
(backend with Swagger at `/docs`).

## When this category is the right reference

- You are evaluating Claude Code alternatives written entirely in
  TypeScript with permissive licensing.
- You want a working pattern for hooks / MCP / session persistence
  in a coding agent.
- You want to auto-generate documentation for an unfamiliar codebase
  and turn it into a Q&A surface.

## When this category is the wrong reference

- You only need ad-hoc code completion — these tools are heavier
  agents with broader tool access; for autocomplete look elsewhere.
- You are looking for the OrionStar robot stack — wrong category.
  See `00-voice-realtime/` and `01-robot-skill/` instead.
