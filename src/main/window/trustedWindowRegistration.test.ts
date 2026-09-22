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
 * @file trustedWindowRegistration.test.ts
 * @description 四个窗口工厂的「受信任 sender 注册」回归测试
 * @description 每个窗口创建后都必须调用 registerTrustedWindow 把自己的 webContents
 *   登记进信任表，否则该窗口的 IPC 调用只能靠 URL 白名单兜底（开发 / 异常场景下会直接被拒）。
 *   此前只有 captureWindow 有该断言，main/splash/guide/standalone 四个工厂处于无覆盖状态。
 * @author 灵屿
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';

type Listener = (...args: unknown[]) => void;

const { browserWindowCtorMock, registerTrustedWindowMock } = vi.hoisted(() => ({
  browserWindowCtorMock: vi.fn(),
  registerTrustedWindowMock: vi.fn(),
}));

vi.mock('electron', () => {
  const primaryDisplay = {
    id: 1,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    size: { width: 1920, height: 1080 },
    scaleFactor: 1,
  };
  return {
    app: { getAppPath: () => '/app', getPath: () => '/app' },
    BrowserWindow: browserWindowCtorMock,
    ipcMain: { once: vi.fn(), removeListener: vi.fn(), on: vi.fn(), handle: vi.fn() },
    screen: {
      getAllDisplays: () => [primaryDisplay],
      getPrimaryDisplay: () => primaryDisplay,
    },
    shell: { openExternal: vi.fn() },
  };
});

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: false },
}));

vi.mock('../ipc/trustedSender', () => ({
  registerTrustedWindow: registerTrustedWindowMock,
}));

vi.mock('../config/storeConfig', () => ({
  PILL_ISLAND_HEIGHT: 52,
  readIslandShapeModeConfig: () => 'notch',
}));

/** 最小可用的 BrowserWindow 替身：只提供各窗口工厂用到的成员 */
const createFakeWindow = (options: Record<string, unknown>): BrowserWindow => {
  const listeners = new Map<string, Listener[]>();
  const window = {
    options,
    webPreferences: (options.webPreferences ?? {}) as Record<string, unknown>,
    loadFile: vi.fn(async () => undefined),
    loadURL: vi.fn(async () => undefined),
    webContents: {
      send: vi.fn(),
      once: vi.fn(),
      on: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      executeJavaScript: vi.fn(async () => undefined),
    },
    destroyed: false,
    isDestroyed: () => window.destroyed,
    isVisible: () => false,
    focus: vi.fn(),
    show: vi.fn(),
    showInactive: vi.fn(),
    close: vi.fn(),
    center: vi.fn(),
    removeMenu: vi.fn(),
    setBounds: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    setIgnoreMouseEvents: vi.fn(),
    setBackgroundColor: vi.fn(),
    getBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    on: (event: string, listener: Listener) => {
      const existing = listeners.get(event) ?? [];
      existing.push(listener);
      listeners.set(event, existing);
    },
    once: (event: string, listener: Listener) => {
      const existing = listeners.get(event) ?? [];
      existing.push(listener);
      listeners.set(event, existing);
    },
  };
  return window as unknown as BrowserWindow;
};

/** Electron 主进程固有的 process.resourcesPath，Node 环境下需给一个可用值 */
const processWithResourcesPath = process as unknown as { resourcesPath?: string };
const originalResourcesPath = processWithResourcesPath.resourcesPath;
processWithResourcesPath.resourcesPath = 'C:/mock/resources';

const createdWindows: BrowserWindow[] = [];

describe('window factories register their window as a trusted sender', () => {
  beforeEach(() => {
    vi.resetModules();
    createdWindows.length = 0;
    browserWindowCtorMock.mockReset();
    registerTrustedWindowMock.mockReset();
    browserWindowCtorMock.mockImplementation((options: Record<string, unknown>) => {
      const window = createFakeWindow(options);
      createdWindows.push(window);
      return window;
    });
  });

  /** 通用断言：恰好创建一个窗口，并且该窗口被登记为受信任 sender */
  const expectSingleTrustedWindow = () => {
    expect(createdWindows).toHaveLength(1);
    expect(registerTrustedWindowMock).toHaveBeenCalledTimes(1);
    expect(registerTrustedWindowMock).toHaveBeenCalledWith(createdWindows[0]);
  };

  afterAll(() => {
    if (originalResourcesPath === undefined) {
      Reflect.deleteProperty(processWithResourcesPath, 'resourcesPath');
      return;
    }
    processWithResourcesPath.resourcesPath = originalResourcesPath;
  });

  it('registers the main island window', async () => {
    const { createMainWindowService } = await import('./mainWindow');

    let mainWindow: BrowserWindow | null = null;
    const service = createMainWindowService({
      getMainWindow: () => mainWindow,
      setMainWindow: (window) => {
        mainWindow = window;
      },
      getIslandPositionOffset: () => ({ x: 0, y: 0 }),
      getIslandDisplaySelection: () => 'primary',
      setIslandPositionOffset: () => {},
      sanitizeIslandPositionOffset: () => ({ x: 0, y: 0 }),
      sizes: { islandWidth: 200, islandHeight: 60 },
    });

    service.createWindow();

    expectSingleTrustedWindow();
  });

  it('registers the splash window', async () => {
    const { showSplashWindow } = await import('./splashWindow');

    showSplashWindow();

    expectSingleTrustedWindow();
  });

  it('registers the guide window', async () => {
    const { showGuideWindow } = await import('./guideWindow');

    void showGuideWindow();

    expectSingleTrustedWindow();
  });

  it('registers the standalone window', async () => {
    const { openStandaloneWindow } = await import('./standaloneWindow');

    openStandaloneWindow();

    expectSingleTrustedWindow();
  });
});
