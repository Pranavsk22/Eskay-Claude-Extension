// trajectoryVisualizer.js - Interactive conversation trajectory and agent debugging inspector
(function() {
  'use strict';

  let modalElement = null;

  function countApproxTokens(text) {
    if (window.EskayTokenizer && typeof window.EskayTokenizer.countTokens === 'function') {
      return window.EskayTokenizer.countTokens(text);
    }
    return Math.ceil((text || '').length / 4);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function createModal() {
    if (document.getElementById('eskay-trajectory-modal')) {
      return document.getElementById('eskay-trajectory-modal');
    }

    const modal = document.createElement('div');
    modal.id = 'eskay-trajectory-modal';
    modal.className = 'ek-trajectory-overlay';
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(10, 10, 15, 0.85);
      backdrop-filter: blur(8px);
      z-index: 100010;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    modal.innerHTML = `
      <div class="ek-traj-card" style="
        background: #181825;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 14px;
        width: 900px;
        max-width: 95vw;
        height: 85vh;
        max-height: 850px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 20px 50px rgba(0,0,0,0.6);
        color: #cdd6f4;
      ">
        <div class="ek-traj-header" style="
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255, 255, 255, 0.02);
        ">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: #7C3AED; box-shadow: 0 0 8px #7C3AED;"></div>
            <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #fff;">Eskay Trajectory Inspector</h2>
            <span id="ek-traj-badge" style="font-size: 11px; padding: 2px 8px; background: rgba(124, 58, 237, 0.2); color: #c4b5fd; border-radius: 10px; border: 1px solid rgba(124, 58, 237, 0.4);">Live Chat Trunk</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button id="ek-traj-btn-export" style="
              background: rgba(232, 114, 28, 0.15);
              border: 1px solid rgba(232, 114, 28, 0.4);
              color: #fdba74;
              font-size: 12px;
              padding: 5px 12px;
              border-radius: 6px;
              cursor: pointer;
              transition: all 0.2s;
            ">Export MD</button>
            <button id="ek-traj-btn-close" style="
              background: rgba(255, 255, 255, 0.08);
              border: 1px solid rgba(255, 255, 255, 0.1);
              color: #a6adc8;
              font-size: 14px;
              width: 28px;
              height: 28px;
              border-radius: 6px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
            ">&times;</button>
          </div>
        </div>

        <div class="ek-traj-toolbar" style="
          padding: 10px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(0, 0, 0, 0.2);
          font-size: 12px;
        ">
          <div style="display: flex; gap: 8px;" id="ek-traj-tabs">
            <button class="ek-traj-tab active" data-tab="timeline" style="background: rgba(124, 58, 237, 0.25); color: #fff; border: 1px solid rgba(124, 58, 237, 0.4); padding: 4px 10px; border-radius: 5px; cursor: pointer;">Timeline View</button>
            <button class="ek-traj-tab" data-tab="artifacts" style="background: rgba(255, 255, 255, 0.05); color: #a6adc8; border: 1px solid rgba(255, 255, 255, 0.08); padding: 4px 10px; border-radius: 5px; cursor: pointer;">Artifacts & Code</button>
            <button class="ek-traj-tab" data-tab="memory" style="background: rgba(255, 255, 255, 0.05); color: #a6adc8; border: 1px solid rgba(255, 255, 255, 0.08); padding: 4px 10px; border-radius: 5px; cursor: pointer;">Extracted Memories</button>
          </div>
          <div id="ek-traj-metrics" style="color: #9399b2; font-family: monospace; font-size: 11px;">
            0 messages · 0 tokens
          </div>
        </div>

        <div id="ek-traj-content" style="
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        "></div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#ek-traj-btn-close').addEventListener('click', () => {
      modal.style.display = 'none';
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });

    modal.querySelector('#ek-traj-btn-export').addEventListener('click', () => {
      if (window.EskayExporter && typeof window.EskayExporter.exportContext === 'function') {
        window.EskayExporter.exportContext();
      }
    });

    const tabs = modal.querySelectorAll('.ek-traj-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => {
          t.style.background = 'rgba(255, 255, 255, 0.05)';
          t.style.color = '#a6adc8';
          t.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          t.classList.remove('active');
        });
        tab.style.background = 'rgba(124, 58, 237, 0.25)';
        tab.style.color = '#fff';
        tab.style.borderColor = 'rgba(124, 58, 237, 0.4)';
        tab.classList.add('active');
        renderTabContent(tab.getAttribute('data-tab'));
      });
    });

    return modal;
  }

  let currentTrajectoryData = { messages: [] };

  function renderTabContent(tabName) {
    const container = document.getElementById('ek-traj-content');
    if (!container) return;
    container.innerHTML = '';

    const messages = currentTrajectoryData.messages || [];

    if (messages.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: #6c7086; margin-top: 60px;">
          <p style="font-size: 14px;">No active chat messages detected.</p>
          <p style="font-size: 12px;">Start a conversation on Claude.ai or select an existing chat to view its trajectory.</p>
        </div>
      `;
      return;
    }

    if (tabName === 'timeline') {
      messages.forEach((msg, idx) => {
        const isUser = msg.role === 'User';
        const tok = countApproxTokens(msg.text);
        const card = document.createElement('div');
        card.style.cssText = `
          background: ${isUser ? 'rgba(124, 58, 237, 0.08)' : 'rgba(255, 255, 255, 0.03)'};
          border: 1px solid ${isUser ? 'rgba(124, 58, 237, 0.25)' : 'rgba(255, 255, 255, 0.06)'};
          border-radius: 10px;
          padding: 14px 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        `;

        let codePreview = '';
        if (msg.codeBlocks && msg.codeBlocks.length > 0) {
          codePreview = `<div style="margin-top: 6px; font-size: 11px; color: #a6e3a1; font-family: monospace;">📦 Contains ${msg.codeBlocks.length} code artifact(s) (${msg.codeBlocks.map(c => c.lang).join(', ')})</div>`;
        }

        let attachPreview = '';
        if (msg.attachments && msg.attachments.length > 0) {
          attachPreview = `<div style="margin-top: 4px; font-size: 11px; color: #f9e2af;">📎 Attachments: ${escapeHtml(msg.attachments.join(', '))}</div>`;
        }

        const previewText = escapeHtml(msg.text.length > 300 ? msg.text.slice(0, 297) + '...' : msg.text);

        card.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="
                font-weight: 600;
                color: ${isUser ? '#c4b5fd' : '#f97316'};
                background: ${isUser ? 'rgba(124, 58, 237, 0.2)' : 'rgba(232, 114, 28, 0.2)'};
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
              ">#${idx + 1} ${msg.role}</span>
              ${msg.attachments && msg.attachments.length > 0 ? '<span style="font-size: 10px; color: #f9e2af;">📎</span>' : ''}
            </div>
            <span style="font-family: monospace; font-size: 11px; color: #6c7086;">~${tok} tokens</span>
          </div>
          <div style="font-size: 13px; line-height: 1.5; color: #bac2de; white-space: pre-wrap;">${previewText}</div>
          ${codePreview}
          ${attachPreview}
        `;
        container.appendChild(card);
      });
    } else if (tabName === 'artifacts') {
      const codeArtifacts = [];
      messages.forEach((msg, mIdx) => {
        (msg.codeBlocks || []).forEach((cb, cIdx) => {
          codeArtifacts.push({ ...cb, messageIndex: mIdx + 1, role: msg.role });
        });
      });

      if (codeArtifacts.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: #6c7086; margin-top: 60px;">No code artifacts found in this trajectory.</div>`;
        return;
      }

      codeArtifacts.forEach((art, idx) => {
        const card = document.createElement('div');
        card.style.cssText = `
          background: #11111b;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          overflow: hidden;
        `;
        card.innerHTML = `
          <div style="padding: 8px 14px; background: rgba(255, 255, 255, 0.04); border-bottom: 1px solid rgba(255, 255, 255, 0.06); display: flex; justify-content: space-between; font-size: 11px; font-family: monospace;">
            <span style="color: #a6e3a1; font-weight: 600;">Artifact ${idx + 1} (${art.lang || 'code'}) — Message #${art.messageIndex}</span>
            <span style="color: #6c7086;">${art.code.split('\n').length} lines</span>
          </div>
          <pre style="margin: 0; padding: 14px; font-family: monospace; font-size: 12px; color: #cdd6f4; overflow-x: auto; line-height: 1.4;"><code>${escapeHtml(art.code)}</code></pre>
        `;
        container.appendChild(card);
      });
    } else if (tabName === 'memory') {
      // Memory Extraction Preview
      container.innerHTML = `
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 12px; font-size: 12px; color: #6ee7b7; margin-bottom: 8px;">
          💡 Structured knowledge chunks automatically indexed into client-side IndexedDB vector storage.
        </div>
      `;

      let extractedCount = 0;
      messages.forEach((msg, idx) => {
        const lines = msg.text.split(/(?<=[.?!])\s+/);
        lines.forEach(line => {
          const l = line.trim().toLowerCase();
          let type = null;
          if (l.includes('must') || l.includes('constraint') || l.includes('cannot') || l.includes('do not')) {
            type = 'constraint';
          } else if (l.includes('decided to') || l.includes('implemented') || l.includes('resolved') || l.includes('we choose')) {
            type = 'decision';
          } else if (l.includes('todo') || l.includes('next step') || l.includes('pending')) {
            type = 'nextStep';
          }

          if (type && line.trim().length > 15 && line.trim().length < 250) {
            extractedCount++;
            const item = document.createElement('div');
            item.style.cssText = `
              background: rgba(255, 255, 255, 0.03);
              border-left: 3px solid ${type === 'constraint' ? '#f38ba8' : type === 'decision' ? '#89b4fa' : '#f9e2af'};
              padding: 10px 14px;
              border-radius: 4px;
              font-size: 12px;
            `;
            item.innerHTML = `
              <div style="font-weight: 600; font-size: 11px; margin-bottom: 4px; text-transform: uppercase; color: ${type === 'constraint' ? '#f38ba8' : type === 'decision' ? '#89b4fa' : '#f9e2af'};">
                [${type}] · Source Message #${idx + 1}
              </div>
              <div style="color: #cdd6f4;">${escapeHtml(line.trim())}</div>
            `;
            container.appendChild(item);
          }
        });
      });

      if (extractedCount === 0) {
        const emptyNotice = document.createElement('div');
        emptyNotice.style.cssText = "color: #6c7086; font-size: 12px; text-align: center; margin-top: 30px;";
        emptyNotice.textContent = "No explicit constraint or decision sentences detected in this transcript.";
        container.appendChild(emptyNotice);
      }
    }
  }

  const TrajectoryVisualizer = {
    showModal() {
      const modal = createModal();
      
      let traj = { messages: [] };
      if (window.EskayExporter && typeof window.EskayExporter.getTrajectoryData === 'function') {
        traj = window.EskayExporter.getTrajectoryData();
      }
      currentTrajectoryData = traj;

      const totalTokens = (traj.messages || []).reduce((acc, m) => acc + countApproxTokens(m.text), 0);
      const metricsEl = modal.querySelector('#ek-traj-metrics');
      if (metricsEl) {
        metricsEl.textContent = `${(traj.messages || []).length} messages · ~${totalTokens.toLocaleString()} tokens · source: ${traj.source || 'active'}`;
      }

      // Reset to timeline tab
      const activeTab = modal.querySelector('.ek-traj-tab.active')?.getAttribute('data-tab') || 'timeline';
      renderTabContent(activeTab);

      modal.style.display = 'flex';
    },

    hideModal() {
      if (modalElement) {
        modalElement.style.display = 'none';
      }
    }
  };

  window.EskayTrajectoryVisualizer = TrajectoryVisualizer;
})();
