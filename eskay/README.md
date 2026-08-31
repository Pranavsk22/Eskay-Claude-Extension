# Eskay — Claude.ai Extension Package

This directory contains the unpacked Google Chrome / Chromium extension package for Eskay (Manifest V3).

---

## Directory Layout

```
eskay/
├── manifest.json            # Manifest V3 extension configuration
├── icons/                   # Extension icons (16x16, 48x48, 128x128)
├── memory/
│   ├── schema.js            # MemoryRecord schema validator
│   ├── vectorStore.js       # IndexedDB storage + 384-d vector cosine search
│   └── consolidate.js       # Automated near-duplicate memory consolidation pass
├── src/
│   ├── content.js           # Isolated-world orchestration and postMessage client
│   ├── inject.js            # Main-world fetch/SSE network interceptor
│   ├── optimizer.js         # Dual-mode prompt optimizer & 49-persona router
│   ├── tokenizer.js         # BPE tokenizer & O(1) fingerprint token cache
│   ├── o200k_base.js        # BPE vocabulary table
│   ├── contextExporter.js   # Conversation tree scraper and MASTER_PROMPT.md exporter
│   ├── trajectoryVisualizer.js # In-browser conversation trajectory inspector
│   ├── usageTracker.js      # 5-hour/7-day quota and cache lifetime tracker
│   └── ui.js                # DOM toolbar, dynamic progress bars, and modals
├── styles/
│   └── toolbar.css          # Styled components & responsive dark/light modes
├── userscript/
│   └── eskay.user.js        # Tampermonkey / Greasemonkey single-file bundle
└── eval/
    ├── eval_runner.html     # Browser-based LongMemEval test runner
    ├── recall_eval.js       # LongMemEval retrieval regression harness
    └── testset.json         # Labeled multi-session evaluation cases
```

---

## Installation (Unpacked)

1. Open Chrome/Edge/Brave and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the upper right.
3. Click **Load unpacked** and select this `eskay` folder.
4. Navigate to `https://claude.ai/`.

---

## Chrome Web Store Packaging

To generate a distribution zip archive for the Chrome Developer Console:

- **Windows (PowerShell):**
  ```powershell
  Compress-Archive -Path eskay\* -DestinationPath eskay.zip -Force
  ```
- **macOS / Linux:**
  ```bash
  cd eskay && zip -r ../eskay.zip . && cd ..
  ```

---

## Verification & Testing

- Load `eskay/eval/eval_runner.html` in your browser to run the LongMemEval vector recall and memory consolidation test suite.
- Run `node test/persona-test-harness.js` and `node test/differential-tester.js` from the repository root.

