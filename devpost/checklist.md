---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast. The learner approved going ahead and asked the build to continue without stopping ("عايزك تكمل شغل متوقفش") before going to sleep. Hands-on checks happen when he is back.

## Slices

- [x] **1. A practice day runs and the owner sees the funnel with its biggest leak**
  Becomes usable: Open the site and see day 1 of the practice clinic.
  - The funnel ad → message → booked → attended, with counts.
  - The biggest leak highlighted.
  - One problem line and one fix line per stage, written from Gemini's reading of the chats.
  - Names and phone numbers are never sent to Gemini.
  Why now: This is the kernel (a connected funnel built from real conversation analysis), and it carries the three biggest risks:
  - the Gemini free tier returns usable structured Arabic analysis;
  - Supabase REST works from Vercel functions;
  - a Vercel deploy with named `GET`/`POST` exports runs.
  Bootstrapping lives here.
  PRD ref: `prd.md > The Core Journey` (steps 1, 3), `prd.md > Connected funnel and people`, `prd.md > Booking detection`, `prd.md > Stage problem and fix`
  Spec ref: `spec.md > Daily Runner (\`api/run-daily.js\`)`, `spec.md > Data Source (\`lib/source.js\`, \`lib/practice.js\`, \`lib/meta.js\`)`, `spec.md > Privacy Scrubber (\`lib/scrub.js\`)`, `spec.md > Conversation Analyst (\`lib/analyse.js\`)`, `spec.md > Funnel & Stage API (\`api/funnel.js\`, \`api/stage.js\`)`, `spec.md > Data Model`, `spec.md > File Structure`, `spec.md > Look and Feel`
  Build:
  - `package.json` (`"type": "module"`, no dependencies), `vercel.json`, and `db/schema.sql`, applied in Supabase as `cga_` tables.
  - `lib/db.js`, `lib/practice.js` (seeded day 1), `lib/scrub.js`, `lib/analyse.js` (gemini-3.5-flash-lite with a 3.1-flash-lite fallback, JSON schema, retry on 503).
  - `api/run-daily.js` (collect → scrub → analyse → store), `api/funnel.js`, and `public/index.html` + `app.css` + `app.js`: a light, modern Arabic RTL funnel.
  - A GitHub repo and a Vercel import with env vars.
  Verify (mechanical):
  - A local Node run of the day-1 pipeline against Supabase stores the conversations with analyses; no raw name or phone is present in any text sent to Gemini (asserted in the script).
  - `GET /api/funnel` on the Vercel URL returns stage counts where each later stage ≤ the stage before.
  - The deployed home page renders the funnel.
  Learner check: Open the Vercel link. Do you see the four stages with numbers, and is the stage losing the most people marked? Read the problem and fix lines. Do they sound like something a smart media buyer would tell you?
  Commit: `Practice day analysed into a connected funnel`

- [x] **2. Tapping a stage opens its full connected dashboard**
  Becomes usable: Tap any stage to see where its people came from (ads) and who they are (aliases). It shows the ranked reasons they were lost, with real quotes from their chats, the fix, and links to the neighbouring stages.
  Why now: This is the "full analytical dashboard, everything connected" the learner asked for. It builds directly on slice 1's records.
  PRD ref: `prd.md > Stage problem and fix`, `prd.md > Screens and Layout`, `prd.md > Connected funnel and people`
  Spec ref: `spec.md > Funnel & Stage API (\`api/funnel.js\`, \`api/stage.js\`)`, `spec.md > Owner Screens (\`public/index.html\`, \`public/stage.html\`, \`public/app.css\`, \`public/app.js\`)`
  Build: `api/stage.js` and `public/stage.html`. Stage cards on the home screen link to it; there is previous/next stage navigation.
  Verify (mechanical): `GET /api/stage?s=booked` returns people whose ids all appear in the message stage. Reasons are sorted by count, each with at least one quote. The page renders with no console errors.
  Learner check: From the funnel, tap "message → booking". Can you follow one person from the ad they came from, to their chat, to why they didn't book?
  Commit: `Connected stage dashboard with ranked reasons and quotes`

