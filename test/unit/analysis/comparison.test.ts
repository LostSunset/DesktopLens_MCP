import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock sharp — must use inline values (vi.mock is hoisted)
vi.mock('sharp', () => {
  const mockToBuffer = vi.fn();
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.ensureAlpha = vi.fn(() => chain);
  chain.raw = vi.fn(() => chain);
  chain.resize = vi.fn(() => chain);
  chain.toBuffer = mockToBuffer;

  return {
    default: vi.fn(() => {
      // Return fresh chain references but same mocks
      return chain;
    }),
  };
});

// Mock pixelmatch — inline
vi.mock('pixelmatch', () => ({
  default: vi.fn().mockReturnValue(0),
}));

// Mock pngjs — inline
vi.mock('pngjs', () => ({
  PNG: class MockPNG {
    data: Buffer = Buffer.alloc(0);
    constructor(_opts: unknown) {}
    static sync = { write: vi.fn().mockReturnValue(Buffer.from('diff-png')) };
  },
}));

import { compareImages } from '../../../src/analysis/comparison.js';
import sharp from 'sharp';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const mockSharp = vi.mocked(sharp);
const mockPixelmatch = vi.mocked(pixelmatch);
const mockPngSyncWrite = vi.mocked(PNG.sync.write);

describe('comparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMockBuffers(
    width: number,
    height: number,
    options?: { afterWidth?: number; afterHeight?: number },
  ) {
    const beforeData = Buffer.alloc(width * height * 4, 0);
    const afterData = Buffer.alloc(
      (options?.afterWidth ?? width) * (options?.afterHeight ?? height) * 4,
      0,
    );

    let callCount = 0;
    const chain = mockSharp(Buffer.alloc(0)) as unknown as Record<string, ReturnType<typeof vi.fn>>;
    chain.toBuffer.mockImplementation((opts?: { resolveWithObject?: boolean }) => {
      callCount++;
      if (opts?.resolveWithObject) {
        if (callCount <= 1) {
          return Promise.resolve({
            data: beforeData,
            info: { width, height },
          });
        }
        return Promise.resolve({
          data: afterData,
          info: {
            width: options?.afterWidth ?? width,
            height: options?.afterHeight ?? height,
          },
        });
      }
      // For resize case (no resolveWithObject)
      return Promise.resolve(Buffer.alloc(width * height * 4, 0));
    });
  }

  describe('compareImages', () => {
    it('returns perfect similarity when images are identical', async () => {
      setupMockBuffers(100, 100);
      mockPixelmatch.mockReturnValue(0);

      const result = await compareImages(Buffer.from('before'), Buffer.from('after'));

      expect(result.similarityScore).toBe(1);
      expect(result.diffPixelCount).toBe(0);
      expect(result.totalPixels).toBe(10000);
      expect(result.changedRegions).toEqual([]);
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
    });

    it('calculates correct similarity score for partial differences', async () => {
      setupMockBuffers(100, 100);
      mockPixelmatch.mockReturnValue(2500); // 25% different

      const result = await compareImages(Buffer.from('before'), Buffer.from('after'));

      expect(result.similarityScore).toBe(0.75);
      expect(result.diffPixelCount).toBe(2500);
    });

    it('passes threshold option to pixelmatch', async () => {
      setupMockBuffers(50, 50);
      mockPixelmatch.mockReturnValue(0);

      await compareImages(Buffer.from('a'), Buffer.from('b'), { threshold: 0.5 });

      expect(mockPixelmatch).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.any(Uint8Array),
        expect.any(Uint8Array),
        50,
        50,
        { threshold: 0.5 },
      );
    });

    it('resizes after image when dimensions differ', async () => {
      setupMockBuffers(100, 100, { afterWidth: 200, afterHeight: 150 });
      mockPixelmatch.mockReturnValue(0);

      await compareImages(Buffer.from('small'), Buffer.from('big'));

      const chain = mockSharp(Buffer.alloc(0)) as unknown as Record<string, ReturnType<typeof vi.fn>>;
      expect(chain.resize).toHaveBeenCalledWith(100, 100, { fit: 'fill' });
    });

    it('generates diff image PNG when highlightDiff is true', async () => {
      setupMockBuffers(32, 32);
      mockPixelmatch.mockReturnValue(0);

      const result = await compareImages(Buffer.from('a'), Buffer.from('b'), {
        highlightDiff: true,
      });

      expect(mockPngSyncWrite).toHaveBeenCalled();
      expect(result.diffImage.toString()).toBe('diff-png');
    });

    it('returns empty buffer when highlightDiff is false', async () => {
      setupMockBuffers(32, 32);
      mockPixelmatch.mockReturnValue(0);

      const result = await compareImages(Buffer.from('a'), Buffer.from('b'), {
        highlightDiff: false,
      });

      expect(mockPngSyncWrite).not.toHaveBeenCalled();
      expect(result.diffImage.length).toBe(0);
    });

    it('detects changed regions from diff pixels', async () => {
      const width = 32;
      const height = 32;
      setupMockBuffers(width, height);

      mockPixelmatch.mockImplementation(
        (_before, _after, diff) => {
          if (!diff) return 0;
          // Mark pixels in top-left 16x16 block as red (diff)
          for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
              const idx = (y * width + x) * 4;
              diff[idx] = 255;     // R
              diff[idx + 1] = 0;   // G
              diff[idx + 2] = 0;   // B
              diff[idx + 3] = 255; // A
            }
          }
          return 256;
        },
      );

      const result = await compareImages(Buffer.from('a'), Buffer.from('b'));

      expect(result.changedRegions.length).toBeGreaterThanOrEqual(1);
      expect(result.changedRegions[0]!.x).toBe(0);
      expect(result.changedRegions[0]!.y).toBe(0);
    });

    it('groups adjacent changed blocks into single region', async () => {
      const width = 64;
      const height = 32;
      setupMockBuffers(width, height);

      mockPixelmatch.mockImplementation(
        (_before, _after, diff) => {
          if (!diff) return 0;
          for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 32; x++) {
              const idx = (y * width + x) * 4;
              diff[idx] = 255;
              diff[idx + 3] = 255;
            }
          }
          return 512;
        },
      );

      const result = await compareImages(Buffer.from('a'), Buffer.from('b'));

      expect(result.changedRegions.length).toBe(1);
      expect(result.changedRegions[0]!.width).toBe(32);
    });

    it('finds multiple separate regions', async () => {
      const width = 64;
      const height = 64;
      setupMockBuffers(width, height);

      mockPixelmatch.mockImplementation(
        (_before, _after, diff) => {
          if (!diff) return 0;
          // Top-left corner (grid cell 0,0)
          for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
              const idx = (y * width + x) * 4;
              diff[idx] = 255;
              diff[idx + 3] = 255;
            }
          }
          // Bottom-right corner (grid cell 3,3)
          for (let y = 56; y < 64; y++) {
            for (let x = 56; x < 64; x++) {
              const idx = (y * width + x) * 4;
              diff[idx] = 255;
              diff[idx + 3] = 255;
            }
          }
          return 128;
        },
      );

      const result = await compareImages(Buffer.from('a'), Buffer.from('b'));

      expect(result.changedRegions.length).toBe(2);
    });

    it('returns similarity 1 when totalPixels is zero', async () => {
      setupMockBuffers(0, 0);
      mockPixelmatch.mockReturnValue(0);

      const result = await compareImages(Buffer.from('a'), Buffer.from('b'));

      expect(result.similarityScore).toBe(1);
      expect(result.totalPixels).toBe(0);
    });

    it('uses default options when none provided', async () => {
      setupMockBuffers(32, 32);
      mockPixelmatch.mockReturnValue(0);

      const result = await compareImages(Buffer.from('a'), Buffer.from('b'));

      expect(mockPngSyncWrite).toHaveBeenCalled();
      expect(mockPixelmatch).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.any(Uint8Array),
        expect.any(Uint8Array),
        32,
        32,
        { threshold: 0.1 },
      );
      expect(result.diffImage.length).toBeGreaterThan(0);
    });
  });
});
