import { useRef, useState, type PointerEvent } from 'react';
import type { Device } from './device';
import { Icon } from './icons';

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
    <div className="now">
      <header className="now-head">
        <div className="eyebrow">{state?.context?.name ? 'Playing from' : track ? 'Now playing' : 'Portrait'}</div>
        <div className="context">{state?.context?.name ?? (track ? (track.album ?? '') : '')}</div>
      </header>

      <button className="art" onClick={openLyrics} aria-label="Show lyrics">
        {artUrl ? (
          <img src={artUrl} alt="" />
        ) : (
          <div className="art-empty">
            <Icon name="phone" size={56} />
            <span>{dev.conn === 'open' ? 'Play something on your phone' : 'Waiting for the Car Thing'}</span>
          </div>
        )}
      </button>

      <div className="meta">
        <div className="meta-text">
          <div className="title">{track?.title ?? 'Nothing playing'}</div>
          <div className="artist">{track?.artist ?? 'Connect your phone in the bridgething app'}</div>
        </div>
        {track?.isLikeSupported !== false && track && (
          <button className={`icon-btn like ${liked ? 'on' : ''}`} onClick={act.toggleLike} aria-label="Like">
            <Icon name={liked ? 'heartFilled' : 'heart'} size={30} />
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
        <button className={`icon-btn small ${pb?.shuffle ? 'on' : ''}`} onClick={act.toggleShuffle} aria-label="Shuffle">
          <Icon name="shuffle" size={26} />
        </button>
        <button className="icon-btn" onClick={act.prev} aria-label="Previous">
          <Icon name="prev" size={40} />
        </button>
        <button className="play" onClick={act.togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          <Icon name={playing ? 'pause' : 'play'} size={44} />
        </button>
        <button className="icon-btn" onClick={act.next} aria-label="Next">
          <Icon name="next" size={40} />
        </button>
        <button
          className={`icon-btn small ${pb && pb.repeat !== 'off' ? 'on' : ''}`}
          onClick={act.cycleRepeat}
          aria-label="Repeat">
          <Icon name="repeat" size={26} />
          {pb?.repeat === 'one' && <span className="badge">1</span>}
        </button>
      </div>

      <button className="lyrics-tab" onClick={openLyrics}>
        <Icon name="lyrics" size={18} />
        Lyrics
      </button>
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
