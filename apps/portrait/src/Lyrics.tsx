import { useEffect, useRef } from 'react';
import type { Device } from './device';
import { Icon } from './icons';

export function Lyrics({ dev, close }: { dev: Device; close: () => void }) {
  const { state, artUrl, lyrics } = dev;
  const track = state?.track ?? null;
  const scroller = useRef<HTMLDivElement>(null);
  const pos = dev.position();

  let current = -1;
  if (lyrics.status === 'synced') {
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (lyrics.lines[i].startMs <= pos + 250) current = i;
      else break;
    }
  }

  useEffect(() => {
    const box = scroller.current;
    const line = box?.querySelector<HTMLElement>(`[data-i="${current}"]`);
    if (!box || !line) return;
    box.scrollTo({ top: line.offsetTop - box.clientHeight * 0.36, behavior: 'smooth' });
  }, [current]);

  return (
    <div className="lyrics">
      <header className="lyrics-head">
        {artUrl ? <img src={artUrl} alt="" /> : <div className="thumb-empty" />}
        <div className="lyrics-meta">
          <div className="lyrics-title">{track?.title ?? 'Nothing playing'}</div>
          <div className="lyrics-artist">{track?.artist ?? ''}</div>
        </div>
        <button className="icon-btn" onClick={close} aria-label="Back to now playing">
          <Icon name="down" size={30} />
        </button>
      </header>

      <div className="lyrics-body" ref={scroller}>
        {lyrics.status === 'synced' && (
          <div className="lines">
            {lyrics.lines.map((l, i) => (
              <button
                key={i}
                data-i={i}
                className={`line ${i === current ? 'cur' : i < current ? 'past' : ''} ${l.text ? '' : 'gap'}`}
                onClick={() => dev.act.seek(l.startMs)}>
                {l.text || '♪'}
              </button>
            ))}
          </div>
        )}
        {lyrics.status === 'plain' && <div className="plain">{lyrics.text}</div>}
        {(lyrics.status === 'loading' || lyrics.status === 'idle') && <div className="lyrics-note">Finding lyrics…</div>}
        {lyrics.status === 'none' && <div className="lyrics-note">No lyrics for this one.</div>}
      </div>
    </div>
  );
}
