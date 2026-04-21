'use strict';

/**
 * utils/grok.js
 *
 * AI wrapper — supports BOTH Groq and xAI/Grok APIs automatically.
 * Uses Node 18+ native fetch — zero extra dependencies.
 *
 * The API provider is detected from the key prefix:
 *   gsk_***  → Groq  (console.groq.com) — FREE tier, very fast
 *   xai-***  → xAI   (console.x.ai)     — Grok models
 *
 * Environment variables:
 *   GROK_API_KEY   — your key (gsk_... or xai-...)
 *   GROK_MODEL     — optional override; auto-selected from key type
 *   GROK_TIMEOUT   — optional, request timeout in ms (default 15000)
 *
 * If GROK_API_KEY is not set, the app runs in mock mode with
 * realistic Tangier demo data — safe for development.
 */

// API base auto-detected from key prefix:
//   gsk_***  → Groq (console.groq.com) — fast, free tier available
//   xai-***  → xAI  (console.x.ai)     — Grok models
const GROK_TIMEOUT = parseInt(process.env.GROK_TIMEOUT, 10) || 15_000;

function _getApiConfig() {
    const key   = process.env.GROK_API_KEY || '';
    const model = process.env.GROK_MODEL;

    if (key.startsWith('gsk_')) {
        // Groq key detected → use Groq API with a fast Groq model
        return {
            base:  'https://api.groq.com/openai/v1',
            model: model || "llama-3.3-70b-versatile",   // or 'mixtral-8x7b-32768'
            key,
        };
    }
    // Default: xAI / Grok
    return {
        base:  'https://api.x.ai/v1',
        model: model || 'grok-3-mini',
        key,
    };
}

// ── Core request helper ───────────────────────────────────

/**
 * @param {Array<{role:'system'|'user'|'assistant', content:string}>} messages
 * @param {{ temperature?: number, max_tokens?: number }} [opts]
 * @returns {Promise<string>}  — assistant reply text
 */
async function chatCompletion(messages, opts = {}) {
    const cfg = _getApiConfig();

    if (!cfg.key) {
        // Dev-mode: return a deterministic placeholder so the UI still works
        // without a real key during development / testing.
        console.warn('[AI] GROK_API_KEY not set — returning mock response');
        return _mockResponse(messages);
    }

    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), GROK_TIMEOUT);

    let res;
    try {
        res = await fetch(`${cfg.base}/chat/completions`, {
            method:  'POST',
            signal:  controller.signal,
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${cfg.key}`,
            },
            body: JSON.stringify({
                model:       cfg.model,
                messages,
                temperature: opts.temperature ?? 0.4,
                max_tokens:  opts.max_tokens  ?? 512,
            }),
        });
    } catch (err) {
        if (err.name === 'AbortError') throw new Error('AI request timed out. Please try again.');
        throw new Error('Could not reach AI service. Check your internet connection.');
    } finally {
        clearTimeout(timer);
    }

    if (!res.ok) {
        let detail = '';
        try { detail = (await res.json()).error?.message || ''; } catch {}
        if (res.status === 401) throw new Error('Invalid API key. Check GROK_API_KEY in your .env — xAI keys start with xai-, Groq keys start with gsk_.');
        if (res.status === 429) throw new Error('AI rate limit reached. Please wait a moment and try again.');
        throw new Error(`AI service error (${res.status})${detail ? ': ' + detail : ''}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('AI returned an empty response.');
    return text;
}

// ── Dev-mode mock ─────────────────────────────────────────
function _mockResponse(messages) {
    const last = messages[messages.length - 1]?.content || '';

    if (last.includes('route') || last.includes('طريق')) {
        return JSON.stringify({
            route:       'الطريق عبر شارع محمد السادس ← شارع المسيرة',
            distanceKm:  4.2,
            durationMin: 9,
            traffic:     'low',
            reason:      'Least congestion at this hour based on historical data.',
        });
    }
    if (last.includes('split') || last.includes('fare') || last.includes('أجرة')) {
        return JSON.stringify([
            { name: 'Passenger 1', fareMAD: 18, proportion: 0.55 },
            { name: 'Passenger 2', fareMAD: 14, proportion: 0.45 },
        ]);
    }
    // Default: assistant reply
    return 'مرحباً! أنا مساعد TaxiGo الذكي. يمكنني مساعدتك في اختيار أفضل طريق، حساب الأجرة، أو الإجابة على أسئلتك. كيف يمكنني مساعدتك؟';
}

// ══════════════════════════════════════════════════════════
//   PUBLIC API
// ══════════════════════════════════════════════════════════

/**
 * 1. SMART ROUTING
 *
 * Given a pickup and dropoff location plus optional context,
 * Grok suggests the fastest route, estimated distance/time, and
 * a short human-readable reason.
 *
 * Returns parsed JSON object or throws.
 *
 * @param {{ lat: number, lng: number, address?: string }} pickup
 * @param {{ lat: number, lng: number, address?: string }} dropoff
 * @param {{ lang?: string, timeOfDay?: string }} [context]
 * @returns {Promise<{route:string, distanceKm:number, durationMin:number, traffic:string, reason:string}>}
 */
async function suggestRoute(pickup, dropoff, context = {}) {
    const lang = context.lang || 'ar';
    const time = context.timeOfDay || new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });

    const userPrompt = `
City: Tangier, Morocco.
Pickup:  ${pickup.address  || `${pickup.lat.toFixed(4)}, ${pickup.lng.toFixed(4)}`}
Dropoff: ${dropoff.address || `${dropoff.lat.toFixed(4)}, ${dropoff.lng.toFixed(4)}`}
Current time: ${time}
User language: ${lang}

Suggest the fastest car route. Reply ONLY with a valid JSON object (no markdown):
{
  "route": "<concise route description in the user's language>",
  "distanceKm": <number>,
  "durationMin": <number>,
  "traffic": "low" | "medium" | "high",
  "reason": "<one sentence explanation in the user's language>"
}`.trim();

    const raw = await chatCompletion(
        [
            {
                role:    'system',
                content: 'You are a Tangier city navigation expert. You know every street, shortcut, and traffic pattern in the city. Always respond with valid JSON only — no markdown, no commentary.',
            },
            { role: 'user', content: userPrompt },
        ],
        { temperature: 0.2, max_tokens: 300 }
    );

    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```(?:json)?|```/g, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch {
        throw new Error('AI returned an unreadable route. Please try again.');
    }
}

