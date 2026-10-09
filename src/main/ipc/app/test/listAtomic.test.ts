/*
 * 灵屿 Lingyu - 免费开源的 Windows 桌面灵动岛（基于 eIsland 二次开发）
 * https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3, or (at your option) any later version.
 */

/**
 * @file listAtomic.test.ts
 * @description 实际文件存储的跨窗口条目合并、字段冲突与删除回归。
 * @author 灵屿
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trustedEvent } from '../../../test-utils/trustedEvent';
const { handlers } = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => unknown>() }));
vi.mock('electron', () => ({
  ipcMain: { handle: (key: string, handler: (...args: unknown[]) => unknown) => handlers.set(key, handler), on: vi.fn() },
  shell: {},
}));
vi.mock('../../../utils/broadcast', () => ({ broadcastSettingChange: vi.fn() }));
import { registerStoreIpcHandlers } from '../store';
let directory: string;
let file: string;
const base = [{ id: 1, label: 'A', enabled: true }, { id: 2, label: 'B', enabled: true }];
const change = (before: unknown[], after: unknown[], key = 'alarms') => {
  expect(handlers.has('store:update-list')).toBe(true);
  return handlers.get('store:update-list')!(trustedEvent(), key, before, after) as { success: boolean; error?: string; data: unknown[] };
};
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'lingyu-list-'));
  file = join(directory, 'alarms.json');
  writeFileSync(file, JSON.stringify(base));
  handlers.clear();
  registerStoreIpcHandlers({ storeDir: directory });
});
afterEach(() => { rmSync(directory, { recursive: true, force: true }); });

describe('store:update-list', () => {
  it('preserves edits of different entries from stale snapshots', () => {
    expect(change(base, [base[0], { ...base[1], label: 'changed B' }]).success).toBe(true);
    expect(change(base, [{ ...base[0], label: 'changed A' }, base[1]]).success).toBe(true);
    expect(JSON.parse(readFileSync(file, 'utf8')).map((item: { label: string }) => item.label)).toEqual(['changed A', 'changed B']);
  });
  it('preserves different fields of the same entry', () => {
    expect(change(base, [{ ...base[0], enabled: false }, base[1]]).success).toBe(true);
    expect(change(base, [{ ...base[0], label: 'renamed' }, base[1]]).success).toBe(true);
    expect(JSON.parse(readFileSync(file, 'utf8'))[0]).toEqual({ id: 1, label: 'renamed', enabled: false });
  });
  it('rejects conflicting edits of the same field without writing', () => {
    change(base, [{ ...base[0], label: 'first' }, base[1]]);
    const result = change(base, [{ ...base[0], label: 'second' }, base[1]]);
    expect(result).toMatchObject({ success: false, error: 'conflict' });
    expect(JSON.parse(readFileSync(file, 'utf8'))[0].label).toBe('first');
  });
  it('retains a concurrent addition when another entry is deleted', () => {
    change(base, [...base, { id: 3, label: 'new', enabled: true }]);
    expect(change(base, [base[1]]).success).toBe(true);
    expect(JSON.parse(readFileSync(file, 'utf8')).map((item: { id: number }) => item.id)).toEqual([2, 3]);
  });
  it('does not resurrect a concurrently removed entry', () => {
    change(base, [base[1]]);
    expect(change(base, [{ ...base[0], label: 'stale edit' }, base[1]])).toMatchObject({ success: false, error: 'conflict' });
    expect(JSON.parse(readFileSync(file, 'utf8')).map((item: { id: number }) => item.id)).toEqual([2]);
  });
  it('supports countdowns and rejects arbitrary paths or duplicate ids', () => {
    expect(change([], [{ id: 1, title: 'owned' }], 'countdown-dates').success).toBe(true);
    expect(change([], [], '../unsafe')).toMatchObject({ success: false, error: 'invalid' });
    expect(change([], [{ id: 1 }, { id: 1 }])).toMatchObject({ success: false, error: 'invalid' });
  });
  it.each(['todos', 'memos'])('merges %s edits across windows', (key) => {
    expect(change([], base, key).success).toBe(true);
    expect(change(base, [base[0], { ...base[1], label: 'B changed' }], key).success).toBe(true);
    expect(change(base, [{ ...base[0], label: 'A changed' }, base[1]], key).success).toBe(true);
    expect(JSON.parse(readFileSync(join(directory, `${key}.json`), 'utf8'))
      .map((item: { label: string }) => item.label)).toEqual(['A changed', 'B changed']);
  });
  it('keeps url-favorites additions from two windows and honours a prepended position', () => {
    const workspace = [{ id: 1, url: 'https://a.example', title: 'A', note: '', folder: '', createdAt: 1 }];
    expect(change([], workspace, 'url-favorites').success).toBe(true);

    // 通知窗口读到 workspace 后前插一条：合并后它应留在最前，而不是被挪到末尾。
    const fromNotification = [{ id: 2, url: 'https://b.example', title: 'B', note: '', folder: '', createdAt: 2 }, ...workspace];
    expect(change(workspace, fromNotification, 'url-favorites').success).toBe(true);
    expect(JSON.parse(readFileSync(join(directory, 'url-favorites.json'), 'utf8'))
      .map((item: { id: number }) => item.id)).toEqual([2, 1]);

    // 工作台同时读到旧快照并追加一条：旧整表覆盖只会留下后写的那条，合并必须把三条都保住。
    const fromWorkspaceTab = [...workspace, { id: 3, url: 'https://c.example', title: 'C', note: '', folder: '', createdAt: 3 }];
    expect(change(workspace, fromWorkspaceTab, 'url-favorites').success).toBe(true);
    const saved = JSON.parse(readFileSync(join(directory, 'url-favorites.json'), 'utf8'));
    expect(saved.map((item: { id: number }) => item.id).sort()).toEqual([1, 2, 3]);
    // 写入方自己的排列被尊重：1 仍在 3 之前。
    expect(saved.findIndex((item: { id: number }) => item.id === 1))
      .toBeLessThan(saved.findIndex((item: { id: number }) => item.id === 3));
  });
  it('rejects url-favorites rows that repeat an id', () => {
    const row = { id: 7, url: 'https://x.example', title: 'X', note: '', folder: '', createdAt: 7 };
    expect(change([], [row, { ...row }], 'url-favorites')).toMatchObject({ success: false, error: 'invalid' });
  });
  it('distinguishes a missing file from an intentionally empty list', () => {
    const read = (): unknown => handlers.get('store:read-list')!(trustedEvent(), 'todos');
    expect(read()).toMatchObject({ success: true, exists: false, data: [] });
    expect(change([], [], 'todos').success).toBe(true);
    expect(read()).toMatchObject({ success: true, exists: true, data: [] });
  });
  it('merges note timestamps while retaining edits of different fields', () => {
    const notes = [{ id: 1, title: 'original', bookmarked: false, updatedAt: 100 }];
    expect(change([], notes, 'memos').success).toBe(true);
    expect(change(notes, [{ ...notes[0], title: 'new title', updatedAt: 200 }], 'memos').success).toBe(true);
    expect(change(notes, [{ ...notes[0], bookmarked: true, updatedAt: 300 }], 'memos').success).toBe(true);
    expect(JSON.parse(readFileSync(join(directory, 'memos.json'), 'utf8'))[0])
      .toEqual({ id: 1, title: 'new title', bookmarked: true, updatedAt: 300 });
  });
  it('accepts a normal task archive larger than 1000 entries', () => {
    const tasks = Array.from({ length: 1001 }, (_, index) => ({ id: index + 1, text: `task ${index}` }));
    expect(change([], tasks, 'todos').success).toBe(true);
  });
  it('rejects an oversized merged list without corrupting the saved archive', () => {
    const tasks = Array.from({ length: 20000 }, (_, index) => ({ id: index + 1 }));
    expect(change([], tasks, 'todos').success).toBe(true);
    expect(change([], [{ id: 20001 }], 'todos')).toMatchObject({ success: false, error: 'invalid' });
    expect(JSON.parse(readFileSync(join(directory, 'todos.json'), 'utf8'))).toHaveLength(20000);
  });
  it('keeps shelf additions from two windows and rejects rows without a positive id', () => {
    const shelf = (id: number, path: string): { id: number; path: string; name: string; addedAt: number } =>
      ({ id, path, name: path, addedAt: 1000 + id });
    const workspace = [shelf(1, 'D:\\a.txt')];
    expect(change([], workspace, 'shelf').success).toBe(true);

    // 小岛窗口读到 workspace 后追加一条：合并后两条都应保留，顺序以操作方为准。
    const fromIsland = [...workspace, shelf(2, 'D:\\b.txt')];
    expect(change(workspace, fromIsland, 'shelf').success).toBe(true);

    // 工作台窗口在旧快照上删除第一条：此时存档为 [2]。
    expect(change(workspace, [], 'shelf').success).toBe(true);
    // 小岛在它看到的 [1,2] 上追加第三条：并发新增生效，已被删掉的 1 不被复活。
    expect(change(fromIsland, [...fromIsland, shelf(3, 'D:\\c.txt')], 'shelf').success).toBe(true);

    const saved = JSON.parse(readFileSync(join(directory, 'shelf.json'), 'utf8')) as Array<{ id: number }>;
    expect(saved.map((item) => item.id)).toEqual([2, 3]);
    expect(change([], [{ path: 'D:\\legacy.txt', name: 'legacy', addedAt: 1 }], 'shelf'))
      .toMatchObject({ success: false, error: 'invalid' });
  });
});
