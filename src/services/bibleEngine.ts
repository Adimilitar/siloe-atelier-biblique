import { BIBLE_BOOKS, getBookName } from '../data/booksMetadata';
import type {
  BibleEditionMeta,
  BibleLocation,
  BibleVerse,
  ConcordanceMatch,
  ConcordanceMode,
  ConcordanceResult,
  NormalizedBible,
  TestamentFilter,
  UILanguage,
} from '../types/siloe';
import { getStoredBible, saveBibleOffline } from './storage';

function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Parse references such as:
 * "Jean 15.1-8", "Jn 15:1-8", "João 15:1", "1 Co 13", "Ps 23.1-6", "Gn 1"
 */
export function parseBibleReference(input: string): BibleLocation | null {
  const cleaned = input.trim();
  if (!cleaned) return null;

  const match = cleaned.match(/^(.+?)\s+(\d+)(?:[:.,](\d+)(?:\s*[-–]\s*(\d+))?)?$/);
  if (!match) return null;

  const rawBook = stripAccents(match[1].toLowerCase().replace(/\./g, '').trim());
  const chapterNum = parseInt(match[2], 10);
  const vStart = match[3] ? parseInt(match[3], 10) : undefined;
  const vEnd = match[4] ? parseInt(match[4], 10) : vStart;

  const found = BIBLE_BOOKS.find((b) => {
    const fr = stripAccents(b.nameFr.toLowerCase());
    const pt = stripAccents(b.namePt.toLowerCase());
    const abbrFr = stripAccents(b.abbrFr.toLowerCase().replace(/\s+/g, ''));
    const abbrPt = stripAccents(b.abbrPt.toLowerCase().replace(/\s+/g, ''));
    const compact = rawBook.replace(/\s+/g, '');
    return (
      fr === rawBook ||
      pt === rawBook ||
      fr.startsWith(rawBook) ||
      pt.startsWith(rawBook) ||
      abbrFr === compact ||
      abbrPt === compact ||
      b.aliases.some((al) => stripAccents(al.toLowerCase()).replace(/\s+/g, '') === compact)
    );
  });

  if (!found) return null;
  const safeChapter = Math.max(1, Math.min(found.chapters, chapterNum));
  return {
    bookId: found.id,
    chapter: safeChapter,
    verseStart: vStart,
    verseEnd: vEnd,
  };
}

export function formatReferenceLabel(loc: BibleLocation, lang: UILanguage): string {
  const book = getBookName(loc.bookId, lang);
  if (loc.verseStart && loc.verseEnd && loc.verseEnd !== loc.verseStart) {
    return `${book} ${loc.chapter}.${loc.verseStart}–${loc.verseEnd}`;
  }
  if (loc.verseStart) {
    return `${book} ${loc.chapter}.${loc.verseStart}`;
  }
  return `${book} ${loc.chapter}`;
}

export async function downloadBibleEdition(
  meta: BibleEditionMeta,
  onProgress?: (pct: number) => void
): Promise<NormalizedBible> {
  if (!meta.rights.verified || !meta.rights.offlineRead) {
    throw new Error('Droits de lecture hors ligne non vérifiés pour cette édition.');
  }
  if (!meta.downloadUrl) {
    throw new Error('Aucune URL de téléchargement configurée pour cette édition.');
  }

  onProgress?.(10);
  const res = await fetch(meta.downloadUrl);
  if (!res.ok) {
    throw new Error(`Échec du téléchargement (${res.status})`);
  }
  onProgress?.(55);
  const raw = await res.json();
  onProgress?.(85);

  let normalized: NormalizedBible;
  if (meta.format === 'siloe-norm') {
    normalized = {
      id: meta.id,
      downloadedAt: new Date().toISOString(),
      books: raw.books,
    };
  } else {
    // Convert getBible v2 JSON format
    const books = (raw.books || []).map(
      (b: { nr: number; chapters: Array<{ chapter: number; verses: Array<{ verse: number; text: string }> }> }) => ({
        id: b.nr,
        chapters: b.chapters.map((ch) => ({
          c: ch.chapter,
          verses: ch.verses.map((v) => ({ v: v.verse, t: v.text.trim() })),
        })),
      })
    );
    normalized = {
      id: meta.id,
      downloadedAt: new Date().toISOString(),
      books,
    };
  }

  await saveBibleOffline(normalized);
  onProgress?.(100);
  return normalized;
}

