/*
 * Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026 · GPL-3.0-or-later
 */
/**
 * @file openDesktopWorkspace.test.ts
 * @description 工作台路由保存失败及窗口打开顺序的回归测试。
 * @author 灵屿
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDesktopWorkspace } from './openDesktopWorkspace';

afterEach(() => vi.unstubAllGlobals());

describe('openDesktopWorkspace', () => {
  it('saves the requested page before opening the workspace', async () => {
    const events: string[] = [];
    vi.stubGlobal('window', { api: {
      storeWrite: vi.fn(async (_key, tab) => { events.push(tab); return true; }),
      openStandaloneWindow: vi.fn(async () => { events.push('open'); return true; }),
    } });
    expect(await openDesktopWorkspace('settings')).toBe(true);
    expect(events).toEqual(['settings', 'open']);
  });

  it('does not open an unrelated page when saving the route fails', async () => {
    const openStandaloneWindow = vi.fn();
    vi.stubGlobal('window', { api: { storeWrite: vi.fn(async () => false), openStandaloneWindow } });
    expect(await openDesktopWorkspace('ai')).toBe(false);
    expect(openStandaloneWindow).not.toHaveBeenCalled();
  });

  it('reports failure when the native workspace cannot open', async () => {
    vi.stubGlobal('window', { api: {
      storeWrite: vi.fn(async () => true), openStandaloneWindow: vi.fn(async () => false),
    } });
    expect(await openDesktopWorkspace('focus')).toBe(false);
  });
});
