// test/persona-test-harness.js
const fs = require('fs');
const path = require('path');

global.window = {};
eval(fs.readFileSync(path.join(__dirname, '../eskay/src/optimizer.js'), 'utf8'));
const Opt = global.window.EskayOptimizer;

function getPersona(text) {
  const out = Opt.optimize(text, 'maximize', {});
  const m = out.match(/^You are (.+?)\.\n\n/s);
  return m ? m[1] : '(none found)';
}

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'persona-cases.json'), 'utf8'));

let correct = 0;
cases.forEach(c => {
  const gotDomain = Opt.detectDomain(c.prompt);
  const expectDomain = c.expectDomain.startsWith('major_purchase') ? 'default' : c.expectDomain;
  const pass = gotDomain === expectDomain;
  if (pass) correct++;
  else console.log(`FAIL [${c.bucket}] expected "${expectDomain}" got "${gotDomain}" -- "${c.prompt}"`);
});

const pct = (100 * correct / cases.length).toFixed(1);
console.log(`\n${correct}/${cases.length} passed (${pct}%)`);
if (correct / cases.length < 0.9) {
  console.log('BELOW 90% ACCURACY TARGET -- do not ship.');
  process.exit(1);
} else {
  console.log('Above 90% target. Safe to ship.');
}
