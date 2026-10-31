// the slice of the deno runtime this extension touches; the sdk ships no deno globals
declare namespace Deno {
  const build: { os: 'darwin' | 'linux' | 'windows' | string };

  interface ChildProcess {
    readonly stderr: ReadableStream<Uint8Array>;
    readonly status: Promise<{ success: boolean; code: number }>;
    kill(signal?: string): void;
  }

  class Command {
    constructor(
      cmd: string,
      options?: { args?: string[]; stdin?: 'null'; stdout?: 'null' | 'piped'; stderr?: 'null' | 'piped' },
    );
    spawn(): ChildProcess;
  }
}
