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
 * @file useClipboardHistoryCollector.ts
 * @description 全局剪贴板历史采集器：挂在灵动岛根组件，窗口存活期间常驻采集
 * @author 灵屿
 */

import { useEffect, useRef } from 'react';
import {
  normalizeClipboardText,
  isRecordableClipboardText,
  persistHistory,
  setHistoryBaseline,
  sanitizeHistory,
  prependUniqueHistoryItem,
} from '../utils/clipboardHistoryUtils';
import {
  DEFAULT_HISTORY_LIMIT,
  HISTORY_ENABLED_STORE_KEY,
  HISTORY_LIMIT_STORE_KEY,
  LOCAL_STORAGE_KEY,
  STORE_KEY,
} from '../config/clipboardHistoryConfig';
import type { ClipboardHistoryItem } from '../types/clipboardHistoryTypes';

/**
 * 全局剪贴板历史采集 hook
 * @description 常驻轮询系统剪贴板，变化时去重写入历史并持久化；
 * 历史页打开时从同一存储读取，无需重构现有 store
 */
export function useClipboardHistoryCollector(): void {
  const enabledRef = useRef(false);
  const limitRef = useRef(DEFAULT_HISTORY_LIMIT);
  const lastTextRef = useRef('');
  /** 开关变化后要重新读一次剪贴板，否则开启期间的第一次复制不会被记录。 */
  const needsReadRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    let ready = false;
    let reading = false;
    let generation = 0;
    const changedDuringLoad = new Set<string>();

    const loadExisting = (): ClipboardHistoryItem[] => {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) return sanitizeHistory(JSON.parse(raw) as unknown[], limitRef.current);
      } catch {
        // noop
      }
      return [];
    };

    const poll = async (): Promise<void> => {
      if (disposed || !ready || !enabledRef.current || reading) return;
      reading = true;
      const startedGeneration = generation;
      try {
        const rawText = await window.api.clipboardReadText();
        if (disposed || !enabledRef.current || startedGeneration !== generation) return;
        const normalized = normalizeClipboardText(rawText);
        if (!isRecordableClipboardText(normalized) || normalized === lastTextRef.current) return;
        lastTextRef.current = normalized;

        const existing = loadExisting();
        if (existing[0]?.text === normalized) return;
        const updated = prependUniqueHistoryItem(existing, normalized, Date.now(), limitRef.current);
        if (updated.length === 0) return;
        persistHistory(updated);
      } catch {
        // noop
      } finally {
        reading = false;
      }
    };

    const applySetting = (channel: string, value: unknown): void => {
      const key = channel.startsWith('store:') ? channel.slice(6) : channel;
      if (key === STORE_KEY && Array.isArray(value)) {
        if (!ready) changedDuringLoad.add(key);
        try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(value)); } catch { /* 缓存不可用时等待下次采集。 */ }
        // 跨窗口写入同样登记 baseline：否则本窗口下次追加会把别人的新增当成删除。
        setHistoryBaseline(value as ClipboardHistoryItem[]);
        return;
      }
      if (key !== HISTORY_ENABLED_STORE_KEY && key !== HISTORY_LIMIT_STORE_KEY) return;
      if (!ready) changedDuringLoad.add(key);
      generation += 1;
      if (key === HISTORY_ENABLED_STORE_KEY) {
        enabledRef.current = value !== false;
        needsReadRef.current = true;
        lastTextRef.current = '';
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        limitRef.current = Math.max(1, Math.min(50, Math.round(value)));
      }
    };
    const unsubscribe = window.api.onSettingsChanged(applySetting);
    const onLocalSetting = (event: Event): void => {
      const detail = (event as CustomEvent<{ channel?: string; value?: unknown }>).detail;
      if (typeof detail?.channel === 'string') applySetting(detail.channel, detail.value);
    };
    window.addEventListener('island:setting-changed', onLocalSetting);

    // 两项配置成功读取前保持关闭；启动期间收到的设置更新优先于旧读取结果。
    void Promise.all([
      window.api.storeRead(HISTORY_ENABLED_STORE_KEY),
      window.api.storeRead(HISTORY_LIMIT_STORE_KEY),
      window.api.storeRead(STORE_KEY),
    ]).then(([enabled, limit, history]) => {
      if (disposed) return;
      if (!changedDuringLoad.has(HISTORY_ENABLED_STORE_KEY)) enabledRef.current = enabled !== false;
      if (!changedDuringLoad.has(HISTORY_LIMIT_STORE_KEY) && typeof limit === 'number' && Number.isFinite(limit)) {
        limitRef.current = Math.max(1, Math.min(50, Math.round(limit)));
      }
      if (!changedDuringLoad.has(STORE_KEY) && Array.isArray(history)) {
        try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(history)); } catch { /* 使用已有缓存。 */ }
        setHistoryBaseline(history as ClipboardHistoryItem[]);
      }
      ready = true;
      void poll();
    }).catch(() => {});

    const unsubscribeClipboard = window.api.onClipboardChanged(() => {
      // 开关刚打开时先读一次做基准，避免把开启前的内容当成新记录。
      if (needsReadRef.current) {
        needsReadRef.current = false;
        lastTextRef.current = '';
      }
      void poll();
    });

    return () => {
      disposed = true;
      unsubscribe();
      unsubscribeClipboard();
      window.removeEventListener('island:setting-changed', onLocalSetting);
    };
  }, []);
}
