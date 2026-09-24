// Tiny Supabase REST helper — plain fetch, no SDK. Server side only (uses the secret key).
const base = () => `${process.env.SUPABASE_URL}/rest/v1/`;

function headers(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...extra };
}

async function call(method, path, body, extra) {
  const res = await fetch(base() + path, {
    method, headers: headers(extra), body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${path.split('?')[0]} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// select('cga_runs', 'order=day.desc&limit=1')
export const select = (table, query = '') => call('GET', `${table}?${query}`);

export const insert = (table, rows) =>
  rows.length ? call('POST', table, rows, { Prefer: 'return=minimal' }) : null;

export const upsert = (table, rows, onConflict) =>
  rows.length
    ? call('POST', `${table}${onConflict ? `?on_conflict=${onConflict}` : ''}`, rows,
        { Prefer: 'resolution=merge-duplicates,return=minimal' })
    : null;

export const update = (table, query, patch) =>
  call('PATCH', `${table}?${query}`, patch, { Prefer: 'return=representation' });

export const remove = (table, query) => call('DELETE', `${table}?${query}`, undefined, { Prefer: 'return=minimal' });
