// test/consolidation-test-runner.js - Node test runner for Eskay memory consolidation
const fs = require('fs');
const path = require('path');

// Mock browser globals for node testing
global.window = {};

// Load vectorStore and consolidate
const vectorStoreCode = fs.readFileSync(path.join(__dirname, '../eskay/memory/vectorStore.js'), 'utf8');
const consolidateCode = fs.readFileSync(path.join(__dirname, '../eskay/memory/consolidate.js'), 'utf8');

eval(vectorStoreCode);
eval(consolidateCode);

const VectorStore = global.window.EskayVectorStore;
const Consolidator = global.window.EskayConsolidator;

// Mock in-memory DB for node execution
class MockMemoryStore {
  constructor() {
    this.records = new Map();
  }

  async saveRecord(record) {
    this.records.set(record.id, { ...record });
    return record.id;
  }

  async getAllRecords() {
    return Array.from(this.records.values());
  }

  async getRecordsBySession(sessionId) {
    return Array.from(this.records.values()).filter(r => r.sessionId === sessionId);
  }

  async deleteRecord(id) {
    this.records.delete(id);
  }

  cosineSimilarity(vecA, vecB) {
    return VectorStore.cosineSimilarity(vecA, vecB);
  }

  getEmbedding(text) {
    return VectorStore.getEmbedding(text);
  }
}

async function runConsolidationTests() {
  console.log('--- Running Eskay Memory Consolidation Test Suite ---');
  let passed = 0;
  let total = 0;

  const mockStore = new MockMemoryStore();
  global.window.EskayVectorStore = mockStore;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
    }
  }

  const now = Date.now();

  // Test 1: Near-duplicate goal consolidation
  const goalTextOld = "Our primary goal is to build a high-performance token counter browser extension.";
  const goalTextNew = "Our primary goal is to build a high-performance token counter extension for developer productivity.";
  
  const oldGoal = {
    id: 'goal-old',
    sessionId: 'session-1',
    timestamp: now - 10000,
    type: 'goal',
    text: goalTextOld,
    embedding: mockStore.getEmbedding(goalTextOld)
  };
  const newGoal = {
    id: 'goal-new',
    sessionId: 'session-1',
    timestamp: now,
    type: 'goal',
    text: goalTextNew,
    embedding: mockStore.getEmbedding(goalTextNew)
  };

  await mockStore.saveRecord(oldGoal);
  await mockStore.saveRecord(newGoal);

  const sim = mockStore.cosineSimilarity(oldGoal.embedding, newGoal.embedding);
  assert(sim > 0.85, `Near-duplicate goal similarity should exceed 0.85 (got ${sim.toFixed(4)})`);

  const pruned = await Consolidator.consolidate();
  assert(pruned === 1, `Consolidator should prune exactly 1 duplicate record (pruned ${pruned})`);

  const remaining = await mockStore.getAllRecords();
  assert(remaining.length === 1, `Total records should be 1 after consolidation`);
  assert(remaining[0].id === 'goal-new', `Newer record should be retained, discarding older superseded record`);

  // Test 2: Different types should not merge even with overlapping words
  const decisionText = "Use PostgreSQL with Prisma ORM for relational database storage.";
  const constraintText = "Use PostgreSQL with Prisma ORM for relational database storage.";
  
  const recDecision = {
    id: 'dec-1',
    sessionId: 'session-2',
    timestamp: now,
    type: 'decision',
    text: decisionText,
    embedding: mockStore.getEmbedding(decisionText)
  };
  const recConstraint = {
    id: 'con-1',
    sessionId: 'session-2',
    timestamp: now + 500,
    type: 'constraint',
    text: constraintText,
    embedding: mockStore.getEmbedding(constraintText)
  };

  await mockStore.saveRecord(recDecision);
  await mockStore.saveRecord(recConstraint);

  const prunedDifferentTypes = await Consolidator.consolidate();
  assert(prunedDifferentTypes === 0, `Different category types should not be merged against each other (pruned ${prunedDifferentTypes})`);
  
  const countAfterTypeCheck = (await mockStore.getAllRecords()).length;
  assert(countAfterTypeCheck === 3, `Records count should remain 3 (1 goal + 1 decision + 1 constraint)`);

  // Test 3: Distinct decisions with low similarity should both be kept
  const distinctDecision = {
    id: 'dec-2',
    sessionId: 'session-3',
    timestamp: now + 1000,
    type: 'decision',
    text: 'Deploy the application frontend to Vercel and backend to Render.',
    embedding: mockStore.getEmbedding('Deploy the application frontend to Vercel and backend to Render.')
  };

  await mockStore.saveRecord(distinctDecision);
  const prunedDistinct = await Consolidator.consolidate();
  assert(prunedDistinct === 0, `Distinct records with low similarity should not be pruned (pruned ${prunedDistinct})`);
  
  const finalRecords = await mockStore.getAllRecords();
  assert(finalRecords.length === 4, `Final record count should be 4`);

  console.log(`\nConsolidation tests result: ${passed}/${total} passed (${(passed/total * 100).toFixed(1)}%)\n`);
  if (passed !== total) {
    process.exit(1);
  } else {
    console.log('All memory consolidation tests passed successfully.');
    process.exit(0);
  }
}

runConsolidationTests().catch(err => {
  console.error("Fatal error in consolidation tests:", err);
  process.exit(1);
});
