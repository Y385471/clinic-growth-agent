---
doc: scope
status: approved
---

# Clinic Growth Agent

An "AI media-buying team" for a clinic. It runs on its own every day, follows every ad conversation to a booked and attended patient, finds the stage where patients leak out, explains why, says how to fix it, and learns from each new day of data.

## The Unique Kernel
**It follows the patient past the ad, and it learns.**
- Ad tools stop at clicks and messages. This agent reads the clinic page's messages, comments and reactions itself. It recognises from the chat when someone books.
- The receptionist confirms attendance with one tap. The funnel therefore runs **ad → message → booked → attended**, and the agent can show which stage is wasting patients.
- Every day it compares with what it saw before and learns which fixes worked. In the learner's words: "المهم انه بيتعلم كل شويه من الداتا و بيطور من نفسه و بيحلل كل حاجه و كل خطوه".

## Who It's For
The clinic **owner and manager**. Today they see Meta's numbers in one place. Bookings happen inside chats, and attendance is posted in the clinic's WhatsApp group. Nothing joins these, or tells them why many ad conversations become few patients in the chair.

## The Core Loop
The agent runs by itself every day with **no file uploads**:
1. It pulls the day's ads, page messages, comments and reactions.
2. It detects bookings in the chats.
3. At the end of the day it sends the receptionist a one-tap attendance list of today's booked names.
4. It updates the funnel and marks the leaking stage.
5. It reads the conversations to explain *why* people didn't book or didn't come (price, reply speed, fear, comparison and similar), and gives the owner the next fix.

The owner opens it to see today's report and what the agent has learned since yesterday.

## Inspiration & Identity
A smart team member reporting to the owner, not a raw analytics dashboard: plain-language findings and one clear next action. It reads people "from every angle", including the psychology and social side of why they don't book.

## Why This Matters to the Learner
He is a practising dentist with his own clinic. He has seen ad conversations fail to become patients. He wants something working "all the time to improve any stage that is wasting" patients, "كأني معين تيم كامل من الميديا باينج".

## What "Working" Looks Like
In the demo:
- The agent runs its daily cycle on a realistic practice page: ads, chats, comments and reactions.
- The owner sees the funnel with the biggest leak marked. For example, "most people ask the price and never get a booking".
- The reasons are quoted from the conversation analysis, next to one fix.
- The receptionist ticks attendance with one tap, and the "attended" stage updates.
- **The "oh, that's cool" beat:** the next day's run reports what improved after the fix and adjusts its advice. The agent is visibly learning.

## The POC Boundary
- A scheduled daily run, with no uploads. It reads ads, page messages, comments and reactions from the learner's own Facebook page through Meta's official API. The public demo runs on a practice data set of the same shape.
- Booking detection from chat text.
- A one-tap attendance page for the receptionist.
- The joined funnel ad → message → booked → attended, with the leaking stage flagged.
- An AI analysis of the conversations explaining *why* the stage leaks, plus one prioritised fix.
- A day-to-day memory that records what was recommended and what changed, and adjusts the next recommendation. This is the "learning".

## Later
- Channels outside Meta (Google, TikTok, walk-ins, referrals).
- Booking capacity / empty slots driving the advice.
- Acting on its own: drafting replies, adjusting ad budgets.
- Deeper sociological and audience analysis beyond the conversation-level "why".

## Explicitly Cut
- **Reading the clinic's WhatsApp group automatically.** WhatsApp gives no official way to read ordinary groups. Unofficial automation breaks WhatsApp's terms and risks the clinic's number being banned. Attendance comes from the one-tap page instead.
- **Real patient data in the public repo or demo video.** Chats hold patients' names and health details. The public build and video use practice data only; the learner runs the real connection privately.
