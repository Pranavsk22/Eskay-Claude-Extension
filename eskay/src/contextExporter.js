// contextExporter.js - DOM scraping and structured JSON tree context exporter
(function() {
  'use strict';

  let activeConversationData = null;

  // Walk parent-child tree to extract chronological messages
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
    const ROOT_MESSAGE_ID = '00000000-0000-4000-8000-000000000000';
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
        if (item.type === 'text' && typeof item.text === 'string') {
          textParts.push(item.text);
        } else if (item.type === 'tool_use') {
          textParts.push(`[Tool Use: ${item.name} with input ${JSON.stringify(item.input)}]`);
        } else if (item.type === 'tool_result') {
          textParts.push(`[Tool Result for ${item.tool_use_id}: ${typeof item.content === 'string' ? item.content : JSON.stringify(item.content)}]`);
        }
      });
      
      const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
      const attachmentNames = [];
      attachments.forEach(a => {
        const name = a.file_name || a.name || 'Attachment';
        attachmentNames.push(name);
        if (a.extracted_content) {
          textParts.push(`[Attached File: ${name}]\n${a.extracted_content}`);
        }
      });

      const combinedText = textParts.join('\n\n');

      // Extract code blocks from the text using regex
      const codeBlocks = [];
      const codeRegex = /```([a-zA-Z0-9+#-]+)?\n([\s\S]*?)```/g;
      let match;
      while ((match = codeRegex.exec(combinedText)) !== null) {
        codeBlocks.push({
          lang: (match[1] || 'text').trim().toLowerCase(),
          code: match[2]
        });
      }

      return {
        role,
        text: combinedText,
        codeBlocks,
        attachments: attachmentNames
      };
    });
  }

  // Fallback: DOM Scraper
  function scrapeConversationFromDOM() {
    const elements = document.querySelectorAll('[data-testid="user-message"], [data-testid="assistant-message"], .font-user, .font-claude');
    const messages = [];

    elements.forEach((el) => {
      let role = 'User';
      if (el.matches('[data-testid="assistant-message"]') || el.classList.contains('font-claude')) {
        role = 'Assistant';
      } else if (el.closest('[data-testid="assistant-message"]') || el.closest('.font-claude')) {
        role = 'Assistant';
      }

      let isNested = false;
      for (const m of messages) {
        if (m.element.contains(el)) {
          isNested = true;
          break;
        }
      }
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
          if (langClass) {
            lang = langClass.replace(/^(language-|lang-)/, '');
          }
        }
        
        if (codeText.trim()) {
          codeBlocks.push({ lang: lang.toLowerCase(), code: codeText });
        }
      });

      const attachments = [];
      const attachEls = el.querySelectorAll('.attachment-name, [data-testid*="attachment"], .attachment, .file-name');
      attachEls.forEach(att => {
        const name = (att.innerText || att.textContent || '').trim();
        if (name && !attachments.includes(name)) {
          attachments.push(name);
        }
      });

      messages.push({
        role,
        text,
        codeBlocks,
        attachments,
        element: el
      });
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
      if (hasKeyword && s.trim().length > 10 && s.trim().length < 250) {
        matches.push(s.trim());
      }
    });
    
    return matches;
  }

  async function getEmbedding(text) {
    const dimensions = 384;
    const vector = new Array(dimensions).fill(0);
    const words = (text || "").toLowerCase().match(/\b\w+\b/g) || [];
    
    if (words.length === 0) return vector;
    
    words.forEach(word => {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = (hash * 31 + word.charCodeAt(i)) | 0;
      }
      const index = Math.abs(hash) % dimensions;
      vector[index] += 1;
    });
    
    let magnitude = 0;
    for (let i = 0; i < dimensions; i++) {
      magnitude += vector[i] * vector[i];
    }
    magnitude = Math.sqrt(magnitude);
    if (magnitude > 0) {
      for (let i = 0; i < dimensions; i++) {
        vector[i] /= magnitude;
      }
    }
    return vector;
  }

  const EskayExporter = {
    setActiveConversationData(data) {
      activeConversationData = data;
    },

    getActiveConversationData() {
      return activeConversationData;
    },

    async exportContext() {
      const match = window.location.pathname.match(/\/chat\/([^/?]+)/);
      const sessionId = match ? match[1] : 'unknown-session';
      if (!match) {
        if (window.EskayUI) {
          window.EskayUI.showToast("No active conversation found to retrieve context from.");
        }
        return;
      }

      let messages = null;
      let usedTree = false;

      if (activeConversationData) {
        try {
          messages = parseConversationFromTree(activeConversationData);
          if (messages && messages.length > 0) {
            usedTree = true;
          }
        } catch (e) {
          console.warn("Eskay: tree parsing failed, falling back to DOM scraper", e);
        }
      }

      if (!usedTree) {
        messages = scrapeConversationFromDOM();
      }

      if (!messages || messages.length === 0) {
        if (window.EskayUI) {
          window.EskayUI.showToast("No chat messages found to extract context.");
        }
        return;
      }

      if (window.EskayUI) {
        window.EskayUI.showToast("Retrieving and indexing conversation context...");
      }

      // Calculate approximate tokens of the whole conversation
      let fullConversationText = '';
      messages.forEach(m => {
        fullConversationText += `${m.role}: ${m.text}\n\n`;
      });
      const tokenCount = window.EskayTokenizer ? window.EskayTokenizer.countTokens(fullConversationText) : Math.ceil(fullConversationText.length / 4);

      // Determine Primary Goal (skipping initial simple greetings)
      const userMessages = messages.filter(m => m.role === 'User');
      let primaryGoal = "Develop and build the project as discussed in the conversation.";
      if (userMessages.length > 0) {
        let firstSubstantialMsg = "";
        const greetings = /^(hi|hello|hey|yo|good morning|good afternoon|good evening|greetings)\b/i;
        for (const msg of userMessages) {
          const cleanedText = window.EskayOptimizer ? window.EskayOptimizer.sanitize(msg.text) : msg.text.replace(/^Task:\s*/i, '');
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

      // Heuristic lists for accomplishments, decisions, next steps
      const accomplishments = [];
      const decisions = [];
      const handoffNextSteps = [];
      const allCodeBlocks = [];

      messages.forEach(m => {
        m.codeBlocks.forEach(cb => {
          allCodeBlocks.push(cb);
        });
      });

      if (allCodeBlocks.length > 0) {
        accomplishments.push(`Successfully generated ${allCodeBlocks.length} code file(s)/artifact(s) (including ${Array.from(new Set(allCodeBlocks.map(c => c.lang))).join(', ')} implementations).`);
      }

      const assistantMessages = messages.filter(m => m.role === 'Assistant');

      // 1. Extract List Items from Assistant Messages
      assistantMessages.forEach(m => {
        const lines = m.text.split('\n');
        lines.forEach(line => {
          const trimmed = line.trim();
          if (!trimmed) return;
          
          // Match bullet points, numbered lists, status emojis
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
            if (!accomplishments.includes(indentedLine)) {
              accomplishments.push(indentedLine);
            }
          } else if (isPending) {
            if (!handoffNextSteps.includes(indentedLine)) {
              handoffNextSteps.push(indentedLine);
            }
          } else {
            // General bullet
            if (lower.includes('need') || lower.includes('next') || lower.includes('should') || lower.includes('todo') || lower.includes('question')) {
              if (!handoffNextSteps.includes(indentedLine)) {
                handoffNextSteps.push(indentedLine);
              }
            } else {
              if (!decisions.includes(indentedLine)) {
                decisions.push(indentedLine);
              }
            }
          }
        });
      });

      // 2. Extract key prose sentences as backup or additional details
      const proseAccomplishments = [];
      const proseNextSteps = [];

      assistantMessages.forEach(m => {
        const sentences = m.text.split(/(?<=[.?!])\s+/);
        sentences.forEach(s => {
          const trimmedS = s.trim();
          if (trimmedS.length < 15 || trimmedS.length > 400) return;

          // Avoid adding lines that start with bullet formats since we parsed them
          if (/^[*\-\+•\d\.\)\s]+/.test(trimmedS)) return;

          const lower = trimmedS.toLowerCase();

          // Accomplishment keywords in prose
          if (lower.includes('successfully') || lower.includes('completed') || lower.includes('implemented') || lower.includes('resolved') || lower.includes('shipped') || lower.includes('fixed')) {
            proseAccomplishments.push(trimmedS);
          }

          // Next steps/Questions in prose
          if (lower.includes('next step') || lower.includes('todo') || lower.includes('should') || lower.includes('remaining') || lower.includes('double-checking') || lower.includes('still need') || trimmedS.includes('?')) {
            proseNextSteps.push(trimmedS);
          }
        });
      });

      proseAccomplishments.forEach(pa => {
        if (!accomplishments.some(a => a.includes(pa) || pa.includes(a))) {
          accomplishments.push(pa);
        }
      });

      proseNextSteps.forEach(pn => {
        if (!handoffNextSteps.some(n => n.includes(pn) || pn.includes(pn))) {
          handoffNextSteps.push(pn);
        }
      });

      // 3. Extract Decisions from prose keywords
      const decisionKeywords = ["let's use", "we decided", "the approach is", "decided to", "we choose", "using", "framework", "library"];
      const proseDecisions = [];
      messages.forEach(m => {
        proseDecisions.push(...extractKeySentences(m.text, decisionKeywords));
      });

      const allAttachments = [];
      messages.forEach(m => {
        m.attachments.forEach(att => {
          if (!allAttachments.includes(att)) allAttachments.push(att);
        });
      });
      if (allAttachments.length > 0) {
        decisions.push(`Identified and utilized reference files: ${allAttachments.join(', ')}.`);
      }

      proseDecisions.forEach(d => {
        if (!decisions.some(existing => existing.includes(d) || d.includes(existing))) {
          decisions.push(d);
        }
      });

      // 4. Check for fallbacks if lists are empty
      if (accomplishments.length === 0) {
        accomplishments.push("Reviewed current project goals and status check.");
      }
      if (decisions.length === 0) {
        decisions.push("Aligned on basic project context and next objectives.");
      }
      if (handoffNextSteps.length === 0) {
        handoffNextSteps.push("Proceed with planned development milestones.");
        handoffNextSteps.push("Clarify any remaining requirements with the assistant.");
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

      // --- SEGMENT AND CHUNK INTO MEMORY RECORDS ---
      const candidateRecords = [];
      const seenTexts = new Set();

      function addCandidate(type, text, sourceIndex) {
        if (!text || typeof text !== 'string') return;
        const cleanText = text.trim();
        if (cleanText.length < 5) return;
        if (seenTexts.has(cleanText)) return;
        seenTexts.add(cleanText);

        const cleanType = type.replace(/[^a-zA-Z]/g, '');
        const randomId = Math.random().toString(36).substring(2, 11);
        const recordId = `${sessionId}-${cleanType}-${Date.now()}-${randomId}`;

        candidateRecords.push({
          id: recordId,
          sessionId: sessionId,
          timestamp: Date.now(),
          type: type,
          text: cleanText,
          embedding: [],
          sourceMessageIndex: sourceIndex !== undefined ? sourceIndex : 0
        });
      }

      // 1. Add Goal
      addCandidate('goal', primaryGoal, 0);

      // 2. Add Decisions & Constraints
      accomplishments.forEach(acc => {
        const lower = acc.toLowerCase();
        const isConstraint = lower.includes('must') || lower.includes('should') || lower.includes('limit') || lower.includes('constraint') || lower.includes('cannot') || lower.includes('do not');
        addCandidate(isConstraint ? 'constraint' : 'decision', acc, 0);
      });

      decisions.forEach(dec => {
        const lower = dec.toLowerCase();
        const isConstraint = lower.includes('must') || lower.includes('should') || lower.includes('limit') || lower.includes('constraint') || lower.includes('cannot') || lower.includes('do not');
        addCandidate(isConstraint ? 'constraint' : 'decision', dec, 0);
      });

      // 3. Add Snippets
      allCodeBlocks.forEach(cb => {
        const formattedSnippet = `Language: ${cb.lang}\n\`\`\`${cb.lang}\n${cb.code}\n\`\`\``;
        addCandidate('snippet', formattedSnippet, 0);
      });

      // 4. Add Next Steps
      handoffNextSteps.forEach(ns => {
        addCandidate('nextStep', ns, 0);
      });

      // Compute embeddings and save candidate records to IndexedDB

      for (const record of candidateRecords) {
        try {
          record.embedding = await getEmbedding(record.text);
          if (window.EskayVectorStore) {
            await window.EskayVectorStore.saveRecord(record);
          }
        } catch (err) {
          console.error("Eskay context embedding failed for record:", record, err);
        }
      }

      // --- RENDER MD VIEW FROM SAVED RECORDS ---
      const goals = candidateRecords.filter(r => r.type === 'goal').map(r => r.text);
      const accomplished = candidateRecords.filter(r => r.type === 'decision').map(r => r.text);
      const constraintsList = candidateRecords.filter(r => r.type === 'constraint').map(r => r.text);
      const snippets = candidateRecords.filter(r => r.type === 'snippet').map(r => r.text);
      const nexts = candidateRecords.filter(r => r.type === 'nextStep').map(r => r.text);

      let codeSection = "";
      if (snippets.length > 0) {
        snippets.slice(-4).forEach((snippetText, idx) => {
          codeSection += `### Artifact ${idx + 1}\n${snippetText}\n\n`;
        });
      } else {
        codeSection = "*No code blocks generated in this session yet.*\n";
      }

      // --- APPEND FULL CHAT HISTORY (USER REQUEST) ---
      let fullChatHistoryText = "";
      messages.forEach((m, idx) => {
        fullChatHistoryText += `### Message ${idx + 1} (${m.role})\n${m.text}\n\n`;
      });

      const dateTime = new Date().toLocaleString();

      const markdownContent = `# MASTER_PROMPT.md — Context Handoff Document
> Generated by Eskay on ${dateTime}
> Original chat had approximately ${tokenCount.toLocaleString()} tokens of context.

## 🎯 Primary Goal
${goals.length > 0 ? goals.join('\n\n') : primaryGoal}

## ✅ What Was Accomplished
${accomplished.length > 0 ? accomplished.map(a => {
  const spaces = a.match(/^(\s*)/)[0];
  return `${spaces}- ${a.slice(spaces.length)}`;
}).join('\n') : accomplishments.map(a => `- ${a}`).join('\n')}

${constraintsList.length > 0 ? `## ⚠️ Constraints & Guidelines\n${constraintsList.map(c => `- ${c}`).join('\n')}\n` : ''}
## 📋 Key Context & Decisions
${accomplished.length > 0 ? accomplished.map(d => `- ${d}`).join('\n') : decisions.map(d => `- ${d}`).join('\n')}

## 💻 Code / Artifacts
${codeSection}
## ❓ Unresolved / Next Steps
${nexts.length > 0 ? nexts.map(n => `- ${n}`).join('\n') : handoffNextSteps.map(n => `- ${n}`).join('\n')}

## 📎 How to Continue This Work
Attach this file to your new chat and begin with:

> "I'm continuing work from a previous session. The context document is attached.
> Please read it fully, confirm you understand the goal and current state, then
> ask me any clarifying questions before we proceed."

## 💬 Full Chat History
${fullChatHistoryText}

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
        
        if (window.EskayUI) {
          window.EskayUI.showToast("✓ Context file downloaded! In your new chat, click the 📎 attachment icon and attach MASTER_PROMPT.md before your first message.");
        }
      } catch (err) {
        console.error('Eskay context download failed:', err);
        if (window.EskayUI) {
          window.EskayUI.showToast("Failed to download MASTER_PROMPT.md.");
        }
      }
    }
  };

  window.EskayExporter = EskayExporter;
})();
