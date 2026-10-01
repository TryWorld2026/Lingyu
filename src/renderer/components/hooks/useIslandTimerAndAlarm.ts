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
 * @file useIslandTimerAndAlarm.ts
 * @description 计时器与闹钟触发处理 Hook。
 * @author 灵屿
 */

import { useEffect, useRef } from 'react';
import { SvgIcon } from '../../utils/SvgIcon';
import type { NotificationData, TimerData } from '../../store/types';
import {
  ALARM_SOUND_STOP_EVENT,
  normalizeSystemAlarmRingtone,
  playAlarmSound,
  stopAlarmSound,
} from '../../utils/audio/alarmSound';

const ALARM_STORE_KEY = 'alarms';
const ALARM_SOUND_ENABLED_STORE_KEY = 'alarm-sound-enabled';
const ALARM_NOTIFICATION_STORE_KEY = 'alarm-notification-enabled';
const ALARM_SNOOZE_DURATION_STORE_KEY = 'alarm-snooze-duration';
const ALARM_AUTO_DISMISS_STORE_KEY = 'alarm-auto-dismiss';

interface AlarmItemSnapshot {
  id: number;
  hour: number;
  minute: number;
  second: number;
  label?: string;
  enabled?: boolean;
  repeat?: number[];
  ringtone?: unknown;
  loop?: boolean;
}

interface UseIslandTimerAndAlarmOptions {
  language: string | undefined;
  timerData: TimerData;
  setTimerData: (data: Partial<TimerData>) => void;
  setNotificationRef: React.MutableRefObject<(data: NotificationData) => void>;
  t: (key: string, options?: Record<string, unknown>) => string;
}

/**
 * @description 处理倒计时与闹钟提醒通知。
 * @param options - 计时器与闹钟配置。
 */
