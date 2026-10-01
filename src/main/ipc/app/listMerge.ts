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
 * @file listMerge.ts
 * @description 按条目及字段合并用户改动，同字段冲突时保留已保存数据。
 * @author 灵屿
 */

type Row = Record<string, unknown> & { id: number };
const equal = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

/**
 * 检查可合并的列表，限制大小并拒绝重复 ID 与原型字段。
 * @param data - IPC 或文件中的列表。
 * @returns 是否为有效列表。
 */
export function isStoredList(data: unknown): data is Row[] {
  if (!Array.isArray(data) || data.length > 20000) return false;
  try {
    if (Buffer.byteLength(JSON.stringify(data), 'utf8') > 32 * 1024 * 1024) return false;
  } catch {
    return false;
  }
  const ids = new Set<number>();
  return data.every((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)
      || !Number.isSafeInteger(row.id) || row.id <= 0 || ids.has(row.id)
      || Object.keys(row).some((key) => ['__proto__', 'constructor', 'prototype'].includes(key))) return false;
    ids.add(row.id);
    return true;
  });
}

/**
 * 将用户修改合并到最新列表；不覆盖无关条目或其他字段。
 * @param current - 当前已保存列表。
 * @param before - 用户操作前看到的列表。
 * @param after - 用户操作后期望的列表。
 * @returns 合并后的列表；冲突时返回 null，整个操作不写入。
 */
export function mergeStoredList(current: Row[], before: Row[], after: Row[]): Row[] | null {
  const next = new Map(current.map((row) => [row.id, { ...row }]));
  const oldRows = new Map(before.map((row) => [row.id, row]));
  const newRows = new Map(after.map((row) => [row.id, row]));
  for (const old of before) {
    if (newRows.has(old.id)) continue;
    const latest = next.get(old.id);
    if (latest && !equal(latest, old)) return null;
    next.delete(old.id);
  }
  for (const changed of after) {
    const old = oldRows.get(changed.id);
    const latest = next.get(changed.id);
    if (!old) {
      if (latest && !equal(latest, changed)) return null;
      next.set(changed.id, { ...changed });
      continue;
    }
    for (const field of new Set([...Object.keys(old), ...Object.keys(changed)])) {
      if (equal(old[field], changed[field])) continue;
      if (field === 'updatedAt' && latest && typeof latest[field] === 'number'
        && typeof changed[field] === 'number' && Number.isFinite(latest[field]) && Number.isFinite(changed[field])) {
        latest[field] = Math.max(latest[field], changed[field]);
        continue;
      }
      if (!latest || (!equal(latest[field], old[field]) && !equal(latest[field], changed[field]))) return null;
      if (Object.hasOwn(changed, field)) latest[field] = changed[field];
      else delete latest[field];
    }
  }
  return [...next.values()];
}
