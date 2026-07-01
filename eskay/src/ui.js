// ui.js - Handles Eskay UI toolbar, header badges, tooltips, and click handlers
(function() {
  'use strict';

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

  let sessionResetMs = null;
  let weeklyResetMs = null;
  let sessionWindowStartMs = null;
  let weeklyWindowStartMs = null;

  // React-compatible input setting helper using execCommand to prevent text duplication
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

  // Format seconds countdown helper (MM:SS)
  function formatSeconds(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  // Format window reset countdown helper
  function formatResetCountdown(timestampMs) {
    const diffMs = timestampMs - Date.now();
    if (diffMs <= 0) return '0s';

    const totalSeconds = Math.floor(diffMs / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;

    const totalMinutes = Math.round(totalSeconds / 60);
    if (totalMinutes < 60) return `${totalMinutes}m`;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours < 24) return `${hours}h ${minutes}m`;

    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }

  function updateRetrieveButtonState() {
    const btn = document.getElementById('ek-btn-retrieve');
    if (!btn) return;
    
    const hasDataMessages = window.EskayExporter && 
      typeof window.EskayExporter.getActiveConversationData === 'function' &&
      window.EskayExporter.getActiveConversationData() && 
      Array.isArray(window.EskayExporter.getActiveConversationData().chat_messages) &&
      window.EskayExporter.getActiveConversationData().chat_messages.some(m => m.sender === 'human');

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
                   window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (isDark) {
      toolbar.classList.remove('ek-light-mode');
      toolbar.classList.add('ek-dark-mode');
    } else {
      toolbar.classList.remove('ek-dark-mode');
      toolbar.classList.add('ek-light-mode');
    }
  }

  // Tooltip Helper
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

  function setupTooltip(element, tooltip, { topOffset = 10 } = {}) {
    if (!element || !tooltip) return;
    if (element.hasAttribute('data-tooltip-setup')) return;
    element.setAttribute('data-tooltip-setup', 'true');

    let pressTimer;
    let hideTimer;

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

    const hide = () => {
      tooltip.style.opacity = '0';
      clearTimeout(hideTimer);
    };

    element.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        pressTimer = setTimeout(() => {
          show();
          hideTimer = setTimeout(hide, 3000);
        }, 500);
      }
    });

    element.addEventListener('pointerup', () => clearTimeout(pressTimer));
    element.addEventListener('pointercancel', () => {
      clearTimeout(pressTimer);
      hide();
    });

    element.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') show();
    });

    element.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') hide();
    });
  }

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
    const detected = window.EskayOptimizer.detectPromptFeatures(text);

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

  const EskayUI = {
    init() {
      // 1. Create header display elements
      headerContainer = document.createElement('div');
      headerContainer.className = 'ek-header-container';
      
      headerDisplay = document.createElement('span');
      lengthGroup = document.createElement('span');
      lengthDisplay = document.createElement('span');
      cachedDisplay = document.createElement('span');
      
      lengthGroup.appendChild(lengthDisplay);
      headerDisplay.appendChild(lengthGroup);
      headerContainer.appendChild(headerDisplay);

      // Initial injections
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

      // Tooltips Setup
      const lengthTooltip = makeTooltip(
        "Approximate BPE token count for current conversation.\nBar scale: 200k tokens context limit.\nTimer displays prompt cache life."
      );
      setupTooltip(lengthGroup, lengthTooltip, { topOffset: 8 });
      setupTooltip(cachedDisplay, makeTooltip("Conversation is actively cached in Claude's memory."), { topOffset: 8 });
    },

    findChatInputContainer() {
      const dropdown = document.querySelector(Eskay.DOM.MODEL_SELECTOR_DROPDOWN);
      if (!dropdown) return null;

      // Find the flex actions/toolbar row that holds buttons
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
      const chatMenu = document.querySelector(Eskay.DOM.CHAT_MENU_TRIGGER);
      if (!chatMenu) return;
      const anchor = chatMenu.closest(Eskay.DOM.CHAT_PROJECT_WRAPPER) || chatMenu.parentElement;
      if (!anchor) return;
      if (anchor.nextElementSibling !== headerContainer) {
        anchor.after(headerContainer);
      }
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
          <div class="ek-logo-group">
            <span class="ek-logo-dot"></span>
            <span>Eskay</span>
          </div>
          <button class="ek-toggle-sub ${isPanelOpen ? 'open' : ''}" id="ek-sub-toggle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>

        <div class="ek-sub-panel" id="ek-options-panel" style="display: ${isPanelOpen ? 'grid' : 'none'}">
          <label class="ek-checkbox-label">
            <input type="checkbox" id="ek-opt-clarify" ${optClarify}> 🧠 Ask clarification
          </label>
          <label class="ek-checkbox-label">
            <input type="checkbox" id="ek-opt-step" ${optStep}> 🔢 Step-by-step
          </label>
          <label class="ek-checkbox-label">
            <input type="checkbox" id="ek-opt-persona" ${optPersona}> 🎭 Set persona
          </label>
          <label class="ek-checkbox-label">
            <input type="checkbox" id="ek-opt-oneshot" ${optOneShot}> 📌 One-shot
          </label>
          <label class="ek-checkbox-label">
            <input type="checkbox" id="ek-opt-multishot" ${optMultiShot}> 🔁 Multi-shot
          </label>
          <label class="ek-checkbox-label">
            <input type="checkbox" id="ek-opt-format" ${optFormat}> 📐 Specify format
          </label>
          <label class="ek-checkbox-label">
            <input type="checkbox" id="ek-opt-context" ${optContext}> 🧩 Request context
          </label>
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
            <div class="ek-bar-header">
              <span class="ek-bar-label">SESSION</span>
              <span class="ek-bar-meta" id="ek-meta-session">0% used · resets soon</span>
            </div>
            <div class="ek-bar-outer">
              <div class="ek-bar-inner" id="ek-bar-session" style="width: 0%"></div>
              <div class="ek-bar-marker" id="ek-marker-session" style="left: 0%"></div>
            </div>
          </div>

          <div class="ek-bar-row" id="ek-row-weekly">
            <div class="ek-bar-header">
              <span class="ek-bar-label">WEEKLY</span>
              <span class="ek-bar-meta" id="ek-meta-weekly">0% used · resets soon</span>
            </div>
            <div class="ek-bar-outer">
              <div class="ek-bar-inner" id="ek-bar-weekly" style="width: 0%"></div>
              <div class="ek-bar-marker" id="ek-marker-weekly" style="left: 0%"></div>
            </div>
          </div>

          <div class="ek-bar-row" id="ek-row-context">
            <div class="ek-bar-header">
              <span class="ek-bar-label">CONTEXT</span>
              <span class="ek-bar-meta" id="ek-meta-context">~0 tokens · 0% of 200k</span>
            </div>
            <div class="ek-bar-outer">
              <div class="ek-bar-inner" id="ek-bar-context" style="width: 0%"></div>
            </div>
          </div>
        </div>
      `;

      // Insert toolbar inline below the input card wrapper (sibling of the wrapper, so it sits outside)
      const inputCard = container.parentNode;
      if (inputCard) {
        inputCard.style.flexShrink = '0';
      }
      if (inputCard && inputCard.parentNode) {
        inputCard.parentNode.insertBefore(toolbar, inputCard.nextSibling);
      } else {
        container.parentNode.insertBefore(toolbar, container.nextSibling);
      }

      // Attach event listeners
      this.attachListeners();

      // Tooltips for usage rows
      setupTooltip(document.getElementById('ek-row-session'), makeTooltip("5-hour rolling usage.\nBar: message count ratio used.\nVertical line: elapsed time ratio inside the window."), { topOffset: 8 });
      setupTooltip(document.getElementById('ek-row-weekly'), makeTooltip("7-day rolling usage.\nBar: message count ratio used.\nVertical line: elapsed time ratio inside the window."), { topOffset: 8 });
      setupTooltip(document.getElementById('ek-row-context'), makeTooltip("Approximate BPE token count for current conversation.\nBar scale: 200k tokens context limit."), { topOffset: 8 });

      // Retrieve cached delta
      const savedDelta = sessionStorage.getItem('eskay_last_saved_delta');
      if (savedDelta) {
        this.updateDeltaDisplay(parseInt(savedDelta, 10));
      }

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
        if (isPanelOpen) {
          panel.style.display = 'grid';
          btn.classList.add('open');
        } else {
          panel.style.display = 'none';
          btn.classList.remove('open');
        }
      });

      document.getElementById('ek-btn-minimize').addEventListener('click', () => {
        this.handleOptimize('minimize');
      });
      document.getElementById('ek-btn-maximize').addEventListener('click', () => {
        this.handleOptimize('maximize');
      });

      const optKeys = ['clarify', 'step', 'persona', 'oneshot', 'multishot', 'format', 'context', 'brutal'];
      optKeys.forEach(key => {
        const checkbox = document.getElementById(`ek-opt-${key}`);
        if (checkbox) {
          checkbox.addEventListener('change', () => {
            applySubOption(key, checkbox.checked);
          });
        }
      });

      document.getElementById('ek-btn-retrieve').addEventListener('click', () => {
        if (window.EskayExporter) {
          window.EskayExporter.exportContext();
        }
      });
      
      // Clicking the dashboard triggers a refresh of usage
      const dashboard = document.querySelector('.ek-dashboard');
      if (dashboard) {
        dashboard.addEventListener('click', () => {
          if (window.Eskay && window.Eskay.refreshUsage) {
            window.Eskay.refreshUsage();
          }
        });
      }
    },

    handleOptimize(mode) {
      const inputEl = document.querySelector('[contenteditable="true"], textarea');
      if (!inputEl) return;
      
      const currentText = inputEl.innerText || inputEl.value || '';
      if (!currentText.trim()) return;

      if (!window.EskayOptimizer || !window.EskayTokenizer) {
        return;
      }

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
      const optimized = window.EskayOptimizer.optimize(currentText, mode, options);
      
      const beforeTokens = window.EskayTokenizer.countTokens(currentText);
      const afterTokens = window.EskayTokenizer.countTokens(optimized);
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
      if (cacheTimeSpan) {
        cacheTimeSpan.style.color = pending ? '' : '#10B981';
      }
    },

    updateUsageBars() {
      if (!window.EskayUsageTracker) return;
      const usage = window.EskayUsageTracker.getUsage();

      const updateBar = (barId, metaId, markerId, pct, resetTime, windowHours) => {
        const bar = document.getElementById(barId);
        const meta = document.getElementById(metaId);
        const marker = document.getElementById(markerId);
        if (!bar || !meta) return;

        // Update progress bar
        bar.style.width = `${pct}%`;
        bar.className = 'ek-bar-inner';
        if (pct > 95) bar.classList.add('critical');
        else if (pct > 80) bar.classList.add('warning');

        // Countdown Text
        const countdownText = resetTime ? ` · resets in ${formatResetCountdown(resetTime)}` : ' · resets soon';
        meta.innerText = `${pct}% used${countdownText}`;

        // Time elapsed marker
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

      // Session (5h), Weekly (7d), and Context (200k)
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

      // In case we reattached or loaded, make sure header is updated
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

      // Format tokens
      const pct = Math.max(0, Math.min(100, (tokens / 200000) * 100));
      lengthDisplay.textContent = `~${tokens.toLocaleString()} tokens`;

      // Mini bar inside header
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

      // Cache Timer
      const now = Date.now();
      if (typeof cachedUntil === 'number' && cachedUntil > now) {
        lastCachedUntilMs = cachedUntil;
        const secsLeft = Math.max(0, Math.ceil((cachedUntil - now) / 1000));
        cacheTimeSpan = document.createElement('span');
        cacheTimeSpan.className = 'ek-header-cache-active';
        cacheTimeSpan.textContent = formatSeconds(secsLeft);
        if (pendingCache) cacheTimeSpan.style.color = '';
        else cacheTimeSpan.style.color = '#10B981';

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

      if (!hasCache) {
        headerContainer.style.display = 'none';
        return;
      }

      headerContainer.style.display = 'flex';
      headerDisplay.replaceChildren(cachedDisplay);
    },

    tick() {
      // Re-inject if missing
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

      // Tick the cache countdown
      const now = Date.now();
      if (lastCachedUntilMs && lastCachedUntilMs > now) {
        const secsLeft = Math.max(0, Math.ceil((lastCachedUntilMs - now) / 1000));
        if (cacheTimeSpan) {
          cacheTimeSpan.textContent = formatSeconds(secsLeft);
        }
      } else if (lastCachedUntilMs && lastCachedUntilMs <= now) {
        lastCachedUntilMs = null;
        cacheTimeSpan = null;
        pendingCache = false;
        cachedDisplay.textContent = '';
        this._renderHeader();
      }

      // Update progress bar countdown text and elapsed window markers
      if (window.EskayUsageTracker) {
        const usage = window.EskayUsageTracker.getUsage();
        
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
      }
    },

    showToast(message) {
      const oldToasts = document.querySelectorAll('.ek-toast');
      oldToasts.forEach(t => t.remove());

      const toast = document.createElement('div');
      toast.className = 'ek-toast';
      toast.innerHTML = `
        <div style="font-weight: 600; color: var(--cb-orange)">Eskay Context Export</div>
        <div>${message}</div>
      `;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('ek-toast-fadeout');
        setTimeout(() => {
          toast.remove();
        }, 300);
      }, 6000);
    }
  };

  window.EskayUI = EskayUI;
})();
