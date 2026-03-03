import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NodeScreenshotsCaptureEngine, _setNodeScreenshots } from '../../../src/capture/node-screenshots.js';
import { WindowNotFoundError, CaptureFailedError } from '../../../src/capture/engine.js';

const fakeImageBuffer = Buffer.from('fake-png-data');

// Mock node-screenshots native module for the dynamic import path test
vi.mock('node-screenshots', () => ({
  Window: {
    all: () => [
      {
        id: 100, title: 'DynamicImportTest', appName: 'dyn.exe',
        x: 0, y: 0, width: 640, height: 480,
        isMinimized: false,
        captureImage: () => Buffer.from('dynamic-import-test'),
      },
    ],
  },
  Monitor: { all: () => [] },
}));

function createMockWindows() {
  return [
    {
      id: 1,
      title: 'Notepad',
      appName: 'notepad.exe',
      x: 0, y: 0, width: 800, height: 600,
      isMinimized: false,
      captureImage: () => fakeImageBuffer,
    },
    {
      id: 2,
      title: 'Calculator',
      appName: 'calc.exe',
      x: 100, y: 100, width: 400, height: 300,
      isMinimized: false,
      captureImage: () => fakeImageBuffer,
    },
    {
      id: 3,
      title: '',
      appName: 'hidden.exe',
      x: 0, y: 0, width: 0, height: 0,
      isMinimized: false,
      captureImage: () => fakeImageBuffer,
    },
    {
      id: 4,
      title: 'Minimized App',
      appName: 'min.exe',
      x: 0, y: 0, width: 800, height: 600,
      isMinimized: true,
      captureImage: () => fakeImageBuffer,
    },
  ];
}

describe('NodeScreenshotsCaptureEngine', () => {
  let engine: NodeScreenshotsCaptureEngine;
  let mockWindows: ReturnType<typeof createMockWindows>;

  beforeEach(() => {
    mockWindows = createMockWindows();
    _setNodeScreenshots({
      Monitor: { all: () => [] },
      Window: { all: () => mockWindows },
    });
    engine = new NodeScreenshotsCaptureEngine();
  });

  it('is available', () => {
    expect(engine.available).toBe(true);
  });

  describe('listWindows', () => {
    it('filters out empty-title and minimized windows', async () => {
      const windows = await engine.listWindows();
      expect(windows).toHaveLength(2);
      expect(windows.map((w) => w.title)).toEqual(['Notepad', 'Calculator']);
    });

    it('maps window properties correctly', async () => {
      const windows = await engine.listWindows();
      expect(windows[0]).toEqual({
        id: 1,
        title: 'Notepad',
        appName: 'notepad.exe',
        x: 0, y: 0, width: 800, height: 600,
        isMinimized: false,
      });
    });
  });

  describe('captureWindow', () => {
    it('captures by id', async () => {
      const buffer = await engine.captureWindow(1);
      expect(buffer).toBe(fakeImageBuffer);
    });

    it('throws WindowNotFoundError for unknown id', async () => {
      await expect(engine.captureWindow(999)).rejects.toThrow(WindowNotFoundError);
    });

    it('throws CaptureFailedError when capture throws', async () => {
      mockWindows[0]!.captureImage = () => { throw new Error('hw fail'); };
      await expect(engine.captureWindow(1)).rejects.toThrow(CaptureFailedError);
    });

    it('wraps non-Error throws in CaptureFailedError', async () => {
      mockWindows[0]!.captureImage = () => { throw 'raw string'; };
      await expect(engine.captureWindow(1)).rejects.toThrow(CaptureFailedError);
    });
  });

  describe('captureByTitle', () => {
    it('finds window by title (case-insensitive)', async () => {
      const result = await engine.captureByTitle('note');
      expect(result.window.title).toBe('Notepad');
      expect(result.buffer).toBe(fakeImageBuffer);
    });

    it('throws WindowNotFoundError for unmatched title', async () => {
      await expect(engine.captureByTitle('nonexistent')).rejects.toThrow(WindowNotFoundError);
    });

    it('skips empty-title windows when they are the only match', async () => {
      // Replace all windows with only empty-title ones
      _setNodeScreenshots({
        Monitor: { all: () => [] },
        Window: {
          all: () => [
            {
              id: 99, title: '', appName: 'ghost.exe',
              x: 0, y: 0, width: 100, height: 100,
              isMinimized: false,
              captureImage: () => fakeImageBuffer,
            },
          ],
        },
      });
      const eng = new NodeScreenshotsCaptureEngine();
      await expect(eng.captureByTitle('ghost')).rejects.toThrow(WindowNotFoundError);
    });

    it('throws CaptureFailedError when capture throws', async () => {
      mockWindows[0]!.captureImage = () => { throw new Error('capture error'); };
      await expect(engine.captureByTitle('Notepad')).rejects.toThrow(CaptureFailedError);
    });

    it('wraps non-Error throws in CaptureFailedError', async () => {
      mockWindows[0]!.captureImage = () => { throw 42; };
      await expect(engine.captureByTitle('Notepad')).rejects.toThrow(CaptureFailedError);
    });
  });

  describe('getNodeScreenshots dynamic import', () => {
    it('falls back to dynamic import when module is not pre-set', async () => {
      _setNodeScreenshots(undefined);
      const eng = new NodeScreenshotsCaptureEngine();
      const windows = await eng.listWindows();
      // Should use the vi.mock('node-screenshots') mock above
      expect(windows).toHaveLength(1);
      expect(windows[0]!.title).toBe('DynamicImportTest');
    });
  });
});
