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
 * @file mockWindow.ts
 * @description 测试用 BrowserWindow mock 工厂，集中维护 mock 形状，供主进程各单测复用
 * @description 避免每个测试文件各自定义不完整的窗口 mock 导致类型不匹配
 * @author 灵屿
 */

import { vi } from 'vitest';
import type { BrowserWindow } from 'electron';

/**
 * mock 窗口对外可见的形状
 * @description 与 BrowserWindow 中主进程服务实际调用的成员保持一致，均为普通函数签名
 */
export interface MockBrowserWindowShape {
  webContents: {
    id: number;
    send: (...args: unknown[]) => void;
    once: (...args: unknown[]) => unknown;
    on: (...args: unknown[]) => unknown;
  };
  isDestroyed: () => boolean;
  isVisible: () => boolean;
  isMinimized: () => boolean;
  show: () => void;
  hide: () => void;
  focus: () => void;
  restore: () => void;
  close: () => void;
  destroy: () => void;
  once: (...args: unknown[]) => unknown;
  on: (...args: unknown[]) => unknown;
  removeListener: (...args: unknown[]) => unknown;
  setAlwaysOnTop: (flag: boolean, level: string) => void;
  setBounds: (...args: unknown[]) => void;
  setIgnoreMouseEvents: (...args: unknown[]) => void;
  showInactive: (...args: unknown[]) => void;
  setOpacity: (opacity: number) => void;
  loadFile: (...args: unknown[]) => Promise<unknown>;
  loadURL: (...args: unknown[]) => Promise<unknown>;
}

/**
 * 创建测试用 mock 窗口
 * @description 所有成员默认由 vi.fn 提供，可通过 overrides 覆盖任意成员
 * @param overrides - 需要覆盖的成员（传普通函数即可，无需自行包 vi.fn）
 * @returns mock 窗口对象（形状类型，非 BrowserWindow）
 */
export function createMockBrowserWindow(overrides: Partial<MockBrowserWindowShape> = {}): MockBrowserWindowShape {
  const base: MockBrowserWindowShape = {
    webContents: {
      id: 1,
      send: vi.fn(),
      once: vi.fn(),
      on: vi.fn(),
    },
    isDestroyed: vi.fn(() => false),
    isVisible: vi.fn(() => true),
    isMinimized: vi.fn(() => false),
    show: vi.fn(),
    hide: vi.fn(),
    focus: vi.fn(),
    restore: vi.fn(),
    close: vi.fn(),
    destroy: vi.fn(),
    once: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    setBounds: vi.fn(),
    setIgnoreMouseEvents: vi.fn(),
    showInactive: vi.fn(),
    setOpacity: vi.fn(),
    loadFile: vi.fn(() => Promise.resolve()),
    loadURL: vi.fn(() => Promise.resolve()),
  };

  return { ...base, ...overrides };
}

/**
 * 将 mock 窗口断言为 BrowserWindow
 * @description 用于注入到声明了 `() => BrowserWindow | null` 的服务工厂选项
 * @param win - mock 窗口对象
 * @returns 断言后的 BrowserWindow（仅供测试注入使用）
 */
export function asBrowserWindow(win: MockBrowserWindowShape): BrowserWindow {
  return win as unknown as BrowserWindow;
}
