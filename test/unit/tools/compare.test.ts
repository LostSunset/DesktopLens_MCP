import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock comparison module
vi.mock('../../../src/analysis/comparison.js', () => ({
  compareImages: vi.fn().mockResolvedValue({
    similarityScore: 0.95,
    diffPixelCount: 500,
    totalPixels: 10000,
    changedRegions: [{ x: 10, y: 20, width: 30, height: 40 }],
    diffImage: Buffer.from('diff-png'),
    width: 100,
    height: 100,
  }),
}));

// Mock annotation module
vi.mock('../../../src/analysis/annotation.js', () => ({
  annotateImage: vi.fn().mockResolvedValue(Buffer.from('annotated-png')),
}));

// Mock image-utils
vi.mock('../../../src/utils/image-utils.js', () => ({
  toBase64: vi.fn().mockReturnValue('data:image/png;base64,AAAA'),
}));

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerCompare, type CompareDeps } from '../../../src/tools/compare.js';
import { compareImages } from '../../../src/analysis/comparison.js';
import { annotateImage } from '../../../src/analysis/annotation.js';
import type { CaptureEngine } from '../../../src/capture/engine.js';
import type { WindowDetector } from '../../../src/window-manager/detector.js';
import { createSnapshotStore } from '../../../src/analysis/snapshot-store.js';

const mockCompareImages = vi.mocked(compareImages);
const mockAnnotateImage = vi.mocked(annotateImage);

// MCP server + tool handler extraction
function createTestServer() {
  const handlers = new Map<string, (params: Record<string, unknown>) => Promise<unknown>>();
  const mockServer = {
    tool: vi.fn((name: string, _desc: string, _schema: unknown, handler: (params: Record<string, unknown>) => Promise<unknown>) => {
      handlers.set(name, handler);
    }),
  } as unknown as McpServer;
  return { mockServer, handlers };
}

function createMockEngine(): CaptureEngine {
  return {
    available: true,
    listWindows: vi.fn().mockResolvedValue([]),
    captureWindow: vi.fn().mockResolvedValue(Buffer.from('after-screenshot')),
    captureByTitle: vi.fn().mockResolvedValue({
      window: { id: 1, title: 'Test', appName: 'test', x: 0, y: 0, width: 100, height: 100 },
      buffer: Buffer.from('after-by-title'),
    }),
  };
}

function createMockDetector(): WindowDetector {
  return {
    findWindow: vi.fn().mockResolvedValue({ id: 1, title: 'Test', appName: 'test', x: 0, y: 0, width: 100, height: 100 }),
    findByTitle: vi.fn().mockResolvedValue({ id: 1, title: 'Test', appName: 'test', x: 0, y: 0, width: 100, height: 100 }),
    listWindows: vi.fn().mockResolvedValue([]),
  };
}

