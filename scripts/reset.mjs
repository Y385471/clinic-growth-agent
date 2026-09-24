// Wipes all practice data so the demo can start again from day 1.
// Usage: node scripts/reset.mjs [path-to-.env]
import fs from 'node:fs';

for (const line of fs.readFileSync(process.argv[2] || '../cga-secrets/.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
if (process.env.MODE === 'live') throw new Error('refusing to wipe data in live mode');
const { remove } = await import('../lib/db.js');
for (const t of ['cga_bookings', 'cga_conversations', 'cga_people', 'cga_ads', 'cga_reactions', 'cga_hypotheses', 'cga_runs'])
  await remove(t, ['cga_reactions', 'cga_runs'].includes(t) ? 'day=gte.0' : 'id=neq.none'); // PostgREST needs a filter to delete
console.log('practice data cleared');
