import type {
  AIProviderId,
  AssistantFormatMode,
  AssistantStructuredReply,
  UILanguage,
} from '../types/siloe';

function isLocalFullstackHost(): boolean {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.run.app');
}

function getRelayBase(): string {
  if (isLocalFullstackHost()) {
    return '';
  }
  const raw = (import.meta.env.VITE_AI_RELAY_URL as string | undefined)?.trim() || '';
  const valid = /^https?:\/\//i.test(raw) && !raw.includes('MY_') && !raw.includes('USERNAME');
  return valid ? raw.replace(/\/$/, '') : '';
}

function apiEndpoint(path: string): string {
  const base = getRelayBase();
  return base ? `${base}${path}` : path;
}

export interface AIHealthStatus {
  ok: boolean;
  providers: {
    gemini: boolean;
    openai: boolean;
  };
  relay: string;
}

export async function checkAIHealth(): Promise<AIHealthStatus | null> {
  if (!isLocalFullstackHost() && !getRelayBase()) {
    return {
      ok: false,
      providers: { gemini: false, openai: false },
      relay: 'unconfigured',
    };
  }
  try {
    const res = await fetch(apiEndpoint('/api/ai/health'));
    if (!res.ok) return null;
    return (await res.json()) as AIHealthStatus;
  } catch {
    return null;
  }
}

export async function askBiblicalAssistant(params: {
  provider: AIProviderId;
  prompt: string;
  lang: UILanguage;
  passageRef?: string;
  passageText?: string;
  translationName?: string;
  requestedFormat: AssistantFormatMode;
}): Promise<{ provider: AIProviderId; data: AssistantStructuredReply }> {
  if (!isLocalFullstackHost() && !getRelayBase()) {
    throw new Error(
      params.lang === 'pt'
        ? 'O relay do servidor (VITE_AI_RELAY_URL) ainda não foi configurado para o GitHub Pages.'
        : 'Le relais serveur (VITE_AI_RELAY_URL) n’est pas encore configuré pour cette publication GitHub Pages.'
    );
  }
  const res = await fetch(apiEndpoint('/api/ai/ask'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.message || payload.error || `Erreur serveur (${res.status})`);
  }
  return payload as { provider: AIProviderId; data: AssistantStructuredReply };
}
