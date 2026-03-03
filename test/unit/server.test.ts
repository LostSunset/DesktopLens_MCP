import { describe, it, expect, vi } from 'vitest';

// Mock createCaptureEngine to avoid native module dependency
vi.mock('../../src/capture/engine.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../src/capture/engine.js')>();
  return {
    ...orig,
    createCaptureEngine: vi.fn().mockResolvedValue({
      available: true,
      listWindows: vi.fn().mockResolvedValue([]),
      captureWindow: vi.fn(),
      captureByTitle: vi.fn(),
    }),
  };
});

import { createDesktopLensServer } from '../../src/server.js';

describe('createDesktopLensServer', () => {
  it('creates server with default deps (no injection)', async () => {
    const result = await createDesktopLensServer();
    expect(result.server).toBeDefined();
    expect(result.engine).toBeDefined();
    expect(result.detector).toBeDefined();
    expect(result.logger).toBeDefined();
    expect(result.engine.available).toBe(true);
  });

  it('creates server with partial deps (only logger)', async () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const result = await createDesktopLensServer({ logger });
    expect(result.logger).toBe(logger);
    expect(result.engine).toBeDefined();
    expect(result.detector).toBeDefined();
  });

  it('creates server with partial deps (only engine)', async () => {
    const engine = {
      available: false,
      listWindows: vi.fn().mockResolvedValue([]),
      captureWindow: vi.fn(),
      captureByTitle: vi.fn(),
    };
    const result = await createDesktopLensServer({ engine });
    expect(result.engine).toBe(engine);
    // detector should be auto-created from engine
    expect(result.detector).toBeDefined();
  });
});
