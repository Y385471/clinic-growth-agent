// Privacy scrubber: names and Egyptian phone numbers never leave the server.
// The real values are kept only encrypted, in Supabase.
import crypto from 'node:crypto';

const toLatinDigits = s => s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
// 010/011/012/015 mobile numbers, optional +20, with spaces or dashes in between; Arabic-Indic digits too.
const PHONE = /(?:\+?\s*[2٢][0٠][\s-]*)?[0٠][\s-]*[1١][\s-]*[0125٠١٢٥](?:[\s-]*[0-9٠-٩]){8}/g;

const TITLES = ['الحاج', 'الحاجة', 'أستاذ', 'دكتور'];
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Whole-word match: a name part must not sit inside a longer word ("علي" must not hit "تعليق").
export const wordRe = w => new RegExp(`(?<!\\p{L})${esc(w)}(?!\\p{L})`, 'gu');
export const nameParts = name => (name || '').split(/\s+/).filter(p => p.length >= 3 && !TITLES.includes(p));

export function scrubText(text, realName, alias) {
  let out = text.replace(PHONE, '[رقم هاتف]');
  for (const p of [realName, ...nameParts(realName)].filter(Boolean)) out = out.replace(wordRe(p), alias);
  return out;
}

export function findPhones(text) {
  return (text.match(PHONE) || []).map(p => toLatinDigits(p).replace(/\D/g, '').slice(-11));
}

// Throws if any real name part or phone number survived scrubbing.
export function assertClean(text, realName, phones = []) {
  for (const p of nameParts(realName)) if (wordRe(p).test(text)) throw new Error('privacy: a name part survived scrubbing');
  const digits = toLatinDigits(text).replace(/\D/g, '');
  for (const ph of phones) if (ph && digits.includes(ph.slice(-8))) throw new Error('privacy: a phone number survived scrubbing');
  if (new RegExp(PHONE.source).test(text)) throw new Error('privacy: a phone-shaped number survived scrubbing');
}

function key() {
  return crypto.createHash('sha256').update(process.env.CGA_ENC_KEY || process.env.SUPABASE_SERVICE_KEY || '').digest();
}

export function encrypt(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(String(value), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.');
}

export function decrypt(blob) {
  if (!blob) return null;
  const [iv, tag, enc] = blob.split('.').map(s => Buffer.from(s, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}
