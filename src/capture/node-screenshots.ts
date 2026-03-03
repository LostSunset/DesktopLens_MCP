import {
  type CaptureEngine,
  type WindowInfo,
  WindowNotFoundError,
  CaptureFailedError,
} from './engine.js';

interface NativeWindow {
  id: number;
  title: string;
  appName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
  captureImage(): Buffer;
}

interface NodeScreenshotsModule {
  Monitor: {
    all(): Array<{ id: number; captureImage(): Buffer }>;
  };
  Window: {
    all(): NativeWindow[];
  };
}

let _nodeScreenshots: NodeScreenshotsModule | undefined;

async function getNodeScreenshots(): Promise<NodeScreenshotsModule> {
  if (!_nodeScreenshots) {
    _nodeScreenshots = (await import('node-screenshots')) as unknown as NodeScreenshotsModule;
  }
  return _nodeScreenshots;
}

/** 用於測試時注入 mock */
export function _setNodeScreenshots(mod: NodeScreenshotsModule | undefined): void {
  _nodeScreenshots = mod;
}

export class NodeScreenshotsCaptureEngine implements CaptureEngine {
  readonly available = true;

  async listWindows(): Promise<WindowInfo[]> {
    const ns = await getNodeScreenshots();
    const windows = ns.Window.all();
    return windows
      .filter((w) => w.title.length > 0 && !w.isMinimized)
      .map((w) => ({
        id: w.id,
        title: w.title,
        appName: w.appName,
        x: w.x,
        y: w.y,
        width: w.width,
        height: w.height,
        isMinimized: w.isMinimized,
      }));
  }

  async captureWindow(id: number): Promise<Buffer> {
    const ns = await getNodeScreenshots();
    const windows = ns.Window.all();
    const target = windows.find((w) => w.id === id);
    if (!target) {
      throw new WindowNotFoundError(`id=${id}`);
    }
    try {
      return target.captureImage();
    } catch (err) {
      throw new CaptureFailedError(
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  async captureByTitle(pattern: string): Promise<{ window: WindowInfo; buffer: Buffer }> {
    const ns = await getNodeScreenshots();
    const windows = ns.Window.all();
    const lowerPattern = pattern.toLowerCase();
    const target = windows.find(
      (w) => w.title.toLowerCase().includes(lowerPattern) && w.title.length > 0,
    );
    if (!target) {
      throw new WindowNotFoundError(`title="${pattern}"`);
    }
    try {
      const buffer = target.captureImage();
      return {
        window: {
          id: target.id,
          title: target.title,
          appName: target.appName,
          x: target.x,
          y: target.y,
          width: target.width,
          height: target.height,
          isMinimized: target.isMinimized,
        },
        buffer,
      };
    } catch (err) {
      throw new CaptureFailedError(
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}
