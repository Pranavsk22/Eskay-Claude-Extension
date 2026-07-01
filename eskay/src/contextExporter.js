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

  const EskayExporter = {
    setActiveConversationData(data) {
      activeConversationData = data;
    },

    getActiveConversationData() {
      return activeConversationData;
    },

    exportContext() {
      const match = window.location.pathname.match(/\/chat\/([^/?]+)/);
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

      // Extract Code Blocks Verbatim
      let codeSection = "";
      if (allCodeBlocks.length > 0) {
        const uniqueCodes = [];
        const seenCodes = new Set();
        allCodeBlocks.forEach(cb => {
          const hash = cb.code.trim().substring(0, 100);
          if (!seenCodes.has(hash)) {
            seenCodes.add(hash);
            uniqueCodes.push(cb);
          }
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
