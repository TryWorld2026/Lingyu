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
 * @file clipboardHistoryUtils.test.ts
 * @description 剪贴板历史工具函数单元测试（重点：去重插入核心逻辑）
 * @author 灵屿
 */

import { describe, expect, it } from 'vitest';
import { prependUniqueHistoryItem, normalizeClipboardText } from './clipboardHistoryUtils';
import type { ClipboardHistoryItem } from '../types/clipboardHistoryTypes';

const makeItem = (text: string, id = Date.now()): ClipboardHistoryItem => ({
  id,
  text: normalizeClipboardText(text),
  createdAt: id,
});

describe('prependUniqueHistoryItem', () => {
  it('新文本插入到头部', () => {
    const list = [makeItem('旧的', 100)];
    const next = prependUniqueHistoryItem(list, '新的', 200, 100);
    expect(next.map((i) => i.text)).toEqual(['新的', '旧的']);
  });

  it('重复文本移动到头部而不是重复插入', () => {
    const list = [makeItem('a', 100), makeItem('b', 200)];
    const next = prependUniqueHistoryItem(list, 'a', 300, 100);
    expect(next.map((i) => i.text)).toEqual(['a', 'b']);
    expect(next).toHaveLength(2);
  });

  it('按 limit 截断', () => {
    const list = [makeItem('1', 1), makeItem('2', 2)];
    const next = prependUniqueHistoryItem(list, '3', 3, 2);
    expect(next).toHaveLength(2);
    expect(next[0].text).toBe('3');
  });
});
