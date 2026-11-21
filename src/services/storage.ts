import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import JSZip from 'jszip';
import type {
  AppPreferences,
  AssistantMessage,
  BibleEditionMeta,
  BookmarkItem,
  HighlightItem,
  NormalizedBible,
  NotebookItem,
  SavedMediaAsset,
  StudyDocument,
} from '../types/siloe';

interface SiloeDBSchema extends DBSchema {
  bibles: {
    key: string;
    value: NormalizedBible;
  };
  customEditions: {
    key: string;
    value: BibleEditionMeta;
  };
  bookmarks: {
    key: string;
    value: BookmarkItem;
  };
  highlights: {
    key: string;
    value: HighlightItem;
  };
  notebooks: {
    key: string;
    value: NotebookItem;
  };
  studies: {
    key: string;
    value: StudyDocument;
  };
  media: {
    key: string;
    value: SavedMediaAsset;
  };
  assistantMessages: {
    key: string;
    value: AssistantMessage;
  };
  prefs: {
    key: string;
    value: AppPreferences;
  };
}

const DB_NAME = 'siloe-atelier-biblique-v1';
const DB_VERSION = 1;

export const DEFAULT_PREFS: AppPreferences = {
  language: 'fr',
  themeMode: 'auto',
  wallpaper: 'galilee',
  fontSize: 17,
  primaryEditionId: 'lsg1910',
  compareEditionId: 'darby',
  compareEnabled: false,
  lastLocation: { bookId: 43, chapter: 15, verseStart: 1, verseEnd: 8 },
  lastStudyId: null,
  aiProvider: 'gemini',
  customCatalogUrls: [],
};

let dbPromise: Promise<IDBPDatabase<SiloeDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<SiloeDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<SiloeDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('bibles')) db.createObjectStore('bibles', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('customEditions')) db.createObjectStore('customEditions', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('bookmarks')) db.createObjectStore('bookmarks', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('highlights')) db.createObjectStore('highlights', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('notebooks')) db.createObjectStore('notebooks', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('studies')) db.createObjectStore('studies', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('media')) db.createObjectStore('media', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('assistantMessages'))
          db.createObjectStore('assistantMessages', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('prefs')) db.createObjectStore('prefs');
      },
    });
  }
  return dbPromise;
}

export async function loadPreferences(): Promise<AppPreferences> {
  const db = await getDB();
  const saved = await db.get('prefs', 'app');
  return saved ? { ...DEFAULT_PREFS, ...saved } : DEFAULT_PREFS;
}

export async function savePreferences(prefs: AppPreferences): Promise<void> {
  const db = await getDB();
  await db.put('prefs', prefs, 'app');
}

export async function getStoredBible(id: string): Promise<NormalizedBible | undefined> {
  const db = await getDB();
  return db.get('bibles', id);
}

export async function getDownloadedBibleIds(): Promise<string[]> {
  const db = await getDB();
  return (await db.getAllKeys('bibles')) as string[];
}

export async function saveBibleOffline(bible: NormalizedBible): Promise<void> {
  const db = await getDB();
  await db.put('bibles', bible);
}

export async function deleteBibleOffline(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('bibles', id);
}

export async function listCustomEditions(): Promise<BibleEditionMeta[]> {
  const db = await getDB();
  return db.getAll('customEditions');
}

export async function saveCustomEdition(meta: BibleEditionMeta): Promise<void> {
  const db = await getDB();
  await db.put('customEditions', meta);
}

export async function listBookmarks(): Promise<BookmarkItem[]> {
  const db = await getDB();
  return db.getAll('bookmarks');
}

export async function saveBookmark(item: BookmarkItem): Promise<void> {
  const db = await getDB();
  await db.put('bookmarks', item);
}

export async function deleteBookmark(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('bookmarks', id);
}

export async function listHighlights(): Promise<HighlightItem[]> {
  const db = await getDB();
  return db.getAll('highlights');
}

export async function saveHighlight(item: HighlightItem): Promise<void> {
  const db = await getDB();
  await db.put('highlights', item);
}

export async function deleteHighlight(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('highlights', id);
}

export async function listNotebooks(): Promise<NotebookItem[]> {
  const db = await getDB();
  const all = await db.getAll('notebooks');
  if (all.length === 0) {
    const defaultNb: NotebookItem = {
      id: 'nb-general',
      name: 'Carnet principal',
      color: 'ink',
      createdAt: new Date().toISOString(),
    };
    await db.put('notebooks', defaultNb);
    return [defaultNb];
  }
  return all;
}

export async function saveNotebook(nb: NotebookItem): Promise<void> {
  const db = await getDB();
  await db.put('notebooks', nb);
}

export async function deleteNotebook(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('notebooks', id);
}

