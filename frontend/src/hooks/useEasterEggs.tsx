import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';

export type EggMode = 'normal' | 'disco' | 'matrix' | 'rainbow';

export interface EggToast {
  id: number;
  message: string;
  color?: 'cyan' | 'pink' | 'purple' | 'yellow';
}

export interface EggHint {
  id: string;
  name: string;
  hint: string;
  points: number;
}

export const EGG_HINTS: EggHint[] = [
  { id: 'konami', name: 'Konami Constructor', hint: 'Try the classic code: ↑↑↓↓←→←→BA', points: 100 },
  { id: 'word-zecathon', name: 'Name Dropper', hint: 'Type the platform name anywhere on the page', points: 100 },
  { id: 'word-gemini', name: 'Model Whisperer', hint: 'Type the name of the AI model', points: 100 },
  { id: 'word-hacker', name: 'Keyboard Warrior', hint: 'Type the word a coder loves', points: 100 },
  { id: 'word-admin', name: 'Admin Aspirant', hint: 'Try typing the forbidden role', points: 50 },
  { id: 'word-matrix', name: 'Red Pill', hint: 'Wake up and type the simulation name', points: 100 },
  { id: 'word-godmode', name: 'Doomsday Prepper', hint: 'Type the classic cheat code letters', points: 100 },
  { id: 'star-click', name: 'Star Catcher', hint: 'Click a star in the space background', points: 50 },
  { id: 'logo-fan', name: 'Logo Fanatic', hint: 'Click the logo really fast', points: 100 },
  { id: 'controller', name: 'Controller Hunter', hint: 'Find the hidden controller button', points: 100 },
  { id: 'hero-logo', name: 'Logo Watcher', hint: 'Click the big logo on the landing page', points: 25 },
  { id: 'stat-click', name: 'Stat Nerd', hint: 'Click the numbers in the landing stats', points: 25 },
  { id: 'github-click', name: 'GitHub Stargazer', hint: 'Click the GitHub icon in the footer', points: 25 },
  { id: 'twitter-click', name: 'X Marks the Spot', hint: 'Click the X / Twitter icon in the footer', points: 25 },
  { id: 'linkedin-click', name: 'Networker', hint: 'Click the LinkedIn icon in the footer', points: 25 },
  { id: 'hidden-teddy', name: 'Teddy Spotter', hint: 'Find the fuzzy bear in the footer', points: 150 },
  { id: 'copyright-click', name: 'Fine Print Reader', hint: 'Triple-click the copyright year', points: 75 },
  { id: 'command-deck', name: 'Captain on Deck', hint: 'Triple-click the dashboard title', points: 75 },
  { id: 'hacker-username', name: 'Login Imposter', hint: 'Type "hacker" as the username', points: 50 },
  { id: 'shortcut-m', name: 'Music Seeker', hint: 'Press the M key outside any input', points: 25 },
  { id: 'code-disco', name: 'Disco Commander', hint: 'Enter DISCO in the Egg Hunt panel', points: 75 },
  { id: 'code-matrix', name: 'Matrix Runner', hint: 'Enter MATRIX in the Egg Hunt panel', points: 75 },
  { id: 'code-rainbow', name: 'Rainbow Rider', hint: 'Enter RAINBOW in the Egg Hunt panel', points: 75 },
  { id: 'mascot-click', name: 'Mascot Friend', hint: 'Click the floating Z-bot', points: 100 },
  { id: 'reset-eggs', name: 'Fresh Start', hint: 'Reset your egg collection from the Egg Hunt panel', points: 0 },
];

interface EasterEggContextType {
  discovered: string[];
  mode: EggMode;
  toast: EggToast | null;
  count: number;
  total: number;
  hints: EggHint[];
  discover: (id: string, message: string, color?: EggToast['color']) => void;
  cheatCode: (code: string) => void;
  setMode: (mode: EggMode) => void;
  reset: () => void;
  playSound: (type: 'coin' | 'powerup' | 'secret' | 'magic' | 'pop') => void;
  triggerConfetti: () => void;
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

const CHEAT_CODES: Record<string, { id: string; message: string; color: EggToast['color']; mode?: EggMode }> = {
  disco: { id: 'code-disco', message: 'Disco mode activated! 🕺', color: 'pink', mode: 'disco' },
  matrix: { id: 'code-matrix', message: 'The Matrix has you...', color: 'cyan', mode: 'matrix' },
  rainbow: { id: 'code-rainbow', message: 'Rainbow overload! 🌈', color: 'purple', mode: 'rainbow' },
  zecathon: { id: 'word-zecathon', message: 'ZECATHON override accepted. +100 XP', color: 'cyan' },
  gemini: { id: 'word-gemini', message: 'Gemini mode whispered. +100 XP', color: 'purple' },
  hacker: { id: 'word-hacker', message: 'Keyboard warrior detected. +100 XP', color: 'pink' },
  admin: { id: 'word-admin', message: 'Nice try, but admins are chosen, not typed. +50 XP', color: 'yellow' },
  godmode: { id: 'word-godmode', message: 'IDDQD? Health restored. +100 XP', color: 'pink' },
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
  const [confettiKey, setConfettiKey] = useState(0);
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

  const triggerConfetti = useCallback(() => {
    setConfettiKey((k) => k + 1);
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
        triggerConfetti();
        return next;
      });
    },
    [showToast, triggerConfetti]
  );

  const reset = useCallback(() => {
    setDiscovered([]);
    setModeState('normal');
    localStorage.removeItem(STORAGE_KEY);
    showToast('Easter egg progress reset', 'pink');
  }, [showToast]);

  const cheatCode = useCallback(
    (code: string) => {
      const normalized = code.trim().toLowerCase();
      if (!normalized) return;
      if (normalized === 'reset') {
        reset();
        return;
      }
      const entry = CHEAT_CODES[normalized];
      if (entry) {
        discover(entry.id, entry.message, entry.color);
        if (entry.mode) setMode(entry.mode);
      } else {
        showToast(`Unknown code: ${normalized}`, 'yellow');
      }
    },
    [discover, reset, setMode, showToast]
  );

  const playSound = useCallback((type: Parameters<typeof playEggSound>[0]) => playEggSound(type), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      konamiRef.current = [...konamiRef.current, e.key].slice(-KONAMI.length);
      if (KONAMI.every((k, i) => konamiRef.current[i] === k)) {
        discover('konami', 'Konami code entered! Disco mode unlocked 🕺', 'pink');
        setMode('disco');
        playEggSound('powerup');
        konamiRef.current = [];
      }

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

      if (!typing && e.key.toLowerCase() === 'm') {
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
      value={{
        discovered,
        mode,
        toast,
        count: discovered.length,
        total: EGG_HINTS.length,
        hints: EGG_HINTS,
        discover,
        cheatCode,
        setMode,
        reset,
        playSound,
        triggerConfetti,
      }}
    >
      {children}
      <ConfettiBurst key={confettiKey} />
    </EasterEggContext.Provider>
  );
}

function ConfettiBurst() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: { x: number; y: number; vx: number; vy: number; color: string; life: number; size: number }[] = [];
    const colors = ['#05d9e8', '#ff2a6d', '#b026ff', '#f7ff58', '#ffffff'];
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 60 + Math.random() * 40,
        size: 3 + Math.random() * 4,
      });
    }

    let id: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;
      particles.forEach((p) => {
        if (p.life <= 0) return;
        alive++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life -= 1;
        p.size *= 0.98;
        ctx.globalAlpha = Math.max(0, p.life / 80);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      });
      ctx.globalAlpha = 1;
      if (alive > 0) {
        id = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[75]" aria-hidden="true" />;
}
