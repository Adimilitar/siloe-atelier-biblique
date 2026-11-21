import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Bookmark,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  FilePlus2,
  Highlighter,
  MessageSquareText,
  Search,
  Sparkles,
} from 'lucide-react';
import { BIBLE_BOOKS, getBookMeta, getBookName } from '../data/booksMetadata';
import { tCopy } from '../data/i18n';
import { formatReferenceLabel, getChapterVerses, parseBibleReference } from '../services/bibleEngine';
import { alignChapterVerses } from '../services/versification';
import type {
  BibleEditionMeta,
  BibleLocation,
  BookmarkItem,
  HighlightColor,
  HighlightItem,
  NormalizedBible,
  UILanguage,
} from '../types/siloe';
import { LiquidModal } from './LiquidModal';

interface BibleReaderViewProps {
  lang: UILanguage;
  fontSize: number;
  catalog: BibleEditionMeta[];
  downloadedIds: string[];
  loadedBibles: Record<string, NormalizedBible>;
  downloadingIds: Record<string, number>;
  primaryEditionId: string;
  compareEditionId: string;
  compareEnabled: boolean;
  location: BibleLocation;
  bookmarks: BookmarkItem[];
  highlights: HighlightItem[];
  onChangeLocation: (loc: BibleLocation) => void;
  onChangePrimaryEdition: (id: string) => void;
  onChangeCompareEdition: (id: string) => void;
  onToggleCompare: () => void;
  onDownloadEdition: (meta: BibleEditionMeta) => void;
  onToggleBookmark: (editionId: string, bookId: number, chapter: number, verse: number) => void;
  onSetHighlight: (editionId: string, bookId: number, chapter: number, verse: number, color: HighlightColor | null) => void;
  onSearchWordConcordance: (word: string, editionId: string) => void;
  onAskAssistantPassage: (ref: string, text: string, edition: BibleEditionMeta) => void;
  onInsertPassageToStudy: (ref: string, text: string, edition: BibleEditionMeta, loc: BibleLocation) => void;
}

const HIGHLIGHT_STYLES: Record<HighlightColor, string> = {
  gold: 'bg-amber-200/55 dark:bg-amber-400/20',
  ink: 'bg-sky-200/55 dark:bg-sky-400/20',
  sage: 'bg-emerald-200/55 dark:bg-emerald-400/20',
  rose: 'bg-rose-200/55 dark:bg-rose-400/20',
};

