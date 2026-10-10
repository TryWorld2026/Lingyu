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
 * @file useClipboardHistoryCollector.safety.test.ts
 * @description 真实采集 hook 的初始化、关闭竞态、设置同步与卸载回归。
 * @author 灵屿
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { effects } = vi.hoisted(() => ({ effects: [] as Array<() => void | (() => void)> }));
vi.mock('react', () => ({
  useRef: (value: unknown) => ({ current: value }),
  useEffect: (effect: () => void | (() => void)) => { effects.push(effect); },
}));
import { useClipboardHistoryCollector } from './useClipboardHistoryCollector';
import { HISTORY_ENABLED_STORE_KEY, HISTORY_LIMIT_STORE_KEY } from '../config/clipboardHistoryConfig';

let cleanup: Array<() => void> = [];
let api: { storeRead: ReturnType<typeof vi.fn>; storeUpdateList: ReturnType<typeof vi.fn>; clipboardReadText: ReturnType<typeof vi.fn>; onSettingsChanged: ReturnType<typeof vi.fn>; onClipboardChanged: ReturnType<typeof vi.fn> };
let target: EventTarget;
let crossWindow: (channel: string, value: unknown) => void;
let clipboardChanged: () => void;
let saved: unknown[];

function mount(): void {
  useClipboardHistoryCollector();
  cleanup = effects.map((effect) => effect()).filter((value): value is () => void => typeof value === 'function');
}

beforeEach(() => {
  vi.useFakeTimers();
  effects.length = 0;
  saved = [];
  target = new EventTarget();
  const localData = new Map<string, string>();
  api = {
    storeRead: vi.fn(async (key: string) => key === HISTORY_ENABLED_STORE_KEY ? true : 10),
    // 采集器走原子列表写入；这里记录 after，等价于旧 storeWrite 的第一个参数。
    storeUpdateList: vi.fn(async (_key: string, _before: unknown[], after: unknown[]) => { saved.push(after); return { success: true, revision: 1, data: after }; }),
    clipboardReadText: vi.fn(async () => 'owned test text'),
    onSettingsChanged: vi.fn((listener) => { crossWindow = listener; return vi.fn(); }),
    onClipboardChanged: vi.fn((listener: () => void) => { clipboardChanged = listener; return vi.fn(); }),
  };
  Object.assign(target, { api });
  vi.stubGlobal('window', target);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => localData.get(key) ?? null,
    setItem: (key: string, value: string) => { localData.set(key, value); },
  });
});

afterEach(() => {
  cleanup.forEach((dispose) => dispose());
  cleanup = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('clipboard collection consent', () => {
  it('does not read or persist while the initial settings are unresolved', async () => {
    api.storeRead.mockImplementation(() => new Promise(() => {}));
    mount();
    clipboardChanged();
    await vi.advanceTimersByTimeAsync(2000);
    expect(api.clipboardReadText).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
  });

  it('starts disabled without collecting the startup clipboard', async () => {
    api.storeRead.mockImplementation(async (key: string) => key === HISTORY_ENABLED_STORE_KEY ? false : 10);
    mount();
    await vi.advanceTimersByTimeAsync(0);
    clipboardChanged();
    await vi.advanceTimersByTimeAsync(2000);
    expect(api.clipboardReadText).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
  });

  it('honors a same-window disable and can resume after enable', async () => {
    mount();
    await vi.advanceTimersByTimeAsync(0);
    expect(saved.length).toBe(1);
    target.dispatchEvent(new CustomEvent('island:setting-changed', { detail: { channel: HISTORY_ENABLED_STORE_KEY, value: false } }));
    api.clipboardReadText.mockResolvedValue('while disabled');
    clipboardChanged();
    await vi.advanceTimersByTimeAsync(0);
    expect(saved.length).toBe(1);
    target.dispatchEvent(new CustomEvent('island:setting-changed', { detail: { channel: HISTORY_ENABLED_STORE_KEY, value: true } }));
    api.clipboardReadText.mockResolvedValue('after enable');
    clipboardChanged();
    await vi.advanceTimersByTimeAsync(0);
    expect(JSON.stringify(saved.at(-1))).toContain('after enable');
    expect(JSON.stringify(saved)).not.toContain('while disabled');
  });

  it('honors cross-window changes and rejects an in-flight read after disable', async () => {
    mount();
    await vi.advanceTimersByTimeAsync(0);
    let resolveRead!: (text: string) => void;
    api.clipboardReadText.mockImplementation(() => new Promise<string>((resolve) => { resolveRead = resolve; }));
    clipboardChanged();
    crossWindow('store:' + HISTORY_ENABLED_STORE_KEY, false);
    resolveRead('late owned text');
    await vi.advanceTimersByTimeAsync(0);
    expect(JSON.stringify(saved)).not.toContain('late owned text');
  });

  it('applies the current cross-window history limit', async () => {
    mount();
    await vi.advanceTimersByTimeAsync(0);
    crossWindow('store:' + HISTORY_LIMIT_STORE_KEY, 1);
    api.clipboardReadText.mockResolvedValue('new owned text');
    clipboardChanged();
    await vi.advanceTimersByTimeAsync(0);
    expect(saved.at(-1)).toHaveLength(1);
  });

  it('does not persist a pending read after unmount', async () => {
    mount();
    await vi.advanceTimersByTimeAsync(0);
    let resolveRead!: (text: string) => void;
    api.clipboardReadText.mockImplementation(() => new Promise<string>((resolve) => { resolveRead = resolve; }));
    clipboardChanged();
    cleanup.forEach((dispose) => dispose());
    cleanup = [];
    resolveRead('after unmount');
    await vi.advanceTimersByTimeAsync(0);
    expect(JSON.stringify(saved)).not.toContain('after unmount');
  });
});
