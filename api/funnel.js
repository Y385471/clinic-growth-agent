// Owner home data: the day's funnel, the biggest leak, problem/fix per stage, alerts and history.
import { select } from '../lib/db.js';
import { loadDay, computeFunnel, freshAttendedLine, STAGES, STAGE_NAMES } from '../lib/funnel.js';

// An alert stays only while the day it points at still has unticked bookings.
async function liveAlerts(runs) {
  const out = [];
  for (const r of runs.filter(r => r.alert)) {
    const d = r.summary?.alert_for_day;
    if (d == null) continue;
    const open = await select('cga_bookings', `day=eq.${d}&attended=is.null&select=id`);
    if (open.length) out.push({ day: d, text: r.alert });
  }
  return out;
}

export async function GET(request) {
  const url = new URL(request.url);
  try {
    const runs = await select('cga_runs', 'select=day,mode,status,alert,error,counts,summary,finished_at&order=day.desc&limit=30');
    if (!runs.length) return Response.json({ empty: true, stages: [], runs: [] });
    const wanted = Number(url.searchParams.get('day'));
    const run = runs.find(r => r.day === wanted) || runs.find(r => r.status !== 'failed') || runs[0];
    const data = await loadDay(run.day);
    const f = computeFunnel(data);
    const previous = runs.find(r => r.day < run.day && r.status !== 'failed');
    const attended = freshAttendedLine(f, run.summary);
    const stages = STAGES.map((s, i) => ({
      key: s, name: STAGE_NAMES[s], count: f.counts[s],
      previous: previous?.counts?.[s] ?? null,
      fromPrevStage: i ? f.counts[STAGES[i - 1]] : null,
      incomplete: s === 'attended' && !f.attendanceComplete,
      problem: (s === 'attended' && attended?.problem) || run.summary?.stages?.[s]?.problem || null,
      fix: (s === 'attended' && attended?.fix) || run.summary?.stages?.[s]?.fix || null,
    }));
    const hypotheses = await select('cga_hypotheses', 'order=updated_day.desc,id&limit=20');

    // Who was lost where: every person who dropped out today, at the stage they dropped.
    const alias = Object.fromEntries(data.people.map(p => [p.id, p.alias]));
    const booked = new Set(data.bookings.map(b => b.person_id));
    const lost = [
      { stage: 'booked', name: 'راسلوا وما حجزوش', people: data.conversations.filter(c => !booked.has(c.person_id))
          .map(c => ({ id: c.person_id, alias: alias[c.person_id], reason: c.analysis?.loss_reason || 'not_analysed' })) },
      { stage: 'attended', name: 'حجزوا وما حضروش', people: data.bookings.filter(b => b.attended === false)
          .map(b => ({ id: b.person_id, alias: alias[b.person_id], reason: 'no_show' })) },
    ].filter(g => g.people.length);
    const drops = previous ? STAGES.filter(s => previous.counts?.[s] != null && f.counts[s] < previous.counts[s] && !(s === 'attended' && !f.attendanceComplete))
      .map(s => ({ stage: s, name: STAGE_NAMES[s], from: previous.counts[s], to: f.counts[s] })) : [];
    return Response.json({
      day: run.day, mode: run.mode, status: run.status, updated: run.finished_at,
      latestRun: runs[0].day === run.day ? null : { day: runs[0].day, status: runs[0].status, error: runs[0].error },
      alerts: await liveAlerts(runs),
      stages, leak: f.leak, hypotheses, lost, drops, previousDay: previous?.day ?? null,
      days: runs.map(r => ({ day: r.day, status: r.status })),
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
