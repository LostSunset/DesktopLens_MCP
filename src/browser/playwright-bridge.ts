/**
 * Playwright Bridge
 *
 * 動態載入 playwright 並提供 Chrome Viewer 自動啟動功能。
 * 若 playwright 未安裝，graceful degradation — 回傳 isAvailable: false。
 */

import type { Logger } from '../utils/logger.js';

export interface PlaywrightBridge {
  /** playwright 是否可用 */
  readonly isAvailable: boolean;
  /** 開啟 Chrome 瀏覽器並導航到指定 URL */
  openViewer(url: string): Promise<void>;
  /** 關閉所有已開啟的瀏覽器 */
  closeAll(): Promise<void>;
}

/**
 * 建立 Playwright Bridge
 *
 * 動態 import('playwright') — 若未安裝則 graceful degrade。
 */
export async function createPlaywrightBridge(logger: Logger): Promise<PlaywrightBridge> {
  let playwrightModule: { chromium: { launch: (opts: Record<string, unknown>) => Promise<unknown> } } | null = null;
  let browsers: Array<{ close(): Promise<void> }> = [];

  try {
    // Dynamic import — playwright is optional
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    playwrightModule = await import(/* webpackIgnore: true */ 'playwright' as string);
    logger.debug('Playwright available');
  } catch {
    logger.info('Playwright not available — browser viewer will not auto-open');
  }

  return {
    get isAvailable(): boolean {
      return playwrightModule !== null;
    },

    async openViewer(url: string): Promise<void> {
      if (!playwrightModule) {
        logger.warn('Cannot open viewer: playwright not available');
        return;
      }

      try {
        const browser = await playwrightModule.chromium.launch({
          headless: false,
          args: ['--app=' + url, '--window-size=1280,720'],
        }) as { close(): Promise<void>; newPage(): Promise<{ goto(url: string): Promise<void> }> };

        browsers.push(browser);
        const page = await browser.newPage();
        await page.goto(url);
        logger.info('Viewer opened', { url });
      } catch (err) {
        logger.error('Failed to open viewer', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },

    async closeAll(): Promise<void> {
      for (const browser of browsers) {
        try {
          await browser.close();
        } catch {
          // Ignore close errors
        }
      }
      browsers = [];
      logger.debug('All browsers closed');
    },
  };
}
