/**
 * Plugin Marketplace
 *
 * 使用 GitHub Search API 搜尋帶有 "desktoplens-plugin" topic 的 repo。
 */

import type { Logger } from '../utils/logger.js';

export interface MarketplacePlugin {
  name: string;
  description: string;
  author: string;
  url: string;
  stars: number;
  updatedAt: string;
}

export interface MarketplaceResult {
  plugins: MarketplacePlugin[];
  total: number;
  error?: string;
}

/**
 * 搜尋 GitHub 上的 DesktopLens plugin
 */
export async function searchMarketplace(
  query: string,
  logger: Logger,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<MarketplaceResult> {
  try {
    const searchQuery = encodeURIComponent(`${query} topic:desktoplens-plugin`);
    const url = `https://api.github.com/search/repositories?q=${searchQuery}&sort=stars&order=desc&per_page=20`;

    const response = await fetchFn(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'desktoplens-mcp',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn('GitHub API error', { status: response.status, body: errorText });
      return {
        plugins: [],
        total: 0,
        error: `GitHub API returned ${response.status}`,
      };
    }

    const data = await response.json() as {
      total_count: number;
      items: Array<{
        name: string;
        description: string | null;
        owner: { login: string };
        html_url: string;
        stargazers_count: number;
        updated_at: string;
      }>;
    };

    const plugins: MarketplacePlugin[] = data.items.map((item) => ({
      name: item.name,
      description: item.description ?? '',
      author: item.owner.login,
      url: item.html_url,
      stars: item.stargazers_count,
      updatedAt: item.updated_at,
    }));

    return {
      plugins,
      total: data.total_count,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('Marketplace search failed', { error: errorMsg });
    return {
      plugins: [],
      total: 0,
      error: errorMsg,
    };
  }
}