export function getChapterVerses(bible: NormalizedBible | undefined, bookId: number, chapter: number): BibleVerse[] {
  if (!bible) return [];
  const book = bible.books.find((b) => b.id === bookId);
  if (!book) return [];
  const ch = book.chapters.find((c) => c.c === chapter);
  return ch ? ch.verses : [];
}

export function getVerseRangeText(
  bible: NormalizedBible | undefined,
  loc: BibleLocation
): Array<{ verse: number; text: string }> {
  const verses = getChapterVerses(bible, loc.bookId, loc.chapter);
  if (!loc.verseStart) return verses.map((v) => ({ verse: v.v, text: v.t }));
  const end = loc.verseEnd ?? loc.verseStart;
  return verses
    .filter((v) => v.v >= loc.verseStart! && v.v <= end)
    .map((v) => ({ verse: v.v, text: v.t }));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function runConcordanceSearch(params: {
  editionId: string;
  query: string;
  mode: ConcordanceMode;
  testament: TestamentFilter;
  bookId: number | 'all';
  limit?: number;
}): Promise<ConcordanceResult> {
  const t0 = performance.now();
  const bible = await getStoredBible(params.editionId);
  if (!bible) {
    return { matches: [], totalOccurrences: 0, totalVerses: 0, durationMs: 0 };
  }

  const rawQuery = params.query.trim();
  if (!rawQuery) {
    return { matches: [], totalOccurrences: 0, totalVerses: 0, durationMs: 0 };
  }

  let tokens: string[] = [];
  if (params.mode === 'multi_forms') {
    tokens = rawQuery
      .split(/[,;\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);
  } else {
    tokens = [rawQuery];
  }
  if (tokens.length === 0) {
    return { matches: [], totalOccurrences: 0, totalVerses: 0, durationMs: 0 };
  }

  const normalizedTokens = tokens.map((tk) => stripAccents(tk.toLowerCase()));
  // Build Unicode word-boundary aware regex on accent-stripped text
  const patternStr =
    params.mode === 'exact_phrase'
      ? `(?<![\\p{L}\\p{N}])${escapeRegex(normalizedTokens[0]).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}])`
      : normalizedTokens.map((tk) => `(?<![\\p{L}\\p{N}])${escapeRegex(tk)}(?![\\p{L}\\p{N}])`).join('|');

  const regex = new RegExp(patternStr, 'giu');

  const matches: ConcordanceMatch[] = [];
  let totalOccurrences = 0;
  let totalVerses = 0;
  const maxList = params.limit ?? 350;

  for (const book of bible.books) {
    const bMeta = BIBLE_BOOKS[book.id - 1];
    if (params.testament !== 'all' && bMeta?.testament !== params.testament) continue;
    if (params.bookId !== 'all' && book.id !== params.bookId) continue;

    for (const ch of book.chapters) {
      for (const verse of ch.verses) {
        const cleanText = stripAccents(verse.t.toLowerCase());
        const found = cleanText.match(regex);
        if (found && found.length > 0) {
          totalVerses += 1;
          totalOccurrences += found.length;
          if (matches.length < maxList) {
            matches.push({
              editionId: params.editionId,
              bookId: book.id,
              chapter: ch.c,
              verse: verse.v,
              text: verse.t,
              occurrencesInVerse: found.length,
              matchedTokens: tokens,
            });
          }
        }
      }
    }
  }

  return {
    matches,
    totalOccurrences,
    totalVerses,
    durationMs: Math.round(performance.now() - t0),
  };
}
