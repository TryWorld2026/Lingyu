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
 * @file todoUtils.ts
 * @description Todo 模块纯工具函数（格式化、规范化、持久化）。
 * @author 灵屿
 */

import { LOCAL_STORAGE_KEY } from '../config/todoConfig';
import type { TodoItem } from '../types/todoTypes';

/** 格式化时间为 yyyy-mm-dd hh:mm:ss */
export function formatCreatedTime(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`;
}

/** 规范化旧数据，补全缺失字段 */
export function normalizeTodos(items: TodoItem[]): TodoItem[] {
  return items.map(t => ({
    ...t,
    description: t.description ?? '',
    subTodos: (t.subTodos ?? []).map(s => ({
      ...s,
      priority: s.priority,
      size: s.size,
    })),
  }));
}

/**
 * 读取旧待办缓存；仅供存储文件不存在时迁移，已有空列表不恢复缓存。
 * @returns 规范化后的旧待办；缓存无效时返回空列表。
 */
export function readLegacyTodos(): TodoItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const items: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? normalizeTodos(items as TodoItem[]) : [];
  } catch {
    return [];
  }
}
