// Local check of one practice day against the real Supabase + Gemini.
// Usage: node scripts/run-local.mjs <day> [path-to-.env]
// Asserts that no real name or phone number is present in any text sent to Gemini.
import fs from 'node:fs';
import { practiceDay } from '../lib/practice.js';
import { nameParts, wordRe } from '../lib/scrub.js';

const day = Number(process.argv[2] || 1);
const envPath = process.argv[3] || '../cga-secrets/.env';
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const { runDay } = await import('../lib/run.js');

const sent = [];
const { run, funnel, reasons } = await runDay(day, { onSend: t => sent.push(t), log: m => console.log('·', m) });

// Privacy assertion over everything that left for Gemini.
const real = practiceDay(day).conversations;
const digits = t => t.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');
for (const text of sent) {
  for (const c of real) {
    for (const part of nameParts(c.person.name))
      if (wordRe(part).test(text)) throw new Error(`PRIVACY FAIL: name part of ${c.person.key} sent to Gemini`);
    if (c.person.phone && digits(text).includes(c.person.phone.slice(-8))) throw new Error(`PRIVACY FAIL: phone of ${c.person.key}`);
  }
}
console.log(`privacy OK — ${sent.length} Gemini payloads, no real names or phones`);

const c = funnel.counts;
if (!(c.message <= c.ad && c.booked <= c.message && c.attended <= c.booked)) throw new Error('funnel not monotonic');
console.log('counts', c, 'leak', funnel.leak && `${funnel.leak.from}→${funnel.leak.to} ${(funnel.leak.lostShare * 100).toFixed(0)}%`);
console.log('reasons', reasons.map(r => `${r.reason}:${r.count}`).join(' '));
console.log('status', run.status, 'model', run.summary.model);
for (const [s, v] of Object.entries(run.summary.stages)) console.log(`  ${s}: ${v.problem} | ${v.fix}`);
