// test/intent-test-runner.js
const fs = require('fs');
const path = require('path');

global.window = {};
eval(fs.readFileSync(path.join(__dirname, '../eskay/src/optimizer.js'), 'utf8'));
const Opt = global.window.EskayOptimizer;

const casesPath = path.join(__dirname, 'intent-disambiguation-cases.json');
const casesData = JSON.parse(fs.readFileSync(casesPath, 'utf8'));

const INTENT_TYPE_PATTERNS = [
  { type: 'learn_concept',   pattern: /^\s*(teach me|explain|help me understand|walk me through|give me an overview of|what is|what's)\b/i },
  { type: 'review_critique', pattern: /\b(review|check|look over|critique|give feedback on|rate|assess|proofread|grade)\s+(my|this|the|a)\b/i },
  { type: 'debug_fix',       pattern: /\b(fix|debug|why (is|isn't|doesn't|won't)|what's wrong with|troubleshoot)\b/i },
  { type: 'decide_choose',   pattern: /\b(should i|which (is|one)|help me (decide|choose)|pros and cons|.+\b(vs|versus)\b.+)/i },
  { type: 'generate_create', pattern: /^\s*(write|create|generate|draft|build me|make me)\b/i },
  { type: 'plan_architect',  pattern: /\b(design|architect|plan out|how should i structure|help me plan)\b/i },
];

// Recreate categories list to trace scoring
const AMBIGUOUS_TERMS = {
  resume: {
    positive: /\b(review|check|feedback on|improve|rate|proofread|look over|critique|land (a|the) (job|interview))\b.{0,40}\b(my|this|the|a)?\s*(resume|cv)\b|\b(resume|cv)\b.{0,40}\b(review|feedback|improve|strong|weak)\b/i,
    negative:  /\bresume\s+(the|this|our|from|where we|task|conversation|project|download|job|script|process|training|upload)\b/i
  },
  design: {
    positive: /\b(review|critique|feedback on|improve|rate)\b.{0,30}\b(design|mockup|layout|ui|poster|banner)\b/i,
    negative: /\bdesigned to\b|\bby design\b|\bsystem design\b|\bapi design\b|\bdatabase design\b/i
  },
  model: {
    positive: /\b(train|evaluate|deploy|fine-?tune|dataset|regression|classification|accuracy)\b.{0,40}\bmodel\b/i,
    negative: /\brole model\b|\bfashion model\b|\bbusiness model\b|\bmental model\b/i
  }
};

function isTermUsedAs(text, term) {
  const rule = AMBIGUOUS_TERMS[term];
  if (!rule) return true;
  if (rule.negative.test(text)) return false;
  return rule.positive.test(text);
}

let total = 0;
let correct = 0;

casesData.cases.forEach(c => {
  total++;
  let casePassed = true;
  const errors = [];

  const gotIntent = Opt.detectIntentType(c.prompt);
  if (gotIntent.type !== c.expectedIntent) {
    casePassed = false;
    errors.push(`Expected intent "${c.expectedIntent}", got "${gotIntent.type}"`);
  }

  const actualMatches = INTENT_TYPE_PATTERNS.filter(p => p.pattern.test(c.prompt));
  const hasMultipleIntents = actualMatches.length > 1;

  if (c.expectedIntent !== 'learn_concept' && hasMultipleIntents) {
    if (gotIntent.confidence >= 1) {
      casePassed = false;
      errors.push(`Expected lower confidence (< 1) for ambiguous intent, got ${gotIntent.confidence}`);
    }
  }

  if (c.id === 'learn-ambiguous-01' && gotIntent.confidence >= 1) {
    casePassed = false;
    errors.push(`Expected lower confidence (< 1) for learn-ambiguous-01, got ${gotIntent.confidence}`);
  }

  const gotDomain = Opt.detectDomain(c.prompt);
  const gotCategory = Opt.detectCategory(c.prompt);
  let domainMatch = false;

  if (c.expectedDomain === null) {
    domainMatch = (gotDomain === 'default' && gotCategory === 'default');
  } else {
    domainMatch = (gotDomain === c.expectedDomain || gotCategory === c.expectedDomain);
  }

  if (!domainMatch) {
    casePassed = false;
    errors.push(`Expected domain/category "${c.expectedDomain}", got domain "${gotDomain}" and category "${gotCategory}"`);
  }

  if (c.expectedTopicIncludes !== null && c.expectedTopicIncludes !== undefined) {
    const gotTopic = Opt.extractTopic(c.prompt);
    if (!gotTopic || !gotTopic.toLowerCase().includes(c.expectedTopicIncludes.toLowerCase())) {
      casePassed = false;
      errors.push(`Expected topic to include "${c.expectedTopicIncludes}", got "${gotTopic}"`);
    }
  }

  if (casePassed) {
    correct++;
  } else {
    console.log(`FAIL [${c.id}] prompt: "${c.prompt}"`);
    errors.forEach(err => console.log(`  - ${err}`));
  }
});

const pct = (100 * correct / total).toFixed(1);
console.log(`\n${correct}/${total} passed (${pct}%)`);

if (correct / total < 0.9) {
  console.log('BELOW 90% ACCURACY TARGET -- do not ship.');
  process.exit(1);
} else {
  console.log('Above 90% target. Safe to ship.');
  process.exit(0);
}
