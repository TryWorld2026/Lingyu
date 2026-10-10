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
 * @file store.ts
 * @description 通用存储 IPC 处理模块
 * @description 处理通用键值存储的读取和写入操作
 * @author 灵屿
 */

import { handleTrusted } from '../trustedSender';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { broadcastSettingChange } from '../../utils/broadcast';
import type { RegisterStoreIpcHandlersOptions } from './types';
import type { StoredListKey, StoredListResult } from '../../../shared/listStore';
import { isStoredList, mergeStoredList, type Row } from './listMerge';

/**
 * 读取路径的结构校验：只保证能安全交给渲染层清洗。
 * @description 不能用 isStoredList：它要求每行有唯一正整数 id，而旧版 app-shortcuts 用
 *   Date.now() + Math.random() 生成小数 id、旧版 break-reminder 用 string id。按 isStoredList
 *   拒绝会让渲染层永远拿不到列表，读时补 id 的迁移就不会触发，用户升级后看到列表凭空变空。
 * @param data - 文件中的原始内容
 * @returns 是否为可安全返回的列表
 */
function isReadableList(data: unknown): data is Record<string, unknown>[] {
  if (!Array.isArray(data) || data.length > 20000) return false;
  try {
    if (Buffer.byteLength(JSON.stringify(data), 'utf8') > 32 * 1024 * 1024) return false;
  } catch {
    return false;
  }
  return data.every((row) => row && typeof row === 'object' && !Array.isArray(row)
    && !Object.keys(row).some((key) => ['__proto__', 'constructor', 'prototype'].includes(key)));
}

/**
 * 把旧数据的非正整数 id 规范化为唯一正整数，供合并使用。
 * @description 旧版 app-shortcuts 用 `Date.now() + Math.random()` 生成小数 id，旧版 break-reminder
 *   用 `1770000000000-a1b2c3` 这种 string id。mergeStoredList 用 row.id 做 Map key，直接拿旧数据
 *   进去会让所有匹配失效。渲染层读到时也会各自补 id，两边规则必须一致，否则合并判为冲突。
 *   已合法的行原样保留，不改用户数据。
 * @param data - 结构上可读的列表
 * @returns id 全部为唯一正整数的列表
 */
function normalizeRowIds(data: Record<string, unknown>[]): Row[] {
  const used = new Set<number>();
  return data.map((row) => {
    const raw = row.id;
    let id = typeof raw === 'number' && Number.isSafeInteger(raw) && raw > 0
      ? raw
      : legacyRowId(raw);
    while (used.has(id)) id += 1;
    used.add(id);
    return { ...row, id };
  });
}

/** 旧版 string id 的时间戳部分转正整数；无法解析时回落到 1，由调用方递增错开。 */
function legacyRowId(raw: unknown): number {
  if (typeof raw !== 'string') return 1;
  const base = Number(raw.split('-')[0]);
  return Number.isSafeInteger(base) && base > 0 ? base : 1;
}

/** 合法的 store key：不含路径分隔符和 traversal 片段 */
function isValidStoreKey(key: unknown): key is string {
  return typeof key === 'string' && key.length > 0 && !/[\\/]/.test(key) && !key.includes('..');
}

/**
 * 注册通用存储 IPC 处理器
 * @description 注册通用键值存储读写 IPC 事件处理器
 * @param options - 配置选项，包含存储目录
 */
