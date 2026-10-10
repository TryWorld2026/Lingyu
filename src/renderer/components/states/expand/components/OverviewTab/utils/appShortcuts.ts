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
 * @file appShortcuts.ts
 * @description 快捷启动列表的清洗与旧缓存迁入。
 * @description 工作台的系统工具页与总览页都会写这个列表，且分属不同窗口。
 * @author 灵屿
 */

import { APPS_LOCAL_STORAGE_KEY } from './constants';
import type { AppShortcut } from './types';

/**
 * 清洗并校验原始快捷启动数据。
 * @description 同时去掉重复 id 与非正整数 id：旧实现用 `Date.now() + Math.random()` 生成 id，
 *   那是小数，主进程的 isStoredList 会直接判整份列表非法，从此无法保存。
 * @param data - 原始数据
 * @returns 有效的快捷启动列表
 */
export function sanitizeAppShortcuts(data: unknown): AppShortcut[] {
  if (!Array.isArray(data)) return [];
  const usedId = new Set<number>();
  const usedPath = new Set<string>();
  const result: AppShortcut[] = [];
  data.forEach((entry) => {
    const row = entry as Partial<AppShortcut> | null;
    if (!row || typeof row.path !== 'string') return;
    const path = row.path.trim();
    if (!path) return;
    const lowerPath = path.toLowerCase();
    if (usedPath.has(lowerPath)) return;
    usedPath.add(lowerPath);
    // 旧数据可能没有 name，回落取文件名而不是整条路径：界面上一个格子放不下全路径。
    const name = typeof row.name === 'string' && row.name.trim()
      ? row.name.trim()
      : (path.split(/[\\/]/).filter(Boolean).pop() ?? path);
    const iconBase64 = typeof row.iconBase64 === 'string' ? row.iconBase64 : null;
    // id 必须唯一且为正整数，否则整份列表会被主进程判为非法。
    let id = typeof row.id === 'number' && Number.isSafeInteger(row.id) && row.id > 0 ? row.id : Date.now();
    while (usedId.has(id)) id += 1;
    usedId.add(id);
    result.push({ id, name, path, iconBase64 });
  });
  return result;
}

/**
 * 读取 localStorage 里的旧快捷启动缓存，供 store 文件不存在时一次性迁入。
 * @returns 旧缓存中的条目；没有或解析失败时为空列表。
 */
export function readLegacyAppShortcuts(): AppShortcut[] {
  try {
    const raw = localStorage.getItem(APPS_LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return sanitizeAppShortcuts(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}
