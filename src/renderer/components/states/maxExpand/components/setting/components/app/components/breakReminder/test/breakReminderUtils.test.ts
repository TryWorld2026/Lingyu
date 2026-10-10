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
 * @file breakReminderUtils.test.ts
 * @description 休息提醒清洗单元测试：string id 转正整数 id 是原子合并的前置条件
 * @author 灵屿
 */

import { describe, it, expect } from 'vitest';
import { nextBreakReminderId, sanitizeBreakReminderItems } from '../breakReminderUtils';
import { BREAK_REMINDER_LIST_KEY } from '../breakReminderConfig';
import type { BreakReminderItem } from '../breakReminderConfig';

const item = (id: number | string, name = '喝水'): Record<string, unknown> => ({
  id,
  name,
  intervalMinutes: 60,
  enabled: true,
  icon: 'data:image/svg+xml;base64,AA',
});

describe('sanitizeBreakReminderItems', () => {
  it('旧版 string id 转为稳定的正整数', () => {
    // 旧 id 形如 `1770000000000-a1b2c3`，主进程的 isStoredList 要求正整数。
    const next = sanitizeBreakReminderItems([item('1770000000000-a1b2c3')]);
    expect(next[0].id).toBe(1770000000000);
    expect(next.every((row) => Number.isSafeInteger(row.id) && row.id > 0)).toBe(true);
  });

  it('同一毫秒的多条旧数据得到互不相同的 id', () => {
    const next = sanitizeBreakReminderItems([
      item('1770000000000-aaaaaa'),
      item('1770000000000-bbbbbb'),
    ]);
    expect(next.map((row) => row.id)).toEqual([1770000000000, 1770000000001]);
  });

  it('同一份旧数据多次清洗得到同一 id，否则合并会重复追加', () => {
    const legacy = [item('1770000000000-a1b2c3'), item('1770000000001-c3d4e5')];
    const first = sanitizeBreakReminderItems(legacy).map((row) => row.id);
    const second = sanitizeBreakReminderItems(legacy).map((row) => row.id);
    expect(first).toEqual(second);
  });

  it('无法解析的旧 id 回落到 1 并递增，仍是唯一正整数', () => {
    const next = sanitizeBreakReminderItems([item('abc'), item(''), item('1770000000000-zz')]);
    expect(next.map((row) => row.id)).toEqual([1, 2, 1770000000000]);
  });

  it('已是数值 id 的原样保留', () => {
    const next = sanitizeBreakReminderItems([item(42)]);
    expect(next[0].id).toBe(42);
  });

  it('数值 id 重复时递增改写', () => {
    const next = sanitizeBreakReminderItems([item(7, 'a'), item(7, 'b')]);
    expect(next.map((row) => row.id)).toEqual([7, 8]);
  });

  it('过滤非对象行', () => {
    const next = sanitizeBreakReminderItems([null, 'x', 3, item(1)]);
    expect(next).toHaveLength(1);
  });

  it('非数组输入返回空列表', () => {
    expect(sanitizeBreakReminderItems(null)).toEqual([]);
    expect(sanitizeBreakReminderItems({} as unknown)).toEqual([]);
  });

  it('intervalMinutes 被钳制在 1..1440', () => {
    const next = sanitizeBreakReminderItems([
      { ...item(1), intervalMinutes: 0 },
      { ...item(2), intervalMinutes: 9999 },
      { ...item(3), intervalMinutes: 60.4 },
      { ...item(4), intervalMinutes: Number.NaN },
    ]);
    expect(next.map((row) => row.intervalMinutes)).toEqual([1, 1440, 60, 30]);
  });

  it('name 缺失时保留空串（由界面负责提示），enabled 缺省为 true', () => {
    const next = sanitizeBreakReminderItems([{ id: 5, intervalMinutes: 30 }]);
    expect(next[0].name).toBe('');
    expect(next[0].enabled).toBe(true);
  });

  it('icon 缺失时不写入该字段', () => {
    const next = sanitizeBreakReminderItems([{ id: 6, name: '喝水', intervalMinutes: 30, enabled: true }]);
    expect(Object.hasOwn(next[0], 'icon')).toBe(false);
  });
});

describe('nextBreakReminderId', () => {
  it('空列表取当前时间戳', () => {
    const before = Date.now();
    const id = nextBreakReminderId([]);
    expect(id).toBeGreaterThanOrEqual(before);
  });

  it('不小于已有最大 id：系统时间回拨时也不产生重复 id', () => {
    const items: BreakReminderItem[] = [{ id: 9000000000000, name: '', intervalMinutes: 30, enabled: true }];
    expect(nextBreakReminderId(items)).toBe(9000000000001);
  });

  it('连续两次调用得到不同 id', () => {
    const first = nextBreakReminderId([]);
    const second = nextBreakReminderId([{ id: first, name: '', intervalMinutes: 30, enabled: true }]);
    expect(second).not.toBe(first);
  });
});

describe('break-reminder 列表键', () => {
  it('原子列表键沿用旧整表键名，迁移后 store 文件继续复用', () => {
    expect(BREAK_REMINDER_LIST_KEY).toBe('break-reminder-items');
  });
});