describe('compare tool', () => {
  let engine: CaptureEngine;
  let detector: WindowDetector;
  let deps: CompareDeps;
  let handlers: Map<string, (params: Record<string, unknown>) => Promise<unknown>>;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = createMockEngine();
    detector = createMockDetector();
    const store = createSnapshotStore(10);
    // Pre-populate store with a snapshot
    store.save({ windowId: 1, windowTitle: 'Test Window', buffer: Buffer.from('before-img'), width: 100, height: 100 });
    deps = { engine, detector, snapshotStore: store };
    const { mockServer, handlers: h } = createTestServer();
    handlers = h;
    registerCompare(mockServer, deps);
  });

  it('registers desktoplens_compare tool', () => {
    expect(handlers.has('desktoplens_compare')).toBe(true);
  });

  it('compares using snapshot ID', async () => {
    const handler = handlers.get('desktoplens_compare')!;
    const result = await handler({
      before_snapshot_id: 'snap-1',
      after_window_id: 1,
    }) as { content: Array<{ type: string; text?: string }> };

    expect(mockCompareImages).toHaveBeenCalledWith(
      Buffer.from('before-img'),
      Buffer.from('after-screenshot'),
      { threshold: undefined, highlightDiff: true },
    );

    const textContent = JSON.parse(result.content[0].text!);
    expect(textContent.similarity_score).toBe(0.95);
    expect(textContent.changes_detected).toHaveLength(1);
    expect(result.content).toHaveLength(2); // text + image
  });

  it('compares using before_window_id', async () => {
    const handler = handlers.get('desktoplens_compare')!;
    const result = await handler({
      before_window_id: 1,
      after_window_id: 1,
    }) as { content: Array<{ type: string }> };

    expect(mockCompareImages).toHaveBeenCalled();
    expect(result.content).toHaveLength(2);
  });

  it('compares using before_window_title', async () => {
    const handler = handlers.get('desktoplens_compare')!;
    const result = await handler({
      before_window_title: 'Test',
      after_window_id: 1,
    }) as { content: Array<{ type: string }> };

    expect(mockCompareImages).toHaveBeenCalled();
    expect(result.content).toHaveLength(2);
  });

  it('captures after by title', async () => {
    const handler = handlers.get('desktoplens_compare')!;
    await handler({
      before_snapshot_id: 'snap-1',
      after_window_title: 'My App',
    });

    expect(engine.captureByTitle).toHaveBeenCalledWith('My App');
  });

  it('returns error when snapshot not found', async () => {
    const handler = handlers.get('desktoplens_compare')!;
    const result = await handler({
      before_snapshot_id: 'snap-999',
      after_window_id: 1,
    }) as { isError: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Snapshot not found');
  });

  it('returns error when no before source provided', async () => {
    const handler = handlers.get('desktoplens_compare')!;
    const result = await handler({
      after_window_id: 1,
    }) as { isError: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Must provide before_snapshot_id');
  });

  it('returns error when no after source provided', async () => {
    const handler = handlers.get('desktoplens_compare')!;
    const result = await handler({
      before_snapshot_id: 'snap-1',
    }) as { isError: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Must provide after_window_id');
  });

  it('returns error when no snapshot for window ID', async () => {
    const handler = handlers.get('desktoplens_compare')!;
    const result = await handler({
      before_window_id: 999,
      after_window_id: 1,
    }) as { isError: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No snapshot found for window ID');
  });

  it('returns error when no snapshot for window title', async () => {
    const handler = handlers.get('desktoplens_compare')!;
    const result = await handler({
      before_window_title: 'NonExistent',
      after_window_id: 1,
    }) as { isError: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No snapshot found for window title');
  });

  it('skips annotation when highlight_diff is false', async () => {
    mockCompareImages.mockResolvedValueOnce({
      similarityScore: 1,
      diffPixelCount: 0,
      totalPixels: 10000,
      changedRegions: [],
      diffImage: Buffer.alloc(0),
      width: 100,
      height: 100,
    });

    const handler = handlers.get('desktoplens_compare')!;
    const result = await handler({
      before_snapshot_id: 'snap-1',
      after_window_id: 1,
      highlight_diff: false,
    }) as { content: Array<{ type: string }> };

    expect(mockAnnotateImage).not.toHaveBeenCalled();
    // Only text content (no image since diffImage is empty)
    expect(result.content).toHaveLength(1);
  });

  it('handles non-Error thrown in catch block', async () => {
    mockCompareImages.mockRejectedValueOnce('string error');

    const handler = handlers.get('desktoplens_compare')!;
    const result = await handler({
      before_snapshot_id: 'snap-1',
      after_window_id: 1,
    }) as { isError: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('string error');
  });

  it('passes threshold to compareImages', async () => {
    const handler = handlers.get('desktoplens_compare')!;
    await handler({
      before_snapshot_id: 'snap-1',
      after_window_id: 1,
      threshold: 0.5,
    });

    expect(mockCompareImages).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.any(Buffer),
      { threshold: 0.5, highlightDiff: true },
    );
  });
});
