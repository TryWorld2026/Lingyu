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

/** 暂存架持久化存储键名 */
const SHELF_STORE_KEY = 'lingyu-shelf-items';

/** 路径去重键（Windows 路径不区分大小写） */
function normalizeShelfKey(path: string): string {
  return path.trim().toLowerCase();
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
  return paths.map((path) => {
    const name = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
    return { path, name, addedAt: Date.now() };
  });
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

  loadShelfItems: async () => {
    try {
      const raw = await window.api.storeRead(SHELF_STORE_KEY);
      const items = Array.isArray(raw)
        ? raw
          .filter((item): item is ShelfItem => Boolean(item) && typeof item === 'object'
            && typeof (item as ShelfItem).path === 'string')
          .map((item) => ({
            path: (item as ShelfItem).path,
            name: typeof (item as ShelfItem).name === 'string' ? (item as ShelfItem).name
              : ((item as ShelfItem).path.split(/[\\/]/).filter(Boolean).pop() ?? (item as ShelfItem).path),
            addedAt: typeof (item as ShelfItem).addedAt === 'number' ? (item as ShelfItem).addedAt : Date.now(),
          }))
        : [];
      set({ shelfItems: items, shelfLoaded: true });
    } catch {
      set({ shelfLoaded: true });
    }
  },

  persistShelfItems: async () => {
    try {
      await window.api.storeWrite(SHELF_STORE_KEY, get().shelfItems);
    } catch {
      // 持久化失败不阻断操作
    }
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
