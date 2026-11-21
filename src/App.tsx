import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Download,
  FileText,
  Search,
  SlidersHorizontal,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import bgGalileeUrl from './assets/images/bg_galilee_mist_1795282328384.jpg';
import bgLimestoneUrl from './assets/images/bg_jerusalem_stone_1795282331240.jpg';
import bgSiloeInkUrl from './assets/images/bg_siloe_ink_1795282330474.jpg';
import { AssistantView } from './components/AssistantView';
import { BibleReaderView } from './components/BibleReaderView';
import { ConcordanceView } from './components/ConcordanceView';
import { SettingsModal } from './components/SettingsModal';
import { StudiesView } from './components/StudiesView';
import { CORE_BIBLE_CATALOG } from './data/bibleCatalog';
import { getBookName } from './data/booksMetadata';
import { tCopy } from './data/i18n';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useOnlineStatus } from './hooks/useViewportAndNetwork';
import { downloadBibleEdition } from './services/bibleEngine';
import {
  DEFAULT_PREFS,
  deleteBibleOffline,
  deleteBookmark,
  deleteHighlight,
  deleteStudy,
  getDownloadedBibleIds,
  getStoredBible,
  listAssistantMessages,
  listBookmarks,
  listCustomEditions,
  listHighlights,
  listMediaAssets,
  listNotebooks,
  listStudies,
  loadPreferences,
  saveAssistantMessage,
  saveBookmark,
  saveCustomEdition,
  saveHighlight,
  saveMediaAsset,
  saveNotebook,
  savePreferences,
  saveStudy,
} from './services/storage';
import type {
  AppPreferences,
  AssistantMessage,
  BibleEditionMeta,
  BibleLocation,
  BookmarkItem,
  HighlightColor,
  HighlightItem,
  NormalizedBible,
  NotebookItem,
  SavedMediaAsset,
  StudyDocument,
  StudyType,
  TabId,
} from './types/siloe';

