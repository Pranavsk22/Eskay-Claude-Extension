# Eskay — Claude.ai Usage Dashboard & Prompt Optimizer

Eskay is a premium, client-side browser extension and userscript designed specifically for **Claude.ai** to prevent token waste, eliminate limit blindness, and safeguard conversation context.

## 🌟 Key Features

1. **Usage Dashboard:**
   - **Session Quota (5-Hour Rolling):** Live progress bar displaying remaining messages and precise time until reset.
   - **Weekly Quota (7-Day Rolling):** Live progress bar displaying long-term consumption and time until reset.
   - **Context Window Counter:** Real-time BPE token count for your active chat conversation (compared against Claude's 200k limit).
   - **Ephemeral Cache Timer:** 5-minute countdown tracking conversation caching to help you utilize prompt caching.
   - **Dynamic Warning Indicators:** Progress bars shift color from **Orange** to **Amber (>80%)** and **Red (>95%)** based on utilization.

2. **Prompt Optimizer:**
   - **Minimize Tokens Mode:** Rule-based NLP optimizer that removes polite/filler words, hedges, pronouns, meta-commentary, and redundant sentence structures to compress your prompts without losing semantic meaning.
   - **Max Efficiency Mode:** Intelligent structuring using best-practice prompt templates, domain inference (software engineering, writing, mathematics, data analysis, marketing), output format specifications, chain-of-thought triggers, and one-shot examples.
   - **Token Delta Display:** Live calculations of exactly how many tokens were saved or modified.

3. **Context File Export (`MASTER_PROMPT.md`):**
   - Click `⬇ Retrieve Context` to scrape all messages, attachments, and code blocks in your active chat.
   - Generates a beautifully structured `MASTER_PROMPT.md` document mapping out conversation goals, accomplished tasks, key constraints, verbatim code artifacts, and unresolved next steps.
   - Allows seamless handoffs into new chat windows once limits are reached!

---

## 🛠 Installation Instructions

### Option A: Chrome / Edge / Brave Extension (Manifest V3)

1. Clone or download this repository.
2. Open your browser and navigate to the extensions page:
   - **Chrome / Brave:** `chrome://extensions/`
   - **Edge:** `edge://extensions/`
3. Toggle on **Developer mode** in the upper-right corner.
4. Click **Load unpacked** in the top-left.
5. Select the `eskay` folder containing `manifest.json`.
6. Open or refresh `https://claude.ai` to start using Eskay!

### Option B: Greasemonkey / Tampermonkey Userscript

1. Install the **Tampermonkey** or **Greasemonkey** extension in your browser.
2. Create a new script in the Tampermonkey dashboard.
3. Copy the entire contents of [eskay.user.js](userscript/eskay.user.js) and paste it into the editor.
4. Save the script.
5. Open or refresh `https://claude.ai/`!

---

## 🎨 Theme Accents

- **Primary Accent / Bars:** Orange (`#E8721C`) matching Claude's brand colors.
- **Active Modes / Sub-options:** Violet (`#7C3AED`) representing active prompt engineering variables.
- **Alert Colors:** Amber (`#F59E0B`) and Red (`#EF4444`) representing warning states.

---

## 📦 Packaging & Chrome Web Store Deployment

To publish Eskay to the Chrome Web Store, follow these steps:

### 1. Package the Extension
Create a `.zip` file of the `eskay` folder. Make sure the zip contains the `manifest.json` at the root of the archive (i.e. not nested inside a subfolder inside the zip).
- **Windows (PowerShell):**
  ```powershell
  Compress-Archive -Path eskay\* -DestinationPath eskay.zip
  ```
- **macOS / Linux (Terminal):**
  ```bash
  zip -r eskay.zip eskay/
  ```

### 2. Set Up a Google Chrome Developer Account
1. Go to the [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole).
2. Sign in with your Google account.
3. Pay the one-time $5 USD developer registration fee (required by Google to prevent spam).

### 3. Upload & Configure Your Extension
1. In the console, click **New Item**.
2. Upload the `eskay.zip` file you created in step 1.
3. Fill out the store listing details:
   - **Detailed Description:** Describe Eskay's features (Usage Dashboard, Prompt Optimizer, Context Exporter).
   - **Category:** Select "Developer Tools" or "Productivity".
   - **Language:** English (or your preferred default).
   - **Icons & Screenshots:** Upload standard promotional images/screenshots of the extension in action. (Google requires at least one 1280x800 or 640x400 screenshot).
4. **Privacy / Single Purpose:** Explain that Eskay requires storage and access to `https://claude.ai/*` specifically to read session usage metrics and inject the local optimizer toolbar. Mention that all operations are 100% client-side with no external servers.
5. Submit for Review! Review times typically range from a few hours to a few days.

---

## 🔍 Local Verification Checklist

To verify that Eskay is working perfectly locally:
1. Go to `chrome://extensions/` and load the `eskay` directory as an **unpacked extension**.
2. Navigate to `https://claude.ai/`.
3. Start a conversation or select an existing one.
4. Verify the **Eskay Toolbar** renders properly underneath/adjacent to the chat input area.
5. Check that the **Session**, **Weekly**, and **Context** meters load their status.
6. Type a message in the input box, click **Optimize** (toggle between *Minimize Tokens* and *Max Efficiency*), and check if the prompt compression/templating works and updates the token delta display.
7. Click **Retrieve Context** and verify that a `MASTER_PROMPT.md` file downloads successfully with conversation content structured correctly.

