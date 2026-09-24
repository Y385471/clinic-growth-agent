// Builds the connected funnel for one day from the stored records:
// ad clicks → people who messaged → people who booked → people who came.
// Every later stage is a subset of the one before (a booking always belongs to a conversation).
import { select } from './db.js';

export const STAGES = ['ad', 'message', 'booked', 'attended'];
export const STAGE_NAMES = { ad: 'الإعلان', message: 'الرسالة', booked: 'الحجز', attended: 'الحضور' };

export async function loadDay(day) {
  const [ads, people, conversations, bookings] = await Promise.all([
    select('cga_ads', `day=eq.${day}&order=id`),
    select('cga_people', `first_seen_day=eq.${day}&order=id`),
    select('cga_conversations', `day=eq.${day}&order=id`),
    select('cga_bookings', `day=eq.${day}&order=id`),
  ]);
  return { ads, people, conversations, bookings };
}

// counts + the transition that loses the biggest share of people.
export function computeFunnel({ ads, conversations, bookings }) {
  const messaged = new Set(conversations.map(c => c.person_id));
  const booked = bookings.filter(b => messaged.has(b.person_id));
  const ticked = booked.filter(b => b.attended !== null);
  const attendanceComplete = booked.length === 0 || ticked.length === booked.length;
  const counts = {
    ad: ads.reduce((s, a) => s + (a.clicks || 0), 0),
    message: messaged.size,
    booked: booked.length,
    attended: booked.filter(b => b.attended === true).length,
  };
  const transitions = [
    { from: 'ad', to: 'message' },
    { from: 'message', to: 'booked' },
    ...(attendanceComplete ? [{ from: 'booked', to: 'attended' }] : []),
  ].map(t => ({
    ...t,
    lost: counts[t.from] - counts[t.to],
    lostShare: counts[t.from] ? (counts[t.from] - counts[t.to]) / counts[t.from] : 0,
  }));
  const leak = transitions.reduce((a, b) => (b.lostShare > (a?.lostShare ?? -1) ? b : a), null);
  return { counts, attendanceComplete, leak, transitions };
}

// Loss reasons for people who messaged but did not book, ranked, with quotes. No personal data.
export function lossReasons(conversations, bookedPersonIds) {
  const groups = {};
  for (const c of conversations) {
    if (bookedPersonIds.has(c.person_id)) continue;
    const a = c.analysis;
    const reason = a?.loss_reason && a.loss_reason !== 'none' ? a.loss_reason : a ? 'other' : 'not_analysed';
    (groups[reason] ||= { reason, count: 0, quotes: [], explanations: [], people: [] });
    const g = groups[reason];
    g.count++;
    g.people.push(c.person_id);
    // Gemini's quote, or else the patient's own first line from the (scrubbed) chat.
    const quote = a?.quote?.trim() || c.text_scrubbed?.split('\n').find(l => l.startsWith('المريض'))?.replace(/^[^:]*:\s*/, '');
    if (quote && g.quotes.length < 3) g.quotes.push({ text: quote, conversation_id: c.id });
    if (a?.reason_text && g.explanations.length < 2) g.explanations.push(a.reason_text);
  }
  return Object.values(groups).sort((a, b) => b.count - a.count);
}

// Price-question reply speed vs booking: the numbers behind the "slow reply" story.
export function priceReplyStats(conversations, bookedPersonIds) {
  const priced = conversations.filter(c => c.analysis?.asked_price);
  const bucket = list => ({ n: list.length, booked: list.filter(c => bookedPersonIds.has(c.person_id)).length });
  const slow = priced.filter(c => c.first_reply_minutes == null || c.first_reply_minutes > 60);
  const fast = priced.filter(c => c.first_reply_minutes != null && c.first_reply_minutes <= 60);
  return { asked_price: priced.length, slow_over_60min: bucket(slow), fast_within_60min: bucket(fast) };
}
