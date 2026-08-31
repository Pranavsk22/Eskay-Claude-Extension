// recall_eval.js - LongMemEval-style evaluation harness for cross-session vector recall accuracy
(function() {
  'use strict';

  async function runEvaluation(logResult, updateOverallStatus) {
    try {
      logResult(true, "Fetching test set...");
      const response = await fetch('testset.json');
      const testCases = await response.json();
      
      logResult(true, "Clearing evaluation database...");
      if (window.EskayVectorStore) {
        await new Promise((resolve) => {
          const req = indexedDB.deleteDatabase('EskayMemoryDB');
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        });
        await window.EskayVectorStore.initDB();
      }

      function getLocalEmbedding(text) {
        if (window.EskayVectorStore && typeof window.EskayVectorStore.getEmbedding === 'function') {
          return window.EskayVectorStore.getEmbedding(text);
        }
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

      let passedCount = 0;
      let totalCount = testCases.length;

      for (const tc of testCases) {
        logResult(true, `[Test ${tc.id}] Seeding session: ${tc.sessionId}`);
        
        // Seed database: embed and save history messages
        for (let i = 0; i < tc.history.length; i++) {
          const msg = tc.history[i];
          const text = msg.text;
          const type = tc.expectedType;
          
          const embedding = getLocalEmbedding(text);
          
          const record = {
            id: `${tc.sessionId}-msg-${i}-${Date.now()}`,
            sessionId: tc.sessionId,
            timestamp: Date.now(),
            type: type,
            text: text,
            embedding: embedding,
            sourceMessageIndex: i
          };
          
          await window.EskayVectorStore.saveRecord(record);
        }

        // Run query query
        logResult(true, `[Test ${tc.id}] Querying: "${tc.query}"`);
        const queryEmbedding = getLocalEmbedding(tc.query);
        
        const results = await window.EskayVectorStore.search(queryEmbedding, 3);
        
        // Check results
        if (!results || results.length === 0) {
          logResult(false, `[Test ${tc.id}] Fail: No records retrieved.`);
          continue;
        }

        const topRecord = results[0];
        const hasFact = topRecord.text.toLowerCase().includes(tc.expectedFact.toLowerCase());
        const hasType = topRecord.type === tc.expectedType;
        
        if (hasFact && hasType) {
          logResult(true, `[Test ${tc.id}] PASS: Retrieved correct record ("${topRecord.text}") with type "${topRecord.type}" (similarity: ${topRecord.similarity.toFixed(4)})`);
          passedCount++;
        } else {
          logResult(false, `[Test ${tc.id}] FAIL: Retrieved text "${topRecord.text}" of type "${topRecord.type}" but expected "${tc.expectedFact}" of type "${tc.expectedType}"`);
        }
      }

      // Consolidation verification test phase
      totalCount++;
      logResult(true, "[Consolidation Test] Testing near-duplicate memory pruning (>0.85 similarity)...");
      if (window.EskayConsolidator) {
        const now = Date.now();
        const oldDecision = {
          id: 'test-dup-1-old',
          sessionId: 'session-dup-test',
          timestamp: now - 50000,
          type: 'decision',
          text: 'We decided to use Redis for session caching and rate limit APIs.',
          embedding: getLocalEmbedding('We decided to use Redis for session caching and rate limit APIs.'),
          sourceMessageIndex: 0
        };
        const newDecision = {
          id: 'test-dup-1-new',
          sessionId: 'session-dup-test',
          timestamp: now,
          type: 'decision',
          text: 'We decided to use Redis for session caching and rate limit APIs.',
          embedding: getLocalEmbedding('We decided to use Redis for session caching and rate limit APIs.'),
          sourceMessageIndex: 1
        };
        const distinctConstraint = {
          id: 'test-distinct-1',
          sessionId: 'session-dup-test',
          timestamp: now,
          type: 'constraint',
          text: 'Never expose confidential database credentials in client code.',
          embedding: getLocalEmbedding('Never expose confidential database credentials in client code.'),
          sourceMessageIndex: 2
        };

        await window.EskayVectorStore.saveRecord(oldDecision);
        await window.EskayVectorStore.saveRecord(newDecision);
        await window.EskayVectorStore.saveRecord(distinctConstraint);

        const preRecords = await window.EskayVectorStore.getRecordsBySession('session-dup-test');
        const prunedCount = await window.EskayConsolidator.consolidate();
        const postRecords = await window.EskayVectorStore.getRecordsBySession('session-dup-test');

        const keptNew = postRecords.some(r => r.id === 'test-dup-1-new');
        const deletedOld = !postRecords.some(r => r.id === 'test-dup-1-old');
        const keptDistinct = postRecords.some(r => r.id === 'test-distinct-1');

        if (preRecords.length === 3 && prunedCount >= 1 && postRecords.length === 2 && keptNew && deletedOld && keptDistinct) {
          logResult(true, `[Consolidation Test] PASS: Near-duplicate pruned successfully (${preRecords.length} -> ${postRecords.length} records, retained newest timestamp).`);
          passedCount++;
        } else {
          logResult(false, `[Consolidation Test] FAIL: Expected 3 -> 2 records, got pre=${preRecords.length}, pruned=${prunedCount}, post=${postRecords.length}`);
        }
      } else {
        logResult(false, "[Consolidation Test] FAIL: EskayConsolidator not loaded.");
      }

      const passRate = (passedCount / totalCount) * 100;
      const passed = passRate >= 80;
      logResult(passed, `Evaluation complete. Pass Rate: ${passRate.toFixed(1)}% (${passedCount}/${totalCount})`);
      updateOverallStatus(passed, `Pass Rate: ${passRate.toFixed(1)}% (${passedCount}/${totalCount})`);
    } catch (err) {
      console.error(err);
      logResult(false, `Error running evaluation: ${err.message}`);
    }
  }

  const evalExport = {
    runEvaluation
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = evalExport;
  } else {
    window.EskayEval = evalExport;
  }
})();
