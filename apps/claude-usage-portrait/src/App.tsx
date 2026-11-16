import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { Mascot, moodFor } from './components/Mascot';
import { AppPicker } from './components/AppPicker';
import { MiniPlayer, togglePlayback, usePlayer } from './components/MiniPlayer';
import { PromptModal, type Choice } from './components/Prompt';
import { useLink, useNow } from './link';
import { AmbientScreen } from './screens/Ambient';
import { MachineScreen } from './screens/Machine';
import { SessionsScreen } from './screens/Sessions';
import { UsageScreen } from './screens/Usage';

const SCREENS = ['usage', 'machine', 'sessions', 'ambient'] as const;
type Screen = (typeof SCREENS)[number];

const CARD_STRIDE = 488 + 12;
const ROW_STRIDE = 104;
// the mini player takes the bottom 128px plus a gap when it shows; with the dial at the bottom the wheel covers 40px more
const LIST_HEIGHT = 700;
const PLAYER_SPACE = 140;
const DIAL_COVER = 40;
// one dial turn often fires a burst of wheel events, so page flips are spaced out
const FLIP_GAP_MS = 260;
const IDLE_TO_AMBIENT_MS = 90_000;
const PRESENCE_EVERY_MS = 20_000;

function useScroll(screen: Screen, max: number): [number, (delta: number) => void] {
  const [scroll, setScroll] = useState(0);
  useEffect(() => setScroll(0), [screen]);
  const nudge = useCallback((delta: number) => setScroll(at => Math.max(0, Math.min(max, at + delta))), [max]);
  useEffect(() => setScroll(at => Math.min(at, Math.max(0, max))), [max]);
  return [scroll, nudge];
}

function PageDots({ current, onPick }: { current: Screen; onPick: (screen: Screen) => void }) {
  return (
    <nav className="-mx-1.5 flex items-center">
      {SCREENS.map(name => (
        <button key={name} aria-label={name} onClick={() => onPick(name)} className="flex h-4 items-center px-1.5">
          <span className={`h-1.5 transition-all ${current === name ? 'w-4 bg-accent' : 'w-1.5 bg-edge'}`} />
        </button>
      ))}
    </nav>
  );
}

interface Status {
  word: string;
  dot: string;
  pulse?: boolean;
}

// one word for the whole link, most urgent first
function statusFor(at: { waiting: number; hasHost: boolean; hookDown: boolean; reading: boolean; stale: boolean }): Status {
  if (at.waiting > 0) return { word: `${at.waiting} waiting`, dot: 'bg-warn', pulse: true };
  if (!at.hasHost) return { word: 'offline', dot: 'bg-dim' };
  if (at.hookDown) return { word: 'hook off', dot: 'bg-warn' };
  if (at.reading) return { word: 'reading', dot: 'bg-accent', pulse: true };
  if (at.stale) return { word: 'stale', dot: 'bg-dim' };
  return { word: 'live', dot: 'bg-ok' };
}

