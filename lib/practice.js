// PRACTICE DATA — a made-up clinic, made-up people, made-up numbers (0100000xxxx).
// Same shape as live mode (lib/meta.js).
// Day 1 is a normal week: price questions often wait over an hour for a reply.
// Day 2 is after the fix: price questions answered within minutes, with the offer and instalments
// in the first reply.
// Ad clicks are clicks on the ad's "Send message" button.
// Each line: [who ('p' patient | 'c' clinic), minutes since first message, text]

const ADS = {
  1: [
    { key: 'whitening', name: 'عرض تبييض الأسنان', spend: 400, reach: 9000, clicks: 9 },
    { key: 'aligners', name: 'تقويم شفاف', spend: 350, reach: 7000, clicks: 5 },
    { key: 'implants', name: 'زراعة الأسنان', spend: 300, reach: 5000, clicks: 4 },
  ],
  2: [
    { key: 'whitening', name: 'عرض تبييض الأسنان', spend: 400, reach: 9400, clicks: 9 },
    { key: 'aligners', name: 'تقويم شفاف', spend: 350, reach: 7200, clicks: 5 },
    { key: 'implants', name: 'زراعة الأسنان', spend: 300, reach: 5300, clicks: 5 },
  ],
};

const CONVS = {
  1: [
    { ad: 'whitening', name: 'منى عبد الرحيم', lines: [['p', 0, 'السلام عليكم التبييض بكام؟'], ['c', 95, 'وعليكم السلام يا فندم، التبييض بالليزر 2500 جنيه'], ['p', 140, 'اوه غالي شوية، هفكر وارد على حضرتك']] },
    { ad: 'whitening', name: 'أحمد سمير', lines: [['p', 0, 'بكام التبييض'], ['c', 130, 'أهلاً يا أستاذ أحمد، 2500 جنيه']] },
    { ad: 'whitening', name: 'سارة محمود', phone: '01000001203', lines: [['p', 0, 'عايزة أعرف سعر التبييض وهل بيوجع؟'], ['c', 12, 'أهلاً يا سارة، السعر 2500 وفي خصم 20% الأسبوع ده، ومش بيوجع خالص، الجلسة ساعة'], ['p', 20, 'طب تمام ينفع بكرة الساعة 5؟'], ['c', 24, 'تمام اتحجزلك بكرة الساعة 5 مساءً، ممكن رقمك؟'], ['p', 26, 'ده رقمي 01000001203']] },
    { ad: 'aligners', name: 'كريم فتحي', lines: [['p', 0, 'التقويم الشفاف بكام؟'], ['c', 180, 'أهلاً، يبدأ من 15 ألف حسب الحالة'], ['p', 200, 'شكراً']] },
    { ad: 'aligners', name: 'نورهان علي', lines: [['p', 0, 'عندي تقويم معدن قديم وعايزة شفاف، بس خايفة يطول'], ['c', 40, 'أهلاً يا نورهان، محتاجين كشف الأول عشان نحدد المدة، الكشف 200 جنيه'], ['p', 45, 'طب ينفع السبت؟'], ['c', 50, 'تمام السبت الساعة 7'], ['p', 52, 'تمام']] },
    { ad: 'implants', name: 'محمود حسن', lines: [['p', 0, 'الزرعة بكام؟'], ['c', 75, 'الزرعة 8000 جنيه'], ['p', 90, 'في دكتور جنبي بيعملها ب 6000']] },
    { ad: 'implants', name: 'الحاج عبد الله رشاد', lines: [['p', 0, 'أنا عندي 60 سنة ومريض سكر، ينفع أعمل زراعة؟ ولا فيها خطر'], ['c', 200, 'ينفع بعد التحاليل']] },
    { ad: 'whitening', name: 'ياسمين طه', source: 'comment', lines: [['p', 0, 'بكام؟'], ['c', 300, 'تم الرد في الرسائل']] },
    { ad: 'whitening', name: 'رنا الشريف', source: 'comment', lines: [['p', 0, 'هو التبييض بيضر المينا؟']] },
    { ad: 'whitening', name: 'هدى إبراهيم', lines: [['p', 0, 'السلام عليكم عايزة أحجز تبييض'], ['c', 8, 'أهلاً يا هدى، متاح بكرة الساعة 6 أو الخميس الساعة 4'], ['p', 10, 'بكرة 6'], ['c', 11, 'تم الحجز، في انتظارك']] },
    { ad: 'aligners', name: 'عمر خالد', lines: [['p', 0, 'بكام التقويم؟'], ['c', 65, 'من 15 ألف'], ['p', 70, 'في تقسيط؟'], ['c', 160, 'أيوه على 12 شهر']] },
    { ad: 'implants', name: 'سعاد مصطفى', lines: [['p', 0, 'أنا خايفة جداً من الزراعة، هو بيبقى فيه بنج؟'], ['c', 25, 'أكيد يا فندم بنج موضعي ومش هتحسي بحاجة، ممكن تيجي كشف مجاني الأول'], ['p', 30, 'طيب هشوف وأرد']] },
    { ad: 'whitening', name: 'مصطفى جمال', phone: '01000001299', lines: [['p', 0, 'ممكن رقم العيادة؟ أو أبعتلكم رقمي 0100 000 1299'], ['c', 15, 'هنكلمك حالاً يا فندم'], ['p', 16, 'تمام']] },
    { ad: 'aligners', name: 'إسراء عادل', lines: [['p', 0, 'بكام التقويم الشفاف؟'], ['c', 20, 'أهلاً يا إسراء، يبدأ من 15 ألف وفي تقسيط على 12 شهر من غير فوايد، تحبي تحجزي كشف ب 200؟'], ['p', 25, 'أيوه الحد الجاي'], ['c', 27, 'تمام الحد الساعة 6']] },
  ],
  2: [
    { ad: 'whitening', name: 'شيماء فؤاد', lines: [['p', 0, 'التبييض بكام'], ['c', 6, 'أهلاً يا شيماء، 2500 وفي خصم 20% لآخر الأسبوع يعني 2000، تحبي أحجزلك؟'], ['p', 10, 'أيوه ينفع الأربع؟'], ['c', 12, 'تمام الأربع الساعة 5']] },
    { ad: 'whitening', name: 'حسام الدين وهبة', lines: [['p', 0, 'بكام التبييض؟'], ['c', 9, '2000 بالخصم لآخر الأسبوع، ومتاح بكرة'], ['p', 15, 'هفكر وأكلمكم']] },
    { ad: 'whitening', name: 'دينا صلاح', lines: [['p', 0, 'بكام؟ وبيوجع؟'], ['c', 5, '2000 بالخصم، ومش بيوجع خالص، الجلسة ساعة'], ['p', 8, 'تمام عايزة بكرة'], ['c', 9, 'اتحجزلك بكرة الساعة 6']] },
    { ad: 'aligners', name: 'مروان أشرف', lines: [['p', 0, 'التقويم الشفاف بكام؟'], ['c', 10, 'يبدأ من 15 ألف وتقسيط 12 شهر بدون فوايد، والكشف 200'], ['p', 14, 'تمام احجزلي كشف الخميس'], ['c', 15, 'تمام الخميس الساعة 7']] },
    { ad: 'aligners', name: 'ليلى منصور', lines: [['p', 0, 'بكام التقويم'], ['c', 8, 'يبدأ من 15 ألف وتقسيط 12 شهر بدون فوايد'], ['p', 30, 'لسه غالي عليا حتى بالتقسيط']] },
    { ad: 'implants', name: 'عادل رمضان', lines: [['p', 0, 'الزرعة بكام'], ['c', 7, '8000 شاملة الدعامة، والكشف والأشعة مجاناً'], ['p', 12, 'طب تمام السبت'], ['c', 13, 'السبت الساعة 5']] },
    { ad: 'implants', name: 'الحاجة فاطمة الزهراء', lines: [['p', 0, 'أنا عندي سكر ينفع زراعة؟'], ['c', 15, 'ينفع طالما السكر منتظم، والدكتور هيشوف التحاليل في الكشف المجاني'], ['p', 25, 'ماشي احجزلي'], ['c', 26, 'الأحد الساعة 6']] },
    { ad: 'whitening', name: 'ريهام نبيل', source: 'comment', lines: [['p', 0, 'بكام'], ['c', 10, '2000 بالخصم، بعتنالك رسالة']] },
    { ad: 'whitening', name: 'وليد عثمان', source: 'comment', lines: [['p', 0, 'الخصم لحد امتى'], ['c', 20, 'لآخر الأسبوع']] },
    { ad: 'whitening', name: 'نادية كمال', lines: [['p', 0, 'عايزة أحجز تبييض لبنتي'], ['c', 4, 'متاح بكرة الساعة 4'], ['p', 6, 'تمام']] },
    { ad: 'aligners', name: 'طارق زكي', lines: [['p', 0, 'بكام التقويم'], ['c', 120, 'من 15 ألف']] },
    { ad: 'implants', name: 'منير سليمان', lines: [['p', 0, 'الزرعة بتوجع؟'], ['c', 20, 'بنج موضعي ومش هتحس بحاجة'], ['p', 40, 'هفكر، أنا خايف بصراحة']] },
    { ad: 'whitening', name: 'علا حمدي', lines: [['p', 0, 'ممكن العنوان؟'], ['c', 10, 'شارع التجربة، عمارة 1 (عنوان تجريبي)'], ['p', 11, 'شكراً']] },
    { ad: 'aligners', name: 'جنى مجدي', lines: [['p', 0, 'التقويم الشفاف بكام وهل ينفع لسني 30؟'], ['c', 9, 'ينفع لأي سن، يبدأ من 15 ألف وتقسيط'], ['p', 13, 'تمام احجزلي الحد'], ['c', 14, 'الحد الساعة 7']] },
    { ad: 'implants', name: 'حمدي بيومي', lines: [['p', 0, 'في دكتور بيعمل الزرعة ب 6000'], ['c', 12, 'الفرق في نوع الزرعة، وعندنا ضمان 10 سنين'], ['p', 20, 'هقارن وأرد']] },
  ],
};

