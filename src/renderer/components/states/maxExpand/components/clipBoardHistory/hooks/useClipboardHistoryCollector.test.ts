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
 */

/**
 * @file useClipboardHistoryCollector.test.ts
 * @description 全局剪贴板历史采集器核心逻辑单元测试（复用 prependUniqueHistoryItem 的去重语义）
 * @author 灵屿
 */

import { describe, expect, it } from 'vitest';
import { prependUniqueHistoryItem } from '../utils/clipboardHistoryUtils';
import type { ClipboardHistoryItem } from '../types/clipboardHistoryTypes';

describe('prependUniqueHistoryItem', () => {
  it('历史为空时插入第一条', () => {
    const next = prependUniqueHistoryItem([], 'hello', 100, 100);
    expect(next).toHaveLength(1);
    expect(next[0].text).toBe('hello');
    expect(next[0].createdAt).toBe(100);
  });

  it('新文本插入头部并保留旧条目', () => {
    const existing: ClipboardHistoryItem[] = [
      { id: 1, text: '旧1', createdAt: 1 },
      { id: 2, text: '旧2', createdAt: 2 },
    ];
    const next = prependUniqueHistoryItem(existing, '新', 3, 100);
    expect(next.map((i) => i.text)).toEqual(['新', '旧1', '旧2']);
  });

  it('重复文本提升到头部去重', () => {
    const existing: ClipboardHistoryItem[] = [
      { id: 1, text: 'a', createdAt: 1 },
      { id: 2, text: 'b', createdAt: 2 },
    ];
    const next = prependUniqueHistoryItem(existing, 'a', 3, 100);
    expect(next.map((i) => i.text)).toEqual(['a', 'b']);
    expect(next).toHaveLength(2);
  });

  it('按 limit 截断', () => {
    const existing: ClipboardHistoryItem[] = [
      { id: 1, text: '1', createdAt: 1 },
      { id: 2, text: '2', createdAt: 2 },
    ];
    const next = prependUniqueHistoryItem(existing, '3', 3, 2);
    expect(next).toHaveLength(2);
    expect(next[0].text).toBe('3');
  });
});
