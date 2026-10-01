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
 * @file useIslandTimerAndAlarm.test.ts
 * @description 实际调度 hook 的延迟回调、跨日期去重、跨秒与原子关闭回归。
 * @author 灵屿
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimerData } from '../../store/types';
const { refs, effects, cursor, playSound, stopSound } = vi.hoisted(() => ({
  refs: [] as Array<{ current: unknown }>, effects: [] as Array<() => void | (() => void)>,
  cursor: { value: 0 }, playSound: vi.fn(), stopSound: vi.fn(),
}));
vi.mock('react', () => ({
  useRef: (value: unknown) => {
    const index = cursor.value++;
    return refs[index] ?? (refs[index] = { current: value });
  },
  useEffect: (effect: () => void | (() => void)) => { effects.push(effect); },
}));
vi.mock('../../utils/SvgIcon', () => ({ SvgIcon: { TIMER: 'timer.svg' } }));
vi.mock('../../utils/audio/alarmSound', () => ({
  ALARM_SOUND_STOP_EVENT: 'owned-stop', normalizeSystemAlarmRingtone: (value: unknown) => value,
  playAlarmSound: playSound, stopAlarmSound: stopSound,
}));
import { useIslandTimerAndAlarm } from './useIslandTimerAndAlarm';

interface Alarm { id: number; hour: number; minute: number; second: number; enabled: boolean; repeat: number[]; label?: string }
let alarms: Alarm[];
let intervals: Map<number, () => unknown>;
let cleanup: Array<() => void>;
let notify: ReturnType<typeof vi.fn>;
let updateTimer: ReturnType<typeof vi.fn>;
let api: { storeRead: ReturnType<typeof vi.fn>; storeWrite: ReturnType<typeof vi.fn>; alarmSetEnabled: ReturnType<typeof vi.fn>; onSettingsChanged: ReturnType<typeof vi.fn> };
const idle: TimerData = { state: 'idle', remainingSeconds: 0, inputHours: '00', inputMinutes: '00', inputSeconds: '00' };

async function mount(timerData = idle): Promise<void> {
  cursor.value = 0;
  effects.length = 0;
  useIslandTimerAndAlarm({ language: 'zh-CN', timerData, setTimerData: updateTimer, setNotificationRef: { current: notify }, t: (key) => key });
  cleanup = effects.map((effect) => effect()).filter((value): value is () => void => typeof value === 'function');
  await Promise.resolve();
  await Promise.resolve();
}
async function tick(): Promise<void> {
  for (const callback of [...intervals.values()]) await callback();
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 1, 8, 59, 59));
  refs.length = 0;
  cleanup = [];
  intervals = new Map();
  notify = vi.fn();
  updateTimer = vi.fn();
  alarms = [];
  api = {
    storeRead: vi.fn(async (key: string) => key === 'alarms' ? structuredClone(alarms) : key.includes('enabled') ? false : 0),
    storeWrite: vi.fn(async (_key: string, value: Alarm[]) => { alarms = value; return true; }),
    alarmSetEnabled: vi.fn(async (ids: number[], enabled: boolean) => {
      alarms = alarms.map((alarm) => ids.includes(alarm.id) ? { ...alarm, enabled } : alarm); return true;
    }),
    onSettingsChanged: vi.fn(() => vi.fn()),
  };
  vi.stubGlobal('window', Object.assign(new EventTarget(), { api }));
  let nextId = 0;
  vi.stubGlobal('setInterval', (callback: () => unknown) => { intervals.set(++nextId, callback); return nextId; });
  vi.stubGlobal('clearInterval', (id: number) => { intervals.delete(id); });
  // 通知默认关闭；打开只用于实际调度结果断言。
  api.storeRead.mockImplementation(async (key: string) => key === 'alarms' ? structuredClone(alarms) : key === 'alarm-notification-enabled');
});
afterEach(() => { cleanup.forEach((dispose) => dispose()); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('timer and alarm scheduling', () => {
  it('finishes a 60 second countdown after a delayed 300 second callback', async () => {
    await mount({ ...idle, state: 'running', remainingSeconds: 60 });
    vi.setSystemTime(new Date(2026, 9, 1, 9, 4, 59));
    await tick();
    expect(updateTimer).toHaveBeenCalledWith(expect.objectContaining({ state: 'idle', remainingSeconds: 0 }));
    expect(notify).toHaveBeenCalledOnce();
  });
  it('fires the same daily alarm on consecutive days exactly once per day', async () => {
    alarms = [{ id: 1, hour: 9, minute: 0, second: 0, enabled: true, repeat: [0, 1, 2, 3, 4, 5, 6] }];
    await mount();
    vi.setSystemTime(new Date(2026, 9, 1, 9));
    await tick();
    await tick();
    vi.setSystemTime(new Date(2026, 9, 2, 9));
    await tick();
    expect(notify).toHaveBeenCalledTimes(2);
  });
  it('fires a weekly alarm again the following week', async () => {
    alarms = [{ id: 1, hour: 9, minute: 0, second: 0, enabled: true, repeat: [4] }];
    await mount();
    vi.setSystemTime(new Date(2026, 9, 1, 9));
    await tick();
    vi.setSystemTime(new Date(2026, 9, 8, 9));
    await tick();
    expect(notify).toHaveBeenCalledTimes(2);
  });
  it('does not miss an alarm when the callback crosses its exact second', async () => {
    alarms = [{ id: 1, hour: 9, minute: 0, second: 0, enabled: true, repeat: [4] }];
    await mount();
    vi.setSystemTime(new Date(2026, 9, 1, 9, 0, 3));
    await tick();
    await tick();
    expect(notify).toHaveBeenCalledOnce();
  });
  it('disables a one-time alarm without overwriting a concurrent edit of another alarm', async () => {
    alarms = [
      { id: 1, hour: 9, minute: 0, second: 0, enabled: true, repeat: [] },
      { id: 2, hour: 10, minute: 0, second: 0, enabled: true, repeat: [], label: 'before' },
    ];
    await mount();
    vi.setSystemTime(new Date(2026, 9, 1, 9));
    const pending = [...intervals.values()][0]();
    alarms[1].label = 'concurrent change';
    await pending;
    expect(alarms.find((alarm) => alarm.id === 1)?.enabled).toBe(false);
    expect(alarms.find((alarm) => alarm.id === 2)?.label).toBe('concurrent change');
  });
});
