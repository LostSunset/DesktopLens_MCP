import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSnapshotStore, type SnapshotStore } from '../../../src/analysis/snapshot-store.js';

describe('snapshot-store', () => {
  let store: SnapshotStore;

  beforeEach(() => {
    store = createSnapshotStore(5); // maxSize=5 for testing
  });

  describe('save', () => {
    it('returns incremental snapshot IDs', () => {
      const id1 = store.save({ windowId: 1, windowTitle: 'Win1', buffer: Buffer.from('a'), width: 100, height: 50 });
      const id2 = store.save({ windowId: 2, windowTitle: 'Win2', buffer: Buffer.from('b'), width: 200, height: 100 });
      expect(id1).toBe('snap-1');
      expect(id2).toBe('snap-2');
    });

    it('increments size on save', () => {
      expect(store.size).toBe(0);
      store.save({ windowId: 1, windowTitle: 'W', buffer: Buffer.from('x'), width: 10, height: 10 });
      expect(store.size).toBe(1);
    });

    it('evicts oldest when at maxSize', () => {
      for (let i = 0; i < 5; i++) {
        store.save({ windowId: i, windowTitle: `W${i}`, buffer: Buffer.from(`data-${i}`), width: 10, height: 10 });
      }
      expect(store.size).toBe(5);

      // Save one more — should evict snap-1 (oldest)
      store.save({ windowId: 99, windowTitle: 'New', buffer: Buffer.from('new'), width: 10, height: 10 });
      expect(store.size).toBe(5);
      expect(store.get('snap-1')).toBeUndefined();
      expect(store.get('snap-6')).toBeDefined();
    });
  });

  describe('get', () => {
    it('returns saved snapshot by ID', () => {
      const id = store.save({ windowId: 1, windowTitle: 'Test', buffer: Buffer.from('img'), width: 100, height: 50 });
      const snap = store.get(id);
      expect(snap).toBeDefined();
      expect(snap!.id).toBe(id);
      expect(snap!.windowId).toBe(1);
      expect(snap!.windowTitle).toBe('Test');
      expect(snap!.buffer.toString()).toBe('img');
      expect(snap!.width).toBe(100);
      expect(snap!.height).toBe(50);
      expect(snap!.capturedAt).toBeGreaterThan(0);
    });

    it('returns undefined for non-existent ID', () => {
      expect(store.get('snap-999')).toBeUndefined();
    });
  });

  describe('getLatestByWindow', () => {
    it('returns the most recent snapshot for a window', () => {
      store.save({ windowId: 1, windowTitle: 'W1', buffer: Buffer.from('old'), width: 10, height: 10 });
      store.save({ windowId: 2, windowTitle: 'W2', buffer: Buffer.from('other'), width: 10, height: 10 });
      store.save({ windowId: 1, windowTitle: 'W1', buffer: Buffer.from('new'), width: 10, height: 10 });

      const latest = store.getLatestByWindow(1);
      expect(latest).toBeDefined();
      expect(latest!.id).toBe('snap-3');
      expect(latest!.buffer.toString()).toBe('new');
    });

    it('returns undefined for non-existent window', () => {
      expect(store.getLatestByWindow(999)).toBeUndefined();
    });
  });

  describe('list', () => {
    it('returns all snapshots in reverse chronological order', () => {
      store.save({ windowId: 1, windowTitle: 'A', buffer: Buffer.from('a'), width: 10, height: 10 });
      store.save({ windowId: 2, windowTitle: 'B', buffer: Buffer.from('b'), width: 10, height: 10 });
      store.save({ windowId: 3, windowTitle: 'C', buffer: Buffer.from('c'), width: 10, height: 10 });

      const list = store.list();
      expect(list).toHaveLength(3);
      expect(list[0]!.id).toBe('snap-3'); // newest first
      expect(list[1]!.id).toBe('snap-2');
      expect(list[2]!.id).toBe('snap-1'); // oldest last
    });

    it('returns empty array when store is empty', () => {
      expect(store.list()).toEqual([]);
    });
  });

  describe('clear', () => {
    it('removes all snapshots', () => {
      store.save({ windowId: 1, windowTitle: 'W', buffer: Buffer.from('x'), width: 10, height: 10 });
      store.save({ windowId: 2, windowTitle: 'W', buffer: Buffer.from('y'), width: 10, height: 10 });
      expect(store.size).toBe(2);

      store.clear();
      expect(store.size).toBe(0);
      expect(store.list()).toEqual([]);
    });
  });

  describe('default maxSize', () => {
    it('uses default maxSize of 50', () => {
      const defaultStore = createSnapshotStore();
      for (let i = 0; i < 50; i++) {
        defaultStore.save({ windowId: i, windowTitle: `W${i}`, buffer: Buffer.from(`d${i}`), width: 1, height: 1 });
      }
      expect(defaultStore.size).toBe(50);

      // 51st should evict the first
      defaultStore.save({ windowId: 99, windowTitle: 'Extra', buffer: Buffer.from('extra'), width: 1, height: 1 });
      expect(defaultStore.size).toBe(50);
      expect(defaultStore.get('snap-1')).toBeUndefined();
    });
  });
});