export default function App() {
  const link = useLink();
  const now = useNow(link.offsetMs);
  const [screen, setScreen] = useState<Screen | null>(null);
  const [choice, setChoice] = useState<Choice>('allow');
  const lastTouch = useRef(Date.now());
  const lastPresent = useRef(0);
  const [picker, setPicker] = useState<{ open: boolean; index: number; count: number }>({ open: false, index: 0, count: 0 });
  const pick = useRef<(() => void) | null>(null);
  const onCount = useCallback((count: number) => setPicker(at => ({ ...at, count })), []);
  const closePicker = useCallback(() => setPicker(at => ({ ...at, open: false })), []);

  const home = (SCREENS as readonly string[]).includes(link.config.home ?? '') ? (link.config.home as Screen) : 'usage';
  const ambientIdle = link.config.ambientIdle !== 'false';
  const current = screen ?? home;
  const prompt = link.prompts[0] ?? null;
  const flipped = link.config.rotation === 'dial-bottom';
  const dialSign = (link.config.invertDial === 'true') !== flipped ? -1 : 1;

  const player = usePlayer(link.client);
  const listHeight = LIST_HEIGHT - (flipped ? DIAL_COVER : 0) - (player.visible ? PLAYER_SPACE : 0);
  const scrollMax =
    current === 'usage'
      ? Math.max(0, link.accounts.length * CARD_STRIDE - 12 - listHeight)
      : current === 'sessions'
        ? Math.max(0, link.sessions.length * ROW_STRIDE - 8 - listHeight)
        : 0;
  const [scroll, nudge] = useScroll(current, scrollMax);
  const lastFlip = useRef(0);

  const touched = useCallback(() => {
    lastTouch.current = Date.now();
    if (Date.now() - lastPresent.current < PRESENCE_EVERY_MS) return;
    lastPresent.current = Date.now();
    link.present();
  }, [link]);

  const go = useCallback(
    (next: Screen) => {
      touched();
      setScreen(next);
    },
    [touched],
  );

  useEffect(() => setChoice('allow'), [prompt?.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      touched();
      if (prompt) {
        if (event.key === '1') return setChoice('allow');
        if (event.key === '2') return setChoice('deny');
        if (event.key === 'Enter' || event.key === 'm') return link.answer(prompt.id, choice);
        if (event.key === 'Escape') return setChoice(at => (at === 'allow' ? 'deny' : 'allow'));
        return;
      }
      if (picker.open) {
        if (event.key === 'Escape' || event.key === 'm') return closePicker();
        if (event.key === 'Enter') return pick.current?.();
        return;
      }
      const preset = SCREENS[Number(event.key) - 1];
      if (preset) return setScreen(preset);
      if (event.key === 'm') return setScreen(at => SCREENS[(SCREENS.indexOf(at ?? home) + 1) % SCREENS.length]!);
      if (event.key === 'Escape') return setPicker({ open: true, index: 0, count: picker.count });
      if (event.key === 'Enter') return togglePlayback(link.client, player.playing);
      if (event.key === 'r') link.refresh();
    };
    const onWheel = (event: WheelEvent) => {
      touched();
      const dx = event.deltaX * dialSign;
      if (picker.open && !prompt) {
        return setPicker(at => ({ ...at, index: Math.max(0, Math.min(at.count - 1, at.index + (dx > 0 ? 1 : dx < 0 ? -1 : 0))) }));
      }
      if (prompt) return setChoice(dx > 0 ? 'deny' : 'allow');
      if (dx === 0) return;
      if (current === 'ambient') return setScreen(home);
      // the dial scrolls a long list first and turns the page once it hits the end
      const atEdge = dx > 0 ? scroll >= scrollMax : scroll <= 0;
      if (!atEdge) return nudge(dx * (current === 'usage' ? 1.6 : 1.1));
      if (Date.now() - lastFlip.current < FLIP_GAP_MS) return;
      lastFlip.current = Date.now();
      const step = dx > 0 ? 1 : -1;
      setScreen(at => SCREENS[(SCREENS.indexOf(at ?? home) + step + SCREENS.length) % SCREENS.length]!);
    };
    const onPointer = () => touched();

    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [choice, closePicker, current, dialSign, home, link, nudge, picker, player.playing, prompt, scroll, scrollMax, touched]);

  useEffect(() => {
    if (!ambientIdle) return;
    const timer = setInterval(() => {
      if (Date.now() - lastTouch.current > IDLE_TO_AMBIENT_MS) setScreen('ambient');
    }, 5_000);
    return () => clearInterval(timer);
  }, [ambientIdle]);

  const worst = useMemo(() => {
    const active = link.accounts.flatMap(account => account.limits.filter(limit => limit.isActive));
    return active.length > 0 ? Math.max(...active.map(limit => limit.percent)) : null;
  }, [link.accounts]);

  const waiting = link.sessions.filter(session => session.status === 'waiting').length;
  const status = statusFor({
    waiting,
    hasHost: link.hasExtension,
    hookDown: Boolean(link.hook?.enabled && !link.hook.listening),
    reading: link.polling,
    stale: link.accounts.some(account => account.stale !== null),
  });

  const stage = (children: ReactNode) => (
    <div className="stage" style={{ transform: `translate(-50%, -50%) rotate(${flipped ? -90 : 90}deg)` }}>
      {children}
    </div>
  );

  if (current === 'ambient' && !prompt) {
    return stage(
      <main className="h-full w-full bg-bg p-6 text-off-white" onPointerDown={() => go('usage')}>
        <AmbientScreen accounts={link.accounts} sessions={link.sessions} now={now} />
      </main>,
    );
  }

  return stage(
    <main
      className="relative flex h-full w-full flex-col bg-bg px-5 pt-4 text-off-white"
      style={{ paddingBottom: flipped ? 16 + DIAL_COVER : 16 }}>
      <header className="flex h-11 shrink-0 items-center gap-3 mb-3">
        <Mascot mood={moodFor(worst)} size={44} />
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-eyebrow tracking-[0.16em] text-soft uppercase">{current}</span>
          <PageDots current={current} onPick={go} />
        </div>
        <span className="ml-auto flex items-center gap-2 font-mono text-eyebrow text-soft">
          <span className={`h-2 w-2 rounded-full ${status.dot} ${status.pulse ? 'pulse-soft' : ''}`} />
          {status.word}
        </span>
      </header>

      <div className="min-h-0 flex-1">
        {current === 'usage' && (
          <UsageScreen accounts={link.accounts} now={now} scroll={scroll} hasHost={link.hasExtension} />
        )}
        {current === 'machine' && <MachineScreen machine={link.machine} hasHost={link.hasExtension} />}
        {current === 'sessions' && (
          <SessionsScreen sessions={link.sessions} now={now} scroll={scroll} hasHost={link.hasExtension} />
        )}
        {current === 'ambient' && <AmbientScreen accounts={link.accounts} sessions={link.sessions} now={now} />}
      </div>

      {player.visible && (
        <div className="shrink-0 pt-3">
          <MiniPlayer client={link.client} player={player} />
        </div>
      )}

      {picker.open && !prompt && (
        <AppPicker
          client={link.client}
          selfName="Claude Usage Portrait"
          index={picker.index}
          onCount={onCount}
          onClose={closePicker}
          pickRef={pick}
        />
      )}

      {prompt && (
        <PromptModal
          prompt={prompt}
          queued={link.prompts.length}
          now={now}
          choice={choice}
          onChoose={setChoice}
          onAnswer={decision => link.answer(prompt.id, decision)}
        />
      )}
    </main>,
  );
}