export function registerStoreIpcHandlers(options: RegisterStoreIpcHandlersOptions): void {
  const revisions = new Map<StoredListKey, number>();
  const listKey = (key: unknown): key is StoredListKey =>
    key === 'alarms' || key === 'countdown-dates' || key === 'todos' || key === 'memos' || key === 'url-favorites' || key === 'shelf'
    || key === 'clipboard-history-recent' || key === 'photo-album-items' || key === 'app-shortcuts'
    || key === 'break-reminder-items';
  const readList = (key: StoredListKey): unknown => {
    const filePath = join(options.storeDir, `${key}.json`);
    return existsSync(filePath) ? JSON.parse(readFileSync(filePath, 'utf-8')) : [];
  };
  const publishList = (key: StoredListKey, data: unknown[]): StoredListResult => {
    const revision = (revisions.get(key) ?? 0) + 1;
    revisions.set(key, revision);
    const result: StoredListResult = { success: true, revision, data };
    broadcastSettingChange(-1, `store-list:${key}`, result);
    broadcastSettingChange(-1, `store:${key}`, data);
    return result;
  };
  handleTrusted('store:read-list', (_event, key: unknown): StoredListResult => {
    if (!listKey(key)) return { success: false, revision: 0, data: [], error: 'invalid' };
    try {
      const data = readList(key);
      if (!isReadableList(data)) throw new Error('Invalid list store');
      return { success: true, revision: revisions.get(key) ?? 0, data,
        exists: existsSync(join(options.storeDir, `${key}.json`)) };
    } catch {
      return { success: false, revision: revisions.get(key) ?? 0, data: [], error: 'failed' };
    }
  });
  handleTrusted('store:update-list', (_event, key: unknown, before: unknown, after: unknown): StoredListResult => {
    if (!listKey(key) || !isStoredList(before) || !isStoredList(after)) {
      return { success: false, revision: 0, data: [], error: 'invalid' };
    }
    const revision = revisions.get(key) ?? 0;
    try {
      const current = readList(key);
      // current 是磁盘上的旧数据，id 可能还不是正整数（渲染层补好 id 后的第一次写入就落在这里），
      // 因此只做结构校验；before / after 是渲染层清洗过的，仍按 isStoredList 严格要求。
      if (!isReadableList(current)) throw new Error('Invalid list store');
      const next = mergeStoredList(normalizeRowIds(current), before, after);
      if (!next) return { success: false, revision, data: current, error: 'conflict' };
      if (!isStoredList(next)) return { success: false, revision, data: current, error: 'invalid' };
      writeFileSync(join(options.storeDir, `${key}.json`), JSON.stringify(next, null, 2), 'utf-8');
      return publishList(key, next);
    } catch {
      return { success: false, revision, data: [], error: 'failed' };
    }
  });
  handleTrusted('store:read', (_event, key: string) => {
    try {
      if (!isValidStoreKey(key)) return null;
      const filePath = join(options.storeDir, `${key}.json`);
      if (!existsSync(filePath)) return null;
      const raw = readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.error(`[Store] read '${key}' error:`, err);
      return null;
    }
  });

  handleTrusted('store:write', (event, key: string, data: unknown) => {
    try {
      if (!isValidStoreKey(key)) return false;
      const filePath = join(options.storeDir, `${key}.json`);
      writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      if (listKey(key) && isStoredList(data)) {
        publishList(key, data);
        return true;
      }
      broadcastSettingChange(event.sender.id, `store:${key}`, data);
      return true;
    } catch (err) {
      console.error(`[Store] write '${key}' error:`, err);
      return false;
    }
  });

  handleTrusted('alarm:set-enabled', (_event, ids: unknown, enabled: unknown) => {
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 512
      || !ids.every((id) => Number.isSafeInteger(id) && id > 0) || typeof enabled !== 'boolean') return false;
    try {
      const filePath = join(options.storeDir, 'alarms.json');
      if (!existsSync(filePath)) return false;
      const current: unknown = JSON.parse(readFileSync(filePath, 'utf-8'));
      if (!Array.isArray(current) || !current.every((item) => item && typeof item === 'object')) return false;
      // 主进程同步读取并修改指定字段，避免渲染层的旧快照覆盖其他窗口的编辑。
      const next = current.map((item) => ids.includes(item.id) ? { ...item, enabled } : item);
      writeFileSync(filePath, JSON.stringify(next, null, 2), 'utf-8');
      publishList('alarms', next);
      return true;
    } catch (error) {
      console.error('[Store] update alarm enabled error:', error);
      return false;
    }
  });
}