export const BibleReaderView: React.FC<BibleReaderViewProps> = ({
  lang,
  fontSize,
  catalog,
  downloadedIds,
  loadedBibles,
  downloadingIds,
  primaryEditionId,
  compareEditionId,
  compareEnabled,
  location,
  bookmarks,
  highlights,
  onChangeLocation,
  onChangePrimaryEdition,
  onChangeCompareEdition,
  onToggleCompare,
  onDownloadEdition,
  onToggleBookmark,
  onSetHighlight,
  onSearchWordConcordance,
  onAskAssistantPassage,
  onInsertPassageToStudy,
}) => {
  const copy = tCopy(lang);
  const [refInput, setRefInput] = useState('');
  const [refError, setRefError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerBookId, setPickerBookId] = useState(location.bookId);
  const [pickerTestament, setPickerTestament] = useState<'all' | 'OT' | 'NT'>('all');
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(location.verseStart ?? null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  const primaryMeta = catalog.find((e) => e.id === primaryEditionId) ?? catalog[0];
  const secondaryMeta = catalog.find((e) => e.id === compareEditionId) ?? catalog[1];
  const primaryBible = loadedBibles[primaryEditionId];
  const secondaryBible = loadedBibles[compareEditionId];

  const bookMeta = getBookMeta(location.bookId);
  const primaryVerses = useMemo(
    () => getChapterVerses(primaryBible, location.bookId, location.chapter),
    [primaryBible, location.bookId, location.chapter]
  );
  const secondaryVerses = useMemo(
    () => getChapterVerses(secondaryBible, location.bookId, location.chapter),
    [secondaryBible, location.bookId, location.chapter]
  );

  const alignment = useMemo(
    () =>
      compareEnabled
        ? alignChapterVerses(
            location.bookId,
            location.chapter,
            primaryVerses,
            secondaryVerses,
            primaryMeta,
            secondaryMeta
          )
        : null,
    [compareEnabled, location.bookId, location.chapter, primaryVerses, secondaryVerses, primaryMeta, secondaryMeta]
  );

  const handleRefSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseBibleReference(refInput);
    if (!parsed) {
      setRefError(lang === 'pt' ? 'Referência não reconhecida.' : 'Référence non reconnue.');
      return;
    }
    setRefError('');
    setSelectedVerse(parsed.verseStart ?? null);
    onChangeLocation(parsed);
  };

  const stepChapter = (delta: number) => {
    let bId = location.bookId;
    let ch = location.chapter + delta;
    if (ch < 1) {
      bId = bId > 1 ? bId - 1 : 66;
      ch = getBookMeta(bId).chapters;
    } else if (ch > bookMeta.chapters) {
      bId = bId < 66 ? bId + 1 : 1;
      ch = 1;
    }
    setSelectedVerse(null);
    setSelectedWord(null);
    onChangeLocation({ bookId: bId, chapter: ch });
  };

  const getBookmark = (v: number) =>
    bookmarks.find(
      (b) => b.bookId === location.bookId && b.chapter === location.chapter && b.verse === v
    );

  const getHighlight = (v: number) =>
    highlights.find(
      (h) => h.bookId === location.bookId && h.chapter === location.chapter && h.verse === v
    );

  const isVerseHighlightedRange = (v: number) => {
    if (!location.verseStart) return false;
    const end = location.verseEnd ?? location.verseStart;
    return v >= location.verseStart && v <= end;
  };

  const activeVerseObj =
    selectedVerse !== null ? primaryVerses.find((x) => x.v === selectedVerse) ?? null : null;

  const activePassageSelection = useMemo(() => {
    if (location.verseStart && location.verseEnd && location.verseEnd > location.verseStart) {
      const slice = primaryVerses.filter(
        (v) => v.v >= location.verseStart! && v.v <= location.verseEnd!
      );
      return {
        loc: location,
        ref: formatReferenceLabel(location, lang),
        text: slice.map((v) => `${v.v}. ${v.t}`).join(' '),
      };
    }
    if (activeVerseObj) {
      const singleLoc: BibleLocation = {
        bookId: location.bookId,
        chapter: location.chapter,
        verseStart: activeVerseObj.v,
        verseEnd: activeVerseObj.v,
      };
      return {
        loc: singleLoc,
        ref: formatReferenceLabel(singleLoc, lang),
        text: activeVerseObj.t,
      };
    }
    return null;
  }, [location, primaryVerses, activeVerseObj, lang]);

  const renderClickableWords = (text: string, verseNum: number) => {
    const tokens = text.split(/(\s+)/);
    return tokens.map((tok, i) => {
      const clean = tok.replace(/[^\p{L}\p{N}'’-]/gu, '');
      if (!clean || clean.length < 2) {
        return <React.Fragment key={i}>{tok}</React.Fragment>;
      }
      return (
        <span
          key={i}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedVerse(verseNum);
            setSelectedWord(clean);
          }}
          className="cursor-pointer rounded hover:bg-[var(--siloe-accent)]/12 transition-colors"
        >
          {tok}
        </span>
      );
    });
  };

  const selectableEditions = catalog.filter((e) => e.rights.verified && e.rights.offlineRead);

  return (
    <div className="space-y-4 pb-28">
      {/* Always-accessible Sticky Liquid Glass Reader Controls */}
      <div className="sticky top-2 z-20 liquid-glass rounded-2xl p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Book & Chapter Selector */}
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => stepChapter(-1)}
              aria-label={copy.common.prevChapter}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)]/80 text-[var(--siloe-ink)] hover:bg-[var(--siloe-accent)]/10 active:scale-[0.97] transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setPickerBookId(location.bookId);
                setPickerOpen(true);
              }}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)]/90 text-[var(--siloe-ink)] font-semibold text-sm flex items-center gap-2 hover:bg-[var(--siloe-accent)]/10 transition max-w-[200px] sm:max-w-xs truncate"
            >
              <BookOpen className="w-4 h-4 text-[var(--siloe-accent)] shrink-0" />
              <span className="truncate">
                {getBookName(location.bookId, lang)} {location.chapter}
              </span>
            </button>

            <button
              type="button"
              onClick={() => stepChapter(1)}
              aria-label={copy.common.nextChapter}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)]/80 text-[var(--siloe-ink)] hover:bg-[var(--siloe-accent)]/10 active:scale-[0.97] transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Edition & Compare controls */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={copy.bible.primaryEdition}
              value={primaryEditionId}
              onChange={(e) => onChangePrimaryEdition(e.target.value)}
              className="min-h-[44px] px-3 py-1.5 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs font-semibold text-[var(--siloe-ink)]"
            >
              {selectableEditions.map((ed) => (
                <option key={ed.id} value={ed.id}>
                  {ed.shortTitle} ({ed.language.toUpperCase()})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onToggleCompare}
              className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
                compareEnabled
                  ? 'bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)]'
                  : 'border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-[var(--siloe-ink)] hover:bg-[var(--siloe-accent)]/10'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>{compareEnabled ? copy.bible.stopCompare : copy.bible.compare}</span>
            </button>

            {compareEnabled && (
              <select
                aria-label={copy.bible.secondaryEdition}
                value={compareEditionId}
                onChange={(e) => onChangeCompareEdition(e.target.value)}
                className="min-h-[44px] px-3 py-1.5 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs font-semibold text-[var(--siloe-ink)]"
              >
                {selectableEditions
                  .filter((ed) => ed.id !== primaryEditionId)
                  .map((ed) => (
                    <option key={ed.id} value={ed.id}>
                      {ed.shortTitle} ({ed.language.toUpperCase()})
                    </option>
                  ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => setBookmarksOpen(true)}
              aria-label={copy.bible.bookmarksTitle}
              className="min-h-[44px] min-w-[44px] px-2.5 flex items-center justify-center gap-1.5 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs font-medium text-[var(--siloe-ink)] hover:bg-[var(--siloe-accent)]/10 transition"
            >
              <Bookmark className="w-4 h-4" />
              <span className="font-mono-num hidden sm:inline">{bookmarks.length + highlights.length}</span>
            </button>
          </div>
        </div>

        {/* Reference search bar */}
        <form onSubmit={handleRefSubmit} className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-[var(--siloe-ink-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={refInput}
              onChange={(e) => {
                setRefInput(e.target.value);
                if (refError) setRefError('');
              }}
              placeholder={copy.bible.searchRefPlaceholder}
              className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)]/90 text-sm text-[var(--siloe-ink)] placeholder:text-[var(--siloe-ink-muted)] focus:outline-2 focus:outline-[var(--siloe-accent)]"
            />
          </div>
          <button
            type="submit"
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-xs font-semibold whitespace-nowrap shrink-0 hover:opacity-95 active:scale-[0.98] transition"
          >
            {copy.common.search}
          </button>
        </form>
        {refError && <p className="text-xs text-rose-600 dark:text-rose-400 px-1">{refError}</p>}
      </div>

      {/* Selected Verse / Range Action Bar */}
      {activePassageSelection && (
        <div className="liquid-glass rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs space-y-0.5 min-w-0">
            <div className="font-semibold text-[var(--siloe-ink)]">
              {activePassageSelection.ref} · {primaryMeta.shortTitle}
            </div>
            {selectedWord && (
              <div className="text-[var(--siloe-ink-muted)] truncate">
                {lang === 'pt' ? 'Palavra selecionada:' : 'Mot sélectionné :'} « {selectedWord} »
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {selectedWord && (
              <button
                type="button"
                onClick={() => onSearchWordConcordance(selectedWord, primaryEditionId)}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--siloe-bg-solid)] border border-[var(--siloe-border)] text-xs font-semibold text-[var(--siloe-ink)] flex items-center gap-1.5 hover:bg-[var(--siloe-accent)]/10"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{copy.bible.searchWord}</span>
              </button>
            )}

            {activeVerseObj && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    onToggleBookmark(primaryEditionId, location.bookId, location.chapter, activeVerseObj.v)
                  }
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl border border-[var(--siloe-border)] text-xs font-semibold flex items-center gap-1.5 ${
                    getBookmark(activeVerseObj.v)
                      ? 'bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)]'
                      : 'bg-[var(--siloe-bg-solid)] text-[var(--siloe-ink)]'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>{getBookmark(activeVerseObj.v) ? copy.bible.bookmarked : copy.bible.bookmark}</span>
                </button>

                <div className="flex items-center gap-1 px-1.5 py-1 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)]">
                  <Highlighter className="w-3.5 h-3.5 text-[var(--siloe-ink-muted)] mr-0.5" />
                  {(['gold', 'ink', 'sage', 'rose'] as HighlightColor[]).map((clr) => (
                    <button
                      key={clr}
                      type="button"
                      aria-label={`Highlight ${clr}`}
                      onClick={() =>
                        onSetHighlight(
                          primaryEditionId,
                          location.bookId,
                          location.chapter,
                          activeVerseObj.v,
                          getHighlight(activeVerseObj.v)?.color === clr ? null : clr
                        )
                      }
                      className={`w-6 h-6 rounded-full border border-black/15 ${
                        clr === 'gold'
                          ? 'bg-amber-300'
                          : clr === 'ink'
                          ? 'bg-sky-300'
                          : clr === 'sage'
                          ? 'bg-emerald-300'
                          : 'bg-rose-300'
                      } ${getHighlight(activeVerseObj.v)?.color === clr ? 'ring-2 ring-[var(--siloe-ink)]' : ''}`}
                    />
                  ))}
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() =>
                onInsertPassageToStudy(
                  activePassageSelection.ref,
                  activePassageSelection.text,
                  primaryMeta,
                  activePassageSelection.loc
                )
              }
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--siloe-bg-solid)] border border-[var(--siloe-border)] text-xs font-semibold text-[var(--siloe-ink)] flex items-center gap-1.5 hover:bg-[var(--siloe-accent)]/10"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>{copy.bible.insertInStudy}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onAskAssistantPassage(
                  activePassageSelection.ref,
                  activePassageSelection.text,
                  primaryMeta
                )
              }
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-xs font-semibold flex items-center gap-1.5 hover:opacity-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{copy.bible.askAssistant}</span>
            </button>
          </div>
        </div>
      )}

      {/* Download Prompt if Primary or Secondary Edition Missing Offline */}
      {(!downloadedIds.includes(primaryEditionId) ||
        (compareEnabled && !downloadedIds.includes(compareEditionId))) && (
        <div className="liquid-surface rounded-2xl p-5 space-y-3">
          {[primaryMeta, compareEnabled ? secondaryMeta : null]
            .filter((m): m is BibleEditionMeta => Boolean(m) && !downloadedIds.includes(m!.id))
            .map((ed) => {
              const pct = downloadingIds[ed.id];
              return (
                <div key={ed.id} className="space-y-2 border-b last:border-none border-[var(--siloe-border)] pb-3 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-serif-bible font-semibold text-[var(--siloe-ink)]">
                        {ed.title} ({ed.year})
                      </h3>
                      <p className="text-xs text-[var(--siloe-ink-muted)]">
                        {pct !== undefined
                          ? lang === 'pt'
                            ? `Preparação para leitura offline… ${pct}%`
                            : `Préparation pour la lecture hors ligne… ${pct}%`
                          : `${ed.license} · ${ed.estimatedSizeMb} Mo`}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={pct !== undefined}
                      onClick={() => onDownloadEdition(ed)}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-xs font-semibold flex items-center gap-2 disabled:opacity-60"
                    >
                      <Download className="w-4 h-4" />
                      <span>
                        {pct !== undefined ? `${pct}%` : copy.bible.downloadNow}
                      </span>
                    </button>
                  </div>
                  <p className="text-xs text-[var(--siloe-ink-muted)]">{ed.credits}</p>
                </div>
              );
            })}
        </div>
      )}

      {/* Versification Discrepancy Notice in Compare Mode */}
      {compareEnabled && alignment?.hasDifference && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex items-start gap-2.5 text-xs text-[var(--siloe-ink)]">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">{copy.bible.versificationNotice}</p>
            <p className="text-[var(--siloe-ink-muted)]">
              {lang === 'pt' ? alignment.summaryNotePt : alignment.summaryNoteFr}
            </p>
          </div>
        </div>
      )}

      {/* Reading Canvas */}
      {downloadedIds.includes(primaryEditionId) && (
        <article className="liquid-surface rounded-3xl p-5 sm:p-8 space-y-5">
          <header className="flex flex-wrap items-baseline justify-between gap-2 pb-4 border-b border-[var(--siloe-border)]">
            <div>
              <h1 className="font-serif-bible text-2xl sm:text-3xl font-bold text-[var(--siloe-ink)]">
                {getBookName(location.bookId, lang)} {location.chapter}
              </h1>
              <p className="text-xs text-[var(--siloe-ink-muted)] mt-1">
                {primaryMeta.title} · {primaryMeta.year}
                {compareEnabled && `  ⇄  ${secondaryMeta.title}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onAskAssistantPassage(
                  `${getBookName(location.bookId, lang)} ${location.chapter}`,
                  primaryVerses
                    .slice(0, 12)
                    .map((v) => `${v.v}. ${v.t}`)
                    .join(' '),
                  primaryMeta
                )
              }
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[var(--siloe-border)] text-xs font-medium text-[var(--siloe-ink)] hover:bg-[var(--siloe-accent)]/10 flex items-center gap-1.5"
            >
              <MessageSquareText className="w-3.5 h-3.5" />
              <span>{lang === 'pt' ? 'Estudar este capítulo' : 'Questionner sur ce chapitre'}</span>
            </button>
          </header>

          {/* Single Edition Reader */}
          {!compareEnabled && (
            <div className="font-serif-bible space-y-2.5 max-w-[70ch]" style={{ fontSize: `${fontSize}px`, lineHeight: 1.72 }}>
              {primaryVerses.map((verse) => {
                const hl = getHighlight(verse.v);
                const bm = getBookmark(verse.v);
                const isRange = isVerseHighlightedRange(verse.v);
                const isSelected = selectedVerse === verse.v;
                return (
                  <p
                    key={verse.v}
                    onClick={() => {
                      setSelectedVerse(verse.v);
                      setSelectedWord(null);
                    }}
                    className={`rounded-xl px-2.5 py-1.5 transition-colors cursor-pointer ${
                      hl ? HIGHLIGHT_STYLES[hl.color] : ''
                    } ${
                      isSelected || isRange
                        ? 'ring-1 ring-[var(--siloe-accent)]/50 bg-[var(--siloe-accent)]/5'
                        : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="font-mono-num text-[0.72em] font-semibold text-[var(--siloe-accent)] mr-2 select-none align-super">
                      {verse.v}
                      {bm && <Bookmark className="inline w-3 h-3 ml-0.5 fill-current" />}
                    </span>
                    <span>{renderClickableWords(verse.t, verse.v)}</span>
                  </p>
                );
              })}
            </div>
          )}

          {/* Compare Mode: Stacked on mobile (< lg), Synchronized columns on lg+ */}
          {compareEnabled && alignment && (
            <div className="space-y-3" style={{ fontSize: `${fontSize}px`, lineHeight: 1.68 }}>
              <div className="hidden lg:grid lg:grid-cols-2 gap-6 pb-2 border-b border-[var(--siloe-border)] text-xs font-semibold text-[var(--siloe-ink-muted)]">
                <div>{primaryMeta.title}</div>
                <div>{secondaryMeta.title}</div>
              </div>
              {alignment.rows.map((row) => {
                const vNum = row.primaryVerse?.v ?? row.secondaryVerse?.v ?? 0;
                const isRange = vNum > 0 && isVerseHighlightedRange(vNum);
                const isUncertain = row.alignmentStatus === 'uncertain' || row.alignmentStatus === 'shifted';
                return (
                  <div
                    key={row.key}
                    onClick={() => {
                      if (row.primaryVerse) setSelectedVerse(row.primaryVerse.v);
                    }}
                    className={`rounded-2xl p-3 border transition-colors ${
                      isUncertain
                        ? 'border-amber-500/40 bg-amber-500/5'
                        : isRange
                        ? 'border-[var(--siloe-accent)]/40 bg-[var(--siloe-accent)]/5'
                        : 'border-[var(--siloe-border)]'
                    }`}
                  >
                    {isUncertain && (
                      <div className="text-[11px] font-medium text-amber-700 dark:text-amber-300 mb-1.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>
                          {row.alignmentStatus === 'shifted'
                            ? copy.bible.shiftedMatch
                            : copy.bible.uncertainMatch}
                          {row.note ? ` · ${row.note}` : ''}
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-6 font-serif-bible">
                      <div>
                        <span className="lg:hidden block font-sans text-[11px] font-semibold text-[var(--siloe-ink-muted)] mb-0.5">
                          {primaryMeta.shortTitle}
                        </span>
                        {row.primaryVerse ? (
                          <p>
                            <span className="font-mono-num text-[0.75em] font-semibold text-[var(--siloe-accent)] mr-2">
                              {row.primaryVerse.v}
                            </span>
                            {renderClickableWords(row.primaryVerse.t, row.primaryVerse.v)}
                          </p>
                        ) : (
                          <p className="text-xs italic text-[var(--siloe-ink-muted)]">—</p>
                        )}
                      </div>
                      <div className="pt-2 lg:pt-0 border-t lg:border-t-0 lg:border-l border-[var(--siloe-border)] lg:pl-6">
                        <span className="lg:hidden block font-sans text-[11px] font-semibold text-[var(--siloe-ink-muted)] mb-0.5">
                          {secondaryMeta.shortTitle}
                        </span>
                        {row.secondaryVerse ? (
                          <p>
                            <span className="font-mono-num text-[0.75em] font-semibold text-[var(--siloe-accent)] mr-2">
                              {row.secondaryVerse.v}
                            </span>
                            {row.secondaryVerse.t}
                          </p>
                        ) : (
                          <p className="text-xs italic text-[var(--siloe-ink-muted)]">—</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Edition Attribution & Rights Footer */}
          <footer className="pt-4 border-t border-[var(--siloe-border)] text-xs text-[var(--siloe-ink-muted)] space-y-1">
            <p>{primaryMeta.credits}</p>
            <p>
              {primaryMeta.license} · {primaryMeta.sourceName}
            </p>
          </footer>
        </article>
      )}

      {/* Book & Chapter Picker Modal */}
      <LiquidModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={lang === 'pt' ? 'Selecionar livro e capítulo' : 'Choisir un livre et un chapitre'}
        closeLabel={copy.common.close}
        maxWidthClass="max-w-3xl"
      >
        <div className="flex items-center gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/10 w-fit">
          {(['all', 'OT', 'NT'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setPickerTestament(t)}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                pickerTestament === t
                  ? 'bg-[var(--siloe-bg-solid)] text-[var(--siloe-ink)] shadow-sm'
                  : 'text-[var(--siloe-ink-muted)]'
              }`}
            >
              {t === 'all' ? copy.common.all : t === 'OT' ? copy.common.ot : copy.common.nt}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1 max-h-72 overflow-y-auto scroll-contain pr-1">
            {BIBLE_BOOKS.filter((b) => pickerTestament === 'all' || b.testament === pickerTestament).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setPickerBookId(b.id)}
                className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-left text-sm font-medium flex items-center justify-between transition ${
                  pickerBookId === b.id
                    ? 'bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)]'
                    : 'hover:bg-black/5 dark:hover:bg-white/10 text-[var(--siloe-ink)]'
                }`}
              >
                <span>{lang === 'pt' ? b.namePt : b.nameFr}</span>
                <span className="font-mono-num text-xs opacity-75">{b.chapters}</span>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[var(--siloe-ink-muted)]">
              {getBookName(pickerBookId, lang)} · {copy.common.chapter}
            </h3>
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
              {Array.from({ length: getBookMeta(pickerBookId).chapters }, (_, i) => i + 1).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => {
                    onChangeLocation({ bookId: pickerBookId, chapter: ch });
                    setSelectedVerse(null);
                    setPickerOpen(false);
                  }}
                  className={`min-h-[44px] rounded-xl font-mono-num text-sm font-semibold border transition ${
                    location.bookId === pickerBookId && location.chapter === ch
                      ? 'bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] border-transparent'
                      : 'border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-[var(--siloe-ink)] hover:bg-[var(--siloe-accent)]/10'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        </div>
      </LiquidModal>

      {/* Bookmarks & Highlights Modal */}
      <LiquidModal
        isOpen={bookmarksOpen}
        onClose={() => setBookmarksOpen(false)}
        title={copy.bible.bookmarksTitle}
        closeLabel={copy.common.close}
      >
        {bookmarks.length === 0 && highlights.length === 0 ? (
          <p className="text-sm text-[var(--siloe-ink-muted)] py-6 text-center">{copy.bible.noBookmarks}</p>
        ) : (
          <div className="space-y-3">
            {bookmarks.map((bm) => (
              <div
                key={bm.id}
                className="flex items-center justify-between gap-2 p-3 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)]"
              >
                <button
                  type="button"
                  onClick={() => {
                    onChangeLocation({
                      bookId: bm.bookId,
                      chapter: bm.chapter,
                      verseStart: bm.verse,
                      verseEnd: bm.verse,
                    });
                    setSelectedVerse(bm.verse);
                    setBookmarksOpen(false);
                  }}
                  className="text-left flex-1 min-w-0"
                >
                  <div className="text-sm font-semibold text-[var(--siloe-ink)]">
                    {getBookName(bm.bookId, lang)} {bm.chapter}.{bm.verse}
                  </div>
                  <div className="text-xs text-[var(--siloe-ink-muted)]">
                    {copy.bible.bookmark} · {bm.editionId.toUpperCase()}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleBookmark(bm.editionId, bm.bookId, bm.chapter, bm.verse)}
                  className="min-h-[40px] px-3 text-xs text-rose-600 dark:text-rose-400 font-medium"
                >
                  {copy.common.delete}
                </button>
              </div>
            ))}
            {highlights.map((hl) => (
              <div
                key={hl.id}
                className={`flex items-center justify-between gap-2 p-3 rounded-xl border border-[var(--siloe-border)] ${HIGHLIGHT_STYLES[hl.color]}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onChangeLocation({
                      bookId: hl.bookId,
                      chapter: hl.chapter,
                      verseStart: hl.verse,
                      verseEnd: hl.verse,
                    });
                    setSelectedVerse(hl.verse);
                    setBookmarksOpen(false);
                  }}
                  className="text-left flex-1 min-w-0"
                >
                  <div className="text-sm font-semibold text-[var(--siloe-ink)]">
                    {getBookName(hl.bookId, lang)} {hl.chapter}.{hl.verse}
                  </div>
                  <div className="text-xs text-[var(--siloe-ink-muted)]">
                    {copy.bible.highlight} · {hl.editionId.toUpperCase()}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onSetHighlight(hl.editionId, hl.bookId, hl.chapter, hl.verse, null)}
                  className="min-h-[40px] px-3 text-xs text-rose-600 dark:text-rose-400 font-medium"
                >
                  {copy.common.delete}
                </button>
              </div>
            ))}
          </div>
        )}
      </LiquidModal>
    </div>
  );
};
