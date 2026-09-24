// Shared helpers for the owner and receptionist pages.
export const $ = sel => document.querySelector(sel);

export async function api(path, options) {
  const res = await fetch(path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export function when(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
}

export const dayLabel = d => (d > 1e7 ? `${String(d).slice(6)}/${String(d).slice(4, 6)}` : `اليوم ${d}`);

export const REASON_AR = {
  price: 'السعر', slow_reply: 'تأخر رد العيادة', no_clinic_reply: 'العيادة لم ترد', fear: 'الخوف',
  trust: 'عدم الثقة', comparison: 'المقارنة بعيادة أخرى', just_asking: 'مجرد استفسار',
  moved_to_phone: 'انتقل للتليفون', other: 'سبب آخر', not_analysed: 'لم يُحلَّل بعد',
};

export const STATUS_AR = { testing: 'تحت الاختبار', confirmed: 'اتأكدت', rejected: 'اترفضت' };
export const STATUS_CLASS = { testing: 'warn', confirmed: 'ok', rejected: 'leak' };
