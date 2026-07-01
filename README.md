# 🌟 Eskay — Claude.ai Usage Dashboard & Prompt Optimizer

Eskay is a premium browser extension and userscript designed specifically for **Claude.ai**. It helps you prevent token waste, eliminate limit blindness, safeguard conversation context, and maximize prompt engineering efficiency — all running 100% locally in your browser.

---

## 🚀 Quick Download & Installation

### Option 1: Chrome / Edge / Brave Extension (Recommended)
Get the pre-packaged extension directly and load it into your browser:

1. **[Click here to download eskay.zip](https://github.com/Pranavsk22/Eskay-Claude-Extension/raw/main/eskay.zip)**.
2. Extract the downloaded `eskay.zip` folder onto your computer.
3. Open your browser's extensions management page:
   - **Chrome / Brave / Opera:** Navigate to `chrome://extensions/`
   - **Edge:** Navigate to `edge://extensions/`
4. Toggle on **Developer mode** (usually in the upper-right corner).
5. Click **Load unpacked** (in the top-left corner).
6. Select the extracted `eskay` folder (the directory containing `manifest.json`).
7. Open or refresh `https://claude.ai` to start using Eskay!

---

### Option 2: Greasemonkey / Tampermonkey Userscript
If you prefer running it as a userscript:

1. Install the [Tampermonkey](https://www.tampermonkey.net/) or Greasemonkey extension from your browser's web store.
2. **[Click here to install eskay.user.js](https://github.com/Pranavsk22/Eskay-Claude-Extension/raw/main/eskay/userscript/eskay.user.js)** (Tampermonkey will automatically detect the script and prompt you to install it).
3. Confirm the installation.
4. Open or refresh `https://claude.ai`!

---

## ✨ Features

### 1. Claude.ai Usage Dashboard
* **5-Hour Rolling Session Quota:** Visually tracks remaining messages and counts down the exact time until your quota resets.
* **7-Day Rolling Weekly Quota:** Displays long-term message consumption and tracks reset times.
* **Real-time Context Window Counter:** Counts BPE tokens for your active chat window to prevent exceeding Claude's 200k token limit.
* **Ephemeral Cache Timer:** Tracks prompt caching lifetimes with a 5-minute countdown to help you leverage Claude's caching optimizations.
* **Utilization Alert States:** Indicators dynamically shift colors from **Orange** to **Amber (>80%)** and **Red (>95%)** based on your consumption.

### 2. Prompt Optimizer (Toolbar)
Directly integrated below the Claude input area, offering two powerful optimization modes:
* **Minimize Tokens:** NLP-based compression that strips filler words, hedges, pronouns, and redundant phrase structures to save prompt tokens without changing the core meaning.
* **Max Efficiency:** Enriches your prompt with curated, domain-specific expert personas, output formats, reasoning triggers, and custom rules.
* **Interactive Modifiers:** Easily toggle individual prompt options (like *One-Shot Examples*, *Brutal Critique*, or *Chain of Thought*) with real-time token delta displays.

### 3. Context Retrieval & Exporter
* Click **Retrieve Context** in the toolbar to scrape all messages, code blocks, and attachments in your active chat.
* Instantly downloads a clean, structured `.md` handoff document mapping out your goals, accomplishments, constraints, code snippets, and next steps — allowing you to resume seamlessly in a fresh chat window when limits are reached!

---

## 🔒 Privacy & Safety
* **100% Client-Side:** Eskay runs completely in your browser. No prompt data, tokens, or conversation history are ever transmitted to external servers.
* **Zero External Dependencies:** No analytical trackers or third-party libraries are loaded, ensuring absolute data privacy.
