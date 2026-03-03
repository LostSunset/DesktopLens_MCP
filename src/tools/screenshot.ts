import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v4';
import type { CaptureEngine, WindowInfo } from '../capture/engine.js';
import type { WindowDetector } from '../window-manager/detector.js';
import { processImage, toBase64, autoResizeOptions, type ImageFormat } from '../utils/image-utils.js';

export function registerScreenshot(
  server: McpServer,
  engine: CaptureEngine,
  detector: WindowDetector,
): void {
  server.tool(
    'desktoplens_screenshot',
    'Capture a screenshot of a specific desktop window',
    {
      window_id: z.number().optional().describe('Window ID to capture'),
      window_title: z.string().optional().describe('Window title to match (fuzzy)'),
      format: z.enum(['png', 'jpeg', 'webp']).optional().describe('Output image format'),
      max_width: z.number().optional().describe('Max width for auto-resize'),
      max_height: z.number().optional().describe('Max height for auto-resize'),
    },
    async ({ window_id, window_title, format, max_width, max_height }): Promise<CallToolResult> => {
      try {
        let rawBuffer: Buffer;
        let windowInfo: WindowInfo;

        if (window_id !== undefined) {
          windowInfo = await detector.findWindow({ id: window_id });
          rawBuffer = await engine.captureWindow(window_id);
        } else if (window_title !== undefined) {
          const result = await engine.captureByTitle(window_title);
          windowInfo = result.window;
          rawBuffer = result.buffer;
        } else {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Must provide window_id or window_title' }],
          };
        }

        const autoOpts = autoResizeOptions(windowInfo.width, windowInfo.height);
        const outputFormat: ImageFormat = format ?? 'png';
        const processed = await processImage(rawBuffer, {
          maxWidth: max_width ?? autoOpts.maxWidth,
          maxHeight: max_height ?? autoOpts.maxHeight,
          format: outputFormat,
        });

        const base64 = toBase64(processed.buffer, processed.format);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                format: processed.format,
                dimensions: { width: processed.width, height: processed.height },
                window_info: { title: windowInfo.title, appName: windowInfo.appName },
              }),
            },
            {
              type: 'image',
              data: base64.split(',')[1]!,
              mimeType: `image/${processed.format === 'jpeg' ? 'jpeg' : processed.format}`,
            },
          ],
        };
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
