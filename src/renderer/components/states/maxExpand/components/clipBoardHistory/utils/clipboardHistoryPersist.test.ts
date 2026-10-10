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
 * @file clipboardHistoryPersist.test.ts
 * @description 剪贴板历史持久化单元测试：原子合并写入与 baseline 登记
 * @author 灵屿
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearHistory, persistHistory, setHistoryBaseline } from './clipboardHistoryUtils';
import { LOCAL_STORAGE_KEY } from '../config/clipboardHistoryConfig';
import type { ClipboardHistoryItem } from '../types/clipboardHistoryTypes';

const item = (id: number, text: string): ClipboardHistoryItem => ({ id, text, createdAt: id });

/** 等到串行写入队列排空：storeUpdateList 的 mock 同步解析，多轮微任务即可。 */
async function drained(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

describe('persistHistory', () => {
  let updates: Array<{ before: unknown[]; after: unknown[] }>;
  let storage: Map<string, string>;

  beforeEach(() => {
    updates = [];
    storage = new Map();
    vi.stubGlobal('window', {
      api: {
        storeUpdateList: vi.fn(async (_key: string, before: unknown[], after: unknown[]) => {
          updates.push({ before, after });
          return { success: true, revision: 1, data: after };
        }),
      },
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
    });
    // 每个用例从干净 baseline 开始，避免模块级状态串味。
    setHistoryBaseline([]);
  });

  it('writes through the atomic list with the registered baseline as before', async () => {
    setHistoryBaseline([item(1, '旧的')]);
    persistHistory([item(2, '新的'), item(1, '旧的')]);
    await drained();

    expect(updates).toHaveLength(1);
    expect(updates[0].before).toEqual([item(1, '旧的')]);
    expect(updates[0].after.map((row) => (row as ClipboardHistoryItem).text)).toEqual(['新的', '旧的']);
  });

  it('keeps a concurrent addition when another window clears the list', async () => {
    // 本窗口看到 [1]，另一个窗口追加了 [2]；本窗口此时清空，合并后 [2] 必须保留。
    setHistoryBaseline([item(1, 'a')]);
    persistHistory([]);
    await drained();
    expect(updates[0].before.map((row) => (row as ClipboardHistoryItem).id)).toEqual([1]);
    expect(updates[0].after).toEqual([]);
  });

  it('advances the baseline so consecutive writes chain correctly', async () => {
    persistHistory([item(1, 'a')]);
    await drained();
    persistHistory([item(1, 'a'), item(2, 'b')]);
    await drained();

    expect(updates).toHaveLength(2);
    // 第二次的 before 必须是第一次的 after，而不是空列表——否则会把新增当成从空列表重写。
    expect(updates[1].before).toEqual(updates[0].after);
    expect(updates[1].after.map((row) => (row as ClipboardHistoryItem).text)).toEqual(['a', 'b']);
  });

  it('still mirrors the list into localStorage as a read cache', async () => {
    persistHistory([item(1, 'a')]);
    await drained();
    expect(JSON.parse(storage.get(LOCAL_STORAGE_KEY) as string).map((row: ClipboardHistoryItem) => row.text)).toEqual(['a']);
  });
});

describe('clearHistory', () => {
  let updates: Array<{ before: unknown[]; after: unknown[] }>;
  let saved: ClipboardHistoryItem[];
  let storage: Map<string, string>;

  beforeEach(() => {
    updates = [];
    saved = [item(1, 'a'), item(2, 'b')];
    storage = new Map();
    vi.stubGlobal('window', {
      api: {
        storeReadList: vi.fn(async () => ({ success: true, revision: 1, data: saved, exists: true })),
        storeUpdateList: vi.fn(async (_key: string, before: unknown[], after: unknown[]) => {
          updates.push({ before, after });
          saved = after as ClipboardHistoryItem[];
          return { success: true, revision: 2, data: saved };
        }),
      },
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
    });
    setHistoryBaseline([]);
  });

  it('clears through the atomic path with the list it just read as before', async () => {
    // 设置页此前用 storeWrite 整表写 []，绕过 mergeStoredList。
    await expect(clearHistory()).resolves.toBe(true);
    await drained();

    expect(updates).toHaveLength(1);
    expect(updates[0].before.map((row) => (row as ClipboardHistoryItem).id)).toEqual([1, 2]);
    expect(updates[0].after).toEqual([]);
  });

  it('registers the read snapshot so a later collector write does not resurrect rows', async () => {
    await clearHistory();
    await drained();

    // 采集器随后在它自己看到的旧列表上追加：baseline 已是空列表，不会被当成"删掉别人的条目"。
    persistHistory([item(3, 'c')]);
    await drained();
    expect(updates[1].before).toEqual([]);
  });

  it('reports failure when the list cannot be read', async () => {
    vi.stubGlobal('window', {
      api: { storeReadList: vi.fn(async () => ({ success: false, revision: 0, data: [], error: 'failed' })) },
      dispatchEvent: vi.fn(),
    });

    await expect(clearHistory()).resolves.toBe(false);
    expect(updates).toHaveLength(0);
  });
});
