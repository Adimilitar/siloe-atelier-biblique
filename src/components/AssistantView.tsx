import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  ExternalLink,
  FilePlus2,
  MapPin,
  Send,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';
import { tCopy } from '../data/i18n';
import { useOnlineStatus } from '../hooks/useViewportAndNetwork';
import { askBiblicalAssistant, checkAIHealth, type AIHealthStatus } from '../services/aiService';
import type {
  AIProviderId,
  AssistantFormatMode,
  AssistantMessage,
  BibleEditionMeta,
  SavedMediaAsset,
  StudyDocument,
  UILanguage,
} from '../types/siloe';
import {
  BiblicalMapCard,
  buildMapSvgString,
  buildReconstructionSvgString,
  ReconstructionCard,
} from './BiblicalVisuals';
import { LiquidModal } from './LiquidModal';

interface AssistantViewProps {
  lang: UILanguage;
  provider: AIProviderId;
  onChangeProvider: (p: AIProviderId) => void;
  messages: AssistantMessage[];
  onAppendMessage: (msg: AssistantMessage) => void;
  attachedContext: {
    ref: string;
    text: string;
    edition: BibleEditionMeta;
  } | null;
  onClearContext: () => void;
  studies: StudyDocument[];
  onInsertIntoStudy: (params: {
    studyId: string;
    html: string;
    mediaAsset?: SavedMediaAsset;
    refLabel?: string;
  }) => void;
  onOpenStudiesTab: () => void;
}

function isSafeHttpUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export const AssistantView: React.FC<AssistantViewProps> = ({
  lang,
  provider,
  onChangeProvider,
  messages,
  onAppendMessage,
  attachedContext,
  onClearContext,
  studies,
  onInsertIntoStudy,
  onOpenStudiesTab,
}) => {
  const copy = tCopy(lang);
  const isOnline = useOnlineStatus();
  const [prompt, setPrompt] = useState('');
  const [formatMode, setFormatMode] = useState<AssistantFormatMode>('auto');
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<AIHealthStatus | null>(null);

  // Add to Study modal state
  const [exportMsg, setExportMsg] = useState<AssistantMessage | null>(null);
  const [selectedParagraphIdxs, setSelectedParagraphIdxs] = useState<number[]>([]);
  const [includeQuotesAndSources, setIncludeQuotesAndSources] = useState(true);
  const [includeMap, setIncludeMap] = useState(true);
  const [includeReconstruction, setIncludeReconstruction] = useState(true);
  const [targetStudyId, setTargetStudyId] = useState<string>(studies[0]?.id || '');

  useEffect(() => {
    void checkAIHealth().then((status) => {
      setHealth(status);
      if (status && !status.providers.openai && provider === 'openai') {
        onChangeProvider('gemini');
      }
    });
  }, [isOnline, provider, onChangeProvider]);

  useEffect(() => {
    if (studies.length > 0 && !studies.some((s) => s.id === targetStudyId)) {
      setTargetStudyId(studies[0].id);
    }
  }, [studies, targetStudyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    const userMsg: AssistantMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      prompt: prompt.trim(),
      passageRef: attachedContext?.ref,
      translationId: attachedContext?.edition.id,
      translationTitle: attachedContext?.edition.title,
      createdAt: new Date().toISOString(),
    };
    onAppendMessage(userMsg);
    const currentPrompt = prompt.trim();
    setPrompt('');
    setLoading(true);

    try {
      const res = await askBiblicalAssistant({
        provider,
        prompt: currentPrompt,
        lang,
        passageRef: attachedContext?.ref,
        passageText: attachedContext?.text,
        translationName: attachedContext?.edition.title,
        requestedFormat: formatMode,
      });

      onAppendMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        provider: res.provider,
        passageRef: attachedContext?.ref,
        translationId: attachedContext?.edition.id,
        translationTitle: attachedContext?.edition.title,
        reply: res.data,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      onAppendMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        provider,
        error: err instanceof Error ? err.message : 'Service indisponible.',
        createdAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const openAddToStudyModal = (msg: AssistantMessage) => {
    const paragraphs = (msg.reply?.directAnswer || '').split(/\n\n+/).filter(Boolean);
    setSelectedParagraphIdxs(paragraphs.map((_, idx) => idx));
    setIncludeQuotesAndSources(true);
    setIncludeMap(Boolean(msg.reply?.biblicalPlaces?.length));
    setIncludeReconstruction(Boolean(msg.reply?.reconstructionSpec));
    setExportMsg(msg);
  };

  const paragraphsOfExport = useMemo(
    () => (exportMsg?.reply?.directAnswer || '').split(/\n\n+/).filter(Boolean),
    [exportMsg]
  );

  const handleConfirmAddToStudy = () => {
    if (!exportMsg?.reply || !targetStudyId) return;
    const reply = exportMsg.reply;
    const parts: string[] = [];

    if (exportMsg.passageRef) {
      parts.push(
        `<p><strong>${exportMsg.passageRef}</strong> (${exportMsg.translationTitle || 'Siloé'})</p>`
      );
    }

    selectedParagraphIdxs
      .slice()
      .sort((a, b) => a - b)
      .forEach((idx) => {
        const p = paragraphsOfExport[idx];
        if (p) parts.push(`<p>${p.replace(/</g, '&lt;')}</p>`);
      });

    if (includeQuotesAndSources && reply.biblicalQuotes && reply.biblicalQuotes.length > 0) {
      reply.biblicalQuotes.forEach((q) => {
        parts.push(
          `<blockquote><p><strong>${q.ref}</strong> : ${q.text}</p></blockquote>`
        );
      });
    }

    if (includeQuotesAndSources && reply.historicalSources && reply.historicalSources.length > 0) {
      const listItems = reply.historicalSources
        .map((s) => `<li><strong>${s.author}</strong>, <em>${s.title}</em> — ${s.detail}</li>`)
        .join('');
      parts.push(`<p><strong>${copy.assistant.sourcesTitle}</strong></p><ul>${listItems}</ul>`);
    }

    let mediaAsset: SavedMediaAsset | undefined;
    if (includeMap && reply.biblicalPlaces && reply.biblicalPlaces.length > 0) {
      mediaAsset = {
        id: crypto.randomUUID(),
        kind: 'map',
        title: `${lang === 'pt' ? 'Mapa' : 'Carte'} — ${exportMsg.passageRef || 'Lieux bibliques'}`,
        caption: reply.visualCaption || reply.biblicalPlaces.map((p) => `${p.name} (${p.certainty})`).join(', '),
        sourceCredits: `Siloé Assistant (${exportMsg.provider || 'gemini'}) · ${
          exportMsg.translationTitle || ''
        }`,
        svgMarkup: buildMapSvgString(reply.biblicalPlaces, lang),
        createdAt: new Date().toISOString(),
      };
    } else if (includeReconstruction && reply.reconstructionSpec) {
      mediaAsset = {
        id: crypto.randomUUID(),
        kind: 'reconstruction',
        title: reply.reconstructionSpec.title,
        caption: `${copy.assistant.reconstructionBadge} — ${reply.reconstructionSpec.description}`,
        sourceCredits: `Siloé Assistant (${exportMsg.provider || 'gemini'})`,
        svgMarkup: buildReconstructionSvgString(reply.reconstructionSpec, lang),
        createdAt: new Date().toISOString(),
      };
    }

    if (attachedContext?.edition.rights.requiresAttribution) {
      parts.push(`<p><small>${attachedContext.edition.rights.attributionText}</small></p>`);
    }

    onInsertIntoStudy({
      studyId: targetStudyId,
      html: parts.join('') + '<p><br></p>',
      mediaAsset,
      refLabel: exportMsg.passageRef,
    });
    setExportMsg(null);
  };

  return (
    <div className="space-y-4 pb-28">
      {/* Assistant Header & Provider / Format Bar */}
      <div className="liquid-glass rounded-3xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-serif-bible text-xl sm:text-2xl font-bold text-[var(--siloe-ink)]">
              {copy.assistant.title}
            </h1>
            <p className="text-xs text-[var(--siloe-ink-muted)]">{copy.assistant.subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[var(--siloe-ink-muted)]">
              {copy.assistant.providerLabel}
            </label>
            <select
              value={provider}
              onChange={(e) => {
                const next = e.target.value as AIProviderId;
                if (next === 'openai' && !health?.providers.openai) return;
                onChangeProvider(next);
              }}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs font-semibold text-[var(--siloe-ink)]"
            >
              <option value="gemini">
                {health === null
                  ? 'Gemini'
                  : health.providers.gemini
                  ? lang === 'pt'
                    ? 'Gemini (Ativo)'
                    : 'Gemini (Actif)'
                  : lang === 'pt'
                  ? 'Gemini (Indisponível)'
                  : 'Gemini (Indisponible)'}
              </option>
              <option value="openai" disabled={!health?.providers.openai}>
                {health?.providers.openai
                  ? lang === 'pt'
                    ? 'OpenAI (Ativo)'
                    : 'OpenAI (Actif)'
                  : lang === 'pt'
                  ? 'OpenAI — Opcional (não configurado)'
                  : 'OpenAI — Facultatif (non configuré)'}
              </option>
            </select>
          </div>
        </div>

        {/* Format Mode Pills */}
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/10">
          {(
            [
              ['auto', copy.assistant.formatAuto],
              ['written', copy.assistant.formatWritten],
              ['map', copy.assistant.formatMap],
              ['documented_photo', copy.assistant.formatPhoto],
              ['generated_reconstruction', copy.assistant.formatReconstruction],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setFormatMode(m)}
              className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                formatMode === m
                  ? 'bg-[var(--siloe-bg-solid)] text-[var(--siloe-ink)] shadow-sm'
                  : 'text-[var(--siloe-ink-muted)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Attached Passage Banner */}
        {attachedContext && (
          <div className="rounded-2xl border border-[var(--siloe-accent)]/30 bg-[var(--siloe-accent)]/8 p-3 flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="text-xs font-semibold text-[var(--siloe-accent)] flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span>
                  {attachedContext.ref} · {attachedContext.edition.title}
                </span>
              </div>
              <p className="text-xs text-[var(--siloe-ink-muted)] line-clamp-2 font-serif-bible">
                {attachedContext.text}
              </p>
            </div>
            <button
              type="button"
              onClick={onClearContext}
              aria-label={copy.assistant.clearContext}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl hover:bg-black/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Offline / Service Status Banner */}
        {!isOnline && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[var(--siloe-ink)]">
              <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{copy.assistant.offlineNotice}</span>
            </div>
            <button
              type="button"
              onClick={onOpenStudiesTab}
              className="min-h-[36px] px-3 py-1 rounded-xl bg-[var(--siloe-bg-solid)] border border-[var(--siloe-border)] font-semibold whitespace-nowrap"
            >
              {copy.tabs.studies}
            </button>
          </div>
        )}

        {isOnline && health !== null && !health.providers.gemini && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[var(--siloe-ink)]">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {health.relay === 'unconfigured'
                  ? lang === 'pt'
                    ? 'Relais do Assistente (VITE_AI_RELAY_URL) ainda não configurado para GitHub Pages. A Bíblia, a Concordância e os Estudos continuam 100% funcionais.'
                    : 'Relais de l’Assistant (VITE_AI_RELAY_URL) non configuré pour GitHub Pages. La Bible, la Concordance et vos Études restent 100 % utilisables.'
                  : lang === 'pt'
                  ? 'Gemini está indisponível neste servidor ou relay. A Bíblia, a Concordância e os seus Estudos continuam 100% utilizáveis.'
                  : 'Gemini est indisponible sur ce serveur ou relais. La Bible, la Concordance et vos Études restent pleinement utilisables.'}
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenStudiesTab}
              className="min-h-[36px] px-3 py-1 rounded-xl bg-[var(--siloe-bg-solid)] border border-[var(--siloe-border)] font-semibold whitespace-nowrap shrink-0"
            >
              {copy.tabs.studies}
            </button>
          </div>
        )}
      </div>

      {/* Conversation Feed */}
      <div className="space-y-3">
        {messages.length === 0 && (
          <div className="liquid-surface rounded-3xl p-6 text-center space-y-3">
            <Sparkles className="w-6 h-6 text-[var(--siloe-accent)] mx-auto" />
            <p className="text-sm text-[var(--siloe-ink-muted)] max-w-lg mx-auto">
              {lang === 'pt'
                ? 'Faça uma pergunta sobre o texto bíblico, o contexto histórico do século I ou peça um mapa esquemático de locais bíblicos.'
                : 'Posez une question sur un passage, le contexte historique du Ier siècle, les sources antiques ou demandez une carte de lieux bibliques.'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                lang === 'pt'
                  ? 'Qual é o contexto da vinha em João 15.1-8?'
                  : 'Quel est le contexte historique et agricole de la vigne en Jean 15.1-8 ?',
                lang === 'pt'
                  ? 'Onde ficava o tanque de Siloé em Jerusalém?'
                  : 'Où se situait le réservoir de Siloé à Jérusalem et quel est son état archéologique ?',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setPrompt(suggestion)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs text-[var(--siloe-ink)] hover:bg-[var(--siloe-accent)]/10 text-left"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-2xl rounded-2xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] px-4 py-3 text-sm space-y-1">
                  {msg.passageRef && (
                    <div className="text-[11px] opacity-80 font-semibold">
                      {msg.passageRef} · {msg.translationTitle}
                    </div>
                  )}
                  <p>{msg.prompt}</p>
                </div>
              </div>
            );
          }

          if (msg.error) {
            return (
              <div
                key={msg.id}
                className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 flex items-start gap-2.5 text-xs text-[var(--siloe-ink)]"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">{msg.error}</p>
                  <p className="text-[var(--siloe-ink-muted)]">
                    {lang === 'pt'
                      ? 'Os seus estudos salvos continuam acessíveis na aba Estudos.'
                      : 'Vos études et carnets enregistrés restent pleinement accessibles dans l’onglet Études.'}
                  </p>
                </div>
              </div>
            );
          }

          const r = msg.reply;
          if (!r) return null;

          return (
            <div key={msg.id} className="liquid-surface rounded-3xl p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--siloe-border)]">
                <div className="text-xs font-semibold text-[var(--siloe-ink-muted)]">
                  Siloé · {(msg.provider || 'gemini').toUpperCase()}
                  {msg.passageRef ? ` · ${msg.passageRef}` : ''}
                </div>
                <button
                  type="button"
                  onClick={() => openAddToStudyModal(msg)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-xs font-semibold flex items-center gap-1.5"
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                  <span>{copy.assistant.addToStudy}</span>
                </button>
              </div>

              {/* Direct Answer */}
              <div className="space-y-2.5 text-sm sm:text-[15px] leading-relaxed text-[var(--siloe-ink)]">
                {r.directAnswer
                  .split(/\n\n+/)
                  .filter(Boolean)
                  .map((para, idx) => (
                    <p key={idx}>{para}</p>
                  ))}
              </div>

              {/* Biblical Quotes */}
              {r.biblicalQuotes && r.biblicalQuotes.length > 0 && (
                <div className="space-y-2">
                  {r.biblicalQuotes.map((q, i) => (
                    <blockquote
                      key={i}
                      className="rounded-2xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] p-3.5 font-serif-bible text-sm space-y-1"
                    >
                      <div className="font-sans text-xs font-semibold text-[var(--siloe-accent)]">
                        {q.ref} {msg.translationTitle ? `(${msg.translationTitle})` : ''}
                      </div>
                      <p className="italic">« {q.text} »</p>
                      {q.note && <p className="font-sans text-xs text-[var(--siloe-ink-muted)]">{q.note}</p>}
                    </blockquote>
                  ))}
                </div>
              )}

              {/* Interpretations */}
              {r.interpretations && r.interpretations.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-[var(--siloe-ink-muted)]">
                    {copy.assistant.interpretationsTitle}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {r.interpretations.map((interp, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] p-3 space-y-1"
                      >
                        <div className="text-xs font-bold text-[var(--siloe-ink)]">{interp.label}</div>
                        <p className="text-xs text-[var(--siloe-ink)] leading-relaxed">{interp.summary}</p>
                        {interp.traditions && (
                          <div className="text-[11px] text-[var(--siloe-ink-muted)]">{interp.traditions}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Map of Biblical Places */}
              {r.biblicalPlaces && r.biblicalPlaces.length > 0 && (
                <BiblicalMapCard places={r.biblicalPlaces} caption={r.visualCaption} lang={lang} />
              )}

              {/* Documented Archive Notice */}
              {r.documentedArchiveNote && (
                <div className="rounded-2xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] p-3.5 space-y-1">
                  <div className="text-xs font-semibold text-[var(--siloe-accent)] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{copy.assistant.formatPhoto}</span>
                  </div>
                  <p className="text-xs text-[var(--siloe-ink)] leading-relaxed">{r.documentedArchiveNote}</p>
                </div>
              )}

              {/* Generated Reconstruction */}
              {r.reconstructionSpec && (
                <ReconstructionCard
                  spec={r.reconstructionSpec}
                  caption={r.visualCaption}
                  lang={lang}
                />
              )}

              {/* Historical Sources */}
              {r.historicalSources && r.historicalSources.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[var(--siloe-border)]">
                  <h3 className="text-xs font-semibold text-[var(--siloe-ink-muted)]">
                    {copy.assistant.sourcesTitle}
                  </h3>
                  <ul className="space-y-1.5 text-xs">
                    {r.historicalSources.map((src, idx) => (
                      <li key={idx} className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <span className="font-semibold text-[var(--siloe-ink)]">{src.author}</span>
                          {' — '}
                          <span className="italic">{src.title}</span>
                          {src.period ? ` (${src.period})` : ''}
                          {src.detail ? ` : ${src.detail}` : ''}
                        </div>
                        {isSafeHttpUrl(src.url) && (
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[var(--siloe-accent)] font-semibold hover:underline"
                          >
                            <span>{lang === 'pt' ? 'Consultar' : 'Consulter'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Prompt Composer */}
      <form onSubmit={handleSubmit} className="liquid-glass rounded-2xl p-3 flex items-end gap-2">
        <textarea
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={copy.assistant.placeholder}
          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-sm text-[var(--siloe-ink)] resize-none focus:outline-2 focus:outline-[var(--siloe-accent)]"
        />
        <button
          type="submit"
          disabled={
            !prompt.trim() ||
            loading ||
            !isOnline ||
            (health !== null && !health.providers[provider])
          }
          className="min-h-[46px] px-4 py-2 rounded-xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-xs font-semibold flex items-center gap-1.5 shrink-0 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          <span>{loading ? '…' : copy.assistant.askButton}</span>
        </button>
      </form>

      {/* Add to My Study Selective Picker Modal */}
      <LiquidModal
        isOpen={Boolean(exportMsg)}
        onClose={() => setExportMsg(null)}
        title={copy.assistant.addToStudy}
        closeLabel={copy.common.close}
        footer={
          <button
            type="button"
            disabled={!targetStudyId}
            onClick={handleConfirmAddToStudy}
            className="w-full min-h-[44px] rounded-xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-sm font-semibold disabled:opacity-50"
          >
            {copy.assistant.addToStudy}
          </button>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--siloe-ink-muted)] mb-1">
              {lang === 'pt' ? 'Estudo de destino' : 'Étude de destination'}
            </label>
            <select
              value={targetStudyId}
              onChange={(e) => setTargetStudyId(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-sm text-[var(--siloe-ink)]"
            >
              {studies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--siloe-ink-muted)]">
                {lang === 'pt' ? 'Parágrafos a inserir' : 'Paragraphes à insérer'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedParagraphIdxs(paragraphsOfExport.map((_, i) => i))}
                className="text-xs font-semibold text-[var(--siloe-accent)]"
              >
                {lang === 'pt' ? 'Selecionar resposta inteira' : 'Tout sélectionner'}
              </button>
            </div>
            {paragraphsOfExport.map((para, idx) => {
              const checked = selectedParagraphIdxs.includes(idx);
              return (
                <label
                  key={idx}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedParagraphIdxs((prev) =>
                        checked ? prev.filter((i) => i !== idx) : [...prev, idx]
                      )
                    }
                    className="mt-0.5"
                  />
                  <span className="line-clamp-3 text-[var(--siloe-ink)]">{para}</span>
                </label>
              );
            })}
          </div>

          <label className="flex items-center gap-2 text-xs text-[var(--siloe-ink)]">
            <input
              type="checkbox"
              checked={includeQuotesAndSources}
              onChange={(e) => setIncludeQuotesAndSources(e.target.checked)}
            />
            <span>
              {lang === 'pt'
                ? 'Incluir citações bíblicas, fontes históricas e créditos da edição'
                : 'Inclure les citations bibliques, sources historiques et crédits de l’édition'}
            </span>
          </label>

          {exportMsg?.reply?.biblicalPlaces && exportMsg.reply.biblicalPlaces.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-[var(--siloe-ink)]">
              <input
                type="checkbox"
                checked={includeMap}
                onChange={(e) => setIncludeMap(e.target.checked)}
              />
              <span>{lang === 'pt' ? 'Anexar mapa de locais bíblicos' : 'Joindre la carte des lieux bibliques'}</span>
            </label>
          )}

          {exportMsg?.reply?.reconstructionSpec && (
            <label className="flex items-center gap-2 text-xs text-[var(--siloe-ink)]">
              <input
                type="checkbox"
                checked={includeReconstruction}
                onChange={(e) => setIncludeReconstruction(e.target.checked)}
              />
              <span>
                {lang === 'pt'
                  ? 'Anexar ilustração de reconstituição gerada'
                  : 'Joindre l’illustration identifiée comme reconstitution générée'}
              </span>
            </label>
          )}
        </div>
      </LiquidModal>
    </div>
  );
};
