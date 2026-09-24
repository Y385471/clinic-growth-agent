// Receptionist attendance: GET lists the day's bookings, POST marks one person attended (or not).
// Practice mode shows the practice names. Live mode shows real names only with the staff key (?k=STAFF_KEY),
// so the public link never exposes patients.
import { select, update } from '../lib/db.js';
import { decrypt } from '../lib/scrub.js';
import { mode } from '../lib/source.js';

const json = (body, status = 200) => Response.json(body, { status });
const staffOk = url => mode() !== 'live' || (process.env.STAFF_KEY && url.searchParams.get('k') === process.env.STAFF_KEY);

export async function GET(request) {
  const url = new URL(request.url);
  if (!staffOk(url)) return json({ error: 'staff key required' }, 401);
  try {
    const wanted = Number(url.searchParams.get('day'));
    const [run] = wanted
      ? await select('cga_runs', `day=eq.${wanted}`)
      : await select('cga_runs', 'status=neq.failed&order=day.desc&limit=1');
    if (!run) return json({ day: null, bookings: [] });
    const bookings = await select('cga_bookings', `day=eq.${run.day}&order=id`);
    const ids = bookings.map(b => `"${b.person_id}"`).join(',');
    const people = ids ? await select('cga_people', `id=in.(${ids})`) : [];
    const byId = Object.fromEntries(people.map(p => [p.id, p]));
    return json({
      day: run.day,
      bookings: bookings.map(b => {
        const p = byId[b.person_id];
        return { id: b.id, name: decrypt(p?.real_name_enc) || p?.alias, alias: p?.alias, booking_date: b.booking_date, attended: b.attended };
      }),
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function POST(request) {
  const url = new URL(request.url);
  if (!staffOk(url)) return json({ error: 'staff key required' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'send JSON: {"booking_id": "...", "attended": true}' }, 400); }
  const { booking_id, attended } = body || {};
  if (typeof booking_id !== 'string' || ![true, false, null].includes(attended))
    return json({ error: 'booking_id (string) and attended (true | false | null) are required' }, 400);
  try {
    const rows = await update('cga_bookings', `id=eq.${encodeURIComponent(booking_id)}`, { attended });
    if (!rows.length) return json({ error: 'booking not found' }, 404);
    return json({ ok: true, booking: { id: rows[0].id, attended: rows[0].attended } });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
