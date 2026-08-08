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
 * @file shelfUtils.test.ts
 * @description 暂存架文件操作工具单元测试（重点：拖拽文件路径提取）
 * @author 灵屿
 */

import { describe, expect, it } from 'vitest';
import { extractPathsFromFiles } from './shelfUtils';

describe('extractPathsFromFiles', () => {
  it('通过 getPathForFile 提取每个文件的路径（不依赖已移除的 File.path）', () => {
    const fakeFile = { name: 'a.txt' } as unknown as File;
    const getPathForFile = (f: File): string => f === fakeFile ? 'C:/tmp/a.txt' : '';
    const paths = extractPathsFromFiles([fakeFile], getPathForFile);
    expect(paths).toEqual(['C:/tmp/a.txt']);
  });

  it('过滤掉无法解析出路径的文件', () => {
    const files = [
      { name: 'ok.txt' },
      { name: 'no-path.txt' },
    ] as unknown as File[];
    const getPathForFile = (f: File): string => (f as { name: string }).name === 'ok.txt' ? 'C:/ok.txt' : '';
    const paths = extractPathsFromFiles(files, getPathForFile);
    expect(paths).toEqual(['C:/ok.txt']);
  });

  it('空文件列表返回空数组', () => {
    const paths = extractPathsFromFiles([], () => '');
    expect(paths).toEqual([]);
  });
});
