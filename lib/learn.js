// Hypothesis Engine. Gemini may PROPOSE a hypothesis, but only from a fixed catalogue of metrics that
// this code knows how to compute, so every hypothesis is VERIFIED BY CODE against each new day's data.
import { gemini } from './analyse.js';
import { select, insert, upsert, remove } from './db.js';

const rate = (list, ok) => ({ n: list.length, value: list.length ? list.filter(ok).length / list.length : null });
const slowReply = c => c.first_reply_minutes == null || c.first_reply_minutes > 60;

// metric → { stage, label, compute(day data) → { value, n } }
export const METRICS = {
  message_booking_rate: {
    stage: 'booked', label: 'نسبة اللي حجزوا من اللي راسلوا',
    compute: d => rate(d.conversations, c => d.bookedIds.has(c.person_id)),
  },
  price_fast_booking_rate: {
    stage: 'booked', label: 'نسبة الحجز لما سؤال السعر يترد عليه خلال ساعة',
    compute: d => rate(d.conversations.filter(c => c.analysis?.asked_price && !slowReply(c)), c => d.bookedIds.has(c.person_id)),
  },
  price_slow_booking_rate: {
    stage: 'booked', label: 'نسبة الحجز لما سؤال السعر يتأخر أكتر من ساعة أو ما يترد عليه',
    compute: d => rate(d.conversations.filter(c => c.analysis?.asked_price && slowReply(c)), c => d.bookedIds.has(c.person_id)),
  },
  fast_reply_share: {
    stage: 'booked', label: 'نسبة المحادثات اللي اترد عليها خلال ساعة',
    compute: d => rate(d.conversations, c => !slowReply(c)),
  },
  fear_booking_rate: {
    stage: 'booked', label: 'نسبة الحجز عند اللي عندهم خوف',
    compute: d => rate(d.conversations.filter(c => c.analysis?.signals?.fear), c => d.bookedIds.has(c.person_id)),
  },
  comment_booking_rate: {
    stage: 'booked', label: 'نسبة الحجز من التعليقات',
    compute: d => rate(d.conversations.filter(c => c.source === 'comment'), c => d.bookedIds.has(c.person_id)),
  },
  click_message_rate: {
    stage: 'message', label: 'نسبة اللي بدأوا محادثة من ضغطات زر المراسلة',
    compute: d => { const clicks = d.ads.reduce((s, a) => s + a.clicks, 0); return { n: clicks, value: clicks ? d.conversations.length / clicks : null }; },
  },
  attendance_rate: {
    stage: 'attended', label: 'نسبة الحضور من الحجوزات',
    compute: d => d.bookings.some(b => b.attended === null) ? { n: 0, value: null } : rate(d.bookings, b => b.attended === true),
  },
};
const MIN_N = 3; // fewer cases than this → "not enough data", status unchanged

const pct = v => `${Math.round(v * 100)}%`;
const passes = (value, direction, threshold) => (direction === 'above' ? value > Number(threshold) : value < Number(threshold));

// Was the fix this hypothesis depends on actually applied today? null = no condition.
function conditionMet(h, dayData) {
  const c = h.condition;
  if (!c || !METRICS[c.metric]) return { met: true };
  const { value, n } = METRICS[c.metric].compute(dayData);
  if (value == null || n < MIN_N) return { met: false, text: `مش عارفين نتأكد إن الإصلاح اتطبق (${n} حالة)` };
  const met = passes(value, c.direction, c.threshold);
  return { met, value, text: `${METRICS[c.metric].label} = ${pct(value)}` };
}

export function evaluate(h, dayData) {
  const m = METRICS[h.metric];
  const { value, n } = m.compute(dayData);
  const cond = conditionMet(h, dayData);
  const isBaseline = dayData.day === h.created_day;
  // A later day where the fix was NOT applied cannot confirm or reject the fix.
  if (!isBaseline && !cond.met)
    return { day: dayData.day, value, n, holds: null, fix_applied: false,
      text: `الإصلاح ما اتطبقش النهارده (${cond.text}) — مش هنحكم على الفرضية باليوم ده${value != null ? `؛ ${m.label} = ${pct(value)}` : ''}` };
  const enough = value != null && n >= MIN_N;
  const holds = enough ? passes(value, h.direction, h.threshold) : null;
  const text = enough
    ? `${m.label} = ${pct(value)} (من ${n}) ← ${holds ? 'اتحققت' : 'ما اتحققتش'} (الحد ${h.direction === 'above' ? 'أكبر من' : 'أقل من'} ${pct(Number(h.threshold))})`
    : `بيانات مش كفاية (${n} حالة)`;
  return { day: dayData.day, value, n, holds, fix_applied: h.condition ? cond.met : null, text: h.condition && !isBaseline ? `${text} · ${cond.text}` : text };
}

// Status is derived from the evidence only, so re-running a day is safe.
// The creation day is the baseline; each LATER day with enough data confirms or rejects (the latest wins).
export function statusFrom(h) {
  const later = (h.evidence || []).filter(e => e.day > h.created_day && e.holds !== null).sort((a, b) => a.day - b.day);
  if (!later.length) return 'testing';
  return later.at(-1).holds ? 'confirmed' : 'rejected';
}

