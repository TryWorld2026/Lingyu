/*
 * 灵屿 Lingyu - 免费开源的 Windows 桌面灵动岛（基于 eIsland 二次开发）
 * https://github.com/JNTMTMTM/eIsland
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 *
 * Original author: JNTMTMTM[](https://github.com/JNTMTMTM)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

/**
 * @file shelfSlice.test.ts
 * @description 暂存架 Slice 单元测试：id 稳定性、原子合并写入与旧数据迁移
 * @author 灵屿
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createShelfSlice } from '../shelfSlice';
import type { ShelfItem } from '../../types';

type ShelfState = ReturnType<typeof createShelfSlice>;

function createSliceState(): { getState: () => ShelfState } {
  let state = {} as ShelfState;
  const setState = (updater: Partial<ShelfState> | ((prev: ShelfState) => Partial<ShelfState>)): void => {
    const patch = typeof updater === 'function' ? updater(state) : updater;
    state = { ...state, ...patch };
  };
  state = createShelfSlice(setState as never, (() => state) as never, {} as never);
  return { getState: () => state };
}

/** 等到串行写入队列排空：storeUpdateList 的 mock 同步解析，多轮微任务即可。 */
async function persistDrained(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

describe('createShelfSlice', () => {
  /** 模拟 store:read-list / store:update-list 的原子语义 */
  let saved: ShelfItem[];
  let fileExists: boolean;
  let updateCalls: Array<{ before: ShelfItem[]; after: ShelfItem[] }>;
  const api = {
    storeRead: vi.fn(async (): Promise<unknown> => []),
    storeReadList: vi.fn(async () => ({ success: true, revision: 1, data: saved, exists: fileExists })),
    storeUpdateList: vi.fn(async (_key: string, before: ShelfItem[], after: ShelfItem[]) => {
      updateCalls.push({ before, after });
      saved = after;
      fileExists = true;
      return { success: true, revision: 2, data: saved };
    }),
  };

  beforeEach(() => {
    saved = [];
    fileExists = false;
    updateCalls = [];
    Object.values(api).forEach((mock) => mock.mockClear());
    Object.defineProperty(globalThis, 'window', {
      value: { api },
      configurable: true,
      writable: true,
    });
  });

  it('assigns stable ids to legacy rows without an id', async () => {
    const legacy = [
      { path: 'D:\\old-a.txt', name: 'old-a.txt', addedAt: 1700000000000 },
      { path: 'D:\\old-b.txt', name: 'old-b.txt', addedAt: 1700000000000 },
    ];
    saved = [];
    api.storeRead.mockResolvedValueOnce(legacy);
    const { getState } = createSliceState();

    await getState().loadShelfItems();
    const first = getState().shelfItems.map((item) => item.id);

    // 原子列表不存在 → 读取旧键并迁入，legacy 行被补齐 id 后写入。
    expect(api.storeUpdateList).toHaveBeenCalledWith('shelf', [], expect.any(Array));
    expect(getState().shelfItems.map((item) => item.path)).toEqual(['D:\\old-a.txt', 'D:\\old-b.txt']);
    expect(first.every((id) => Number.isSafeInteger(id) && id > 0)).toBe(true);
    expect(new Set(first).size).toBe(2);

    // 同一份旧数据再次加载必须得到同一组 id，否则合并会把它当成并发新增重复追加。
    saved = legacy.map((row, index) => ({ ...row, id: first[index] }));
    await getState().loadShelfItems();
    expect(getState().shelfItems.map((item) => item.id)).toEqual(first);
  });

  it('writes through the atomic list with the previous snapshot as before', async () => {
    const { getState } = createSliceState();
    await getState().loadShelfItems();
    updateCalls.length = 0;

    // 三个写入方内部各自持久化一次；等队列排空后检查实际发出的 before/after。
    getState().addShelfItems(['D:\\a.txt', 'D:\\b.txt']);
    getState().removeShelfItem('D:\\a.txt');
    await persistDrained();

    expect(updateCalls).toHaveLength(2);
    expect(updateCalls[0].before).toEqual([]);
    expect(updateCalls[0].after.map((item) => item.path)).toEqual(['D:\\a.txt', 'D:\\b.txt']);
    // 同批新增的条目必须拿到互不相同的 id。
    expect(new Set(updateCalls[0].after.map((item) => item.id)).size).toBe(2);

    // 第二次写入的 before 必须是第一次的 after，而不是空快照——
    // 否则会把剔除当成从空列表重写，丢失并发窗口的修改。
    expect(updateCalls[1].before).toEqual(updateCalls[0].after);
    expect(updateCalls[1].after.map((item) => item.path)).toEqual(['D:\\b.txt']);
  });

  it('does not resurrect a concurrently removed row when clearing from a stale snapshot', async () => {
    const { getState } = createSliceState();
    await getState().loadShelfItems();
    getState().addShelfItems(['D:\\a.txt']);
    await getState().persistShelfItems();

    // 另一个窗口已经清空；本窗口仍拿旧快照清空一次，结果应保持空。
    saved = [];
    fileExists = true;
    getState().clearShelfItems();
    await getState().persistShelfItems();
    expect(saved).toEqual([]);
  });
});
