/**
 * 串流品質編碼器
 *
 * 根據品質級別將原始截圖編碼為適合串流的格式：
 * - low:    JPEG q=50, 50% scale  (~30KB/frame)
 * - medium: WebP q=75, 75% scale  (~80KB/frame)
 * - high:   PNG, 100% scale       (~300KB/frame)
 */

import { processImage, type ImageFormat, type ProcessedImage } from '../utils/image-utils.js';

export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityPreset {
  format: ImageFormat;
  quality: number;
  scale: number;
}

/** 品質預設值 */
const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  low: { format: 'jpeg', quality: 50, scale: 0.5 },
  medium: { format: 'webp', quality: 75, scale: 0.75 },
  high: { format: 'png', quality: 100, scale: 1.0 },
};

/**
 * 取得品質預設值
 */
export function getQualityPreset(level: QualityLevel): QualityPreset {
  return QUALITY_PRESETS[level];
}

/**
 * 編碼截圖為指定品質的串流格式
 *
 * @param rawPng - 原始 PNG 截圖 buffer
 * @param sourceWidth - 原始寬度
 * @param sourceHeight - 原始高度
 * @param quality - 品質級別
 * @returns 處理後的影像
 */
export async function encodeForStream(
  rawPng: Buffer,
  sourceWidth: number,
  sourceHeight: number,
  quality: QualityLevel = 'medium',
): Promise<ProcessedImage> {
  const preset = QUALITY_PRESETS[quality];
  const targetWidth = Math.round(sourceWidth * preset.scale);
  const targetHeight = Math.round(sourceHeight * preset.scale);

  return processImage(rawPng, {
    maxWidth: targetWidth,
    maxHeight: targetHeight,
    format: preset.format,
    quality: preset.quality,
  });
}
