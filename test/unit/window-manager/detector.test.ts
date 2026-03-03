import { describe, it, expect, vi } from 'vitest';
import { createWindowDetector } from '../../../src/window-manager/detector.js';
import type { CaptureEngine, WindowInfo } from '../../../src/capture/engine.js';
import { WindowNotFoundError } from '../../../src/capture/engine.js';

const mockWindows: WindowInfo[] = [
  { id: 1, title: 'Notepad', appName: 'notepad.exe', x: 0, y: 0, width: 800, height: 600, isMinimized: false },
  { id: 2, title: 'Calculator', appName: 'calc.exe', x: 100, y: 100, width: 400, height: 300, isMinimized: false },
  { id: 3, title: 'Visual Studio Code', appName: 'code.exe', x: 200, y: 200, width: 1200, height: 800, isMinimized: false },
];

function createMockEngine(): CaptureEngine {
  return {
    available: true,
    listWindows: vi.fn().mockResolvedValue(mockWindows),
    captureWindow: vi.fn(),
    captureByTitle: vi.fn(),
  };
}

describe('WindowDetector', () => {
  describe('listWindows', () => {
    it('returns all windows without filter', async () => {
      const detector = createWindowDetector(createMockEngine());
      const windows = await detector.listWindows();
      expect(windows).toHaveLength(3);
    });

    it('returns all windows with empty options', async () => {
      const detector = createWindowDetector(createMockEngine());
      const windows = await detector.listWindows({});
      expect(windows).toHaveLength(3);
    });

    it('filters by title', async () => {
      const detector = createWindowDetector(createMockEngine());
      const windows = await detector.listWindows({ filter: 'note' });
      expect(windows).toHaveLength(1);
      expect(windows[0]!.title).toBe('Notepad');
    });

    it('filters by appName', async () => {
      const detector = createWindowDetector(createMockEngine());
      const windows = await detector.listWindows({ filter: 'calc' });
      expect(windows).toHaveLength(1);
      expect(windows[0]!.appName).toBe('calc.exe');
    });

    it('filter is case-insensitive', async () => {
      const detector = createWindowDetector(createMockEngine());
      const windows = await detector.listWindows({ filter: 'VISUAL' });
      expect(windows).toHaveLength(1);
    });

    it('returns empty for non-matching filter', async () => {
      const detector = createWindowDetector(createMockEngine());
      const windows = await detector.listWindows({ filter: 'nonexistent' });
      expect(windows).toHaveLength(0);
    });
  });

  describe('findWindow', () => {
    it('finds by id', async () => {
      const detector = createWindowDetector(createMockEngine());
      const window = await detector.findWindow({ id: 2 });
      expect(window.title).toBe('Calculator');
    });

    it('finds by title', async () => {
      const detector = createWindowDetector(createMockEngine());
      const window = await detector.findWindow({ title: 'calc' });
      expect(window.title).toBe('Calculator');
    });

    it('id takes priority over title', async () => {
      const detector = createWindowDetector(createMockEngine());
      const window = await detector.findWindow({ id: 1, title: 'Calculator' });
      expect(window.title).toBe('Notepad');
    });

    it('throws when neither id nor title provided', async () => {
      const detector = createWindowDetector(createMockEngine());
      await expect(detector.findWindow({})).rejects.toThrow(WindowNotFoundError);
    });

    it('throws when id not found', async () => {
      const detector = createWindowDetector(createMockEngine());
      await expect(detector.findWindow({ id: 999 })).rejects.toThrow(WindowNotFoundError);
    });

    it('throws when title not found', async () => {
      const detector = createWindowDetector(createMockEngine());
      await expect(detector.findWindow({ title: 'nonexistent' })).rejects.toThrow(WindowNotFoundError);
    });
  });
});