export async function listStudies(): Promise<StudyDocument[]> {
  const db = await getDB();
  const list = await db.getAll('studies');
  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveStudy(study: StudyDocument): Promise<void> {
  const db = await getDB();
  await db.put('studies', study);
}

export async function deleteStudy(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('studies', id);
}

export async function listMediaAssets(): Promise<SavedMediaAsset[]> {
  const db = await getDB();
  return db.getAll('media');
}

export async function saveMediaAsset(asset: SavedMediaAsset): Promise<void> {
  const db = await getDB();
  await db.put('media', asset);
}

export async function listAssistantMessages(): Promise<AssistantMessage[]> {
  const db = await getDB();
  const msgs = await db.getAll('assistantMessages');
  return msgs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function saveAssistantMessage(msg: AssistantMessage): Promise<void> {
  const db = await getDB();
  await db.put('assistantMessages', msg);
}

export async function clearAssistantMessages(): Promise<void> {
  const db = await getDB();
  await db.clear('assistantMessages');
}

export interface SiloeBackupPayload {
  schemaVersion: 1;
  app: 'siloe-atelier-biblique';
  exportedAt: string;
  preferences: AppPreferences;
  bookmarks: BookmarkItem[];
  highlights: HighlightItem[];
  notebooks: NotebookItem[];
  studies: StudyDocument[];
  media: SavedMediaAsset[];
  assistantMessages: AssistantMessage[];
  customEditions: BibleEditionMeta[];
}

export async function createCompleteBackupZip(): Promise<Blob> {
  const [
    preferences,
    bookmarks,
    highlights,
    notebooks,
    studies,
    media,
    assistantMessages,
    customEditions,
  ] = await Promise.all([
    loadPreferences(),
    listBookmarks(),
    listHighlights(),
    listNotebooks(),
    listStudies(),
    listMediaAssets(),
    listAssistantMessages(),
    listCustomEditions(),
  ]);

  const payload: SiloeBackupPayload = {
    schemaVersion: 1,
    app: 'siloe-atelier-biblique',
    exportedAt: new Date().toISOString(),
    preferences,
    bookmarks,
    highlights,
    notebooks,
    studies,
    media,
    assistantMessages,
    customEditions,
  };

  const zip = new JSZip();
  zip.file('siloe-backup.json', JSON.stringify(payload, null, 2));

  // Also bundle individual HTML copies & media SVGs inside the archive for human inspection
  const studiesFolder = zip.folder('studies-html');
  if (studiesFolder) {
    for (const s of studies) {
      const safeName = s.title.replace(/[^a-z0-9\-_]+/gi, '_').slice(0, 48) || s.id;
      studiesFolder.file(`${safeName}-${s.id.slice(0, 6)}.html`, s.contentHtml || '');
    }
  }
  const mediaFolder = zip.folder('media');
  if (mediaFolder) {
    for (const m of media) {
      if (m.svgMarkup) {
        mediaFolder.file(`${m.id}.svg`, m.svgMarkup);
      }
    }
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export async function restoreCompleteBackupFile(
  file: File,
  mode: 'merge' | 'replace' = 'merge'
): Promise<{ studiesCount: number; bookmarksCount: number; mediaCount: number }> {
  let rawJson = '';
  if (file.name.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entry = zip.file('siloe-backup.json');
    if (!entry) {
      throw new Error('Archive .siloe.zip invalide : fichier siloe-backup.json introuvable.');
    }
    rawJson = await entry.async('string');
  } else {
    rawJson = await file.text();
  }

  const parsed = JSON.parse(rawJson) as SiloeBackupPayload;
  if (parsed.app !== 'siloe-atelier-biblique' || parsed.schemaVersion !== 1) {
    throw new Error('Format de sauvegarde Siloé non reconnu.');
  }

  const db = await getDB();
  if (mode === 'replace') {
    await Promise.all([
      db.clear('bookmarks'),
      db.clear('highlights'),
      db.clear('notebooks'),
      db.clear('studies'),
      db.clear('media'),
      db.clear('assistantMessages'),
    ]);
  }

  for (const item of parsed.bookmarks || []) await db.put('bookmarks', item);
  for (const item of parsed.highlights || []) await db.put('highlights', item);
  for (const item of parsed.notebooks || []) await db.put('notebooks', item);
  for (const item of parsed.studies || []) await db.put('studies', item);
  for (const item of parsed.media || []) await db.put('media', item);
  for (const item of parsed.assistantMessages || []) await db.put('assistantMessages', item);
  for (const item of parsed.customEditions || []) await db.put('customEditions', item);
  if (parsed.preferences) {
    await savePreferences({ ...DEFAULT_PREFS, ...parsed.preferences });
  }

  return {
    studiesCount: (parsed.studies || []).length,
    bookmarksCount: (parsed.bookmarks || []).length,
    mediaCount: (parsed.media || []).length,
  };
}
