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
 * @file appShortcuts.test.ts
 * @description 快捷启动清洗单元测试：id 唯一且为正整数是原子合并的前置条件
 * @author 灵屿
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readLegacyAppShortcuts, sanitizeAppShortcuts } from '../appShortcuts';
import { APPS_LOCAL_STORAGE_KEY, APPS_STORE_LIST_KEY } from '../constants';
import type { AppShortcut } from '../types';

const item = (id: number, path: string): AppShortcut => ({
  id,
  name: path.split('\\').pop() ?? path,
  path,
  iconBase64: null,
});

describe('sanitizeAppShortcuts', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
  });

  it('保留合法条目', () => {
    const next = sanitizeAppShortcuts([item(1, 'C:\\a.exe'), item(2, 'C:\\b.lnk')]);
    expect(next.map((row) => row.id)).toEqual([1, 2]);
    expect(next[0]).toEqual({ id: 1, name: 'a.exe', path: 'C:\\a.exe', iconBase64: null });
  });

  it('旧实现的 Date.now() + Math.random() 小数 id 被改写为整数', () => {
    // 小数 id 会让主进程的 isStoredList 判整份列表非法，从此再也保存不了。
    const next = sanitizeAppShortcuts([
      { ...item(0, 'C:\\a.exe'), id: 1770000000000.4141 },
      { ...item(0, 'C:\\b.exe'), id: 1770000000000.9267 },
    ]);
    expect(next.every((row) => Number.isSafeInteger(row.id) && row.id > 0)).toBe(true);
    expect(new Set(next.map((row) => row.id)).size).toBe(2);
  });

  it('同一毫秒的重复 id 被递增改写', () => {
    const next = sanitizeAppShortcuts([item(100, 'C:\\a.exe'), item(100, 'C:\\b.exe')]);
    expect(next.map((row) => row.id)).toEqual([100, 101]);
  });

  it('非正 id 与非法 id 被替换且保持唯一', () => {
    const next = sanitizeAppShortcuts([
      { ...item(0, 'C:\\a.exe'), id: 0 },
      { ...item(0, 'C:\\b.exe'), id: -3 },
      { ...item(0, 'C:\\c.exe'), id: Number.NaN },
    ]);
    expect(next).toHaveLength(3);
    expect(new Set(next.map((row) => row.id)).size).toBe(3);
    expect(next.every((row) => Number.isSafeInteger(row.id) && row.id > 0)).toBe(true);
  });

  it('同一路径只保留第一条（Windows 路径不区分大小写）', () => {
    const next = sanitizeAppShortcuts([item(1, 'C:\\a.exe'), item(2, 'C:\\A.EXE')]);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe(1);
  });

  it('过滤空路径与非字符串路径', () => {
    const next = sanitizeAppShortcuts([item(1, '  '), item(2, ''), null, 'x', { name: 'no path' }]);
    expect(next).toEqual([]);
  });

  it('name 为空时回落到路径', () => {
    const next = sanitizeAppShortcuts([{ ...item(3, 'C:\\tools\\app.exe'), name: '   ' }]);
    expect(next[0].name).toBe('app.exe');
  });

  it('非数组输入返回空列表', () => {
    expect(sanitizeAppShortcuts(null)).toEqual([]);
    expect(sanitizeAppShortcuts({} as unknown)).toEqual([]);
  });
});

describe('readLegacyAppShortcuts', () => {
  it('读取 localStorage 兜底键并清洗', () => {
    const getItem = vi.fn(() => JSON.stringify([
      { id: 1770000000000.4141, name: 'a', path: 'C:\\a.exe' },
      { path: 'C:\\b.exe' },
    ]));
    vi.stubGlobal('localStorage', { getItem, setItem: vi.fn() });

    const next = readLegacyAppShortcuts();
    expect(getItem).toHaveBeenCalledWith(APPS_LOCAL_STORAGE_KEY);
    expect(next).toHaveLength(2);
    expect(next.every((row) => Number.isSafeInteger(row.id) && row.id > 0)).toBe(true);
  });

  it('没有缓存或解析失败时返回空列表', () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
    expect(readLegacyAppShortcuts()).toEqual([]);

    vi.stubGlobal('localStorage', { getItem: vi.fn(() => 'not json'), setItem: vi.fn() });
    expect(readLegacyAppShortcuts()).toEqual([]);
  });
});

describe('app-shortcuts 列表键', () => {
  it('原子列表键与旧整表键同名，迁移后 store 文件继续复用', () => {
    expect(APPS_STORE_LIST_KEY).toBe('app-shortcuts');
  });

  it('localStorage 兜底键不与 store 键同名', () => {
    expect(APPS_LOCAL_STORAGE_KEY).not.toBe(APPS_STORE_LIST_KEY);
  });
});
