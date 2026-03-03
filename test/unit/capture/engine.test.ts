import { describe, it, expect, vi } from 'vitest';
import {
  StubCaptureEngine,
  WindowNotFoundError,
  CaptureFailedError,
  PlatformUnavailableError,
} from '../../../src/capture/engine.js';

describe('StubCaptureEngine', () => {
  const stub = new StubCaptureEngine();

  it('is not available', () => {
    expect(stub.available).toBe(false);
  });

  it('returns empty window list', async () => {
    const windows = await stub.listWindows();
    expect(windows).toEqual([]);
  });

  it('throws PlatformUnavailableError on captureWindow', async () => {
    await expect(stub.captureWindow(1)).rejects.toThrow(PlatformUnavailableError);
  });

  it('throws PlatformUnavailableError on captureByTitle', async () => {
    await expect(stub.captureByTitle('test')).rejects.toThrow(PlatformUnavailableError);
  });
});

describe('Error classes', () => {
  it('WindowNotFoundError has correct name and message', () => {
    const err = new WindowNotFoundError('id=123');
    expect(err.name).toBe('WindowNotFoundError');
    expect(err.message).toContain('id=123');
  });

  it('CaptureFailedError has correct name and message', () => {
    const err = new CaptureFailedError('timeout');
    expect(err.name).toBe('CaptureFailedError');
    expect(err.message).toContain('timeout');
  });

  it('PlatformUnavailableError has correct name and message', () => {
    const err = new PlatformUnavailableError('stub');
    expect(err.name).toBe('PlatformUnavailableError');
    expect(err.message).toContain('stub');
  });
});

describe('createCaptureEngine', () => {
  it('returns NodeScreenshotsCaptureEngine when import succeeds', async () => {
    vi.doMock('../../../src/capture/node-screenshots.js', () => ({
      NodeScreenshotsCaptureEngine: class {
        available = true;
      },
    }));
    const { createCaptureEngine } = await import('../../../src/capture/engine.js');
    const engine = await createCaptureEngine();
    expect(engine.available).toBe(true);
    vi.doUnmock('../../../src/capture/node-screenshots.js');
  });

  it('returns StubCaptureEngine when import fails', async () => {
    vi.doMock('../../../src/capture/node-screenshots.js', () => {
      throw new Error('native module not available');
    });
    vi.resetModules();
    const { createCaptureEngine } = await import('../../../src/capture/engine.js');
    const engine = await createCaptureEngine();
    expect(engine.available).toBe(false);
    vi.doUnmock('../../../src/capture/node-screenshots.js');
  });
});
