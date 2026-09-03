# Eskay — Claude.ai Usage Dashboard & Prompt Optimization Platform

Eskay is a privacy-first browser extension and userscript engineered specifically for **Claude.ai**. It prevents context window overflow, eliminates usage limit surprises, optimizes prompts via a 49-persona routing engine, and maintains an episodic, vector-backed memory layer across chat sessions — running 100% locally in your browser with zero external dependencies.

---

## ⚡ Quick Start: How to Install & Use Eskay

### 📦 1. Download & Install the Extension (Recommended)

1. **Download the Extension:**
   > ### 🚀 [Click here to download the ZIP (eskay.zip)](https://github.com/Pranavsk22/Eskay-Claude-Extension/raw/main/eskay.zip)

2. **Unpack / Extract the ZIP:**
   - Extract the downloaded `eskay.zip` file to a folder on your computer (e.g., in your Documents or Downloads folder).

3. **Load in Your Browser:**
   - Open your browser's extension settings page:
     - **Google Chrome / Brave:** Navigate to `chrome://extensions/`
     - **Microsoft Edge:** Navigate to `edge://extensions/`
   - In the top right corner, turn **ON** the **Developer mode** toggle.
   - Click the **Load unpacked** button in the top left.
   - Select the extracted `eskay` folder (the folder containing `manifest.json`).

4. **Launch Claude:**
   - Open or refresh [https://claude.ai](https://claude.ai).
   - You will see the Eskay companion toolbar positioned cleanly above the prompt input box!

---

### 🐒 Option 2: Install via Tampermonkey Userscript

If you prefer using a userscript manager instead of an unpacked extension:
1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension in your browser.
2. Click **Create a new script** in Tampermonkey.
3. Copy and paste the complete code from [`eskay/userscript/eskay.user.js`](https://github.com/Pranavsk22/Eskay-Claude-Extension/blob/main/eskay/userscript/eskay.user.js).
4. Press `Ctrl+S` (or `Cmd+S`) to save the script, then refresh [https://claude.ai](https://claude.ai).

---

## 📖 How to Use Eskay on Claude.ai

Once installed, Eskay appears directly on Claude.ai as a native-feeling companion bar positioned cleanly **above the prompt input box** (so it never blocks the `+` attach button, cowork switch, model selector dropdown, or microphone button):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔴 Eskay  [-42 tokens saved]              [⚙ Options] [📊 Stats] [📌 Float] [−]│
├─────────────────────────────────────────────────────────────────────────────┤
│ [⚡ Minimise Tokens]  [🚀 Maximise Efficiency]  [🔥 Brutal]   [🔍 Recall] [⬇ Export]│
├─────────────────────────────────────────────────────────────────────────────┤
│ 🧠 Clarification  🔢 Step-by-step  🎭 Set persona  📌 One-shot  📐 Specify format  │
├─────────────────────────────────────────────────────────────────────────────┤
│ SESSION: [████████░░░░░░░░░░] 28% used · resets in 3h 12m                    │
│ WEEKLY:  [████████████░░░░░░] 45% used · resets in 2d 14h                    │
│ CONTEXT: [████░░░░░░░░░░░░░░] ~14,200 tokens · 7% of 200k                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1. Optimize Your Prompts with One Click
- **`Minimise Tokens`**: Strips conversational fluff, filler words, and redundant meta-phrasing while preserving technical terms and code, saving tokens and speeding up generation.
- **`Maximise Efficiency`**: Automatically analyzes your prompt's intent, detects the subject domain, and injects the optimal persona from a matrix of **49 domain experts**, along with structured instructions.
- **`Brutal Mode`**: Injects rigorous, unglazed analytical critique constraints for deep code review, logic audits, and direct technical feedback without sugarcoating.

### 2. Monitor Real-Time Quotas & Context
- **Session Bar (5-Hour Rolling Window)**: Displays your message count usage ratio alongside a white vertical marker indicating the elapsed time within the current 5-hour window.
- **Weekly Bar (7-Day Rolling Window)**: Tracks long-term weekly consumption and exact reset countdowns.
- **Context Counter (200,000 Tokens)**: Computes approximate BPE token counts for your active conversation in real time.
- **Ephemeral Cache Timer (5 Minutes)**: Header badge indicates how much time remains on Claude's active prompt cache.

### 3. Maintain Cross-Session Persistent Memory
- **`⬇ Export Context`**: Scrapes the current chat, extracts goals, decisions, constraints, next steps, and code artifacts, indexes them into local browser vector storage, and downloads a clean handoff `MASTER_PROMPT.md` file.
- **`🔍 Recall Memory`**: Computes local 384-dimensional embeddings of your current draft, searches IndexedDB using cosine similarity, and automatically prepends relevant past context into your prompt.
- **`🧹 Consolidate Memory`**: Prunes near-duplicate memory records (cosine similarity > 0.85) to prevent database bloat.

### 4. Customizable UI Modes
- **Capsule Pill Mode (`−` Button)**: Collapses the toolbar into an ultra-slim capsule badge (`⚡ Eskay · 14.2k tokens ▾`) taking ~28px height right above your prompt box. Click it anytime to expand.
- **Floating Widget Mode (`📌 Float` Button)**: Detaches Eskay into a floating glassmorphic companion widget that can sit anywhere in a corner of your screen.
- **Collapsible Panels (`⚙ Options` & `📊 Stats`)**: Easily expand or hide the prompt checkboxes and usage statistics whenever you want maximum screen space.

---

## 🌟 Core Features & Capabilities

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

## 🏗️ System Architecture & Data Flow

```
[Claude.ai SPA] ──► [inject.js (Main World)] ──(postMessage)──► [content.js (Extension World)]
                            │                                                │
                 Intercepts fetch/SSE streams                       Updates UI, Tokenizer &
                 Usage limits & JSON trees                          IndexedDB Vector Store
```

All vector calculations, text processing, and data persistence execute strictly on the client CPU. No prompt data, tokens, or conversation logs are ever transmitted to third-party endpoints.

---

## 🧪 Test & Evaluation Rigor

Eskay enforces automated regression suites and evaluation harnesses:

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

## 🔍 Interactive Trajectory Inspection Tool

Eskay includes a standalone visualizer tool for inspecting scraped trajectories, debugging agent execution trees, and reviewing `MASTER_PROMPT.md` handoffs:

1. Open `trajectory_viewer.html` in any web browser.
2. Drag and drop any exported `MASTER_PROMPT.md` file or click **Load Sample Trajectory** to explore the conversation turn-by-turn.

---

## 🔒 Privacy & Security

* **Zero Network Calls**: All memory indexing, vector search, and NLP transformations run locally in-browser.
* **Local Storage Only**: Memory records and conversation snapshots are stored strictly in client-side IndexedDB.
* **No Telemetry**: No tracking pixels, third-party CDNs, or external telemetry scripts.

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
