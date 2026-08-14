import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

interface MusicContextType {
  playing: boolean;
  toggle: () => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export function MusicProvider({ children }: { children: ReactNode }) {
  const [playing, setPlaying] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);
  const droneRef = useRef<OscillatorNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (droneRef.current) {
      try { droneRef.current.stop(); } catch { /* already stopped */ }
      droneRef.current.disconnect();
      droneRef.current = null;
    }
    if (masterGainRef.current) {
      masterGainRef.current.disconnect();
      masterGainRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
  }, []);

  const start = useCallback(() => {
    cleanup();
    const AC =
      (window as any).AudioContext || (window as any).webkitAudioContext as typeof AudioContext | undefined;
    if (!AC) return;

    const ctx = new AC();
    audioCtxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.15;
    master.connect(ctx.destination);
    masterGainRef.current = master;

    // Low space drone
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 110; // A2
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.05;
    drone.connect(droneGain);
    droneGain.connect(master);
    drone.start();
    droneRef.current = drone;

    // Procedural chiptune arpeggio
    const notes = [220, 261.63, 329.63, 392, 440, 329.63, 293.66, 220]; // A minor / pentatonic feel
    let index = 0;

    const schedule = () => {
      if (ctx.state !== 'running' || !audioCtxRef.current) return;
      const freq = notes[index % notes.length];
      index++;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.05, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + 0.2);
    };

    ctx.resume().catch(() => {});
    intervalRef.current = window.setInterval(schedule, 260);
  }, [cleanup]);

  const toggle = useCallback(() => {
    if (playing) {
      cleanup();
      setPlaying(false);
    } else {
      start();
      setPlaying(true);
    }
  }, [playing, cleanup, start]);

  return (
    <MusicContext.Provider value={{ playing, toggle }}>
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic must be used inside MusicProvider');
  return ctx;
}