const REACTIONS = {
  1: [['whitening', 'LIKE', 120], ['whitening', 'LOVE', 30], ['aligners', 'LIKE', 64], ['implants', 'LIKE', 41], ['implants', 'WOW', 6]],
  2: [['whitening', 'LIKE', 131], ['whitening', 'LOVE', 34], ['aligners', 'LIKE', 70], ['implants', 'LIKE', 45], ['implants', 'WOW', 7]],
};

export const PRACTICE_DAYS = Object.keys(CONVS).map(Number);

// Returns { ads, conversations, reactions } in the shared source shape.
export function practiceDay(day) {
  const d = ((day - 1) % PRACTICE_DAYS.length) + 1; // days beyond 2 repeat the cycle
  const ads = ADS[d].map(a => ({ id: `d${day}-${a.key}`, day, name: a.name, spend: a.spend, reach: a.reach, clicks: a.clicks }));
  const conversations = CONVS[d].map((c, i) => {
    const n = String(i + 1).padStart(2, '0');
    const firstReply = c.lines.find(l => l[0] === 'c');
    return {
      id: `d${day}-c${n}`, day, ad_id: `d${day}-${c.ad}`, source: c.source || 'message',
      person: { key: `d${day}-p${n}`, name: c.name, phone: c.phone || null },
      first_reply_minutes: firstReply ? firstReply[1] : null,
      messages: c.lines.map(([who, minute, text]) => ({ from: who === 'p' ? 'patient' : 'clinic', minute, text })),
    };
  });
  const reactions = REACTIONS[d].map(([post, type, count]) => ({ day, post_id: `post-${post}`, type, count }));
  return { ads, conversations, reactions };
}
