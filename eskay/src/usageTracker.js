// usageTracker.js - Handles Eskay usage state (5-hour and 7-day limits)
(function() {
  'use strict';

  let orgId = null;
  let usageState = {
    session: { pct: 0, resetTime: null },
    weekly: { pct: 0, resetTime: null },
    context: { tokens: 0, pct: 0 },
    cache: { resetTime: null }
  };

  // Helper to parse /usage endpoint response
  function parseUsageFromUsageEndpoint(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const normalizeWindow = (w) => {
      if (!w || typeof w !== 'object') return null;
      if (typeof w.utilization !== 'number' || !Number.isFinite(w.utilization)) return null;
      const utilization = Math.round(Math.max(0, Math.min(100, w.utilization)));
      const resets_at = typeof w.resets_at === 'string' ? Date.parse(w.resets_at) : null;
      return { utilization, resets_at };
    };

    const fiveHour = normalizeWindow(raw.five_hour);
    const sevenDay = normalizeWindow(raw.seven_day);

    if (!fiveHour && !sevenDay) return null;
    return { five_hour: fiveHour, seven_day: sevenDay };
  }

  // Helper to parse SSE message limit event
  function parseUsageFromMessageLimit(raw) {
    if (!raw?.windows || typeof raw.windows !== 'object') return null;

    const normalizeWindow = (w) => {
      if (!w || typeof w !== 'object') return null;
      if (typeof w.utilization !== 'number' || !Number.isFinite(w.utilization)) return null;
      const utilization = Math.round(Math.max(0, Math.min(100, w.utilization * 100)));
      const resets_at = typeof w.resets_at === 'number' && Number.isFinite(w.resets_at)
        ? w.resets_at * 1000
        : null;
      return { utilization, resets_at };
    };

    const fiveHour = normalizeWindow(raw.windows['5h']);
    const sevenDay = normalizeWindow(raw.windows['7d']);

    if (!fiveHour && !sevenDay) return null;
    return { five_hour: fiveHour, seven_day: sevenDay };
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

    if (window.EskayUI) {
      window.EskayUI.updateUsageBars();
    }

    chrome.storage.local.set({ lastUsageState: usageState, lastOrgId: orgId });
  }

  const EskayUsageTracker = {
    setOrgId(id) {
      if (!id || id === orgId) return;
      orgId = id;
      this.pollUsage();
    },

    getOrgId() {
      return orgId;
    },

    pollUsage() {
      if (orgId && window.Eskay) {
        window.Eskay.refreshUsage();
      }
    },

    setUsageData(raw) {
      const parsed = parseUsageFromUsageEndpoint(raw);
      applyUsageUpdate(parsed);
    },

    setUsageDataFromSSE(messageLimit) {
      const parsed = parseUsageFromMessageLimit(messageLimit);
      applyUsageUpdate(parsed);
    },

    setContextUsage(tokens) {
      usageState.context.tokens = tokens;
      usageState.context.pct = Math.min(100, Math.round((tokens / 200000) * 100));
      if (window.EskayUI) {
        window.EskayUI.updateUsageBars();
      }
    },

    setCacheExpiry(resetTime) {
      usageState.cache.resetTime = resetTime;
      if (window.EskayUI) {
        window.EskayUI.updateUsageBars();
      }
    },

    getUsage() {
      return usageState;
    },

    init() {
      // Load last known usage state from storage
      chrome.storage.local.get(['lastUsageState', 'lastOrgId'], (result) => {
        if (result.lastUsageState) {
          const cacheTime = result.lastUsageState.cache?.resetTime;
          usageState = result.lastUsageState;
          // Clean up cache timer if already expired
          if (cacheTime && cacheTime > Date.now()) {
            usageState.cache.resetTime = cacheTime;
          } else {
            usageState.cache.resetTime = null;
          }
        }
        if (result.lastOrgId) {
          orgId = result.lastOrgId;
          this.pollUsage();
        }
        if (window.EskayUI) {
          window.EskayUI.updateUsageBars();
        }
      });
    }
  };

  window.EskayUsageTracker = EskayUsageTracker;
})();
