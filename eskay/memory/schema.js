// schema.js - Schema definition and validation logic for Memory Records
(function() {
  'use strict';

  const MemoryRecordSchema = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      sessionId: { type: 'string' },
      timestamp: { type: 'number' },
      type: { type: 'string', enum: ['goal', 'decision', 'constraint', 'snippet', 'nextStep'] },
      text: { type: 'string' },
      embedding: { type: 'array', items: { type: 'number' } },
      sourceMessageIndex: { type: 'number' }
    },
    required: ['id', 'sessionId', 'timestamp', 'type', 'text', 'embedding', 'sourceMessageIndex']
  };

  // Hand-rolled lightweight validator for browser/extension context
  function validateMemoryRecord(record) {
    if (!record || typeof record !== 'object') return false;
    if (typeof record.id !== 'string') return false;
    if (typeof record.sessionId !== 'string') return false;
    if (typeof record.timestamp !== 'number') return false;
    if (!['goal', 'decision', 'constraint', 'snippet', 'nextStep'].includes(record.type)) return false;
    if (typeof record.text !== 'string') return false;
    if (!Array.isArray(record.embedding) || !record.embedding.every(n => typeof n === 'number')) return false;
    if (typeof record.sourceMessageIndex !== 'number') return false;
    return true;
  }

  const schemaExport = {
    schema: MemoryRecordSchema,
    validate: validateMemoryRecord
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = schemaExport;
  } else {
    window.EskaySchema = schemaExport;
  }
})();
