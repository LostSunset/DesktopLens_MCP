import type { CaptureEngine, WindowInfo } from '../capture/engine.js';
import { WindowNotFoundError } from '../capture/engine.js';

export interface ListWindowsOptions {
  filter?: string;
}

export interface WindowDetector {
  listWindows(options?: ListWindowsOptions): Promise<WindowInfo[]>;
  findWindow(opts: { id?: number; title?: string }): Promise<WindowInfo>;
}

export function createWindowDetector(engine: CaptureEngine): WindowDetector {
  return {
    async listWindows(options?: ListWindowsOptions): Promise<WindowInfo[]> {
      const windows = await engine.listWindows();
      if (!options?.filter) return windows;
      const lower = options.filter.toLowerCase();
      return windows.filter(
        (w) =>
          w.title.toLowerCase().includes(lower) ||
          w.appName.toLowerCase().includes(lower),
      );
    },

    async findWindow(opts: { id?: number; title?: string }): Promise<WindowInfo> {
      if (opts.id === undefined && opts.title === undefined) {
        throw new WindowNotFoundError('must provide id or title');
      }
      const windows = await engine.listWindows();
      if (opts.id !== undefined) {
        const found = windows.find((w) => w.id === opts.id);
        if (!found) throw new WindowNotFoundError(`id=${opts.id}`);
        return found;
      }
      const lower = opts.title!.toLowerCase();
      const found = windows.find((w) => w.title.toLowerCase().includes(lower));
      if (!found) throw new WindowNotFoundError(`title="${opts.title}"`);
      return found;
    },
  };
}
