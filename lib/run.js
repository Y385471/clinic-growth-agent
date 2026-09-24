// One day of the agent: collect → scrub → analyse → store → summarise.
// Idempotent per day: re-running a day replaces that day's results.
import { collectDay, mode } from './source.js';
import { scrubText, assertClean, findPhones, encrypt } from './scrub.js';
import { analyseConversations, summariseStages, LOSS_REASONS } from './analyse.js';
import { computeFunnel, lossReasons, priceReplyStats } from './funnel.js';
import { insert, upsert, remove, select } from './db.js';

const REASON_AR = {
  price: 'السعر', slow_reply: 'تأخر رد العيادة', no_clinic_reply: 'لم ترد العيادة', fear: 'الخوف',
  trust: 'عدم الثقة', comparison: 'المقارنة بعيادة أخرى', just_asking: 'مجرد استفسار', moved_to_phone: 'انتقل للتليفون',
  other: 'سبب آخر', not_analysed: 'لم يُحلَّل بعد',
};
export { REASON_AR };

function scrubConversation(c, alias) {
  const phones = [c.person.phone, ...c.messages.flatMap(m => findPhones(m.text))].filter(Boolean);
  const messages = c.messages.map(m => ({ ...m, text: scrubText(m.text, c.person.name, alias) }));
  for (const m of messages) assertClean(m.text, c.person.name, phones);
  return { ...c, messages, phones };
}

const renderText = messages =>
  messages.map(m => `${m.from === 'patient' ? 'المريض' : 'العيادة'} [${m.minute}د]: ${m.text}`).join('\n');

// Fallback when Gemini is unavailable: plain numbers, still useful.
function fallbackSummary(counts, reasons) {
  const top = reasons[0];
  return {
    ad: { problem: `${counts.ad} ضغطة على زر المراسلة اليوم.`, fix: 'قارن الإعلانات في لوحة المرحلة وزوّد ميزانية الأفضل.' },
    message: { problem: `${counts.ad - counts.message} ضغطوا زر المراسلة وما بدأوش محادثة.`, fix: 'خلي أول رسالة ترحيب فيها السعر والعرض.' },
    booked: { problem: top ? `أكبر سبب لعدم الحجز: ${REASON_AR[top.reason] || top.reason} (${top.count} من ${counts.message}).` : 'كل اللي راسلوا حجزوا.', fix: 'راجع المحادثات الخاسرة في لوحة المرحلة.' },
    attended: { problem: `${counts.attended} من ${counts.booked} حضروا.`, fix: 'ابعت رسالة تذكير قبل الميعاد، وسجّل الحضور يومياً.' },
  };
}

// The last earlier day with bookings where nobody was ticked, as { day, text }.
export async function missedAttendance(day) {
  const [prev] = await select('cga_runs', `day=lt.${day}&status=neq.failed&order=day.desc&limit=1`);
  if (!prev) return null;
  const unticked = await select('cga_bookings', `day=eq.${prev.day}&attended=is.null&select=id`);
  if (!unticked.length) return null;
  const label = prev.day > 1e7 ? `${String(prev.day).slice(6)}/${String(prev.day).slice(4, 6)}` : `اليوم ${prev.day}`;
  return { day: prev.day, count: unticked.length, text: `حضور ${label} ما اتسجلش لـ ${unticked.length} حجز. سجّله من صفحة الاستقبال عشان القمع يفضل كامل.` };
}

