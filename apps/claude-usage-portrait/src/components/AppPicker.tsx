import type { BridgethingClient } from '@bridgething/client';
import { useEffect, useRef, useState } from 'react';

interface Entry {
  id: string;
  name: string;
  home: boolean;
}

// the launcher first, then everything else; this app is left out
export function AppPicker({
  client,
  selfName,
  index,
  onCount,
  onClose,
  pickRef,
}: {
  client: BridgethingClient;
  selfName: string;
  index: number;
  onCount: (count: number) => void;
  onClose: () => void;
  pickRef: React.MutableRefObject<(() => void) | null>;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    client.webapp.list().then(result => {
      if (!result.ok) return;
      const all = result.response.webapps
        .filter(app => app.name !== selfName)
        .map(app => ({ id: app.id, name: app.name, home: app.role === 'launcher' }));
      all.sort((a, b) => Number(b.home) - Number(a.home) || a.name.localeCompare(b.name));
      setEntries(all);
      onCount(all.length);
    });
  }, [client, selfName, onCount]);

  const at = Math.min(index, Math.max(0, entries.length - 1));
  const open = (entry: Entry | undefined) => {
    if (!entry) return;
    void client.webapp.activate({ id: entry.id });
  };
  pickRef.current = () => open(entries[at]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[data-on="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [at, entries]);

  return (
    <div className="absolute inset-0 z-20 flex flex-col gap-3 bg-bg px-5 py-4" onPointerDown={event => event.stopPropagation()}>
      <div className="flex items-center justify-between font-mono text-eyebrow text-soft">
        <span className="tracking-[0.12em] uppercase">Open an app</span>
        <button className="border border-edge px-3 py-2" onClick={onClose}>
          close
        </button>
      </div>
      <div ref={list} className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        {entries.length === 0 && <div className="font-mono text-eyebrow text-dim">no other apps installed</div>}
        {entries.map((entry, i) => (
          <button
            key={entry.id}
            data-on={i === at}
            onClick={() => open(entry)}
            className={`flex h-16 shrink-0 items-center justify-between border px-4 text-left font-display text-row-lg ${
              i === at ? 'border-accent bg-accent text-screen' : 'border-rule bg-screen text-off-white'
            }`}>
            <span className="truncate">{entry.name}</span>
            {entry.home && <span className="font-mono text-eyebrow opacity-70">home</span>}
          </button>
        ))}
      </div>
      <div className="font-mono text-hint text-dim">dial to choose, click to open, front button to close</div>
    </div>
  );
}