/**
 * 2. SHARED FARE SPLIT
 *
 * Given an array of passenger segments (each with a calculated fareMAD
 * from fareCalculator.splitSharedFare), Grok produces a fair, human-readable
 * explanation of the split and optionally adjusts for very short legs.
 *
 * Returns parsed JSON array or throws.
 *
 * @param {Array<{userId:string, name:string, distKm:number, fareMAD:number, proportion:number}>} segments
 * @param {{ carType?: string, lang?: string }} [context]
 * @returns {Promise<Array<{name:string, fareMAD:number, proportion:number, note:string}>>}
 */
async function splitFare(segments, context = {}) {
    const lang = context.lang || 'ar';

    const passengerList = segments.map((s, i) =>
        `Passenger ${i + 1} (${s.name || 'Unknown'}): ${s.distKm.toFixed(1)} km segment, base fare ${s.fareMAD} MAD`
    ).join('\n');

    const userPrompt = `
Shared taxi ride in Tangier. Car type: ${context.carType || 'grand_taxi'}.
Passengers and their individual route segments:
${passengerList}

Calculate a fair fare split. Consider:
- Passengers travelling longer distances pay more.
- Minimum fare per passenger is 8 MAD.
- Keep totals close to the base fares but adjust for fairness.

Reply ONLY with a valid JSON array (no markdown):
[
  {
    "name": "<passenger name>",
    "fareMAD": <integer MAD>,
    "proportion": <0-1 decimal>,
    "note": "<one short explanation in ${lang}>"
  }
]`.trim();

    const raw = await chatCompletion(
        [
            {
                role:    'system',
                content: 'You are a fare calculation expert for Tangier grand taxis. Always reply with valid JSON arrays only — no markdown, no commentary.',
            },
            { role: 'user', content: userPrompt },
        ],
        { temperature: 0.1, max_tokens: 400 }
    );

    const cleaned = raw.replace(/```(?:json)?|```/g, '').trim();
    try {
        const result = JSON.parse(cleaned);
        if (!Array.isArray(result)) throw new Error();
        return result;
    } catch {
        throw new Error('AI returned an unreadable fare split. Please try again.');
    }
}

/**
 * 3. AI ASSISTANT (multi-turn)
 *
 * General-purpose trip helper. Handles questions about:
 *   - Routes and traffic in Tangier
 *   - Fare estimates
 *   - App features (booking, premium, shared rides)
 *   - Emergency information
 *
 * @param {Array<{role:'user'|'assistant', content:string}>} history   — full conversation so far
 * @param {string} userMessage   — latest user message
 * @param {{ lang?: string, userName?: string, role?: string }} [context]
 * @returns {Promise<string>}    — assistant reply
 */
async function assistantChat(history, userMessage, context = {}) {
    const lang     = context.lang     || 'ar';
    const userName = context.userName || '';
    const role     = context.role     || 'rider';

    const systemPrompt = `You are TaxiGo Assistant — a helpful, friendly AI for a taxi app in Tangier, Morocco.
User: ${userName || 'Guest'} (${role}).
Language: Respond in ${lang === 'ar' ? 'Arabic' : lang === 'fr' ? 'French' : lang === 'es' ? 'Spanish' : lang === 'de' ? 'German' : 'English'}.

Your capabilities:
- Suggest routes and estimate travel times in Tangier
- Explain fare pricing (economy, comfort, VIP, grand taxi, minibus)
- Help with booking rides, shared rides, and premium features
- Provide emergency guidance and SOS instructions
- Answer general questions about the app

Rules:
- Be concise (2-4 sentences unless the question needs detail)
- Be warm and professional
- Never make up driver names or real-time data you don't have
- If asked about live data (traffic, driver ETA), explain you'd need the app's live sensors`;

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-10), // cap context window at last 10 turns
        { role: 'user', content: userMessage },
    ];

    return chatCompletion(messages, { temperature: 0.6, max_tokens: 400 });
}

module.exports = { suggestRoute, splitFare, assistantChat };
