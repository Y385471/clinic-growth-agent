// Checks that lib/meta.js turns Graph API answers into the same shape as practice mode,
// using a recorded-style sample (made-up ids and people) instead of the network.
// Usage: node scripts/test-meta.mjs
import assert from 'node:assert/strict';
import { liveDay } from '../lib/meta.js';
import { practiceDay } from '../lib/practice.js';

process.env.META_PAGE_ID = '1000';
process.env.META_PAGE_TOKEN = 'test-token';
process.env.META_AD_ACCOUNT = '555';

const SAMPLE = {
  insights: { data: [{ ad_id: '77', ad_name: 'عرض تبييض الأسنان', spend: '400', reach: '9000', clicks: '12',
    actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '9' }] }] },
  conversations: { data: [{
    id: 't_abcdef1234567', updated_time: '2026-09-23T15:00:00+0000',
    participants: { data: [{ id: '2001', name: 'مريضة تجريبية' }, { id: '1000', name: 'Clinic' }] },
    messages: { data: [
      { message: 'تمام بكرة الساعة 5', from: { id: '2001' }, created_time: '2026-09-23T14:30:00+0000' },
      { message: 'السعر 2500 وفي خصم', from: { id: '1000' }, created_time: '2026-09-23T14:20:00+0000' },
      { message: 'التبييض بكام؟ رقمي 01000009999', from: { id: '2001' }, created_time: '2026-09-23T13:00:00+0000' },
    ] },
  }], paging: {} },
  posts: { data: [{
    id: '1000_9', created_time: '2026-09-23T09:00:00+0000', reactions: { summary: { total_count: 42 } },
    comments: { data: [{ id: 'c_1234567890ab', from: { id: '3003', name: 'معلق تجريبي' }, message: 'بكام؟', created_time: '2026-09-23T10:00:00+0000',
      comments: { data: [{ from: { id: '1000' }, message: 'بعتنالك رسالة', created_time: '2026-09-23T10:05:00+0000' }] } }] },
  }] },
};

const fakeFetch = async url => {
  const key = url.includes('/insights') ? 'insights' : url.includes('/conversations') ? 'conversations' : 'posts';
  return { ok: true, json: async () => SAMPLE[key] };
};

const live = await liveDay(20260923, { fetchImpl: fakeFetch });
const practice = practiceDay(1);

const keys = o => Object.keys(o).sort();
assert.deepEqual(keys(live), keys(practice));
assert.deepEqual(keys(live.ads[0]), keys(practice.ads[0]));
assert.deepEqual(keys(live.conversations[0]), keys(practice.conversations[0]));
assert.deepEqual(keys(live.conversations[0].person), keys(practice.conversations[0].person));
assert.deepEqual(keys(live.conversations[0].messages[0]), keys(practice.conversations[0].messages[0]));
assert.deepEqual(keys(live.reactions[0]), keys(practice.reactions[0]));

const msg = live.conversations.find(c => c.source === 'message');
assert.equal(msg.first_reply_minutes, 80, 'clinic replied 80 minutes after the first patient message');
assert.deepEqual(msg.messages.map(m => m.from), ['patient', 'clinic', 'patient'], 'messages are in time order');
assert.equal(live.ads[0].clicks, 9, 'uses messaging conversations started, not raw clicks');
const comment = live.conversations.find(c => c.source === 'comment');
assert.equal(comment.first_reply_minutes, 5);
assert.equal(live.reactions[0].count, 42);
console.log(`meta.js OK — same shape as practice; ${live.conversations.length} conversations, ${live.ads.length} ad, ${live.reactions.length} reaction row`);
