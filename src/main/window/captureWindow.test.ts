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
 * @file captureWindow.test.ts
 * @description 截图窗口服务单元测试：聚焦窗口加固参数、受信任窗口注册与截图数据下发
 * @author 灵屿
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';

type Listener = (...args: unknown[]) => void;

interface FakeWindow {
  options: Record<string, unknown>;
  webPreferences: Record<string, unknown>;
  loadFile: ReturnType<typeof vi.fn>;
  webContents: { send: ReturnType<typeof vi.fn> };
  destroyed: boolean;
  isDestroyed: () => boolean;
  setBounds: ReturnType<typeof vi.fn>;
  setAlwaysOnTop: ReturnType<typeof vi.fn>;
  setIgnoreMouseEvents: ReturnType<typeof vi.fn>;
  showInactive: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  setOpacity: ReturnType<typeof vi.fn>;
  on: (event: string, listener: Listener) => void;
  emit: (event: string, ...args: unknown[]) => void;
  close: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

const {
  browserWindowCtorMock,
  desktopCapturerGetSourcesMock,
  getVisibleWindowsMock,
  capturePrimaryDisplayPngMock,
  captureAllDisplaysPngMock,
  readScreenshotEngineConfigMock,
  registerTrustedWindowMock,
  mainWindowShowMock,
  mainWindowSetAlwaysOnTopMock,
  mainWindowIsVisibleMock,
} = vi.hoisted(() => ({
  browserWindowCtorMock: vi.fn(),
  desktopCapturerGetSourcesMock: vi.fn(),
  getVisibleWindowsMock: vi.fn(),
  capturePrimaryDisplayPngMock: vi.fn(),
  captureAllDisplaysPngMock: vi.fn(),
  readScreenshotEngineConfigMock: vi.fn(),
  registerTrustedWindowMock: vi.fn(),
  mainWindowShowMock: vi.fn(),
  mainWindowSetAlwaysOnTopMock: vi.fn(),
  mainWindowIsVisibleMock: vi.fn(),
}));

vi.mock('electron', () => {
  const primaryDisplay = {
    id: 1,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    size: { width: 1920, height: 1080 },
    scaleFactor: 1,
  };
  return {
    app: {
      getAppPath: () => '/app',
      getPath: () => '/app',
    },
    BrowserWindow: browserWindowCtorMock,
    desktopCapturer: { getSources: desktopCapturerGetSourcesMock },
    screen: {
      getAllDisplays: () => [primaryDisplay],
      getPrimaryDisplay: () => primaryDisplay,
      dipToScreenRect: (_display: unknown, rect: unknown) => rect,
    },
  };
});

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: false },
}));

vi.mock('./screenshotHelper', () => ({
  capturePrimaryDisplayPng: capturePrimaryDisplayPngMock,
  captureAllDisplaysPng: captureAllDisplaysPngMock,
  getVisibleWindows: getVisibleWindowsMock,
}));

vi.mock('../config/storeConfig', () => ({
  readScreenshotEngineConfig: readScreenshotEngineConfigMock,
}));

// sender 校验由 trustedSender.test.ts 专项覆盖，此处仅断言注册动作
vi.mock('../ipc/trustedSender', () => ({
  registerTrustedWindow: registerTrustedWindowMock,
}));

import { createCaptureWindowService } from './captureWindow';

/** Electron 主进程才有的 process.resourcesPath，Node 环境下需补一个可用值 */
const processWithResourcesPath = process as unknown as { resourcesPath?: string };
const originalResourcesPath = processWithResourcesPath.resourcesPath;
processWithResourcesPath.resourcesPath = 'C:/mock/resources';

const createdWindows: FakeWindow[] = [];

const createFakeWindow = (options: Record<string, unknown>): FakeWindow => {
  const listeners = new Map<string, Listener[]>();
  const window: FakeWindow = {
    options,
    webPreferences: (options.webPreferences ?? {}) as Record<string, unknown>,
    loadFile: vi.fn(async () => undefined),
    webContents: { send: vi.fn() },
    destroyed: false,
    isDestroyed: () => window.destroyed,
    setBounds: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    setIgnoreMouseEvents: vi.fn(),
    showInactive: vi.fn(),
    focus: vi.fn(),
    setOpacity: vi.fn(),
    on: (event, listener) => {
      const existing = listeners.get(event) ?? [];
      existing.push(listener);
      listeners.set(event, existing);
    },
    emit: (event, ...args) => {
      for (const listener of listeners.get(event) ?? []) listener(...args);
    },
    close: vi.fn(),
    destroy: vi.fn(),
  };
  return window;
};

const mainWindow = {
  isDestroyed: () => false,
  isVisible: mainWindowIsVisibleMock,
  show: mainWindowShowMock,
  setAlwaysOnTop: mainWindowSetAlwaysOnTopMock,
  hide: vi.fn(),
  once: vi.fn(),
  removeListener: vi.fn(),
} as unknown as BrowserWindow;

