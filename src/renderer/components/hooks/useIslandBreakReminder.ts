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
 * @file useIslandBreakReminder.ts
 * @description 休息提醒调度器 —— 按用户配置的间隔定时弹出通知
 * @author 灵屿
 */

import { useEffect, useRef } from 'react';
import { SvgIcon } from '../../utils/SvgIcon';
import { useStoredList } from '../../components/hooks/useStoredList';
import { BREAK_REMINDER_LIST_KEY, type BreakReminderItem } from '../../components/states/maxExpand/components/setting/components/app/components/breakReminder/breakReminderConfig';
import { sanitizeBreakReminderItems } from '../../components/states/maxExpand/components/setting/components/app/components/breakReminder/breakReminderUtils';
import type { NotificationData } from '../../store/types';

const BREAK_REMINDER_LAST_FIRED_KEY = 'break-reminder-last-fired';
const POLL_INTERVAL_MS = 10_000;

interface UseIslandBreakReminderOptions {
  language: string | undefined;
  setNotificationRef: React.MutableRefObject<(data: NotificationData) => void>;
  t: (key: string, options?: Record<string, unknown>) => string;
}

/**
 * 休息提醒调度 hook
 * 每 {@link POLL_INTERVAL_MS} 毫秒读取 store 中的提醒列表，
 * 对每个启用的提醒条目按 intervalMinutes 触发通知。
 * @param options - 休息提醒调度配置。
 */
export function useIslandBreakReminder(options: UseIslandBreakReminderOptions): void {
  const { language, setNotificationRef, t } = options;

  // 设置页也会写这个列表且分属不同窗口，必须走原子合并而不是整表覆盖。
  const { items } = useStoredList<BreakReminderItem>(BREAK_REMINDER_LIST_KEY, sanitizeBreakReminderItems);

  /** 记录每个提醒条目上次触发的时间戳 (ms) */
  const lastFiredRef = useRef<Map<number, number>>(new Map());
  /** 缓存最近一次轮询到的提醒条目列表，供 snooze 事件查找间隔时长 */
  const itemsCacheRef = useRef<BreakReminderItem[]>([]);
  // 调度回调跑在 setInterval 里，闭包捕获的是渲染时的 items；用 ref 让它每次都看到最新列表。
  const itemsRef = useRef<BreakReminderItem[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    const check = async (): Promise<void> => {
      try {
        const current = itemsRef.current;
        if (current.length === 0) return;

        itemsCacheRef.current = current;

        const now = Date.now();
        const firedMap = lastFiredRef.current;
        let changed = false;

        current.forEach((item) => {
          if (!item || !item.enabled || !item.intervalMinutes || !item.name?.trim()) return;

          const intervalMs = item.intervalMinutes * 60_000;
          const lastFired = firedMap.get(item.id);

          if (lastFired === undefined) {
            // 首次发现该条目，初始化计时起点为当前时刻
            firedMap.set(item.id, now);
            changed = true;
            return;
          }

          if (now - lastFired >= intervalMs) {
            firedMap.set(item.id, now);
            changed = true;
            const name = item.name || t('settings.breakReminder.notificationTitle', { defaultValue: '休息提醒' });
            setNotificationRef.current({
              title: t('settings.breakReminder.notificationTitle', { defaultValue: '休息提醒' }),
              body: t('settings.breakReminder.notificationBody', { defaultValue: '该{{name}}啦！', name }),
              icon: item.icon || SvgIcon.BREAK,
              breakReminderItemId: item.id,
            });
          }
        });

        // 清理已不存在的条目
        const activeIds = new Set(current.map((i) => i.id));
        Array.from(firedMap.keys()).forEach((key) => {
          if (!activeIds.has(key)) { firedMap.delete(key); changed = true; }
        });

        if (changed) {
          const obj: Record<number, number> = {};
          firedMap.forEach((v, k) => { obj[k] = v; });
          window.api?.storeWrite(BREAK_REMINDER_LAST_FIRED_KEY, obj).catch(() => {});
        }
      } catch {
        // noop
      }
    };

    const interval = setInterval(check, POLL_INTERVAL_MS);
    // 启动后立即执行一次初始化
    check().catch(() => {});

    const handleSnoozeEvent = (e: Event): void => {
      const detail = (e as CustomEvent<{ itemId: number; snoozeMinutes: number }>).detail;
      if (!detail?.itemId || !detail.snoozeMinutes) return;
      const firedMap = lastFiredRef.current;
      const matched = itemsCacheRef.current.find((i) => i.id === detail.itemId);
      const intervalMs = matched ? matched.intervalMinutes * 60_000 : 0;
      const snoozeMs = detail.snoozeMinutes * 60_000;
      firedMap.set(detail.itemId, Date.now() + snoozeMs - (intervalMs || snoozeMs));
      const obj: Record<number, number> = {};
      firedMap.forEach((v, k) => { obj[k] = v; });
      window.api?.storeWrite(BREAK_REMINDER_LAST_FIRED_KEY, obj).catch(() => {});
    };
    window.addEventListener('break-reminder-snooze', handleSnoozeEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('break-reminder-snooze', handleSnoozeEvent);
    };
  }, [language, setNotificationRef, t]);
}
