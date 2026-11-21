/**
 * Cloudflare Worker Relay for Siloé — Atelier biblique (GitHub Pages mode)
 * Keeps GEMINI_API_KEY and optional OPENAI_API_KEY strictly server-side.
 */

export interface Env {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ALLOWED_ORIGIN?: string;
}

function corsHeaders(origin: string | null, allowedOrigin?: string): Record<string, string> {
  const configured = (allowedOrigin || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !s.includes('USERNAME'));

  let allowOrigin = '*';
  if (configured.length > 0) {
    allowOrigin = origin && configured.includes(origin) ? origin : configured[0];
  } else if (origin) {
    allowOrigin = origin;
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    directAnswer: { type: 'STRING' },
    biblicalQuotes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          ref: { type: 'STRING' },
          text: { type: 'STRING' },
          note: { type: 'STRING' },
        },
        required: ['ref', 'text'],
      },
    },
    interpretations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          summary: { type: 'STRING' },
          traditions: { type: 'STRING' },
        },
        required: ['label', 'summary'],
      },
    },
    historicalSources: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          author: { type: 'STRING' },
          period: { type: 'STRING' },
          detail: { type: 'STRING' },
          url: { type: 'STRING' },
        },
        required: ['title', 'author', 'detail'],
      },
    },
    biblicalPlaces: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          modernName: { type: 'STRING' },
          region: { type: 'STRING' },
          lat: { type: 'NUMBER' },
          lng: { type: 'NUMBER' },
          certainty: { type: 'STRING' },
          certaintyNote: { type: 'STRING' },
        },
        required: ['name', 'region', 'lat', 'lng', 'certainty'],
      },
    },
    visualMode: { type: 'STRING' },
    visualCaption: { type: 'STRING' },
    documentedArchiveNote: { type: 'STRING' },
    reconstructionSpec: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        era: { type: 'STRING' },
        description: { type: 'STRING' },
        sceneType: { type: 'STRING' },
        elements: { type: 'ARRAY', items: { type: 'STRING' } },
      },
    },
  },
  required: ['directAnswer', 'interpretations', 'historicalSources', 'visualMode'],
};

