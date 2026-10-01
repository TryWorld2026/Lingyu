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
 * @description 各窗口必须绑定自己的页面入口；引导和启动消息还需校验来源窗口与页面。
 * @author 灵屿
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import { pathToFileURL } from 'url';

type Listener = (...args: unknown[]) => void;

const {
  browserWindowCtorMock,
  registerTrustedWindowMock,
  isTrustedSenderMock,
  ipcOnMock,
  ipcOnceMock,
  ipcRemoveListenerMock,
  appOnMock,
} = vi.hoisted(() => ({
  browserWindowCtorMock: vi.fn(),
  registerTrustedWindowMock: vi.fn(),
  isTrustedSenderMock: vi.fn(),
  ipcOnMock: vi.fn(),
  ipcOnceMock: vi.fn(),
  ipcRemoveListenerMock: vi.fn(),
  appOnMock: vi.fn(),
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
    app: { getAppPath: () => '/app', getPath: () => '/app', on: appOnMock },
    BrowserWindow: browserWindowCtorMock,
    ipcMain: { once: ipcOnceMock, removeListener: ipcRemoveListenerMock, on: ipcOnMock, handle: vi.fn() },
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
  isTrustedSender: isTrustedSenderMock,
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
    hide: vi.fn(),
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
    emit: (event: string, ...args: unknown[]) => {
      listeners.get(event)?.forEach((listener) => listener(...args));
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
    isTrustedSenderMock.mockReset();
    ipcOnMock.mockReset();
    ipcOnceMock.mockReset();
    ipcRemoveListenerMock.mockReset();
    appOnMock.mockReset();
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
    const window = createdWindows[0] as unknown as { loadFile: ReturnType<typeof vi.fn> };
    const entryUrl = pathToFileURL(window.loadFile.mock.calls[0][0] as string).href;
    expect(registerTrustedWindowMock).toHaveBeenCalledWith(createdWindows[0], entryUrl);
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

    const window = createdWindows[0] as BrowserWindow & { emit: (event: string, ...args: unknown[]) => void };
    const preventDefault = vi.fn();
    window.emit('close', { preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(window.hide).toHaveBeenCalledOnce();
    openStandaloneWindow();
    expect(createdWindows).toHaveLength(1);
    expect(window.show).toHaveBeenCalledOnce();
    const beforeQuit = appOnMock.mock.calls.find(([event]) => event === 'before-quit')![1];
    beforeQuit();
    preventDefault.mockClear();
    window.emit('close', { preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('accepts guide completion only from the trusted guide page', async () => {
    const { showGuideWindow } = await import('./guideWindow');
    const completion = showGuideWindow();
    const window = createdWindows[0];
    const listener = [...ipcOnMock.mock.calls, ...ipcOnceMock.mock.calls]
      .find(([channel]) => channel === 'guide:complete')?.[1] as Listener;

    isTrustedSenderMock.mockReturnValue(false);
    listener({ sender: window.webContents });
    expect(window.close).not.toHaveBeenCalled();
    expect(ipcRemoveListenerMock).not.toHaveBeenCalled();

    isTrustedSenderMock.mockReturnValue(true);
    listener({ sender: {} });
    expect(window.close).not.toHaveBeenCalled();

    listener({ sender: window.webContents });
    expect(window.close).toHaveBeenCalledTimes(1);
    expect(ipcRemoveListenerMock).toHaveBeenCalledWith('guide:complete', listener);
    await expect(completion).resolves.toBe(true);
  });

  it.each(['splash:renderer-ready', 'splash:video-ended'])(
    'keeps %s pending until a trusted splash page sends it',
    async (channel) => {
      const { showSplashWindow } = await import('./splashWindow');
      showSplashWindow();
      const window = createdWindows[0];
      const listener = [...ipcOnMock.mock.calls, ...ipcOnceMock.mock.calls]
        .find(([registeredChannel]) => registeredChannel === channel)?.[1] as Listener;
      const untrustedEvent = { sender: window.webContents };

      isTrustedSenderMock.mockReturnValue(false);
      listener(untrustedEvent);
      expect(isTrustedSenderMock).toHaveBeenCalledWith(untrustedEvent);
      expect(window.showInactive).not.toHaveBeenCalled();
      expect(ipcRemoveListenerMock).not.toHaveBeenCalled();

      isTrustedSenderMock.mockReturnValue(true);
      listener({ sender: {} });
      expect(ipcRemoveListenerMock).not.toHaveBeenCalled();

      listener({ sender: window.webContents });
      expect(ipcRemoveListenerMock).toHaveBeenCalledWith(channel, listener);
    },
  );
});
