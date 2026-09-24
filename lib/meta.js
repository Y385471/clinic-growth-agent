// Live mode: reads the clinic's own Facebook page through Meta's official Graph API and returns
// exactly the same shape as lib/practice.js. Needs (set in Vercel only, never committed):
//   META_PAGE_ID, META_PAGE_TOKEN (page access token), META_AD_ACCOUNT (digits, without "act_")
// Optional: META_GRAPH_VERSION (default v23.0).

const version = () => process.env.META_GRAPH_VERSION || 'v23.0';

// yyyymmdd → { since, until } as unix seconds for that UTC day
export function dayRange(day) {
  const s = String(day);
  const start = Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)) / 1000;
  return { since: start, until: start + 86400, iso: `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` };
}

async function graphAll(path, params, fetchImpl) {
  const out = [];
  let url = `https://graph.facebook.com/${version()}/${path}?${new URLSearchParams({ ...params, access_token: process.env.META_PAGE_TOKEN })}`;
  for (let page = 0; url && page < 20; page++) {
    const res = await fetchImpl(url);
    const body = await res.json();
    if (!res.ok || body.error) throw new Error(`Meta ${path}: ${body.error?.message || res.status}`);
    out.push(...(body.data || []));
    url = body.paging?.next || null;
  }
  return out;
}

const minutesBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 60000);

// One patient thread (messages or a comment with replies) → shared conversation shape.
function toConversation({ id, day, source, patient, items, pageId }) {
  const sorted = items.filter(m => m.text).sort((a, b) => new Date(a.time) - new Date(b.time));
  const firstPatient = sorted.find(m => m.fromId !== pageId);
  if (!firstPatient) return null;
  const t0 = firstPatient.time;
  const firstReply = sorted.find(m => m.fromId === pageId && new Date(m.time) >= new Date(t0));
  return {
    id, day, ad_id: null, source,
    person: { key: `p-${patient.id}`, name: patient.name || 'بدون اسم', phone: null },
    first_reply_minutes: firstReply ? minutesBetween(t0, firstReply.time) : null,
    messages: sorted.filter(m => new Date(m.time) >= new Date(t0))
      .map(m => ({ from: m.fromId === pageId ? 'clinic' : 'patient', minute: minutesBetween(t0, m.time), text: m.text })),
  };
}

export async function liveDay(day, { fetchImpl = fetch } = {}) {
  const pageId = process.env.META_PAGE_ID;
  if (!pageId || !process.env.META_PAGE_TOKEN) throw new Error('live mode needs META_PAGE_ID and META_PAGE_TOKEN');
  const { since, until, iso } = dayRange(day);
  const inDay = t => { const s = new Date(t) / 1000; return s >= since && s < until; };

  // Ads: message-button results per ad for the day.
  let ads = [];
  if (process.env.META_AD_ACCOUNT) {
    const rows = await graphAll(`act_${process.env.META_AD_ACCOUNT}/insights`, {
      level: 'ad', fields: 'ad_id,ad_name,spend,reach,clicks,actions',
      time_range: JSON.stringify({ since: iso, until: iso }),
    }, fetchImpl);
    ads = rows.map(r => {
      const started = (r.actions || []).find(a => a.action_type === 'onsite_conversion.messaging_conversation_started_7d');
      return { id: `d${day}-ad${r.ad_id}`, day, name: r.ad_name, spend: Number(r.spend || 0), reach: Number(r.reach || 0), clicks: Number(started?.value ?? r.clicks ?? 0) };
    });
  }

  // Messenger conversations updated during the day.
  const threads = await graphAll(`${pageId}/conversations`, {
    platform: 'messenger', fields: 'id,updated_time,participants,messages.limit(50){message,from,created_time}',
  }, fetchImpl);
  const conversations = [];
  for (const t of threads.filter(t => inDay(t.updated_time))) {
    const patient = (t.participants?.data || []).find(p => p.id !== pageId) || { id: t.id };
    const items = (t.messages?.data || []).filter(m => inDay(m.created_time))
      .map(m => ({ fromId: m.from?.id, text: m.message, time: m.created_time }));
    const c = toConversation({ id: `d${day}-m${t.id.slice(-10)}`, day, source: 'message', patient, items, pageId });
    if (c) conversations.push(c);
  }

  // Post comments (with the page's replies) and reactions.
  const posts = await graphAll(`${pageId}/posts`, {
    since, until, fields: 'id,created_time,reactions.summary(total_count).limit(0),comments.limit(100){id,from,message,created_time,comments.limit(20){from,message,created_time}}',
  }, fetchImpl).catch(() => []);
  const reactions = [];
  for (const p of posts) {
    reactions.push({ day, post_id: p.id, type: 'ALL', count: p.reactions?.summary?.total_count || 0 });
    for (const cm of p.comments?.data || []) {
      if (!inDay(cm.created_time) || cm.from?.id === pageId) continue;
      const items = [{ fromId: cm.from?.id, text: cm.message, time: cm.created_time },
        ...(cm.comments?.data || []).map(r => ({ fromId: r.from?.id, text: r.message, time: r.created_time }))];
      const c = toConversation({ id: `d${day}-k${cm.id.slice(-10)}`, day, source: 'comment', patient: cm.from || { id: cm.id }, items, pageId });
      if (c) conversations.push(c);
    }
  }

  // Person keys must be unique per day (one person may both message and comment): keep the first.
  const seen = new Set();
  const unique = conversations.filter(c => (seen.has(c.person.key) ? false : seen.add(c.person.key)))
    .map(c => ({ ...c, person: { ...c.person, key: `d${day}-${c.person.key}` } }));
  return { ads, conversations: unique, reactions };
}
