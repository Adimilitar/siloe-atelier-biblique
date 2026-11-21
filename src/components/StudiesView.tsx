import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArchiveRestore,
  Bold,
  BookOpen,
  Check,
  Download,
  FileDown,
  FilePlus2,
  FolderOpen,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Palette,
  Plus,
  Quote,
  Redo2,
  RotateCcw,
  Search,
  Table2,
  Trash2,
  Underline,
  Undo2,
} from 'lucide-react';
import { BIBLE_BOOKS, getBookName } from '../data/booksMetadata';
import { tCopy } from '../data/i18n';
import { formatReferenceLabel, getVerseRangeText, parseBibleReference } from '../services/bibleEngine';
import { exportStudyToDocx, exportStudyToPdf, triggerDownloadBlob } from '../services/exportService';
import { createCompleteBackupZip, restoreCompleteBackupFile } from '../services/storage';
import type {
  BibleEditionMeta,
  BibleLocation,
  NormalizedBible,
  NotebookItem,
  SavedMediaAsset,
  StudyDocument,
  StudyType,
  UILanguage,
} from '../types/siloe';
import { LiquidModal } from './LiquidModal';

interface StudiesViewProps {
  lang: UILanguage;
  studies: StudyDocument[];
  notebooks: NotebookItem[];
  lastStudyId: string | null;
  activeStudyId: string | null;
  catalog: BibleEditionMeta[];
  loadedBibles: Record<string, NormalizedBible>;
  savedMedia: SavedMediaAsset[];
  primaryEditionId: string;
  onSelectStudy: (id: string | null) => void;
  onCreateStudy: (type: StudyType, notebookId: string) => StudyDocument;
  onUpdateStudy: (study: StudyDocument) => void;
  onDeleteStudy: (id: string) => void;
  onCreateNotebook: (name: string) => void;
  onOpenBibleReference: (loc: BibleLocation, editionId?: string) => void;
  onBackupRestored: () => Promise<void>;
  pendingInsertSnippet?: {
    id: string;
    html: string;
    refLabel?: string;
    bookId?: number;
  } | null;
  onConsumePendingSnippet: () => void;
}

