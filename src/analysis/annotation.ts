/**
 * 截圖標註引擎
 *
 * 在截圖上疊加 SVG 標註：
 * - 變化區域邊界框 (紅色虛線)
 * - 尺寸標籤
 * - 網格覆蓋 (可選)
 */

import sharp from 'sharp';
import type { ChangedRegion } from './comparison.js';

export interface AnnotationOptions {
  /** 要標記的變化區域 */
  regions?: ChangedRegion[];
  /** 是否畫網格線 */
  grid?: boolean;
  /** 網格間距 (px) */
  gridSpacing?: number;
  /** 是否顯示尺寸標籤 */
  showDimensions?: boolean;
  /** 邊界框顏色 (CSS 色值) */
  boxColor?: string;
  /** 邊界框線寬 */
  boxStrokeWidth?: number;
}

/**
 * 在影像上疊加 SVG 標註
 *
 * @param imageBuffer 原始影像 (PNG/JPEG/WebP)
 * @param width 影像寬度
 * @param height 影像高度
 * @param options 標註選項
 * @returns 帶標註的 PNG buffer
 */
export async function annotateImage(
  imageBuffer: Buffer,
  width: number,
  height: number,
  options: AnnotationOptions = {},
): Promise<Buffer> {
  const {
    regions = [],
    grid = false,
    gridSpacing = 100,
    showDimensions = true,
    boxColor = '#ff3333',
    boxStrokeWidth = 2,
  } = options;

  const svgParts: string[] = [];

  // 網格線
  if (grid) {
    svgParts.push(buildGridSvg(width, height, gridSpacing));
  }

  // 變化區域邊界框
  for (const region of regions) {
    svgParts.push(buildRegionBoxSvg(region, boxColor, boxStrokeWidth, showDimensions));
  }

  // 如果沒有任何標註，直接返回原圖
  if (svgParts.length === 0) {
    return imageBuffer;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${svgParts.join('')}</svg>`;

  const overlay = Buffer.from(svg);

  const result = await sharp(imageBuffer)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png()
    .toBuffer();

  return result;
}

function buildGridSvg(width: number, height: number, spacing: number): string {
  const lines: string[] = [];

  // 垂直線
  for (let x = spacing; x < width; x += spacing) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>`);
  }

  // 水平線
  for (let y = spacing; y < height; y += spacing) {
    lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>`);
  }

  return lines.join('');
}

function buildRegionBoxSvg(
  region: ChangedRegion,
  color: string,
  strokeWidth: number,
  showDimensions: boolean,
): string {
  const parts: string[] = [];

  // 邊界框 (虛線)
  parts.push(
    `<rect x="${region.x}" y="${region.y}" width="${region.width}" height="${region.height}" ` +
    `fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-dasharray="6,3"/>`,
  );

  // 尺寸標籤
  if (showDimensions) {
    const label = `${region.width}×${region.height}`;
    const labelX = region.x;
    const labelY = region.y > 14 ? region.y - 4 : region.y + region.height + 14;
    parts.push(
      `<rect x="${labelX}" y="${labelY - 12}" width="${label.length * 7 + 4}" height="16" fill="${color}" rx="2"/>`,
    );
    parts.push(
      `<text x="${labelX + 2}" y="${labelY}" fill="white" font-size="11" font-family="monospace">${label}</text>`,
    );
  }

  return parts.join('');
}
