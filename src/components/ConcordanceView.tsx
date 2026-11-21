import React, { useEffect, useState } from 'react';
import { BookOpen, Download, FilePlus2, Search } from 'lucide-react';
import { BIBLE_BOOKS, getBookName } from '../data/booksMetadata';
import { tCopy } from '../data/i18n';
import { runConcordanceSearch } from '../services/bibleEngine';
import type {
  BibleEditionMeta,
  BibleLocation,
  ConcordanceMode,
  ConcordanceResult,
  TestamentFilter,
  UILanguage,
} from '../types/siloe';

interface ConcordanceViewProps {
  lang: UILanguage;
  catalog: BibleEditionMeta[];
  downloadedIds: string[];
  initialQuery: string;
  initialEditionId: string;
  onDownloadEdition: (meta: BibleEditionMeta) => void;
  onOpenChapter: (editionId: string, loc: BibleLocation) => void;
  onInsertResultToStudy: (ref: string, text: string, edition: BibleEditionMeta, loc: BibleLocation) => void;
}

function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function highlightMatchText(text: string, tokens: string[], mode: ConcordanceMode): React.ReactNode {
  if (!tokens.length) return text;
  const normalizedTokens = tokens.map((t) => stripAccents(t.toLowerCase()));
  const parts = text.split(/([\p{L}\p{N}'’-]+)/gu);

  if (mode === 'exact_phrase') {
    const phrase = normalizedTokens[0];
    const normFull = stripAccents(text.toLowerCase());
    const idx = normFull.indexOf(phrase);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="rounded px-0.5 bg-amber-300/65 dark:bg-amber-400/35 text-inherit font-semibold">
          {text.slice(idx, idx + phrase.length)}
        </mark>
        {text.slice(idx + phrase.length)}
      </>
    );
  }

  return parts.map((part, i) => {
    const norm = stripAccents(part.toLowerCase());
    if (normalizedTokens.includes(norm)) {
      return (
        <mark key={i} className="rounded px-0.5 bg-amber-300/65 dark:bg-amber-400/35 text-inherit font-semibold">
          {part}
        </mark>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export const ConcordanceView: React.FC<ConcordanceViewProps> = ({
  lang,
  catalog,
  downloadedIds,
  initialQuery,
  initialEditionId,
  onDownloadEdition,
  onOpenChapter,
  onInsertResultToStudy,
}) => {
  const copy = tCopy(lang);
  const [editionId, setEditionId] = useState(initialEditionId);
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<ConcordanceMode>('whole_word');
  const [testament, setTestament] = useState<TestamentFilter>('all');
  const [bookId, setBookId] = useState<number | 'all'>('all');
  const [result, setResult] = useState<ConcordanceResult | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    if (initialEditionId) {
      setEditionId(initialEditionId);
    }
  }, [initialEditionId]);

  const activeMeta = catalog.find((e) => e.id === editionId) ?? catalog[0];
  const isDownloaded = downloadedIds.includes(editionId);

  const executeSearch = async () => {
    if (!query.trim() || !isDownloaded) return;
    setSearching(true);
    try {
      const res = await runConcordanceSearch({
        editionId,
        query,
        mode,
        testament,
        bookId,
      });
      setResult(res);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (query.trim() && isDownloaded) {
      const id = window.setTimeout(() => {
        void executeSearch();
      }, 220);
      return () => window.clearTimeout(id);
    }
  }, [query, mode, testament, bookId, editionId, isDownloaded]);

  const searchableEditions = catalog.filter((e) => e.rights.verified && e.rights.concordance);

  return (
    <div className="space-y-4 pb-28">
      <div className="liquid-glass rounded-3xl p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-serif-bible text-xl sm:text-2xl font-bold text-[var(--siloe-ink)]">
              {copy.concordance.title}
            </h1>
            <p className="text-xs text-[var(--siloe-ink-muted)]">{copy.concordance.subtitle}</p>
          </div>

          <select
            aria-label={copy.bible.primaryEdition}
            value={editionId}
            onChange={(e) => setEditionId(e.target.value)}
            className="min-h-[44px] px-3 py-1.5 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs font-semibold text-[var(--siloe-ink)]"
          >
            {searchableEditions.map((ed) => (
              <option key={ed.id} value={ed.id}>
                {ed.shortTitle} ({ed.language.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void executeSearch();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-[var(--siloe-ink-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={copy.concordance.queryPlaceholder}
              className="w-full min-h-[46px] pl-9 pr-3 py-2 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-sm text-[var(--siloe-ink)] focus:outline-2 focus:outline-[var(--siloe-accent)]"
            />
          </div>
          <button
            type="submit"
            disabled={!isDownloaded || searching}
            className="min-h-[46px] px-4 py-2 rounded-xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-xs font-semibold whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            {copy.common.search}
          </button>
        </form>

        {/* Mode & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/10">
            {(
              [
                ['whole_word', copy.concordance.modeWholeWord],
                ['exact_phrase', copy.concordance.modeExactPhrase],
                ['multi_forms', copy.concordance.modeMultiForms],
              ] as const
            ).map(([mId, label]) => (
              <button
                key={mId}
                type="button"
                onClick={() => setMode(mId)}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  mode === mId
                    ? 'bg-[var(--siloe-bg-solid)] text-[var(--siloe-ink)] shadow-sm'
                    : 'text-[var(--siloe-ink-muted)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={copy.concordance.filterScope}
              value={testament}
              onChange={(e) => {
                setTestament(e.target.value as TestamentFilter);
                setBookId('all');
              }}
              className="min-h-[40px] px-2.5 py-1 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs font-medium text-[var(--siloe-ink)]"
            >
              <option value="all">{copy.common.all}</option>
              <option value="OT">{copy.common.ot}</option>
              <option value="NT">{copy.common.nt}</option>
            </select>

            <select
              aria-label={copy.common.book}
              value={bookId}
              onChange={(e) =>
                setBookId(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="min-h-[40px] px-2.5 py-1 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs font-medium text-[var(--siloe-ink)] max-w-[180px]"
            >
              <option value="all">{copy.studies.filterBook}</option>
              {BIBLE_BOOKS.filter((b) => testament === 'all' || b.testament === testament).map((b) => (
                <option key={b.id} value={b.id}>
                  {lang === 'pt' ? b.namePt : b.nameFr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {mode === 'multi_forms' && (
          <p className="text-[11px] text-[var(--siloe-ink-muted)]">{copy.concordance.multiHint}</p>
        )}
      </div>

      {!isDownloaded && (
        <div className="liquid-surface rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--siloe-ink)]">{copy.concordance.editionRequired}</p>
          <button
            type="button"
            onClick={() => onDownloadEdition(activeMeta)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-xs font-semibold flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>{copy.bible.downloadNow}</span>
          </button>
        </div>
      )}

      {/* Results Summary & List */}
      {isDownloaded && result && query.trim() && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[var(--siloe-ink-muted)]">
            <div className="font-medium text-[var(--siloe-ink)]">
              <span className="font-mono-num font-bold">{result.totalOccurrences}</span>{' '}
              {copy.concordance.occurrences}
              {' · '}
              <span className="font-mono-num font-bold">{result.totalVerses}</span>{' '}
              {copy.concordance.verses}
            </div>
            <div className="font-mono-num">{result.durationMs} ms · {activeMeta.shortTitle}</div>
          </div>

          {result.matches.length === 0 ? (
            <div className="liquid-surface rounded-2xl p-6 text-center text-sm text-[var(--siloe-ink-muted)]">
              {copy.concordance.noResults}
            </div>
          ) : (
            <div className="space-y-2.5">
              {result.matches.map((m) => {
                const refLabel = `${getBookName(m.bookId, lang)} ${m.chapter}.${m.verse}`;
                const loc: BibleLocation = {
                  bookId: m.bookId,
                  chapter: m.chapter,
                  verseStart: m.verse,
                  verseEnd: m.verse,
                };
                return (
                  <div
                    key={`${m.bookId}-${m.chapter}-${m.verse}`}
                    className="liquid-surface rounded-2xl p-4 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-[var(--siloe-accent)]">
                        {refLabel} · {activeMeta.shortTitle}
                      </div>
                      <div className="text-[11px] font-mono-num text-[var(--siloe-ink-muted)]">
                        {m.occurrencesInVerse} {copy.concordance.occurrences}
                      </div>
                    </div>

                    <p className="font-serif-bible text-base leading-relaxed text-[var(--siloe-ink)]">
                      {highlightMatchText(m.text, m.matchedTokens, mode)}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenChapter(editionId, loc)}
                        className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs font-semibold text-[var(--siloe-ink)] flex items-center gap-1.5 hover:bg-[var(--siloe-accent)]/10"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{copy.concordance.openChapter}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onInsertResultToStudy(refLabel, m.text, activeMeta, loc)}
                        className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-xs font-semibold flex items-center gap-1.5 hover:opacity-95"
                      >
                        <FilePlus2 className="w-3.5 h-3.5" />
                        <span>{copy.concordance.insertResult}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isDownloaded && !query.trim() && (
        <div className="liquid-surface rounded-2xl p-6 text-center text-sm text-[var(--siloe-ink-muted)]">
          {copy.concordance.emptyPrompt}
        </div>
      )}
    </div>
  );
};