async function callGeminiModel(
  model: string,
  apiKey: string,
  systemText: string,
  userText: string
): Promise<Response> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ parts: [{ text: userText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        thinkingConfig: { thinkingLevel: 'LOW' },
      },
    }),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const headers = corsHeaders(request.headers.get('Origin'), env.ALLOWED_ORIGIN);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname === '/api/ai/health' && request.method === 'GET') {
      return Response.json(
        {
          ok: true,
          providers: {
            gemini: Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim()),
            openai: Boolean(env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim()),
          },
          relay: 'cloudflare-worker',
        },
        { headers }
      );
    }

    if (url.pathname === '/api/ai/ask' && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          provider?: 'gemini' | 'openai';
          prompt?: string;
          lang?: 'fr' | 'pt';
          passageRef?: string;
          passageText?: string;
          translationName?: string;
          requestedFormat?: string;
        };

        const lang = body.lang === 'pt' ? 'pt' : 'fr';
        const provider = body.provider || 'gemini';
        if (!body.prompt || typeof body.prompt !== 'string' || !body.prompt.trim()) {
          return Response.json({ error: 'Prompt manquant.' }, { status: 400, headers });
        }

        if (provider === 'openai') {
          if (!env.OPENAI_API_KEY || !env.OPENAI_API_KEY.trim()) {
            return Response.json(
              {
                error: 'provider_unconfigured',
                message:
                  lang === 'pt'
                    ? 'A integração OpenAI ainda não está configurada neste relay.'
                    : 'OpenAI n’est pas encore configuré sur ce relais serveur.',
              },
              { status: 503, headers }
            );
          }

          const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              response_format: { type: 'json_object' },
              messages: [
                {
                  role: 'system',
                  content: `Tu es Siloé, un assistant d'étude biblique érudit, rigoureux et nuancé. Réponds en ${
                    lang === 'pt' ? 'portugais' : 'français'
                  } au format JSON strict avec les clés: directAnswer, biblicalQuotes, interpretations, historicalSources, biblicalPlaces, visualMode, visualCaption, documentedArchiveNote, reconstructionSpec.`,
                },
                {
                  role: 'user',
                  content: `Passage: ${body.passageRef || 'Aucun'} (${body.translationName || ''})\nTexte: ${
                    body.passageText || ''
                  }\nFormat demandé: ${body.requestedFormat || 'auto'}\nQuestion: ${body.prompt.trim()}`,
                },
              ],
            }),
          });
          const oaiData = (await oaiRes.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
            error?: { message?: string };
          };
          if (!oaiRes.ok) {
            return Response.json(
              { error: oaiData.error?.message || 'Erreur OpenAI' },
              { status: oaiRes.status, headers }
            );
          }
          const parsed = JSON.parse(oaiData.choices?.[0]?.message?.content || '{}');
          return Response.json({ provider: 'openai', data: parsed }, { headers });
        }

        if (!env.GEMINI_API_KEY || !env.GEMINI_API_KEY.trim()) {
          return Response.json(
            {
              error: 'provider_unconfigured',
              message:
                lang === 'pt'
                  ? 'GEMINI_API_KEY ausente nos segredos do Worker.'
                  : 'GEMINI_API_KEY manquante dans les secrets du Worker.',
            },
            { status: 503, headers }
          );
        }

        const systemInstruction =
          lang === 'pt'
            ? `És o assistente de estudo bíblico "Siloé — Atelier biblique". Responde em português claro, erudito e pastoral. Cita o texto bíblico exatamente a partir da edição fornecida quando presente. Fornece fontes históricas reais e consultáveis (sem URLs inventados). Distingue explicitamente interpretações e assinala qualquer localização "probable" ou "incertaine".`
            : `Tu es l’assistant d’étude biblique « Siloé — Atelier biblique ». Réponds en français clair, rigoureux et nuancé. Reprends les citations bibliques exactement depuis l’édition fournie lorsque le passage y figure. Fournis des sources historiques et archéologiques vérifiables (sans URL factice). Distingue explicitement les interprétations et signale toute localisation « probable » ou « incertaine ».`;

        const userContent = [
          body.passageRef ? `Passage sélectionné : ${body.passageRef}` : 'Question générale',
          body.translationName ? `Édition biblique active : ${body.translationName}` : '',
          body.passageText ? `Texte exact de l’édition :\n${body.passageText}` : '',
          `Format demandé : ${body.requestedFormat || 'auto'}`,
          `Question : ${body.prompt.trim()}`,
        ]
          .filter(Boolean)
          .join('\n\n');

        let gRes = await callGeminiModel(
          'gemini-4-hydrogen',
          env.GEMINI_API_KEY,
          systemInstruction,
          userContent
        );
        if (gRes.status === 503 || gRes.status === 429) {
          gRes = await callGeminiModel(
            'gemini-3.1-flash-lite',
            env.GEMINI_API_KEY,
            systemInstruction,
            userContent
          );
        }

        const gJson = (await gRes.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          error?: { message?: string };
        };

        if (!gRes.ok) {
          return Response.json(
            {
              error: 'gemini_upstream_error',
              message:
                gRes.status === 503 || gRes.status === 429
                  ? lang === 'pt'
                    ? 'Gemini temporariamente sobrecarregado.'
                    : 'Le service Gemini est temporairement saturé.'
                  : gJson.error?.message || 'Erreur Gemini upstream',
            },
            { status: gRes.status, headers }
          );
        }

        const rawText = gJson.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        return Response.json({ provider: 'gemini', data: JSON.parse(rawText) }, { headers });
      } catch (err) {
        return Response.json(
          { error: err instanceof Error ? err.message : 'Erreur interne du relais.' },
          { status: 500, headers }
        );
      }
    }

    return Response.json({ error: 'Route introuvable' }, { status: 404, headers });
  },
};
