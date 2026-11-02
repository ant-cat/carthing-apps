import { useCallback, useEffect, useRef, useState } from 'react';
import { type Device, type Rotation, useDevice } from './device';
import { Icon } from './icons';
import { Lyrics } from './Lyrics';
import { NowPlaying } from './NowPlaying';
import { useScreenSleep } from './sleep';

export type View = 'now' | 'lyrics';

const HOLD_MS = 800;
const SEEK_STEP_MS = 5_000;
const SKIP_COOLDOWN_MS = 450;

export default function App() {
  const dev = useDevice();
  const [view, setView] = useState<View>('now');
  const [toast, setToast] = useState<{ text: string; at: number } | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  useTick(250);

  const sleep = useScreenSleep({
    client: dev.client,
    playing: dev.state?.playback.state === 'playing' && !dev.stalled(),
    pausedMinutes: dev.settings.sleepWhenPaused,
    followLaptop: dev.settings.followLaptop,
    laptopAsleep: dev.desktopGone ? true : dev.laptopAsleep,
    linked: dev.linked,
  });

  const say = useCallback((text: string) => setToast({ text, at: Date.now() }), []);

  useEffect(() => {
    say('Hold back to flip orientation');
  }, [say]);

  useEffect(() => dev.wantLyrics(view === 'lyrics'), [view, dev.wantLyrics]);

  // the latest device and view, read from long-lived listeners
  const live = useRef({ dev, view, scrub, sleep });
  live.current = { dev, view, scrub, sleep };
  const lastSkip = useRef(0);

  useHardware({
    // every physical input passes here first; while the screen is dark it only wakes it
    gate: () => live.current.sleep.noteInput(),
    onKey: key => {
      const { act } = live.current.dev;
      if (key === '1') act.prev();
      else if (key === '2' || key === 'Enter') act.togglePlay();
      else if (key === '3') act.next();
      else if (key === '4') act.toggleLike();
    },
    onBack: () => setView(v => (v === 'lyrics' ? 'now' : 'lyrics')),
    onBackHold: () => {
      const next: Rotation = live.current.dev.settings.rotation === 'dial-top' ? 'dial-bottom' : 'dial-top';
      live.current.dev.setRotation(next);
      say(next === 'dial-top' ? 'Dial at the top' : 'Dial at the bottom');
    },
    onDial: raw => {
      const { dev: d } = live.current;
      const dir = (d.settings.invertDial ? -raw : raw) as 1 | -1;
      if (d.settings.dial === 'volume') d.act.volumeStep(dir);
      else if (d.settings.dial === 'skip') {
        const now = performance.now();
        if (now - lastSkip.current < SKIP_COOLDOWN_MS) return;
        lastSkip.current = now;
        if (dir > 0) d.act.next();
        else d.act.prev();
      } else {
        const dur = d.state?.track?.durationMs ?? 0;
        if (!dur) return;
        const from = live.current.scrub ?? d.position();
        setScrub(Math.max(0, Math.min(dur - 1000, from + dir * SEEK_STEP_MS)));
      }
    },
  });

  // commit a dial scrub once the dial rests
  useEffect(() => {
    if (scrub === null) return;
    const t = setTimeout(() => {
      dev.act.seek(scrub);
      setScrub(null);
    }, 450);
    return () => clearTimeout(t);
  }, [scrub, dev.act]);

  const wokeAt = useRef(0);
  const wasAsleep = useRef(false);
  if (wasAsleep.current && !sleep.asleep) wokeAt.current = performance.now();
  wasAsleep.current = sleep.asleep;

  const rotate = dev.settings.rotation === 'dial-top' ? 90 : -90;

  return (
    <div
      className="stage"
      style={{ transform: `translate(-50%, -50%) rotate(${rotate}deg)` }}
      onPointerDownCapture={e => {
        if (sleep.noteInput()) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onClickCapture={e => {
        // the tap that woke the screen must not also press whatever sits under it
        if (wokeAt.current && performance.now() - wokeAt.current < 600) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}>
      <Backdrop url={dev.artUrl} />
      {view === 'now' ? (
        <NowPlaying dev={dev} scrub={scrub} openLyrics={() => setView('lyrics')} />
      ) : (
        <Lyrics dev={dev} close={() => setView('now')} />
      )}
      <VolumeHud volume={dev.volume} />
      <Toast toast={toast} />
      {dev.conn !== 'open' && <div className="conn">{dev.conn === 'connecting' ? 'connecting…' : 'offline'}</div>}
      <div className={`sleep ${sleep.asleep ? 'on' : ''}`} aria-hidden={!sleep.asleep} />
    </div>
  );
}

function Backdrop({ url }: { url: string | null }) {
  return (
    <div className="backdrop" aria-hidden>
      {url && <img key={url} src={url} alt="" />}
    </div>
  );
}

function VolumeHud({ volume }: { volume: Device['volume'] }) {
  const visible = volume !== null && Date.now() - volume.at < 1400;
  const level = volume?.muted ? 0 : (volume?.level ?? 0);
  return (
    <div className={`volume ${visible ? 'show' : ''}`}>
      <div className="volume-track">
        <div className="volume-fill" style={{ height: `${level * 100}%` }} />
      </div>
      <Icon name={level === 0 ? 'mute' : 'volume'} size={22} />
      <span className="volume-num">{Math.round(level * 100)}</span>
    </div>
  );
}

function Toast({ toast }: { toast: { text: string; at: number } | null }) {
  const visible = toast !== null && Date.now() - toast.at < 2200;
  return <div className={`toast ${visible ? 'show' : ''}`}>{toast?.text}</div>;
}

function useTick(ms: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set(n => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

type HardwareHandlers = {
  /** returns true when the input should be swallowed */
  gate: () => boolean;
  onKey: (key: string) => void;
  onBack: () => void;
  onBackHold: () => void;
  onDial: (dir: 1 | -1) => void;
};

function useHardware(handlers: HardwareHandlers) {
  const h = useRef(handlers);
  h.current = handlers;

  useEffect(() => {
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let held = false;

    let swallowedBack = false;
    const down = (e: KeyboardEvent) => {
      if (e.repeat && swallowedBack) return;
      // m wakes the screen too, but stays unprevented so the launcher gesture still works
      if (h.current.gate()) {
        if (e.key !== 'm') e.preventDefault();
        swallowedBack = e.key === 'Escape';
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (e.repeat || holdTimer) return;
        held = false;
        holdTimer = setTimeout(() => {
          held = true;
          h.current.onBackHold();
        }, HOLD_MS);
        return;
      }
      // m stays untouched so the launcher gesture keeps working
      if (e.repeat || e.key === 'm') return;
      if (['1', '2', '3', '4', 'Enter'].includes(e.key)) {
        e.preventDefault();
        h.current.onKey(e.key);
      }
    };

    const up = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (swallowedBack) {
        swallowedBack = false;
        return;
      }
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = null;
      if (!held) h.current.onBack();
      held = false;
    };

    let lastWheel = 0;
    const wheel = (e: WheelEvent) => {
      // the rotary arrives as horizontal scroll; vertical is accepted for desktop mice
      const d = e.deltaX || e.deltaY;
      if (!d) return;
      e.preventDefault();
      const now = performance.now();
      if (now - lastWheel < 40) return; // collapse duplicate events from one detent
      lastWheel = now;
      if (h.current.gate()) return;
      h.current.onDial(d > 0 ? 1 : -1);
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('wheel', wheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('wheel', wheel);
      if (holdTimer) clearTimeout(holdTimer);
    };
  }, []);
}
