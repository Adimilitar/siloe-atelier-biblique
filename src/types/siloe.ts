export type UILanguage = 'fr' | 'pt';

export type ThemeMode = 'auto' | 'light' | 'dark' | 'sepia';

export type WallpaperId = 'none' | 'galilee' | 'limestone' | 'siloe_ink';

export type TabId = 'bible' | 'concordance' | 'studies' | 'assistant';

export type TestamentFilter = 'all' | 'OT' | 'NT';

export type VersificationSystem = 'Segond' | 'German' | 'NRSV' | 'KJV' | 'Other';

export interface EditionRights {
  verified: boolean;
  offlineRead: boolean;
  concordance: boolean;
  compare: boolean;
  quoteInStudy: boolean;
  exportDocxPdf: boolean;
  aiContext: boolean;
  requiresAttribution: boolean;
  attributionText: string;
}

export interface BibleEditionMeta {
  id: string;
  title: string;
  shortTitle: string;
  language: 'fr' | 'pt';
  year: string;
  sourceName: string;
  sourceUrl: string;
  license: string;
  credits: string;
  versification: VersificationSystem;
  versificationNoteFr: string;
  versificationNotePt: string;
  downloadUrl: string;
  isBundledLocal: boolean;
  format: 'siloe-norm' | 'getbible-v2';
  estimatedSizeMb: number;
  rights: EditionRights;
}

export interface BibleVerse {
  v: number;
  t: string;
}

export interface BibleChapter {
  c: number;
  verses: BibleVerse[];
}

export interface BibleBook {
  id: number; // 1..66
  chapters: BibleChapter[];
}

export interface NormalizedBible {
  id: string;
  downloadedAt: string;
  books: BibleBook[];
}

export interface BibleLocation {
  bookId: number;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
}

export interface BookmarkItem {
  id: string;
  editionId: string;
  bookId: number;
  chapter: number;
  verse: number;
  label?: string;
  createdAt: string;
}

export type HighlightColor = 'gold' | 'ink' | 'sage' | 'rose';

export interface HighlightItem {
  id: string;
  editionId: string;
  bookId: number;
  chapter: number;
  verse: number;
  color: HighlightColor;
  note?: string;
  createdAt: string;
}

export type ConcordanceMode = 'whole_word' | 'exact_phrase' | 'multi_forms';

export interface ConcordanceMatch {
  editionId: string;
  bookId: number;
  chapter: number;
  verse: number;
  text: string;
  occurrencesInVerse: number;
  matchedTokens: string[];
}

export interface ConcordanceResult {
  matches: ConcordanceMatch[];
  totalOccurrences: number;
  totalVerses: number;
  durationMs: number;
}

export type StudyType = 'guided' | 'free';

export interface GuidedObservation {
  id: string;
  verseRef: string;
  note: string;
}

export interface GuidedStudyData {
  passageRef: string;
  editionId: string;
  startingQuestion: string;
  observations: GuidedObservation[];
  interpretation: string;
  application: string;
  openQuestions: string;
  teachingPlan: string;
}

export interface NotebookItem {
  id: string;
  name: string;
  color: HighlightColor;
  createdAt: string;
}

export interface StudyDocument {
  id: string;
  title: string;
  type: StudyType;
  notebookId: string;
  folder: string;
  bookId?: number;
  theme: string;
  contentHtml: string;
  guided: GuidedStudyData;
  linkedRefs: string[];
  mediaIds: string[];
  lastScrollTop: number;
  lastCursorOffset: number;
  createdAt: string;
  updatedAt: string;
}

export interface SavedMediaAsset {
  id: string;
  kind: 'map' | 'reconstruction' | 'archive_notice';
  title: string;
  caption: string;
  sourceCredits: string;
  svgMarkup?: string;
  dataUrl?: string;
  createdAt: string;
}

export type AIProviderId = 'gemini' | 'openai';

export type AssistantFormatMode = 'auto' | 'written' | 'map' | 'documented_photo' | 'generated_reconstruction';

export interface BiblicalPlace {
  name: string;
  modernName?: string;
  region: string;
  lat: number;
  lng: number;
  certainty: 'certaine' | 'probable' | 'incertaine' | string;
  certaintyNote?: string;
}

export interface HistoricalSourceItem {
  title: string;
  author: string;
  period?: string;
  detail: string;
  url?: string;
}

export interface InterpretationItem {
  label: string;
  summary: string;
  traditions?: string;
}

export interface ReconstructionSpec {
  title: string;
  era?: string;
  description: string;
  sceneType?: 'vineyard' | 'pool_siloam' | 'temple_court' | 'fishing_boat' | 'scroll_study' | 'city_gate' | string;
  elements?: string[];
}

export interface AssistantStructuredReply {
  directAnswer: string;
  biblicalQuotes?: Array<{ ref: string; text: string; note?: string }>;
  interpretations: InterpretationItem[];
  historicalSources: HistoricalSourceItem[];
  biblicalPlaces?: BiblicalPlace[];
  visualMode: 'written' | 'map' | 'documented_photo' | 'generated_reconstruction' | string;
  visualCaption?: string;
  documentedArchiveNote?: string;
  reconstructionSpec?: ReconstructionSpec;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  provider?: AIProviderId;
  prompt?: string;
  passageRef?: string;
  translationId?: string;
  translationTitle?: string;
  reply?: AssistantStructuredReply;
  error?: string;
  createdAt: string;
}

export interface AppPreferences {
  language: UILanguage;
  themeMode: ThemeMode;
  wallpaper: WallpaperId;
  fontSize: number;
  primaryEditionId: string;
  compareEditionId: string;
  compareEnabled: boolean;
  lastLocation: BibleLocation;
  lastStudyId: string | null;
  aiProvider: AIProviderId;
  customCatalogUrls: string[];
}