const createService = () => createCaptureWindowService({ getMainWindow: () => mainWindow });

describe('capture window service', () => {
  beforeEach(() => {
    createdWindows.length = 0;

    browserWindowCtorMock.mockReset();
    browserWindowCtorMock.mockImplementation((options: Record<string, unknown>) => {
      const window = createFakeWindow(options);
      createdWindows.push(window);
      return window as unknown as BrowserWindow;
    });

    desktopCapturerGetSourcesMock.mockReset();
    desktopCapturerGetSourcesMock.mockResolvedValue([
      { thumbnail: { toPNG: () => Buffer.from('js-screenshot') } },
    ]);
    getVisibleWindowsMock.mockReset();
    getVisibleWindowsMock.mockReturnValue([]);
    capturePrimaryDisplayPngMock.mockReset();
    capturePrimaryDisplayPngMock.mockReturnValue(null);
    captureAllDisplaysPngMock.mockReset();
    captureAllDisplaysPngMock.mockReturnValue(null);
    readScreenshotEngineConfigMock.mockReset();
    readScreenshotEngineConfigMock.mockReturnValue('js');
    registerTrustedWindowMock.mockReset();

    mainWindowShowMock.mockReset();
    mainWindowSetAlwaysOnTopMock.mockReset();
    mainWindowIsVisibleMock.mockReset();
    mainWindowIsVisibleMock.mockReturnValue(false);
  });

  afterAll(() => {
    if (originalResourcesPath === undefined) {
      Reflect.deleteProperty(processWithResourcesPath, 'resourcesPath');
      return;
    }
    processWithResourcesPath.resourcesPath = originalResourcesPath;
  });

  it('creates the capture window with hardened webPreferences and registers it as trusted', async () => {
    await createService().startRegionScreenshot();

    expect(browserWindowCtorMock).toHaveBeenCalledTimes(1);
    expect(createdWindows).toHaveLength(1);

    const window = createdWindows[0];
    expect(window.webPreferences).toEqual({
      preload: expect.stringMatching(/preload[\\/]capture\.js$/),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    });
    expect(window.options.transparent).toBe(true);
    expect(window.options.frame).toBe(false);
    expect(window.options.nodeIntegration).toBeUndefined();

    expect(registerTrustedWindowMock).toHaveBeenCalledTimes(1);
    expect(registerTrustedWindowMock).toHaveBeenCalledWith(window);
  });

  it('sends the captured image to the page once it has loaded', async () => {
    const service = createService();
    await service.startRegionScreenshot();

    const window = createdWindows[0];
    expect(window.loadFile).toHaveBeenCalledTimes(1);
    expect(window.webContents.send).toHaveBeenCalledWith(
      'capture-image',
      expect.objectContaining({
        captureSource: 'js',
        scaleFactor: 1,
        displays: [],
        physicalScreen: null,
        visibleWindows: [],
      }),
    );
    expect(window.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false);
    expect(window.setOpacity).toHaveBeenCalledWith(1);
    expect(service.getCaptureWindow()).toBe(window as unknown as BrowserWindow);
  });

  it('uses the native capture path and forwards display layouts for the plugin engine', async () => {
    readScreenshotEngineConfigMock.mockReturnValue('plugin');
    capturePrimaryDisplayPngMock.mockReturnValue(Buffer.from('native-screenshot'));

    await createService().startRegionScreenshot();

    expect(desktopCapturerGetSourcesMock).not.toHaveBeenCalled();
    expect(createdWindows[0].webContents.send).toHaveBeenCalledWith(
      'capture-image',
      expect.objectContaining({
        captureSource: 'plugin',
        displays: [expect.objectContaining({ id: 1 })],
        physicalScreen: expect.objectContaining({ width: 1920, height: 1080 }),
      }),
    );
  });

  it('does not create a second capture window while one is open', async () => {
    const service = createService();
    await service.startRegionScreenshot();
    await service.startRegionScreenshot();

    expect(browserWindowCtorMock).toHaveBeenCalledTimes(1);
  });

  it('restores the main window when the capture window closes', async () => {
    const service = createService();
    await service.startRegionScreenshot();

    createdWindows[0].emit('closed');

    expect(mainWindowShowMock).toHaveBeenCalledTimes(1);
    expect(mainWindowSetAlwaysOnTopMock).toHaveBeenCalledWith(true, 'screen-saver');
    expect(service.getCaptureWindow()).toBeNull();
  });

  it('closes the capture window through the service', async () => {
    const service = createService();
    await service.startRegionScreenshot();

    service.closeCaptureWindow();

    expect(createdWindows[0].close).toHaveBeenCalledTimes(1);
  });
});
