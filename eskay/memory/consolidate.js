// consolidate.js - Periodic memory pruning and near-duplicate consolidation
(function() {
  'use strict';

  async function consolidate() {
    const vectorStore = window.EskayVectorStore || (typeof require !== 'undefined' && require('./vectorStore.js'));
    if (!vectorStore) {
      console.warn("Eskay: vector store not available for consolidation");
      return 0;
    }

    const records = await vectorStore.getAllRecords();
    if (records.length <= 1) return 0;

    const toDelete = new Set();

    // 1. Deduplicate based on vector similarity (> 0.85 similarity)
    for (let i = 0; i < records.length; i++) {
      const recA = records[i];
      if (toDelete.has(recA.id)) continue;

      for (let j = i + 1; j < records.length; j++) {
        const recB = records[j];
        if (toDelete.has(recB.id)) continue;

        // Group similarity by type or consolidate near-duplicate goals/constraints
        if (recA.type !== recB.type) continue;

        const score = vectorStore.cosineSimilarity(recA.embedding, recB.embedding);
        if (score > 0.85) {
          // Keep the newer one (higher timestamp) and delete the older one
          if (recA.timestamp >= recB.timestamp) {
            toDelete.add(recB.id);
          } else {
            toDelete.add(recA.id);
            break; // Stop comparing recA since it's marked for deletion
          }
        }
      }
    }

    // 2. Prune old/superseded constraints or decisions if newer ones exist
    // E.g., if there's a newer record of the same type and the old one has low similarity but is in the same session
    // We let the near-duplicate check handle the core merging.

    // 3. Perform deletes
    let pruneCount = 0;
    for (const id of toDelete) {
      try {
        await vectorStore.deleteRecord(id);
        pruneCount++;
      } catch (err) {
        console.error("Eskay: failed to delete consolidated record:", id, err);
      }
    }

    return pruneCount;
  }

  const consolidateExport = {
    consolidate
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = consolidateExport;
  }
  if (typeof window !== 'undefined') {
    window.EskayConsolidator = consolidateExport;
  }
})();
