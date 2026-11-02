import { useRef, useState, type PointerEvent } from 'react';
import type { Device } from './device';
import { Icon } from './icons';

const SWIPE_PX = 56;

export function NowPlaying({ dev, scrub, openLyrics }: { dev: Device; scrub: number | null; openLyrics: () => void }) {
  const { state, artUrl, liked, act } = dev;
  const track = state?.track ?? null;
  const pb = state?.playback;
  const playing = pb?.state === 'playing';
  const dur = track?.durationMs ?? 0;
  const [drag, setDrag] = useState<number | null>(null);
  const pos = drag ?? scrub ?? dev.position();
  const canSeek = dur > 0 && pb?.setElapsedTimeAvailable !== false;

  return (
    <div className={`now ${dev.settings.rotation}`}>
      <SwipeArt
        url={artUrl}
        empty={dev.conn === 'open' ? 'Play something on your phone or Mac' : 'Waiting for the Car Thing'}
        onTap={openLyrics}
        onNext={act.next}
        onPrev={act.prev}
      />

      <div className="meta">
        <div className="meta-text">
          <div className="title">{track?.title ?? 'Nothing playing'}</div>
          <div className="artist">{track?.artist ?? 'Connect your phone or Mac in the bridgething app'}</div>
        </div>
        <button className="icon-btn meta-btn" onClick={openLyrics} aria-label="Lyrics">
          <Icon name="lyrics" size={26} />
        </button>
        {track?.isLikeSupported === true && (
          <button className={`icon-btn meta-btn like ${liked ? 'on' : ''}`} onClick={act.toggleLike} aria-label="Like">
            <Icon name={liked ? 'heartFilled' : 'heart'} size={28} />
          </button>
        )}
      </div>

      <Progress
        pos={pos}
        dur={dur}
        enabled={canSeek}
        onDrag={setDrag}
        onCommit={ms => {
          act.seek(ms);
          setDrag(null);
        }}
      />

      <div className="controls">
        <button className={`icon-btn side ${pb?.shuffle ? 'on' : ''}`} onClick={act.toggleShuffle} aria-label="Shuffle">
          <Icon name="shuffle" size={26} />
        </button>
        <button className="icon-btn skip" onClick={act.prev} aria-label="Previous">
          <Icon name="prev" size={44} />
        </button>
        <button className="play" onClick={act.togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          <Icon name={playing ? 'pause' : 'play'} size={44} />
        </button>
        <button className="icon-btn skip" onClick={act.next} aria-label="Next">
          <Icon name="next" size={44} />
        </button>
        <button
          className={`icon-btn side ${pb && pb.repeat !== 'off' ? 'on' : ''}`}
          onClick={act.cycleRepeat}
          aria-label="Repeat">
          <Icon name="repeat" size={26} />
          {pb?.repeat === 'one' && <span className="badge">1</span>}
        </button>
      </div>
    </div>
  );
}

/** album art that opens lyrics on a tap and skips tracks on a sideways swipe */
function SwipeArt(props: { url: string | null; empty: string; onTap: () => void; onNext: () => void; onPrev: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [dx, setDx] = useState(0);
  const [flick, setFlick] = useState<'next' | 'prev' | null>(null);

  // offsetX/Y are in the art's own coordinates, so a swipe reads the same at either rotation
  const at = (e: PointerEvent<HTMLDivElement>) => ({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });

  const end = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const p = at(e);
    const mx = p.x - s.x;
    const my = p.y - s.y;
    setDx(0);
    if (Math.abs(mx) >= SWIPE_PX && Math.abs(mx) > Math.abs(my) * 1.5) {
      const dir = mx < 0 ? 'next' : 'prev';
      setFlick(dir);
      setTimeout(() => setFlick(null), 260);
      if (dir === 'next') props.onNext();
      else props.onPrev();
    } else if (Math.abs(mx) < 10 && Math.abs(my) < 10) {
      props.onTap();
    }
  };

  return (
    <div
      className={`art ${flick ? `flick-${flick}` : ''}`}
      role="button"
      aria-label="Album art: tap for lyrics, swipe to skip"
      style={dx ? { transform: `translateX(${dx * 0.45}px) rotate(${dx * 0.015}deg)`, transition: 'none' } : undefined}
      onPointerDown={e => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = at(e);
      }}
      onPointerMove={e => {
        if (start.current) setDx(at(e).x - start.current.x);
      }}
      onPointerUp={end}
      onPointerCancel={() => {
        start.current = null;
        setDx(0);
      }}>
      {props.url ? (
        <img src={props.url} alt="" draggable={false} />
      ) : (
        <div className="art-empty">
          <Icon name="phone" size={56} />
          <span>{props.empty}</span>
        </div>
      )}
    </div>
  );
}

function Progress(props: {
  pos: number;
  dur: number;
  enabled: boolean;
  onDrag: (ms: number | null) => void;
  onCommit: (ms: number) => void;
}) {
  const { pos, dur, enabled } = props;
  const dragging = useRef(false);
  const frac = dur ? Math.max(0, Math.min(1, pos / dur)) : 0;

  // offsetX is in the element's own (rotated) coordinate space, so this works at any rotation
  const at = (e: PointerEvent<HTMLDivElement>) => {
    const w = e.currentTarget.offsetWidth;
    return Math.max(0, Math.min(1, e.nativeEvent.offsetX / w)) * dur;
  };

  return (
    <div className="progress">
      <div
        className={`bar ${enabled ? '' : 'disabled'}`}
        onPointerDown={e => {
          if (!enabled) return;
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          props.onDrag(at(e));
        }}
        onPointerMove={e => dragging.current && props.onDrag(at(e))}
        onPointerUp={e => {
          if (!dragging.current) return;
          dragging.current = false;
          props.onCommit(at(e));
        }}
        onPointerCancel={() => {
          dragging.current = false;
          props.onDrag(null);
        }}>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${frac * 100}%` }} />
          <div className="bar-knob" style={{ left: `${frac * 100}%` }} />
        </div>
      </div>
      <div className="times">
        <span>{fmt(pos)}</span>
        <span>{dur ? `-${fmt(dur - pos)}` : '--:--'}</span>
      </div>
    </div>
  );
}

export function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
