// Picks where a day's data comes from. Both sources return the same shape:
// { ads: [...], conversations: [{ id, day, ad_id, source, person:{key,name,phone}, first_reply_minutes, messages:[{from,minute,text}] }], reactions: [...] }
import { practiceDay } from './practice.js';

export const mode = () => (process.env.MODE === 'live' ? 'live' : 'practice');

export async function collectDay(day) {
  if (mode() === 'live') {
    const { liveDay } = await import('./meta.js');
    return liveDay(day);
  }
  return practiceDay(day);
}