export function useIslandTimerAndAlarm(options: UseIslandTimerAndAlarmOptions): void {
  const {
    language,
    timerData,
    setTimerData,
    setNotificationRef,
    t,
  } = options;

  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerDeadlineRef = useRef<number | null>(null);
  const timerExpectedRemainingRef = useRef<number | null>(null);
  const alarmFiredSetRef = useRef<Set<string>>(new Set());
  const alarmAutoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 闹钟音效/通知/贪睡/自动关闭缓存（避免每秒轮询读取，设置变更时更新） */
  const alarmPrefsRef = useRef<{ soundEnabled: boolean; notificationEnabled: boolean; snoozeDuration: number; autoDismissMinutes: number }>({
    soundEnabled: true,
    notificationEnabled: true,
    snoozeDuration: 5,
    autoDismissMinutes: 0,
  });

  /** 闹钟音效/通知/贪睡/自动关闭缓存（首次读取 + 设置变更时更新，避免每秒轮询读取） */
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      window.api ? window.api.storeRead(ALARM_SOUND_ENABLED_STORE_KEY).catch(() => true) : Promise.resolve(true),
      window.api ? window.api.storeRead(ALARM_NOTIFICATION_STORE_KEY).catch(() => true) : Promise.resolve(true),
      window.api ? window.api.storeRead(ALARM_SNOOZE_DURATION_STORE_KEY).catch(() => 5) : Promise.resolve(5),
      window.api ? window.api.storeRead(ALARM_AUTO_DISMISS_STORE_KEY).catch(() => 0) : Promise.resolve(0),
    ]).then(([sound, notif, snooze, autoDismissMinutes]) => {
      if (cancelled) return;
      alarmPrefsRef.current = {
        soundEnabled: sound !== false,
        notificationEnabled: notif !== false,
        snoozeDuration: typeof snooze === 'number' && snooze > 0 ? snooze : 5,
        autoDismissMinutes: typeof autoDismissMinutes === 'number' && autoDismissMinutes > 0 ? autoDismissMinutes : 0,
      };
    });
    const unsub = window.api?.onSettingsChanged?.((channel: string, value: unknown) => {
      if (channel === `store:${ALARM_SOUND_ENABLED_STORE_KEY}`) {
        alarmPrefsRef.current = { ...alarmPrefsRef.current, soundEnabled: value !== false };
      } else if (channel === `store:${ALARM_NOTIFICATION_STORE_KEY}`) {
        alarmPrefsRef.current = { ...alarmPrefsRef.current, notificationEnabled: value !== false };
      } else if (channel === `store:${ALARM_SNOOZE_DURATION_STORE_KEY}`) {
        alarmPrefsRef.current = { ...alarmPrefsRef.current, snoozeDuration: typeof value === 'number' && value > 0 ? value : 5 };
      } else if (channel === `store:${ALARM_AUTO_DISMISS_STORE_KEY}`) {
        alarmPrefsRef.current = { ...alarmPrefsRef.current, autoDismissMinutes: typeof value === 'number' && value > 0 ? value : 0 };
      }
    });
    // 同窗口设置变更广播被排除，监听本地补发事件
    const onLocal = (e: Event): void => {
      const detail = (e as CustomEvent<{ channel?: string; value?: unknown }>).detail;
      if (!detail || typeof detail !== 'object') return;
      if (detail.channel === ALARM_SOUND_ENABLED_STORE_KEY) {
        alarmPrefsRef.current = { ...alarmPrefsRef.current, soundEnabled: detail.value !== false };
      } else if (detail.channel === ALARM_NOTIFICATION_STORE_KEY) {
        alarmPrefsRef.current = { ...alarmPrefsRef.current, notificationEnabled: detail.value !== false };
      } else if (detail.channel === ALARM_SNOOZE_DURATION_STORE_KEY) {
        alarmPrefsRef.current = { ...alarmPrefsRef.current, snoozeDuration: typeof detail.value === 'number' && detail.value > 0 ? detail.value : 5 };
      } else if (detail.channel === ALARM_AUTO_DISMISS_STORE_KEY) {
        alarmPrefsRef.current = { ...alarmPrefsRef.current, autoDismissMinutes: typeof detail.value === 'number' && detail.value > 0 ? detail.value : 0 };
      }
    };
    window.addEventListener('island:setting-changed', onLocal);
    return () => {
      cancelled = true;
      unsub?.();
      window.removeEventListener('island:setting-changed', onLocal);
    };
  }, []);

  useEffect(() => {
    const handleStop = (): void => {
      stopAlarmSound();
    };

    window.addEventListener(ALARM_SOUND_STOP_EVENT, handleStop);
    return () => {
      window.removeEventListener(ALARM_SOUND_STOP_EVENT, handleStop);
      stopAlarmSound();
    };
  }, []);

  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    if (timerData?.state === 'running' && timerData.remainingSeconds > 0) {
      if (timerDeadlineRef.current === null || timerExpectedRemainingRef.current !== timerData.remainingSeconds) {
        timerDeadlineRef.current = Date.now() + timerData.remainingSeconds * 1000;
        timerExpectedRemainingRef.current = timerData.remainingSeconds;
      }
      timerIntervalRef.current = setInterval(() => {
        if (timerDeadlineRef.current === null) return;
        // 使用截止时间校准，休眠或后台节流后不按回调次数继续倒数。
        const next = Math.max(0, Math.ceil((timerDeadlineRef.current - Date.now()) / 1000));
        timerExpectedRemainingRef.current = next;
        if (next <= 0) {
          timerDeadlineRef.current = null;
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          setTimerData({
            state: 'idle',
            remainingSeconds: 0,
            inputHours: '00',
            inputMinutes: '00',
            inputSeconds: '00',
          });
          setNotificationRef.current({
            title: t('notification.timer.title', { defaultValue: '计时器' }),
            body: t('notification.timer.finished', { defaultValue: '倒计时已结束' }),
            icon: SvgIcon.TIMER,
          });
        } else {
          setTimerData({ remainingSeconds: next });
        }
      }, 1000);
    } else {
      timerDeadlineRef.current = null;
      timerExpectedRemainingRef.current = null;
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [timerData?.state, timerData?.remainingSeconds, setTimerData, language, setNotificationRef, t]);

  useEffect(() => {
    let disposed = false;
    let reading = false;
    let previousCheck = Date.now() - 1000;
    const alarmInterval = setInterval(async () => {
      if (disposed || reading) return;
      reading = true;
      try {
        const data = await window.api?.storeRead(ALARM_STORE_KEY);
        if (disposed) return;
        const now = new Date();
        const nowMs = now.getTime();
        const from = Math.max(previousCheck, nowMs - 7 * 86_400_000);
        previousCheck = nowMs;
        if (!Array.isArray(data) || data.length === 0 || from > nowMs) return;
        // 音效/通知开关从缓存读取（设置变更时由 effect 更新），避免每秒 2 次额外 IPC
        const soundEnabled = alarmPrefsRef.current.soundEnabled;
        const notificationEnabled = alarmPrefsRef.current.notificationEnabled;
        const disableOnceAlarmIds: number[] = [];
        const triggeredSounds: Array<{ ringtone: unknown; loop: boolean }> = [];

        data.forEach((alarmRaw) => {
          const alarm = alarmRaw as AlarmItemSnapshot;
          if (!alarm || !alarm.enabled) return;
          if (!Number.isInteger(alarm.hour) || alarm.hour < 0 || alarm.hour > 23
            || !Number.isInteger(alarm.minute) || alarm.minute < 0 || alarm.minute > 59
            || !Number.isInteger(alarm.second) || alarm.second < 0 || alarm.second > 59) return;
          const repeatDays = Array.isArray(alarm.repeat) ? alarm.repeat : [];
          const hasRepeat = repeatDays.length > 0;
          let occurrence: Date | null = null;
          // 只补发上次检查以来最近一次到期提醒，跨秒及休眠恢复均不会漏掉。
          for (let offset = 0; offset < 8; offset += 1) {
            const candidate = new Date(nowMs);
            candidate.setDate(candidate.getDate() - offset);
            candidate.setHours(alarm.hour, alarm.minute, alarm.second, 0);
            const at = candidate.getTime();
            if (at > nowMs) continue;
            if (at <= from) break;
            if (hasRepeat && !repeatDays.includes(candidate.getDay())) continue;
            occurrence = candidate;
            break;
          }
          if (!occurrence) return;

          const firedKey = `${alarm.id}-${occurrence.getTime()}`;
          if (alarmFiredSetRef.current.has(firedKey)) return;
          alarmFiredSetRef.current.add(firedKey);

          const timeStr = `${String(alarm.hour).padStart(2, '0')}:${String(alarm.minute).padStart(2, '0')}:${String(alarm.second).padStart(2, '0')}`;
          const label = alarm.label ? `${alarm.label}` : '';
          if (notificationEnabled) {
            const body = label
              ? t('notification.alarm.bodyWithLabel', { defaultValue: '{{time}} — {{label}}', time: timeStr, label })
              : t('notification.alarm.body', { defaultValue: '{{time}}', time: timeStr });
            setNotificationRef.current({
              title: t('notification.alarm.title', { defaultValue: '闹钟提醒' }),
              body,
              icon: SvgIcon.TIMER,
            });
          }

          triggeredSounds.push({
            ringtone: alarm.ringtone,
            loop: alarm.loop !== false,
          });

          if (!hasRepeat) {
            disableOnceAlarmIds.push(alarm.id);
          }
        });

        if (soundEnabled && triggeredSounds.length > 0) {
          const latestSound = triggeredSounds[triggeredSounds.length - 1];
          playAlarmSound({
            ringtone: normalizeSystemAlarmRingtone(latestSound.ringtone),
            loop: latestSound.loop,
          });
          // 自动关闭：若开启（分钟数 > 0），响铃后按设定分钟自动停止铃声
          const autoDismissMinutes = alarmPrefsRef.current.autoDismissMinutes;
          if (autoDismissMinutes > 0) {
            if (alarmAutoDismissTimerRef.current) clearTimeout(alarmAutoDismissTimerRef.current);
            alarmAutoDismissTimerRef.current = setTimeout(() => {
              stopAlarmSound();
            }, autoDismissMinutes * 60_000);
          }
        }

        if (disableOnceAlarmIds.length > 0) {
          await window.api?.alarmSetEnabled(disableOnceAlarmIds, false).catch(() => {});
        }

        for (const key of alarmFiredSetRef.current) {
          if (Number(key.slice(key.lastIndexOf('-') + 1)) < nowMs - 7 * 86_400_000) {
            alarmFiredSetRef.current.delete(key);
          }
        }
      } catch {
        // noop
      } finally {
        reading = false;
      }
    }, 1000);
    return () => {
      disposed = true;
      clearInterval(alarmInterval);
      if (alarmAutoDismissTimerRef.current) {
        clearTimeout(alarmAutoDismissTimerRef.current);
        alarmAutoDismissTimerRef.current = null;
      }
    };
  }, [language, setNotificationRef, t]);
}
