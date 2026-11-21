import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '2mb' }));

function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.get('/api/ai/health', (_req, res) => {
  const geminiReady = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
  );
  const openaiReady = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
  res.json({
    ok: true,
    providers: {
      gemini: geminiReady,
      openai: openaiReady,
    },
    relay: 'express-server',
  });
});

app.get('/api/catalog/version', (_req, res) => {
  res.json({
    appVersion: '1.0.0',
    catalogVersion: '2026.11.1',
    editionsCount: 6,
    checkedAt: new Date().toISOString(),
  });
});

app.post('/api/ai/ask', async (req, res) => {
  try {
    const {
      provider = 'gemini',
      prompt,
      lang = 'fr',
      passageRef = '',
      passageText = '',
      translationName = '',
      requestedFormat = 'auto',
    } = req.body ?? {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Question vide.' });
    }

    if (provider === 'openai') {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey || !openaiKey.trim()) {
        return res.status(503).json({
          error: 'provider_unconfigured',
          message:
            lang === 'pt'
              ? 'A integração OpenAI ainda não está configurada no servidor ou relay.'
              : 'L’intégration OpenAI n’est pas encore configurée côté serveur ou relais.',
        });
      }

      const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are Siloé Biblical Study Assistant. Reply in ${
                lang === 'pt' ? 'Portuguese' : 'French'
              } as strict JSON matching: { directAnswer, biblicalQuotes: [{ref, text, note}], interpretations: [{label, summary, traditions}], historicalSources: [{title, author, period, detail, url}], biblicalPlaces: [{name, modernName, region, lat, lng, certainty, certaintyNote}], visualMode, visualCaption, documentedArchiveNote, reconstructionSpec: {title, era, description, elements: [string]} }.`,
            },
            {
              role: 'user',
              content: `Passage: ${passageRef} (${translationName})\nText: ${passageText}\nFormat: ${requestedFormat}\nQuestion: ${prompt}`,
            },
          ],
        }),
      });

      const oaiData = (await oaiRes.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      };
      if (!oaiRes.ok) {
        return res.status(oaiRes.status).json({
          error: oaiData.error?.message || 'OpenAI API error',
        });
      }
      const parsed = JSON.parse(oaiData.choices?.[0]?.message?.content || '{}');
      return res.json({ provider: 'openai', data: parsed });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'provider_unconfigured',
        message:
          lang === 'pt'
            ? 'A chave GEMINI_API_KEY não está configurada no servidor.'
            : 'La clé GEMINI_API_KEY n’est pas encore configurée sur le serveur.',
      });
    }

    const systemInstruction =
      lang === 'pt'
        ? `És o assistente de estudo bíblico "Siloé — Atelier biblique". Responde em português claro, erudito e pastoral.
Regras obrigatórias:
1. Cita o texto bíblico exatamente a partir da edição fornecida pelo utilizador sempre que o versículo estiver no contexto fornecido.
2. Fornece fontes históricas e arqueológicas reais e consultáveis (obras antigas como Flávio Josefo, Eusébio, manuscritos, inscrições ou instituições académicas). Nunca inventes URLs falsos; usa apenas URLs estáveis conhecidos (ex. gallica.bnf.fr, perseus.tufts.edu, wikisource.org, britannica.com, biblegateway.com) ou deixa url vazio com referência bibliográfica precisa.
3. Distingue explicitamente diferentes interpretações (histórico-literária, patrística, reformada, contemporânea) sem impor uma leitura única.
4. Para locais bíblicos, indica coordenadas geográficas reais (lat/lng no Levante/Mediterrâneo) e assinala claramente qualquer localização "provável" ou "incerta" (certainty: "certaine" | "probable" | "incertaine").
5. Se o utilizador pedir um mapa, foto documentada ou ilustração/reconstituição, define visualMode adequadamente e preenche documentedArchiveNote ou reconstructionSpec (identificada como reconstituição gerada, nunca como fotografia real).`
        : `Tu es l’assistant d’étude biblique « Siloé — Atelier biblique ». Réponds en français clair, rigoureux et nuancé.
Règles obligatoires :
1. Reprends les citations bibliques exactement depuis l’édition sélectionnée fournie dans le contexte lorsque le passage y figure.
2. Fournis des sources historiques et archéologiques vérifiables et consultables (auteurs antiques comme Flavius Josèphe, Pline, Eusèbe, corpus épigraphiques, musées ou encyclopédies de référence). N’invente jamais d’URL factice ; n’indique une URL que si elle est canonique et fiable (ex. gallica.bnf.fr, perseus.tufts.edu, fr.wikisource.org, britannica.com) ou fournis une référence bibliographique exacte sans URL.
3. Distingue explicitement les différentes interprétations (exégèse littéraire/historique, lectures patristiques, protestantes/catholiques, nuances textuelles).
4. Pour les lieux bibliques, fournis des coordonnées réelles (lat/lng au Levant/Méditerranée) et signale toute localisation « probable » ou « incertaine » (certainty: "certaine" | "probable" | "incertaine").
5. Selon le mode demandé (${requestedFormat}), ajuste visualMode : "written" pour réponse écrite, "map" pour carte de lieux bibliques, "documented_photo" pour notice documentaire d’archive archéologique, ou "generated_reconstruction" pour une reconstitution visuelle schématique explicitement identifiée comme reconstitution générée.`;

    const userContent = [
      passageRef ? `Passage sélectionné : ${passageRef}` : 'Question générale (sans passage verrouillé)',
      translationName ? `Édition biblique active : ${translationName}` : '',
      passageText ? `Texte exact de l’édition :\n${passageText}` : '',
      `Format demandé par l’utilisateur : ${requestedFormat}`,
      `Question : ${prompt.trim()}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const buildRequestConfig = () => ({
      systemInstruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          directAnswer: {
            type: Type.STRING,
            description: 'Réponse structurée en paragraphes séparés par des doubles sauts de ligne.',
          },
          biblicalQuotes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                ref: { type: Type.STRING },
                text: { type: Type.STRING },
                note: { type: Type.STRING },
              },
              required: ['ref', 'text'],
            },
          },
          interpretations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                summary: { type: Type.STRING },
                traditions: { type: Type.STRING },
              },
              required: ['label', 'summary'],
            },
          },
          historicalSources: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                author: { type: Type.STRING },
                period: { type: Type.STRING },
                detail: { type: Type.STRING },
                url: { type: Type.STRING },
              },
              required: ['title', 'author', 'detail'],
            },
          },
          biblicalPlaces: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                modernName: { type: Type.STRING },
                region: { type: Type.STRING },
                lat: { type: Type.NUMBER },
                lng: { type: Type.NUMBER },
                certainty: { type: Type.STRING },
                certaintyNote: { type: Type.STRING },
              },
              required: ['name', 'region', 'lat', 'lng', 'certainty'],
            },
          },
          visualMode: {
            type: Type.STRING,
            description: 'One of: written, map, documented_photo, generated_reconstruction',
          },
          visualCaption: { type: Type.STRING },
          documentedArchiveNote: {
            type: Type.STRING,
            description: 'Notice documentée si mode photo/archive documentée demandé (site, collection, datation).',
          },
          reconstructionSpec: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              era: { type: Type.STRING },
              description: { type: Type.STRING },
              sceneType: {
                type: Type.STRING,
                description: 'One of: vineyard, pool_siloam, temple_court, fishing_boat, scroll_study, city_gate',
              },
              elements: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
        },
        required: ['directAnswer', 'interpretations', 'historicalSources', 'visualMode'],
      },
    });

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: userContent,
        config: buildRequestConfig(),
      });
    } catch (primaryErr) {
      const msg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      if (msg.includes('503') || msg.includes('UNAVAILABLE')) {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: userContent,
          config: buildRequestConfig(),
        });
      } else {
        throw primaryErr;
      }
    }

    const jsonStr = (response.text ?? '{}').trim();
    const parsed = JSON.parse(jsonStr);
    return res.json({ provider: 'gemini', data: parsed });
  } catch (err) {
    console.error('AI /api/ai/ask error:', err);
    const rawMsg = err instanceof Error ? err.message : '';
    const isBusy = rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE') || rawMsg.includes('429');
    const lang = req.body?.lang === 'pt' ? 'pt' : 'fr';
    if (isBusy) {
      return res.status(503).json({
        error: 'gemini_temporarily_unavailable',
        message:
          lang === 'pt'
            ? 'O serviço Gemini está temporariamente sobrecarregado. Tente novamente em alguns instantes; a Bíblia, a Concordância e os Estudos continuam acessíveis.'
            : 'Le service Gemini est temporairement saturé. Réessayez dans quelques instants ; la Bible, la Concordance et vos Études restent pleinement accessibles.',
      });
    }
    return res.status(500).json({
      error:
        lang === 'pt'
          ? 'Erro ao consultar o assistente bíblico.'
          : 'Erreur lors de la consultation de l’assistant biblique.',
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    app.get('/@vite/client', (_req, res) => {
      res.type('application/javascript').send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if (typeof document !== 'undefined') {
  document.querySelectorAll('style[data-vite-dev-id]').forEach((el) => {
    sheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
}
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + CSS.escape(id) + '"]').forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject + (search ? '&' + search.slice(1) : '') + (hash || '');
}
export class ErrorOverlay {}
`);
    });
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Siloé — Atelier biblique server running at http://localhost:${PORT}`);
  });
}

startServer();
