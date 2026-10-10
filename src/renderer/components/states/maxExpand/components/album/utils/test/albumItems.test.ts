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
 * @file albumItems.test.ts
 * @description 相册条目清洗单元测试：id 唯一性是原子合并的前置条件
 * @author 灵屿
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeAlbumItems } from '../albumUtils';
import { LOCAL_STORAGE_KEY } from '../../config/albumConfig';
import type { AlbumItem } from '../../types/albumTypes';

const item = (id: number, path: string): AlbumItem => ({
  id,
  path,
  name: path.split('\\').pop() ?? path,
  ext: path.split('.').pop() ?? '',
  mediaType: 'image',
  addedAt: id,
});

describe('sanitizeAlbumItems', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
  });

  it('保留合法条目', () => {
    const next = sanitizeAlbumItems([item(1, 'C:\\a.jpg'), item(2, 'C:\\b.png')]);
    expect(next.map((row) => row.id)).toEqual([1, 2]);
  });

  it('同一毫秒的重复 id 被递增改写，保证整份列表能通过 isStoredList', () => {
    // 旧实现直接用 addedAt 兜底 id，同一毫秒新增两条会产生重复 id。
    const next = sanitizeAlbumItems([item(100, 'C:\\a.jpg'), item(100, 'C:\\b.jpg')]);
    expect(next.map((row) => row.id)).toEqual([100, 101]);
  });

  it('同一路径只保留第一条', () => {
    const next = sanitizeAlbumItems([item(1, 'C:\\a.jpg'), item(2, 'C:\\A.JPG')]);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe(1);
  });

  it('非正 id 与非法 id 回退到 addedAt', () => {
    const next = sanitizeAlbumItems([
      { ...item(0, 'C:\\a.jpg'), id: 0 },
      { ...item(5, 'C:\\b.jpg'), id: 1.5 },
      { ...item(7, 'C:\\c.jpg'), id: -3 },
    ]);
    // id=0 非法 → 回退到该行的 addedAt；1.5 与 -3 同理。
    expect(next.map((row) => row.id)).toEqual([0, 5, 7]);
  });

  it('过滤不支持的扩展名与空路径', () => {
    const next = sanitizeAlbumItems([
      item(1, 'C:\\a.txt'),
      item(2, '  '),
      { ...item(3, 'C:\\c.jpg'), path: '' },
      // mediaType 非 image/video 时回落到按扩展名推导。
      { ...item(4, 'C:\\d.jpg'), mediaType: 'audio' as AlbumItem['mediaType'] },
    ]);
    expect(next.map((row) => row.id)).toEqual([4]);
    expect(next[0].mediaType).toBe('image');
  });

  it('读取 localStorage 兜底键不被误用为 store 键', () => {
    expect(LOCAL_STORAGE_KEY).toBe('lingyu_photo_album_items');
  });
});
