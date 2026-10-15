import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ConfirmOptions {
  title: string;
  message: React.ReactNode;
  /** Label of the confirming button, e.g. "Delete team". */
  confirmLabel?: string;
  /** "danger" for irreversible deletes, "warning" for changes. */
  tone?: 'warning' | 'danger';
  /** If set, the user must type this exact text before confirming (for the most destructive actions). */
  requireText?: string;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

/**
 * Themed confirmation dialog. Usage:
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Delete team?', message: '...', tone: 'danger' }))) return;
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [typed, setTyped] = useState('');
  const resolver = useRef<(value: boolean) => void>();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    setTyped('');
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = undefined;
    setOptions(null);
  }, []);

  useEffect(() => {
    if (!options) return;
    // Focus Cancel (or the type-to-confirm box) so a stray Enter never confirms.
    (options.requireText ? inputRef.current : cancelRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, close]);

  const tone = options?.tone ?? 'warning';
  const canConfirm = !options?.requireText || typed.trim() === options.requireText.trim();

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => close(false)} />
            <div
              className={`relative glass-panel p-6 rounded-xl max-w-md w-full shadow-2xl border ${
                tone === 'danger' ? 'border-neon-pink/40' : 'border-neon-yellow/30'
              }`}
            >
              <div className="flex items-start gap-3 mb-4">
                <span
                  className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    tone === 'danger' ? 'bg-neon-pink/15 text-neon-pink' : 'bg-neon-yellow/10 text-neon-yellow'
                  }`}
                  aria-hidden="true"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m0 3.75h.008M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </span>
                <div>
                  <h3 className="font-pixel text-xs text-white leading-relaxed mb-2">{options.title}</h3>
                  <div className="text-sm text-slate-300 leading-relaxed">{options.message}</div>
                </div>
              </div>

              {options.requireText && (
                <div className="mb-5">
                  <label className="block text-xs text-slate-400 mb-2">
                    Type <span className="font-mono text-white">{options.requireText}</span> to confirm
                  </label>
                  <input
                    ref={inputRef}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canConfirm) close(true);
                    }}
                    className="w-full rounded px-3 py-2 neon-input text-sm"
                    autoComplete="off"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={() => close(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 border border-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canConfirm}
                  onClick={() => close(true)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${
                    tone === 'danger'
                      ? 'bg-neon-pink hover:bg-neon-pink/90 text-white shadow-neon-pink'
                      : 'bg-neon-yellow/90 hover:bg-neon-yellow text-space-900'
                  }`}
                >
                  {options.confirmLabel ?? 'Confirm'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}
