// content.js - Orchestrates the Eskay extension lifecycle and coordinates scripts
(() => {
  'use strict';

  const EK = (globalThis.Eskay = globalThis.Eskay || {});
  if (EK.__started) return;
  EK.__started = true;

  // DOM and Constant Definitions
  EK.DOM = Object.freeze({
    CHAT_MENU_TRIGGER: '[data-testid="chat-menu-trigger"]',
    MODEL_SELECTOR_DROPDOWN: '[data-testid="model-selector-dropdown"]',
    CHAT_PROJECT_WRAPPER: '.chat-project-wrapper',
    BRIDGE_SCRIPT_ID: 'ek-bridge-script'
  });

  EK.CONST = Object.freeze({
    CACHE_WINDOW_MS: 5 * 60 * 1000,
    CONTEXT_LIMIT_TOKENS: 200000
  });

  // --- 1. Bridge Client Implementation ---
  function makeRequestId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  class BridgeClient {
    constructor() {
      this._pending = new Map();
      this._listeners = new Map();

      window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.ek !== 'Eskay') return;

        if (data.type === 'ek:response') {
          const { requestId, ok, payload, error } = data;
          const pending = this._pending.get(requestId);
          if (!pending) return;
          this._pending.delete(requestId);
          clearTimeout(pending.timeoutId);
          if (ok) pending.resolve(payload);
          else pending.reject(new Error(error || 'Bridge request failed'));
          return;
        }

        this._emit(data.type, data.payload);
      });
    }

    _emit(type, payload) {
      const listeners = this._listeners.get(type);
      if (!listeners) return;
      for (const fn of listeners) {
        fn(payload);
      }
    }

    on(type, fn) {
      if (!this._listeners.has(type)) this._listeners.set(type, new Set());
      this._listeners.get(type).add(fn);
      return () => this._listeners.get(type)?.delete(fn);
    }

    request(kind, payload, { timeoutMs = 10000 } = {}) {
      const requestId = makeRequestId();
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this._pending.delete(requestId);
          reject(new Error(`Bridge request timed out (${kind})`));
        }, timeoutMs);

        this._pending.set(requestId, { resolve, reject, timeoutId });
        window.postMessage(
          {
            ek: 'Eskay',
            type: 'ek:request',
            requestId,
            kind,
            payload
          },
          '*'
        );
      });
    }

    async requestUsage(orgId) {
      return this.request('usage', { orgId }, { timeoutMs: 15000 });
    }

    async requestConversation(orgId, conversationId) {
      return this.request('conversation', { orgId, conversationId }, { timeoutMs: 20000 });
    }

    async requestHash(text) {
      return this.request('hash', { text }, { timeoutMs: 5000 });
    }
  }

  EK.bridge = new BridgeClient();

  // --- 2. main-world Injection ---
  let bridgeReadyPromise = null;
  function injectBridgeOnce() {
    if (bridgeReadyPromise) return bridgeReadyPromise;

    if (document.getElementById(EK.DOM.BRIDGE_SCRIPT_ID)) {
      return Promise.resolve(true);
    }

    bridgeReadyPromise = new Promise((resolve) => {
      const script = document.createElement('script');
      script.id = EK.DOM.BRIDGE_SCRIPT_ID;
      script.src = chrome.runtime.getURL('src/inject.js');
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      (document.head || document.documentElement).appendChild(script);
    });

    return bridgeReadyPromise;
  }

  EK.injectBridgeOnce = injectBridgeOnce;

  // --- 3. DOM & State Helpers ---
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
    } catch {
      return null;
    }
  }

  function waitForElement(selector, timeoutMs) {
    return new Promise((resolve) => {
      const existing = document.querySelector(selector);
      if (existing) {
        resolve(existing);
        return;
      }

      let timeoutId;
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          if (timeoutId) clearTimeout(timeoutId);
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      if (timeoutMs) {
        timeoutId = setTimeout(() => {
          observer.disconnect();
          resolve(null);
        }, timeoutMs);
      }
    });
  }

  EK.waitForElement = waitForElement;

  function observeUrlChanges(callback) {
    let lastPath = window.location.pathname;

    const fireIfChanged = () => {
      const current = window.location.pathname;
      if (current !== lastPath) {
        lastPath = current;
        callback();
      }
    };

    window.addEventListener('ek:urlchange', fireIfChanged);
    window.addEventListener('popstate', fireIfChanged);

    return () => {
      window.removeEventListener('ek:urlchange', fireIfChanged);
      window.removeEventListener('popstate', fireIfChanged);
    };
  }

  // --- 4. Orchestration State ---
  let currentConversationId = null;
  let currentOrgId = null;
  let usageFetchInFlight = false;

  const bridgeReady = injectBridgeOnce();

  function updateOrgIdIfNeeded(newOrgId) {
    if (newOrgId && typeof newOrgId === 'string' && newOrgId !== currentOrgId) {
      currentOrgId = newOrgId;
      if (window.EskayUsageTracker) {
        window.EskayUsageTracker.setOrgId(newOrgId);
      }
    }
  }

  async function refreshUsage() {
    await bridgeReady;
    const orgId = currentOrgId || getOrgIdFromCookie();
    if (!orgId) return;
    updateOrgIdIfNeeded(orgId);

    if (usageFetchInFlight) return;
    usageFetchInFlight = true;
    try {
      const raw = await EK.bridge.requestUsage(orgId);
      if (window.EskayUsageTracker) {
        window.EskayUsageTracker.setUsageData(raw);
      }
    } catch (e) {
      console.warn('Eskay: usage refresh failed', e);
    } finally {
      usageFetchInFlight = false;
    }
  }

  EK.refreshUsage = refreshUsage;

  async function refreshConversation() {
    await bridgeReady;
    if (!currentConversationId) {
      if (window.EskayUsageTracker) {
        window.EskayUsageTracker.setContextUsage(0);
      }
      return;
    }

    const orgId = currentOrgId || getOrgIdFromCookie();
    if (!orgId) return;
    updateOrgIdIfNeeded(orgId);

    try {
      // Trigger request to load conversation tree
      await EK.bridge.requestConversation(orgId, currentConversationId);
    } catch (e) {
      console.warn('Eskay: conversation refresh request failed', e);
    }
  }

  EK.refreshConversation = refreshConversation;

  function handleGenerationStart() {
    if (!currentConversationId) return;
    if (window.EskayUI) {
      window.EskayUI.setPendingCache(true);
    }
  }

  async function handleConversationPayload({ orgId, conversationId, data }) {
    if (!conversationId || conversationId !== currentConversationId) return;
    updateOrgIdIfNeeded(orgId);
    if (!data) return;

    // Cache the active conversation data inside Exporter
    if (window.EskayExporter) {
      window.EskayExporter.setActiveConversationData(data);
    }

    if (window.EskayTokenizer) {
      const metrics = await window.EskayTokenizer.computeConversationMetrics(data);
      if (window.EskayUsageTracker) {
        window.EskayUsageTracker.setContextUsage(metrics.totalTokens);
        window.EskayUsageTracker.setCacheExpiry(metrics.cachedUntil);
      }
      if (window.EskayUI) {
        window.EskayUI.setPendingCache(false);
      }
    }
  }

  function handleMessageLimit(messageLimit) {
    if (window.EskayUsageTracker) {
      window.EskayUsageTracker.setUsageDataFromSSE(messageLimit);
    }
  }

  // Register listeners on bridge
  EK.bridge.on('ek:generation_start', handleGenerationStart);
  EK.bridge.on('ek:conversation', handleConversationPayload);
  EK.bridge.on('ek:message_limit', handleMessageLimit);

  async function handleUrlChange() {
    currentConversationId = getConversationId();

    if (window.EskayExporter) {
      window.EskayExporter.setActiveConversationData(null);
    }

    if (window.EskayUI) {
      window.EskayUI.injectToolbar();
    }

    if (!currentConversationId) {
      if (window.EskayUsageTracker) {
        window.EskayUsageTracker.setContextUsage(0);
      }
      return;
    }

    updateOrgIdIfNeeded(getOrgIdFromCookie());
    await refreshConversation();

    // Poll usage if stale
    const usage = window.EskayUsageTracker ? window.EskayUsageTracker.getUsage() : null;
    if (!usage || (!usage.session.pct && !usage.weekly.pct)) {
      await refreshUsage();
    }
  }

  // URL Mutation Observer Setup
  const unobserveUrl = observeUrlChanges(handleUrlChange);
  window.addEventListener('beforeunload', unobserveUrl);

  // Re-inject and reload on chat branch navigations (X / Y page toggles)
  document.addEventListener('click', (e) => {
    if (!currentConversationId) return;
    const btn = e.target.closest('button[aria-label="Previous"], button[aria-label="Next"]');
    if (!btn) return;

    const container = btn.closest('.inline-flex');
    const spans = container?.querySelectorAll('span') || [];
    const indicator = Array.from(spans).find((s) => /^\d+\s*\/\s*\d+$/.test(s.textContent.trim()));
    if (!indicator) return;

    const originalText = indicator.textContent;
    let branchObserver = new MutationObserver(() => {
      if (indicator.textContent !== originalText) {
        branchObserver.disconnect();
        refreshConversation();
      }
    });

    branchObserver.observe(indicator, { childList: true, characterData: true, subtree: true });
    setTimeout(() => branchObserver.disconnect(), 60000);
  });

  // Ticking logic
  function tick() {
    if (window.EskayUI) {
      window.EskayUI.tick();
    }

    // Refresh when limit resets occur
    if (window.EskayUsageTracker) {
      const usage = window.EskayUsageTracker.getUsage();
      const now = Date.now();
      
      if (usage.session.resetTime && now >= usage.session.resetTime) {
        usage.session.resetTime = null; // Clear so we don't spam
        refreshUsage();
      }
      if (usage.weekly.resetTime && now >= usage.weekly.resetTime) {
        usage.weekly.resetTime = null;
        refreshUsage();
      }
    }
  }

  // Main UI Initialization Check
  function checkInit() {
    if (window.EskayUI && window.EskayTokenizer) {
      window.EskayUI.init();
      handleUrlChange();
      setInterval(tick, 1000);
    } else {
      setTimeout(checkInit, 50);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkInit);
  } else {
    checkInit();
  }
})();
