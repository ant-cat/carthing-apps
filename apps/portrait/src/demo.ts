import type { LyricLine, PlayerState } from '@bridgething/client';

// fixtures for ?demo, so the layout can be previewed in a browser with no Car Thing attached

export function demoState(): PlayerState {
  return {
    track: {
      uri: 'spotify:track:demo',
      persistentId: null,
      title: 'Turning Sideways',
      album: 'Portrait Mode',
      albumUri: null,
      albumArtist: 'The Rotations',
      artist: 'The Rotations',
      artistUri: null,
      liked: true,
      artworkId: 'demo',
      durationMs: 214_000,
      mediaTypes: null,
      trackNumber: 3,
      trackCount: 11,
      isLikeSupported: true,
      isBanSupported: false,
      isBanned: false,
      chapterCount: null,
    },
    playback: {
      state: 'playing',
      positionMs: 71_000,
      positionAgeMs: 0,
      shuffle: true,
      shuffleMode: null,
      repeat: 'all',
      queueIndex: null,
      queueCount: null,
      queueChapterIndex: null,
      setElapsedTimeAvailable: true,
      queueListAvail: null,
      appleMusicRadioAd: null,
    },
    queue: [],
    options: { repeat: 'all', shuffle: true },
    context: { uri: 'spotify:playlist:demo', name: 'Late Night Drive' },
  } as unknown as PlayerState;
}

export function demoArt(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 416 416">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ff7a59"/><stop offset=".55" stop-color="#c2307a"/><stop offset="1" stop-color="#1b1f5e"/>
      </linearGradient>
    </defs>
    <rect width="416" height="416" fill="url(#g)"/>
    <rect x="148" y="88" width="120" height="240" rx="18" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="10"/>
    <circle cx="208" cy="128" r="16" fill="#fff" fill-opacity=".85"/>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function demoLyrics(): LyricLine[] {
  const words = [
    'Headlights stretching down the highway',
    'Screen turned up on its side',
    'Every song looks taller tonight',
    'Like the skyline passing by',
    '',
    'Turn it, turn it, turning sideways',
    'Hold the dial and let it ride',
    'Turn it, turn it, turning sideways',
    'Nothing fits but it feels right',
    '',
    'Mile markers counting backwards',
    'Static humming in between',
    'Lyrics scrolling like the white lines',
    'On a road we have never seen',
  ];
  return words.map((text, i) => ({ startMs: 50_000 + i * 4_200, text }));
}
