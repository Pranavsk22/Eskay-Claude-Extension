// vectorStore.js - Local vector store backed by IndexedDB and in-memory cosine similarity
(function() {
  'use strict';

  const DB_NAME = 'EskayMemoryDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'records';

  let dbInstance = null;

  function initDB() {
    return new Promise((resolve, reject) => {
      if (dbInstance) {
        return resolve(dbInstance);
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('Eskay DB error:', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('sessionId', 'sessionId', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  function getStore(mode) {
    return initDB().then(db => {
      const transaction = db.transaction([STORE_NAME], mode);
      return transaction.objectStore(STORE_NAME);
    });
  }

  function saveRecord(record) {
    return new Promise((resolve, reject) => {
      // Validate schema
      const validator = window.EskaySchema || (typeof require !== 'undefined' && require('./schema.js'));
      if (!validator || !validator.validate(record)) {
        return reject(new Error('Invalid MemoryRecord schema'));
      }

      getStore('readwrite').then(store => {
        const request = store.put(record);
        request.onsuccess = () => resolve(record.id);
        request.onerror = (e) => reject(e.target.error);
      }).catch(reject);
    });
  }

  function getAllRecords() {
    return new Promise((resolve, reject) => {
      getStore('readonly').then(store => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (e) => reject(e.target.error);
      }).catch(reject);
    });
  }

  function getRecordsBySession(sessionId) {
    return new Promise((resolve, reject) => {
      getStore('readonly').then(store => {
        const index = store.index('sessionId');
        const request = index.getAll(IDBKeyRange.only(sessionId));
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (e) => reject(e.target.error);
      }).catch(reject);
    });
  }

  function deleteRecord(id) {
    return new Promise((resolve, reject) => {
      getStore('readwrite').then(store => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
      }).catch(reject);
    });
  }

  function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  function search(queryEmbedding, limit = 5, options = {}) {
    const sessionId = options.sessionId || null;
    const typeFilter = options.type || null;

    const fetchPromise = sessionId 
      ? getRecordsBySession(sessionId) 
      : getAllRecords();

    return fetchPromise.then(records => {
      // Filter by type if option is set
      let filtered = records;
      if (typeFilter) {
        filtered = records.filter(r => r.type === typeFilter);
      }

      // Compute similarity score for each record
      const scored = filtered.map(record => {
        const score = cosineSimilarity(queryEmbedding, record.embedding);
        return {
          record,
          similarity: score
        };
      });

      // Filter out low scores (e.g. similarity < 0.1) and sort descending
      const sorted = scored
        .filter(item => item.similarity > 0.1)
        .sort((a, b) => b.similarity - a.similarity);

      // Return top-k records
      return sorted.slice(0, limit).map(item => ({
        ...item.record,
        similarity: item.similarity
      }));
    });
  }

  const storeExport = {
    initDB,
    saveRecord,
    getAllRecords,
    getRecordsBySession,
    deleteRecord,
    search,
    cosineSimilarity
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = storeExport;
  } else {
    window.EskayVectorStore = storeExport;
  }
})();
