import type { BridgethingClient, BrightnessMode } from '@bridgething/client';
import { useCallback, useEffect, useRef, useState } from 'react';

// the daemon persists brightness, so a dark screen must always leave a restore point behind
const RESTORE_KEY = 'restore-brightness';
const LINK_GRACE_MS = 20_000;

type Restore = { mode: BrightnessMode; level: number };

export type SleepInputs = {
  client: BridgethingClient | null;
  playing: boolean;
  /** minutes paused before the screen goes dark, or null for never */
  pausedMinutes: number | null;
  followLaptop: boolean;
  /** true while the mac's display sleeps, null when nobody reports it */
  laptopAsleep: boolean | null;
  /** companions (phone or desktop) with a live link, null until the first peer snapshot */
  linked: number | null;
};

export function useScreenSleep(input: SleepInputs) {
  const { client, playing, pausedMinutes, followLaptop, laptopAsleep, linked } = input;
  const [asleep, setAsleep] = useState(false);
  const asleepRef = useRef(false);
  const restore = useRef<Restore | null>(null);
  const [lastInput, setLastInput] = useState(() => Date.now());

  const darken = useCallback(async () => {
    if (asleepRef.current) return;
    asleepRef.current = true;
    setAsleep(true);
    if (!client) return;
    const now = await client.hardware.stateGet();
    if (now.ok && !restore.current) {
      const b = now.response.state.brightness;
      restore.current = { mode: b.mode, level: b.level };
      await client.store.put({ key: RESTORE_KEY, value: JSON.stringify(restore.current) });
    }
    // never zero the backlight without a way back; the black overlay alone covers that case.
    // still asleep after the awaits? a fast wake must not be undone
    if (!restore.current || !asleepRef.current) return;
    await client.hardware.displaySetMode({ mode: 'manual' });
    await client.hardware.displaySetLevel({ level: 0 });
  }, [client]);

  const brighten = useCallback(async () => {
    asleepRef.current = false;
    setAsleep(false);
    if (!client) return;
    let r = restore.current;
    if (!r) {
      const saved = await client.store.get({ key: RESTORE_KEY });
      if (saved.ok && saved.response.value) r = parse(saved.response.value);
    }
    // nothing to restore, or something darkened the screen again during the awaits
    if (!r || asleepRef.current) return;
    // set the level first so auto mode keeps the user's manual preference underneath
    await client.hardware.displaySetLevel({ level: r.level });
    await client.hardware.displaySetMode({ mode: r.mode });
    restore.current = null;
    await client.store.delete({ key: RESTORE_KEY });
  }, [client]);

  // a crash or reload while dark leaves the restore point behind; put the screen back on launch
  useEffect(() => {
    void brighten();
    const off = () => {
      if (asleepRef.current) void brighten();
    };
    window.addEventListener('pagehide', off);
    return () => window.removeEventListener('pagehide', off);
  }, [brighten]);

  // paused for long enough
  useEffect(() => {
    if (playing) {
      if (asleepRef.current) void brighten();
      return;
    }
    if (pausedMinutes === null) return;
    const t = setTimeout(() => void darken(), pausedMinutes * 60_000);
    return () => clearTimeout(t);
  }, [playing, pausedMinutes, lastInput, darken, brighten]);

  // the mac's display, reacting only to changes so a manual wake sticks until the next one
  const prevLaptop = useRef(laptopAsleep);
  useEffect(() => {
    const prev = prevLaptop.current;
    prevLaptop.current = laptopAsleep;
    if (!followLaptop || laptopAsleep === null || prev === laptopAsleep) return;
    if (laptopAsleep) void darken();
    else void brighten();
  }, [laptopAsleep, followLaptop, darken, brighten]);

  // every companion gone (laptop asleep or lid shut, phone away), with a grace for blips
  const prevLinked = useRef(linked);
  useEffect(() => {
    const prev = prevLinked.current;
    prevLinked.current = linked;
    if (!followLaptop || linked === null || prev === null) return;
    if (linked > 0 && prev === 0) {
      void brighten();
      return;
    }
    if (linked === 0 && prev > 0) {
      const t = setTimeout(() => void darken(), LINK_GRACE_MS);
      return () => clearTimeout(t);
    }
  }, [linked, followLaptop, darken, brighten]);

  /** call on every touch, key or dial turn; returns true when it woke the screen and the input should be eaten */
  const noteInput = useCallback(() => {
    setLastInput(Date.now());
    if (!asleepRef.current) return false;
    void brighten();
    return true;
  }, [brighten]);

  return { asleep, noteInput, sleepNow: darken };
}

function parse(raw: string): Restore | null {
  try {
    const v = JSON.parse(raw) as Partial<Restore>;
    if ((v.mode === 'auto' || v.mode === 'manual') && typeof v.level === 'number') return { mode: v.mode, level: v.level };
  } catch {
    // ignore a mangled restore point
  }
  return null;
}