function createEmptyStudy(
  type: StudyType,
  notebookId: string,
  lang: 'fr' | 'pt',
  editionId: string
): StudyDocument {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title:
      type === 'guided'
        ? lang === 'pt'
          ? 'Novo estudo guiado'
          : 'Nouvelle étude guidée'
        : lang === 'pt'
        ? 'Nova nota livre'
        : 'Nouveau document libre',
    type,
    notebookId,
    folder: lang === 'pt' ? 'Geral' : 'Général',
    theme: '',
    contentHtml: '<p></p>',
    guided: {
      passageRef: '',
      editionId,
      startingQuestion: '',
      observations: [],
      interpretation: '',
      application: '',
      openQuestions: '',
      teachingPlan: '',
    },
    linkedRefs: [],
    mediaIds: [],
    lastScrollTop: 0,
    lastCursorOffset: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export default function App() {
  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('bible');
  const [prefs, setPrefs] = useState<AppPreferences>(DEFAULT_PREFS);
  const [customEditions, setCustomEditions] = useState<BibleEditionMeta[]>([]);
  const [downloadedIds, setDownloadedIds] = useState<string[]>([]);
  const [loadedBibles, setLoadedBibles] = useState<Record<string, NormalizedBible>>({});
  const [downloadingIds, setDownloadingIds] = useState<Record<string, number>>({});

  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [notebooks, setNotebooks] = useState<NotebookItem[]>([]);
  const [studies, setStudies] = useState<StudyDocument[]>([]);
  const [activeStudyId, setActiveStudyId] = useState<string | null>(null);
  const [savedMedia, setSavedMedia] = useState<SavedMediaAsset[]>([]);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);

  const [concordanceInitialQuery, setConcordanceInitialQuery] = useState('');
  const [concordanceEditionId, setConcordanceEditionId] = useState('lsg1910');
  const [assistantContext, setAssistantContext] = useState<{
    ref: string;
    text: string;
    edition: BibleEditionMeta;
  } | null>(null);
  const [pendingSnippet, setPendingSnippet] = useState<{
    id: string;
    html: string;
    refLabel?: string;
    bookId?: number;
  } | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);

  const catalog = useMemo(
    () => [...CORE_BIBLE_CATALOG, ...customEditions],
    [customEditions]
  );

  // Sync theme classes on document.documentElement
  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const effectiveDark =
        prefs.themeMode === 'dark' || (prefs.themeMode === 'auto' && prefersDark);
      root.classList.toggle('dark', effectiveDark);
      root.classList.toggle('sepia', prefs.themeMode === 'sepia');
      document.documentElement.lang = prefs.language;
    };
    applyTheme();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', applyTheme);
    return () => mq.removeEventListener('change', applyTheme);
  }, [prefs.themeMode, prefs.language]);

  const reloadAllUserData = useCallback(async () => {
    const [p, ce, dlIds, bms, hls, nbs, sts, med, msgs] = await Promise.all([
      loadPreferences(),
      listCustomEditions(),
      getDownloadedBibleIds(),
      listBookmarks(),
      listHighlights(),
      listNotebooks(),
      listStudies(),
      listMediaAssets(),
      listAssistantMessages(),
    ]);

    setPrefs(p);
    setCustomEditions(ce);
    setDownloadedIds(dlIds);
    setBookmarks(bms);
    setHighlights(hls);
    setNotebooks(nbs);
    setStudies(sts);
    setSavedMedia(med);
    setAssistantMessages(msgs);

    // Load downloaded Bibles into memory
    const bMap: Record<string, NormalizedBible> = {};
    await Promise.all(
      dlIds.map(async (id) => {
        const b = await getStoredBible(id);
        if (b) bMap[id] = b;
      })
    );
    setLoadedBibles(bMap);
    return { p, dlIds, sts, nbs };
  }, []);

  // Initial hydration + auto-download core bundled Bibles if not cached yet
  useEffect(() => {
    void (async () => {
      const { p, dlIds, sts, nbs } = await reloadAllUserData();

      // Ensure at least one starter study exists for smooth first-run experience
      if (sts.length === 0) {
        const starter = createEmptyStudy('guided', nbs[0]?.id || 'nb-general', p.language, p.primaryEditionId);
        starter.title = 'Jean 15.1–8 — Demeurer dans le vrai cep';
        starter.bookId = 43;
        starter.theme = 'Discipulat';
        starter.guided.passageRef = 'Jean 15.1–8';
        starter.guided.startingQuestion = 'Que signifie « demeurer » selon les versets 4 à 7 ?';
        await saveStudy(starter);
        setStudies([starter]);
      }

      setReady(true);

      // Background-fetch bundled primary & compare editions on first visit so offline reading & comparison work immediately
      const toBootstrap = ['lsg1910', 'darby', 'blivre2018'].filter((id) => !dlIds.includes(id));
      for (const edId of toBootstrap) {
        const meta = CORE_BIBLE_CATALOG.find((e) => e.id === edId);
        if (!meta) continue;
        try {
          setDownloadingIds((prev) => ({ ...prev, [edId]: 15 }));
          const norm = await downloadBibleEdition(meta, (pct) =>
            setDownloadingIds((prev) => ({ ...prev, [edId]: pct }))
          );
          setLoadedBibles((prev) => ({ ...prev, [edId]: norm }));
          setDownloadedIds((prev) => (prev.includes(edId) ? prev : [...prev, edId]));
        } catch (err) {
          console.warn('Bootstrap Bible download skipped:', edId, err);
        } finally {
          setDownloadingIds((prev) => {
            const next = { ...prev };
            delete next[edId];
            return next;
          });
        }
      }
    })();
  }, [reloadAllUserData]);

  const updatePrefs = useCallback((patch: Partial<AppPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      void savePreferences(next);
      return next;
    });
  }, []);

  const handleDownloadEdition = async (meta: BibleEditionMeta) => {
    setDownloadingIds((prev) => ({ ...prev, [meta.id]: 10 }));
    try {
      const norm = await downloadBibleEdition(meta, (pct) =>
        setDownloadingIds((prev) => ({ ...prev, [meta.id]: pct }))
      );
      setLoadedBibles((prev) => ({ ...prev, [meta.id]: norm }));
      setDownloadedIds((prev) => (prev.includes(meta.id) ? prev : [...prev, meta.id]));
    } finally {
      setDownloadingIds((prev) => {
        const next = { ...prev };
        delete next[meta.id];
        return next;
      });
    }
  };

  const handleDeleteEdition = async (id: string) => {
    await deleteBibleOffline(id);
    setDownloadedIds((prev) => prev.filter((x) => x !== id));
    setLoadedBibles((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleToggleBookmark = (editionId: string, bookId: number, chapter: number, verse: number) => {
    const existing = bookmarks.find(
      (b) => b.bookId === bookId && b.chapter === chapter && b.verse === verse
    );
    if (existing) {
      void deleteBookmark(existing.id);
      setBookmarks((prev) => prev.filter((b) => b.id !== existing.id));
    } else {
      const item: BookmarkItem = {
        id: `${bookId}-${chapter}-${verse}`,
        editionId,
        bookId,
        chapter,
        verse,
        createdAt: new Date().toISOString(),
      };
      void saveBookmark(item);
      setBookmarks((prev) => [...prev, item]);
    }
  };

  const handleSetHighlight = (
    editionId: string,
    bookId: number,
    chapter: number,
    verse: number,
    color: HighlightColor | null
  ) => {
    const existing = highlights.find(
      (h) => h.bookId === bookId && h.chapter === chapter && h.verse === verse
    );
    if (!color) {
      if (existing) {
        void deleteHighlight(existing.id);
        setHighlights((prev) => prev.filter((h) => h.id !== existing.id));
      }
      return;
    }
    const item: HighlightItem = {
      id: `${bookId}-${chapter}-${verse}`,
      editionId,
      bookId,
      chapter,
      verse,
      color,
      createdAt: new Date().toISOString(),
    };
    void saveHighlight(item);
    setHighlights((prev) => [...prev.filter((h) => h.id !== item.id), item]);
  };

  const handleCreateStudy = (type: StudyType, notebookId: string) => {
    const study = createEmptyStudy(type, notebookId, prefs.language, prefs.primaryEditionId);
    void saveStudy(study);
    setStudies((prev) => [study, ...prev]);
    setActiveStudyId(study.id);
    updatePrefs({ lastStudyId: study.id });
    return study;
  };

  const handleUpdateStudy = (study: StudyDocument) => {
    void saveStudy(study);
    setStudies((prev) => {
      const idx = prev.findIndex((s) => s.id === study.id);
      if (idx === -1) return [study, ...prev];
      const next = [...prev];
      next[idx] = study;
      return next;
    });
  };

  const handleDeleteStudy = (id: string) => {
    void deleteStudy(id);
    setStudies((prev) => prev.filter((s) => s.id !== id));
    if (activeStudyId === id) setActiveStudyId(null);
  };

  const handleSelectStudy = (id: string | null) => {
    setActiveStudyId(id);
    if (id) updatePrefs({ lastStudyId: id });
  };

  const handleInsertPassageSnippet = (
    refLabel: string,
    text: string,
    edition: BibleEditionMeta,
    loc: BibleLocation
  ) => {
    if (!edition.rights.verified || !edition.rights.quoteInStudy) return;
    let targetId = activeStudyId || prefs.lastStudyId || studies[0]?.id || null;
    if (!targetId) {
      const created = handleCreateStudy('free', notebooks[0]?.id || 'nb-general');
      targetId = created.id;
    } else {
      setActiveStudyId(targetId);
      updatePrefs({ lastStudyId: targetId });
    }
    const refAttr = `${loc.bookId}:${loc.chapter}:${loc.verseStart || ''}-${loc.verseEnd || ''}`;
    const html = `<blockquote><p><a href="#siloe-ref" data-siloe-ref="${refAttr}" data-siloe-ed="${edition.id}">${refLabel} (${edition.shortTitle})</a></p><p>${text}</p><p><small>${edition.rights.attributionText}</small></p></blockquote><p><br></p>`;
    setPendingSnippet({ id: crypto.randomUUID(), html, refLabel, bookId: loc.bookId });
    setActiveTab('studies');
  };

  const copy = tCopy(prefs.language);

  const wallpaperUrl =
    prefs.wallpaper === 'galilee'
      ? bgGalileeUrl
      : prefs.wallpaper === 'limestone'
      ? bgLimestoneUrl
      : prefs.wallpaper === 'siloe_ink'
      ? bgSiloeInkUrl
      : null;

  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden text-[var(--siloe-ink)]">
      {/* Edge-to-Edge Customizable Wallpaper Backdrop */}
      {wallpaperUrl && (
        <div
          aria-hidden="true"
          className="fixed inset-0 -z-10 pointer-events-none bg-cover bg-center transition-opacity duration-500"
          style={{ backgroundImage: `url(${wallpaperUrl})` }}
        >
          <div className="absolute inset-0 bg-[var(--siloe-bg)]/82 backdrop-blur-[2px]" />
        </div>
      )}

      {/* 3-Zone Top Bar (Brand | Status/Tabs on Desktop | Settings) */}
      <header className="sticky top-0 z-30 safe-pt safe-px pb-2">
        <div className="max-w-6xl mx-auto liquid-glass rounded-2xl px-4 py-2.5 flex items-center justify-between gap-4">
          {/* Zone 1: Brand wordmark */}
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-serif-bible text-lg font-bold tracking-tight text-[var(--siloe-ink)] whitespace-nowrap shrink-0">
              {copy.appName}
            </span>
            <span className="hidden sm:inline text-xs text-[var(--siloe-ink-muted)] whitespace-nowrap">
              {copy.appSubtitle}
            </span>
          </div>

          {/* Zone 2: Desktop Floating Navigation Links */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Navigation principale">
            {(
              [
                ['bible', copy.tabs.bible, BookOpen],
                ['concordance', copy.tabs.concordance, Search],
                ['studies', copy.tabs.studies, FileText],
                ['assistant', copy.tabs.assistant, Sparkles],
              ] as const
            ).map(([tabId, label, Icon]) => {
              const active = activeTab === tabId;
              return (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setActiveTab(tabId)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] shadow-sm'
                      : 'text-[var(--siloe-ink)] hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Install & Settings */}
          <div className="flex items-center gap-2 shrink-0">
            {!isInstalled && isInstallable && (
              <button
                type="button"
                onClick={() => void install()}
                className="hidden sm:flex min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-xs font-semibold items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{copy.common.installApp}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label={copy.common.settings}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)]/80 text-xs font-semibold text-[var(--siloe-ink)] flex items-center gap-1.5 hover:bg-[var(--siloe-accent)]/10 whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{copy.common.settings}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Offline Connectivity Banner */}
      {!isOnline && (
        <div className="max-w-6xl mx-auto safe-px pt-1">
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-3.5 py-2 text-xs font-medium text-[var(--siloe-ink)] flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-700 dark:text-amber-300 shrink-0" />
            <span>{copy.common.offlineBanner}</span>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto safe-px pt-3">
        {!ready ? (
          <div className="liquid-surface rounded-3xl p-10 text-center text-sm text-[var(--siloe-ink-muted)]">
            Siloé — Atelier biblique…
          </div>
        ) : (
          <>
            {activeTab === 'bible' && (
              <BibleReaderView
                lang={prefs.language}
                fontSize={prefs.fontSize}
                catalog={catalog}
                downloadedIds={downloadedIds}
                loadedBibles={loadedBibles}
                downloadingIds={downloadingIds}
                primaryEditionId={prefs.primaryEditionId}
                compareEditionId={prefs.compareEditionId}
                compareEnabled={prefs.compareEnabled}
                location={prefs.lastLocation}
                bookmarks={bookmarks}
                highlights={highlights}
                onChangeLocation={(loc) => updatePrefs({ lastLocation: loc })}
                onChangePrimaryEdition={(id) => updatePrefs({ primaryEditionId: id })}
                onChangeCompareEdition={(id) => updatePrefs({ compareEditionId: id })}
                onToggleCompare={() => updatePrefs({ compareEnabled: !prefs.compareEnabled })}
                onDownloadEdition={(m) => void handleDownloadEdition(m)}
                onToggleBookmark={handleToggleBookmark}
                onSetHighlight={handleSetHighlight}
                onSearchWordConcordance={(word, edId) => {
                  setConcordanceInitialQuery(word);
                  setConcordanceEditionId(edId);
                  setActiveTab('concordance');
                }}
                onAskAssistantPassage={(ref, text, edition) => {
                  setAssistantContext({ ref, text, edition });
                  setActiveTab('assistant');
                }}
                onInsertPassageToStudy={handleInsertPassageSnippet}
              />
            )}

            {activeTab === 'concordance' && (
              <ConcordanceView
                lang={prefs.language}
                catalog={catalog}
                downloadedIds={downloadedIds}
                initialQuery={concordanceInitialQuery}
                initialEditionId={concordanceEditionId || prefs.primaryEditionId}
                onDownloadEdition={(m) => void handleDownloadEdition(m)}
                onOpenChapter={(edId, loc) => {
                  updatePrefs({ primaryEditionId: edId, lastLocation: loc });
                  setActiveTab('bible');
                }}
                onInsertResultToStudy={handleInsertPassageSnippet}
              />
            )}

            {activeTab === 'studies' && (
              <StudiesView
                lang={prefs.language}
                studies={studies}
                notebooks={notebooks}
                lastStudyId={prefs.lastStudyId}
                activeStudyId={activeStudyId}
                catalog={catalog}
                loadedBibles={loadedBibles}
                savedMedia={savedMedia}
                primaryEditionId={prefs.primaryEditionId}
                onSelectStudy={handleSelectStudy}
                onCreateStudy={handleCreateStudy}
                onUpdateStudy={handleUpdateStudy}
                onDeleteStudy={handleDeleteStudy}
                onCreateNotebook={(name) => {
                  const nb: NotebookItem = {
                    id: crypto.randomUUID(),
                    name,
                    color: 'ink',
                    createdAt: new Date().toISOString(),
                  };
                  void saveNotebook(nb);
                  setNotebooks((prev) => [...prev, nb]);
                }}
                onOpenBibleReference={(loc, edId) => {
                  updatePrefs({
                    lastLocation: loc,
                    ...(edId ? { primaryEditionId: edId } : {}),
                  });
                  setActiveTab('bible');
                }}
                onBackupRestored={async () => {
                  await reloadAllUserData();
                }}
                pendingInsertSnippet={pendingSnippet}
                onConsumePendingSnippet={() => setPendingSnippet(null)}
              />
            )}

            {activeTab === 'assistant' && (
              <AssistantView
                lang={prefs.language}
                provider={prefs.aiProvider}
                onChangeProvider={(p) => updatePrefs({ aiProvider: p })}
                messages={assistantMessages}
                onAppendMessage={(msg) => {
                  void saveAssistantMessage(msg);
                  setAssistantMessages((prev) => [...prev, msg]);
                }}
                attachedContext={assistantContext}
                onClearContext={() => setAssistantContext(null)}
                studies={studies}
                onInsertIntoStudy={({ studyId, html, mediaAsset, refLabel }) => {
                  const target = studies.find((s) => s.id === studyId);
                  if (!target) return;
                  if (mediaAsset) {
                    void saveMediaAsset(mediaAsset);
                    setSavedMedia((prev) => [...prev, mediaAsset]);
                  }
                  const updated: StudyDocument = {
                    ...target,
                    mediaIds: mediaAsset ? [...target.mediaIds, mediaAsset.id] : target.mediaIds,
                    linkedRefs:
                      refLabel && !target.linkedRefs.includes(refLabel)
                        ? [...target.linkedRefs, refLabel]
                        : target.linkedRefs,
                    updatedAt: new Date().toISOString(),
                  };
                  handleUpdateStudy(updated);
                  setActiveStudyId(studyId);
                  updatePrefs({ lastStudyId: studyId });
                  setPendingSnippet({
                    id: crypto.randomUUID(),
                    html,
                    refLabel,
                  });
                  setActiveTab('studies');
                }}
                onOpenStudiesTab={() => setActiveTab('studies')}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile / iPad Portrait Floating iOS 27 Liquid Glass Tab Capsule */}
      <nav
        aria-label="Onglets principaux"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 px-3 safe-pb pointer-events-none"
      >
        <div className="max-w-md mx-auto liquid-glass rounded-full p-1.5 grid grid-cols-4 gap-1 pointer-events-auto shadow-2xl">
          {(
            [
              ['bible', copy.tabs.bible, BookOpen],
              ['concordance', copy.tabs.concordance, Search],
              ['studies', copy.tabs.studies, FileText],
              ['assistant', copy.tabs.assistant, Sparkles],
            ] as const
          ).map(([tabId, label, Icon]) => {
            const active = activeTab === tabId;
            return (
              <button
                key={tabId}
                type="button"
                onClick={() => setActiveTab(tabId)}
                className={`min-h-[48px] rounded-full flex flex-col items-center justify-center gap-0.5 transition px-1 ${
                  active
                    ? 'bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] shadow-sm'
                    : 'text-[var(--siloe-ink)] hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] font-semibold tracking-tight truncate max-w-full">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Settings, Catalog & About Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        prefs={prefs}
        onUpdatePrefs={updatePrefs}
        catalog={catalog}
        downloadedIds={downloadedIds}
        downloadingIds={downloadingIds}
        onDownloadEdition={(m) => void handleDownloadEdition(m)}
        onDeleteEdition={(id) => void handleDeleteEdition(id)}
        onAddCustomEdition={(title, url, edLang) => {
          const meta: BibleEditionMeta = {
            id: `custom-${crypto.randomUUID().slice(0, 8)}`,
            title,
            shortTitle: title.slice(0, 12),
            language: edLang,
            year: 'Catalogue utilisateur',
            sourceName: url,
            sourceUrl: url,
            license: 'Source externe ajoutée par l’utilisateur',
            credits: `Édition ajoutée par l’utilisateur (${url}).`,
            versification: 'Other',
            versificationNoteFr: 'Vérifiez la concordance des chapitres lors de la comparaison.',
            versificationNotePt: 'Verifique a numeração ao comparar.',
            downloadUrl: url,
            isBundledLocal: false,
            format: 'getbible-v2',
            estimatedSizeMb: 4.5,
            rights: {
              verified: true,
              offlineRead: true,
              concordance: true,
              compare: true,
              quoteInStudy: true,
              exportDocxPdf: true,
              aiContext: true,
              requiresAttribution: true,
              attributionText: `${title} (${url})`,
            },
          };
          void saveCustomEdition(meta);
          setCustomEditions((prev) => [...prev, meta]);
        }}
      />
    </div>
  );
}
