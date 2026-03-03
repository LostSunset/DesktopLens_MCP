import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchMarketplace } from '../../../src/plugin/marketplace.js';

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('marketplace', () => {
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    logger = createMockLogger();
  });

  it('searches GitHub and returns results', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        total_count: 2,
        items: [
          {
            name: 'desktoplens-plugin-grid',
            description: 'Grid overlay plugin',
            owner: { login: 'someuser' },
            html_url: 'https://github.com/someuser/desktoplens-plugin-grid',
            stargazers_count: 42,
            updated_at: '2025-06-01T00:00:00Z',
          },
          {
            name: 'desktoplens-plugin-color',
            description: null,
            owner: { login: 'otheruser' },
            html_url: 'https://github.com/otheruser/desktoplens-plugin-color',
            stargazers_count: 10,
            updated_at: '2025-05-15T00:00:00Z',
          },
        ],
      }),
    });

    const result = await searchMarketplace('grid', logger, mockFetch as unknown as typeof fetch);

    expect(result.total).toBe(2);
    expect(result.plugins).toHaveLength(2);
    expect(result.plugins[0]!.name).toBe('desktoplens-plugin-grid');
    expect(result.plugins[0]!.author).toBe('someuser');
    expect(result.plugins[0]!.stars).toBe(42);
    expect(result.plugins[1]!.description).toBe('');
    expect(result.error).toBeUndefined();

    // Verify URL construction
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('topic%3Adesktoplens-plugin'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': 'desktoplens-mcp',
        }),
      }),
    );
  });

  it('handles GitHub API error response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: vi.fn().mockResolvedValue('rate limited'),
    });

    const result = await searchMarketplace('test', logger, mockFetch as unknown as typeof fetch);

    expect(result.plugins).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.error).toContain('403');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('handles network error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('network down'));

    const result = await searchMarketplace('test', logger, mockFetch as unknown as typeof fetch);

    expect(result.plugins).toEqual([]);
    expect(result.error).toContain('network down');
    expect(logger.error).toHaveBeenCalled();
  });

  it('handles non-Error thrown', async () => {
    const mockFetch = vi.fn().mockRejectedValue('string error');

    const result = await searchMarketplace('test', logger, mockFetch as unknown as typeof fetch);

    expect(result.error).toBe('string error');
  });

  it('returns empty results when no matches', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        total_count: 0,
        items: [],
      }),
    });

    const result = await searchMarketplace('nonexistent', logger, mockFetch as unknown as typeof fetch);

    expect(result.plugins).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.error).toBeUndefined();
  });
});
