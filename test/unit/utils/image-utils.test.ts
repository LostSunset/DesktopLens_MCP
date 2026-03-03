import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock sharp before importing
const mockMetadata = vi.fn();
const mockResize = vi.fn();
const mockJpeg = vi.fn();
const mockWebp = vi.fn();
const mockPng = vi.fn();
const mockToBuffer = vi.fn();

function createMockPipeline() {
  const pipeline = {
    metadata: mockMetadata,
    resize: mockResize,
    jpeg: mockJpeg,
    webp: mockWebp,
    png: mockPng,
    toBuffer: mockToBuffer,
  };
  mockResize.mockReturnValue(pipeline);
  mockJpeg.mockReturnValue(pipeline);
  mockWebp.mockReturnValue(pipeline);
  mockPng.mockReturnValue(pipeline);
  return pipeline;
}

vi.mock('sharp', () => {
  return {
    default: vi.fn(() => createMockPipeline()),
  };
});

import { processImage, toBase64, autoResizeOptions } from '../../../src/utils/image-utils.js';

describe('processImage', () => {
  const fakeInput = Buffer.from('fake-image');
  const fakeOutput = Buffer.from('processed');

  beforeEach(() => {
    vi.clearAllMocks();
    mockMetadata.mockResolvedValue({ width: 800, height: 600 });
    mockToBuffer.mockResolvedValue(fakeOutput);
  });

  it('processes PNG by default', async () => {
    const result = await processImage(fakeInput);
    expect(mockPng).toHaveBeenCalled();
    expect(result.format).toBe('png');
    expect(result.buffer).toBe(fakeOutput);
  });

  it('processes JPEG with quality', async () => {
    await processImage(fakeInput, { format: 'jpeg', quality: 60 });
    expect(mockJpeg).toHaveBeenCalledWith({ quality: 60 });
  });

  it('processes WebP with quality', async () => {
    await processImage(fakeInput, { format: 'webp', quality: 50 });
    expect(mockWebp).toHaveBeenCalledWith({ quality: 50 });
  });

  it('uses default JPEG quality when not specified', async () => {
    await processImage(fakeInput, { format: 'jpeg' });
    expect(mockJpeg).toHaveBeenCalledWith({ quality: 80 });
  });

  it('uses default WebP quality when not specified', async () => {
    await processImage(fakeInput, { format: 'webp' });
    expect(mockWebp).toHaveBeenCalledWith({ quality: 75 });
  });

  it('resizes with maxWidth and maxHeight', async () => {
    await processImage(fakeInput, { maxWidth: 640, maxHeight: 480 });
    expect(mockResize).toHaveBeenCalledWith({
      width: 640,
      height: 480,
      fit: 'inside',
      withoutEnlargement: true,
    });
  });

  it('does not resize when no max dimensions', async () => {
    await processImage(fakeInput);
    expect(mockResize).not.toHaveBeenCalled();
  });

  it('resizes with only maxWidth', async () => {
    await processImage(fakeInput, { maxWidth: 640 });
    expect(mockResize).toHaveBeenCalledWith({
      width: 640,
      height: undefined,
      fit: 'inside',
      withoutEnlargement: true,
    });
  });

  it('handles undefined metadata width/height', async () => {
    mockMetadata.mockResolvedValue({});
    const result = await processImage(fakeInput);
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });

  it('resizes with only maxHeight', async () => {
    await processImage(fakeInput, { maxHeight: 480 });
    expect(mockResize).toHaveBeenCalledWith({
      width: undefined,
      height: 480,
      fit: 'inside',
      withoutEnlargement: true,
    });
  });
});

describe('toBase64', () => {
  it('returns PNG data URI', () => {
    const result = toBase64(Buffer.from('test'), 'png');
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it('returns JPEG data URI', () => {
    const result = toBase64(Buffer.from('test'), 'jpeg');
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('returns WebP data URI', () => {
    const result = toBase64(Buffer.from('test'), 'webp');
    expect(result).toMatch(/^data:image\/webp;base64,/);
  });
});

describe('autoResizeOptions', () => {
  it('returns empty for small images (<=1MP)', () => {
    expect(autoResizeOptions(800, 600)).toEqual({});
  });

  it('returns 1280x960 for medium images (1-4MP)', () => {
    const opts = autoResizeOptions(1920, 1080);
    expect(opts.maxWidth).toBe(1280);
    expect(opts.maxHeight).toBe(960);
  });

  it('returns 1024x768 for large images (>4MP)', () => {
    const opts = autoResizeOptions(3840, 2160);
    expect(opts.maxWidth).toBe(1024);
    expect(opts.maxHeight).toBe(768);
  });

  it('boundary: exactly 1MP returns empty', () => {
    expect(autoResizeOptions(1000, 1000)).toEqual({});
  });

  it('boundary: just over 4MP returns 1024x768', () => {
    const opts = autoResizeOptions(2001, 2001);
    expect(opts.maxWidth).toBe(1024);
  });
});
