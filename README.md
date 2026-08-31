# Eskay — Claude.ai Usage Dashboard & Prompt Optimization Platform

Eskay is a privacy-first browser extension and userscript engineered specifically for **Claude.ai**. It prevents context window overflow, eliminates usage limit surprises, optimizes prompts via a domain-routing engine, and maintains an episodic, vector-backed memory layer across chat sessions — running 100% locally in your browser with zero external dependencies.

---

## Core Capabilities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             ESKAY CORE ENGINE                               │
├──────────────────────────┬──────────────────────────┬───────────────────────┤
│    Usage Dashboard       │     Prompt Optimizer     │   Episodic Memory     │
├──────────────────────────┼──────────────────────────┼───────────────────────┤
│ • 5h Rolling Session Bar │ • Minimise Tokens (NLP)  │ • 384-d Feature Hash  │
│ • 7d Rolling Weekly Bar  │ • Maximise Efficiency    │ • IndexedDB Storage   │
│ • 200k Context Counter   │ • 49-Persona Routing     │ • Cosine Top-5 Recall │
│ • Ephemeral Cache Timer  │ • Reasoning Toggles      │ • Auto-Consolidation  │
└──────────────────────────┴──────────────────────────┴───────────────────────┘
```

### 1. Real-Time Usage & Context Dashboard
* **5-Hour Rolling Session Quota**: Real-time progress bar displaying remaining message allocations and time elapsed inside the rolling window.
* **7-Day Rolling Weekly Quota**: Tracks long-term message consumption and reset countdowns.
* **Real-time BPE Context Window Counter**: Accurate token counting for active conversations against Claude's 200,000 token boundary, backed by $O(1)$ message-level SHA-256 fingerprint caching.
* **Ephemeral Cache Timer**: 5-minute countdown tracking prompt cache validity to maximize cache-hit cost optimizations.
* **Dynamic Warning States**: Visual threshold indicators dynamically shifting from Normal to Warning (>80%) and Critical (>95%).

### 2. Dual-Engine Prompt Optimizer
* **Minimise Tokens Mode**: Rule-based NLP compression pipeline that strips politeness fillers, meta-commentary, hedge phrases, and redundant sentence structures without altering intent or technical variables.
* **Maximise Efficiency Mode**: Automatically routes incoming prompts through a multi-category intent classifier to inject the optimal persona from a matrix of **49 domain-expert personas** alongside structured output formats and reasoning triggers.
* **Interactive Toggles**: Selectively enable clarification prompts, step-by-step reasoning chains, one-shot/multi-shot templates, and unglazed critique (Brutal mode).
* **Live Token Delta Display**: Immediate visual feedback showing exact tokens saved or added before submission.

### 3. Vector-Backed Persistent Memory & Consolidation
* **Context Retrieval (`MASTER_PROMPT.md`)**: Scrapes the full conversation tree, extracts goals, decisions, constraints, next steps, and code artifacts, stores them in local IndexedDB vector storage, and downloads a clean handoff `.md` file.
* **Memory Recall**: Computes local 384-dimensional embeddings of the active prompt, queries IndexedDB via cosine similarity, and prepends the top-5 most relevant past decisions and constraints into your active chat preamble.
* **Automated Memory Consolidation**: Prunes near-duplicate records (cosine similarity > 0.85) on export, preserving the newest record timestamp to prevent memory bloating.
* **Trajectory Visualizer & Debugger**: An interactive timeline inspector allowing developers to review conversation branches, extracted knowledge entities, and code artifacts before generating handoff summaries.

---

## Architecture & System Flow

```
[Claude.ai SPA] ──► [inject.js (Main World)] ──(postMessage)──► [content.js (Extension World)]
                            │                                                │
                 Interceps fetch/SSE streams                        Updates UI, Tokenizer &
                 Usage limits & JSON trees                          IndexedDB Vector Store
```

All vector calculations, text processing, and data persistence execute strictly on the client CPU. No prompt data, tokens, or conversation logs are ever transmitted to third-party endpoints.

---

## Test & Evaluation Rigor

Eskay enforces automated regression suites and evaluation harnesses before any build is merged:

| Test Harness | Target / Metric | Description |
| :--- | :--- | :--- |
| `persona-test-harness.js` | $\ge 90\%$ Domain Accuracy | Evaluates domain and persona routing accuracy across 33+ labeled cases. |
| `intent-test-runner.js` | $\ge 90\%$ Intent Accuracy | Disambiguation test runner evaluating polysemous prompt terms (e.g. resume, design, model). |
| `differential-tester.js` | Automated Mode Diffing | Differential testing framework diffing token compression, persona selection, and routing stability across modes. |
| `consolidation-test-runner.js` | 100% Pruning Verification | Validates cosine near-duplicate detection (>0.85) and timestamp retention. |
| `recall_eval.js` (LongMemEval) | $\ge 80\%$ Retrieval Pass Rate | Multi-session retrieval benchmark verifying top-1 cosine recall of stored facts and categories. |

To run the automated test suite locally:
```bash
# Run persona routing accuracy gate
node test/persona-test-harness.js

# Run intent disambiguation test runner
node test/intent-test-runner.js

# Run differential testing framework
node test/differential-tester.js

# Run memory consolidation verification
node test/consolidation-test-runner.js
```

---

## Installation Guide

### Option 1: Chrome, Brave, Edge Extension (Recommended)

1. Clone or download this repository.
2. Open your browser extension settings:
   - **Chrome / Brave:** `chrome://extensions/`
   - **Edge:** `edge://extensions/`
3. Enable **Developer mode** (toggle in upper right).
4. Click **Load unpacked** (top left).
5. Select the `eskay` folder (the directory containing `manifest.json`).
6. Navigate to `https://claude.ai` to begin using Eskay.

### Option 2: Tampermonkey Userscript

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension.
2. Create a new script in Tampermonkey and paste the contents of `eskay/userscript/eskay.user.js`.
3. Save the script and refresh `https://claude.ai`.

---

## Interactive Trajectory Inspection Tool

Eskay includes a standalone visualizer tool for inspecting scraped trajectories, debugging agent execution trees, and reviewing `MASTER_PROMPT.md` handoffs:

1. Open `trajectory_viewer.html` in any web browser.
2. Drag and drop any exported `MASTER_PROMPT.md` file or click **Load Sample Trajectory** to explore the conversation turn-by-turn.

---

## Privacy & Security

* **Zero Network Calls**: All memory indexing, vector search, and NLP transformations run in-browser.
* **Local Storage Only**: Memory records and conversation snapshots are stored strictly in client-side IndexedDB.
* **No Telemetry**: No tracking pixels, third-party CDNs, or external telemetry scripts.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
