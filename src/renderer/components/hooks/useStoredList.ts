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
 * @file useStoredList.ts
 * @description 待办、备忘录、闹钟和倒数日共用的保存队列、版本同步与冲突反馈。
 * @author 灵屿
 */

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import type { StoredListKey, StoredListResult } from '../../../shared/listStore';
import useIslandStore from '../../store/slices';

/**
 * 管理需要跨窗口合并的列表，串行保存用户改动，加载和广播不反向写回。
 * @param key - 待办、备忘录、闹钟或倒数日存储键。
 * @param normalize - 将旧记录转为当前界面所需的数据。
 * @param readLegacy - 仅在文件不存在时读取旧缓存；已有空列表不迁移。
 * @returns 当前列表、保存 setter、加载状态与 store 文件是否已存在。
 */
export function useStoredList<T extends { id: number }>(
  key: StoredListKey,
  normalize: (items: T[]) => T[] | Promise<T[]>,
  readLegacy?: () => T[],
): { items: T[]; setItems: Dispatch<SetStateAction<T[]>>; loaded: boolean; exists: boolean } {
  const { t } = useTranslation();
  const [items, updateItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  /** store 文件是否已存在：用来区分"还没初始化"与"用户主动清空" */
  const [exists, setExists] = useState(true);
  const desired = useRef<T[]>([]);
  const rawBefore = useRef<unknown[]>([]);
  const latest = useRef<StoredListResult | null>(null);
  const pending = useRef(0);
  const queue = useRef(Promise.resolve());
  const alive = useRef(false);

  const feedback = useCallback((conflict: boolean): void => {
    if (!alive.current) return;
    useIslandStore.getState().setNotification({
      title: t('storageSync.title'),
      body: t(conflict ? 'storageSync.conflict' : 'storageSync.failed'),
    });
  }, [t]);
  const refreshView = useCallback(async (): Promise<void> => {
    const snapshot = latest.current;
    if (!snapshot || pending.current > 0 || !alive.current) return;
    const next = await normalize(snapshot.data as T[]);
    if (!alive.current || pending.current > 0 || latest.current !== snapshot) return;
    desired.current = next;
    rawBefore.current = snapshot.data;
    updateItems(next);
    setLoaded(true);
  }, [normalize]);
  const accept = useCallback((result: StoredListResult): void => {
    if (!result || !Array.isArray(result.data) || !Number.isFinite(result.revision)) return;
    if (latest.current && result.revision < latest.current.revision) return;
    latest.current = result;
    void refreshView().catch(() => feedback(false));
  }, [refreshView, feedback]);

  useEffect(() => {
    alive.current = true;
    let disposed = false;
    const unsubscribe = window.api.onSettingsChanged((channel, value) => {
      if (!disposed && channel === `store-list:${key}`) accept(value as StoredListResult);
    });
    void window.api.storeReadList(key).then(async (result) => {
      if (disposed) return;
      if (result.success) setExists(result.exists !== false);
      if (result.success && result.exists === false && readLegacy) {
        const legacy = readLegacy();
        if (legacy.length > 0) result = await window.api.storeUpdateList(key, [], legacy);
        if (disposed) return;
      }
      if (result.success) accept(result);
      else feedback(false);
    }).catch(() => feedback(false));
    return () => { disposed = true; alive.current = false; unsubscribe(); };
  }, [key, accept, feedback, readLegacy]);

  const setItems: Dispatch<SetStateAction<T[]>> = useCallback((action) => {
    if (!loaded) { feedback(false); return; }
    const before = rawBefore.current;
    const next = typeof action === 'function' ? action(desired.current) : action;
    desired.current = next;
    rawBefore.current = next;
    updateItems(next);
    pending.current += 1;
    queue.current = queue.current.then(async () => {
      try {
        const result = await window.api.storeUpdateList(key, before, next);
        if (result.success || result.error === 'conflict') accept(result);
        if (!result.success) feedback(result.error === 'conflict');
      } catch {
        feedback(false);
      } finally {
        pending.current -= 1;
        await refreshView().catch(() => feedback(false));
      }
    });
  }, [key, loaded, accept, feedback, refreshView]);
  return { items, setItems, loaded, exists };
}
