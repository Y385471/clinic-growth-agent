// Owner home data: the day's funnel, the biggest leak, problem/fix per stage, alerts and history.
import { select } from '../lib/db.js';
import { loadDay, computeFunnel, STAGES, STAGE_NAMES } from '../lib/funnel.js';

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
    const stages = STAGES.map((s, i) => ({
      key: s, name: STAGE_NAMES[s], count: f.counts[s],
      previous: previous?.counts?.[s] ?? null,
      fromPrevStage: i ? f.counts[STAGES[i - 1]] : null,
      incomplete: s === 'attended' && !f.attendanceComplete,
      problem: run.summary?.stages?.[s]?.problem || null,
      fix: run.summary?.stages?.[s]?.fix || null,
    }));
    const hypotheses = await select('cga_hypotheses', 'order=updated_day.desc,id&limit=20');
    return Response.json({
      day: run.day, mode: run.mode, status: run.status, updated: run.finished_at,
      latestRun: runs[0].day === run.day ? null : { day: runs[0].day, status: runs[0].status, error: runs[0].error },
      alerts: runs.filter(r => r.alert).map(r => ({ day: r.day, text: r.alert })),
      stages, leak: f.leak, hypotheses,
      days: runs.map(r => ({ day: r.day, status: r.status })),
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
