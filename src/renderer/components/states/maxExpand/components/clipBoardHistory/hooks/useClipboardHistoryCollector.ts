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
  sanitizeHistory,
  prependUniqueHistoryItem,
} from '../utils/clipboardHistoryUtils';
import {
  DEFAULT_HISTORY_LIMIT,
  HISTORY_ENABLED_STORE_KEY,
  HISTORY_LIMIT_STORE_KEY,
  LOCAL_STORAGE_KEY,
  POLL_INTERVAL_MS,
} from '../config/clipboardHistoryConfig';
import type { ClipboardHistoryItem } from '../types/clipboardHistoryTypes';

/**
 * 全局剪贴板历史采集 hook
 * @description 常驻轮询系统剪贴板，变化时去重写入历史并持久化；
 * 历史页打开时从同一存储读取，无需重构现有 store
 */
export function useClipboardHistoryCollector(): void {
  const enabledRef = useRef(true);
  const limitRef = useRef(DEFAULT_HISTORY_LIMIT);
  const lastTextRef = useRef('');

  useEffect(() => {
    let timerId: number | null = null;
    let disposed = false;

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
      if (disposed || !enabledRef.current) return;
      try {
        const rawText = await window.api.clipboardReadText();
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
      }
    };

    // 立即启动轮询：poll 内部每次检查 enabledRef（异步更新），
    // 首次 poll 若 enabled 尚未就绪会读到默认 true，但仅记录一条可接受的启动文本；
    // 关键是不依赖 Promise 时序，interval 必然建立
    void poll();
    timerId = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    // 设置读取完成后更新 ref（后续 poll 会遵守）
    void window.api.storeRead(HISTORY_ENABLED_STORE_KEY).then((v) => {
      enabledRef.current = v !== false;
    }).catch(() => {});
    void window.api.storeRead(HISTORY_LIMIT_STORE_KEY).then((v) => {
      if (typeof v === 'number' && v > 0) limitRef.current = Math.floor(v);
    }).catch(() => {});

    return () => {
      disposed = true;
      if (timerId !== null) {
        window.clearInterval(timerId);
      }
    };
  }, []);
}
