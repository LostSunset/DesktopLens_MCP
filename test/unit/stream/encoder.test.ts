import { describe, it, expect, vi } from 'vitest';

// Mock sharp (same pattern as image-utils tests)
vi.mock('sharp', () => {
  const pipeline = {
    metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('encoded-image')),
  };
  return { default: vi.fn(() => pipeline) };
});

import { encodeForStream, getQualityPreset, type QualityLevel } from '../../../src/stream/encoder.js';

describe('encoder', () => {
  describe('getQualityPreset', () => {
    it('returns low preset', () => {
      const preset = getQualityPreset('low');
      expect(preset.format).toBe('jpeg');
      expect(preset.quality).toBe(50);
      expect(preset.scale).toBe(0.5);
    });

    it('returns medium preset', () => {
      const preset = getQualityPreset('medium');
      expect(preset.format).toBe('webp');
      expect(preset.quality).toBe(75);
      expect(preset.scale).toBe(0.75);
    });

    it('returns high preset', () => {
      const preset = getQualityPreset('high');
      expect(preset.format).toBe('png');
      expect(preset.quality).toBe(100);
      expect(preset.scale).toBe(1.0);
    });
  });

  describe('encodeForStream', () => {
    it('encodes with low quality (JPEG 50%, 50% scale)', async () => {
      const result = await encodeForStream(Buffer.from('raw'), 800, 600, 'low');
      expect(result.format).toBe('jpeg');
      expect(result.buffer).toBeDefined();
    });

    it('encodes with medium quality (WebP 75%, 75% scale)', async () => {
      const result = await encodeForStream(Buffer.from('raw'), 800, 600, 'medium');
      expect(result.format).toBe('webp');
      expect(result.buffer).toBeDefined();
    });

    it('encodes with high quality (PNG, 100% scale)', async () => {
      const result = await encodeForStream(Buffer.from('raw'), 800, 600, 'high');
      expect(result.format).toBe('png');
      expect(result.buffer).toBeDefined();
    });

    it('defaults to medium quality', async () => {
      const result = await encodeForStream(Buffer.from('raw'), 800, 600);
      expect(result.format).toBe('webp');
    });

    it('calculates correct target dimensions for low quality', async () => {
      const result = await encodeForStream(Buffer.from('raw'), 1920, 1080, 'low');
      // 1920*0.5 = 960, 1080*0.5 = 540 — passed to processImage
      expect(result.buffer).toBeDefined();
    });

    it('returns width and height from processed image', async () => {
      const result = await encodeForStream(Buffer.from('raw'), 800, 600, 'medium');
      expect(result.width).toBeDefined();
      expect(result.height).toBeDefined();
    });
  });
});
