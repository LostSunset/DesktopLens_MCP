import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock sharp — all values inline (vi.mock is hoisted)
vi.mock('sharp', () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.composite = vi.fn(() => chain);
  chain.png = vi.fn(() => chain);
  chain.toBuffer = vi.fn().mockResolvedValue(Buffer.from('annotated-image'));

  return {
    default: vi.fn(() => chain),
  };
});

import { annotateImage } from '../../../src/analysis/annotation.js';
import type { ChangedRegion } from '../../../src/analysis/comparison.js';
import sharp from 'sharp';

// Access mock chain via vi.mocked
function getSharpChain() {
  const s = vi.mocked(sharp);
  return s(Buffer.alloc(0)) as unknown as Record<string, ReturnType<typeof vi.fn>>;
}

describe('annotation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup chain methods after clearAllMocks
    const chain = getSharpChain();
    chain.composite.mockImplementation(() => chain);
    chain.png.mockImplementation(() => chain);
    chain.toBuffer.mockResolvedValue(Buffer.from('annotated-image'));
  });

  describe('annotateImage', () => {
    it('returns original image when no annotations requested', async () => {
      const input = Buffer.from('original');
      const result = await annotateImage(input, 100, 100);

      expect(result).toBe(input);
      expect(getSharpChain().composite).not.toHaveBeenCalled();
    });

    it('returns original image with empty regions and no grid', async () => {
      const input = Buffer.from('original');
      const result = await annotateImage(input, 100, 100, { regions: [], grid: false });

      expect(result).toBe(input);
    });

    it('draws region boundary boxes', async () => {
      const regions: ChangedRegion[] = [
        { x: 10, y: 20, width: 50, height: 30 },
      ];

      await annotateImage(Buffer.from('img'), 200, 200, { regions });

      const chain = getSharpChain();
      expect(chain.composite).toHaveBeenCalledTimes(1);
      const svgInput = chain.composite.mock.calls[0][0][0].input as Buffer;
      const svgString = svgInput.toString();

      expect(svgString).toContain('rect');
      expect(svgString).toContain('x="10"');
      expect(svgString).toContain('y="20"');
      expect(svgString).toContain('width="50"');
      expect(svgString).toContain('height="30"');
      expect(svgString).toContain('stroke-dasharray');
    });

    it('includes dimension labels when showDimensions is true', async () => {
      const regions: ChangedRegion[] = [
        { x: 10, y: 30, width: 50, height: 30 },
      ];

      await annotateImage(Buffer.from('img'), 200, 200, {
        regions,
        showDimensions: true,
      });

      const svgString = (getSharpChain().composite.mock.calls[0][0][0].input as Buffer).toString();
      expect(svgString).toContain('50×30');
      expect(svgString).toContain('<text');
    });

    it('hides dimension labels when showDimensions is false', async () => {
      const regions: ChangedRegion[] = [
        { x: 10, y: 30, width: 50, height: 30 },
      ];

      await annotateImage(Buffer.from('img'), 200, 200, {
        regions,
        showDimensions: false,
      });

      const svgString = (getSharpChain().composite.mock.calls[0][0][0].input as Buffer).toString();
      expect(svgString).not.toContain('<text');
    });

    it('draws grid lines when grid is true', async () => {
      await annotateImage(Buffer.from('img'), 300, 200, {
        grid: true,
        gridSpacing: 100,
      });

      const svgString = (getSharpChain().composite.mock.calls[0][0][0].input as Buffer).toString();
      expect(svgString).toContain('x1="100"');
      expect(svgString).toContain('x1="200"');
      expect(svgString).toContain('y1="100"');
    });

    it('uses custom box color and stroke width', async () => {
      const regions: ChangedRegion[] = [
        { x: 0, y: 20, width: 10, height: 10 },
      ];

      await annotateImage(Buffer.from('img'), 100, 100, {
        regions,
        boxColor: '#00ff00',
        boxStrokeWidth: 4,
      });

      const svgString = (getSharpChain().composite.mock.calls[0][0][0].input as Buffer).toString();
      expect(svgString).toContain('stroke="#00ff00"');
      expect(svgString).toContain('stroke-width="4"');
    });

    it('handles multiple regions', async () => {
      const regions: ChangedRegion[] = [
        { x: 0, y: 0, width: 20, height: 20 },
        { x: 50, y: 50, width: 30, height: 30 },
      ];

      await annotateImage(Buffer.from('img'), 200, 200, { regions });

      const svgString = (getSharpChain().composite.mock.calls[0][0][0].input as Buffer).toString();
      const rectMatches = svgString.match(/<rect /g);
      expect(rectMatches!.length).toBeGreaterThanOrEqual(2);
    });

    it('places label below region when region is at top edge', async () => {
      const regions: ChangedRegion[] = [
        { x: 0, y: 5, width: 20, height: 20 },
      ];

      await annotateImage(Buffer.from('img'), 200, 200, { regions });

      const svgString = (getSharpChain().composite.mock.calls[0][0][0].input as Buffer).toString();
      // label y = region.y + region.height + 14 = 5 + 20 + 14 = 39
      expect(svgString).toContain('y="39"');
    });

    it('places label above region when there is space', async () => {
      const regions: ChangedRegion[] = [
        { x: 0, y: 30, width: 20, height: 20 },
      ];

      await annotateImage(Buffer.from('img'), 200, 200, { regions });

      const svgString = (getSharpChain().composite.mock.calls[0][0][0].input as Buffer).toString();
      // label y = region.y - 4 = 26
      expect(svgString).toContain('y="26"');
    });

    it('composites SVG overlay at position (0,0)', async () => {
      const regions: ChangedRegion[] = [
        { x: 10, y: 20, width: 50, height: 30 },
      ];

      await annotateImage(Buffer.from('img'), 200, 200, { regions });

      expect(getSharpChain().composite).toHaveBeenCalledWith([
        { input: expect.any(Buffer), top: 0, left: 0 },
      ]);
    });
  });
});
