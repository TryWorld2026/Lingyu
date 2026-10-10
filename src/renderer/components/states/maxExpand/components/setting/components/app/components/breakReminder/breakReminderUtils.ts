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
 * @file breakReminderUtils.ts
 * @description 休息提醒列表的清洗与旧数据迁入。
 * @description 设置页（工作台窗口）与小岛调度器（灵动岛窗口）都写这个列表，此前两处各自整表覆盖。
 *   旧数据的 id 是 string，这里在读取时统一转为稳定正整数，供 store 侧按 id 合并。
 * @author 灵屿
 */

import type { BreakReminderItem } from './breakReminderConfig';

/**
 * 把旧版 string id 映射成稳定的正整数 id。
 * @description 旧 id 形如 `1770000000000-a1b2c3`，主进程的 isStoredList 要求 id 是正整数，
 *   因此整个列表此前根本无法走原子路径。这里取时间戳部分做基数，同一毫秒的多条用递增错开：
 *   只要旧数据不变，多次加载得到同一 id，否则合并会把同一条目当成并发新增重复追加。
 */
function legacyIdToNumber(raw: string): number {
  const digits = raw.split('-')[0];
  const base = Number(digits);
  return Number.isSafeInteger(base) && base > 0 ? base : 1;
}

/**
 * 清洗并校验原始休息提醒数据。
 * @description 旧数据的 id 是 string，这里统一转为唯一正整数；重复 id 用递增改写，
 *   否则整份列表会被主进程判为非法、从此再也保存不了。
 * @param data - 原始数据
 * @returns 有效的休息提醒列表
 */
export function sanitizeBreakReminderItems(data: unknown): BreakReminderItem[] {
  if (!Array.isArray(data)) return [];
  const usedId = new Set<number>();
  const result: BreakReminderItem[] = [];
  data.forEach((entry) => {
    const row = entry as Partial<BreakReminderItem> | null;
    if (!row || typeof row !== 'object') return;
    const name = typeof row.name === 'string' ? row.name : '';
    const intervalMinutes = typeof row.intervalMinutes === 'number' && Number.isFinite(row.intervalMinutes)
      ? Math.max(1, Math.min(1440, Math.round(row.intervalMinutes)))
      : 30;
    // id 必须唯一且为正整数，否则整份列表会被主进程判为非法。
    let id = typeof row.id === 'number' && Number.isSafeInteger(row.id) && row.id > 0
      ? row.id
      : legacyIdToNumber(typeof row.id === 'string' ? row.id : '');
    while (usedId.has(id)) id += 1;
    usedId.add(id);
    const icon = typeof row.icon === 'string' && row.icon ? row.icon : undefined;
    result.push({
      id,
      name,
      intervalMinutes,
      enabled: row.enabled !== false,
      ...(icon ? { icon } : {}),
    });
  });
  return result;
}

/**
 * 生成新的条目 id。
 * @description 既要用当前时间戳（保证跨窗口不撞），也不能小于已有最大 id：
 *   系统时间回拨时 Date.now() 可能比旧 id 还小，直接用它会产生重复 id。
 * @param items - 当前列表
 * @returns 未占用的正整数 id
 */
export function nextBreakReminderId(items: BreakReminderItem[]): number {
  const maxId = items.reduce((max, item) => (item.id > max ? item.id : max), 0);
  return Math.max(Date.now(), maxId + 1);
}

