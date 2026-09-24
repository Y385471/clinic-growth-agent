// The daily alarm target. Vercel Cron calls it with `Authorization: Bearer <CRON_SECRET>`.
// For the demo it can also be triggered by hand: /api/run-daily?day=2&key=<CRON_SECRET>
// A failed run is recorded as "failed"; the pages keep showing the last good day.
import { runDay } from '../lib/run.js';
import { mode } from '../lib/source.js';
import { select, upsert } from '../lib/db.js';

const json = (body, status = 200) => Response.json(body, { status });

function authorised(request, url) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}` || url.searchParams.get('key') === secret;
}

async function nextDay() {
  if (mode() === 'live') {
    const d = new Date(Date.now() - 864e5); // yesterday, as yyyymmdd
    return Number(d.toISOString().slice(0, 10).replaceAll('-', ''));
  }
  const [last] = await select('cga_runs', 'select=day&status=neq.failed&order=day.desc&limit=1');
  return (last?.day || 0) + 1; // a failed day is retried on the next alarm
}

export async function GET(request) {
  const url = new URL(request.url);
  if (!authorised(request, url)) return json({ error: 'unauthorised' }, 401);
  const day = Number(url.searchParams.get('day')) || (await nextDay());
  try {
    const { run } = await runDay(day, { simulateSourceError: url.searchParams.get('simulate') === 'source_error' });
    return json({ ok: true, day, status: run.status, counts: run.counts });
  } catch (e) {
    // Never overwrite a good day with a failure; otherwise record it so the owner sees the banner.
    const [existing] = await select('cga_runs', `day=eq.${day}&select=status`).catch(() => []);
    if (!existing || existing.status === 'failed')
      await upsert('cga_runs', [{ day, mode: mode(), status: 'failed', error: e.message, finished_at: new Date().toISOString() }], 'day').catch(() => {});
    return json({ ok: false, day, error: e.message }, 500);
  }
}
