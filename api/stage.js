// Full dashboard data for one stage: which ads fed it, the people in it, who was lost on the way in
// and why (ranked, with quotes), the fix, and the hypothesis being tested. Everything is joined by id.
import { select } from '../lib/db.js';
import { loadDay, computeFunnel, lossReasons, priceReplyStats, freshAttendedLine, STAGES, STAGE_NAMES } from '../lib/funnel.js';

export async function GET(request) {
  const url = new URL(request.url);
  const s = url.searchParams.get('s');
  if (!STAGES.includes(s)) return Response.json({ error: `unknown stage; use one of ${STAGES.join(', ')}` }, { status: 400 });
  try {
    const wanted = Number(url.searchParams.get('day'));
    const [run] = wanted
      ? await select('cga_runs', `day=eq.${wanted}`)
      : await select('cga_runs', 'status=neq.failed&order=day.desc&limit=1');
    if (!run) return Response.json({ empty: true });
    const day = run.day;
    const data = await loadDay(day);
    const f = computeFunnel(data);

    const bookingByPerson = Object.fromEntries(data.bookings.map(b => [b.person_id, b]));
    const convByPerson = Object.fromEntries(data.conversations.map(c => [c.person_id, c]));
    const adById = Object.fromEntries(data.ads.map(a => [a.id, a]));
    const bookedIds = new Set(data.bookings.map(b => b.person_id));

    // One connected record per person: ad → conversation → booking → attendance.
    const person = p => {
      const c = convByPerson[p.id], b = bookingByPerson[p.id], a = c?.analysis;
      return {
        id: p.id, alias: p.alias, ad: adById[p.ad_id]?.name || null,
        conversation: c && { id: c.id, source: c.source, first_reply_minutes: c.first_reply_minutes, text: c.text_scrubbed },
        booked: !!b, booking_date: b?.booking_date || null, attended: b ? b.attended : null,
        reason: a && !b ? a.loss_reason : null, reason_text: a && !b ? a.reason_text : null,
        signals: a?.signals || null, asked_price: a?.asked_price ?? null,
      };
    };
    const everyone = data.people.map(person);

    // Who is IN this stage, and who was LOST on the way into it.
    const inStage = {
      ad: [], message: everyone.filter(p => p.conversation), booked: everyone.filter(p => p.booked),
      attended: everyone.filter(p => p.attended === true),
    }[s];
    const lost = {
      ad: [], message: [], booked: everyone.filter(p => p.conversation && !p.booked),
      attended: everyone.filter(p => p.booked && p.attended === false),
    }[s];

    let reasons = [];
    if (s === 'booked') reasons = lossReasons(data.conversations, bookedIds);
    if (s === 'attended') {
      const noShow = everyone.filter(p => p.booked && p.attended === false);
      const unticked = everyone.filter(p => p.booked && p.attended === null);
      reasons = [
        noShow.length && { reason: 'no_show', count: noShow.length, people: noShow.map(p => p.id), quotes: [], explanations: [] },
        unticked.length && { reason: 'not_ticked', count: unticked.length, people: unticked.map(p => p.id), quotes: [], explanations: [] },
      ].filter(Boolean);
    }

    const ads = data.ads.map(a => {
      const people = everyone.filter(p => data.people.find(x => x.id === p.id)?.ad_id === a.id);
      const booked = people.filter(p => p.booked).length;
      return {
        id: a.id, name: a.name, spend: Number(a.spend), reach: a.reach, clicks: a.clicks,
        messages: people.filter(p => p.conversation).length, booked,
        attended: people.filter(p => p.attended === true).length,
        cost_per_booking: booked ? Math.round(Number(a.spend) / booked) : null,
      };
    });

    const i = STAGES.indexOf(s);
    const hypotheses = await select('cga_hypotheses', `stage=eq.${s}&order=updated_day.desc`);
    return Response.json({
      day, stage: s, name: STAGE_NAMES[s],
      prev: i > 0 ? { key: STAGES[i - 1], name: STAGE_NAMES[STAGES[i - 1]] } : null,
      next: i < STAGES.length - 1 ? { key: STAGES[i + 1], name: STAGE_NAMES[STAGES[i + 1]] } : null,
      counts: f.counts, count: f.counts[s], from: i ? f.counts[STAGES[i - 1]] : null,
      incomplete: s === 'attended' && !f.attendanceComplete,
      isLeak: f.leak?.to === s,
      problem: (s === 'attended' && freshAttendedLine(f, run.summary)?.problem) || run.summary?.stages?.[s]?.problem || null,
      fix: (s === 'attended' && freshAttendedLine(f, run.summary)?.fix) || run.summary?.stages?.[s]?.fix || null,
      ads, people: inStage, lost, reasons,
      priceReply: s === 'booked' ? priceReplyStats(data.conversations, bookedIds) : null,
      hypotheses,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
