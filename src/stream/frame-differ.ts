/**
 * 幀差異比較器
 *
 * 將影像劃分為 gridCols × gridRows 的區塊，
 * 透過簡易 hash 比較找出變化的 dirty blocks，
 * 只傳輸有變化的區塊以節省頻寬。
 */

import sharp from 'sharp';
import type { DirtyBlock } from './protocol.js';

/** 預設 grid 大小 */
export const DEFAULT_GRID_COLS = 8;
export const DEFAULT_GRID_ROWS = 6;

export interface DiffResult {
  /** 是否有任何變化 */
  changed: boolean;
  /** 變化的區塊列表 */
  dirtyBlocks: DirtyBlock[];
  /** Grid 欄數 */
  gridCols: number;
  /** Grid 列數 */
  gridRows: number;
}

/**
 * 計算 raw pixel buffer 某區域的簡易 hash
 *
 * 取樣策略：每隔 step 個像素取 RGBA 值，累積 hash。
 * 不需要密碼學安全，只需快速偵測變化。
 */
export function blockHash(
  pixels: Buffer,
  stride: number,
  x: number,
  y: number,
  w: number,
  h: number,
  channels: number,
): number {
  let hash = 5381; // DJB2 seed
  const step = Math.max(1, Math.floor(Math.min(w, h) / 8));

  for (let row = y; row < y + h; row += step) {
    for (let col = x; col < x + w; col += step) {
      const offset = (row * stride + col) * channels;
      for (let c = 0; c < channels; c++) {
        // DJB2 hash: hash * 33 + value
        hash = ((hash << 5) + hash + (pixels[offset + c]! & 0xff)) | 0;
      }
    }
  }

  return hash;
}

/**
 * 比較兩個幀的差異
 *
 * @param prevPng - 前一幀的 PNG buffer
 * @param currPng - 當前幀的 PNG buffer
 * @param gridCols - 水平分割數
 * @param gridRows - 垂直分割數
 * @returns 差異結果包含 dirty blocks（每個 block 是裁切後的 PNG）
 */
export async function diffFrames(
  prevPng: Buffer,
  currPng: Buffer,
  gridCols: number = DEFAULT_GRID_COLS,
  gridRows: number = DEFAULT_GRID_ROWS,
): Promise<DiffResult> {
  // 解碼為 raw RGBA pixels
  const [prevRaw, currRaw] = await Promise.all([
    sharp(prevPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(currPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);

  const { width, height } = prevRaw.info;
  const channels = 4; // RGBA
  const stride = width;

  const blockW = Math.floor(width / gridCols);
  const blockH = Math.floor(height / gridRows);

  const dirtyBlocks: DirtyBlock[] = [];

  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const bx = col * blockW;
      const by = row * blockH;
      // 最後一欄/列包含餘數像素
      const bw = col === gridCols - 1 ? width - bx : blockW;
      const bh = row === gridRows - 1 ? height - by : blockH;

      const prevHash = blockHash(prevRaw.data, stride, bx, by, bw, bh, channels);
      const currHash = blockHash(currRaw.data, stride, bx, by, bw, bh, channels);

      if (prevHash !== currHash) {
        // 裁切 dirty block 為 PNG
        const blockPng = await sharp(currPng)
          .extract({ left: bx, top: by, width: bw, height: bh })
          .png()
          .toBuffer();

        dirtyBlocks.push({ col, row, data: blockPng });
      }
    }
  }

  return {
    changed: dirtyBlocks.length > 0,
    dirtyBlocks,
    gridCols,
    gridRows,
  };
}
