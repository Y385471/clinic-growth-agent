# Clinic Growth Agent

An AI "media-buying team member" for a dental clinic. Every day, on its own, it:

- reads the clinic page's ad results, Messenger chats, comments and reactions;
- follows each person through **ad → message → booked → attended**;
- finds the stage that loses the most patients and explains *why*, quoting the patients' own words;
- sets hypotheses and **checks them with code** against the next days' data.

The receptionist confirms attendance with one tap per patient.

Built for the Devpost **Build With AI: Basics** hackathon. The planning documents are in [`devpost/`](devpost): scope, PRD, spec and build checklist.

> **Practice data.** The public demo runs on a made-up clinic with made-up people and phone numbers (`lib/practice.js`). No real patient data is in this repo.

## What you see

| Page | Who | What |
|---|---|---|
| `/` | owner | The funnel. Each stage shows its count, one problem line and one fix line, with the biggest leak in red. Also: who was lost where, and what the agent has learned (hypotheses with evidence per day). |
| `/stage.html?s=booked` | owner | One stage's full dashboard: ranked loss reasons with quotes, the price-reply-speed numbers, the ads that fed the stage, and every person with their (scrubbed) chat. |
| `/attend.html` | receptionist | Today's bookings, with one tap per patient who came. |

## How it works

```
Vercel Cron (daily) → /api/run-daily
   collect   lib/source.js → lib/practice.js (practice) | lib/meta.js (live: Graph API)
   scrub     lib/scrub.js   names + Egyptian phone numbers → aliases, before anything leaves
   analyse   lib/analyse.js Gemini (free tier), JSON schema: booked?, loss reason, quote, signals
   store     lib/db.js      Supabase REST (plain fetch), one connected record per person
   learn     lib/learn.js   re-check open hypotheses by code; Gemini may propose new ones
   alert     missed attendance from the previous day → owner banner
```

- **Zero npm dependencies.** Plain HTML/CSS/JS pages plus Vercel functions using `fetch`.
- **Privacy.** Real names and phone numbers are replaced before any Gemini call, and stored only AES-GCM encrypted. `scripts/run-local.mjs` asserts that no real name or phone number appears in any payload sent to Gemini.
- **Learning you can trust.** Gemini can only propose hypotheses on a fixed set of metrics that the code knows how to compute (`METRICS` in `lib/learn.js`). Each hypothesis has:
  - a threshold;
  - a *fix applied* condition. A day where the fix was not applied cannot confirm or reject it.

  Status is derived from the stored evidence, so re-running a day is safe.

## Run it yourself

1. Create a Supabase project and run `db/schema.sql` in its SQL editor.
2. Get a Gemini API key at [aistudio.google.com](https://aistudio.google.com). The free tier is enough.
3. Put the values in a `.env` file **outside** the repo:
   ```
   SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_SERVICE_KEY=<secret key>
   GEMINI_API_KEY=<key>
   CRON_SECRET=<any long random string>
   MODE=practice
   ```
4. Start locally, with no install step (Node 20+):
   ```
   node scripts/run-local.mjs 1 ../path/.env      # analyse practice day 1 (+ privacy assertion)
   node scripts/dev.mjs 4517 ../path/.env         # http://localhost:4517
   node scripts/run-local.mjs 2 ../path/.env      # day 2: the fix was applied, so watch a hypothesis get confirmed
   node scripts/reset.mjs ../path/.env            # start the demo over
   node scripts/test-meta.mjs                     # live-mode reader vs a recorded Graph API sample
   ```
5. Deploy: import the GitHub repo in Vercel and add the same variables. The cron in `vercel.json` runs `/api/run-daily` once a day. To trigger it by hand: `/api/run-daily?key=<CRON_SECRET>` (add `&day=2` to pick a practice day).

## Live mode (the clinic's real page)

1. Set `MODE=live` and add these variables in Vercel:
   - `META_PAGE_ID`
   - `META_PAGE_TOKEN`: a page access token with `pages_messaging`, `pages_read_engagement` and `pages_read_user_content`, created from a Meta developer app in development mode by the page admin
   - `META_AD_ACCOUNT`: ad account digits, optional
   - `STAFF_KEY`
2. The receptionist link becomes `/attend.html?k=<STAFF_KEY>`. In live mode, real names are shown only with that key.

Data from the real page stays in the clinic's own Supabase project. Only scrubbed text reaches Gemini.

## Built with AI

Built with Claude Code (Anthropic) as a pair: the learner decided the product (every decision is quoted in `devpost/`), and the agent wrote the code.
