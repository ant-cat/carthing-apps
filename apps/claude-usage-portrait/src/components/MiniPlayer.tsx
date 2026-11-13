import type { BridgethingClient, PlayerState } from '@bridgething/client';
import { useEffect, useState } from 'react';

function usePlayer(client: BridgethingClient) {
  const [state, setState] = useState<PlayerState | null>(null);
  const [art, setArt] = useState<string | null>(null);

  useEffect(() => {
    const off = client.player.onSnapshot(result => setState(result.state));
    client.player.stateGet().then(result => result.ok && setState(result.response.state));
    return off;
  }, [client]);

  const artworkId = state?.track?.artworkId ?? null;
  useEffect(() => {
    if (!artworkId) return setArt(null);
    let gone = false;
    let url: string | null = null;
    client.asset.get({ id: artworkId, requestId: crypto.randomUUID() }).then(result => {
      if (gone || !result.ok) return;
      const bytes = new Uint8Array(result.response.bytes as unknown as number[]);
      url = URL.createObjectURL(new Blob([bytes], { type: result.response.mime ?? 'image/jpeg' }));
      setArt(url);
    });
    return () => {
      gone = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [client, artworkId]);

  return { state, art };
}

const PATHS = {
  prev: 'M6 5h2.5v14H6zM20 5v14L9.5 12z',
  next: 'M15.5 5H18v14h-2.5zM4 5l10.5 7L4 19z',
  play: 'M7 4.5v15l13-7.5z',
  pause: 'M6 4.5h4.5v15H6zM13.5 4.5H18v15h-4.5z',
};

function Glyph({ name }: { name: keyof typeof PATHS }) {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

const BUTTON = 'flex h-14 w-14 shrink-0 items-center justify-center border border-edge text-off-white active:bg-accent active:text-screen';

export function MiniPlayer({ client }: { client: BridgethingClient }) {
  const { state, art } = usePlayer(client);
  const track = state?.track ?? null;
  const playing = state?.playback.state === 'playing';

  return (
    <div className="flex h-24 shrink-0 items-center gap-3 border border-rule bg-screen p-3">
      <div className="h-[72px] w-[72px] shrink-0 bg-neutral-soft">
        {art && <img src={art} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-row-lg tracking-tight-1">{track?.title ?? 'Nothing playing'}</div>
        <div className="truncate font-mono text-eyebrow text-dim">{track?.artist ?? 'no phone or desktop player'}</div>
      </div>
      <button className={BUTTON} aria-label="Previous" onClick={() => void client.player.skipPrev({ allowSeeking: true })}>
        <Glyph name="prev" />
      </button>
      <button
        className={BUTTON}
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={() => void (playing ? client.player.pause() : client.player.resume())}>
        <Glyph name={playing ? 'pause' : 'play'} />
      </button>
      <button className={BUTTON} aria-label="Next" onClick={() => void client.player.skipNext()}>
        <Glyph name="next" />
      </button>
    </div>
  );
}
