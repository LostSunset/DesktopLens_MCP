/**
 * desktoplens_compare 工具
 *
 * 比較 before/after 截圖，回傳差異分析結果。
 * 支援多種來源：snapshot ID、window ID、window title。
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v4';
import type { CaptureEngine } from '../capture/engine.js';
import type { WindowDetector } from '../window-manager/detector.js';
import type { SnapshotStore } from '../analysis/snapshot-store.js';
import { compareImages } from '../analysis/comparison.js';
import { annotateImage } from '../analysis/annotation.js';
import { toBase64 } from '../utils/image-utils.js';

export interface CompareDeps {
  engine: CaptureEngine;
  detector: WindowDetector;
  snapshotStore: SnapshotStore;
}

export function registerCompare(
  server: McpServer,
  deps: CompareDeps,
): void {
  const { engine, detector, snapshotStore } = deps;

  server.tool(
    'desktoplens_compare',
    'Compare two screenshots to detect UI changes',
    {
      before_snapshot_id: z.string().optional()
        .describe('Snapshot ID for the "before" image (from previous screenshot)'),
      before_window_id: z.number().optional()
        .describe('Window ID to use latest snapshot as "before"'),
      before_window_title: z.string().optional()
        .describe('Window title to use latest snapshot as "before"'),
      after_window_id: z.number().optional()
        .describe('Window ID to capture as "after" image'),
      after_window_title: z.string().optional()
        .describe('Window title to capture as "after" image'),
      highlight_diff: z.boolean().optional()
        .describe('Whether to highlight differences (default: true)'),
      threshold: z.number().min(0).max(1).optional()
        .describe('Color difference threshold (0-1, default: 0.1)'),
    },
    async (params): Promise<CallToolResult> => {
      try {
        // 解析 before 來源
        const beforeBuffer = await resolveBeforeImage(params, snapshotStore);

        // 解析 after 來源 — 擷取新截圖
        const afterBuffer = await resolveAfterImage(params, engine, detector);

        // 比較
        const result = await compareImages(beforeBuffer, afterBuffer, {
          threshold: params.threshold,
          highlightDiff: params.highlight_diff ?? true,
        });

        // 如果需要高亮，在差異影像上加標註
        let outputImage = result.diffImage;
        if ((params.highlight_diff ?? true) && result.changedRegions.length > 0) {
          outputImage = await annotateImage(
            result.diffImage,
            result.width,
            result.height,
            { regions: result.changedRegions },
          );
        }

        const content: CallToolResult['content'] = [
          {
            type: 'text',
            text: JSON.stringify({
              similarity_score: Math.round(result.similarityScore * 10000) / 10000,
              diff_pixel_count: result.diffPixelCount,
              total_pixels: result.totalPixels,
              dimensions: { width: result.width, height: result.height },
              changes_detected: result.changedRegions.map(r => ({
                region: { x: r.x, y: r.y, width: r.width, height: r.height },
                type: 'visual_change',
              })),
            }),
          },
        ];

        // 附加差異影像
        if (outputImage.length > 0) {
          const base64 = toBase64(outputImage, 'png');
          content.push({
            type: 'image',
            data: base64.split(',')[1]!,
            mimeType: 'image/png',
          });
        }

        return { content };
      } catch (err) {
        return {
          isError: true,
          content: [
            { type: 'text', text: err instanceof Error ? err.message : String(err) },
          ],
        };
      }
    },
  );
}

async function resolveBeforeImage(
  params: {
    before_snapshot_id?: string;
    before_window_id?: number;
    before_window_title?: string;
  },
  snapshotStore: SnapshotStore,
): Promise<Buffer> {
  if (params.before_snapshot_id) {
    const snap = snapshotStore.get(params.before_snapshot_id);
    if (!snap) {
      throw new Error(`Snapshot not found: ${params.before_snapshot_id}`);
    }
    return snap.buffer;
  }

  if (params.before_window_id !== undefined) {
    const snap = snapshotStore.getLatestByWindow(params.before_window_id);
    if (!snap) {
      throw new Error(`No snapshot found for window ID: ${params.before_window_id}`);
    }
    return snap.buffer;
  }

  if (params.before_window_title) {
    // 搜尋所有快照找 title 匹配的
    const all = snapshotStore.list();
    const match = all.find(s =>
      s.windowTitle.toLowerCase().includes(params.before_window_title!.toLowerCase()),
    );
    if (!match) {
      throw new Error(`No snapshot found for window title: ${params.before_window_title}`);
    }
    return match.buffer;
  }

  throw new Error('Must provide before_snapshot_id, before_window_id, or before_window_title');
}

async function resolveAfterImage(
  params: {
    after_window_id?: number;
    after_window_title?: string;
  },
  engine: CaptureEngine,
  detector: WindowDetector,
): Promise<Buffer> {
  if (params.after_window_id !== undefined) {
    return await engine.captureWindow(params.after_window_id);
  }

  if (params.after_window_title) {
    const result = await engine.captureByTitle(params.after_window_title);
    return result.buffer;
  }

  throw new Error('Must provide after_window_id or after_window_title');
}
