/**
 * UI 比較引擎
 *
 * 使用 pixelmatch 進行像素級差異比較，
 * 然後用 flood-fill 找出變化區域 (changedRegions)。
 */

import sharp from 'sharp';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export interface ChangedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComparisonResult {
  /** 相似度 (0-1, 1=完全相同) */
  similarityScore: number;
  /** 不同的像素數 */
  diffPixelCount: number;
  /** 總像素數 */
  totalPixels: number;
  /** 變化區域 */
  changedRegions: ChangedRegion[];
  /** 差異影像 (PNG buffer, 紅色高亮差異處) */
  diffImage: Buffer;
  /** 影像尺寸 */
  width: number;
  height: number;
}

export interface CompareOptions {
  /** pixelmatch 色差容忍度 (0-1, 預設 0.1) */
  threshold?: number;
  /** 是否生成差異影像 (預設 true) */
  highlightDiff?: boolean;
}

/**
 * 比較兩張截圖
 *
 * 將 before/after 解碼為原始像素，用 pixelmatch 比較，
 * 然後用 flood-fill 聚合變化區域。
 */
export async function compareImages(
  beforeBuffer: Buffer,
  afterBuffer: Buffer,
  options: CompareOptions = {},
): Promise<ComparisonResult> {
  const { threshold = 0.1, highlightDiff = true } = options;

  // 解碼為原始 RGBA 像素
  const beforeRaw = await sharp(beforeBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const afterRaw = await sharp(afterBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = beforeRaw.info;
  const afterWidth = afterRaw.info.width;
  const afterHeight = afterRaw.info.height;

  // 如果尺寸不同，調整 after 到 before 的大小
  let afterPixels = afterRaw.data;
  if (afterWidth !== width || afterHeight !== height) {
    const resized = await sharp(afterBuffer)
      .resize(width, height, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer();
    afterPixels = resized;
  }

  const totalPixels = width * height;

  // 建立差異輸出 buffer
  const diffOutput = new Uint8Array(width * height * 4);

  // pixelmatch 比較
  const diffPixelCount = pixelmatch(
    new Uint8Array(beforeRaw.data.buffer, beforeRaw.data.byteOffset, beforeRaw.data.byteLength),
    new Uint8Array(afterPixels.buffer, afterPixels.byteOffset, afterPixels.byteLength),
    diffOutput,
    width,
    height,
    { threshold },
  );

  const similarityScore = totalPixels > 0 ? 1 - diffPixelCount / totalPixels : 1;

  // 找出變化區域 (flood-fill 聚合)
  const changedRegions = findChangedRegions(diffOutput, width, height);

  // 生成差異影像 PNG
  let diffImage: Buffer;
  if (highlightDiff) {
    const png = new PNG({ width, height });
    png.data = Buffer.from(diffOutput);
    diffImage = PNG.sync.write(png);
  } else {
    diffImage = Buffer.alloc(0);
  }

  return {
    similarityScore,
    diffPixelCount,
    totalPixels,
    changedRegions,
    diffImage,
    width,
    height,
  };
}

/**
 * 從 pixelmatch 差異像素中找出變化區域
 *
 * 將差異像素投影到 grid，然後用連通分量分析聚合相鄰的變化格子。
 */
function findChangedRegions(
  diffPixels: Uint8Array,
  width: number,
  height: number,
): ChangedRegion[] {
  // 用 16px grid 簡化分析
  const gridSize = 16;
  const gridCols = Math.ceil(width / gridSize);
  const gridRows = Math.ceil(height / gridSize);
  const grid = new Uint8Array(gridCols * gridRows); // 0=unchanged, 1=changed

  // 掃描差異像素，標記有變化的 grid cell
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // pixelmatch 將差異像素畫為紅色 (r=255, g=0, b=0 or similar)
      // 非差異像素為透明或原色
      // 檢查紅色通道 > 0 且 alpha > 0 作為差異標記
      if (diffPixels[idx]! > 0 && diffPixels[idx + 3]! > 0) {
        const gx = Math.floor(x / gridSize);
        const gy = Math.floor(y / gridSize);
        grid[gy * gridCols + gx] = 1;
      }
    }
  }

  // 連通分量分析 (4-connectivity flood fill)
  const visited = new Uint8Array(gridCols * gridRows);
  const regions: ChangedRegion[] = [];

  for (let gy = 0; gy < gridRows; gy++) {
    for (let gx = 0; gx < gridCols; gx++) {
      const idx = gy * gridCols + gx;
      if (grid[idx] === 1 && !visited[idx]) {
        // Flood fill 找連通分量
        let minX = gx, maxX = gx, minY = gy, maxY = gy;
        const queue: Array<[number, number]> = [[gx, gy]];
        visited[idx] = 1;

        while (queue.length > 0) {
          const [cx, cy] = queue.pop()!;
          minX = Math.min(minX, cx);
          maxX = Math.max(maxX, cx);
          minY = Math.min(minY, cy);
          maxY = Math.max(maxY, cy);

          // 4-connectivity neighbors
          for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx >= 0 && nx < gridCols && ny >= 0 && ny < gridRows) {
              const nIdx = ny * gridCols + nx;
              if (grid[nIdx] === 1 && !visited[nIdx]) {
                visited[nIdx] = 1;
                queue.push([nx, ny]);
              }
            }
          }
        }

        // 轉回像素座標
        regions.push({
          x: minX * gridSize,
          y: minY * gridSize,
          width: Math.min((maxX + 1) * gridSize, width) - minX * gridSize,
          height: Math.min((maxY + 1) * gridSize, height) - minY * gridSize,
        });
      }
    }
  }

  return regions;
}
