import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';

interface MusicContextType {
  playing: boolean;
  enabled: boolean;
  toggle: () => void;
  musicVolume: number;
  effectsVolume: number;
  setMusicVolume: (v: number) => void;
  setEffectsVolume: (v: number) => void;
  playClick: () => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

const MUSIC_BASE_VOLUME = 0.55;
const EFFECTS_BASE_VOLUME = 0.2;
const MIN_AUDIBLE = 0.02;

// ---------------------------------------------------------------------------
// Cinematic ambient music engine
// ---------------------------------------------------------------------------
// Inspired by a slow Hans Zimmer-style pad progression: Am7 → Fmaj7 → Cmaj7 → G6
// at a relaxed tempo, with layered drones, long chord pads, and a sparse melody.

interface ChordVoicing {
  name: string;
  notes: number[];
  bass: number;
}

const CHORDS: ChordVoicing[] = [
  { name: 'Am7', notes: [220.0, 261.63, 329.63, 392.0], bass: 55.0 },
  { name: 'Fmaj7', notes: [174.61, 220.0, 261.63, 329.63], bass: 43.65 },
  { name: 'Cmaj7', notes: [261.63, 329.63, 392.0, 493.88], bass: 65.41 },
  { name: 'G6', notes: [196.0, 246.94, 293.66, 392.0], bass: 49.0 },
];

const TEMPO = 66;
const BEATS_PER_BAR = 4;
const BARS_PER_CHORD = 4;
const CHORD_DURATION_BEATS = BEATS_PER_BAR * BARS_PER_CHORD;

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
  private chordDuration = CHORD_DURATION_BEATS * (60 / TEMPO);
  private running = false;

  constructor() {
    const AC =
      (window as any).AudioContext ||
      ((window as any).webkitAudioContext as typeof AudioContext | undefined);
    if (!AC) throw new Error('Web Audio not supported');

    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);

    this.delay = this.ctx.createDelay();
    this.delay.delayTime.value = 0.55;
    this.delayGain = this.ctx.createGain();
    this.delayGain.gain.value = 0.3;
    this.delay.connect(this.delayGain);
    this.delayGain.connect(this.master);
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

  setVolume(volume: number) {
    const clamped = Math.max(0, Math.min(1, volume));
    const value = clamped * MUSIC_BASE_VOLUME;
    if (this.ctx.state === 'running') {
      const now = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(value, now, 0.05);
    } else {
      this.master.gain.value = value;
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.ctx.resume().catch(() => {});
    this.interval = window.setInterval(() => this.tick(), 100);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.interval) {
      window.clearInterval(this.interval);
      this.interval = null;
    }
    this.ctx.suspend().catch(() => {});
  }

  resume() {
    this.ctx.resume().catch(() => {});
  }

  suspend() {
    this.ctx.suspend().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// UI click / interaction sound engine
// ---------------------------------------------------------------------------
class ClickEngine {
  private ctx: AudioContext;
  private master: GainNode;

  constructor() {
    const AC =
      (window as any).AudioContext ||
      ((window as any).webkitAudioContext as typeof AudioContext | undefined);
    if (!AC) throw new Error('Web Audio not supported');

    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
  }

  setVolume(volume: number) {
    const clamped = Math.max(0, Math.min(1, volume));
    const value = clamped * EFFECTS_BASE_VOLUME;
    if (this.ctx.state === 'running') {
      const now = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(value, now, 0.05);
    } else {
      this.master.gain.value = value;
    }
  }

  play() {
    this.ctx.resume().catch(() => {});
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  suspend() {
    this.ctx.suspend().catch(() => {});
  }

  resume() {
    this.ctx.resume().catch(() => {});
  }
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [musicVolume, setMusicVolumeState] = useState(0.55);
  const [effectsVolume, setEffectsVolumeState] = useState(0.5);
  const engineRef = useRef<MusicEngine | null>(null);
  const clickEngineRef = useRef<ClickEngine | null>(null);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const ensureEngines = useCallback(() => {
    if (!engineRef.current) {
      try {
        engineRef.current = new MusicEngine();
      } catch {
        return false;
      }
    }
    if (!clickEngineRef.current) {
      try {
        clickEngineRef.current = new ClickEngine();
      } catch {
        return false;
      }
    }
    engineRef.current.setVolume(musicVolume);
    clickEngineRef.current.setVolume(effectsVolume);
    return true;
  }, [musicVolume, effectsVolume]);

  const stopAll = useCallback(() => {
    engineRef.current?.stop();
    clickEngineRef.current?.suspend();
    setPlaying(false);
    setEnabled(false);
  }, []);

  const startAll = useCallback(() => {
    if (!ensureEngines()) return;
    engineRef.current?.start();
    clickEngineRef.current?.resume();
    setPlaying(true);
    setEnabled(true);
  }, [ensureEngines]);

  const toggle = useCallback(() => {
    if (enabledRef.current) {
      stopAll();
    } else {
      startAll();
    }
  }, [startAll, stopAll]);

  const setMusicVolume = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setMusicVolumeState(clamped);
    engineRef.current?.setVolume(clamped);
  }, []);

  const setEffectsVolume = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setEffectsVolumeState(clamped);
    clickEngineRef.current?.setVolume(clamped);
  }, []);

  const playClick = useCallback(() => {
    if (!enabledRef.current || effectsVolume < MIN_AUDIBLE) return;
    if (!clickEngineRef.current) {
      try {
        clickEngineRef.current = new ClickEngine();
      } catch {
        return;
      }
    }
    clickEngineRef.current.setVolume(effectsVolume);
    clickEngineRef.current.resume();
    clickEngineRef.current.play();
  }, [effectsVolume]);

  // Global click sound effect for all interactive elements (buttons, links, role=button).
  // Sliders and the sound mixer are ignored so adjusting volume does not spam clicks.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-sound-ignore]')) return;
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range') return;
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
    <MusicContext.Provider
      value={{
        playing,
        enabled,
        toggle,
        musicVolume,
        effectsVolume,
        setMusicVolume,
        setEffectsVolume,
        playClick,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic must be used inside MusicProvider');
  return ctx;
}
