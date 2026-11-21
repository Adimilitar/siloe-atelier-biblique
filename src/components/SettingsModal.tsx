import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Info,
  Lock,
  RefreshCw,
  Share,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { resolvePublicAssetUrl } from '../data/bibleCatalog';
import { tCopy } from '../data/i18n';
import { usePWAInstall } from '../hooks/usePWAInstall';
import type {
  AppPreferences,
  BibleEditionMeta,
  ThemeMode,
  UILanguage,
  WallpaperId,
} from '../types/siloe';
import { LiquidModal } from './LiquidModal';
import appEmblemUrl from '../assets/images/siloe_app_icon_1795282330397.jpg';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefs: AppPreferences;
  onUpdatePrefs: (patch: Partial<AppPreferences>) => void;
  catalog: BibleEditionMeta[];
  downloadedIds: string[];
  downloadingIds: Record<string, number>;
  onDownloadEdition: (meta: BibleEditionMeta) => void;
  onDeleteEdition: (id: string) => void;
  onAddCustomEdition: (title: string, url: string, lang: 'fr' | 'pt') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  prefs,
  onUpdatePrefs,
  catalog,
  downloadedIds,
  downloadingIds,
  onDownloadEdition,
  onDeleteEdition,
  onAddCustomEdition,
}) => {
  const lang = prefs.language;
  const copy = tCopy(lang);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [updateMsg, setUpdateMsg] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Extensible catalog form
  const [customTitle, setCustomTitle] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customLang, setCustomLang] = useState<'fr' | 'pt'>('fr');

  const handleCheckUpdates = async () => {
    setCheckingUpdate(true);
    setUpdateMsg('');
    try {
      let swUpdateNote = '';
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          swUpdateNote = reg.waiting
            ? lang === 'pt'
              ? 'Nova versão do app pronta para recarregar.'
              : 'Nouvelle version disponible (rechargez la page).'
            : lang === 'pt'
            ? 'Service Worker atualizado.'
            : 'Service Worker à jour.';
        }
      }
      const res = await fetch(resolvePublicAssetUrl('bibles/catalog.json'), { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { catalogVersion?: string; updatedAt?: string };
        setUpdateMsg(
          `${lang === 'pt' ? 'Versão' : 'Version'} 1.0.0 · ${
            lang === 'pt' ? 'Catálogo' : 'Catalogue'
          } ${data.catalogVersion || '2026.11.1'} (${data.updatedAt || '2026-11-21'}). ${swUpdateNote}`
        );
      } else {
        setUpdateMsg(
          lang === 'pt'
            ? 'Aplicativo 1.0.0 verificado localmente.'
            : 'Application 1.0.0 vérifiée localement.'
        );
      }
    } catch {
      setUpdateMsg(
        lang === 'pt'
          ? 'Sem conexão para verificar atualizações remotas (versão local 1.0.0).'
          : 'Hors ligne : vérification distante impossible (version locale 1.0.0).'
      );
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <LiquidModal
      isOpen={isOpen}
      onClose={onClose}
      title={copy.common.settings}
      closeLabel={copy.common.close}
      maxWidthClass="max-w-3xl"
    >
      {/* Language & Appearance */}
      <section className="space-y-4">
        <h3 className="text-xs font-bold text-[var(--siloe-ink-muted)]">{copy.settings.appearance}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* UI Language */}
          <div className="rounded-2xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] p-3.5 space-y-2">
            <label className="block text-xs font-semibold text-[var(--siloe-ink)]">
              {copy.settings.language}
            </label>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/10">
              {(['fr', 'pt'] as UILanguage[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => onUpdatePrefs({ language: l })}
                  className={`flex-1 min-h-[38px] rounded-lg text-xs font-semibold transition ${
                    prefs.language === l
                      ? 'bg-[var(--siloe-bg-solid)] text-[var(--siloe-ink)] shadow-sm'
                      : 'text-[var(--siloe-ink-muted)]'
                  }`}
                >
                  {l === 'fr' ? 'Français' : 'Português'}
                </button>
              ))}
            </div>
          </div>

          {/* Adjustable Text Size */}
          <div className="rounded-2xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--siloe-ink)]">
              <span>{copy.settings.textSize}</span>
              <span className="font-mono-num">{prefs.fontSize} px</span>
            </div>
            <input
              type="range"
              min={14}
              max={24}
              step={1}
              value={prefs.fontSize}
              onChange={(e) => onUpdatePrefs({ fontSize: Number(e.target.value) })}
              className="w-full accent-[var(--siloe-accent)]"
            />
          </div>
        </div>

        {/* Theme Mode */}
        <div className="rounded-2xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] p-3.5 space-y-2">
          <label className="block text-xs font-semibold text-[var(--siloe-ink)]">
            {copy.settings.theme}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {(['auto', 'light', 'dark', 'sepia'] as ThemeMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onUpdatePrefs({ themeMode: mode })}
                className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  prefs.themeMode === mode
                    ? 'bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] border-transparent'
                    : 'border-[var(--siloe-border)] text-[var(--siloe-ink)]'
                }`}
              >
                {copy.settings.themes[mode]}
              </button>
            ))}
          </div>
        </div>

        {/* Edge-to-Edge Wallpaper */}
        <div className="rounded-2xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] p-3.5 space-y-2">
          <label className="block text-xs font-semibold text-[var(--siloe-ink)]">
            {copy.settings.wallpaper}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {(['none', 'galilee', 'limestone', 'siloe_ink'] as WallpaperId[]).map((wp) => (
              <button
                key={wp}
                type="button"
                onClick={() => onUpdatePrefs({ wallpaper: wp })}
                className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  prefs.wallpaper === wp
                    ? 'bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] border-transparent'
                    : 'border-[var(--siloe-border)] text-[var(--siloe-ink)]'
                }`}
              >
                {copy.settings.wallpapers[wp]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* PWA Install Section */}
      {!isInstalled && (isInstallable || isIOS) && (
        <section className="rounded-2xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--siloe-ink)]">
              <Smartphone className="w-4 h-4 text-[var(--siloe-accent)]" />
              <span>{copy.common.installApp} (iPhone / iPad / Mac)</span>
            </div>
            {isInstallable ? (
              <button
                type="button"
                onClick={() => void install()}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-xs font-semibold"
              >
                {copy.common.installApp}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowIOSGuide((v) => !v)}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-[var(--siloe-border)] text-xs font-semibold text-[var(--siloe-ink)] flex items-center gap-1.5"
              >
                <Share className="w-3.5 h-3.5" />
                <span>iOS Safari</span>
              </button>
            )}
          </div>
          {showIOSGuide && (
            <p className="text-xs text-[var(--siloe-ink-muted)] leading-relaxed">
              {lang === 'pt'
                ? '1. Toque no botão Partilhar na barra do Safari. 2. Role e toque em "Adicionar à Tela de Início".'
                : '1. Touchez le bouton Partager dans la barre Safari. 2. Choisissez « Sur l’écran d’accueil » pour installer Siloé hors ligne.'}
            </p>
          )}
        </section>
      )}

      {/* Bible Catalog & Verified Rights */}
      <section className="space-y-3 pt-2 border-t border-[var(--siloe-border)]">
        <h3 className="text-xs font-bold text-[var(--siloe-ink-muted)]">{copy.settings.catalogTitle}</h3>
        <div className="space-y-2.5">
          {catalog.map((ed) => {
            const isDl = downloadedIds.includes(ed.id);
            const pct = downloadingIds[ed.id];
            return (
              <div
                key={ed.id}
                className="rounded-2xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] p-3.5 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-[var(--siloe-ink)]">
                      {ed.title} · {ed.language.toUpperCase()} · {ed.year}
                    </div>
                    <div className="text-xs text-[var(--siloe-ink-muted)]">{ed.license}</div>
                  </div>
                  {!ed.rights.verified ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                      <Lock className="w-3.5 h-3.5" />
                      <span>{lang === 'pt' ? 'Direitos pendentes' : 'Droits non vérifiés'}</span>
                    </span>
                  ) : isDl ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{copy.common.downloaded}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteEdition(ed.id)}
                        aria-label={copy.common.removeOffline}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-rose-600 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={pct !== undefined}
                      onClick={() => onDownloadEdition(ed)}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{pct !== undefined ? `${pct}%` : copy.common.download}</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[var(--siloe-ink-muted)]">{ed.credits}</p>
                <p className="text-[11px] text-[var(--siloe-ink-muted)]">
                  {lang === 'pt' ? ed.versificationNotePt : ed.versificationNoteFr}
                </p>
              </div>
            );
          })}
        </div>

        {/* Add Extensible Edition Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!customTitle.trim() || !customUrl.trim()) return;
            onAddCustomEdition(customTitle.trim(), customUrl.trim(), customLang);
            setCustomTitle('');
            setCustomUrl('');
          }}
          className="rounded-2xl border border-dashed border-[var(--siloe-border)] p-3 space-y-2"
        >
          <div className="text-xs font-semibold text-[var(--siloe-ink)]">
            {lang === 'pt'
              ? 'Adicionar edição compatível (getBible v2 JSON / domínio público)'
              : 'Ajouter une édition au catalogue extensible (JSON public)'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={lang === 'pt' ? 'Nome' : 'Titre'}
              className="min-h-[40px] px-2.5 py-1 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs"
            />
            <input
              type="url"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://api.getbible.net/v2/..."
              className="sm:col-span-2 min-h-[40px] px-2.5 py-1 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs"
            />
            <div className="flex gap-1.5">
              <select
                value={customLang}
                onChange={(e) => setCustomLang(e.target.value as 'fr' | 'pt')}
                className="min-h-[40px] px-2 rounded-xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] text-xs"
              >
                <option value="fr">FR</option>
                <option value="pt">PT</option>
              </select>
              <button
                type="submit"
                className="flex-1 min-h-[40px] px-3 rounded-xl bg-[var(--siloe-accent)] text-[var(--siloe-accent-contrast)] text-xs font-semibold"
              >
                +
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* About & Version + Check Updates */}
      <section className="rounded-2xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] p-4 space-y-3">
        <div className="flex items-center gap-3">
          <img
            src={appEmblemUrl}
            alt="Siloé"
            referrerPolicy="no-referrer"
            className="w-12 h-12 rounded-2xl object-cover shrink-0 border border-[var(--siloe-border)]"
          />
          <div>
            <h3 className="font-serif-bible text-base font-bold text-[var(--siloe-ink)] flex items-center gap-1.5">
              <Info className="w-4 h-4 text-[var(--siloe-accent)]" />
              <span>Siloé — Atelier biblique</span>
            </h3>
            <p className="text-xs text-[var(--siloe-ink-muted)]">
              {copy.settings.aboutTitle} : 1.0.0 · PWA iOS / iPadOS / macOS · GitHub Pages Ready
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={checkingUpdate}
            onClick={() => void handleCheckUpdates()}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-[var(--siloe-border)] text-xs font-semibold text-[var(--siloe-ink)] flex items-center gap-1.5 hover:bg-[var(--siloe-accent)]/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? 'animate-spin' : ''}`} />
            <span>{copy.settings.checkUpdates}</span>
          </button>
          {updateMsg && <span className="text-xs text-[var(--siloe-ink-muted)]">{updateMsg}</span>}
        </div>
      </section>
    </LiquidModal>
  );
};
