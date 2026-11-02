import {
  BridgethingClient,
  type ConnectionState,
  type LyricLine,
  type PlayerState,
  type RepeatMode,
} from '@bridgething/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { daemonUrl } from './daemon';
import { demoArt, demoLyrics, demoState } from './demo';

export type Rotation = 'dial-top' | 'dial-bottom';
export type DialMode = 'volume' | 'seek' | 'skip';

export type Settings = {
  rotation: Rotation;
  dial: DialMode;
  invertDial: boolean;
  /** minutes, or null for never */
  sleepWhenPaused: number | null;
  followLaptop: boolean;
};

export type LyricsData =
  | { status: 'idle' | 'loading' | 'none' }
  | { status: 'synced'; lines: LyricLine[] }
  | { status: 'plain'; text: string };

export type Device = {
  client: BridgethingClient | null;
  conn: ConnectionState;
  /** true while the mac's display sleeps, null when the desktop add-on is not reporting */
  laptopAsleep: boolean | null;
  /** companions with a live link, null until the daemon reports peers */
  linked: number | null;
  /** the desktop add-on was heard from and then went quiet, which is what a sleeping mac looks like */
  desktopGone: boolean;
  /** playing per the last snapshot, but the track should have ended long ago with no word since */
  stalled: () => boolean;
  state: PlayerState | null;
  artUrl: string | null;
  liked: boolean;
  volume: { level: number; muted: boolean; at: number } | null;
  settings: Settings;
  lyrics: LyricsData;
  /** playhead in ms, extrapolated between snapshots */
  position: () => number;
  wantLyrics: (on: boolean) => void;
  setRotation: (r: Rotation) => void;
  act: Actions;
};

