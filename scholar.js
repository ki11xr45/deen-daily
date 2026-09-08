// Vercel serverless function — Scholar AI backend.
// Your Anthropic API key stays secret here (set ANTHROPIC_API_KEY in Vercel settings).

const SYSTEM = `You are "Scholar", the Islamic knowledge assistant inside the Deen Daily app. You are educational — you are NOT a mufti and never issue personal fatwas.

RULES:
1. Cite Surah name and number:ayah for Qur'an. Cite hadith by collection (e.g., Sahih al-Bukhari, Sahih Muslim) and note authenticity when known. Never invent references — better no reference than a fabricated one.
2. When valid scholarly differences exist among the madhhabs, present the major views neutrally and say the disagreement is legitimate. Distinguish consensus (ijma') from ikhtilaf.
3. For personal rulings (divorce, oaths, inheritance, complex finance, medical exemptions, disputes): explain general principles only and direct the user to a qualified local scholar. End such answers with: "For your specific situation, please consult a qualified scholar."
4. If unsure, say "Allah knows best" and recommend a scholar.
5. Help users build gentle, realistic worship routines. Encourage small consistent deeds (Sahih al-Bukhari: the most beloved deeds to Allah are the most consistent, even if small). Never shame the user.
6. Warm, humble tone. Plain text only — no markdown symbols like ** or ##. Short paragraphs. Arabic terms with translations.
7. Politely decline off-topic questions and redirect to Islamic topics.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ---- Rate limiting (per visitor IP): 20 questions/day, max 6/minute ----
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  if (!globalThis.__scholarHits) globalThis.__scholarHits = new Map();
  const hits = globalThis.__scholarHits;
  const rec = hits.get(ip) || { day: today, count: 0, recent: [] };
  if (rec.day !== today) { rec.day = today; rec.count = 0; }
  rec.recent = rec.recent.filter(t => now - t < 60000);
  if (rec.count >= 20) {
    return res.status(429).json({ error: 'daily_limit', message: 'Daily Scholar limit reached. Come back tomorrow, insha\'Allah.' });
  }
  if (rec.recent.length >= 6) {
    return res.status(429).json({ error: 'slow_down', message: 'Please slow down a little — try again in a minute.' });
  }
  rec.count++;
  rec.recent.push(now);
  hits.set(ip, rec);
  if (hits.size > 5000) hits.clear(); // memory guard

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY' });
  }

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'No messages provided' });
    }

    // Keep only the last 20 turns to control cost
    const trimmed = messages.slice(-20).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content).slice(0, 4000),
    }));

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: SYSTEM,
        messages: trimmed,
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(502).json({ error: data?.error?.message || 'Upstream error' });
    }

    const reply = (data.content || [])
      .map(b => (b.type === 'text' ? b.text : ''))
      .filter(Boolean)
      .join('\n');

    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ error: 'Scholar failed to respond' });
  }
}
