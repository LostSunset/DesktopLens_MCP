import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock playwright — control availability per test
let playwrightAvailable = true;
const mockGoto = vi.fn();
const mockNewPage = vi.fn().mockResolvedValue({ goto: mockGoto });
const mockBrowserClose = vi.fn();
const mockLaunch = vi.fn().mockResolvedValue({
  newPage: mockNewPage,
  close: mockBrowserClose,
});

vi.mock('playwright', () => {
  if (!playwrightAvailable) {
    throw new Error('Cannot find module playwright');
  }
  return {
    chromium: { launch: mockLaunch },
  };
});

import { createPlaywrightBridge } from '../../../src/browser/playwright-bridge.js';

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('playwright-bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playwrightAvailable = true;
  });

  describe('when playwright is available', () => {
    it('reports isAvailable as true', async () => {
      const bridge = await createPlaywrightBridge(createMockLogger());
      expect(bridge.isAvailable).toBe(true);
    });

    it('opens viewer with correct URL', async () => {
      const logger = createMockLogger();
      const bridge = await createPlaywrightBridge(logger);
      await bridge.openViewer('http://localhost:9876/viewer/abc');

      expect(mockLaunch).toHaveBeenCalledWith({
        headless: false,
        args: ['--app=http://localhost:9876/viewer/abc', '--window-size=1280,720'],
      });
      expect(mockNewPage).toHaveBeenCalled();
      expect(mockGoto).toHaveBeenCalledWith('http://localhost:9876/viewer/abc');
      expect(logger.info).toHaveBeenCalledWith('Viewer opened', {
        url: 'http://localhost:9876/viewer/abc',
      });
    });

    it('handles launch failure gracefully', async () => {
      mockLaunch.mockRejectedValueOnce(new Error('launch failed'));
      const logger = createMockLogger();
      const bridge = await createPlaywrightBridge(logger);

      // Should not throw
      await bridge.openViewer('http://localhost:9876');
      expect(logger.error).toHaveBeenCalledWith('Failed to open viewer', {
        error: 'launch failed',
      });
    });

    it('handles non-Error launch failure', async () => {
      mockLaunch.mockRejectedValueOnce('string error');
      const logger = createMockLogger();
      const bridge = await createPlaywrightBridge(logger);

      await bridge.openViewer('http://localhost:9876');
      expect(logger.error).toHaveBeenCalledWith('Failed to open viewer', {
        error: 'string error',
      });
    });

    it('closes all browsers', async () => {
      const logger = createMockLogger();
      const bridge = await createPlaywrightBridge(logger);
      await bridge.openViewer('http://localhost:9876');

      await bridge.closeAll();
      expect(mockBrowserClose).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('All browsers closed');
    });

    it('handles close error gracefully', async () => {
      mockBrowserClose.mockRejectedValueOnce(new Error('close error'));
      const logger = createMockLogger();
      const bridge = await createPlaywrightBridge(logger);
      await bridge.openViewer('http://localhost:9876');

      // Should not throw
      await bridge.closeAll();
      expect(logger.debug).toHaveBeenCalledWith('All browsers closed');
    });
  });

  describe('when playwright is not available', () => {
    it('reports isAvailable as false', async () => {
      // Force playwright unavailable by resetting module and mocking to throw
      vi.resetModules();
      vi.doMock('playwright', () => { throw new Error('not found'); });

      const { createPlaywrightBridge: freshCreate } = await import(
        '../../../src/browser/playwright-bridge.js'
      );
      const logger = createMockLogger();
      const bridge = await freshCreate(logger);
      expect(bridge.isAvailable).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('Playwright not available — browser viewer will not auto-open');
    });

    it('warns when trying to open viewer without playwright', async () => {
      vi.resetModules();
      vi.doMock('playwright', () => { throw new Error('not found'); });

      const { createPlaywrightBridge: freshCreate } = await import(
        '../../../src/browser/playwright-bridge.js'
      );
      const logger = createMockLogger();
      const bridge = await freshCreate(logger);
      await bridge.openViewer('http://localhost:9876');
      expect(logger.warn).toHaveBeenCalledWith('Cannot open viewer: playwright not available');
    });
  });
});