export type Actions = {
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (ms: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleLike: () => void;
  volumeStep: (dir: 1 | -1) => void;
};

const DEFAULTS: Settings = { rotation: 'dial-top', dial: 'volume', invertDial: false, sleepWhenPaused: 5, followLaptop: true };
const DESKTOP_SILENCE_MS = 20_000;
// a track that should have ended this long ago with no new snapshot means the source went quiet
const STALL_MS = 30_000;
const REPEAT_NEXT: Record<RepeatMode, RepeatMode> = { off: 'all', all: 'one', one: 'off' };

export const isDemo = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo');

function applySetting(s: Settings, key: string, value: string | null): Settings {
  if (key === 'rotation' && (value === 'dial-top' || value === 'dial-bottom')) return { ...s, rotation: value };
  if (key === 'dial' && (value === 'volume' || value === 'seek' || value === 'skip')) return { ...s, dial: value };
  if (key === 'invertDial') return { ...s, invertDial: value === 'true' };
  if (key === 'sleepWhenPaused') {
    const n = Number(value);
    return { ...s, sleepWhenPaused: value === 'off' ? null : n > 0 ? n : DEFAULTS.sleepWhenPaused };
  }
  if (key === 'followLaptop') return { ...s, followLaptop: value !== 'false' };
  return s;
}

export function useDevice(): Device {
  const client = useMemo(() => (isDemo ? null : new BridgethingClient({ url: daemonUrl() })), []);
  const [conn, setConn] = useState<ConnectionState>(client?.connectionState ?? 'open');
  const [state, setState] = useState<PlayerState | null>(isDemo ? demoState() : null);
  const [artUrl, setArtUrl] = useState<string | null>(isDemo ? demoArt() : null);
  const [liked, setLiked] = useState(false);
  const [volume, setVolume] = useState<Device['volume']>(null);
  const [settings, setSettings] = useState<Settings>(() => {
    if (!isDemo) return DEFAULTS;
    const q = new URLSearchParams(location.search);
    let s = applySetting(DEFAULTS, 'rotation', q.get('rotation'));
    // fractional minutes are allowed here so the paused timer can be exercised quickly
    if (q.has('sleep')) s = { ...s, sleepWhenPaused: q.get('sleep') === 'off' ? null : Number(q.get('sleep')) };
    return s;
  });
  const [lyrics, setLyrics] = useState<LyricsData>({ status: 'idle' });
  const [lyricsWanted, setLyricsWanted] = useState(false);
  const [laptopAsleep, setLaptopAsleep] = useState<boolean | null>(null);
  const [linked, setLinked] = useState<number | null>(null);
  const lastBeat = useRef<number | null>(null);
  const [desktopGone, setDesktopGone] = useState(false);
  const receivedAt = useRef(performance.now());
  const demoVolume = useRef(0.6);

  // snapshot bookkeeping for playhead extrapolation
  const setPlayer = useCallback((s: PlayerState) => {
    receivedAt.current = performance.now() - (s.playback.positionAgeMs ?? 0);
    setState(s);
    setLiked(Boolean(s.track?.liked));
  }, []);

  useEffect(() => {
    if (!client) {
      receivedAt.current = performance.now();
      setLiked(Boolean(state?.track?.liked));
      return;
    }
    const offs = [
      client.on(e => {
        if (e.type !== 'message') setConn(client.connectionState);
      }),
      client.player.onSnapshot(r => setPlayer(r.state)),
      client.audio.onVolumeChanged(v => setVolume({ ...v, at: Date.now() })),
      client.config.onChanged(c => {
        setSettings(s => applySetting(s, c.key, c.value));
        // a companion edit wins over an on-device flip
        if (c.key === 'rotation') void client.store.delete({ key: 'rotation' });
      }),
      client.forward.onJson(raw => {
        const m = raw as { type?: string; asleep?: unknown; supported?: unknown };
        if (m?.type !== 'display') return;
        lastBeat.current = Date.now();
        setDesktopGone(false);
        setLaptopAsleep(m.supported && typeof m.asleep === 'boolean' ? m.asleep : null);
      }),
      client.peer.onSnapshot(peers => {
        setLinked(Object.values(peers).filter(p => p.companion.type === 'connected').length);
      }),
      client.library.onFavoriteChanged(f => {
        setState(s => {
          if (s?.track?.uri === f.uri) setLiked(f.liked);
          return s;
        });
      }),
    ];
    // rotation flipped on the device itself is kept in the store and takes precedence
    (async () => {
      let next = DEFAULTS;
      const all = await client.config.list();
      if (all.ok) for (const e of all.response.entries) next = applySetting(next, e.key, e.value);
      const flipped = await client.store.get({ key: 'rotation' });
      if (flipped.ok && flipped.response.value) next = applySetting(next, 'rotation', flipped.response.value);
      setSettings(next);
    })();
    client.player.stateGet().then(r => r.ok && setPlayer(r.response.state));
    // ask the desktop add-on, if there is one, for the display state; silence just means no add-on
    void client.forward.json({ type: 'hello' }).catch(() => {});
    return () => offs.forEach(off => off());
  }, [client, setPlayer]);

  // artwork
  const artworkId = state?.track?.artworkId ?? null;
  useEffect(() => {
    if (!client) return;
    if (!artworkId) return setArtUrl(null);
    let gone = false;
    let url: string | null = null;
    client.asset.get({ id: artworkId, requestId: crypto.randomUUID() }).then(res => {
      if (gone || !res.ok) return;
      const bytes = new Uint8Array(res.response.bytes as unknown as number[]);
      url = URL.createObjectURL(new Blob([bytes], { type: res.response.mime ?? 'image/jpeg' }));
      setArtUrl(url);
    });
    return () => {
      gone = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [client, artworkId]);

  // lyrics, fetched only while the lyrics view is open
  const trackUri = state?.track?.uri ?? null;
  const trackKey = trackUri ?? state?.track?.title ?? null;
  useEffect(() => {
    if (!lyricsWanted || !trackKey) return;
    if (!client) {
      setLyrics({ status: 'synced', lines: demoLyrics() });
      return;
    }
    let gone = false;
    setLyrics({ status: 'loading' });
    client.lyrics.get({ timeoutMs: 8000 }).then(res => {
      if (gone) return;
      if (!res.ok || !res.response.lyrics) return setLyrics({ status: 'none' });
      if (trackUri && res.response.trackUri && res.response.trackUri !== trackUri) return;
      const { synced, plain } = res.response.lyrics;
      if (synced?.length) setLyrics({ status: 'synced', lines: synced });
      else if (plain) setLyrics({ status: 'plain', text: plain });
      else setLyrics({ status: 'none' });
    });
    return () => {
      gone = true;
    };
  }, [client, lyricsWanted, trackKey, trackUri]);

  // the add-on beats every 5s; three missed beats and a bit means the mac is asleep or gone
  useEffect(() => {
    const t = setInterval(() => {
      if (lastBeat.current !== null && Date.now() - lastBeat.current > DESKTOP_SILENCE_MS) setDesktopGone(true);
    }, 2_000);
    return () => clearInterval(t);
  }, []);

  // demo hooks so the screen-off triggers can be driven from devtools or a test
  useEffect(() => {
    if (!isDemo) return;
    const beat = (asleep: boolean | null = false) => {
      lastBeat.current = Date.now();
      setDesktopGone(false);
      setLaptopAsleep(asleep);
    };
    (window as unknown as { __portrait: unknown }).__portrait = { setLaptopAsleep, setLinked, beat };
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;

  const stalled = useCallback(() => {
    const s = stateRef.current;
    const dur = s?.track?.durationMs ?? 0;
    if (!s || s.playback.state !== 'playing' || dur <= 0) return false;
    const overrun = s.playback.positionMs + (performance.now() - receivedAt.current) - dur;
    return overrun > STALL_MS;
  }, []);

  const position = useCallback(() => {
    const s = stateRef.current;
    if (!s) return 0;
    const dur = s.track?.durationMs ?? Infinity;
    const base = s.playback.positionMs;
    if (s.playback.state !== 'playing') return Math.min(base, dur);
    return Math.min(base + (performance.now() - receivedAt.current), dur);
  }, []);

  // demo mode mutates local state so every control still does something visible
  const patchDemo = useCallback(
    (fn: (s: PlayerState) => PlayerState) =>
      setState(s => {
        if (!s) return s;
        const pos = position();
        receivedAt.current = performance.now();
        return fn({ ...s, playback: { ...s.playback, positionMs: pos } });
      }),
    [position],
  );

  const act = useMemo<Actions>(() => {
    if (!client) {
      return {
        togglePlay: () =>
          patchDemo(s => ({
            ...s,
            playback: { ...s.playback, state: s.playback.state === 'playing' ? 'paused' : 'playing' },
          })),
        next: () => patchDemo(s => ({ ...s, playback: { ...s.playback, positionMs: 0 } })),
        prev: () => patchDemo(s => ({ ...s, playback: { ...s.playback, positionMs: 0 } })),
        seek: ms => patchDemo(s => ({ ...s, playback: { ...s.playback, positionMs: ms } })),
        toggleShuffle: () => patchDemo(s => ({ ...s, playback: { ...s.playback, shuffle: !s.playback.shuffle } })),
        cycleRepeat: () => patchDemo(s => ({ ...s, playback: { ...s.playback, repeat: REPEAT_NEXT[s.playback.repeat] } })),
        toggleLike: () => setLiked(l => !l),
        volumeStep: dir => {
          demoVolume.current = Math.max(0, Math.min(1, demoVolume.current + dir * 0.0625));
          setVolume({ level: demoVolume.current, muted: false, at: Date.now() });
        },
      };
    }
    return {
      togglePlay: () => {
        const s = stateRef.current;
        void (s?.playback.state === 'playing' ? client.player.pause() : client.player.resume());
      },
      next: () => void client.player.skipNext(),
      prev: () => void client.player.skipPrev({ allowSeeking: true }),
      seek: ms => void client.player.seekTo({ positionMs: Math.max(0, Math.round(ms)) }),
      toggleShuffle: () => void client.player.setShuffle({ on: !stateRef.current?.playback.shuffle }),
      cycleRepeat: () => {
        const cur = stateRef.current?.playback.repeat ?? 'off';
        void client.player.setRepeat({ mode: REPEAT_NEXT[cur] });
      },
      toggleLike: () => {
        const t = stateRef.current?.track;
        if (!t?.uri) return;
        setLiked(l => !l); // optimistic; onFavoriteChanged corrects it
        void client.library.favoritesToggle({ item: { uri: t.uri, kind: 'track', persistentId: t.persistentId } });
      },
      volumeStep: dir => void (dir > 0 ? client.audio.volumeUp() : client.audio.volumeDown()),
    };
  }, [client, patchDemo]);

  const setRotation = useCallback(
    (r: Rotation) => {
      setSettings(s => ({ ...s, rotation: r }));
      if (client) void client.store.put({ key: 'rotation', value: r });
    },
    [client],
  );

  return {
    client,
    laptopAsleep,
    linked,
    desktopGone,
    stalled,
    conn,
    state,
    artUrl,
    liked,
    volume,
    settings,
    lyrics,
    position,
    wantLyrics: setLyricsWanted,
    setRotation,
    act,
  };
}
