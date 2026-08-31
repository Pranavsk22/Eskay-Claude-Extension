// test/differential-tester.js - Automated differential testing framework for Eskay
const fs = require('fs');
const path = require('path');

global.window = {};

// Load tokenizer, vocab, and optimizer
try {
  eval(fs.readFileSync(path.join(__dirname, '../eskay/src/o200k_base.js'), 'utf8'));
  eval(fs.readFileSync(path.join(__dirname, '../eskay/src/tokenizer.js'), 'utf8'));
} catch (e) {
  // Tokenizer fallback if o200k_base is mock
}
eval(fs.readFileSync(path.join(__dirname, '../eskay/src/optimizer.js'), 'utf8'));

const Opt = global.window.EskayOptimizer;
const Tokenizer = global.window.EskayTokenizer;

function countTokens(text) {
  if (Tokenizer && typeof Tokenizer.countTokens === 'function') {
    return Tokenizer.countTokens(text);
  }
  return Math.ceil((text || '').length / 4);
}

// Sample benchmark prompts covering diverse domains, lengths, and intents
const BENCHMARK_PROMPTS = [
  {
    id: "diff-code-01",
    domain: "code",
    prompt: "Could you please help me write a clean python script using asyncio to scrape web pages without getting rate limited?"
  },
  {
    id: "diff-resume-01",
    domain: "resume",
    prompt: "Please review my resume for a senior staff software engineering role at Google and give me your honest critique."
  },
  {
    id: "diff-db-01",
    domain: "database_architecture",
    prompt: "I was wondering if we could design a PostgreSQL schema for a multi-tenant SaaS application with row-level security."
  },
  {
    id: "diff-legal-01",
    domain: "legal",
    prompt: "I need legal advice on this mutual non-disclosure agreement regarding trade secrets and intellectual property."
  },
  {
    id: "diff-explain-01",
    domain: "default",
    prompt: "Can you please explain how transformer self-attention mechanisms calculate Q, K, and V vectors?"
  },
  {
    id: "diff-marketing-01",
    domain: "marketing",
    prompt: "Draft a high-converting cold outreach email sequence targeting enterprise CTOs for our B2B DevOps product."
  },
  {
    id: "diff-medical-01",
    domain: "medical",
    prompt: "What are the common symptoms, contraindications, and clinical considerations when prescribing beta blockers?"
  },
  {
    id: "diff-finance-01",
    domain: "finance",
    prompt: "Build a discounted cash flow valuation model projection for a startup with $2M annual recurring revenue."
  }
];

function runDifferentialSuite() {
  console.log("===============================================================================");
  console.log("                 ESKAY AUTOMATED DIFFERENTIAL TESTING REPORT                   ");
  console.log("===============================================================================\n");

  let totalPrompts = BENCHMARK_PROMPTS.length;
  let totalRawTokens = 0;
  let totalMinTokens = 0;
  let totalMaxTokens = 0;
  let personaMatches = 0;

  const results = [];

  BENCHMARK_PROMPTS.forEach((tc, idx) => {
    const raw = tc.prompt;
    const rawTokens = countTokens(raw);
    totalRawTokens += rawTokens;

    // Differential 1: Minimize Tokens
    const minimized = Opt.optimize(raw, 'minimize');
    const minTokens = countTokens(minimized);
    totalMinTokens += minTokens;
    const minSavingsPct = (((rawTokens - minTokens) / rawTokens) * 100).toFixed(1);

    // Differential 2: Maximize Efficiency with Persona + Step
    const maximized = Opt.optimize(raw, 'maximize', { persona: true, step: true });
    const maxTokens = countTokens(maximized);
    totalMaxTokens += maxTokens;

    // Differential 3: Brutal Mode Diff
    const brutalOpt = Opt.optimize(raw, 'maximize', { brutal: true, persona: true });
    const hasBrutalTag = brutalOpt.toLowerCase().includes('brutal') || brutalOpt.toLowerCase().includes('unglazed');

    // Classification Diff
    const detectedIntent = Opt.detectIntentType(raw);
    const detectedDomain = Opt.detectDomain(raw);
    const detectedCat = Opt.detectCategory(raw);

    const isDomainAligned = (detectedCat === tc.domain) || (detectedDomain === tc.domain) || (tc.domain === 'default' && detectedDomain === 'default');
    if (isDomainAligned) personaMatches++;

    results.push({
      id: tc.id,
      prompt: raw.length > 50 ? raw.slice(0, 47) + "..." : raw,
      rawTokens,
      minTokens,
      minSavingsPct: `${minSavingsPct}%`,
      maxTokens,
      detectedDomain: `${detectedDomain} (${detectedCat})`,
      brutalVerified: hasBrutalTag ? "YES" : "NO",
      domainMatch: isDomainAligned ? "PASS" : "WARN"
    });
  });

  // Print results table
  console.table(results.map(r => ({
    "ID": r.id,
    "Raw Tok": r.rawTokens,
    "Min Tok": r.minTokens,
    "Savings": r.minSavingsPct,
    "Max Tok": r.maxTokens,
    "Detected Domain": r.detectedDomain,
    "Brutal": r.brutalVerified,
    "Routing": r.domainMatch
  })));

  const avgCompression = (((totalRawTokens - totalMinTokens) / totalRawTokens) * 100).toFixed(1);
  const routingAccuracy = ((personaMatches / totalPrompts) * 100).toFixed(1);

  console.log("\n----------------------------- Summary Metrics ---------------------------------");
  console.log(`Total Prompts Evaluated   : ${totalPrompts}`);
  console.log(`Total Raw Input Tokens    : ${totalRawTokens}`);
  console.log(`Minimized Tokens          : ${totalMinTokens} (${avgCompression}% token reduction)`);
  console.log(`Maximized Enriched Tokens : ${totalMaxTokens}`);
  console.log(`Domain Routing Alignment  : ${personaMatches}/${totalPrompts} (${routingAccuracy}%)`);
  console.log("-------------------------------------------------------------------------------\n");

  if (parseFloat(routingAccuracy) < 80.0) {
    console.error("❌ Differential Testing Failed: Domain routing accuracy below 80% threshold.");
    process.exit(1);
  }

  console.log("✅ Differential Testing Passed: All optimization differential gates satisfied.");
  return results;
}

if (require.main === module) {
  runDifferentialSuite();
} else {
  module.exports = { runDifferentialSuite, BENCHMARK_PROMPTS };
}
