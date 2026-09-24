// The daily alarm target. Vercel Cron calls it with `Authorization: Bearer <CRON_SECRET>`.
// For the demo it can also be triggered by hand: /api/run-daily?day=2&key=<CRON_SECRET>
import { runDay } from '../lib/run.js';
import { mode } from '../lib/source.js';
import { select } from '../lib/db.js';

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
  const [last] = await select('cga_runs', 'select=day&order=day.desc&limit=1');
  return (last?.day || 0) + 1;
}

export async function GET(request) {
  const url = new URL(request.url);
  if (!authorised(request, url)) return json({ error: 'unauthorised' }, 401);
  const day = Number(url.searchParams.get('day')) || (await nextDay());
  try {
    const { run } = await runDay(day);
    return json({ ok: true, day, status: run.status, counts: run.counts });
  } catch (e) {
    return json({ ok: false, day, error: e.message }, 500);
  }
}
