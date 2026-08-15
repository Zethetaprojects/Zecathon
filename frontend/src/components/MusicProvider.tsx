import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';

interface MusicContextType {
  playing: boolean;
  enabled: boolean;
  toggle: () => void;
  playClick: () => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Cinematic ambient music engine
// ---------------------------------------------------------------------------
// Inspired by a slow Hans Zimmer-style pad progression: Am7 → Fmaj7 → Cmaj7 → G6
// at a relaxed tempo, with layered drones, long chord pads, and a sparse melody.

interface ChordVoicing {
  name: string;
  notes: number[]; // Hz
  bass: number; // Hz
}

const CHORDS: ChordVoicing[] = [
  { name: 'Am7', notes: [220.0, 261.63, 329.63, 392.0], bass: 55.0 },
  { name: 'Fmaj7', notes: [174.61, 220.0, 261.63, 329.63], bass: 43.65 },
  { name: 'Cmaj7', notes: [261.63, 329.63, 392.0, 493.88], bass: 65.41 },
  { name: 'G6', notes: [196.0, 246.94, 293.66, 392.0], bass: 49.0 },
];

const TEMPO = 66; // BPM
const BEATS_PER_BAR = 4;
const BARS_PER_CHORD = 4;
const CHORD_DURATION_BEATS = BEATS_PER_BAR * BARS_PER_CHORD; // 16 beats

class MusicEngine {
  private ctx: AudioContext;
  private master: GainNode;
  private delay: DelayNode;
  private delayGain: GainNode;

  private nextNoteTime = 0;
  private beat = 0;
  private chordIndex = 0;
  private interval: number | null = null;
  private beatDuration = 60 / TEMPO;
  private chordDuration = CHORD_DURATION_BEATS * this.beatDuration;

  constructor() {
    const AC =
      (window as any).AudioContext ||
      ((window as any).webkitAudioContext as typeof AudioContext | undefined);
    if (!AC) throw new Error('Web Audio not supported');

    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);

    this.delay = this.ctx.createDelay();
    this.delay.delayTime.value = 0.55;
    this.delayGain = this.ctx.createGain();
    this.delayGain.gain.value = 0.3;
    this.delay.connect(this.delayGain);
    this.delayGain.connect(this.master);

    this.ctx.resume().catch(() => {});
  }

  private scheduleEnvelope(
    gain: GainNode,
    time: number,
    peak: number,
    attack: number,
    sustain: number,
    release: number
  ) {
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + attack);
    gain.gain.setValueAtTime(peak, time + sustain);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + sustain + release);
  }

  private scheduleVoice(
    freq: number,
    time: number,
    duration: number,
    type: OscillatorType,
    peak: number,
    attack: number,
    release: number,
    sendToDelay: boolean
  ) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;

    const gain = this.ctx.createGain();
    this.scheduleEnvelope(gain, time, peak, attack, duration, release);

    osc.connect(gain);
    gain.connect(this.master);
    if (sendToDelay) gain.connect(this.delay);

    osc.start(time);
    osc.stop(time + duration + release + 0.1);
  }

  private scheduleChordPad(time: number, chord: ChordVoicing) {
    chord.notes.forEach((freq, i) => {
      this.scheduleVoice(freq, time + i * 0.08, this.chordDuration, 'triangle', 0.04, 1.2, 3.0, false);
      this.scheduleVoice(freq * 0.5, time + i * 0.12, this.chordDuration, 'sine', 0.05, 1.0, 3.0, false);
    });
  }

  private scheduleBass(time: number, chord: ChordVoicing) {
    this.scheduleVoice(chord.bass, time, this.chordDuration, 'sine', 0.14, 0.6, 2.0, false);
    this.scheduleVoice(chord.bass * 0.5, time, this.chordDuration, 'triangle', 0.06, 0.8, 2.0, false);
  }

  private scheduleMelody(time: number, chord: ChordVoicing) {
    const idx = Math.floor(Math.random() * chord.notes.length);
    const base = chord.notes[idx];
    const freq = Math.random() > 0.5 ? base * 2 : base;
    const duration = (2 + Math.random() * 2) * this.beatDuration;
    this.scheduleVoice(freq, time, duration, 'sine', 0.07, 0.15, 1.2, true);
  }

  private scheduleHarpGlissando(time: number, chord: ChordVoicing) {
    const triplet = [chord.notes[0], chord.notes[1], chord.notes[2]];
    triplet.forEach((freq, i) => {
      this.scheduleVoice(freq * 2, time + i * 0.18, 0.6, 'triangle', 0.05, 0.02, 0.5, true);
    });
  }

  private tick() {
    const lookahead = 0.5;
    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      const chord = CHORDS[this.chordIndex];
      const isChordStart = this.beat % CHORD_DURATION_BEATS === 0;

      if (isChordStart) {
        this.scheduleChordPad(this.nextNoteTime, chord);
        this.scheduleBass(this.nextNoteTime, chord);
      }

      const barBeat = this.beat % BEATS_PER_BAR;
      if ((barBeat === 2 || barBeat === 6) && Math.random() > 0.25) {
        this.scheduleMelody(this.nextNoteTime, chord);
      }

      if (this.beat % CHORD_DURATION_BEATS === Math.floor(CHORD_DURATION_BEATS / 2)) {
        this.scheduleHarpGlissando(this.nextNoteTime, chord);
      }

      this.nextNoteTime += this.beatDuration;
      this.beat++;
      if (this.beat % CHORD_DURATION_BEATS === 0) {
        this.chordIndex = (this.chordIndex + 1) % CHORDS.length;
      }
    }
  }

  start() {
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.interval = window.setInterval(() => this.tick(), 100);
  }

  stop() {
    if (this.interval) {
      window.clearInterval(this.interval);
      this.interval = null;
    }
    if (this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// UI click / interaction sound engine
// ---------------------------------------------------------------------------
class ClickEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  private ensureContext() {
    if (this.ctx && this.ctx.state !== 'closed') return;
    const AC =
      (window as any).AudioContext ||
      ((window as any).webkitAudioContext as typeof AudioContext | undefined);
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const master = ctx.createGain();
    this.master = master;
    master.gain.value = 0.2;
    master.connect(ctx.destination);
    ctx.resume().catch(() => {});
  }

  play() {
    this.ensureContext();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  close() {
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
  }
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);
  const engineRef = useRef<MusicEngine | null>(null);
  const clickEngineRef = useRef<ClickEngine | null>(null);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const stopAll = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    clickEngineRef.current?.close();
    clickEngineRef.current = null;
    setPlaying(false);
    setEnabled(false);
  }, []);

  const startAll = useCallback(() => {
    try {
      const engine = new MusicEngine();
      engineRef.current = engine;
      engine.start();
      setPlaying(true);
      setEnabled(true);
    } catch {
      setPlaying(false);
      setEnabled(false);
    }
  }, []);

  const toggle = useCallback(() => {
    if (enabledRef.current) {
      stopAll();
    } else {
      startAll();
    }
  }, [startAll, stopAll]);

  const playClick = useCallback(() => {
    if (!enabledRef.current) return;
    if (!clickEngineRef.current) {
      clickEngineRef.current = new ClickEngine();
    }
    clickEngineRef.current.play();
  }, []);

  // Global click sound effect for all interactive elements (buttons, links, role=button)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive =
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.closest('button') ||
        target.closest('a') ||
        target.closest('label') ||
        target.getAttribute('role') === 'button';
      if (isInteractive) playClick();
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [playClick]);

  return (
    <MusicContext.Provider value={{ playing, enabled, toggle, playClick }}>
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic must be used inside MusicProvider');
  return ctx;
}
