import { asJson, defineExtension, json, type ExtensionContext } from '@bridgething/extension';

const OSASCRIPT = '/usr/bin/osascript';

// one long-lived jxa loop instead of a process per poll; it prints only when the state flips.
// console.log in osascript goes to stderr.
const WATCH = `
ObjC.import('CoreGraphics');
var last = '';
while (true) {
  var now = $.CGDisplayIsAsleep($.CGMainDisplayID()) ? 'asleep' : 'awake';
  if (now !== last) { console.log(now); last = now; }
  delay(2);
}`;

type DisplayMessage = { type: 'display'; asleep: boolean | null; supported: boolean };

let child: Deno.ChildProcess | null = null;
let stopped = false;
let asleep: boolean | null = null;

function message(): DisplayMessage {
  return { type: 'display', asleep, supported: Deno.build.os === 'darwin' };
}

async function watch(ctx: ExtensionContext, onChange: (next: boolean) => void) {
  let backoff = 2_000;
  while (!stopped) {
    const started = Date.now();
    try {
      child = new Deno.Command(OSASCRIPT, {
        args: ['-l', 'JavaScript', '-e', WATCH],
        stdin: 'null',
        stdout: 'null',
        stderr: 'piped',
      }).spawn();
      const reader = child.stderr.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line === 'asleep' || line === 'awake') onChange(line === 'asleep');
          else if (line) ctx.log.warn(`display watcher: ${line}`);
        }
      }
      await child.status;
    } catch (err) {
      ctx.log.warn(`display watcher failed to start: ${String(err)}`);
    }
    child = null;
    if (stopped) return;
    // a watcher that ran a while was fine; one that dies at once gets slower retries
    backoff = Date.now() - started > 60_000 ? 2_000 : Math.min(backoff * 2, 5 * 60_000);
    await new Promise(r => setTimeout(r, backoff));
  }
}

defineExtension({
  start(ctx) {
    ctx.on('device', event => {
      if (event.type === 'active' || event.type === 'connected') event.device.send(json(message()));
    });

    ctx.on('message', (device, msg) => {
      if (asJson<{ type?: string }>(msg)?.type === 'hello') device.send(json(message()));
    });

    if (Deno.build.os !== 'darwin') {
      ctx.log.info(`display following is mac only; ${Deno.build.os} reports unsupported`);
      return;
    }

    void watch(ctx, next => {
      if (next === asleep) return;
      asleep = next;
      ctx.log.info(`display ${next ? 'asleep' : 'awake'}`);
      ctx.broadcast(json(message()));
    });
  },
  stop() {
    stopped = true;
    try {
      child?.kill('SIGTERM');
    } catch {
      // already gone
    }
  },
});
