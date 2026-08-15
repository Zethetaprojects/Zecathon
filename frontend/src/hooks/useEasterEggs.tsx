import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';

export type EggMode = 'normal' | 'disco' | 'matrix' | 'rainbow';

export interface EggToast {
  id: number;
  message: string;
  color?: 'cyan' | 'pink' | 'purple' | 'yellow';
}

interface EasterEggContextType {
  discovered: string[];
  mode: EggMode;
  toast: EggToast | null;
  count: number;
  discover: (id: string, message: string, color?: EggToast['color']) => void;
  setMode: (mode: EggMode) => void;
  reset: () => void;
  playSound: (type: 'coin' | 'powerup' | 'secret' | 'magic' | 'pop') => void;
}

const EasterEggContext = createContext<EasterEggContextType | undefined>(undefined);

const STORAGE_KEY = 'zecathon_eggs';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const SECRET_WORDS: Record<string, { message: string; color: EggToast['color'] }> = {
  zecathon: { message: 'ZECATHON override accepted. +100 XP', color: 'cyan' },
  gemini: { message: 'Gemini mode whispered. +100 XP', color: 'purple' },
  hacker: { message: 'Keyboard warrior detected. +100 XP', color: 'pink' },
  admin: { message: 'Nice try, but admins are chosen, not typed. +50 XP', color: 'yellow' },
  matrix: { message: 'Wake up, builder... +100 XP', color: 'cyan' },
  godmode: { message: 'IDDQD? Health restored. +100 XP', color: 'pink' },
};

export function useEasterEggs() {
  const ctx = useContext(EasterEggContext);
  if (!ctx) throw new Error('useEasterEggs must be used inside EasterEggProvider');
  return ctx;
}

export function playEggSound(type: 'coin' | 'powerup' | 'secret' | 'magic' | 'pop') {
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  const t = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);

  const configs: Record<typeof type, { freqs: number[]; duration: number; wave: OscillatorType; peak: number }> = {
    coin: { freqs: [523.25, 1046.5], duration: 0.12, wave: 'square', peak: 0.12 },
    powerup: { freqs: [440, 554, 659, 880], duration: 0.25, wave: 'sawtooth', peak: 0.08 },
    secret: { freqs: [220, 277, 330, 440], duration: 0.5, wave: 'sine', peak: 0.1 },
    magic: { freqs: [880, 1100, 1320, 1760], duration: 0.6, wave: 'triangle', peak: 0.06 },
    pop: { freqs: [300, 450], duration: 0.08, wave: 'sine', peak: 0.08 },
  };

  const cfg = configs[type];
  cfg.freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = cfg.wave;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t + i * 0.06);
    g.gain.linearRampToValueAtTime(cfg.peak, t + i * 0.06 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + cfg.duration);
    osc.connect(g);
    g.connect(gain);
    osc.start(t + i * 0.06);
    osc.stop(t + i * 0.06 + cfg.duration + 0.1);
  });

  ctx.resume().catch(() => {});
  setTimeout(() => ctx.close().catch(() => {}), 1200);
}

export function EasterEggProvider({ children }: { children: ReactNode }) {
  const [discovered, setDiscovered] = useState<string[]>([]);
  const [mode, setModeState] = useState<EggMode>('normal');
  const [toast, setToast] = useState<EggToast | null>(null);
  const konamiRef = useRef<string[]>([]);
  const typedRef = useRef<string[]>([]);
  const toastIdRef = useRef(0);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(saved)) setDiscovered(saved);
    } catch {
      // ignore
    }
  }, []);

  const setMode = useCallback((m: EggMode) => {
    setModeState(m);
    if (m !== 'normal') {
      window.setTimeout(() => setModeState('normal'), 10000);
    }
  }, []);

  const showToast = useCallback((message: string, color: EggToast['color'] = 'cyan') => {
    const id = ++toastIdRef.current;
    setToast({ id, message, color });
    window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 2600);
  }, []);

  const discover = useCallback(
    (id: string, message: string, color: EggToast['color'] = 'cyan') => {
      setDiscovered((prev) => {
        if (prev.includes(id)) {
          showToast(`Already found: ${id} 👀`, 'yellow');
          return prev;
        }
        const next = [...prev, id];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        playEggSound('coin');
        showToast(message, color);
        return next;
      });
    },
    [showToast]
  );

  const reset = useCallback(() => {
    setDiscovered([]);
    setModeState('normal');
    localStorage.removeItem(STORAGE_KEY);
    showToast('Easter egg progress reset', 'pink');
  }, [showToast]);

  const playSound = useCallback((type: Parameters<typeof playEggSound>[0]) => playEggSound(type), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Konami code (works even while typing to avoid confusion, but accepts the exact sequence)
      konamiRef.current = [...konamiRef.current, e.key].slice(-KONAMI.length);
      if (KONAMI.every((k, i) => konamiRef.current[i] === k)) {
        discover('konami', 'Konami code entered! Disco mode unlocked 🕺', 'pink');
        setMode('disco');
        playEggSound('powerup');
        konamiRef.current = [];
      }

      // Secret words only when not typing
      if (!typing && e.key.length === 1) {
        typedRef.current.push(e.key.toLowerCase());
        if (typedRef.current.length > 12) typedRef.current.shift();
        const typed = typedRef.current.join('');
        Object.entries(SECRET_WORDS).forEach(([word, { message, color }]) => {
          if (typed.includes(word)) {
            discover(`word-${word}`, message, color);
            if (word === 'matrix') setMode('matrix');
            if (word === 'gemini') setMode('rainbow');
            typedRef.current = [];
          }
        });
      }

      // Global shortcuts
      if (!typing && e.key.toLowerCase() === 'm') {
        // Let the music provider handle its own shortcuts, but keep this for discovery
        discover('shortcut-m', 'Press the speaker icon in the navbar for the space soundtrack 🎧', 'cyan');
      }
    }

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const trigger = target.closest('[data-egg-trigger]') as HTMLElement | null;
      if (!trigger) return;
      const id = trigger.dataset.eggTrigger || '';
      const message = trigger.dataset.eggMessage || 'Secret found!';
      const color = (trigger.dataset.eggColor || 'cyan') as EggToast['color'];
      if (id) discover(id, message, color);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('click', onClick);
    };
  }, [discover, setMode]);

  return (
    <EasterEggContext.Provider
      value={{ discovered, mode, toast, count: discovered.length, discover, setMode, reset, playSound }}
    >
      {children}
    </EasterEggContext.Provider>
  );
}