// What the agent knew on `day`: hypotheses opened by then, with only that day's and earlier evidence.
export function asOf(hypotheses, day) {
  return hypotheses.filter(h => h.created_day <= day).map(h => {
    const next = { ...h, evidence: (h.evidence || []).filter(e => e.day <= day) };
    return { ...next, status: statusFrom(next) };
  });
}

// Re-check every hypothesis opened before today against today's numbers.
export async function recheck(dayData) {
  const open = await select('cga_hypotheses', `created_day=lt.${dayData.day}`);
  const updated = open.map(h => {
    const evidence = (h.evidence || []).filter(e => e.day !== dayData.day).concat(evaluate(h, dayData)).sort((a, b) => a.day - b.day);
    const next = { ...h, evidence, updated_day: Math.max(h.updated_day, dayData.day) };
    return { ...next, status: statusFrom(next) };
  });
  await upsert('cga_hypotheses', updated, 'id');
  return updated;
}

const PROPOSAL_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      metric: { type: 'STRING', enum: Object.keys(METRICS) },
      direction: { type: 'STRING', enum: ['above', 'below'] },
      threshold: { type: 'NUMBER', description: 'a fraction between 0 and 1' },
      statement: { type: 'STRING', description: 'the hypothesis in one Egyptian-Arabic sentence, including the fix it depends on' },
      condition: {
        type: 'OBJECT', description: 'how code can tell the fix was applied on a given day',
        properties: {
          metric: { type: 'STRING', enum: Object.keys(METRICS) },
          direction: { type: 'STRING', enum: ['above', 'below'] },
          threshold: { type: 'NUMBER' },
        },
        required: ['metric', 'direction', 'threshold'],
      },
    },
    required: ['metric', 'direction', 'threshold', 'statement'],
  },
};

// Ask Gemini for at most one new checkable hypothesis per leaking stage, then keep only valid ones.
export async function propose(dayData, leakingStages, stats, opts = {}) {
  if (!leakingStages.length) return [];
  const existing = await select('cga_hypotheses', 'select=metric,status');
  const openMetrics = new Set(existing.filter(h => h.status === 'testing').map(h => h.metric));
  const catalogue = Object.entries(METRICS)
    .filter(([, m]) => leakingStages.includes(m.stage))
    .map(([k, m]) => { const r = m.compute(dayData); return `- ${k} (${m.stage}): ${m.label} — النهارده ${r.value == null ? 'غير متاح' : `${Math.round(r.value * 100)}% من ${r.n}`}`; })
    .join('\n');
  const prompt = `أنت محلل نمو لعيادة أسنان. من أرقام النهارده اقترح فرضيات نختبرها بكرة بالكود.
أرقام اليوم وأسباب الخسارة:
${JSON.stringify(stats, null, 1)}

المقاييس المتاحة (لازم تختار منها فقط):
${catalogue}

القواعد:
- فرضية واحدة بالكتير لكل مرحلة من: ${leakingStages.join(', ')}.
- كل فرضية: metric من القائمة، direction (above أو below)، threshold كنسبة بين 0 و 1، وجملة بالعامية فيها الإصلاح المقترح والنتيجة المتوقعة (مثال: "لو ردينا على سؤال السعر في أقل من ساعة، نسبة الحجز من الرسائل هتعدي 40%").
- واحدة على الأقل لازم تكون على مقياس عدد حالاته كبير (زي message_booking_rate) عشان نقدر نحكم عليها بكرة.
- لو الفرضية معتمدة على إصلاح (زي الرد أسرع)، حط condition: مقياس من القائمة يثبت إن الإصلاح اتطبق فعلاً في اليوم (مثال: fast_reply_share above 0.7)، عشان ما نحكمش على الإصلاح في يوم ما اتطبقش فيه.
- ما تكررش مقياس عليه فرضية مفتوحة: ${[...openMetrics].join(', ') || 'مفيش'}.`;
  const { value } = await gemini(prompt, PROPOSAL_SCHEMA, opts);
  const seen = new Set(openMetrics);
  const perStage = {};
  const out = [];
  for (const p of value || []) {
    const m = METRICS[p.metric];
    if (!m || seen.has(p.metric) || !leakingStages.includes(m.stage) || perStage[m.stage]) continue;
    if (!(p.threshold > 0 && p.threshold < 1)) continue;
    seen.add(p.metric); perStage[m.stage] = true;
    const h = {
      id: `h-d${dayData.day}-${p.metric}`, stage: m.stage, statement: p.statement, metric: p.metric,
      threshold: p.threshold, direction: p.direction, created_day: dayData.day, updated_day: dayData.day,
      condition: p.condition && METRICS[p.condition.metric] && p.condition.metric !== p.metric ? p.condition : null,
    };
    h.evidence = [evaluate(h, dayData)];
    h.status = statusFrom(h);
    out.push(h);
  }
  await insert('cga_hypotheses', out);
  return out;
}

// Re-running a day: drop what that day created and that day's evidence, then it is recomputed.
export async function forgetDay(day) {
  await remove('cga_hypotheses', `created_day=gte.${day}`);
  const rest = await select('cga_hypotheses', `updated_day=gte.${day}`);
  const cleaned = rest.map(h => {
    const evidence = (h.evidence || []).filter(e => e.day < day);
    const next = { ...h, evidence, updated_day: Math.max(h.created_day, ...evidence.map(e => e.day)) };
    return { ...next, status: statusFrom(next) };
  });
  await upsert('cga_hypotheses', cleaned, 'id');
}
