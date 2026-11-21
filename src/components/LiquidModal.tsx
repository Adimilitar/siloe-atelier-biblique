import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useViewportKeyboard } from '../hooks/useViewportAndNetwork';

interface LiquidModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  closeLabel?: string;
  maxWidthClass?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const LiquidModal: React.FC<LiquidModalProps> = ({
  isOpen,
  onClose,
  title,
  closeLabel = 'Fermer',
  maxWidthClass = 'max-w-2xl',
  footer,
  children,
}) => {
  const { keyboardInset, viewportHeight } = useViewportKeyboard();
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const savedScrollYRef = useRef<number>(0);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    savedScrollYRef.current = window.scrollY;

    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollYRef.current}px`;
    document.body.style.width = '100%';

    const focusTimer = window.setTimeout(() => {
      closeBtnRef.current?.focus({ preventScroll: true });
    }, 30);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKey);

      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;

      window.scrollTo(0, savedScrollYRef.current);
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus({ preventScroll: true });
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const availableH = Math.max(280, viewportHeight - 24);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0B1424]/55 backdrop-blur-sm transition-opacity"
      style={{ paddingBottom: keyboardInset > 0 ? `${keyboardInset}px` : undefined }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`liquid-glass w-full ${maxWidthClass} flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl mx-0 sm:mx-4`}
        style={{
          maxHeight: `${availableH}px`,
          backgroundColor: 'var(--siloe-bg-solid)',
        }}
      >
        {/* Pinned Header: always keeps title and Fermer accessible */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[var(--siloe-border)] shrink-0 safe-pt sm:pt-3.5">
          <h2 className="font-serif-bible text-lg font-semibold text-[var(--siloe-ink)] truncate">
            {title}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-medium text-[var(--siloe-ink)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.98] transition flex items-center gap-1.5 shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--siloe-accent)]"
          >
            <X className="w-4 h-4" />
            <span>{closeLabel}</span>
          </button>
        </div>

        {/* Scrollable Interior */}
        <div className="flex-1 min-h-0 overflow-y-auto scroll-contain px-5 py-4 space-y-4">
          {children}
        </div>

        {/* Optional Pinned Action Footer */}
        {footer && (
          <div className="shrink-0 border-t border-[var(--siloe-border)] px-5 py-3 safe-pb sm:pb-3 bg-[var(--siloe-bg-elevated)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
