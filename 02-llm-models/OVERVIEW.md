# Category 02 — LLM Models (open weights)

OrionStar's three open-weight model families and their model cards.
None of these are small enough for the SD845-class robots to run on
device; treat them as candidates for self-hosted inference (see
`04-infra/vllm_server/`) or for understanding OrionStar's R&D
positioning.

## Repos in this category

| Repo | License | Size | Stars | Last update |
|---|---|---|---|---|
| `Orion/` | Apache-2.0 | 5.3 MB | 810 | 2026-04-16 |
| `Orion-MoE/` | Apache-2.0 | 0.7 MB | 9 | 2026-01-07 |
| `OrionStar-Yi-34B-Chat/` | Apache-2.0 | 1.0 MB (model on HF) | 265 | 2026-04-16 |

The actual model weights live on Hugging Face / ModelScope / OpenXLab
under the `OrionStarAI` org — these GitHub repos hold the model card,
inference scripts, evaluation code, and README only.

## `Orion/` — Orion-14B family

**Foundation**: 14B-parameter multilingual base model trained from
scratch on 2.5 T tokens (Chinese, English, Japanese, Korean, +others).

**Variants** (per the in-tree README):

| Variant | Description |
|---|---|
| `Orion-14B-Base` | Multilingual foundation model |
| `Orion-14B-Chat` | Chat fine-tune for general dialog |
| `Orion-14B-LongChat` | Long-context (excels at 200 k tokens, supports up to 320 k) |
| `Orion-14B-Chat-RAG` | Fine-tuned on a custom retrieval-augmented dataset |
| `Orion-14B-Chat-Plugin` | Function-call / plugin specialization |
| `Orion-14B-Base-Int4` | 4-bit quantized base — 70% smaller, 30% faster, < 1% quality loss |
| `Orion-14B-Chat-Int4` | 4-bit quantized chat |

**Multilingual**: per the README, the model is reported strong on
Japanese and Korean test sets relative to other 20 B-class models.
Korean speakers among the project's audience are explicitly mentioned:
multilingual READMEs include `README_ko.md`, `README_zh.md`, `README_ja.md`.

**Tech report**: arXiv `2401.12246` (linked from the README).

## `Orion-MoE/` — Orion-MoE 8x7B (sparse Mixture-of-Experts)

Per the in-tree README:

| Architecture parameter | Value |
|---|---|
| Hidden size | 4096 |
| Layers | 32 |
| Query / KV heads | 32 / 8 |
| Intermediate size | 14 592 |
| Experts | 8 |
| Activated experts (per token) | 2 |
| Embedding tying | False |
| Position embedding | RoPE |
| Sequence length | 8192 |
| Vocabulary | 113 664 |

Trained on ~5 T tokens across multiple languages.

**Reported benchmarks** (selected, from the README's comparison table —
Orion-MoE 8x7B values in **bold** in the source):
- MMLU: 85.9 (vs Mixtral-8x7B 70.4, Qwen2.5-32B 82.9)
- MMLU Pro: 58.3
- C-Eval: 89.7
- CMMLU: 89.2
- HellaSwag: 89.2
- LAMBADA: 79.7
- PIQA: 87.3

The README lists numbers for additional benchmarks (ARC-c, BBH, MuSR,
CommonSenseQA, IFEval, GQPA) — see the file directly.

The instruction-tuned variant is announced as forthcoming.

## `OrionStar-Yi-34B-Chat/` — Yi-34B fine-tune

A chat-model fine-tuned by OrionStar on top of 01.AI's open-source
Yi-34B base model, using ≥ 150 k high-quality samples per the
in-tree README. Subject to both the Apache-2.0 license of this
repo and the upstream Yi license.

**Reported benchmarks** (selected, from the README's 5-shot
opencompass comparison):
- C-Eval: 77.71
- MMLU: 78.32
- CMMLU: 73.52

Comparison rows in the README include GPT-4, ChatGPT, Claude-1,
TigerBot, WeMix, LLaMA-2-70B-Chat, Qwen-14B-Chat, Baichuan2-13B-Chat.

## Inference paths documented in the model READMEs

| Method | Documented in |
|---|---|
| `transformers` Python API | `Orion/`, `OrionStar-Yi-34B-Chat/`, `Orion-MoE/` |
| `cli_demo.py` interactive | `Orion/`, `OrionStar-Yi-34B-Chat/` |
| `text_generation.py` script | `Orion/`, `OrionStar-Yi-34B-Chat/` |
| vLLM | `Orion/` (logo in README); see `04-infra/vllm_server/` |
| llama.cpp | `Orion/` (logo in README) |

## When this category is the right reference

- You are evaluating multilingual open-weight models for a self-hosted
  RAG or agent system, particularly for Chinese / Korean / Japanese.
- You want the canonical benchmarks and architecture details.
- You're picking between dense (Orion-14B) vs. sparse (Orion-MoE 8x7B)
  trade-offs.

## When this category is the wrong reference

- You need an on-device LLM for a 4 GB-RAM, SD845-class robot — even
  the Int4 14 B model is too large. Look at smaller models (Qwen 0.5 B,
  Phi-2, etc.) elsewhere.
- You need closed-API capability (function calling at GPT-4 level) —
  these are open weights with their own ecosystems; results will be
  good but not OpenAI-equivalent on every task.