export async function runDay(day, { onSend, log = () => {} } = {}) {
  const data = await collectDay(day);

  // 1. People and scrubbing — aliases are what Gemini, the pages and the video see.
  const people = [];
  const scrubbed = data.conversations.map((c, i) => {
    const alias = `مريض ${day}${String(i + 1).padStart(2, "0")}`; // e.g. "مريض 203" = day 2, person 03 (no dash: RTL would flip it)
    const s = scrubConversation(c, alias);
    people.push({
      id: c.person.key, alias, real_name_enc: encrypt(c.person.name),
      phone_enc: encrypt(s.phones[0] || null), first_seen_day: day, ad_id: c.ad_id,
    });
    return s;
  });
  log(`collected ${scrubbed.length} conversations, scrubbed`);

  // 2. Analyse (one batched call). On failure the counts still work and analysis is retried next run.
  let analyses = {}, model = null, analyseError = null;
  try {
    const r = await analyseConversations(scrubbed, { onSend });
    analyses = r.byId; model = r.model;
    log(`analysed with ${model}: ${Object.keys(analyses).length} results`);
  } catch (e) { analyseError = e.message; log(`analysis failed: ${e.message}`); }

  // 3. Store (replace this day).
  await remove('cga_bookings', `day=eq.${day}`);
  await remove('cga_conversations', `day=eq.${day}`);
  await remove('cga_people', `first_seen_day=eq.${day}`);
  await remove('cga_ads', `day=eq.${day}`);
  await remove('cga_reactions', `day=eq.${day}`);
  await insert('cga_ads', data.ads);
  await insert('cga_people', people);
  const conversations = scrubbed.map(c => {
    const a = analyses[c.id];
    if (a && !LOSS_REASONS.includes(a.loss_reason)) a.loss_reason = 'other';
    return {
      id: c.id, person_id: c.person.key, day, source: c.source, text_scrubbed: renderText(c.messages),
      first_reply_minutes: c.first_reply_minutes, analysis: a || null,
    };
  });
  await insert('cga_conversations', conversations);
  await insert('cga_reactions', data.reactions);
  const bookings = conversations.filter(c => c.analysis?.booked).map(c => ({
    id: `b-${c.id}`, person_id: c.person_id, conversation_id: c.id, day,
    booking_date: c.analysis.booking_date || null, attended: null,
  }));
  await insert('cga_bookings', bookings);

  // 4. Funnel and the owner's problem/fix lines.
  const funnel = computeFunnel({ ads: data.ads, conversations, bookings });
  const bookedIds = new Set(bookings.map(b => b.person_id));
  const reasons = lossReasons(conversations, bookedIds);
  const stats = {
    day, counts: funnel.counts, biggest_leak: funnel.leak && `${funnel.leak.from}→${funnel.leak.to}`,
    attendance: funnel.attendanceComplete ? 'complete' : 'not ticked yet',
    ads: data.ads.map(a => ({ name: a.name, spend_egp: a.spend, reach: a.reach, message_clicks: a.clicks, conversations: conversations.filter(c => people.find(p => p.id === c.person_id)?.ad_id === a.id).length })),
    message_loss_reasons: reasons.map(r => ({ reason: r.reason, count: r.count, quotes: r.quotes.map(q => q.text) })),
    price_reply_speed: priceReplyStats(conversations, bookedIds),
    comments: conversations.filter(c => c.source === 'comment').length,
    reactions: data.reactions,
  };
  let summary, summaryModel = null;
  try {
    const r = await summariseStages(stats, { onSend });
    summary = r.value; summaryModel = r.model;
  } catch (e) { summary = fallbackSummary(funnel.counts, reasons); log(`summary fell back: ${e.message}`); }

  // 5. Data continuity: if the previous day's attendance was never ticked, alert the owner.
  const alert = await missedAttendance(day);
  if (alert) log(`alert: ${alert.text}`);

  const run = {
    day, mode: mode(), status: analyseError ? 'partial' : 'ok', alert: alert?.text || null,
    error: analyseError, summary: { stages: summary, leak: funnel.leak, model: model || summaryModel, attendance_complete_at_run: funnel.attendanceComplete, alert_for_day: alert?.day ?? null },
    counts: funnel.counts, finished_at: new Date().toISOString(),
  };
  await upsert('cga_runs', [run], 'day');
  log(`stored day ${day}: ${JSON.stringify(funnel.counts)}`);
  return { run, funnel, reasons, stats };
}
