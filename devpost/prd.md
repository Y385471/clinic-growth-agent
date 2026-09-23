---
doc: prd
status: draft
---

# Clinic Growth Agent — Product Requirements

An AI growth agent for a clinic's **owner and manager**. It runs on its own every day and joins the clinic's Facebook ads, chats, comments and reactions with bookings and one-tap attendance, into one connected funnel. It shows where patients are lost and why, tests its own hypotheses, and learns.
Source: `scope.md > The Unique Kernel`, `scope.md > The Core Loop`.

## The Core Journey
1. **Every day, automatically** (`scope.md > The Core Loop`), the agent:
   - pulls the day's ad results, page messages, comments and reactions;
   - detects which conversations turned into bookings;
   - adds them to one connected record per person, following the chain ad → conversation → booking → attendance.
2. **At the end of the day** the receptionist opens a short attendance link. It lists today's booked names, and she taps each one who came.
3. **The owner opens the agent** and lands on the funnel screen: every stage in order, each showing its problem and how to improve it.
4. **The owner taps a stage** and gets that stage's full analytical dashboard. Everything in it is connected: the ads, conversations and people that make up that stage, the reasons they were lost, and the hypothesis being tested.
5. **The agent learns.** Each finding becomes a hypothesis that the agent records and then checks against the following days' data, for example "patients who ask the price and wait more than an hour don't book". When patient numbers drop, it can say which patients were lost and at which stage.
6. **Success:** the owner can go from "we got fewer patients this week" to exactly which people were lost, at which stage, why, and what to do. They can also see whether yesterday's advice worked.

## Screens and Layout
- **Funnel screen (home).** The stages in order: ad → message → booking → attendance. Each stage shows its count, its problem in one line, and its fix in one line. The stage losing the most patients stands out. A "What I've learned" area shows the hypotheses and their status.
- **Stage dashboard.** Opened by tapping a stage. A full analytical dashboard for that stage, connected upstream and downstream: which ads fed it, the conversations and people in it, the ranked reasons for loss with example quotes, the fix, and the hypothesis being tested. The owner can move to the neighbouring stages without losing context.
- **Attendance page (receptionist).** A simple list of today's booked names with one tap per person who came. There is nothing else on it.

## Look and Feel
- **Modern and light, not dark** (learner: "مودرن بس لايتس مش غامقه").
- It reads like a smart team member reporting: plain language, one clear next action per stage (`scope.md > Inspiration & Identity`).

## Features and Behavior

### Daily automatic run
- As the owner, I want the agent to gather and analyse everything by itself every day, so that I never upload files.
  - [ ] The run happens on a schedule with no human action, and the funnel shows "last updated" with that day's date.
  - [ ] New ads, messages, comments and reactions from the day appear in the funnel counts.

### Connected funnel and people
- As the owner, I want one connected picture, not fragmented numbers (learner: "متبقاش المعلومات فراجمنتت تبقى متصله كلها").
  - [ ] Every person in the funnel can be traced back to the conversation, and where known the ad, they came from.
  - [ ] Stage counts add up: the people counted at a later stage are a subset of the stage before.

### Booking detection
- As the owner, I want bookings recognised from the chat, so that nobody has to log them.
  - [ ] A conversation where the patient agrees to a date or time is marked "booked", with that date.
  - [ ] A conversation that ends without agreement stays at "message", with the reason the agent inferred.

### One-tap attendance
- As the receptionist, I want to confirm who came with one tap each.
  - [ ] The attendance page lists exactly the people booked for today.
  - [ ] One tap marks a person as attended, and the funnel's attendance stage updates.

### Stage problem and fix
- As the owner, I want each stage to tell me its problem and how to improve it.
  - [ ] Each stage on the home screen shows one problem line and one fix line.
  - [ ] Tapping a stage opens its full dashboard, with ranked reasons for loss and real example quotes from the conversations behind each reason.

### Hypotheses and learning
- As the owner, I want the agent to test its own ideas and tell me what it learned (learner: "كل هيبوسس البرنامج هيحطها و يتحقق منها").
  - [ ] Each hypothesis is listed with what would confirm or reject it, and its current status: testing, confirmed or rejected, with the evidence.
  - [ ] After a later day's data, at least one hypothesis changes status, and the recommendation changes accordingly.
  - [ ] When the patient count drops, the agent names which people were lost and at which stage.

## States and Boundaries
- **First day / no history.** The funnel shows today's data. The learning area says hypotheses have been opened and will be checked as new days arrive; nothing claims to be confirmed yet.
- **Attendance not ticked.** If the receptionist doesn't mark attendance for a day, the agent **alerts the owner**, to keep the data continuous (learner's decision). The attendance stage for that day shows as incomplete rather than as zero people.
- **A day with nothing new.** The funnel keeps the previous totals and says nothing new came in today.
- **Connection to the page fails.** The owner sees that today's run could not reach the page, and the last good data stays visible.
- **Privacy.** Patient chats hold personal and health details. They are visible only to the clinic, never in the public demo (`scope.md > Explicitly Cut`).

## Product Decisions
- **It runs on its own, with no uploads.** The owner shouldn't have to feed it (learner).
- **Attendance comes from a one-tap receptionist page.** The clinic has no records system; attendance is posted in a WhatsApp group that can't be read officially (learner).
- **Missed attendance alerts the owner.** This keeps information and data continuity (learner).
- **Home screen: every stage shows its problem and fix, and tapping one gives the full dashboard** (learner).
- **Everything connected, not fragmented** (learner).
- **Learning means explicit hypotheses** that the agent sets and verifies, and a trace of which patients were lost where (learner).
- **Modern and light look** (learner).

## What We're Building
- The daily automatic run over the clinic page's ads, messages, comments and reactions. The public demo runs on a practice page / practice data of the same shape.
- Booking detection from chats.
- The one-tap attendance page, and the missed-attendance alert to the owner.
- The connected funnel home screen, showing problem and fix per stage.
- The per-stage full analytical dashboard, with ranked reasons and example quotes.
- The hypothesis list, with verification over days and the "who was lost where" trace.

## Deferred From the POC
- **Owner accounts / multi-clinic support.** The proof of concept serves one clinic.
- **Editing or overriding the agent's booking detection by hand.** Useful, but not needed to prove the kernel.
- **Notifications beyond the missed-attendance alert,** such as a daily digest by email or WhatsApp.

## Possible Later Enhancements
- Channels outside Meta (Google, TikTok, walk-ins, referrals), and booking capacity / empty slots feeding the advice (`scope.md > Later`).
- The agent acting on its own: drafting replies to price questions, adjusting ad budgets.
- Deeper sociological and audience analysis beyond conversation-level reasons.

## Non-Goals
- **Reading the clinic's WhatsApp group.** There is no official way, and it risks a ban (`scope.md > Explicitly Cut`).
- **Showing real patient conversations in the repo or video.** Privacy.
- **A full EMR or booking system.** The clinic doesn't have one, and building one is not the point.

## Open Questions
- **How the agent gets page data during the demo** (the practice page / practice data set) is decided in `4-spec`.
- **How the AI analysis runs at no cost** (for example a free-tier model) is decided in `4-spec`.
