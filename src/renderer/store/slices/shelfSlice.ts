/*
 * 灵屿 Lingyu - 免费开源的 Windows 桌面灵动岛（基于 eIsland 二次开发）
 * https://github.com/JNTMTMTM/eIsland
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 *
 * Original author: JNTMTMTM
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @file shelfSlice.ts
 * @description 文件暂存架状态管理 Slice（Yoink 式：只存路径引用，不复制文件本体）
 * @author 灵屿
 */

import type { StateCreator } from 'zustand';
import type { ShelfItem, ShelfSlice } from '../types';
import type { StoredListKey } from '../../../shared/listStore';

/** 原子列表键（store 侧按 id 合并，跨窗口写入不再整表覆盖） */
const SHELF_LIST_KEY: StoredListKey = 'shelf';
/** 旧版整表存储键，仅用于一次性迁移读取 */
const LEGACY_SHELF_STORE_KEY = 'lingyu-shelf-items';

/** 最近一次与磁盘一致（或已提交）的快照，作为下一次合并的 before */
let rawBefore: ShelfItem[] = [];
/** 串行写入队列，保证 before/after 不会交错 */
let queue: Promise<void> = Promise.resolve();
/** 在途写入数 */
let pending = 0;

/** 路径去重键（Windows 路径不区分大小写） */
function normalizeShelfKey(path: string): string {
  return path.trim().toLowerCase();
}

/** 归一化单条暂存架记录：补齐 id、name 与 addedAt。 */
function normalizeShelfItem(value: unknown): ShelfItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Partial<ShelfItem>;
  if (typeof raw.path !== 'string' || raw.path.length === 0) return null;
  const name = typeof raw.name === 'string' && raw.name.length > 0
    ? raw.name
    : (raw.path.split(/[\\/]/).filter(Boolean).pop() ?? raw.path);
  return { id: 0, path: raw.path, name, addedAt: typeof raw.addedAt === 'number' ? raw.addedAt : Date.now() };
}

/**
 * 给旧数据补稳定 id。
 * @description 旧条目没有 id，若每次加载都新分配，原子合并会把同一条目当成并发新增重复追加。
 *   这里按 addedAt 与同 addedAt 内的索引推导：只要旧数据不变，多次加载得到同一 id。
 */
function assignStableIds(items: ShelfItem[]): ShelfItem[] {
  const seen = new Map<number, number>();
  return items.map((item) => {
    const bucket = item.addedAt;
    const index = seen.get(bucket) ?? 0;
    seen.set(bucket, index + 1);
    // 同 addedAt 的第 index 条：用时间戳左移 8 位加序号，错开不同秒之间的碰撞。
    const id = (bucket % 0x7fffffff) * 256 + index;
    return { ...item, id };
  });
}

function dedupePaths(paths: string[], existing: ShelfItem[]): string[] {
  const seen = new Set(existing.map((item) => normalizeShelfKey(item.path)));
  return paths.filter((p) => {
    const key = normalizeShelfKey(p);
    if (!p || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function makeShelfItems(paths: string[]): ShelfItem[] {
  const now = Date.now();
  return paths.map((path, index) => ({
    // 同一批拖入也要互不相同的 id：用批次时间戳错开序号位。
    id: (now % 0x7fffffff) * 256 + index,
    path,
    name: path.split(/[\\/]/).filter(Boolean).pop() ?? path,
    addedAt: now,
  }));
}

export const createShelfSlice: StateCreator<
  ShelfSlice,
  [],
  [],
  ShelfSlice
> = (set, get) => ({
  shelfItems: [],
  shelfLoaded: false,
  shelfDragActive: false,

  /**
   * 读取暂存架列表。
   * @description 优先读原子列表；文件不存在时把旧版整表键迁移进来，之后不再写旧键。
   *   旧数据没有 id，用 assignStableIds 按 addedAt 与索引补齐，保证重复加载得到同一 id。
   */
  loadShelfItems: async () => {
    try {
      const api = window.api;
      let result = await api.storeReadList(SHELF_LIST_KEY);
      if (result.exists === false) {
        const legacyRaw = await api.storeRead(LEGACY_SHELF_STORE_KEY);
        const legacy = assignStableIds(
          Array.isArray(legacyRaw) ? legacyRaw.map(normalizeShelfItem).filter((i): i is ShelfItem => i !== null) : [],
        );
        // 迁移写入后必须用返回的最新列表，否则旧数据不会出现在界面上。
        if (legacy.length > 0) result = await api.storeUpdateList(SHELF_LIST_KEY, [], legacy);
      }
      const items = assignStableIds(
        (Array.isArray(result.data) ? result.data : [])
          .map(normalizeShelfItem)
          .filter((item): item is ShelfItem => item !== null),
      );
      rawBefore = items;
      set({ shelfItems: items, shelfLoaded: true });
    } catch {
      set({ shelfLoaded: true });
    }
  },

    persistShelfItems: async (): Promise<void> => {
    const before = rawBefore;
    const after = get().shelfItems;
    rawBefore = after;
    pending += 1;
    queue = queue.then(async () => {
      try {
        await window.api.storeUpdateList(SHELF_LIST_KEY, before, after);
      } catch {
        // 持久化失败不阻断操作；下一次写入仍会带上最新快照。
      } finally {
        pending -= 1;
      }
    });
    // 返回队列本身：调用方 await 后即表示这次写入已落盘或已失败。
    await queue;
  },

  addShelfItems: (paths) => {
    const next = [...get().shelfItems, ...makeShelfItems(dedupePaths(paths, get().shelfItems))];
    set({ shelfItems: next });
    void get().persistShelfItems();
  },

  removeShelfItem: (path) => {
    set({ shelfItems: get().shelfItems.filter((item) => item.path !== path) });
    void get().persistShelfItems();
  },

  clearShelfItems: () => {
    set({ shelfItems: [] });
    void get().persistShelfItems();
  },

  setShelfDragActive: (active) => set({ shelfDragActive: active }),
});
