// Conversation Analyst — Gemini (free tier) with a JSON schema, so answers come back as data, not prose.
// Only scrubbed text is ever passed in here.
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

export const LOSS_REASONS = ['none', 'price', 'slow_reply', 'no_clinic_reply', 'fear', 'trust', 'comparison', 'just_asking', 'moved_to_phone', 'other'];

const sleep = ms => new Promise(r => setTimeout(r, ms));

// One Gemini call. `onSend` lets a test inspect exactly what leaves the server.
export async function gemini(prompt, schema, { onSend } = {}) {
  onSend?.(prompt);
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2 },
  });
  let lastError;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
        try { return { model, value: JSON.parse(text) }; } catch { lastError = new Error(`${model}: reply was not JSON`); break; }
      }
      lastError = new Error(`${model} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
      if (res.status === 503 || res.status === 429 || res.status >= 500) { await sleep(1500 * (attempt + 1)); continue; }
      break; // 4xx other than 429: try the next model
    }
  }
  throw lastError;
}

const ANALYSIS_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      id: { type: 'STRING' },
      booked: { type: 'BOOLEAN', description: 'true only if the patient agreed to a specific day or time' },
      booking_date: { type: 'STRING', description: 'the agreed day/time in the chat words, or empty' },
      asked_price: { type: 'BOOLEAN' },
      loss_reason: { type: 'STRING', enum: LOSS_REASONS, description: "main reason they did not book; 'none' if booked" },
      reason_text: { type: 'STRING', description: 'one short Arabic sentence explaining the reason' },
      quote: { type: 'STRING', description: "the patient's own words (verbatim, short) that best show the reason" },
      signals: {
        type: 'OBJECT',
        properties: {
          price_anxiety: { type: 'BOOLEAN' }, fear: { type: 'BOOLEAN' },
          trust_doubt: { type: 'BOOLEAN' }, comparing: { type: 'BOOLEAN' },
        },
        required: ['price_anxiety', 'fear', 'trust_doubt', 'comparing'],
      },
    },
    required: ['id', 'booked', 'booking_date', 'asked_price', 'loss_reason', 'reason_text', 'quote', 'signals'],
  },
};

function render(c) {
  const lines = c.messages.map(m => `${m.from === 'patient' ? 'المريض' : 'العيادة'} [دقيقة ${m.minute}]: ${m.text}`);
  const reply = c.first_reply_minutes == null ? 'العيادة لم ترد أبداً' : `أول رد من العيادة بعد ${c.first_reply_minutes} دقيقة`;
  return `### ${c.id} (${c.source === 'comment' ? 'تعليق على إعلان' : 'رسالة'}؛ ${reply})\n${lines.join('\n')}`;
}

// conversations: scrubbed conversations. Returns { model, byId: { id: analysis } }.
export async function analyseConversations(conversations, opts = {}) {
  const prompt = `أنت محلل تسويق لعيادة أسنان في مصر. اقرأ كل محادثة من محادثات صفحة العيادة (من إعلانات فيسبوك) وحدد:
- هل المريض حجز فعلاً (وافق على يوم أو ميعاد محدد)؟
- إن لم يحجز: السبب الرئيسي من القائمة، مع جملة قصيرة بالعربي، واقتباس قصير من كلام المريض نفسه.
- إشارات نفسية: قلق من السعر، خوف، شك في الثقة، مقارنة بعيادة أخرى.
انتبه لسرعة رد العيادة: إذا سأل المريض عن السعر وتأخر الرد أكثر من ساعة ثم لم يحجز فالسبب غالباً slow_reply. إذا لم ترد العيادة أبداً فالسبب no_clinic_reply.
الأسماء استبدلت برموز مثل "مريض 1-03" للخصوصية.
أرجع عنصراً واحداً لكل محادثة بنفس الـ id.

${conversations.map(render).join('\n\n')}`;
  const { model, value } = await gemini(prompt, ANALYSIS_SCHEMA, opts);
  const byId = Object.fromEntries((value || []).map(a => [a.id, a]));
  return { model, byId };
}

const SUMMARY_SCHEMA = {
  type: 'OBJECT',
  properties: Object.fromEntries(['ad', 'message', 'booked', 'attended'].map(s => [s, {
    type: 'OBJECT',
    properties: { problem: { type: 'STRING' }, fix: { type: 'STRING' } },
    required: ['problem', 'fix'],
  }])),
  required: ['ad', 'message', 'booked', 'attended'],
};

// stats: numbers and top reasons per stage (no personal data). Returns { stage: {problem, fix} }.
export async function summariseStages(stats, opts = {}) {
  const prompt = `أنت عضو ذكي في فريق "ميديا باينج" لعيادة أسنان، تكتب تقريراً قصيراً لصاحب العيادة بالعامية المصرية المهذبة.
هذه أرقام قمع اليوم (إعلان ← رسالة ← حجز ← حضور) وأسباب الخسارة المستخرجة من المحادثات:
${JSON.stringify(stats, null, 1)}

الإعلانات من نوع "إرسال رسالة" على ماسنجر فيسبوك (لا يوجد موقع أو صفحة هبوط أو واتساب).
كل مرحلة تشرح الخسارة التي حدثت قبل الوصول إليها:
- ad: أداء الإعلانات نفسها (الوصول، التكلفة، ضغطات زر المراسلة لكل إعلان).
- message: من ضغط زر المراسلة ولم يبدأ محادثة فعلاً.
- booked: من راسل ولم يحجز — هنا تُستخدم أسباب الخسارة من المحادثات واقتباساتها وسرعة الرد على سؤال السعر.
- attended: من حجز ولم يحضر (إذا لم يُسجَّل الحضور بعد قل ذلك، واقترح ما يزيد نسبة الحضور).
اكتب:
- problem: جملة واحدة واضحة عن المشكلة، فيها رقم من البيانات.
- fix: جملة واحدة بإجراء محدد يمكن تنفيذه غداً.
لا تخترع أرقاماً غير موجودة. إذا كانت بيانات الحضور ناقصة قل ذلك.`;
  const { model, value } = await gemini(prompt, SUMMARY_SCHEMA, opts);
  return { model, value };
}
