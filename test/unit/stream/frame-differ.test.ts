import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock sharp with raw pixel support
const mockExtract = vi.fn();
const mockPng = vi.fn();
const mockToBuffer = vi.fn();
const mockEnsureAlpha = vi.fn();
const mockRaw = vi.fn();

function makePixelBuffer(width: number, height: number, fill = 0): Buffer {
  return Buffer.alloc(width * height * 4, fill);
}

vi.mock('sharp', () => {
  const sharpFn = vi.fn().mockImplementation(() => {
    const obj: Record<string, unknown> = {};
    obj.ensureAlpha = mockEnsureAlpha.mockImplementation(() => obj);
    obj.raw = mockRaw.mockImplementation(() => obj);
    obj.toBuffer = mockToBuffer;
    obj.extract = mockExtract.mockImplementation(() => obj);
    obj.png = mockPng.mockImplementation(() => obj);
    return obj;
  });
  return { default: sharpFn };
});

import { blockHash, diffFrames, DEFAULT_GRID_COLS, DEFAULT_GRID_ROWS } from '../../../src/stream/frame-differ.js';

describe('frame-differ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('blockHash', () => {
    it('returns the same hash for identical data', () => {
      const buf = Buffer.alloc(100 * 100 * 4, 128);
      const h1 = blockHash(buf, 100, 0, 0, 50, 50, 4);
      const h2 = blockHash(buf, 100, 0, 0, 50, 50, 4);
      expect(h1).toBe(h2);
    });

    it('returns different hash for different data', () => {
      const buf1 = Buffer.alloc(100 * 100 * 4, 128);
      const buf2 = Buffer.alloc(100 * 100 * 4, 200);
      const h1 = blockHash(buf1, 100, 0, 0, 50, 50, 4);
      const h2 = blockHash(buf2, 100, 0, 0, 50, 50, 4);
      expect(h1).not.toBe(h2);
    });

    it('handles small blocks (step = 1)', () => {
      const buf = Buffer.alloc(4 * 4 * 4, 55);
      const h = blockHash(buf, 4, 0, 0, 4, 4, 4);
      expect(typeof h).toBe('number');
    });

    it('handles different regions of same buffer', () => {
      const buf = Buffer.alloc(100 * 100 * 4, 0);
      for (let y = 0; y < 50; y++) {
        for (let x = 50; x < 100; x++) {
          const off = (y * 100 + x) * 4;
          buf[off] = 255;
        }
      }
      const h1 = blockHash(buf, 100, 0, 0, 50, 50, 4);
      const h2 = blockHash(buf, 100, 50, 0, 50, 50, 4);
      expect(h1).not.toBe(h2);
    });
  });

  describe('DEFAULT_GRID', () => {
    it('has correct defaults', () => {
      expect(DEFAULT_GRID_COLS).toBe(8);
      expect(DEFAULT_GRID_ROWS).toBe(6);
    });
  });

  describe('diffFrames', () => {
    it('returns no dirty blocks for identical frames', async () => {
      const pixels = makePixelBuffer(160, 120, 100);
      mockToBuffer.mockResolvedValue({
        data: pixels,
        info: { width: 160, height: 120, channels: 4 },
      });

      const result = await diffFrames(Buffer.from('prev'), Buffer.from('curr'), 8, 6);
      expect(result.changed).toBe(false);
      expect(result.dirtyBlocks).toHaveLength(0);
      expect(result.gridCols).toBe(8);
      expect(result.gridRows).toBe(6);
    });

    it('detects dirty blocks when frames differ', async () => {
      const prevPixels = makePixelBuffer(160, 120, 100);
      const currPixels = makePixelBuffer(160, 120, 100);
      // Modify block (0,0) area
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 20; x++) {
          currPixels[(y * 160 + x) * 4] = 255;
        }
      }

      mockToBuffer
        .mockResolvedValueOnce({ data: prevPixels, info: { width: 160, height: 120, channels: 4 } })
        .mockResolvedValueOnce({ data: currPixels, info: { width: 160, height: 120, channels: 4 } })
        .mockResolvedValue(Buffer.from('block-png'));

      const result = await diffFrames(Buffer.from('prev'), Buffer.from('curr'), 8, 6);
      expect(result.changed).toBe(true);
      expect(result.dirtyBlocks.length).toBeGreaterThan(0);
      expect(result.dirtyBlocks.some(b => b.col === 0 && b.row === 0)).toBe(true);
    });

    it('uses default grid dimensions', async () => {
      const pixels = makePixelBuffer(160, 120, 50);
      mockToBuffer.mockResolvedValue({
        data: pixels,
        info: { width: 160, height: 120, channels: 4 },
      });

      const result = await diffFrames(Buffer.from('prev'), Buffer.from('curr'));
      expect(result.gridCols).toBe(DEFAULT_GRID_COLS);
      expect(result.gridRows).toBe(DEFAULT_GRID_ROWS);
    });

    it('handles all blocks dirty (completely different frames)', async () => {
      const prevPixels = makePixelBuffer(160, 120, 0);
      const currPixels = makePixelBuffer(160, 120, 255);

      mockToBuffer
        .mockResolvedValueOnce({ data: prevPixels, info: { width: 160, height: 120, channels: 4 } })
        .mockResolvedValueOnce({ data: currPixels, info: { width: 160, height: 120, channels: 4 } })
        .mockResolvedValue(Buffer.from('block-png'));

      const result = await diffFrames(Buffer.from('prev'), Buffer.from('curr'), 4, 3);
      expect(result.changed).toBe(true);
      expect(result.dirtyBlocks).toHaveLength(12);
    });
  });
});
