/**
 * 記憶體快照儲存
 *
 * LRU eviction 策略的截圖快照儲存。
 * 用於 before/after 比較：截圖時自動保存，compare 時取回。
 */

export interface Snapshot {
  id: string;
  windowId: number;
  windowTitle: string;
  buffer: Buffer;
  width: number;
  height: number;
  capturedAt: number;
}

export interface SnapshotStore {
  /** 儲存快照，回傳快照 ID */
  save(data: Omit<Snapshot, 'id' | 'capturedAt'>): string;
  /** 依 ID 取回快照 */
  get(id: string): Snapshot | undefined;
  /** 取得指定視窗的最新快照 */
  getLatestByWindow(windowId: number): Snapshot | undefined;
  /** 列出所有快照 (最新在前) */
  list(): Snapshot[];
  /** 清除所有快照 */
  clear(): void;
  /** 目前儲存數量 */
  readonly size: number;
}

/** 建立 SnapshotStore (LRU, 最多 maxSize 筆) */
export function createSnapshotStore(maxSize: number = 50): SnapshotStore {
  const snapshots = new Map<string, Snapshot>();
  let counter = 0;

  function evictIfNeeded(): void {
    while (snapshots.size >= maxSize) {
      // 刪除最舊的 (Map 保持插入順序)
      const oldest = snapshots.keys().next().value;
      if (oldest !== undefined) {
        snapshots.delete(oldest);
      }
    }
  }

  return {
    save(data: Omit<Snapshot, 'id' | 'capturedAt'>): string {
      evictIfNeeded();
      counter++;
      const id = `snap-${counter}`;
      const snapshot: Snapshot = {
        ...data,
        id,
        capturedAt: Date.now(),
      };
      snapshots.set(id, snapshot);
      return id;
    },

    get(id: string): Snapshot | undefined {
      return snapshots.get(id);
    },

    getLatestByWindow(windowId: number): Snapshot | undefined {
      // 反向遍歷找最新的
      const entries = Array.from(snapshots.values());
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i]!.windowId === windowId) {
          return entries[i];
        }
      }
      return undefined;
    },

    list(): Snapshot[] {
      return Array.from(snapshots.values()).reverse();
    },

    clear(): void {
      snapshots.clear();
    },

    get size(): number {
      return snapshots.size;
    },
  };
}
