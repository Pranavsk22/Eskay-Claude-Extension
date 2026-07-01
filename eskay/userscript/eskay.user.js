// ==UserScript==
// @name         Eskay Claude Helper
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Real-time token counter, usage dashboard, and prompt optimizer for Claude.ai
// @author       Pranav
// @match        https://claude.ai/*
// @require      https://unpkg.com/gpt-tokenizer/dist/o200k_base.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // --- 1. Style Injector ---
  const css = `
    :root {
      --cb-orange: #E8721C;
      --cb-violet: #7C3AED;
      --cb-amber: #F59E0B;
      --cb-red: #EF4444;
      --cb-surface: rgba(26, 26, 25, 0.95);
      --cb-border: rgba(255, 255, 255, 0.08);
      --cb-text: #E5E7EB;
      --cb-text-muted: #9CA3AF;
      --cb-bg-hover: rgba(255, 255, 255, 0.06);
    }
    .ek-header-container {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'Fira Code', 'Courier New', monospace;
      font-size: 11px;
      color: var(--cb-text-muted);
      padding: 6px 12px;
      background-color: rgba(0, 0, 0, 0.15);
      border: 1px solid var(--cb-border);
      border-radius: 8px;
      margin-left: 8px;
      white-space: nowrap;
    }
    .ek-header-mini-bar {
      display: inline-block;
      width: 40px;
      height: 4px;
      background-color: rgba(255, 255, 255, 0.05);
      border-radius: 2px;
      overflow: hidden;
      border: 1px solid rgba(0,0,0,0.2);
      vertical-align: middle;
    }
    .ek-header-mini-bar-fill {
      height: 100%;
      background-color: var(--cb-orange);
      border-radius: 2px;
    }
    .ek-header-cache-active {
      color: #10B981;
      font-weight: 600;
    }
    #eskay-toolbar {
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--cb-surface);
      border: 1px solid var(--cb-border);
      border-radius: 12px;
      padding: 12px 16px;
      margin-top: 8px;
      margin-bottom: 8px;
      color: var(--cb-text);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-size: 13px;
      user-select: none;
      backdrop-filter: blur(10px);
      transition: all 0.3s ease;
      width: 100%;
      box-sizing: border-box;
      flex-shrink: 0;
    }
    .ek-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .ek-logo-group {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 14px;
    }
    .ek-logo-dot {
      width: 10px;
      height: 10px;
      background-color: var(--cb-orange);
      border-radius: 50%;
      display: inline-block;
      box-shadow: 0 0 8px var(--cb-orange);
      animation: ek-pulse 2s infinite ease-in-out;
    }
    @keyframes ek-pulse {
      0% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.2); opacity: 0.7; }
      100% { transform: scale(1); opacity: 1; }
    }
    /* Coloured Premium Action Buttons */
    .ek-btn-minimize {
      background: linear-gradient(135deg, #7C3AED, #6D28D9) !important;
      border: 1px solid rgba(124, 58, 237, 0.4) !important;
      color: #ffffff !important;
      font-weight: 600 !important;
      box-shadow: 0 2px 6px rgba(124, 58, 237, 0.25);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .ek-btn-minimize:hover {
      background: linear-gradient(135deg, #8B5CF6, #7C3AED) !important;
      border-color: #8B5CF6 !important;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
    }
    .ek-btn-minimize:active {
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba(124, 58, 237, 0.2);
    }
    .ek-btn-maximize {
      background: linear-gradient(135deg, #E8721C, #D96216) !important;
      border: 1px solid rgba(232, 114, 28, 0.4) !important;
      color: #ffffff !important;
      font-weight: 600 !important;
      box-shadow: 0 2px 6px rgba(232, 114, 28, 0.25);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .ek-btn-maximize:hover {
      background: linear-gradient(135deg, #F97316, #E8721C) !important;
      border-color: #F97316 !important;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(232, 114, 28, 0.4);
    }
    .ek-btn-maximize:active {
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba(232, 114, 28, 0.2);
    }
    .ek-btn-retrieve {
      background-color: rgba(255, 255, 255, 0.06) !important;
      border: 1px solid var(--cb-border) !important;
      color: var(--cb-text) !important;
      font-weight: 500 !important;
      transition: all 0.2s ease;
    }
    .ek-btn-retrieve:hover {
      background-color: rgba(255, 255, 255, 0.12) !important;
      border-color: rgba(255, 255, 255, 0.2) !important;
      transform: translateY(-1px);
    }
    .ek-btn-retrieve:active {
      transform: translateY(0);
    }
    .ek-actions-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 10px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .ek-buttons {
      display: flex;
      gap: 8px;
    }
    .ek-btn {
      background-color: var(--cb-bg-hover);
      border: 1px solid var(--cb-border);
      color: var(--cb-text);
      padding: 7px 16px;
      border-radius: 20px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
    }
    .ek-btn:hover {
      background-color: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .ek-delta {
      font-family: 'Fira Code', 'Courier New', monospace;
      font-size: 11px;
      font-weight: 600;
      color: #10B981;
      background-color: rgba(16, 185, 129, 0.1);
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid rgba(16, 185, 129, 0.2);
      display: none;
    }
    .ek-toggle-sub {
      background: none;
      border: none;
      color: var(--cb-text-muted);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    .ek-toggle-sub:hover {
      background-color: var(--cb-bg-hover);
      color: var(--cb-text);
    }
    .ek-toggle-sub svg {
      transition: transform 0.2s ease;
    }
    .ek-toggle-sub.open svg {
      transform: rotate(180deg);
    }
    .ek-sub-panel {
      display: none;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 8px 16px;
      background-color: rgba(0, 0, 0, 0.15);
      border-radius: 8px;
      padding: 10px;
      border: 1px solid rgba(255, 255, 255, 0.03);
    }
    .ek-checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 11px;
      color: var(--cb-text-muted);
      transition: color 0.2s ease;
    }
    .ek-checkbox-label:hover {
      color: var(--cb-text);
    }
    .ek-checkbox-label input {
      cursor: pointer;
      accent-color: var(--cb-orange);
    }
    .ek-dashboard {
      display: flex;
      flex-direction: column;
      gap: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 10px;
      cursor: pointer;
    }
    .ek-bar-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .ek-bar-header {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 500;
      color: var(--cb-text-muted);
    }
    .ek-bar-label {
      font-family: 'Fira Code', 'Courier New', monospace;
      font-weight: 600;
      font-size: 10px;
      letter-spacing: 0.5px;
    }
    .ek-bar-meta {
      font-family: 'Fira Code', 'Courier New', monospace;
      font-size: 10px;
    }
    .ek-bar-outer {
      position: relative;
      height: 6px;
      background-color: rgba(255, 255, 255, 0.05);
      border-radius: 3px;
      overflow: visible;
      border: 1px solid rgba(0, 0, 0, 0.2);
    }
    .ek-bar-inner {
      height: 100%;
      width: 0%;
      background-color: var(--cb-orange);
      border-radius: 3px;
      transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease;
    }
    .ek-bar-inner.warning {
      background-color: var(--cb-amber);
      box-shadow: 0 0 4px var(--cb-amber);
    }
    .ek-bar-inner.critical {
      background-color: var(--cb-red);
      box-shadow: 0 0 6px var(--cb-red);
    }
    .ek-bar-marker {
      position: absolute;
      top: -3px;
      width: 2px;
      height: 12px;
      background-color: #fff;
      box-shadow: 0 0 4px rgba(255,255,255,0.8);
      pointer-events: none;
      transition: left 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      display: none;
    }
    .ek-cache-timer {
      font-family: 'Fira Code', 'Courier New', monospace;
      font-size: 10px;
      color: var(--cb-text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 2px;
    }
    .ek-cache-timer-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: #9CA3AF;
      display: inline-block;
    }
    .ek-cache-timer-dot.active {
      background-color: #10B981;
      box-shadow: 0 0 4px #10B981;
    }
    .ek-tooltip {
      position: absolute;
      z-index: 100001;
      background-color: #1e1e1e;
      border: 1px solid var(--cb-border);
      color: #fff;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 11px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
      white-space: pre-line;
      max-width: 280px;
      line-height: 1.4;
      box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    }
    .ek-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background-color: rgba(18, 18, 18, 0.95);
      border: 1px solid var(--cb-orange);
      border-radius: 8px;
      padding: 14px 20px;
      color: #fff;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      z-index: 100000;
      font-size: 12px;
      max-width: 320px;
      line-height: 1.5;
      display: flex;
      flex-direction: column;
      gap: 4px;
      backdrop-filter: blur(8px);
      animation: ek-toast-slide 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes ek-toast-slide {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .ek-toast-fadeout {
      animation: ek-toast-fade 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes ek-toast-fade {
      from { opacity: 1; transform: translateY(0) scale(1); }
      to { opacity: 0; transform: translateY(-10px) scale(0.95); }
    }

    /* Light Mode Overrides */
    #eskay-toolbar.ek-light-mode {
      background-color: #FFFFFF !important;
      border-color: rgba(0, 0, 0, 0.1) !important;
      color: #000000 !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06) !important;
    }
    #eskay-toolbar.ek-light-mode .ek-logo-group {
      color: #000000 !important;
    }
    #eskay-toolbar.ek-light-mode .ek-sub-panel {
      background-color: rgba(0, 0, 0, 0.03) !important;
      border-color: rgba(0, 0, 0, 0.05) !important;
    }
    #eskay-toolbar.ek-light-mode .ek-bar-outer {
      background-color: rgba(0, 0, 0, 0.05) !important;
      border-color: rgba(0, 0, 0, 0.08) !important;
    }
    #eskay-toolbar.ek-light-mode .ek-bar-header,
    #eskay-toolbar.ek-light-mode .ek-checkbox-label {
      color: #000000 !important;
    }
    #eskay-toolbar.ek-light-mode .ek-checkbox-label:hover {
      color: #000000 !important;
    }
    #eskay-toolbar.ek-light-mode .ek-toggle-sub {
      color: #000000 !important;
    }
    #eskay-toolbar.ek-light-mode .ek-toggle-sub:hover {
      background-color: rgba(0, 0, 0, 0.04) !important;
      color: #000000 !important;
    }
    #eskay-toolbar.ek-light-mode .ek-delta {
      color: #047857 !important;
      background-color: rgba(16, 185, 129, 0.1) !important;
      border-color: rgba(16, 185, 129, 0.2) !important;
    }
    #eskay-toolbar.ek-light-mode .ek-btn {
      color: #000000 !important;
      border-color: rgba(0, 0, 0, 0.12) !important;
      font-weight: 600 !important;
    }
    #eskay-toolbar.ek-light-mode .ek-btn-minimize {
      background: #F3E8FF !important;
      border-color: #C084FC !important;
      box-shadow: 0 1px 3px rgba(124, 58, 237, 0.1);
    }
    #eskay-toolbar.ek-light-mode .ek-btn-minimize:hover {
      background: #E9D5FF !important;
      border-color: #A855F7 !important;
    }
    #eskay-toolbar.ek-light-mode .ek-btn-maximize {
      background: #FFEDD5 !important;
      border-color: #FDBA74 !important;
      box-shadow: 0 1px 3px rgba(232, 114, 28, 0.1);
    }
    #eskay-toolbar.ek-light-mode .ek-btn-maximize:hover {
      background: #FED7AA !important;
      border-color: #F97316 !important;
    }
    #eskay-toolbar.ek-light-mode .ek-btn-retrieve {
      background-color: #F3F4F6 !important;
      border-color: #D1D5DB !important;
    }
    #eskay-toolbar.ek-light-mode .ek-btn-retrieve:hover {
      background-color: #E5E7EB !important;
      border-color: #9CA3AF !important;
    }

    /* Brutal Mode Switch Styles */
    .ek-brutal-switch-container {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;
      font-size: 12px;
      font-weight: 500;
      color: var(--cb-text-muted);
      margin-left: 12px;
      position: relative;
      transition: opacity 0.2s ease;
    }
    .ek-brutal-switch-container:hover {
      color: var(--cb-text);
    }
    .ek-brutal-switch-label {
      font-size: 11px;
    }
    .ek-brutal-checkbox {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
    }
    .ek-brutal-slider {
      width: 32px;
      height: 18px;
      background-color: rgba(255, 255, 255, 0.15);
      border: 1px solid var(--cb-border);
      border-radius: 9px;
      position: relative;
      transition: background-color 0.2s ease, border-color 0.2s ease;
    }
    #eskay-toolbar.ek-light-mode .ek-brutal-slider {
      background-color: rgba(0, 0, 0, 0.1);
      border-color: rgba(0, 0, 0, 0.15);
    }
    .ek-brutal-slider::before {
      content: "";
      position: absolute;
      height: 12px;
      width: 12px;
      left: 2px;
      bottom: 2px;
      background-color: #fff;
      border-radius: 50%;
      transition: transform 0.2s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    }
    #eskay-toolbar.ek-light-mode .ek-brutal-slider::before {
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
    .ek-brutal-checkbox:checked + .ek-brutal-slider {
      background-color: var(--cb-red);
      border-color: rgba(239, 68, 68, 0.4);
      box-shadow: 0 0 6px rgba(239, 68, 68, 0.3);
    }
    .ek-brutal-checkbox:checked + .ek-brutal-slider::before {
      transform: translateX(14px);
    }
    #eskay-toolbar.ek-light-mode .ek-brutal-switch-container {
      color: #000000 !important;
    }
    #eskay-toolbar.ek-light-mode .ek-brutal-checkbox:checked + .ek-brutal-slider {
      background-color: var(--cb-red) !important;
      border-color: var(--cb-red) !important;
      box-shadow: 0 1px 3px rgba(239, 68, 68, 0.2) !important;
    }
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  (document.head || document.documentElement).appendChild(styleEl);

  // --- 2. Mock Storage for Userscript ---
  const storageMock = {
    get(keys, callback) {
      const res = {};
      keys.forEach(k => {
        const val = localStorage.getItem('eskay_' + k);
        if (val) {
          try { res[k] = JSON.parse(val); } catch (e) { res[k] = val; }
        }
      });
      callback(res);
    },
    set(obj) {
      for (let k in obj) {
        localStorage.setItem('eskay_' + k, JSON.stringify(obj[k]));
      }
    }
  };

  // --- 3. Tokenizer logic ---
  const ROOT_MESSAGE_ID = '00000000-0000-4000-8000-000000000000';
  const CACHE_WINDOW_MS = 5 * 60 * 1000;

  function stableStringify(value) {
    const seen = new WeakSet();
    const normalize = (v) => {
      if (v === null || typeof v !== 'object') return v;
      if (seen.has(v)) return '[Circular]';
      seen.add(v);
      if (Array.isArray(v)) return v.map(normalize);
      const out = {};
      for (const key of Object.keys(v).sort()) { out[key] = normalize(v[key]); }
      return out;
    };
    try { return JSON.stringify(normalize(value)); } catch { return ''; }
  }

  function countTokens(text) {
    if (!text) return 0;
    const tokenizer = globalThis.GPTTokenizer_o200k_base;
    if (tokenizer) {
      if (typeof tokenizer.countTokens === 'function') {
        try { return tokenizer.countTokens(text); } catch (e) { }
      } else if (typeof tokenizer.encode === 'function') {
        try { return tokenizer.encode(text).length; } catch (e) { }
      }
    }
    return Math.ceil(text.length / 4);
  }

  function buildTrunk(conversation) {
    const messages = Array.isArray(conversation?.chat_messages) ? conversation.chat_messages : [];
    const byId = new Map();
    for (const msg of messages) {
      if (msg?.uuid) byId.set(msg.uuid, msg);
    }
    const leaf = conversation?.current_leaf_message_uuid;
    if (!leaf) return [];
    const trunk = [];
    let currentId = leaf;
    while (currentId && currentId !== ROOT_MESSAGE_ID) {
      const msg = byId.get(currentId);
      if (!msg) break;
      trunk.push(msg);
      currentId = msg.parent_message_uuid;
    }
    trunk.reverse();
    return trunk;
  }

  function isCountableContentItem(item) {
    if (!item || typeof item !== 'object') return false;
    if (typeof item.type !== 'string') return false;
    if (item.type === 'thinking' || item.type === 'redacted_thinking') return false;
    if (item.type === 'image' || item.type === 'document') return false;
    return true;
  }

  function stringifyCountableContentItem(item) {
    if (!isCountableContentItem(item)) return '';
    if (item.type === 'text' && typeof item.text === 'string') return item.text;
    if (item.type === 'tool_use') {
      return stableStringify({ id: item.id, name: item.name, input: item.input });
    }
    if (item.type === 'tool_result') {
      return stableStringify({ tool_use_id: item.tool_use_id, is_error: item.is_error, content: item.content });
    }
    const minimal = {};
    if (typeof item.text === 'string') minimal.text = item.text;
    if (typeof item.title === 'string') minimal.title = item.title;
    if (typeof item.url === 'string') minimal.url = item.url;
    if (typeof item.content === 'string') minimal.content = item.content;
    if (Array.isArray(item.content)) minimal.content = item.content;
    if (Object.keys(minimal).length === 0) return '';
    return stableStringify(minimal);
  }

  function stringifyMessageCountables(message) {
    const parts = [];
    const content = Array.isArray(message?.content) ? message.content : [];
    for (const item of content) {
      const s = stringifyCountableContentItem(item);
      if (s) parts.push(s);
    }
    const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
    for (const a of attachments) {
      if (typeof a?.extracted_content === 'string' && a.extracted_content) {
        parts.push(a.extracted_content);
      }
    }
    return parts.join('\n');
  }

  async function hashString(str) {
    try {
      if (crypto?.subtle?.digest) {
        const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        const bytes = new Uint8Array(buffer);
        return Array.from(bytes.slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) { }
    return null;
  }

  async function fingerprint(text) {
    if (!text) return null;
    const hash = await hashString(text);
    if (!hash) return null;
    return `${text.length}:${hash}`;
  }

  class TokenCache {
    constructor() { this._byMessageId = new Map(); }
    async getMessageTokens(messageId, messageText) {
      const fp = await fingerprint(messageText);
      if (!fp) return countTokens(messageText);
      const cached = this._byMessageId.get(messageId);
      if (cached && cached.fp === fp) return cached.tokens;
      const tokens = countTokens(messageText);
      this._byMessageId.set(messageId, { fp, tokens });
      return tokens;
    }
    pruneToMessageIds(keepIds) {
      const keep = new Set(keepIds);
      for (const id of this._byMessageId.keys()) {
        if (!keep.has(id)) this._byMessageId.delete(id);
      }
    }
  }

  const tokenCache = new TokenCache();

  const EskayTokenizer = {
    countTokens,
    async computeConversationMetrics(conversation) {
      const trunk = buildTrunk(conversation);
      const trunkIds = trunk.map((m) => m.uuid).filter(Boolean);
      tokenCache.pruneToMessageIds(trunkIds);

      let totalTokens = 0;
      let lastAssistantMs = null;
      for (const msg of trunk) {
        if (msg?.sender === 'assistant' && msg?.created_at) {
          const msgMs = Date.parse(msg.created_at);
          if (!lastAssistantMs || msgMs > lastAssistantMs) { lastAssistantMs = msgMs; }
        }
        const msgText = stringifyMessageCountables(msg);
        const msgTokens = msg?.uuid ? await tokenCache.getMessageTokens(msg.uuid, msgText) : countTokens(msgText);
        totalTokens += msgTokens;
      }
      const cachedUntil = lastAssistantMs ? lastAssistantMs + CACHE_WINDOW_MS : null;
      return { totalTokens, cachedUntil };
    }
  };

  // --- 4. Prompt Optimizer ---
  const MINIMIZE_RULES = [
    { pattern: /^(could you please|please|can you|would you mind|kindly)\s+/i, replacement: '' },
    { pattern: /\b(please|kindly)\s+/gi, replacement: '' },
    { pattern: /\b(thank you|thanks|of course|sure|absolutely)\b[.!?]?\s*/gi, replacement: '' },
    { pattern: /\bI was thinking that (maybe\s*)?(we could\s*)?/gi, replacement: '' },
    { pattern: /\bI want to ask if\s+/gi, replacement: '' },
    { pattern: /\bI am wondering if\s+/gi, replacement: '' },
    { pattern: /\b(just\s*)?want to let you know that\s+/gi, replacement: '' },
    { pattern: /\bI would like you to explain the concept of\s+/gi, replacement: 'Explain ' },
    { pattern: /\bI would like you to write a script that\s+/gi, replacement: 'Write script: ' },
    { pattern: /\bexplain the concept of\s+/gi, replacement: 'explain ' },
    { pattern: /\bwrite a function that\s+/gi, replacement: 'write function that ' },
    { pattern: /\b(basically|essentially|literally|generally speaking|sort of|kind of)\b\s*,?\s*/gi, replacement: '' },
    { pattern: /\bcan you (write|create|implement|design|fix|debug|refactor|explain|analyze|summarize|evaluate)\b/gi, replacement: '$1' },
    { pattern: /\bcan you help me (write|create|implement|design|fix|debug|refactor|explain|analyze|summarize|evaluate)\b/gi, replacement: '$1' },
    { pattern: /\bin order to\b/gi, replacement: 'to' },
    { pattern: /\bfor the purpose of\b/gi, replacement: 'for' },
    { pattern: /\bwith the goal of\b/gi, replacement: 'to' }
  ];

  function removeDuplicateWordSequences(text, minWords = 10) {
    const words = text.split(/\s+/);
    if (words.length < minWords * 2) return text;

    let i = 0;
    while (i < words.length - minWords) {
      const candidate = words.slice(i, i + minWords).join(' ').toLowerCase().replace(/[^a-z0-9 ]/g, '');
      let foundIndex = -1;
      for (let j = i + minWords; j <= words.length - minWords; j++) {
        const target = words.slice(j, j + minWords).join(' ').toLowerCase().replace(/[^a-z0-9 ]/g, '');
        if (candidate === target) {
          foundIndex = j;
          break;
        }
      }
      if (foundIndex !== -1) {
        let len = minWords;
        while (i + len < foundIndex && foundIndex + len < words.length) {
          const w1 = words[i + len].toLowerCase().replace(/[^a-z0-9]/g, '');
          const w2 = words[foundIndex + len].toLowerCase().replace(/[^a-z0-9]/g, '');
          if (w1 === w2) { len++; }
          else { break; }
        }
        words.splice(foundIndex, len);
        continue;
      }
      i++;
    }
    return words.join(' ');
  }

  function deduplicateSentences(text) {
    if (!text) return '';
    const sentences = text.split(/(?<=[.?!])\s+/);
    const seen = new Set();
    const unique = [];
    for (let s of sentences) {
      const trimmed = s.trim();
      const key = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (key) {
        if (!seen.has(key)) { seen.add(key); unique.push(trimmed); }
      } else { unique.push(trimmed); }
    }
    let result = unique.join(' ');
    return removeDuplicateWordSequences(result, 10);
  }

  const INTENT_PATTERNS = [
    {
      intent: 'diagnose',
      patterns: [
        /\b(fix|debug|broken|not working|error|crash|exception|failing|issue|problem|bug|wrong output|unexpected)\b/i,
        /\bwhy (is|does|won't|can't|isn't|doesn't|are|were)\b/i,
        /\bwhat('s| is) (wrong|causing|happening)\b/i,
      ]
    },
    {
      intent: 'generate',
      patterns: [
        /^(write|create|generate|make|build|draft|produce|give me|show me|output)\b/im,
        /\b(write me|create me|build me|make me|generate me)\b/i,
        /\bi (need|want) (a|an|the|to)\b/i,
      ]
    },
    {
      intent: 'evaluate',
      patterns: [
        /\b(review|critique|feedback|assess|evaluate|check|is this good|improve|rate|score|what do you think of|thoughts on)\b/i,
        /^(here is|here's|this is|below is|attached is|the following is)\b/im,
      ]
    },
    {
      intent: 'explain',
      patterns: [
        /\b(explain|how does|how do|what is|what are|help me understand|teach me|walk me through|clarify|describe)\b/i,
        /\bwhat('s| is) (the difference|a|an|the concept|the idea|the purpose)\b/i,
      ]
    },
    {
      intent: 'decide',
      patterns: [
        /\b(should i|which (is|should|would)|compare|vs\.?|versus|difference between|better (for|to|than)|pros and cons|trade-?offs?)\b/i,
        /\bwhat('s| is) (best|recommended|the right)\b/i,
      ]
    },
    {
      intent: 'transform',
      patterns: [
        /\b(rewrite|rephrase|translate|convert|refactor|restructure|simplify|shorten|expand|summarize|condense|paraphrase|clean up|tidy)\b/i,
      ]
    },
  ];

  function detectIntent(text) {
    for (const { intent, patterns } of INTENT_PATTERNS) {
      if (patterns.some(p => p.test(text))) return intent;
    }
    return 'generate';
  }

  function detectDomain(text) {
    const t = text.toLowerCase();

    const categories = [
      {
        id: 'database_architecture',
        persona: 'a principal database engineer responsible for mission-critical systems processing billions of records. You identify schema weaknesses, indexing issues, scaling bottlenecks, transaction risks, query inefficiencies, and future maintenance concerns',
        keywords: [
          { pattern: /\b(postgresql|mysql|query optimization|normalization|sql tuning)\b/g, weight: 2.0 },
          { pattern: /\b(database design|schema|index)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'cybersecurity',
        persona: 'a principal security engineer performing a pre-production security audit. You identify attack surfaces, privilege escalation risks, authentication weaknesses, data exposure issues, and vulnerabilities that could lead to compromise',
        keywords: [
          { pattern: /\b(penetration testing|owasp|xss|csrf)\b/g, weight: 2.0 },
          { pattern: /\b(cybersecurity|vulnerability|authentication|authorization)\b/g, weight: 1.0 },
          { pattern: /\b(security)\b/g, weight: 0.5 }
        ]
      },
      {
        id: 'system_design',
        persona: 'a staff engineer conducting architecture reviews for systems serving tens of millions of users. You evaluate scalability, fault tolerance, observability, cost efficiency, latency, reliability, and operational complexity',
        keywords: [
          { pattern: /\b(distributed systems|microservices|load balancing)\b/g, weight: 2.0 },
          { pattern: /\b(system design|scalability|architecture review)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'rag_architecture',
        persona: 'a principal AI engineer responsible for production RAG systems serving enterprise customers. You evaluate retrieval quality, chunking strategy, embedding performance, reranking effectiveness, latency, hallucination prevention, and answer grounding',
        keywords: [
          { pattern: /\b(retrieval augmented generation|vector database|embeddings|faiss|pinecone|reranking)\b/g, weight: 2.0 },
          { pattern: /\b(rag|chunking)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'devops',
        persona: 'a principal site reliability engineer responsible for infrastructure supporting millions of requests per day. You focus on uptime, deployment safety, observability, disaster recovery, scalability, infrastructure cost, and operational simplicity',
        keywords: [
          { pattern: /\b(terraform|ansible|prometheus|grafana)\b/g, weight: 2.0 },
          { pattern: /\b(devops|ci\/cd|deployment|monitoring|infrastructure)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'cloud_architecture',
        persona: 'a cloud solutions architect responsible for designing large-scale enterprise systems. You evaluate security, scalability, resilience, compliance, cost optimization, service selection, and operational overhead before approving any architecture',
        keywords: [
          { pattern: /\b(cloud architecture|lambda|ecs|eks|cloudformation)\b/g, weight: 2.0 },
          { pattern: /\b(aws|azure|gcp|serverless)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'api_design',
        persona: 'a staff backend architect reviewing APIs before public release. You evaluate consistency, versioning strategy, security, scalability, developer experience, error handling, and long-term maintainability',
        keywords: [
          { pattern: /\b(rest api|graphql|openapi|swagger)\b/g, weight: 2.0 },
          { pattern: /\b(endpoint|api design|webhook)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'data_engineering',
        persona: 'a principal data engineer responsible for enterprise-scale data platforms. You evaluate pipeline reliability, data quality, scalability, observability, governance, and operational efficiency',
        keywords: [
          { pattern: /\b(etl|elt|data pipeline|airflow|spark|data warehouse|snowflake)\b/g, weight: 2.0 },
          { pattern: /\b(bigquery)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'qa_testing',
        persona: 'a lead quality assurance engineer whose responsibility is preventing defective software from reaching production. You actively search for edge cases, failure scenarios, regressions, usability issues, and hidden assumptions',
        keywords: [
          { pattern: /\b(test case|bug report|test plan|regression testing|user acceptance testing)\b/g, weight: 2.0 },
          { pattern: /\b(qa|quality assurance)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'open_source_review',
        persona: 'a maintainer of a large open-source project reviewing external contributions. You evaluate readability, backward compatibility, architectural alignment, testing quality, maintainability, and whether the change introduces long-term technical debt',
        keywords: [
          { pattern: /\b(pull request|pr review|github contribution)\b/g, weight: 2.0 },
          { pattern: /\b(open source|oss|repository)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'mobile',
        persona: 'a principal mobile architect responsible for applications serving millions of active users. You evaluate performance, memory usage, battery efficiency, platform guidelines, scalability, crash resilience, offline behavior, and long-term maintainability. You aggressively identify production risks before launch',
        keywords: [
          { pattern: /\b(flutter|react native|swift|kotlin|xcode)\b/g, weight: 2.0 },
          { pattern: /\b(android|ios|mobile app|play store|app store)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'financial_analysis',
        persona: 'a senior financial analyst responsible for evaluating major investment decisions. You analyze cash flows, risk exposure, valuation assumptions, capital allocation efficiency, and downside scenarios before making recommendations',
        keywords: [
          { pattern: /\b(cash flow|dcf|valuation model|financial modeling|investment analysis)\b/g, weight: 2.0 },
          { pattern: /\b(financial analysis)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'trading',
        persona: 'a professional portfolio manager responsible for managing institutional capital. You evaluate risk-adjusted returns, position sizing, downside protection, macroeconomic influences, and behavioral biases rather than chasing speculation',
        keywords: [
          { pattern: /\b(swing trade|equity analysis|technical analysis)\b/g, weight: 2.0 },
          { pattern: /\b(stock market|trading|investing|portfolio)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'pitch_deck',
        persona: 'a venture capitalist reviewing hundreds of startup pitches every month. You quickly identify weak assumptions, unclear value propositions, unrealistic projections, competitive vulnerabilities, and missing investor signals',
        keywords: [
          { pattern: /\b(pitch deck|investor deck|startup pitch)\b/g, weight: 2.0 },
          { pattern: /\b(seed round|venture capital|fundraising)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'venture_capital',
        persona: 'a partner at a tier-1 venture capital firm reviewing over 1000 startup opportunities every year. You quickly identify weak moats, unrealistic assumptions, market limitations, founder risks, and flawed growth narratives. Your objective is to determine whether this deserves investment capital',
        keywords: [
          { pattern: /\b(investment thesis|seed round|series a|series b)\b/g, weight: 2.0 },
          { pattern: /\b(vc|venture capital|investor|fundraise)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'startup_founder',
        persona: 'a founder who has built and exited multiple venture-backed startups. You evaluate ideas under severe resource constraints and focus relentlessly on product-market fit, distribution, competitive advantage, speed of execution, and survivability. You reject anything that sounds impressive but cannot realistically acquire users or generate revenue',
        keywords: [
          { pattern: /\b(startup idea|product market fit|pmf)\b/g, weight: 2.0 },
          { pattern: /\b(founder|entrepreneur|business idea|bootstrapped|saas)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'product_management',
        persona: 'a principal product manager responsible for products used by millions of customers. You evaluate feature prioritization, user value, business impact, roadmap alignment, execution risk, and strategic tradeoffs',
        keywords: [
          { pattern: /\b(prd|user story|product strategy)\b/g, weight: 2.0 },
          { pattern: /\b(product manager|feature request|roadmap|mvp)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'procurement',
        persona: 'a procurement director responsible for selecting vendors in multi-million dollar contracts. You evaluate reliability, risk, cost efficiency, service quality, contractual exposure, and long-term vendor viability',
        keywords: [
          { pattern: /\b(vendor evaluation|rfp|vendor selection|bid proposal)\b/g, weight: 2.0 },
          { pattern: /\b(procurement|supplier)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'sales',
        persona: 'a top-performing enterprise sales executive who has closed multi-million dollar deals. You evaluate messaging based on trust building, objection handling, stakeholder alignment, urgency creation, and likelihood of conversion',
        keywords: [
          { pattern: /\b(prospecting|cold email|lead generation|b2b sales)\b/g, weight: 2.0 },
          { pattern: /\b(sales|sales pitch|outreach)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'seo',
        persona: 'a technical SEO strategist responsible for growing organic traffic for high-competition websites. You evaluate content quality, keyword targeting, search intent alignment, topical authority, and ranking potential',
        keywords: [
          { pattern: /\b(organic traffic|search ranking|search console)\b/g, weight: 2.0 },
          { pattern: /\b(seo|keyword|backlinks)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'youtube_strategy',
        persona: 'a content strategist responsible for channels generating millions of views per month. You evaluate audience retention, curiosity gaps, title strength, thumbnail effectiveness, storytelling structure, and watch-time optimization',
        keywords: [
          { pattern: /\b(thumbnail|video title|channel growth|watch time)\b/g, weight: 2.0 },
          { pattern: /\b(youtube|content creator)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'personal_brand',
        persona: 'a personal branding strategist who advises executives, founders, and industry leaders. You evaluate credibility, authority signals, positioning, audience perception, and long-term reputation building',
        keywords: [
          { pattern: /\b(personal brand|thought leadership|linkedin branding|professional image|authority building)\b/g, weight: 2.0 },
          { pattern: /\b(reputation|positioning|authority|credibility)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'social_media',
        persona: 'a senior public relations strategist and consumer psychology expert responsible for shaping public perception for major brands. You analyze messaging through the lens of attention, emotional response, virality, audience resonance, engagement, and reputation risk',
        keywords: [
          { pattern: /\b(instagram|tiktok|linkedin post|twitter|x post|facebook)\b/g, weight: 2.0 },
          { pattern: /\b(social media|virality|content creator)\b/g, weight: 1.0 },
          { pattern: /\b(engagement|viral)\b/g, weight: 0.5 }
        ]
      },
      {
        id: 'interview',
        persona: 'a senior interviewer responsible for hiring top talent in a highly competitive process. You evaluate answers for clarity, depth, problem-solving ability, communication skills, and evidence of real-world experience',
        keywords: [
          { pattern: /\b(behavioral question|mock interview|faang interview)\b/g, weight: 2.0 },
          { pattern: /\b(interview|technical interview)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'career_strategy',
        persona: 'a career strategist who has advised thousands of high-performing professionals. You focus on long-term career capital, skill leverage, compensation growth, opportunity cost, positioning, and strategic career decisions rather than short-term gains',
        keywords: [
          { pattern: /\b(promotion|career path|job switch|professional development)\b/g, weight: 2.0 },
          { pattern: /\b(career|career growth|career advice)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'ux_research',
        persona: 'a senior UX researcher responsible for understanding user behavior at scale. You analyze usability issues, cognitive friction, user motivations, accessibility concerns, and evidence-backed design improvements',
        keywords: [
          { pattern: /\b(usability test|customer interview|user journey)\b/g, weight: 2.0 },
          { pattern: /\b(user research|ux research|persona)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'research',
        persona: 'a journal peer reviewer evaluating research for publication in a top-tier scientific venue. You assess methodology, reproducibility, experimental design, statistical validity, literature coverage, novelty, and evidence strength. You separate robust conclusions from speculation',
        keywords: [
          { pattern: /\b(hypothesis|methodology|peer review)\b/g, weight: 2.0 },
          { pattern: /\b(research|experiment|literature review|citation|scientific)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'math_physics',
        persona: 'a 150+ IQ theoretical physicist and mathematical analyst reviewing derivations for correctness. You verify assumptions, identify hidden errors, validate proofs, explain intuition, and ensure every step follows rigorously from established principles',
        keywords: [
          { pattern: /\b(calculus|derivation|theorem|mechanics|quantum|thermodynamics)\b/g, weight: 2.0 },
          { pattern: /\b(mathematics|physics|equation|formula|algebra|geometry)\b/g, weight: 1.0 },
          { pattern: /\b(math)\b/g, weight: 0.5 }
        ]
      },
      {
        id: 'exam',
        persona: 'a chief board examiner responsible for setting the final examination paper. You have reviewed historical papers, syllabus weightage, marking schemes, examiner trends, and frequently tested concepts. Your objective is to predict which questions have the highest probability of appearing and identify areas students are most likely to be assessed on',
        keywords: [
          { pattern: /\b(board examiner|question bank|midterm|finals)\b/g, weight: 2.0 },
          { pattern: /\b(mcq|mcqs|quiz|quizzes|assessment)\b/g, weight: 1.0 },
          { pattern: /\b(exam|test)\b/g, weight: 0.5 }
        ]
      },
      {
        id: 'translation',
        persona: 'a professional literary translator and localization lead responsible for adapting content for native speakers across cultures. You preserve meaning, nuance, intent, tone, idiomatic expression, and cultural context while ensuring the result feels naturally written in the target language',
        keywords: [
          { pattern: /\b(translate|translation|translator|localize|localization)\b/g, weight: 2.0 },
          { pattern: /\b(multilingual|bilingual)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'government_policy',
        persona: 'a senior policy analyst advising decision-makers on public policy. You evaluate incentives, unintended consequences, implementation feasibility, stakeholder impact, and long-term systemic effects',
        keywords: [
          { pattern: /\b(public policy|government regulation|legislation|regulatory framework)\b/g, weight: 2.0 },
          { pattern: /\b(policy)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'community_management',
        persona: 'a community growth leader responsible for building highly engaged online communities. You focus on engagement loops, retention, moderation risks, social dynamics, incentive systems, and long-term community health',
        keywords: [
          { pattern: /\b(discord|reddit community|community building)\b/g, weight: 2.0 },
          { pattern: /\b(moderation|community manager|forum)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'medical',
        persona: 'a senior clinical consultant and physician responsible for patient safety in high-risk medical decisions. You evaluate symptoms, evidence quality, treatment risks, contraindications, differential diagnoses, and urgency indicators. You prioritize scientific accuracy, risk reduction, and patient wellbeing above all else',
        keywords: [
          { pattern: /\b(medicine|symptom|disease|diagnosis|clinical|therapy|medication)\b/g, weight: 2.0 },
          { pattern: /\b(health|medical|doctor|treatment)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'creative_writing',
        persona: 'a veteran fiction editor responsible for selecting manuscripts for publication. You analyze pacing, tension, emotional resonance, character development, dialogue authenticity, narrative structure, and reader engagement. You identify what keeps readers turning pages and what makes them stop',
        keywords: [
          { pattern: /\b(novel|screenplay|poetry)\b/g, weight: 2.0 },
          { pattern: /\b(story|fiction|script|character|plot|dialogue)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'design',
        persona: 'a senior UI/UX Design Specialist at Figma/Apple. Your task is to give honest and brutal feedback on what could be done for better appeal',
        keywords: [
          { pattern: /\b(figma|canva|wireframe|mockup|typography)\b/g, weight: 2.0 },
          { pattern: /\b(ui|ux|prototype|poster|banner|logo|frontend design|visual design)\b/g, weight: 1.0 },
          { pattern: /\b(design|layout)\b/g, weight: 0.5 }
        ]
      },
      {
        id: 'data_science',
        persona: 'a senior data scientist responsible for production analytics systems used to drive major business decisions. You evaluate data quality, statistical methodology, feature engineering quality, model selection rationale, evaluation metrics, bias risks, and production readiness. You ensure conclusions are reproducible, generalizable, and actionable',
        keywords: [
          { pattern: /\b(machine learning|ml|deep learning|tensorflow|pytorch)\b/g, weight: 2.0 },
          { pattern: /\b(dataset|analytics|statistics)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'prompt_engineering',
        persona: 'a senior AI systems architect responsible for designing prompts used by millions of users. You optimize for instruction clarity, reasoning quality, hallucination resistance, context efficiency, output consistency, and token economy. You aggressively remove ambiguity and failure modes',
        keywords: [
          { pattern: /\b(prompt engineering|llm prompt|ai prompt|system prompt|chatgpt prompt|claude prompt)\b/g, weight: 2.0 },
          { pattern: /\b(prompt)\b/g, weight: 0.3 }
        ]
      },
      {
        id: 'resume',
        persona: 'a senior hiring manager for the following job description [JOB_DESCRIPTION] who is skimming through 200 resumes under 10 minutes. Your task is to identify where you would lose interest in the resume',
        keywords: [
          { pattern: /\b(resume|cv|curriculum vitae|cover letter|recruiter|recruiting)\b/g, weight: 2.5 },
          { pattern: /\b(job application|linkedin profile)\b/g, weight: 1.0 },
          { pattern: /\b(hiring|candidate)\b/g, weight: 0.5 }
        ]
      },
      {
        id: 'coaching',
        persona: 'an executive communication coach advising leaders during high-stakes conversations. You optimize for persuasion, clarity, emotional intelligence, conflict resolution, negotiation leverage, and professional credibility while minimizing misunderstandings and unnecessary friction',
        keywords: [
          { pattern: /\b(salary|raise|negotiate|negotiation)\b/g, weight: 2.0 },
          { pattern: /\b(conflict|difficult conversation|executive coach)\b/g, weight: 1.0 },
          { pattern: /\b(communication|email|feedback|manager|leadership|presentation)\b/g, weight: 0.3 }
        ]
      },
      {
        id: 'legal',
        persona: 'a senior technology and corporate counsel reviewing agreements before execution. You identify legal exposure, compliance risks, liability traps, ambiguous language, jurisdiction concerns, intellectual property issues, and operational consequences that could create future disputes',
        keywords: [
          { pattern: /\b(contract|nda|indemnity|liability|clause)\b/g, weight: 2.0 },
          { pattern: /\b(legal|agreement|compliance|regulation|intellectual property)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'academic_editing',
        persona: 'a developmental editor and academic reviewer evaluating work for publication in a competitive journal. You scrutinize logical structure, argument strength, clarity, evidence quality, readability, and intellectual rigor. You remove unnecessary complexity and expose weak reasoning',
        keywords: [
          { pattern: /\b(dissertation|manuscript|proofread)\b/g, weight: 2.0 },
          { pattern: /\b(essay|paper|thesis|academic paper|grammar)\b/g, weight: 1.0 },
          { pattern: /\b(article|edit|rewrite)\b/g, weight: 0.3 }
        ]
      },
      {
        id: 'code',
        persona: 'a principal software architect conducting a production-readiness review before deployment to millions of users. You prioritize correctness, scalability, security, maintainability, performance, fault tolerance, database efficiency, and clean architecture. You identify weaknesses that would cause outages, technical debt, or operational failures',
        keywords: [
          { pattern: /\b(software engineer|software engineering|developer|programmer|software architect|web developer|frontend developer|backend developer|fullstack developer)\b/g, weight: 2.5 },
          { pattern: /\b(python|javascript|typescript|java|c#|go|rust|kubernetes|docker)\b/g, weight: 2.0 },
          { pattern: /\b(react|node|backend|frontend|api|database|sql|git|algorithm|coding)\b/g, weight: 1.0 },
          { pattern: /\b(code|debug|refactor)\b/g, weight: 0.3 }
        ]
      },
      {
        id: 'business',
        persona: 'a venture capitalist and startup operator evaluating opportunities for investment. You analyze market size, competitive advantages, execution risk, unit economics, product strategy, defensibility, growth potential, and long-term viability. You challenge assumptions and focus on realistic outcomes',
        keywords: [
          { pattern: /\b(business plan|valuation|equity|venture|fundraising)\b/g, weight: 2.0 },
          { pattern: /\b(startup|revenue|finance|investment|business model)\b/g, weight: 1.0 },
          { pattern: /\b(strategy|roadmap)\b/g, weight: 0.5 }
        ]
      },
      {
        id: 'marketing',
        persona: 'a direct-response marketing strategist responsible for campaigns spending millions of dollars in advertising budget. You judge copy solely by its ability to capture attention, generate desire, overcome objections, increase conversions, and drive measurable business outcomes',
        keywords: [
          { pattern: /\b(copywriting|funnel|conversion|newsletter|landing page|ad copy|headline)\b/g, weight: 2.0 },
          { pattern: /\b(marketing|campaign|growth|cta)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'critical_review',
        persona: 'a world-class reviewer whose sole objective is to identify weaknesses before they become expensive mistakes. You assume nothing is correct by default. You actively search for blind spots, hidden assumptions, logical inconsistencies, edge cases, overlooked risks, and opportunities for significant improvement',
        keywords: [
          { pattern: /\b(review|critique|audit|analyze|evaluate|feedback|improve|assessment)\b/g, weight: 0.1 }
        ]
      }
    ];

    let bestCatId = 'default';
    let maxScore = 0;

    categories.forEach(cat => {
      let score = 0;
      cat.keywords.forEach(kw => {
        const matches = t.match(kw.pattern);
        if (matches) {
          score += matches.length * kw.weight;
        }
      });
      if (score > maxScore) {
        maxScore = score;
        bestCatId = cat.id;
      }
    });

    const CATEGORY_TO_DOMAIN_MAP = {
      database_architecture: 'database',
      cybersecurity: 'code',
      system_design: 'code',
      rag_architecture: 'data_science',
      devops: 'code',
      cloud_architecture: 'code',
      api_design: 'code',
      data_engineering: 'data_science',
      qa_testing: 'code',
      open_source_review: 'code',
      mobile: 'code',
      financial_analysis: 'finance',
      trading: 'finance',
      pitch_deck: 'finance',
      venture_capital: 'finance',
      startup_founder: 'default',
      product_management: 'default',
      procurement: 'default',
      sales: 'marketing',
      seo: 'marketing',
      youtube_strategy: 'marketing',
      personal_brand: 'marketing',
      social_media: 'marketing',
      interview: 'default',
      career_strategy: 'default',
      ux_research: 'design',
      research: 'research',
      math_physics: 'research',
      exam: 'default',
      translation: 'writing',
      government_policy: 'default',
      community_management: 'default',
      medical: 'medical',
      creative_writing: 'writing',
      design: 'design',
      data_science: 'data_science',
      prompt_engineering: 'code',
      resume: 'resume',
      coaching: 'default',
      legal: 'legal',
      academic_editing: 'writing',
      code: 'code',
      business: 'default',
      marketing: 'marketing',
      critical_review: 'default'
    };

    return CATEGORY_TO_DOMAIN_MAP[bestCatId] || 'default';
  }

  function inferPersona(text) {
    const intent = detectIntent(text);
    const domain = detectDomain(text);

    // Matrix: domain -> intent -> persona string
    const PERSONA_MATRIX = {
      code: {
        diagnose:   'a senior software engineer debugging a critical production outage with 10,000 active users experiencing 500 errors. You need to inspect logs, trace stack traces, isolate the exact line causing the crash, and write a hotfix immediately without generic advice',
        generate:   'a principal software architect drafting a core microservice handling 50,000 requests per second. You write highly optimized, clean, and production-ready code, implementing robust error handling, memory safety, and documentation that must pass senior reviews',
        evaluate:   'a staff engineer conducting a high-stakes code review for a system-critical pull request before deployment. You inspect for subtle race conditions, memory leaks, performance bottlenecks, and architectural violations, calling out issues directly to ensure zero downtime',
        explain:    'a senior engineer mentoring junior developers under tight sprint deadlines. You explain complex architectural patterns using a real-world production analogy, writing a minimal working snippet to ensure they grasp the system model correctly',
        decide:     'a staff systems architect choosing technology stack options for a new multi-million dollar platform. You analyze trade-offs under scale, maintenance cost, and developer experience, avoiding theoretical hype to recommend the pragmatically superior choice',
        transform:  'a senior software engineer refactoring a messy, legacy codebase that slows down the whole team. You simplify complex structures, eliminate technical debt, and ensure 100% backward compatibility and test coverage',
      },
      database: {
        diagnose:   'a principal database administrator resolving a live database lockup on a black Friday sale with query latencies spiking to 10 seconds. You analyze execution plans, active locks, and index usage to identify and kill the bottleneck query immediately',
        generate:   'a lead database architect designing the schema for a high-throughput transaction system processing millions of rows. You define optimal data types, normalization levels, indexes, and constraints to guarantee data integrity and scale',
        evaluate:   'a senior database developer conducting a performance review on a pull request containing slow queries. You check for N+1 queries, table scans, missing indexes, and transaction deadlocks, providing direct optimization feedback',
        explain:    'a veteran database instructor teaching query optimization using production query planners. You explain how the engine executes operations under the hood, showing the differences in execution cost with concrete examples',
        decide:     'a chief database architect deciding between SQL, NoSQL, or vector databases for a new high-scale analytics pipeline. You evaluate storage costs, write speeds, query complexity, and schema flexibility to make the definitive call',
        transform:  'a database engineer migrating a legacy database schema to a modern architecture. You optimize tables, rewrite queries for performance, and ensure zero data loss or migration downtime',
      },
      design: {
        diagnose:   'a lead UX designer resolving a high checkout drop-off rate of 40% on a mobile app. You analyze user session recordings and heatmaps to pinpoint exact points of cognitive friction, layout misalignment, or broken interaction states',
        generate:   'a senior UI/UX specialist at Figma designing a premium dashboard interface. You apply a precise design system with cohesive spacing tokens, typography hierarchy, accessible colors, and responsive grids that feel incredibly polished',
        evaluate:   'a brutal creative director reviewing a designer\'s portfolio before client presentation. You give raw, unglazed feedback on visual hierarchy, contrast, typography choice, and whether the core message instantly captures attention',
        explain:    'a senior design mentor teaching interface principles to junior designers. You explain concepts like visual weight, alignment, and spacing using real-world app examples, showing before-and-after designs',
        decide:     'a principal product designer deciding between navigation paradigms for an enterprise dashboard. You weigh user testing metrics, accessibility guidelines, and developmental feasibility to choose the optimal user flow',
        transform:  'a senior designer redesigning an outdated interface. You update it to modern aesthetics (sleek dark mode, harmonious gradients, micro-interactions) while simplifying the visual hierarchy for maximum usability',
      },
      resume: {
        diagnose:   'a senior recruiter scanning 200 resumes in a span of 10 minutes for a highly competitive role. You frame the resume against strict hiring criteria, calling out exactly where the candidate lacks focus, fails to quantify results, or loses your interest',
        generate:   'a professional resume writer crafting a CV for a candidate targeting competitive roles. You frame experience using the STAR method, highlighting quantified achievements and keywords to pass ATS filters and stand out to hiring managers',
        evaluate:   'a senior hiring manager scanning 200 resumes in a span of 10 minutes. You look for measurable impact, clear career trajectory, and keyword alignment, and you pinpoint the exact moment you lose interest and reject the candidate',
        explain:    'a career placement advisor explaining resume strategy to job seekers. You analyze sample CV lines to show how to transform generic task lists into high-impact, results-oriented bullet points',
        decide:     'a recruiting consultant advising on CV layout choices. You analyze which format, structure, and length will showcase the candidate\'s strengths most effectively for their target role',
        transform:  'a professional resume editor polishing a draft for maximum impact. You cut fluff, replace passive verbs with active ones, and reformat bullet points to make achievements stand out instantly',
      },
      marketing: {
        diagnose:   'a growth marketing lead troubleshooting a paid ad campaign that spent $5,000 with zero conversions. You analyze click-through rates, landing page load times, and message match to identify where users drop off',
        generate:   'a direct-response copywriter drafting a landing page for a high-ticket product launch. You write a hook, compelling benefits, social proof, and a clear call-to-action that maximizes conversion rate',
        evaluate:   'a senior marketing director reviewing a copy draft. You give brutal, honest feedback on whether the headline stops the scroll, whether the tone resonates with the target audience, and if the CTA is weak',
        explain:    'a marketing strategist explaining campaign frameworks to a client. You use real-world campaign metrics and case studies to explain target positioning and conversion optimization',
        decide:     'a performance marketer deciding the budget allocation across TikTok, Meta, and Google ads. You evaluate customer acquisition cost, return on ad spend, and audience saturation to optimize the budget',
        transform:  'a copy editor rewriting a sales email sequence. You shorten the text, inject urgency, and refine the subject lines to boost open rates and click-through rates',
      },
      writing: {
        diagnose:   'a senior editor diagnosing why a novel draft feels slow and boring in chapter three. You analyze narrative pacing, character motivation, and scene tension to pinpoint where readers lose interest',
        generate:   'a professional author writing a clean, high-impact article for a major publication. You write concise, active, and persuasive prose that hook the reader from the first line without filler',
        evaluate:   'a developmental editor reviewing a manuscript. You provide direct critique on structural flow, argument strength, word choice, and readability, pruning unnecessary padding',
        explain:    'a writing coach explaining narrative structure to students. You break down complex storytelling techniques using classic literature examples, showing how to build tension and hooks',
        decide:     'a chief editor choosing the formatting and tone for a corporate report. You weigh reader expectations, brand voice, and messaging goals to set the definitive style guide',
        transform:  'a professional editor rewriting a draft for clarity and conciseness. You remove passive voice, simplify complex sentences, and ensure the core message is immediately clear',
      },
      finance: {
        diagnose:   'a CFO investigating a sudden 15% drop in net profit margin. You analyze balance sheets, cash flows, and departmental budgets to pinpoint the exact source of unexpected overhead',
        generate:   'a senior financial analyst building a valuation model for a major acquisition. You construct robust projection scenarios, discounting cash flows and outlining risk factors for executive review',
        evaluate:   'a venture capitalist auditing a startup\'s financial projections. You verify growth assumptions, burn rates, customer lifetime value, and unit economics to identify unrealistic forecasts',
        explain:    'a finance professor explaining complex derivative structures. You use real-world market events and numerical examples to make the math and risk profiles intuitive',
        decide:     'a corporate finance director recommending capital allocation between R&D and debt repayment. You weigh return on investment, cost of capital, and market risk to make the recommendation',
        transform:  'a financial analyst restructuring an investor report. You clean up complex jargon, organize tables logically, and highlight key metrics to make the financial state clear to stakeholders',
      },
      legal: {
        diagnose:   'a corporate attorney identifying a loophole in an NDA that could expose proprietary source code. You identify the ambiguous clause, explain the potential exposure, and rewrite it for absolute protection',
        generate:   'a technology counsel drafting a master services agreement for an enterprise client. You write precise, enforceable terms covering liability, intellectual property, and service level agreements',
        evaluate:   'a partner reviewing a contract markup. You highlight hidden liabilities, unfavorable indemnity clauses, and compliance risks, warning of the business consequences',
        explain:    'a legal counsel explaining contract terms to a non-legal team. You translate complex legalese into clear, actionable business guidelines while retaining absolute precision',
        decide:     'a lead counsel advising a client on whether to settle a dispute or go to trial. You analyze precedents, legal costs, success probabilities, and reputational risk to recommend the best path',
        transform:  'a contracts lawyer redrafting an agreement for clarity, precision, and enforceability. You remove archaic legalese, clarify definitions, and simplify structure without losing legal meaning',
      },
      medical: {
        diagnose:   'a senior consultant physician evaluating a complex case of a patient with overlapping symptoms. You systematically analyze history, check for drug interactions, construct a differential diagnosis, and identify the safest treatment',
        generate:   'a clinical specialist drafting patient safety protocols for an emergency department. You write clear, evidence-based guidelines that prioritize rapid triage, diagnostic accuracy, and risk reduction',
        evaluate:   'a medical journal peer reviewer evaluating a research submission. You scrutinize the methodology, control groups, and statistical validity to ensure conclusions are backed by solid evidence',
        explain:    'a physician explaining a complex diagnosis to a patient. You use simple analogies, clarify treatment options, and honestly discuss risks and prognosis without medical jargon',
        decide:     'a chief medical officer deciding on hospital equipment procurement. You weigh clinical outcomes, cost, safety records, and training requirements to recommend the best option',
        transform:  'a medical editor translating a research paper into a patient-facing brochure. You simplify language for readability while ensuring clinical accuracy is perfectly preserved',
      },
      data_science: {
        diagnose:   'a senior data scientist debugging a machine learning model whose accuracy dropped from 92% to 65% in production. You check for data drift, feature engineering bugs, and target leakage to find the cause',
        generate:   'a principal data scientist building a production recommendation model. You write clean, modular training pipelines, define appropriate validation splits, and select metrics that align with business KPIs',
        evaluate:   'a staff data scientist reviewing an experimental design. You inspect statistical significance, sample size, feature selection bias, and model assumptions to identify flaws in the analysis',
        explain:    'a data science lead explaining neural network layers to stakeholders. You use visual models and business metrics to explain how the algorithm makes decisions, avoiding abstract jargon',
        decide:     'a chief data officer choosing between model architectures for a real-time system. You weigh inference latency, accuracy requirements, training costs, and deployment complexity',
        transform:  'a data scientist refactoring an experimental Jupyter notebook into production-ready python scripts. You modularize code, add logging, and optimize query calls for data retrieval',
      },
      research: {
        diagnose:   'a principal investigator identifying why a laboratory experiment is failing to replicate. You systematically audit the variables, sample purity, calibration logs, and environment data to find the root cause',
        generate:   'a senior researcher writing a grant proposal for a major study. You formulate a precise hypothesis, detail a robust methodology, and justify the research significance for peer review',
        evaluate:   'a journal reviewer assessing a manuscript. You evaluate experimental design, data analysis, literature context, and whether the findings support the claims, highlighting any logical leaps',
        explain:    'a research scientist explaining findings to a funding committee. You summarize complex methodology and outcomes, highlighting the societal and economic impact clearly and concisely',
        decide:     'a senior scientist choosing the methodology for a clinical study. You weigh ethical considerations, sample sizes, cost, and statistical power to choose the most rigorous design',
        transform:  'a science writer editing a draft for a top-tier journal. You structure the argument logically, refine the abstract, and ensure the text is concise and fully compliant with academic standards',
      },
      default: {
        diagnose:   'a critical expert diagnosing a difficult problem under time pressure. You ask sharp questions, cut through irrelevant details, and pinpoint the root cause of the issue immediately',
        generate:   'a top-tier professional producing high-quality work. You deliver a comprehensive, polished, and structured solution that is immediately ready for use',
        evaluate:   'a senior advisor providing honest, actionable feedback. You highlight weaknesses, call out lazy assumptions, and suggest concrete steps for improvement without sugarcoating',
        explain:    'a master educator explaining a complex topic. You break it down from first principles using real-world examples and clear analogies, checking for understanding',
        decide:     'a seasoned strategist making a critical decision. You weigh options, state trade-offs, and make a definitive, evidence-backed recommendation instead of giving a generic list',
        transform:  'a skilled professional refactoring content for a specific audience. You improve structure, clarify messaging, and justify every change you make',
      },
    };

    const domainMap = PERSONA_MATRIX[domain] || PERSONA_MATRIX['default'];
    return domainMap[intent] || domainMap['generate'];
  }

  function cavemanCompress(text) {
    // Preserve code blocks
    const codeBlocks = [];
    let safeText = text.replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });
    // Also preserve inline code
    safeText = safeText.replace(/`[^`]+`/g, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // Process sentence by sentence (split on . ! ? and line breaks)
    const sentenceBreaks = /([.!?]+(?:\s+|$)+|\n+)/;
    const rawParts = safeText.split(sentenceBreaks);

    const compressed = rawParts.map(part => {
      if (/^([.!?\s]+)$/.test(part)) return '';

      let s = part.trim();
      if (!s) return '';

      // Strip trailing punctuation from the sentence part
      s = s.replace(/[.!?]+$/, '');

      // 1. Strip leading filler clauses
      s = s.replace(/^(I just think that|I feel like|I believe that|The thing is,?\s*|Honestly,?\s*|To be honest,?\s*|I was thinking (that\s*)?(maybe\s*)?(we could\s*)?|I was hoping (you could\s*)?|I was wondering if you could\s*|If it's not too much trouble,?\s*)/i, '');

      // 2. Strip filler openers
      s = s.replace(/^(Could you (please\s*)?|Can you (please\s*)?|Would you (mind\s*)?(please\s*)?|Please\s+|I would like you to\s*|I need you to\s*|I want you to\s*)/i, '');

      // 3. Strip progressive self-reference before a verb
      s = s.replace(/^I('m| am) (going to|trying to|hoping to|looking to|planning to|attempting to)\s*/i, '');
      s = s.replace(/^I (want|need|would like) to\s*/i, '');

      // 4. Strip meta-instructions to self
      s = s.replace(/\b(do the work|be thorough|take your time|make sure to|don't forget to|remember to)\s*/gi, '');

      // 5. Strip phrase "figure out"
      s = s.replace(/\bfigure out\b/gi, '');

      // 6. Replace verb/intent phrases
      s = s.replace(/\b(help me understand the concept of|help me understand|give me a brief explanation of how|explain the concept of)\b/gi, 'explain');

      // 7. Stem/replace verbs and nouns
      s = s.replace(/\btakes\b/gi, 'take');
      s = s.replace(/\breturns\b/gi, 'return');
      s = s.replace(/\breturning\b/gi, 'return');
      s = s.replace(/\bponies\b/gi, 'pony');

      // 8. Strip hedge adverbs anywhere in sentence
      s = s.replace(/\b(just|really|very|quite|rather|somewhat|actually|truly|certainly|honestly|basically|essentially|literally|generally speaking|sort of|kind of|more or less|in a way|to some extent|concise|brief)\b\s*/gi, '');

      // 9. Strip verbose prepositional connectors
      s = s.replace(/\bin the form of\b/gi, '');
      s = s.replace(/\bin order to\b/gi, 'to');
      s = s.replace(/\bfor the purpose of\b/gi, 'for');
      s = s.replace(/\bwith the goal of\b/gi, 'to');
      s = s.replace(/\bas a means of\b/gi, 'to');
      s = s.replace(/\bwith respect to\b/gi, 're:');
      s = s.replace(/\bin terms of\b/gi, '');
      s = s.replace(/\bon the basis of\b/gi, 'based on');
      s = s.replace(/\bdue to the fact that\b/gi, 'because');
      s = s.replace(/\bat this point in time\b/gi, 'now');
      s = s.replace(/\bin the event that\b/gi, 'if');

      // 10. Strip articles (preserving proper nouns)
      s = s.replace(/\b(a|an|the)\s+(?=[a-z0-9])/gi, (match, article, offset, str) => {
        const nextChar = str[offset + match.length];
        if (nextChar && nextChar === nextChar.toUpperCase() && nextChar !== nextChar.toLowerCase()) {
          return match;
        }
        return '';
      });

      // 11. Strip determiners/pronouns/auxiliary verbs/prepositions
      s = s.replace(/\b(this|that|these|those|my|your|our|his|her|their|its|and|of|all|in|to|is|are|was|were|be|me|i|you|we|us|he|him|she|they|them)\b/gi, '');

      // 12. Strip redundant final verb words
      s = s.replace(/\b(work|works)\b\s*$/i, '');

      // 13. Normalize multiple spaces
      s = s.replace(/\s+/g, ' ').trim();

      // 14. Capitalise all words
      if (s.length > 0) {
        s = s.split(/\s+/).map(word => {
          if (word.startsWith('__CODE_BLOCK_')) return word;
          return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');
      }

      return s;
    });

    let resultText = compressed
      .filter(p => p.length > 0)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Reinsert code blocks
    resultText = resultText.replace(/__CODE_BLOCK_(\d+)__/g, (_, i) => codeBlocks[parseInt(i)]);

    return resultText;
  }

  function extractConstraints(text) {
    const constraints = [];
    const t = text.toLowerCase();
    const lineMatch = text.match(/\bunder\s+(\d+)\s+lines\b/i);
    if (lineMatch) constraints.push(`Output must be under ${lineMatch[1]} lines.`);
    const versionMatch = text.match(/\b(python\s*3\.\d+|node\s*\d+|react\s*\d+)/i);
    if (versionMatch) constraints.push(`Use ${versionMatch[1]}.`);
    if (t.includes('no external libraries') || t.includes('without external libraries') || t.includes('no third party')) {
      constraints.push('No external libraries or dependencies.');
    }
    if (t.includes('no comments') || t.includes('without comments')) {
      constraints.push('Do not write code comments.');
    }
    return constraints;
  }

  function detectFormat(text) {
    const t = text.toLowerCase();

    // Check if the user is explicitly asking to write/generate code or scripts
    const isCodingTask = /\b(write|create|implement|generate|provide|show)\b.*\b(code|script|function|program|class|method)\b/i.test(t) ||
      /\b(code|script|function|program)\b.*\b(to|that|for|implement)\b/i.test(t) ||
      /\b(python|javascript|cpp|rust|java|go|html|css|c#)\s+(code|script|function|program)\b/i.test(t) ||
      /\b(snippet|boilerplate)\b/i.test(t);

    if (isCodingTask) { return 'code block with inline comments'; }
    if (t.match(/\b(list|bullet|points|steps|bullets|sequence)\b/)) { return 'bulleted list'; }
    if (t.match(/\b(table|csv|grid|matrix)\b/)) { return 'markdown table'; }
    return 'concise paragraphs';
  }

  function isCodeLine(line, prevIsCode, nextIsCode) {
    const trimmed = line.trim();
    if (!trimmed) {
      return prevIsCode && nextIsCode;
    }

    if (/^(#+\s+|[*\-+\d\.]+\s+)/.test(trimmed)) {
      if (/^#\s*(Example|Add|Compute|Verify|Check|Test|Debug|Fix|Bug|Initialize|Set|Run|Execute|Call)\b/i.test(trimmed)) {
        return true;
      }
      if (!/^\/\//.test(trimmed)) {
        return false;
      }
    }

    const codeKeywords = /^(def|class|import|from|const|let|var|function|return|print|assert|raise|try|except|finally|elif|if|for|while|else|package|public|private|protected|static|void|async|await)\b/;
    if (codeKeywords.test(trimmed)) return true;

    if (/[;{}]/.test(trimmed)) return true;
    if (/^[\w$.]+\s*=\s*/.test(trimmed)) return true;
    if (/\b(===|!==|==|!=|>=|<=|\+=|-=|\*=|\/=|&&|\|\||=>)\b/.test(trimmed)) return true;
    if (/\b(console\.log|print|printf|System\.out\.print)\(/.test(trimmed)) return true;
    if (/^[a-zA-Z_]\w*\([^)]*\)\s*[:{]?$/.test(trimmed)) return true;

    if (/^(\t|\s{2,})/.test(line)) {
      if (/[()\[\]=+\-*\/%&|^<>;:]/.test(trimmed) || prevIsCode || nextIsCode) {
        return true;
      }
    }

    if (/^(\/\/|#)/.test(trimmed)) {
      if (prevIsCode || nextIsCode) return true;
    }

    return false;
  }

  function preserveCodeBlocksAndRawCode(text) {
    const codeBlocks = [];

    // 1. First, preserve backtick code blocks
    let processedText = text.replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match);
      return `__ESKAY_PRESERVED_BLOCK_${codeBlocks.length - 1}__`;
    });
    processedText = processedText.replace(/`[^`\n]+`/g, (match) => {
      codeBlocks.push(match);
      return `__ESKAY_PRESERVED_BLOCK_${codeBlocks.length - 1}__`;
    });

    // 2. Parse remaining text line-by-line to identify raw code blocks
    const lines = processedText.split('\n');
    const isCode = new Array(lines.length).fill(false);

    // First pass: identify obvious code lines
    for (let i = 0; i < lines.length; i++) {
      isCode[i] = isCodeLine(lines[i], i > 0 ? isCode[i - 1] : false, false);
    }
    // Second pass: backwards to resolve lookahead dependencies
    for (let i = lines.length - 1; i >= 0; i--) {
      isCode[i] = isCodeLine(lines[i], i > 0 ? isCode[i - 1] : false, i < lines.length - 1 ? isCode[i + 1] : false);
    }

    // Group contiguous code lines
    const newLines = [];
    let currentBlock = [];

    for (let i = 0; i < lines.length; i++) {
      if (isCode[i]) {
        currentBlock.push(lines[i]);
      } else {
        if (currentBlock.length > 0) {
          codeBlocks.push(currentBlock.join('\n'));
          newLines.push(`__ESKAY_PRESERVED_BLOCK_${codeBlocks.length - 1}__`);
          currentBlock = [];
        }
        newLines.push(lines[i]);
      }
    }
    if (currentBlock.length > 0) {
      codeBlocks.push(currentBlock.join('\n'));
      newLines.push(`__ESKAY_PRESERVED_BLOCK_${codeBlocks.length - 1}__`);
    }

    return {
      text: newLines.join('\n'),
      codeBlocks
    };
  }

  function restoreCodeBlocksAndRawCode(text, codeBlocks) {
    let result = text;
    for (let i = codeBlocks.length - 1; i >= 0; i--) {
      result = result.replace(`__ESKAY_PRESERVED_BLOCK_${i}__`, codeBlocks[i]);
    }
    return result;
  }

  const EskayOptimizer = {
    preserveCodeBlocksAndRawCode(text) {
      return preserveCodeBlocksAndRawCode(text);
    },
    restoreCodeBlocksAndRawCode(text, codeBlocks) {
      return restoreCodeBlocksAndRawCode(text, codeBlocks);
    },
    detectIntent(text) {
      return detectIntent(text);
    },
    detectDomain(text) {
      return detectDomain(text);
    },
    sanitize(text) {
      if (!text) return '';
      
      let lines = text.split('\n');
      
      // 1. Remove Persona from the beginning if it starts with "You are "
      let firstNonEmptyIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim()) {
          firstNonEmptyIdx = i;
          break;
        }
      }
      if (firstNonEmptyIdx !== -1 && /^You are\b/i.test(lines[firstNonEmptyIdx].trim())) {
        lines.splice(firstNonEmptyIdx, 1);
      }

      // 2. Remove trailing options from the end bottom-up
      const patterns = [
        /^Format:\s*.+/i,
        /^Think (through this )?step by step( before answering)?\./i,
        /^Show one minimal working example\./i,
        /^If anything is unclear, ask me before answering\./i,
        /^Tell me if you need more context to answer well\./i,
        /^Provide a brutal, honest, and completely unglazed critique\./i,
        /^\[SAMPLE_INPUT\]\s*(?:→|->)\s*\[SAMPLE_OUTPUT\]/i,
        /^\[SAMPLE_INPUT_\d\]\s*(?:→|->)\s*\[SAMPLE_OUTPUT_\d\]/i,
        /^Constraints:\s*$/i,
        /^\-\s+.+/ // Bullet points under Constraints
      ];

      let inConstraintsBlock = false;
      let cleanedLines = [];
      
      for (let i = lines.length - 1; i >= 0; i--) {
        const trimmed = lines[i].trim();
        if (!trimmed) {
          cleanedLines.unshift(lines[i]);
          continue;
        }

        if (/^\-\s+/.test(trimmed)) {
          let hasConstraintsHeaderAbove = false;
          for (let j = i - 1; j >= 0; j--) {
            if (lines[j].trim() === 'Constraints:') {
              hasConstraintsHeaderAbove = true;
              break;
            }
            if (lines[j].trim() && !/^\-\s+/.test(lines[j].trim())) {
              break;
            }
          }
          if (hasConstraintsHeaderAbove) {
            inConstraintsBlock = true;
            continue;
          }
        }

        if (trimmed === 'Constraints:' && inConstraintsBlock) {
          inConstraintsBlock = false;
          continue;
        }

        let matched = false;
        for (const pattern of patterns) {
          if (pattern.test(trimmed)) {
            matched = true;
            break;
          }
        }

        if (matched) {
          continue;
        }

        cleanedLines.unshift(lines[i]);
      }

      let cleanedText = cleanedLines.join('\n');
      return cleanedText.trim();
    },

    detectPromptFeatures(text) {
      const t = text;

      // Count occurrences of sample inputs, arrows, and input/output labels
      const sampleInputsCount = (t.match(/\[SAMPLE_INPUT/g) || []).length;
      const arrowCount = (t.match(/(?:->|→)/g) || []).length;
      const ioPairCount = (t.match(/(?:input|q|question|prompt)[:：]\s*.+(?:\n|\s)+(?:output|a|answer|response)[:：]/gi) || []).length;

      const hasMultishot = sampleInputsCount >= 3 || arrowCount >= 3 || ioPairCount >= 3;
      const hasOneshot = !hasMultishot && (
        /\[SAMPLE_INPUT\]/.test(t) ||
        /example[:：]\s*\n?\s*(input|question|prompt)/i.test(t) ||
        /(?:input|q|question|prompt)[:：]\s*.+(?:\n|\s)+(?:output|a|answer|response)[:：]/i.test(t) ||
        /(?:^|\n)[^\n]+(?:->|→)[^\n]+/.test(t)
      );

      return {
        oneshot:  hasOneshot,
        multishot: hasMultishot,
        step:     /step[- ]by[- ]step|think through|let's break|numbered steps/i.test(t),
        persona:  /^\s*(you are|think of yourself as|act as|imagine you are|assume the role of|as a\s)/im.test(t),
        clarify:  /if anything is unclear|ask me before|if you('re| are) unsure/i.test(t),
        format:   /^\s*format[:：]/im.test(t) || /respond in|output as|structure (your|the) (response|answer) as/i.test(t),
        context:  /tell me if you need more context|if you need (more |additional )?context/i.test(t),
        brutal:   /brutal, honest, and completely unglazed critique/i.test(t),
      };
    },

    applySubOptions(text, subOptions, mode) {
      let result = text;
      if (subOptions) {
        // 1. Ask for Clarification
        if (subOptions.clarify && !result.includes('If anything is unclear, ask me before answering.')) {
          result += '\nIf anything is unclear, ask me before answering.';
        }

        // 2. Step-by-step thinking (Explicitly requested via checkbox)
        if (subOptions.step && !result.includes('Think through this step by step') && !result.includes('Think step by step')) {
          result += '\nThink through this step by step.';
        }

        // 3. Set Persona (Explicitly requested, only if not already appended by Maximize mode)
        if (subOptions.persona && mode !== 'maximize') {
          const persona = inferPersona(result);
          const hasExistingPersona = result.match(/you are (an|a)?\s*(expert|professional|specialist|assistant)/i);
          if (!hasExistingPersona) {
            result = `You are ${persona}.\n\n` + result;
          }
        }

        // 4. One-shot example
        if (subOptions.oneshot && !result.includes('[SAMPLE_INPUT]')) {
          result += '\n\n[SAMPLE_INPUT] -> [SAMPLE_OUTPUT]';
        }

        // 5. Multi-shot examples
        if (subOptions.multishot && !result.includes('[SAMPLE_INPUT_1]')) {
          result += '\n\n[SAMPLE_INPUT_1] -> [SAMPLE_OUTPUT_1]\n[SAMPLE_INPUT_2] -> [SAMPLE_OUTPUT_2]\n[SAMPLE_INPUT_3] -> [SAMPLE_OUTPUT_3]';
        }

        // 6. Specify output format (Explicitly requested, only if not already added by Maximize mode)
        if (subOptions.format && mode !== 'maximize') {
          const format = detectFormat(result);
          result += `\nFormat: ${format}`;
        }

        // 7. Request context
        if (subOptions.context && !result.includes('Tell me if you need more context to answer well.')) {
          result += '\nTell me if you need more context to answer well.';
        }

        // 8. Brutal Critique Mode
        if (subOptions.brutal && !result.includes('Provide a brutal, honest, and completely unglazed critique.')) {
          result += '\nProvide a brutal, honest, and completely unglazed critique. Do not sugarcoat, soften, or glaze any observations. The sole purpose of this feedback is improvement, so direct, raw, and brutally honest critique is extremely critical.';
        }
      }
      return result;
    },

    optimize(text, mode, subOptions) {
      if (!text || !text.trim()) return '';

      const { text: preservedText, codeBlocks } = preserveCodeBlocksAndRawCode(text);
      let result = preservedText;

      result = this.sanitize(result);

      // --- MODE 1: MINIMIZE TOKENS ---
      if (mode === 'minimize') {
        // Apply regex rules sequentially
        MINIMIZE_RULES.forEach(rule => {
          result = result.replace(rule.pattern, rule.replacement);
        });

        // Deduplicate redundant sentences
        result = deduplicateSentences(result);

        // apply caveman compression pass
        result = cavemanCompress(result);
      }

      // --- MODE 2: MAX EFFICIENCY ---
      if (mode === 'maximize') {
        const persona = inferPersona(result);
        const format = detectFormat(result);
        const constraints = extractConstraints(result);
        let prefix = '';
        let suffix = '';

        const hasExistingPersona = result.match(/you are (an|a)?\s*(expert|professional|specialist|assistant)/i);
        if (!hasExistingPersona && (!subOptions || subOptions.persona !== false)) {
          prefix += `You are ${persona}.\n\n`;
        }

        let coreTask = result.trim().replace(/^(could you please|please|can you|would you mind|kindly)\s+/i, '');
        result = `${prefix}${coreTask}`;

        if (constraints.length > 0) { suffix += `\n\nConstraints:\n` + constraints.map(c => `- ${c}`).join('\n'); }
        if (!subOptions || subOptions.format !== false) { suffix += `\n\nFormat: ${format}`; }

        const isComplex = result.match(/\b(why|how|compare|decide|analyze|reason|complex|architect|explain)\b/i);
        if (isComplex && (!subOptions || subOptions.step !== false)) { suffix += `\nThink step by step before answering.`; }
        if (persona.includes('software architect') || persona.includes('software engineer') || persona.includes('developer') || persona.includes('backend') || persona.includes('fullstack')) { suffix += `\nShow one minimal working example.`; }
        result = result + suffix;
      }

      if (subOptions) {
        result = this.applySubOptions(result, subOptions, mode);
      }

      // Normalize multiple consecutive blank lines for the final prompt (max 2 newlines, i.e. 1 blank line)
      result = result.replace(/\n{3,}/g, '\n\n');
      result = result.trim();

      // Restore code blocks verbatim
      result = restoreCodeBlocksAndRawCode(result, codeBlocks);

      return result.trim();
    }
  };

  // --- 5. Context Exporter ---
  let activeConversationData = null;

  function parseConversationFromTree(conversation) {
    const messages = Array.isArray(conversation?.chat_messages) ? conversation.chat_messages : [];
    const byId = new Map();
    for (const msg of messages) {
      if (msg?.uuid) byId.set(msg.uuid, msg);
    }
    const leaf = conversation?.current_leaf_message_uuid;
    if (!leaf) return null;

    const trunk = [];
    let currentId = leaf;
    while (currentId && currentId !== ROOT_MESSAGE_ID) {
      const msg = byId.get(currentId);
      if (!msg) break;
      trunk.push(msg);
      currentId = msg.parent_message_uuid;
    }
    trunk.reverse();

    return trunk.map(msg => {
      const role = msg.sender === 'human' ? 'User' : 'Assistant';
      let textParts = [];
      const content = Array.isArray(msg.content) ? msg.content : [];
      content.forEach(item => {
        if (item.type === 'text' && typeof item.text === 'string') { textParts.push(item.text); }
        else if (item.type === 'tool_use') { textParts.push(`[Tool Use: ${item.name} with input ${JSON.stringify(item.input)}]`); }
        else if (item.type === 'tool_result') { textParts.push(`[Tool Result for ${item.tool_use_id}: ${typeof item.content === 'string' ? item.content : JSON.stringify(item.content)}]`); }
      });

      const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
      const attachmentNames = [];
      attachments.forEach(a => {
        const name = a.file_name || a.name || 'Attachment';
        attachmentNames.push(name);
        if (a.extracted_content) { textParts.push(`[Attached File: ${name}]\n${a.extracted_content}`); }
      });
      const combinedText = textParts.join('\n\n');

      const codeBlocks = [];
      const codeRegex = /```([a-zA-Z0-9+#-]+)?\n([\s\S]*?)```/g;
      let match;
      while ((match = codeRegex.exec(combinedText)) !== null) {
        codeBlocks.push({ lang: (match[1] || 'text').trim().toLowerCase(), code: match[2] });
      }

      return { role, text: combinedText, codeBlocks, attachments: attachmentNames };
    });
  }

  function scrapeConversationFromDOM() {
    const elements = document.querySelectorAll('[data-testid="user-message"], [data-testid="assistant-message"], .font-user, .font-claude');
    const messages = [];
    elements.forEach((el) => {
      let role = 'User';
      if (el.matches('[data-testid="assistant-message"]') || el.classList.contains('font-claude')) { role = 'Assistant'; }
      else if (el.closest('[data-testid="assistant-message"]') || el.closest('.font-claude')) { role = 'Assistant'; }
      let isNested = false;
      for (const m of messages) { if (m.element.contains(el)) { isNested = true; break; } }
      if (isNested) return;

      const text = (el.innerText || el.textContent || '').trim();
      if (!text) return;

      const codeBlocks = [];
      const preTags = el.querySelectorAll('pre');
      preTags.forEach(pre => {
        const codeTag = pre.querySelector('code');
        const codeText = codeTag ? codeTag.innerText : pre.innerText;
        let lang = 'text';
        if (codeTag) {
          const langClass = Array.from(codeTag.classList).find(c => c.startsWith('language-') || c.startsWith('lang-'));
          if (langClass) { lang = langClass.replace(/^(language-|lang-)/, ''); }
        }
        if (codeText.trim()) { codeBlocks.push({ lang: lang.toLowerCase(), code: codeText }); }
      });

      const attachments = [];
      const attachEls = el.querySelectorAll('.attachment-name, [data-testid*="attachment"], .attachment, .file-name');
      attachEls.forEach(att => {
        const name = (att.innerText || att.textContent || '').trim();
        if (name && !attachments.includes(name)) { attachments.push(name); }
      });

      messages.push({ role, text, codeBlocks, attachments, element: el });
    });
    return messages;
  }

  function extractKeySentences(text, keywords) {
    if (!text) return [];
    const sentences = text.split(/(?<=[.?!])\s+/);
    const matches = [];
    sentences.forEach(s => {
      const lower = s.toLowerCase();
      const hasKeyword = keywords.some(k => lower.includes(k));
      if (hasKeyword && s.trim().length > 10 && s.trim().length < 250) { matches.push(s.trim()); }
    });
    return matches;
  }

  const EskayExporter = {
    setActiveConversationData(data) { activeConversationData = data; },
    getActiveConversationData() { return activeConversationData; },
    exportContext() {
      const match = window.location.pathname.match(/\/chat\/([^/?]+)/);
      if (!match) {
        EskayUI.showToast("No active conversation found to retrieve context from.");
        return;
      }

      let messages = null;
      let usedTree = false;
      if (activeConversationData) {
        try {
          messages = parseConversationFromTree(activeConversationData);
          if (messages && messages.length > 0) { usedTree = true; }
        } catch (e) { }
      }
      if (!usedTree) { messages = scrapeConversationFromDOM(); }
      if (!messages || messages.length === 0) {
        EskayUI.showToast("No chat messages found to extract context.");
        return;
      }

      let fullConversationText = '';
      messages.forEach(m => { fullConversationText += `${m.role}: ${m.text}\n\n`; });
      const tokenCount = countTokens(fullConversationText);

      const userMessages = messages.filter(m => m.role === 'User');
      let primaryGoal = "Develop and build the project as discussed in the conversation.";
      if (userMessages.length > 0) {
        let firstSubstantialMsg = "";
        const greetings = /^(hi|hello|hey|yo|good morning|good afternoon|good evening|greetings)\b/i;
        for (const msg of userMessages) {
          const cleanedText = EskayOptimizer ? EskayOptimizer.sanitize(msg.text) : msg.text.replace(/^Task:\s*/i, '');
          if (cleanedText.trim().length > 15 && !greetings.test(cleanedText.trim())) {
            firstSubstantialMsg = cleanedText.trim();
            break;
          }
        }
        if (!firstSubstantialMsg) {
          firstSubstantialMsg = userMessages[0].text;
        }

        const sentences = firstSubstantialMsg.split(/(?<=[.?!])\s+/);
        if (sentences.length > 0) {
          const firstTwo = sentences.slice(0, 2).join(' ');
          primaryGoal = firstTwo.length > 300 ? firstTwo.slice(0, 300) + '...' : firstTwo;
        }
      }

      const accomplishments = [];
      const decisions = [];
      const handoffNextSteps = [];
      const allCodeBlocks = [];
      messages.forEach(m => { m.codeBlocks.forEach(cb => { allCodeBlocks.push(cb); }); });
      if (allCodeBlocks.length > 0) {
        accomplishments.push(`Successfully generated ${allCodeBlocks.length} code file(s)/artifact(s) (including ${Array.from(new Set(allCodeBlocks.map(c => c.lang))).join(', ')} implementations).`);
      }

      const assistantMessages = messages.filter(m => m.role === 'Assistant');

      assistantMessages.forEach(m => {
        const lines = m.text.split('\n');
        lines.forEach(line => {
          const trimmed = line.trim();
          if (!trimmed) return;
          const isBullet = /^[*\-\+•]/.test(trimmed) || /^\d+[\.\)]/.test(trimmed) || /^[✅🔄❌⚠️🚀]/.test(trimmed);
          if (!isBullet) return;

          // Extract leading spaces from the original line
          const indentMatch = line.match(/^(\s*)/);
          const indent = indentMatch ? indentMatch[1] : '';

          // Strip leading bullet punctuation but preserve bold tags and content
          const cleanLine = trimmed.replace(/^([*\-\+•]|\d+[\.\)])\s+(\*\*)?/, '$2').trim();
          if (cleanLine.length < 10) return;

          const lower = cleanLine.toLowerCase();
          const isDone = lower.includes('✅') || lower.includes('complete') || lower.includes('done') || lower.includes('shipped') || lower.includes('finished') || lower.includes('success');
          const isPending = lower.includes('🔄') || lower.includes('❌') || lower.includes('pending') || lower.includes('todo') || lower.includes('remaining') || lower.includes('not confirm') || lower.includes('not yet') || lower.includes('in progress');

          const indentedLine = indent + cleanLine;

          if (isDone) {
            if (!accomplishments.includes(indentedLine)) accomplishments.push(indentedLine);
          } else if (isPending) {
            if (!handoffNextSteps.includes(indentedLine)) handoffNextSteps.push(indentedLine);
          } else {
            if (lower.includes('need') || lower.includes('next') || lower.includes('should') || lower.includes('todo') || lower.includes('question')) {
              if (!handoffNextSteps.includes(indentedLine)) handoffNextSteps.push(indentedLine);
            } else {
              if (!decisions.includes(indentedLine)) decisions.push(indentedLine);
            }
          }
        });
      });

      const proseAccomplishments = [];
      const proseNextSteps = [];
      assistantMessages.forEach(m => {
        const sentences = m.text.split(/(?<=[.?!])\s+/);
        sentences.forEach(s => {
          const trimmedS = s.trim();
          if (trimmedS.length < 15 || trimmedS.length > 400) return;
          if (/^[*\-\+•\d\.\)\s]+/.test(trimmedS)) return;
          const lower = trimmedS.toLowerCase();
          if (lower.includes('successfully') || lower.includes('completed') || lower.includes('implemented') || lower.includes('resolved') || lower.includes('shipped') || lower.includes('fixed')) {
            proseAccomplishments.push(trimmedS);
          }
          if (lower.includes('next step') || lower.includes('todo') || lower.includes('should') || lower.includes('remaining') || lower.includes('double-checking') || lower.includes('still need') || trimmedS.includes('?')) {
            proseNextSteps.push(trimmedS);
          }
        });
      });

      proseAccomplishments.forEach(pa => {
        if (!accomplishments.some(a => a.includes(pa) || pa.includes(a))) accomplishments.push(pa);
      });
      proseNextSteps.forEach(pn => {
        if (!handoffNextSteps.some(n => n.includes(pn) || pn.includes(pn))) handoffNextSteps.push(pn);
      });

      const decisionKeywords = ["let's use", "we decided", "the approach is", "decided to", "we choose", "using", "framework", "library"];
      const proseDecisions = [];
      messages.forEach(m => {
        proseDecisions.push(...extractKeySentences(m.text, decisionKeywords));
      });
      const allAttachments = [];
      messages.forEach(m => { m.attachments.forEach(att => { if (!allAttachments.includes(att)) allAttachments.push(att); }); });
      if (allAttachments.length > 0) decisions.push(`Identified and utilized reference files: ${allAttachments.join(', ')}.`);
      proseDecisions.forEach(d => {
        if (!decisions.some(existing => existing.includes(d) || d.includes(existing))) decisions.push(d);
      });

      if (accomplishments.length === 0) accomplishments.push("Reviewed current project goals and status check.");
      if (decisions.length === 0) decisions.push("Aligned on basic project context and next objectives.");
      if (handoffNextSteps.length === 0) {
        handoffNextSteps.push("Proceed with planned development milestones.");
        handoffNextSteps.push("Clarify any remaining requirements with the assistant.");
      }

      let codeSection = "";
      if (allCodeBlocks.length > 0) {
        const uniqueCodes = [];
        const seenCodes = new Set();
        allCodeBlocks.forEach(cb => {
          const hash = cb.code.trim().substring(0, 100);
          if (!seenCodes.has(hash)) { seenCodes.add(hash); uniqueCodes.push(cb); }
        });
        uniqueCodes.slice(-4).forEach((cb, idx) => {
          codeSection += `### Artifact ${idx + 1} (${cb.lang})\n\`\`\`${cb.lang}\n${cb.code.trim()}\n\`\`\`\n\n`;
        });
      } else {
        codeSection = "*No code blocks generated in this session yet.*\n";
      }

      const extraNextSteps = [];
      const nextKeywords = ["todo", "next", "remaining", "unresolved", "open questions", "need to", "should add"];
      let nextSentences = [];
      messages.slice(-3).forEach(m => { nextSentences.push(...extractKeySentences(m.text, nextKeywords)); });
      nextSentences = Array.from(new Set(nextSentences)).slice(0, 4);
      nextSentences.forEach(s => extraNextSteps.push(s));
      if (extraNextSteps.length === 0 && handoffNextSteps.length === 0) {
        handoffNextSteps.push("Perform validation testing and integration verification.");
      } else {
        extraNextSteps.forEach(s => {
          if (!handoffNextSteps.includes(s)) handoffNextSteps.push(s);
        });
      }

      const dateTime = new Date().toLocaleString();
      const markdownContent = `# MASTER_PROMPT.md — Context Handoff Document
> Generated by Eskay on ${dateTime}
> Original chat had approximately ${tokenCount.toLocaleString()} tokens of context.

## 🎯 Primary Goal
${primaryGoal}

## ✅ What Was Accomplished
${accomplishments.map(a => {
        const spaces = a.match(/^(\s*)/)[0];
        return `${spaces}- ${a.slice(spaces.length)}`;
      }).join('\n')}

## 📋 Key Context & Decisions
${decisions.map(d => {
        const spaces = d.match(/^(\s*)/)[0];
        return `${spaces}- ${d.slice(spaces.length)}`;
      }).join('\n')}

## 💻 Code / Artifacts
${codeSection}
## ❓ Unresolved / Next Steps
${handoffNextSteps.map(n => {
        const spaces = n.match(/^(\s*)/)[0];
        return `${spaces}- ${n.slice(spaces.length)}`;
      }).join('\n')}

## 📎 How to Continue This Work
Attach this file to your new chat and begin with:

> "I'm continuing work from a previous session. The context document is attached.
> Please read it fully, confirm you understand the goal and current state, then
> ask me any clarifying questions before we proceed."

---
*Generated by Eskay — https://github.com/skpra/Eskay*
`;
      try {
        const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'MASTER_PROMPT.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        EskayUI.showToast("✓ Context file downloaded! Attach MASTER_PROMPT.md to your new chat.");
      } catch (err) {
        EskayUI.showToast("Failed to download MASTER_PROMPT.md.");
      }
    }
  };

  // --- 6. Usage Tracker ---
  let orgId = null;
  let usageState = {
    session: { pct: 0, resetTime: null },
    weekly: { pct: 0, resetTime: null },
    context: { tokens: 0, pct: 0 },
    cache: { resetTime: null }
  };

  function parseUsageFromUsageEndpoint(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const normalizeWindow = (w) => {
      if (!w || typeof w !== 'object') return null;
      if (typeof w.utilization !== 'number' || !Number.isFinite(w.utilization)) return null;
      return { utilization: Math.round(Math.max(0, Math.min(100, w.utilization))), resets_at: typeof w.resets_at === 'string' ? Date.parse(w.resets_at) : null };
    };
    return { five_hour: normalizeWindow(raw.five_hour), seven_day: normalizeWindow(raw.seven_day) };
  }

  function parseUsageFromMessageLimit(raw) {
    if (!raw?.windows || typeof raw.windows !== 'object') return null;
    const normalizeWindow = (w) => {
      if (!w || typeof w !== 'object') return null;
      if (typeof w.utilization !== 'number' || !Number.isFinite(w.utilization)) return null;
      return { utilization: Math.round(Math.max(0, Math.min(100, w.utilization * 100))), resets_at: typeof w.resets_at === 'number' && Number.isFinite(w.resets_at) ? w.resets_at * 1000 : null };
    };
    return { five_hour: normalizeWindow(raw.windows['5h']), seven_day: normalizeWindow(raw.windows['7d']) };
  }

  function applyUsageUpdate(parsed) {
    if (!parsed) return;
    if (parsed.five_hour) {
      usageState.session.pct = parsed.five_hour.utilization;
      usageState.session.resetTime = parsed.five_hour.resets_at;
    }
    if (parsed.seven_day) {
      usageState.weekly.pct = parsed.seven_day.utilization;
      usageState.weekly.resetTime = parsed.seven_day.resets_at;
    }
    EskayUI.updateUsageBars();
    storageMock.set({ lastUsageState: usageState, lastOrgId: orgId });
  }

  const EskayUsageTracker = {
    setOrgId(id) {
      if (!id || id === orgId) return;
      orgId = id;
      this.pollUsage();
    },
    getOrgId() { return orgId; },
    pollUsage() {
      if (orgId) {
        window.postMessage({ type: 'ESKAY_TRIGGER_USAGE_POLL', orgId }, '*');
      }
    },
    setUsageData(raw) { applyUsageUpdate(parseUsageFromUsageEndpoint(raw)); },
    setUsageDataFromSSE(messageLimit) { applyUsageUpdate(parseUsageFromMessageLimit(messageLimit)); },
    setContextUsage(tokens) {
      usageState.context.tokens = tokens;
      usageState.context.pct = Math.min(100, Math.round((tokens / 200000) * 100));
      EskayUI.updateUsageBars();
    },
    setCacheExpiry(resetTime) {
      usageState.cache.resetTime = resetTime;
      EskayUI.updateUsageBars();
    },
    getUsage() { return usageState; },
    init() {
      storageMock.get(['lastUsageState', 'lastOrgId'], (result) => {
        if (result.lastUsageState) {
          const cacheTime = result.lastUsageState.cache?.resetTime;
          usageState = result.lastUsageState;
          if (cacheTime && cacheTime > Date.now()) { usageState.cache.resetTime = cacheTime; }
          else { usageState.cache.resetTime = null; }
        }
        if (result.lastOrgId) {
          orgId = result.lastOrgId;
          this.pollUsage();
        }
        EskayUI.updateUsageBars();
      });
    }
  };

  // --- 7. UI Manager ---
  let isPanelOpen = false;
  let headerContainer = null;
  let headerDisplay = null;
  let lengthGroup = null;
  let lengthDisplay = null;
  let cachedDisplay = null;
  let cacheTimeSpan = null;
  let lastCachedUntilMs = null;
  let pendingCache = false;
  let eskayWriting = false;
  let detectDebounce = null;
  let lastOptimizedText = '';

  function applySubOption(key, checked) {
    const inputEl = document.querySelector('[contenteditable="true"], textarea');
    if (!inputEl) return;
    const currentText = inputEl.innerText || inputEl.value || '';
    if (!currentText.trim()) return;

    const options = JSON.parse(sessionStorage.getItem('eskay_options') || '{}');
    options[key] = checked;

    // Mutual exclusion: one-shot and multi-shot cannot both be active
    if (key === 'oneshot' && checked) {
      const multishotCheckbox = document.getElementById('ek-opt-multishot');
      if (multishotCheckbox) multishotCheckbox.checked = false;
      options.multishot = false;
    } else if (key === 'multishot' && checked) {
      const oneshotCheckbox = document.getElementById('ek-opt-oneshot');
      if (oneshotCheckbox) oneshotCheckbox.checked = false;
      options.oneshot = false;
    }

    sessionStorage.setItem('eskay_options', JSON.stringify(options));
    updateOneshotMultishotDisabledState();

    const optimizer = window.EskayOptimizer || EskayOptimizer;

    // Preserve code blocks before sanitizing and modifying sub-options
    const { text: preservedText, codeBlocks } = optimizer.preserveCodeBlocksAndRawCode(currentText);

    // Sanitize first to strip any previously injected version of any option, preventing duplicates
    let result = optimizer.sanitize(preservedText);

    // Re-apply only the currently checked sub-options
    result = optimizer.applySubOptions(result, options);

    // Normalize multiple consecutive blank lines for the final prompt (max 2 newlines, i.e. 1 blank line)
    result = result.replace(/\n{3,}/g, '\n\n');
    result = result.trim();

    // Restore code blocks verbatim
    result = optimizer.restoreCodeBlocksAndRawCode(result, codeBlocks);

    setInputValue(inputEl, result);
  }

  function syncCheckboxesFromPrompt() {
    if (eskayWriting) return;
    const inputEl = document.querySelector('[contenteditable="true"], textarea');
    if (!inputEl) return;
    const text = inputEl.innerText || inputEl.value || '';
    const detected = EskayOptimizer.detectPromptFeatures(text);

    const optKeys = ['clarify', 'step', 'persona', 'oneshot', 'multishot', 'format', 'context', 'brutal'];
    optKeys.forEach(key => {
      const checkbox = document.getElementById(`ek-opt-${key}`);
      if (checkbox && detected[key] !== undefined) {
        checkbox.checked = detected[key];
      }
    });

    // Sync sessionStorage to match
    const currentOpts = JSON.parse(sessionStorage.getItem('eskay_options') || '{}');
    Object.assign(currentOpts, detected);
    sessionStorage.setItem('eskay_options', JSON.stringify(currentOpts));

    updateOneshotMultishotDisabledState();
  }

  function updateOneshotMultishotDisabledState() {
    const inputEl = document.querySelector('[contenteditable="true"], textarea');
    const isEmpty = !inputEl || !(inputEl.innerText || inputEl.value || '').trim();
    if (isEmpty) return;

    const oneshotCheckbox = document.getElementById('ek-opt-oneshot');
    const multishotCheckbox = document.getElementById('ek-opt-multishot');
    if (!oneshotCheckbox || !multishotCheckbox) return;

    const oneshotLabel = oneshotCheckbox.closest('label') || oneshotCheckbox.parentElement;
    const multishotLabel = multishotCheckbox.closest('label') || multishotCheckbox.parentElement;

    if (oneshotCheckbox.checked) {
      multishotCheckbox.setAttribute('disabled', 'true');
      if (multishotLabel) {
        multishotLabel.style.opacity = '0.4';
        multishotLabel.style.pointerEvents = 'none';
        multishotLabel.style.cursor = 'not-allowed';
      }
      oneshotCheckbox.removeAttribute('disabled');
      if (oneshotLabel) {
        oneshotLabel.style.opacity = '1';
        oneshotLabel.style.pointerEvents = 'auto';
        oneshotLabel.style.cursor = 'pointer';
      }
    } else if (multishotCheckbox.checked) {
      oneshotCheckbox.setAttribute('disabled', 'true');
      if (oneshotLabel) {
        oneshotLabel.style.opacity = '0.4';
        oneshotLabel.style.pointerEvents = 'none';
        oneshotLabel.style.cursor = 'not-allowed';
      }
      multishotCheckbox.removeAttribute('disabled');
      if (multishotLabel) {
        multishotLabel.style.opacity = '1';
        multishotLabel.style.pointerEvents = 'auto';
        multishotLabel.style.cursor = 'pointer';
      }
    } else {
      oneshotCheckbox.removeAttribute('disabled');
      multishotCheckbox.removeAttribute('disabled');
      if (oneshotLabel) {
        oneshotLabel.style.opacity = '1';
        oneshotLabel.style.pointerEvents = 'auto';
        oneshotLabel.style.cursor = 'pointer';
      }
      if (multishotLabel) {
        multishotLabel.style.opacity = '1';
        multishotLabel.style.pointerEvents = 'auto';
        multishotLabel.style.cursor = 'pointer';
      }
    }
  }

  function disableButton(id) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.setAttribute('disabled', 'true');
    btn.style.opacity = '0.4';
    btn.style.pointerEvents = 'none';
    btn.style.cursor = 'not-allowed';
  }

  function enableButton(id) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.removeAttribute('disabled');
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
    btn.style.cursor = 'pointer';
  }

  function updateCheckboxDisableState() {
    const inputEl = document.querySelector('[contenteditable="true"], textarea');
    const isEmpty = !inputEl || !(inputEl.innerText || inputEl.value || '').trim();

    const checkboxIds = [
      'ek-opt-clarify',
      'ek-opt-step',
      'ek-opt-persona',
      'ek-opt-oneshot',
      'ek-opt-multishot',
      'ek-opt-format',
      'ek-opt-context',
      'ek-opt-brutal'
    ];

    checkboxIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const label = el.closest('label') || el.closest('.ek-brutal-switch-container') || el.parentElement;
      if (isEmpty) {
        el.setAttribute('disabled', 'true');
        if (label) {
          label.style.opacity = '0.4';
          label.style.cursor = 'not-allowed';
          label.style.pointerEvents = 'none';
        }
      } else {
        el.removeAttribute('disabled');
        if (label) {
          label.style.opacity = '1';
          label.style.cursor = 'pointer';
          label.style.pointerEvents = 'auto';
        }
      }
    });

    if (!isEmpty) {
      updateOneshotMultishotDisabledState();
    }
  }

  function setInputValue(el, value) {
    if (!el) return;
    el.focus();
    eskayWriting = true;
    try {
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (el.getAttribute('contenteditable') === 'true') {
        try {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(el);
          selection.removeAllRanges();
          selection.addRange(range);
          if (!document.execCommand('insertText', false, value)) {
            el.innerText = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } catch (e) {
          el.innerText = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    } finally {
      eskayWriting = false;
    }
  }

  function formatTimeRemaining(ms) {
    if (!ms || ms <= 0) return 'resets soon';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `resets in ${days}d ${hours % 24}h`;
    const hh = String(hours % 24).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    return `resets in ${hh}:${mm}:${ss}`;
  }

  function updateRetrieveButtonState() {
    const btn = document.getElementById('ek-btn-retrieve');
    if (!btn) return;

    const hasDataMessages = typeof EskayExporter !== 'undefined' &&
      typeof EskayExporter.getActiveConversationData === 'function' &&
      EskayExporter.getActiveConversationData() &&
      Array.isArray(EskayExporter.getActiveConversationData().chat_messages) &&
      EskayExporter.getActiveConversationData().chat_messages.some(m => m.sender === 'human');

    const hasDomMessages = !!document.querySelector('[data-testid="user-message"], .font-user');

    const inputEl = document.querySelector('[contenteditable="true"], textarea');
    const hasInputText = inputEl && (inputEl.innerText || inputEl.value || '').trim().length > 0;

    if (hasDataMessages || hasDomMessages || hasInputText) {
      btn.removeAttribute('disabled');
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
      btn.style.cursor = 'pointer';
    } else {
      btn.setAttribute('disabled', 'true');
      btn.style.opacity = '0.4';
      btn.style.pointerEvents = 'none';
      btn.style.cursor = 'not-allowed';
    }
  }

  function updateThemeClass() {
    const toolbar = document.getElementById('eskay-toolbar');
    if (!toolbar) return;

    const isDark = document.documentElement.classList.contains('dark') ||
      document.body.classList.contains('dark') ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      toolbar.classList.remove('ek-light-mode');
      toolbar.classList.add('ek-dark-mode');
    } else {
      toolbar.classList.remove('ek-dark-mode');
      toolbar.classList.add('ek-light-mode');
    }
  }

  function setupTooltip(element, tooltip, { topOffset = 10 } = {}) {
    if (!element || !tooltip) return;
    if (element.hasAttribute('data-tooltip-setup')) return;
    element.setAttribute('data-tooltip-setup', 'true');
    let pressTimer, hideTimer;
    const show = () => {
      const rect = element.getBoundingClientRect();
      tooltip.style.opacity = '1';
      const tipRect = tooltip.getBoundingClientRect();
      let left = rect.left + rect.width / 2;
      if (left + tipRect.width / 2 > window.innerWidth) left = window.innerWidth - tipRect.width / 2 - 10;
      if (left - tipRect.width / 2 < 0) left = tipRect.width / 2 + 10;
      let top = rect.top - tipRect.height - topOffset;
      if (top < 10) top = rect.bottom + 10;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      tooltip.style.transform = 'translateX(-50%)';
    };
    const hide = () => { tooltip.style.opacity = '0'; clearTimeout(hideTimer); };
    element.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') show(); });
    element.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  }

  function makeTooltip(text) {
    const tip = document.createElement('div');
    tip.className = 'ek-tooltip';
    tip.textContent = text;
    tip.style.position = 'absolute';
    tip.style.opacity = '0';
    tip.style.pointerEvents = 'none';
    tip.style.zIndex = '100001';
    document.body.appendChild(tip);
    return tip;
  }

  const EskayUI = {
    init() {
      headerContainer = document.createElement('div');
      headerContainer.className = 'ek-header-container';
      headerDisplay = document.createElement('span');
      lengthGroup = document.createElement('span');
      lengthDisplay = document.createElement('span');
      cachedDisplay = document.createElement('span');
      lengthGroup.appendChild(lengthDisplay);
      headerDisplay.appendChild(lengthGroup);
      headerContainer.appendChild(headerDisplay);

      EskayUsageTracker.init();
      this.injectToolbar();
      this.attachHeader();

      // Global paste listener (capture phase) - survives React DOM replacement
      document.addEventListener('paste', () => {
        if (eskayWriting) return;
        setTimeout(() => {
          const inputEl = document.querySelector('[contenteditable="true"], textarea');
          if (!inputEl) return;
          const curText = inputEl.innerText || inputEl.value || '';
          updateRetrieveButtonState();
          updateCheckboxDisableState();
          if (curText.trim()) {
            enableButton('ek-btn-minimize');
            enableButton('ek-btn-maximize');
          }
          clearTimeout(detectDebounce);
          detectDebounce = setTimeout(syncCheckboxesFromPrompt, 300);
        }, 50);
      }, true);

      setupTooltip(lengthGroup, makeTooltip("Approximate tokens context window limit (200k).\nCache timer indicates active prompt caching."), { topOffset: 8 });
      setupTooltip(cachedDisplay, makeTooltip("Conversation context is actively cached by Claude."), { topOffset: 8 });
    },
    findChatInputContainer() {
      const dropdown = document.querySelector('[data-testid="model-selector-dropdown"]');
      if (!dropdown) return null;
      let cur = dropdown;
      while (cur && cur !== document.body) {
        const style = window.getComputedStyle(cur);
        if (style.display === 'flex' && style.flexDirection === 'row') {
          const buttons = cur.querySelectorAll('button');
          if (buttons.length > 1) return cur;
        }
        cur = cur.parentElement;
      }
      return dropdown.parentElement;
    },
    attachHeader() {
      const chatMenu = document.querySelector('[data-testid="chat-menu-trigger"]');
      if (!chatMenu) return;
      const anchor = chatMenu.closest('.chat-project-wrapper') || chatMenu.parentElement;
      if (!anchor) return;
      if (anchor.nextElementSibling !== headerContainer) { anchor.after(headerContainer); }
      this._renderHeader();
    },
    injectToolbar() {
      if (document.getElementById('eskay-toolbar')) return;
      const container = this.findChatInputContainer();
      if (!container) return;

      const toolbar = document.createElement('div');
      toolbar.id = 'eskay-toolbar';

      const savedOpts = JSON.parse(sessionStorage.getItem('eskay_options') || '{}');
      const optClarify = savedOpts.clarify ? 'checked' : '';
      const optStep = savedOpts.step ? 'checked' : '';
      const optPersona = savedOpts.persona ? 'checked' : '';
      const optOneShot = savedOpts.oneshot ? 'checked' : '';
      const optMultiShot = savedOpts.multishot ? 'checked' : '';
      const optFormat = savedOpts.format ? 'checked' : '';
      const optContext = savedOpts.context ? 'checked' : '';
      const optBrutal = savedOpts.brutal ? 'checked' : '';

      toolbar.innerHTML = `
        <div class="ek-header">
          <div class="ek-logo-group"><span class="ek-logo-dot"></span><span>Eskay</span></div>
          <button class="ek-toggle-sub ${isPanelOpen ? 'open' : ''}" id="ek-sub-toggle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
        <div class="ek-sub-panel" id="ek-options-panel" style="display: ${isPanelOpen ? 'grid' : 'none'}">
          <label class="ek-checkbox-label"><input type="checkbox" id="ek-opt-clarify" ${optClarify}> 🧠 Ask clarification</label>
          <label class="ek-checkbox-label"><input type="checkbox" id="ek-opt-step" ${optStep}> 🔢 Step-by-step</label>
          <label class="ek-checkbox-label"><input type="checkbox" id="ek-opt-persona" ${optPersona}> 🎭 Set persona</label>
          <label class="ek-checkbox-label"><input type="checkbox" id="ek-opt-oneshot" ${optOneShot}> 📌 One-shot</label>
          <label class="ek-checkbox-label"><input type="checkbox" id="ek-opt-multishot" ${optMultiShot}> 🔁 Multi-shot</label>
          <label class="ek-checkbox-label"><input type="checkbox" id="ek-opt-format" ${optFormat}> 📐 Specify format</label>
          <label class="ek-checkbox-label"><input type="checkbox" id="ek-opt-context" ${optContext}> 🧩 Request context</label>
        </div>
        <div class="ek-actions-row">
          <div class="ek-buttons">
            <button class="ek-btn ek-btn-minimize" id="ek-btn-minimize">Minimise Tokens</button>
            <button class="ek-btn ek-btn-maximize" id="ek-btn-maximize">Maximise Efficiency</button>
            <label class="ek-brutal-switch-container">
              <span class="ek-brutal-switch-label">Brutal Mode</span>
              <input type="checkbox" id="ek-opt-brutal" class="ek-brutal-checkbox" ${optBrutal}>
              <span class="ek-brutal-slider"></span>
            </label>
          </div>
          <button class="ek-btn ek-btn-retrieve" id="ek-btn-retrieve" style="margin-left: auto;">⬇ Retrieve Context</button>
          <div class="ek-delta" id="ek-delta-display">−0 tokens saved</div>
        </div>
        <div class="ek-dashboard">
          <div class="ek-bar-row" id="ek-row-session">
            <div class="ek-bar-header"><span class="ek-bar-label">SESSION</span><span class="ek-bar-meta" id="ek-meta-session">0% used · resets soon</span></div>
            <div class="ek-bar-outer">
              <div class="ek-bar-inner" id="ek-bar-session" style="width: 0%"></div>
              <div class="ek-bar-marker" id="ek-marker-session" style="left: 0%"></div>
            </div>
          </div>
          <div class="ek-bar-row" id="ek-row-weekly">
            <div class="ek-bar-header"><span class="ek-bar-label">WEEKLY</span><span class="ek-bar-meta" id="ek-meta-weekly">0% used · resets soon</span></div>
            <div class="ek-bar-outer">
              <div class="ek-bar-inner" id="ek-bar-weekly" style="width: 0%"></div>
              <div class="ek-bar-marker" id="ek-marker-weekly" style="left: 0%"></div>
            </div>
          </div>
          <div class="ek-bar-row" id="ek-row-context">
            <div class="ek-bar-header"><span class="ek-bar-label">CONTEXT</span><span class="ek-bar-meta" id="ek-meta-context">~0 tokens · 0% of 200k</span></div>
            <div class="ek-bar-outer">
              <div class="ek-bar-inner" id="ek-bar-context" style="width: 0%"></div>
            </div>
          </div>
        </div>
      `;
      const inputCard = container.parentNode;
      if (inputCard) {
        inputCard.style.flexShrink = '0';
      }
      if (inputCard && inputCard.parentNode) {
        inputCard.parentNode.insertBefore(toolbar, inputCard.nextSibling);
      } else {
        container.parentNode.insertBefore(toolbar, container.nextSibling);
      }
      this.attachListeners();

      setupTooltip(document.getElementById('ek-row-session'), makeTooltip("5-hour rolling usage.\nBar: message count used.\nLine: elapsed window time."), { topOffset: 8 });
      setupTooltip(document.getElementById('ek-row-weekly'), makeTooltip("7-day rolling usage.\nBar: message count used.\nLine: elapsed window time."), { topOffset: 8 });
      setupTooltip(document.getElementById('ek-row-context'), makeTooltip("Approximate BPE token count for current conversation.\nBar scale: 200k tokens context limit."), { topOffset: 8 });

      const savedDelta = sessionStorage.getItem('eskay_last_saved_delta');
      if (savedDelta) { this.updateDeltaDisplay(parseInt(savedDelta, 10)); }
      this.updateUsageBars();
      updateThemeClass();
      updateRetrieveButtonState();
      updateCheckboxDisableState();

      const inputEl = document.querySelector('[contenteditable="true"], textarea');
      const isEmpty = !inputEl || !(inputEl.innerText || inputEl.value || '').trim();
      if (isEmpty) {
        disableButton('ek-btn-minimize');
        disableButton('ek-btn-maximize');
      } else {
        enableButton('ek-btn-minimize');
        enableButton('ek-btn-maximize');
      }
    },
    attachListeners() {
      document.getElementById('ek-sub-toggle').addEventListener('click', () => {
        isPanelOpen = !isPanelOpen;
        const panel = document.getElementById('ek-options-panel');
        const btn = document.getElementById('ek-sub-toggle');
        panel.style.display = isPanelOpen ? 'grid' : 'none';
        if (isPanelOpen) btn.classList.add('open');
        else btn.classList.remove('open');
      });
      document.getElementById('ek-btn-minimize').addEventListener('click', () => { this.handleOptimize('minimize'); });
      document.getElementById('ek-btn-maximize').addEventListener('click', () => { this.handleOptimize('maximize'); });

      const optKeys = ['clarify', 'step', 'persona', 'oneshot', 'multishot', 'format', 'context', 'brutal'];
      optKeys.forEach(key => {
        const checkbox = document.getElementById(`ek-opt-${key}`);
        if (checkbox) {
          checkbox.addEventListener('change', () => {
            applySubOption(key, checkbox.checked);
          });
        }
      });
      document.getElementById('ek-btn-retrieve').addEventListener('click', () => { EskayExporter.exportContext(); });

      const dashboard = document.querySelector('.ek-dashboard');
      if (dashboard) {
        dashboard.addEventListener('click', () => {
          originalFetch(`/api/organizations/${EskayUsageTracker.getOrgId()}/usage?eskay_polling=true`)
            .then(res => res.json())
            .then(data => { EskayUsageTracker.setUsageData(data); })
            .catch(() => { });
        });
      }
    },
    handleOptimize(mode) {
      const inputEl = document.querySelector('[contenteditable="true"], textarea');
      if (!inputEl) return;
      const currentText = inputEl.innerText || inputEl.value || '';
      if (!currentText.trim()) return;

      if (mode === 'maximize') {
        const optKeys = ['clarify', 'step', 'persona', 'oneshot', 'format', 'context'];
        const options = JSON.parse(sessionStorage.getItem('eskay_options') || '{}');

        optKeys.forEach(key => {
          options[key] = true;
          const checkbox = document.getElementById(`ek-opt-${key}`);
          if (checkbox) checkbox.checked = true;
        });

        // Set multishot to false for mutual exclusion
        options.multishot = false;
        const multishotCheckbox = document.getElementById('ek-opt-multishot');
        if (multishotCheckbox) multishotCheckbox.checked = false;

        sessionStorage.setItem('eskay_options', JSON.stringify(options));
      }

      const options = JSON.parse(sessionStorage.getItem('eskay_options') || '{}');
      const optimized = EskayOptimizer.optimize(currentText, mode, options);

      const beforeTokens = countTokens(currentText);
      const afterTokens = countTokens(optimized);
      const delta = beforeTokens - afterTokens;

      setInputValue(inputEl, optimized);
      lastOptimizedText = optimized;
      this.updateDeltaDisplay(delta);

      if (mode === 'minimize') {
        disableButton('ek-btn-minimize');
        enableButton('ek-btn-maximize');
      } else if (mode === 'maximize') {
        disableButton('ek-btn-maximize');
        enableButton('ek-btn-minimize');
      }
    },
    updateDeltaDisplay(delta) {
      const display = document.getElementById('ek-delta-display');
      if (!display) return;
      if (delta > 0) {
        display.innerText = `−${delta} tokens saved`;
        display.style.color = '#10B981';
        display.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
        display.style.borderColor = 'rgba(16, 185, 129, 0.2)';
        display.style.display = 'block';
      } else if (delta < 0) {
        display.innerText = `+${Math.abs(delta)} tokens`;
        display.style.color = 'var(--cb-violet)';
        display.style.backgroundColor = 'rgba(124, 58, 237, 0.1)';
        display.style.borderColor = 'rgba(124, 58, 237, 0.2)';
        display.style.display = 'block';
      } else {
        display.innerText = `0 tokens saved`;
        display.style.color = 'var(--cb-text-muted)';
        display.style.backgroundColor = 'var(--cb-bg-hover)';
        display.style.borderColor = 'var(--cb-border)';
        display.style.display = 'block';
      }
      sessionStorage.setItem('eskay_last_saved_delta', delta);
    },
    setPendingCache(pending) {
      pendingCache = pending;
      if (cacheTimeSpan) { cacheTimeSpan.style.color = pending ? '' : '#10B981'; }
    },
    updateUsageBars() {
      const usage = EskayUsageTracker.getUsage();
      const updateBar = (barId, metaId, markerId, pct, resetTime, windowHours) => {
        const bar = document.getElementById(barId);
        const meta = document.getElementById(metaId);
        const marker = document.getElementById(markerId);
        if (!bar || !meta) return;

        bar.style.width = `${pct}%`;
        bar.className = 'ek-bar-inner';
        if (pct > 95) bar.classList.add('critical');
        else if (pct > 80) bar.classList.add('warning');

        const countdownText = resetTime ? ` · resets in ${formatResetCountdown(resetTime)}` : ' · resets soon';
        meta.innerText = `${pct}% used${countdownText}`;

        if (marker && resetTime) {
          const totalMs = windowHours * 60 * 60 * 1000;
          const windowStartMs = resetTime - totalMs;
          const elapsedMs = Math.max(0, Math.min(totalMs, Date.now() - windowStartMs));
          const elapsedPct = totalMs > 0 ? (elapsedMs / totalMs) * 100 : 0;
          marker.style.left = `${elapsedPct}%`;
          marker.style.display = 'block';
        } else if (marker) {
          marker.style.display = 'none';
        }
      };

      updateBar('ek-bar-session', 'ek-meta-session', 'ek-marker-session', usage.session.pct, usage.session.resetTime, 5);
      updateBar('ek-bar-weekly', 'ek-meta-weekly', 'ek-marker-weekly', usage.weekly.pct, usage.weekly.resetTime, 24 * 7);

      const contextTokens = usage.context.tokens || 0;
      const contextPct = Math.max(0, Math.min(100, (contextTokens / 200000) * 100));
      const ctxBar = document.getElementById('ek-bar-context');
      const ctxMeta = document.getElementById('ek-meta-context');
      if (ctxBar && ctxMeta) {
        ctxBar.style.width = `${contextPct}%`;
        ctxBar.className = 'ek-bar-inner';
        if (contextPct > 95) ctxBar.classList.add('critical');
        else if (contextPct > 80) ctxBar.classList.add('warning');
        ctxMeta.innerText = `~${contextTokens.toLocaleString()} tokens · ${Math.round(contextPct)}% of 200k`;
      }

      this.updateHeaderMetrics(usage.context.tokens, usage.cache.resetTime);
      this.attachHeader();
      updateRetrieveButtonState();
    },
    updateHeaderMetrics(tokens, cachedUntil) {
      if (typeof tokens !== 'number' || tokens <= 0) {
        lengthDisplay.textContent = '';
        cachedDisplay.textContent = '';
        lastCachedUntilMs = null;
        this._renderHeader();
        return;
      }
      const pct = Math.max(0, Math.min(100, (tokens / 200000) * 100));
      lengthDisplay.textContent = `~${tokens.toLocaleString()} tokens`;
      const isFull = pct >= 99.5;
      if (isFull) {
        lengthDisplay.style.opacity = '0.5';
        lengthGroup.replaceChildren(lengthDisplay);
      } else {
        lengthDisplay.style.opacity = '';
        const bar = document.createElement('div');
        bar.className = 'ek-header-mini-bar';
        const fill = document.createElement('div');
        fill.className = 'ek-header-mini-bar-fill';
        fill.style.width = `${pct}%`;
        bar.appendChild(fill);
        const barSpan = document.createElement('span');
        barSpan.style.display = 'inline-flex';
        barSpan.style.alignItems = 'center';
        barSpan.style.marginLeft = '6px';
        barSpan.appendChild(bar);
        lengthGroup.replaceChildren(lengthDisplay, barSpan);
      }
      const now = Date.now();
      if (typeof cachedUntil === 'number' && cachedUntil > now) {
        lastCachedUntilMs = cachedUntil;
        const secsLeft = Math.max(0, Math.ceil((cachedUntil - now) / 1000));
        cacheTimeSpan = document.createElement('span');
        cacheTimeSpan.className = 'ek-header-cache-active';
        cacheTimeSpan.textContent = formatSeconds(secsLeft);
        cacheTimeSpan.style.color = pendingCache ? '' : '#10B981';
        cachedDisplay.replaceChildren(document.createTextNode('cached for '), cacheTimeSpan);
      } else {
        lastCachedUntilMs = null;
        cacheTimeSpan = null;
        cachedDisplay.textContent = '';
      }
      this._renderHeader();
    },
    _renderHeader() {
      headerDisplay.replaceChildren();
      const hasCache = !!cachedDisplay.textContent;
      if (!hasCache) { headerContainer.style.display = 'none'; return; }
      headerContainer.style.display = 'flex';
      headerDisplay.replaceChildren(cachedDisplay);
    },
    tick() {
      this.injectToolbar();
      this.attachHeader();
      updateThemeClass();
      updateRetrieveButtonState();
      updateCheckboxDisableState();

      const inputEl = document.querySelector('[contenteditable="true"], textarea');
      const text = inputEl ? (inputEl.innerText || inputEl.value || '') : '';
      const isEmpty = !text.trim();
      if (isEmpty) {
        disableButton('ek-btn-minimize');
        disableButton('ek-btn-maximize');
      } else if (text !== lastOptimizedText) {
        enableButton('ek-btn-minimize');
        enableButton('ek-btn-maximize');
      }

      // Dynamically attach listeners to the textarea/contenteditable for real-time updates and checkbox sync
      if (inputEl && !inputEl.hasAttribute('data-eskay-listener')) {
        inputEl.setAttribute('data-eskay-listener', 'true');
        
        const onUserChange = () => {
          updateRetrieveButtonState();
          updateCheckboxDisableState();

          if (eskayWriting) return;
          
          const curText = inputEl.innerText || inputEl.value || '';
          if (curText.trim() && curText !== lastOptimizedText) {
            enableButton('ek-btn-minimize');
            enableButton('ek-btn-maximize');
          }

          clearTimeout(detectDebounce);
          detectDebounce = setTimeout(syncCheckboxesFromPrompt, 300);
        };

        inputEl.addEventListener('input', onUserChange);
        inputEl.addEventListener('paste', () => setTimeout(onUserChange, 20));
        inputEl.addEventListener('keyup', onUserChange);
        
        // Initial sync when attaching listener
        syncCheckboxesFromPrompt();
      }

      const now = Date.now();
      if (lastCachedUntilMs && lastCachedUntilMs > now) {
        const secsLeft = Math.max(0, Math.ceil((lastCachedUntilMs - now) / 1000));
        if (cacheTimeSpan) { cacheTimeSpan.textContent = formatSeconds(secsLeft); }
      } else if (lastCachedUntilMs && lastCachedUntilMs <= now) {
        lastCachedUntilMs = null;
        cacheTimeSpan = null;
        pendingCache = false;
        cachedDisplay.textContent = '';
        this._renderHeader();
      }

      const usage = EskayUsageTracker.getUsage();
      const tickBar = (metaId, markerId, pct, resetTime, windowHours) => {
        const meta = document.getElementById(metaId);
        const marker = document.getElementById(markerId);
        if (!meta) return;
        const countdownText = resetTime ? ` · resets in ${formatResetCountdown(resetTime)}` : ' · resets soon';
        meta.innerText = `${pct}% used${countdownText}`;
        if (marker && resetTime) {
          const totalMs = windowHours * 60 * 60 * 1000;
          const windowStartMs = resetTime - totalMs;
          const elapsedMs = Math.max(0, Math.min(totalMs, Date.now() - windowStartMs));
          const elapsedPct = totalMs > 0 ? (elapsedMs / totalMs) * 100 : 0;
          marker.style.left = `${elapsedPct}%`;
        }
      };
      tickBar('ek-meta-session', 'ek-marker-session', usage.session.pct, usage.session.resetTime, 5);
      tickBar('ek-meta-weekly', 'ek-marker-weekly', usage.weekly.pct, usage.weekly.resetTime, 24 * 7);

      const contextTokens = usage.context.tokens || 0;
      const contextPct = Math.max(0, Math.min(100, (contextTokens / 200000) * 100));
      const ctxMeta = document.getElementById('ek-meta-context');
      if (ctxMeta) {
        ctxMeta.innerText = `~${contextTokens.toLocaleString()} tokens · ${Math.round(contextPct)}% of 200k`;
      }
      const ctxBar = document.getElementById('ek-bar-context');
      if (ctxBar) {
        ctxBar.style.width = `${contextPct}%`;
      }
    },
    showToast(message) {
      const oldToasts = document.querySelectorAll('.ek-toast');
      oldToasts.forEach(t => t.remove());
      const toast = document.createElement('div');
      toast.className = 'ek-toast';
      toast.innerHTML = `<div style="font-weight: 600; color: var(--cb-orange)">Eskay Context Export</div><div>${message}</div>`;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.classList.add('ek-toast-fadeout');
        setTimeout(() => { toast.remove(); }, 300);
      }, 6000);
    }
  };

  // --- 8. Fetch Interception ---
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch(...args);
    const url = args[0] && typeof args[0] === 'string' ? args[0] : (args[0] instanceof URL ? args[0].href : (args[0] instanceof Request ? args[0].url : ''));
    const opts = args[1] || {};

    if (url) {
      const orgMatch = url.match(/\/api\/organizations\/([^\/]+)/);
      if (orgMatch && orgMatch[1]) {
        EskayUsageTracker.setOrgId(orgMatch[1]);
      }

      if (opts.method === 'POST' && (url.includes('/completion') || url.includes('/retry_completion'))) {
        EskayUI.setPendingCache(true);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('event-stream')) {
        try {
          const clone = response.clone();
          const reader = clone.body.getReader();
          const decoder = new TextDecoder();
          (async () => {
            let buffer = '';
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split(/\r\n|\r|\n/);
                buffer = lines.pop() || '';
                for (const line of lines) {
                  if (!line.startsWith('data:')) continue;
                  const raw = line.slice(5).trim();
                  if (!raw) continue;
                  try {
                    const parsed = JSON.parse(raw);
                    if (parsed?.type === 'message_limit' && parsed.message_limit) {
                      EskayUsageTracker.setUsageDataFromSSE(parsed.message_limit);
                    }
                  } catch (e) { }
                }
              }
            } catch (err) { }
          })();
        } catch (e) { }
      }

      if (url.includes('/chat_conversations/') && url.includes('tree=')) {
        try {
          const cloned = response.clone();
          const data = await cloned.json();
          EskayExporter.setActiveConversationData(data);
          const metrics = await EskayTokenizer.computeConversationMetrics(data);
          EskayUsageTracker.setContextUsage(metrics.totalTokens);
          EskayUsageTracker.setCacheExpiry(metrics.cachedUntil);
          EskayUI.setPendingCache(false);
        } catch (e) { }
      }

      if (url.includes('/usage') && !url.includes('eskay_polling')) {
        try {
          const clone = response.clone();
          clone.json().then(data => {
            EskayUsageTracker.setUsageData(data);
          }).catch(() => { });
        } catch (e) { }
      }
    }
    return response;
  };

  // --- 9. Userscript Init ---
  let currentConversationId = null;

  function getConversationId() {
    const match = window.location.pathname.match(/\/chat\/([^/?]+)/);
    return match ? match[1] : null;
  }

  function getOrgIdFromCookie() {
    try {
      return document.cookie
        .split('; ')
        .find((row) => row.startsWith('lastActiveOrg='))
        ?.split('=')[1] || null;
    } catch { return null; }
  }

  async function loadConversationData(orgId, conversationId) {
    const url = `https://claude.ai/api/organizations/${orgId}/chat_conversations/${conversationId}?tree=true&rendering_mode=messages&render_all_tools=true`;
    try {
      const res = await originalFetch(url, { credentials: 'include' });
      const json = await res.json();
      EskayExporter.setActiveConversationData(json);
      const metrics = await EskayTokenizer.computeConversationMetrics(json);
      EskayUsageTracker.setContextUsage(metrics.totalTokens);
      EskayUsageTracker.setCacheExpiry(metrics.cachedUntil);
    } catch (e) { }
  }

  async function handleUrlChange() {
    currentConversationId = getConversationId();
    EskayExporter.setActiveConversationData(null);
    EskayUI.injectToolbar();
    EskayUI.attachHeader();

    if (!currentConversationId) {
      EskayUsageTracker.setContextUsage(0);
      return;
    }

    const orgId = EskayUsageTracker.getOrgId() || getOrgIdFromCookie();
    if (orgId) {
      EskayUsageTracker.setOrgId(orgId);
      await loadConversationData(orgId, currentConversationId);
    }
  }

  // Intercept history changes
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = function (...args) {
    const result = originalPushState(...args);
    handleUrlChange();
    return result;
  };
  history.replaceState = function (...args) {
    const result = originalReplaceState(...args);
    handleUrlChange();
    return result;
  };
  window.addEventListener('popstate', handleUrlChange);

  // branch changes (X / Y page clicks)
  document.addEventListener('click', (e) => {
    if (!currentConversationId) return;
    const btn = e.target.closest('button[aria-label="Previous"], button[aria-label="Next"]');
    if (!btn) return;
    const container = btn.closest('.inline-flex');
    const spans = container?.querySelectorAll('span') || [];
    const indicator = Array.from(spans).find((s) => /^\d+\s*\/\s*\d+$/.test(s.textContent.trim()));
    if (!indicator) return;
    const originalText = indicator.textContent;
    let observer = new MutationObserver(() => {
      if (indicator.textContent !== originalText) {
        observer.disconnect();
        const orgId = EskayUsageTracker.getOrgId() || getOrgIdFromCookie();
        if (orgId) loadConversationData(orgId, currentConversationId);
      }
    });
    observer.observe(indicator, { childList: true, characterData: true, subtree: true });
  });

  function initUserscript() {
    EskayUI.init();
    handleUrlChange();
    setInterval(() => { EskayUI.tick(); }, 1000);
    setInterval(() => {
      if (EskayUsageTracker.getOrgId()) { EskayUsageTracker.pollUsage(); }
    }, 30000);
  }

  // Wait for GPTTokenizer to load from CDN
  function waitForTokenizer() {
    if (globalThis.GPTTokenizer_o200k_base) {
      initUserscript();
    } else {
      setTimeout(waitForTokenizer, 50);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForTokenizer);
  } else {
    waitForTokenizer();
  }
})();
