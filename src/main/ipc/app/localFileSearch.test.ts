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
 * @file localFileSearch.test.ts
 * @description 本地文件搜索工具单元测试
 * @author 灵屿
 */

import { describe, expect, it } from 'vitest';
import { matchesSearchQuery, searchLocalFiles } from './localFileSearch';
import type { LocalFileSearchItem } from './types';

describe('matchesSearchQuery', () => {
  it('contains 模式：名称包含关键字', () => {
    expect(matchesSearchQuery({ name: 'report_2026.pdf' }, 'report', { matchMode: 'contains', matchScope: 'name' })).toBe(true);
    expect(matchesSearchQuery({ name: 'photo.png' }, 'report', { matchMode: 'contains', matchScope: 'name' })).toBe(false);
  });

  it('exact 模式：名称精确匹配', () => {
    expect(matchesSearchQuery({ name: 'todo.txt' }, 'todo.txt', { matchMode: 'exact', matchScope: 'name' })).toBe(true);
    expect(matchesSearchQuery({ name: 'todo.txt.bak' }, 'todo.txt', { matchMode: 'exact', matchScope: 'name' })).toBe(false);
  });

  it('默认不区分大小写', () => {
    expect(matchesSearchQuery({ name: 'Report.PDF' }, 'report', { matchMode: 'contains', matchScope: 'name' })).toBe(true);
  });

  it('caseSensitive 时区分大小写', () => {
    expect(matchesSearchQuery({ name: 'Report.PDF' }, 'report', { matchMode: 'contains', matchScope: 'name', caseSensitive: true })).toBe(false);
  });

  it('matchScope=path 时匹配完整路径', () => {
    expect(matchesSearchQuery({ name: 'a.txt', path: 'C:/docs/a.txt' }, 'docs', { matchMode: 'contains', matchScope: 'path' })).toBe(true);
  });
});

describe('searchLocalFiles', () => {
  it('不存在的目录返回空数组', async () => {
    const results = await searchLocalFiles('Z:/__nonexistent__', 'x');
    expect(results).toEqual([]);
  });

  it('递归找到深层文件', async () => {
    const results = await searchLocalFiles(process.cwd(), 'package.json', { maxDepth: 2, limit: 20 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.name === 'package.json')).toBe(true);
  });

  it('limit 限制返回数量', async () => {
    const results = await searchLocalFiles(process.cwd(), 'json', { maxDepth: 3, limit: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('默认排除 node_modules（即使调用方传空数组）', async () => {
    const results = await searchLocalFiles(process.cwd(), 'some-nm-file', {
      maxDepth: 3, limit: 5, excludeDirs: [],
    });
    // 进程 cwd 的 node_modules 不应出现在结果中（排除目录生效）
    expect(results.every((r: LocalFileSearchItem) => !r.path.includes('node_modules'))).toBe(true);
  });
});