export const StudiesView: React.FC<StudiesViewProps> = ({
  lang,
  studies,
  notebooks,
  lastStudyId,
  activeStudyId,
  catalog,
  loadedBibles,
  savedMedia,
  primaryEditionId,
  onSelectStudy,
  onCreateStudy,
  onUpdateStudy,
  onDeleteStudy,
  onCreateNotebook,
  onOpenBibleReference,
  onBackupRestored,
  pendingInsertSnippet,
  onConsumePendingSnippet,
}) => {
  const copy = tCopy(lang);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterNotebookId, setFilterNotebookId] = useState<string>('all');
  const [filterBookId, setFilterBookId] = useState<number | 'all'>('all');
  const [filterTheme, setFilterTheme] = useState<string>('all');
  const [newNotebookName, setNewNotebookName] = useState('');
  const [showNotebookModal, setShowNotebookModal] = useState(false);

  // Insert passage modal state
  const [passageModalOpen, setPassageModalOpen] = useState(false);
  const [passageRefQuery, setPassageRefQuery] = useState('Jean 15.1-8');
  const [passageEditionId, setPassageEditionId] = useState(primaryEditionId);

  // Export/Backup feedback
  const [statusToast, setStatusToast] = useState('');
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [pendingBackupFile, setPendingBackupFile] = useState<File | null>(null);

  // Rich Editor Refs & Undo/Redo stack
  const editorRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [textColorMenuOpen, setTextColorMenuOpen] = useState(false);
  const [hlColorMenuOpen, setHlColorMenuOpen] = useState(false);

  const activeStudy = useMemo(
    () => studies.find((s) => s.id === activeStudyId) ?? null,
    [studies, activeStudyId]
  );

  const resumeCandidate = useMemo(() => {
    if (lastStudyId) {
      const found = studies.find((s) => s.id === lastStudyId);
      if (found) return found;
    }
    return studies[0] ?? null;
  }, [studies, lastStudyId]);

  const allThemes = useMemo(() => {
    const set = new Set<string>();
    studies.forEach((s) => {
      if (s.theme.trim()) set.add(s.theme.trim());
    });
    return Array.from(set).sort();
  }, [studies]);

  const filteredStudies = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return studies.filter((s) => {
      if (filterNotebookId !== 'all' && s.notebookId !== filterNotebookId) return false;
      if (filterBookId !== 'all' && s.bookId !== filterBookId) return false;
      if (filterTheme !== 'all' && s.theme.trim() !== filterTheme) return false;
      if (!q) return true;
      const plainHtml = s.contentHtml.replace(/<[^>]+>/g, ' ').toLowerCase();
      const guidedBlob = [
        s.guided.passageRef,
        s.guided.startingQuestion,
        s.guided.interpretation,
        s.guided.application,
        s.guided.openQuestions,
        s.guided.teachingPlan,
        ...s.guided.observations.map((o) => `${o.verseRef} ${o.note}`),
      ]
        .join(' ')
        .toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.theme.toLowerCase().includes(q) ||
        s.folder.toLowerCase().includes(q) ||
        plainHtml.includes(q) ||
        guidedBlob.includes(q)
      );
    });
  }, [studies, filterNotebookId, filterBookId, filterTheme, searchTerm]);

  // Sync editor innerHTML when switching studies
  useEffect(() => {
    if (!activeStudy || !editorRef.current) return;
    if (editorRef.current.innerHTML !== activeStudy.contentHtml) {
      editorRef.current.innerHTML = activeStudy.contentHtml || '<p></p>';
    }
    setUndoStack([activeStudy.contentHtml || '<p></p>']);
    setRedoStack([]);

    // Restore last scroll position when opening/resuming study
    window.setTimeout(() => {
      if (activeStudy.lastScrollTop > 0) {
        window.scrollTo({ top: activeStudy.lastScrollTop, behavior: 'instant' as ScrollBehavior });
      }
    }, 60);
  }, [activeStudy?.id]);

  // Persist window scroll position while editing a study (debounced)
  useEffect(() => {
    if (!activeStudy) return;
    let timer: number | undefined;
    const handleWindowScroll = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const nextY = Math.round(window.scrollY);
        if (nextY !== activeStudy.lastScrollTop) {
          onUpdateStudy({
            ...activeStudy,
            lastScrollTop: nextY,
          });
        }
      }, 250);
    };
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
      if (timer) window.clearTimeout(timer);
    };
  }, [activeStudy, onUpdateStudy]);

  // Handle pending snippet inserted from Bible Reader, Concordance, or Assistant
  useEffect(() => {
    if (!pendingInsertSnippet || !activeStudy) return;
    insertHtmlAtCursor(pendingInsertSnippet.html, pendingInsertSnippet.refLabel, pendingInsertSnippet.bookId);
    onConsumePendingSnippet();
  }, [pendingInsertSnippet, activeStudy?.id]);

  const showToast = (msg: string) => {
    setStatusToast(msg);
    window.setTimeout(() => setStatusToast(''), 3200);
  };

  const captureSelectionRange = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return;
    const range = sel.getRangeAt(0);
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  };

  const pushHtmlChange = (newHtml: string, extra?: Partial<StudyDocument>) => {
    if (!activeStudy) return;
    setUndoStack((prev) => {
      const last = prev[prev.length - 1];
      if (last === newHtml) return prev;
      return [...prev.slice(-39), newHtml];
    });
    setRedoStack([]);
    onUpdateStudy({
      ...activeStudy,
      ...extra,
      contentHtml: newHtml,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleEditorInput = () => {
    if (!editorRef.current) return;
    pushHtmlChange(editorRef.current.innerHTML);
  };

  const execFormat = (cmd: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    if (savedRangeRef.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRangeRef.current);
    }
    document.execCommand(cmd, false, value);
    captureSelectionRange();
    handleEditorInput();
  };

  const handleUndo = () => {
    if (!activeStudy || !editorRef.current || undoStack.length <= 1) return;
    const current = undoStack[undoStack.length - 1];
    const prev = undoStack[undoStack.length - 2];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((r) => [...r, current]);
    editorRef.current.innerHTML = prev;
    onUpdateStudy({ ...activeStudy, contentHtml: prev, updatedAt: new Date().toISOString() });
  };

  const handleRedo = () => {
    if (!activeStudy || !editorRef.current || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, next]);
    editorRef.current.innerHTML = next;
    onUpdateStudy({ ...activeStudy, contentHtml: next, updatedAt: new Date().toISOString() });
  };

  const insertHtmlAtCursor = (html: string, refLabel?: string, bookId?: number) => {
    if (!editorRef.current || !activeStudy) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    if (savedRangeRef.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
    const inserted = document.execCommand('insertHTML', false, html);
    if (!inserted) {
      editorRef.current.innerHTML += html;
    }
    captureSelectionRange();
    const nextLinked =
      refLabel && !activeStudy.linkedRefs.includes(refLabel)
        ? [...activeStudy.linkedRefs, refLabel]
        : activeStudy.linkedRefs;
    pushHtmlChange(editorRef.current.innerHTML, {
      linkedRefs: nextLinked,
      bookId: activeStudy.bookId ?? bookId,
    });
  };

  const insertSimpleTable = () => {
    const tableHtml = `<div class="table-scroll-frame"><table><thead><tr><th>${
      lang === 'pt' ? 'Observação' : 'Observation'
    }</th><th>${lang === 'pt' ? 'Referência' : 'Référence'}</th><th>${
      lang === 'pt' ? 'Sentido' : 'Portée'
    }</th></tr></thead><tbody><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></tbody></table></div><p><br></p>`;
    insertHtmlAtCursor(tableHtml);
  };

  const addRowToNearestTable = () => {
    if (!editorRef.current) return;
    const tables = editorRef.current.querySelectorAll('table');
    const lastTable = tables[tables.length - 1];
    if (!lastTable) {
      insertSimpleTable();
      return;
    }
    const tbody = lastTable.querySelector('tbody') || lastTable;
    const colCount = lastTable.querySelector('tr')?.children.length || 3;
    const tr = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
      const td = document.createElement('td');
      td.innerHTML = '&nbsp;';
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
    handleEditorInput();
  };

  // Passage preview inside Insert Passage Modal
  const passagePreview = useMemo(() => {
    const loc = parseBibleReference(passageRefQuery);
    if (!loc) return null;
    const bible = loadedBibles[passageEditionId];
    const edMeta = catalog.find((e) => e.id === passageEditionId);
    const verses = getVerseRangeText(bible, loc);
    return {
      loc,
      edMeta,
      refLabel: formatReferenceLabel(loc, lang),
      verses,
    };
  }, [passageRefQuery, passageEditionId, loadedBibles, catalog, lang]);

  const handleConfirmInsertPassage = () => {
    if (!passagePreview || !passagePreview.edMeta) return;
    if (!passagePreview.edMeta.rights.verified || !passagePreview.edMeta.rights.quoteInStudy) {
      showToast(copy.bible.editionRightsRestricted);
      return;
    }
    const loc = passagePreview.loc;
    const refAttr = `${loc.bookId}:${loc.chapter}:${loc.verseStart || ''}-${loc.verseEnd || ''}`;
    const bodyText = passagePreview.verses.map((v) => `<sup>${v.verse}</sup> ${v.text}`).join(' ');
    const html = `<blockquote><p><a href="#siloe-ref" data-siloe-ref="${refAttr}" data-siloe-ed="${passagePreview.edMeta.id}">${passagePreview.refLabel} (${passagePreview.edMeta.shortTitle})</a></p><p>${bodyText}</p><p><small>${passagePreview.edMeta.rights.attributionText}</small></p></blockquote><p><br></p>`;
    insertHtmlAtCursor(html, passagePreview.refLabel, loc.bookId);
    setPassageModalOpen(false);
  };

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    captureSelectionRange();
    const target = e.target as HTMLElement;
    const link = target.closest('a[data-siloe-ref]') as HTMLAnchorElement | null;
    if (link) {
      e.preventDefault();
      const raw = link.getAttribute('data-siloe-ref') || '';
      const edId = link.getAttribute('data-siloe-ed') || undefined;
      const [bStr, cStr, rangeStr] = raw.split(':');
      const [vsStr, veStr] = (rangeStr || '').split('-');
      const bookId = Number(bStr);
      const chapter = Number(cStr);
      if (bookId && chapter) {
        onOpenBibleReference(
          {
            bookId,
            chapter,
            verseStart: vsStr ? Number(vsStr) : undefined,
            verseEnd: veStr ? Number(veStr) : undefined,
          },
          edId
        );
      }
    }
  };

  const handleExportDocx = async () => {
    if (!activeStudy) return;
    const blob = await exportStudyToDocx(activeStudy, lang);
    const safeName = activeStudy.title.replace(/[^a-z0-9\-_]+/gi, '_') || 'etude_siloe';
    triggerDownloadBlob(blob, `${safeName}.docx`);
    showToast(lang === 'pt' ? 'Documento Word (.docx) exportado.' : 'Document Word (.docx) exporté.');
  };

  const handleExportPdf = () => {
    if (!activeStudy) return;
    const blob = exportStudyToPdf(activeStudy, lang);
    const safeName = activeStudy.title.replace(/[^a-z0-9\-_]+/gi, '_') || 'etude_siloe';
    triggerDownloadBlob(blob, `${safeName}.pdf`);
    showToast(lang === 'pt' ? 'PDF exportado para impressão ou partilha.' : 'PDF exporté pour impression ou partage.');
  };

  const handleBackupExport = async () => {
    const blob = await createCompleteBackupZip();
    const stamp = new Date().toISOString().slice(0, 10);
    triggerDownloadBlob(blob, `siloe-sauvegarde-${stamp}.siloe.zip`);
    showToast(lang === 'pt' ? 'Backup completo (.siloe.zip) descarregado.' : 'Sauvegarde complète (.siloe.zip) téléchargée.');
  };

  const handleRestoreBackup = async (mode: 'merge' | 'replace') => {
    if (!pendingBackupFile) return;
    try {
      const stats = await restoreCompleteBackupFile(pendingBackupFile, mode);
      await onBackupRestored();
      setRestoreConfirmOpen(false);
      setPendingBackupFile(null);
      showToast(
        lang === 'pt'
          ? `Backup restaurado: ${stats.studiesCount} estudos, ${stats.bookmarksCount} marcadores.`
          : `Sauvegarde restaurée : ${stats.studiesCount} études, ${stats.bookmarksCount} signets.`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur de restauration.');
    }
  };

  // List / Hub view when no study is currently open
  if (!activeStudy) {
    return (
      <div className="space-y-4 pb-28">
        {statusToast && (
          <div className="liquid-glass rounded-2xl px-4 py-2.5 text-xs font-semibold text-[var(--siloe-ink)] flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{statusToast}</span>
          </div>
        )}

        {/* Resume Study Quick Card */}
        {resumeCandidate && (
          <div className="liquid-glass rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="text-xs font-semibold text-[var(--siloe-accent)]">
                {copy.studies.resumeStudy}
              </div>
              <h2 className="font-serif-bible text-xl font-bold text-[var(--siloe-ink)] truncate">
                {resumeCandidate.title}
              </h2>
              <p className="text-xs text-[var(--siloe-ink-muted)]">
                {notebooks.find((n) => n.id === resumeCandidate.notebookId)?.name || 'Carnet'}
                {resumeCandidate.bookId ? ` · ${getBookName(resumeCandidate.bookId, lang)}` : ''}
                {resumeCandidate.theme ? ` · ${resumeCandidate.theme}` : ''}
                {' · '}
                {new Date(resumeCandidate.updatedAt).toLocaleString(lang === 'pt' ? 'pt-BR' : 'fr-FR')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectStudy(resumeCandidate.id)}
              className="min-h-[46px] px-5 py-2.5 rounded-2xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-sm font-semibold flex items-center gap-2 hover:opacity-95 active:scale-[0.98] transition"
            >
              <FolderOpen className="w-4 h-4" />
              <span>{copy.studies.resumeStudy}</span>
            </button>
          </div>
        )}

        {/* Creation & Backup Actions */}
        <div className="liquid-surface rounded-3xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="font-serif-bible text-xl sm:text-2xl font-bold text-[var(--siloe-ink)]">
              {copy.studies.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onCreateStudy('guided', filterNotebookId === 'all' ? notebooks[0]?.id || 'nb-general' : filterNotebookId)
                }
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{copy.studies.newGuided}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onCreateStudy('free', filterNotebookId === 'all' ? notebooks[0]?.id || 'nb-general' : filterNotebookId)
                }
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs font-semibold text-[var(--siloe-ink)] flex items-center gap-1.5"
              >
                <FilePlus2 className="w-4 h-4" />
                <span>{copy.studies.newFree}</span>
              </button>
            </div>
          </div>

          {/* Notebooks row */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterNotebookId('all')}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                filterNotebookId === 'all'
                  ? 'bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)]'
                  : 'border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-[var(--siloe-ink)]'
              }`}
            >
              {copy.studies.allNotebooks}
            </button>
            {notebooks.map((nb) => (
              <button
                key={nb.id}
                type="button"
                onClick={() => setFilterNotebookId(nb.id)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  filterNotebookId === nb.id
                    ? 'bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)]'
                    : 'border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-[var(--siloe-ink)]'
                }`}
              >
                {nb.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowNotebookModal(true)}
              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-dashed border-[var(--siloe-border)] text-xs font-medium text-[var(--siloe-ink-muted)] hover:text-[var(--siloe-ink)]"
            >
              + {copy.studies.newNotebook}
            </button>
          </div>

          {/* Search & Filters (Book / Theme) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--siloe-ink-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={copy.studies.searchNotes}
                className="w-full min-h-[42px] pl-9 pr-3 py-1.5 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs text-[var(--siloe-ink)]"
              />
            </div>

            <select
              value={filterBookId}
              onChange={(e) =>
                setFilterBookId(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="min-h-[42px] px-3 py-1.5 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs text-[var(--siloe-ink)]"
            >
              <option value="all">{copy.studies.filterBook}</option>
              {BIBLE_BOOKS.map((b) => (
                <option key={b.id} value={b.id}>
                  {lang === 'pt' ? b.namePt : b.nameFr}
                </option>
              ))}
            </select>

            <select
              value={filterTheme}
              onChange={(e) => setFilterTheme(e.target.value)}
              className="min-h-[42px] px-3 py-1.5 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs text-[var(--siloe-ink)]"
            >
              <option value="all">{copy.studies.filterTheme}</option>
              {allThemes.map((th) => (
                <option key={th} value={th}>
                  {th}
                </option>
              ))}
            </select>
          </div>

          {/* Full Backup / Restore Row */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--siloe-border)]">
            <button
              type="button"
              onClick={handleBackupExport}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs font-semibold text-[var(--siloe-ink)] flex items-center gap-1.5 hover:bg-[var(--siloe-accent)]/10"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{copy.studies.backupExport}</span>
            </button>

            <label className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs font-semibold text-[var(--siloe-ink)] flex items-center gap-1.5 hover:bg-[var(--siloe-accent)]/10 cursor-pointer">
              <ArchiveRestore className="w-3.5 h-3.5" />
              <span>{copy.studies.backupImport}</span>
              <input
                type="file"
                accept=".zip,.json"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPendingBackupFile(file);
                    setRestoreConfirmOpen(true);
                  }
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>

        {/* Study List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredStudies.map((s) => (
            <div
              key={s.id}
              className="liquid-surface rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-[var(--siloe-accent)]/40 transition"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--siloe-ink-muted)]">
                  <span>
                    {s.type === 'guided' ? copy.studies.guidedTab : copy.studies.freeTab}
                    {s.folder ? ` · ${s.folder}` : ''}
                    {s.bookId ? ` · ${getBookName(s.bookId, lang)}` : ''}
                  </span>
                  <span>{new Date(s.updatedAt).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'fr-FR')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectStudy(s.id)}
                  className="text-left font-serif-bible text-lg font-bold text-[var(--siloe-ink)] hover:underline block w-full"
                >
                  {s.title}
                </button>
                <p className="text-xs text-[var(--siloe-ink-muted)] line-clamp-2">
                  {s.guided.passageRef ? `${s.guided.passageRef} — ` : ''}
                  {(s.contentHtml || s.guided.startingQuestion || '').replace(/<[^>]+>/g, ' ').trim() ||
                    (lang === 'pt' ? 'Documento vazio' : 'Document vierge')}
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[var(--siloe-border)]">
                <button
                  type="button"
                  onClick={() => onSelectStudy(s.id)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-xs font-semibold"
                >
                  {lang === 'pt' ? 'Abrir' : 'Ouvrir'}
                </button>
                <button
                  type="button"
                  aria-label={copy.common.delete}
                  onClick={() => onDeleteStudy(s.id)}
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* New Notebook Modal */}
        <LiquidModal
          isOpen={showNotebookModal}
          onClose={() => setShowNotebookModal(false)}
          title={copy.studies.newNotebook}
          closeLabel={copy.common.close}
          maxWidthClass="max-w-md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newNotebookName.trim()) return;
              onCreateNotebook(newNotebookName.trim());
              setNewNotebookName('');
              setShowNotebookModal(false);
            }}
            className="space-y-3"
          >
            <input
              type="text"
              value={newNotebookName}
              onChange={(e) => setNewNotebookName(e.target.value)}
              placeholder={lang === 'pt' ? 'Nome do caderno (ex. Evangelho de João)' : 'Nom du carnet (ex. Évangile de Jean)'}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-sm text-[var(--siloe-ink)]"
              autoFocus
            />
            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-sm font-semibold"
            >
              {copy.common.save}
            </button>
          </form>
        </LiquidModal>

        {/* Restore Backup Confirmation Modal */}
        <LiquidModal
          isOpen={restoreConfirmOpen}
          onClose={() => setRestoreConfirmOpen(false)}
          title={copy.studies.backupImport}
          closeLabel={copy.common.close}
          maxWidthClass="max-w-md"
        >
          <p className="text-sm text-[var(--siloe-ink)]">
            {lang === 'pt'
              ? `Arquivo selecionado: ${pendingBackupFile?.name}. Deseja mesclar com os dados atuais ou substituir os estudos existentes?`
              : `Fichier sélectionné : ${pendingBackupFile?.name}. Souhaitez-vous fusionner avec vos données actuelles ou remplacer vos études existantes ?`}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => void handleRestoreBackup('merge')}
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-xs font-semibold"
            >
              {lang === 'pt' ? 'Mesclar' : 'Fusionner'}
            </button>
            <button
              type="button"
              onClick={() => void handleRestoreBackup('replace')}
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-semibold"
            >
              {lang === 'pt' ? 'Substituir tudo' : 'Remplacer tout'}
            </button>
          </div>
        </LiquidModal>
      </div>
    );
  }

  // Active Study Editor Workspace
  const attachedAssets = savedMedia.filter((m) => activeStudy.mediaIds.includes(m.id));
  const selectableEditions = catalog.filter((e) => e.rights.verified && e.rights.quoteInStudy);

  return (
    <div
      ref={scrollContainerRef}
      className="space-y-4 pb-32"
    >
      {statusToast && (
        <div className="liquid-glass rounded-2xl px-4 py-2.5 text-xs font-semibold text-[var(--siloe-ink)] flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* Study Header & Metadata */}
      <div className="liquid-glass rounded-3xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onSelectStudy(null)}
            className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs font-semibold text-[var(--siloe-ink)] flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{copy.studies.notebooks}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              {copy.studies.autoSaved}
            </span>
            <button
              type="button"
              onClick={handleExportDocx}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs font-semibold text-[var(--siloe-ink)] flex items-center gap-1.5 hover:bg-[var(--siloe-accent)]/10"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Word (.docx)</span>
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-xs font-semibold flex items-center gap-1.5"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        <input
          type="text"
          value={activeStudy.title}
          onChange={(e) =>
            onUpdateStudy({ ...activeStudy, title: e.target.value, updatedAt: new Date().toISOString() })
          }
          className="w-full font-serif-bible text-xl sm:text-2xl font-bold bg-transparent text-[var(--siloe-ink)] border-b border-[var(--siloe-border)] pb-1.5 focus:outline-none focus:border-[var(--siloe-accent)]"
          placeholder={lang === 'pt' ? 'Título do estudo…' : 'Titre de l’étude…'}
        />

        {/* Organization Metadata: Notebook, Folder, Book, Theme, Type */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <select
            value={activeStudy.notebookId}
            onChange={(e) =>
              onUpdateStudy({ ...activeStudy, notebookId: e.target.value, updatedAt: new Date().toISOString() })
            }
            className="min-h-[38px] px-2.5 py-1 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs text-[var(--siloe-ink)]"
          >
            {notebooks.map((nb) => (
              <option key={nb.id} value={nb.id}>
                {nb.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={activeStudy.folder}
            onChange={(e) =>
              onUpdateStudy({ ...activeStudy, folder: e.target.value, updatedAt: new Date().toISOString() })
            }
            placeholder={lang === 'pt' ? 'Pasta' : 'Dossier'}
            className="min-h-[38px] px-2.5 py-1 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs text-[var(--siloe-ink)]"
          />

          <select
            value={activeStudy.bookId ?? ''}
            onChange={(e) =>
              onUpdateStudy({
                ...activeStudy,
                bookId: e.target.value ? Number(e.target.value) : undefined,
                updatedAt: new Date().toISOString(),
              })
            }
            className="min-h-[38px] px-2.5 py-1 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs text-[var(--siloe-ink)]"
          >
            <option value="">{copy.common.book}</option>
            {BIBLE_BOOKS.map((b) => (
              <option key={b.id} value={b.id}>
                {lang === 'pt' ? b.namePt : b.nameFr}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={activeStudy.theme}
            onChange={(e) =>
              onUpdateStudy({ ...activeStudy, theme: e.target.value, updatedAt: new Date().toISOString() })
            }
            placeholder={lang === 'pt' ? 'Tema' : 'Thème'}
            className="min-h-[38px] px-2.5 py-1 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs text-[var(--siloe-ink)]"
          />

          <select
            value={activeStudy.type}
            onChange={(e) =>
              onUpdateStudy({
                ...activeStudy,
                type: e.target.value as StudyType,
                updatedAt: new Date().toISOString(),
              })
            }
            className="col-span-2 sm:col-span-1 min-h-[38px] px-2.5 py-1 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs font-semibold text-[var(--siloe-ink)]"
          >
            <option value="guided">{copy.studies.guidedTab}</option>
            <option value="free">{copy.studies.freeTab}</option>
          </select>
        </div>
      </div>

      {/* Guided Study Structured Fields */}
      {activeStudy.type === 'guided' && (
        <section className="liquid-surface rounded-3xl p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--siloe-ink-muted)] mb-1">
                {copy.studies.guided.passage}
              </label>
              <input
                type="text"
                value={activeStudy.guided.passageRef}
                onChange={(e) =>
                  onUpdateStudy({
                    ...activeStudy,
                    guided: { ...activeStudy.guided, passageRef: e.target.value },
                    updatedAt: new Date().toISOString(),
                  })
                }
                placeholder="ex. Jean 15.1–8"
                className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-sm text-[var(--siloe-ink)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--siloe-ink-muted)] mb-1">
                {copy.studies.guided.question}
              </label>
              <input
                type="text"
                value={activeStudy.guided.startingQuestion}
                onChange={(e) =>
                  onUpdateStudy({
                    ...activeStudy,
                    guided: { ...activeStudy.guided, startingQuestion: e.target.value },
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-sm text-[var(--siloe-ink)]"
              />
            </div>
          </div>

          {/* Observations attached to verses */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-[var(--siloe-ink-muted)]">
                {copy.studies.guided.observations}
              </label>
              <button
                type="button"
                onClick={() =>
                  onUpdateStudy({
                    ...activeStudy,
                    guided: {
                      ...activeStudy.guided,
                      observations: [
                        ...activeStudy.guided.observations,
                        { id: crypto.randomUUID(), verseRef: '', note: '' },
                      ],
                    },
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="min-h-[36px] px-2.5 py-1 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs font-semibold text-[var(--siloe-ink)] flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{copy.studies.guided.addObservation}</span>
              </button>
            </div>
            <div className="space-y-2">
              {activeStudy.guided.observations.map((obs, idx) => (
                <div key={obs.id} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={obs.verseRef}
                    onChange={(e) => {
                      const next = [...activeStudy.guided.observations];
                      next[idx] = { ...obs, verseRef: e.target.value };
                      onUpdateStudy({
                        ...activeStudy,
                        guided: { ...activeStudy.guided, observations: next },
                        updatedAt: new Date().toISOString(),
                      });
                    }}
                    placeholder="v. 4–5"
                    className="sm:w-32 min-h-[40px] px-2.5 py-1.5 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs font-semibold text-[var(--siloe-ink)]"
                  />
                  <input
                    type="text"
                    value={obs.note}
                    onChange={(e) => {
                      const next = [...activeStudy.guided.observations];
                      next[idx] = { ...obs, note: e.target.value };
                      onUpdateStudy({
                        ...activeStudy,
                        guided: { ...activeStudy.guided, observations: next },
                        updatedAt: new Date().toISOString(),
                      });
                    }}
                    placeholder={lang === 'pt' ? 'Observação textual…' : 'Observation textuelle…'}
                    className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-sm text-[var(--siloe-ink)]"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(
              [
                ['interpretation', copy.studies.guided.interpretation],
                ['application', copy.studies.guided.application],
                ['openQuestions', copy.studies.guided.openQuestions],
                ['teachingPlan', copy.studies.guided.teachingPlan],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label className="block text-xs font-semibold text-[var(--siloe-ink-muted)] mb-1">
                  {label}
                </label>
                <textarea
                  rows={3}
                  value={activeStudy.guided[field]}
                  onChange={(e) =>
                    onUpdateStudy({
                      ...activeStudy,
                      guided: { ...activeStudy.guided, [field]: e.target.value },
                      updatedAt: new Date().toISOString(),
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-sm text-[var(--siloe-ink)]"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Word-style Rich Document Editor */}
      <section className="liquid-surface rounded-3xl overflow-hidden">
        {/* Sticky Formatting Toolbar */}
        <div className="sticky top-2 z-10 liquid-glass border-b border-[var(--siloe-border)] p-2 flex flex-wrap items-center gap-1">
          <button
            type="button"
            title="H1"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('formatBlock', 'H1')}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="H2"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('formatBlock', 'H2')}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="H3"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('formatBlock', 'H3')}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Heading3 className="w-4 h-4" />
          </button>

          <span className="h-5 w-px bg-[var(--siloe-border)] mx-0.5" />

          <button
            type="button"
            title="Gras"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('bold')}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Italique"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('italic')}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Souligné"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('underline')}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Underline className="w-4 h-4" />
          </button>

          {/* Text Color Dropdown */}
          <div className="relative">
            <button
              type="button"
              title="Couleur du texte"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setTextColorMenuOpen((v) => !v);
                setHlColorMenuOpen(false);
              }}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Palette className="w-4 h-4" />
            </button>
            {textColorMenuOpen && (
              <div className="absolute left-0 top-10 z-30 liquid-glass rounded-xl p-2 flex items-center gap-1.5 shadow-lg">
                {['#14243E', '#1D4ED8', '#15803D', '#991B1B', '#6B7280'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      execFormat('foreColor', c);
                      setTextColorMenuOpen(false);
                    }}
                    className="w-6 h-6 rounded-full border border-black/20"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Highlight Dropdown */}
          <div className="relative">
            <button
              type="button"
              title="Surligner"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setHlColorMenuOpen((v) => !v);
                setTextColorMenuOpen(false);
              }}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Highlighter className="w-4 h-4" />
            </button>
            {hlColorMenuOpen && (
              <div className="absolute left-0 top-10 z-30 liquid-glass rounded-xl p-2 flex items-center gap-1.5 shadow-lg">
                {['#FEF08A', '#BAE6FD', '#BBF7D0', '#FECDD3', 'transparent'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      execFormat('hiliteColor', c);
                      setHlColorMenuOpen(false);
                    }}
                    className="w-6 h-6 rounded-full border border-black/20"
                    style={{ backgroundColor: c === 'transparent' ? '#FFFFFF' : c }}
                  />
                ))}
              </div>
            )}
          </div>

          <span className="h-5 w-px bg-[var(--siloe-border)] mx-0.5" />

          <button
            type="button"
            title="Liste à puces"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('insertUnorderedList')}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Liste numérotée"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('insertOrderedList')}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Citation"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('formatBlock', 'BLOCKQUOTE')}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Quote className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Tableau simple"
            onMouseDown={(e) => e.preventDefault()}
            onClick={insertSimpleTable}
            className="min-h-[38px] px-2 flex items-center gap-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-xs font-medium"
          >
            <Table2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="+ Ligne tableau"
            onMouseDown={(e) => e.preventDefault()}
            onClick={addRowToNearestTable}
            className="min-h-[38px] px-2 flex items-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[11px] font-semibold"
          >
            +Ligne
          </button>

          <span className="h-5 w-px bg-[var(--siloe-border)] mx-0.5" />

          <button
            type="button"
            title="Annuler"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleUndo}
            disabled={undoStack.length <= 1}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-35"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Rétablir"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-35"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              captureSelectionRange();
            }}
            onClick={() => setPassageModalOpen(true)}
            className="ml-auto min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-xs font-semibold flex items-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{copy.studies.insertPassage}</span>
          </button>
        </div>

        {/* ContentEditable Document Area */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleEditorInput}
          onKeyUp={captureSelectionRange}
          onBlur={() => {
            captureSelectionRange();
            handleEditorInput();
          }}
          onClick={handleEditorClick}
          className="siloe-editor-prose min-h-[340px] p-5 sm:p-8 text-base text-[var(--siloe-ink)]"
        />

        {/* Attached Maps / Reconstructions Saved in Study */}
        {attachedAssets.length > 0 && (
          <div className="border-t border-[var(--siloe-border)] p-4 sm:p-6 space-y-4">
            <h3 className="text-xs font-semibold text-[var(--siloe-ink-muted)]">
              {lang === 'pt' ? 'Mídias e mapas anexados ao estudo' : 'Médias & cartes rattachés à l’étude'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attachedAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="rounded-2xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] p-3 space-y-2"
                >
                  <div className="text-xs font-semibold text-[var(--siloe-ink)]">{asset.title}</div>
                  {asset.svgMarkup && (
                    <div
                      className="w-full overflow-hidden rounded-xl"
                      dangerouslySetInnerHTML={{ __html: asset.svgMarkup }}
                    />
                  )}
                  <p className="text-[11px] text-[var(--siloe-ink-muted)]">{asset.caption}</p>
                  <p className="text-[10px] text-[var(--siloe-ink-muted)]">{asset.sourceCredits}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Insert Passage Modal */}
      <LiquidModal
        isOpen={passageModalOpen}
        onClose={() => setPassageModalOpen(false)}
        title={copy.studies.insertPassage}
        closeLabel={copy.common.close}
        footer={
          <button
            type="button"
            disabled={!passagePreview || passagePreview.verses.length === 0}
            onClick={handleConfirmInsertPassage}
            className="w-full min-h-[44px] rounded-xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-sm font-semibold disabled:opacity-50"
          >
            {copy.studies.insertPassage}
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <input
            type="text"
            value={passageRefQuery}
            onChange={(e) => setPassageRefQuery(e.target.value)}
            placeholder="ex. Jean 15.1-8"
            className="min-h-[44px] px-3 py-2 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-sm text-[var(--siloe-ink)]"
          />
          <select
            value={passageEditionId}
            onChange={(e) => setPassageEditionId(e.target.value)}
            className="min-h-[44px] px-3 py-2 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs font-semibold text-[var(--siloe-ink)]"
          >
            {selectableEditions.map((ed) => (
              <option key={ed.id} value={ed.id}>
                {ed.title}
              </option>
            ))}
          </select>
        </div>

        {passagePreview && passagePreview.verses.length > 0 ? (
          <div className="rounded-2xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] p-4 space-y-2">
            <div className="text-xs font-semibold text-[var(--siloe-accent)]">
              {passagePreview.refLabel} · {passagePreview.edMeta?.title}
            </div>
            <p className="font-serif-bible text-sm leading-relaxed text-[var(--siloe-ink)]">
              {passagePreview.verses.map((v) => (
                <span key={v.verse} className="mr-1.5">
                  <sup className="font-mono-num text-[11px] font-semibold mr-0.5">{v.verse}</sup>
                  {v.text}
                </span>
              ))}
            </p>
            <p className="text-[11px] text-[var(--siloe-ink-muted)]">
              {passagePreview.edMeta?.rights.attributionText}
            </p>
          </div>
        ) : (
          <p className="text-xs text-[var(--siloe-ink-muted)]">
            {lang === 'pt'
              ? 'Digite uma referência válida (ex. João 15.1-8) e certifique-se de que a edição esteja baixada.'
              : 'Saisissez une référence valide (ex. Jean 15.1-8) d’une édition téléchargée hors ligne.'}
          </p>
        )}
      </LiquidModal>
    </div>
  );
};
