export interface WindowInfo {
  id: number;
  title: string;
  appName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
}

export interface CaptureEngine {
  readonly available: boolean;
  listWindows(): Promise<WindowInfo[]>;
  captureWindow(id: number): Promise<Buffer>;
  captureByTitle(pattern: string): Promise<{ window: WindowInfo; buffer: Buffer }>;
}

export class WindowNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Window not found: ${identifier}`);
    this.name = 'WindowNotFoundError';
  }
}

export class CaptureFailedError extends Error {
  constructor(reason: string) {
    super(`Capture failed: ${reason}`);
    this.name = 'CaptureFailedError';
  }
}

export class PlatformUnavailableError extends Error {
  constructor(platform: string) {
    super(`Screenshot capture is not available on this platform: ${platform}`);
    this.name = 'PlatformUnavailableError';
  }
}

export class StubCaptureEngine implements CaptureEngine {
  readonly available = false;

  async listWindows(): Promise<WindowInfo[]> {
    return [];
  }

  async captureWindow(_id: number): Promise<Buffer> {
    throw new PlatformUnavailableError('stub');
  }

  async captureByTitle(_pattern: string): Promise<{ window: WindowInfo; buffer: Buffer }> {
    throw new PlatformUnavailableError('stub');
  }
}

export async function createCaptureEngine(): Promise<CaptureEngine> {
  try {
    const mod = await import('./node-screenshots.js');
    return new mod.NodeScreenshotsCaptureEngine();
  } catch {
    return new StubCaptureEngine();
  }
}
