import sharp from 'sharp';

export type ImageFormat = 'png' | 'jpeg' | 'webp';

export interface ResizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  format?: ImageFormat;
  quality?: number;
}

export interface ProcessedImage {
  buffer: Buffer;
  format: ImageFormat;
  width: number;
  height: number;
}

export async function processImage(
  input: Buffer,
  options: ResizeOptions = {},
): Promise<ProcessedImage> {
  const { maxWidth, maxHeight, format = 'png', quality } = options;

  let pipeline = sharp(input);
  const metadata = await sharp(input).metadata();
  let width = metadata.width ?? 0;
  let height = metadata.height ?? 0;

  if (maxWidth || maxHeight) {
    pipeline = pipeline.resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality: quality ?? 80 });
      break;
    case 'webp':
      pipeline = pipeline.webp({ quality: quality ?? 75 });
      break;
    case 'png':
      pipeline = pipeline.png();
      break;
  }

  const buffer = await pipeline.toBuffer();
  const outputMeta = await sharp(buffer).metadata();
  width = outputMeta.width ?? width;
  height = outputMeta.height ?? height;

  return { buffer, format, width, height };
}

export function toBase64(buffer: Buffer, format: ImageFormat): string {
  const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

export function autoResizeOptions(width: number, height: number): ResizeOptions {
  const pixels = width * height;
  if (pixels <= 1_000_000) return {};
  if (pixels <= 4_000_000) return { maxWidth: 1280, maxHeight: 960 };
  return { maxWidth: 1024, maxHeight: 768 };
}