- [x] **3. The receptionist ticks attendance with one tap, and a missed day alerts the owner**
  Becomes usable:
  - `attend.html` on a phone lists today's bookings; one tap marks a person as attended, and the funnel's "attended" stage updates.
  - If a day is left unticked, the owner sees an alert and that day's attended stage shows "incomplete".
  Why now: Attendance is the last link that makes the funnel end at the chair, the kernel's promise. The alert is the learner's own data-continuity rule.
  PRD ref: `prd.md > One-tap attendance`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Attendance (\`api/attendance.js\`, \`public/attend.html\`)`, `spec.md > Data Model`
  Build: `api/attendance.js` (`GET` today's bookings, `POST` attended), `public/attend.html` (mobile-first), the alert in `api/run-daily.js`, and the alert banner plus "incomplete" state on the home page.
  Verify (mechanical):
  - Marking 2 people via `POST` makes the attended count rise by exactly 2.
  - Running the next day with the previous day unticked writes an alert that `GET /api/funnel` returns.
  Learner check: Open the attendance link on your phone and tap two names. Then open the owner page: did "attended" go up? Now skip a day: do you see the warning?
  Commit: `One-tap attendance and missed-attendance alert`

- [x] **4. The agent learns: hypotheses are tested across days, and it names who was lost where**
  Becomes usable: After day 1 the "What I've learned" area lists hypotheses marked "testing".
  - Running day 2 (practice day where replies to price questions got faster) re-checks them with code: at least one becomes confirmed or rejected, with evidence numbers, and the stage's advice changes.
  - When patient numbers drop, it lists which people were lost and at which stage.
  Why now: This is the other half of the kernel ("بيتعلم كل شويه … كل هيبوسس البرنامج هيحطها و يتحقق منها") and the video's "oh, that's cool" moment. It needs the multi-day data that slices 1–3 produce.
  PRD ref: `prd.md > Hypotheses and learning`, `prd.md > The Core Journey` (steps 5–6)
  Spec ref: `spec.md > Hypothesis Engine (\`lib/learn.js\`)`, `spec.md > Data Source (\`lib/source.js\`, \`lib/practice.js\`, \`lib/meta.js\`)`
  Build: `lib/learn.js` (Gemini proposes at most one checkable hypothesis per leaking stage; code recomputes the metric against the threshold) and practice day 2 in `lib/practice.js`; the learning area on home and on stage pages; the lost-people list.
  Verify (mechanical): The day-1 run creates at least 1 hypothesis with status testing. The day-2 run changes at least one status and stores evidence with both days' metric values. The stage's fix text differs between day 1 and day 2.
  Learner check: Look at "What I've learned" after day 1, then after day 2. Did a hypothesis flip to confirmed or rejected, and does the reason convince you?
  Commit: `Hypothesis testing across days and lost-patient trace`

- [x] **5. It runs by itself every day, handles failures, and live mode is ready for the real page**
  Becomes usable:
  - The Vercel Cron triggers `run-daily` daily behind `CRON_SECRET`, and the home page shows "last updated".
  - A failed run shows a banner while the last good data stays visible.
  - Setting `MODE=live` plus the page token switches the source to the clinic's real Facebook page.
  Why now: The automation and resilience wrap around a working core. Live mode stays last because the demo doesn't depend on it, and it needs the learner's one-time Meta step.
  PRD ref: `prd.md > Daily automatic run`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Daily Runner (\`api/run-daily.js\`)`, `spec.md > External Services and Dependencies`, `spec.md > Important Failure Modes`, `spec.md > Where It Runs and How Someone Tries It`
  Build: The cron in `vercel.json` and the secret check; the `runs` table status and last-updated; failure handling and banner; `lib/meta.js` (Graph API conversations, comments, reactions, ads insights) behind `MODE`; `README.md` with run and live-mode setup.
  Verify (mechanical):
  - An unauthenticated call to `/api/run-daily` gets 401; the authenticated call succeeds and updates last-updated.
  - A simulated source error records a failed run and `GET /api/funnel` still serves the previous day.
  - `lib/meta.js` returns the same shape as practice when fed a recorded Graph API sample.
  Learner check: Open the home page. Can you see when it last updated? When you're ready, do the one-time Meta step together with me to point it at your own page.
  Commit: `Daily cron, failure states and live-mode Meta source`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 1 (the funnel on the live link), so the learner's reaction can shape the dashboard and learning screens
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence:
Route and stops:
Edit outcome:
Reflection:
Activity mode:

## Revisions
- Built overnight (2026-09-24) while the learner slept; mechanical checks all pass. **Every "Learner check" above is still open** and is done together when he is back, as part of the final kick-the-tires review.
- Live: https://clinic-growth-agent.vercel.app — repo: https://github.com/Y385471/clinic-growth-agent
- Mechanical evidence:
  - slice 1: `scripts/run-local.mjs` privacy assertion passed on days 1–3; the deployed `/api/funnel` is monotonic (18 → 14 → 4); the Vercel run finished in about 12 s.
  - slice 2: the booked-stage people are a subset of the message stage; reasons are sorted, each with a quote. When Gemini gives no quote, the fallback is the patient's first line.
  - slice 3: two POSTs raised "attended" by exactly 2; running day 2 with day 1 unticked raised an alert that cleared once ticked.
  - slice 4: day 1 opened a hypothesis at a 29% baseline; day 2 confirmed it (47%, fix applied, 93% fast replies). The day-2 fix text differs from day 1.
  - slice 5: unauthenticated or wrong-key calls return 401; a simulated source error recorded a failed day 3 while the funnel kept day 2; `scripts/test-meta.mjs` passes.
- Change during build: day 3 exposed that a hypothesis about a fix was rejected on a day the fix was not applied. Hypotheses now carry a "fix applied" condition (`condition` column), and a day without the fix cannot confirm or reject.
- Change during build: patient aliases are plain numbers ("مريض 203" = day 2, person 03), because "1-03" is flipped by right-to-left text.
- The early hands-on checkpoint after slice 1 moves to when the learner is back. He asked the build to continue overnight, so slices 2–5 are built in the meantime and his early feedback is folded into the final kick-the-tires review. No learner check is marked done without him.
