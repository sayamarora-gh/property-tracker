export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { listingText, notes } = await req.json();

    const SYSTEM_PROMPT = `You are an expert Australian property analyst helping a first home buyer in Victoria.

BUYER PROFILE:
- Budget: $950k–$1.15M (ideally under $1.05M)
- Cash available: ~$240k (after stamp duty ~$182k–$190k left as deposit)
- Monthly budget: $7,500 total (mortgage + all costs)
- Mortgage rate assumption: 6.8%

NON-NEGOTIABLES (dealbreakers if missing):
1. 3 bed 2 bath minimum
2. 30–35 min drive from Melbourne CBD (weekend)
3. 45–50 min public transport to work (weekday 8am)
4. Nearby public transport
5. Backyard or courtyard
6. Park within ~500m
7. Gym + pilates studio nearby
8. Central heating and cooling
9. Natural lighting

NICE TO HAVE:
- Walk-in robe with ensuite
- Front yard
- Outdoor entertaining / patio / deck
- Quality daycare nearby
- Cafes and eateries walkable

Analyse the listing and respond ONLY with valid JSON (no markdown, no preamble, no backticks):
{
  "address": "full street address",
  "price": "price or range as string",
  "suburb": "suburb name",
  "type": "House / Townhouse / Apartment / Unit",
  "bedrooms": number,
  "bathrooms": number,
  "parking": number,
  "landSize": "land size string or null",
  "score": number 1-10,
  "verdict": "BUY / WATCH / PASS",
  "pros": ["pro 1", "pro 2", "pro 3"],
  "cons": ["con 1", "con 2"],
  "nonNegotiables": {
    "beds_baths": true or false,
    "cbd_drive": true or false,
    "public_transport": true or false,
    "pt_nearby": true or false,
    "backyard": true or false,
    "park_nearby": true or false,
    "gym_pilates": true or false,
    "heating_cooling": true or false,
    "natural_light": true or false
  },
  "estimatedLoan": number,
  "estimatedMonthly": number,
  "growthOutlook": "Strong / Moderate / Weak",
  "summary": "2-3 sentence sharp analysis for this buyer",
  "redFlags": ["flag 1"] or []
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ 
          role: 'user', 
          content: `Analyse this property listing:\n\n${listingText}\n\nPersonal notes: ${notes || 'None'}` 
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: err }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const data = await response.json();
    const raw = data.content?.map(b => b.text || '').join('') || '{}';
    const clean = raw.replace(/```json|```/g, '').trim();

    return new Response(clean, {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
