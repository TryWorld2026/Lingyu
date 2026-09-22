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
 * @file captureWallpaperHandlers.test.ts
 * @description capture 与 wallpaper IPC handlers 单元测试。
 * @author 灵屿
 */

import { trustedEvent, untrustedEvent } from '../../../test-utils/trustedEvent';
import { UNTRUSTED_SENDER_RESULT } from '../../trustedSender';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { handleMock, onMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  onMock: vi.fn(),
}));

const {
  appGetPathMock,
  clipboardWriteImageMock,
  desktopCapturerGetSourcesMock,
  showSaveDialogMock,
  showOpenDialogMock,
  createFromDataURLMock,
  createThumbnailFromPathMock,
  browserWindowFromWebContentsMock,
  browserWindowGetFocusedWindowMock,
  netFetchMock,
} = vi.hoisted(() => ({
  appGetPathMock: vi.fn(),
  clipboardWriteImageMock: vi.fn(),
  desktopCapturerGetSourcesMock: vi.fn(),
  showSaveDialogMock: vi.fn(),
  showOpenDialogMock: vi.fn(),
  createFromDataURLMock: vi.fn(),
  createThumbnailFromPathMock: vi.fn(),
  browserWindowFromWebContentsMock: vi.fn(),
  browserWindowGetFocusedWindowMock: vi.fn(),
  netFetchMock: vi.fn(),
}));

const {
  writeFileSyncMock,
  existsSyncMock,
  readFileSyncMock,
  readdirSyncMock,
  unlinkSyncMock,
  mkdirSyncMock,
  copyFileSyncMock,
} = vi.hoisted(() => ({
  writeFileSyncMock: vi.fn(),
  existsSyncMock: vi.fn(),
  readFileSyncMock: vi.fn(),
  readdirSyncMock: vi.fn(),
  unlinkSyncMock: vi.fn(),
  mkdirSyncMock: vi.fn(),
  copyFileSyncMock: vi.fn(),
}));

const { execFileMock, capturePrimaryDisplayPngMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  capturePrimaryDisplayPngMock: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: appGetPathMock,
  },
  clipboard: {
    writeImage: clipboardWriteImageMock,
  },
  desktopCapturer: {
    getSources: desktopCapturerGetSourcesMock,
  },
  dialog: {
    showSaveDialog: showSaveDialogMock,
    showOpenDialog: showOpenDialogMock,
  },
  ipcMain: {
    handle: handleMock,
    on: onMock,
  },
  nativeImage: {
    createFromDataURL: createFromDataURLMock,
    createThumbnailFromPath: createThumbnailFromPathMock,
  },
  BrowserWindow: {
    fromWebContents: browserWindowFromWebContentsMock,
    getFocusedWindow: browserWindowGetFocusedWindowMock,
  },
  net: {
    fetch: netFetchMock,
  },
}));

vi.mock('fs', () => ({
  writeFileSync: writeFileSyncMock,
  existsSync: existsSyncMock,
  readFileSync: readFileSyncMock,
  readdirSync: readdirSyncMock,
  unlinkSync: unlinkSyncMock,
  mkdirSync: mkdirSyncMock,
  copyFileSync: copyFileSyncMock,
}));

vi.mock('child_process', () => ({
  execFile: execFileMock,
}));

vi.mock('../../../window/screenshotHelper', () => ({
  capturePrimaryDisplayPng: capturePrimaryDisplayPngMock,
}));

import { registerCaptureIpcHandlers } from '../capture';
import { registerWallpaperIpcHandlers } from '../wallpaper';

describe('capture and wallpaper ipc handlers', () => {
  const handleHandlers = new Map<string, (...args: unknown[]) => unknown>();
  const onHandlers = new Map<string, (...args: unknown[]) => unknown>();

  beforeEach(() => {
    handleHandlers.clear();
    onHandlers.clear();

    handleMock.mockReset();
    onMock.mockReset();
    appGetPathMock.mockReset();
    clipboardWriteImageMock.mockReset();
    desktopCapturerGetSourcesMock.mockReset();
    showSaveDialogMock.mockReset();
    showOpenDialogMock.mockReset();
    createFromDataURLMock.mockReset();
    createThumbnailFromPathMock.mockReset();
    browserWindowFromWebContentsMock.mockReset();
    browserWindowGetFocusedWindowMock.mockReset();
    netFetchMock.mockReset();

    writeFileSyncMock.mockReset();
    existsSyncMock.mockReset();
    readFileSyncMock.mockReset();
    readdirSyncMock.mockReset();
    unlinkSyncMock.mockReset();
    mkdirSyncMock.mockReset();
    copyFileSyncMock.mockReset();

    execFileMock.mockReset();
    capturePrimaryDisplayPngMock.mockReset();
    capturePrimaryDisplayPngMock.mockReturnValue(null);

    appGetPathMock.mockImplementation((name: string) => {
      if (name === 'pictures') return 'C:/Pictures';
      return 'C:/AppData/eIsland';
    });

    handleMock.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
      handleHandlers.set(channel, handler);
    });
    onMock.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
      onHandlers.set(channel, handler);
    });
  });

  it('handles capture screenshot start/system/copy/save/cancel', async () => {
    const closeCaptureWindow = vi.fn();
    const startRegionScreenshot = vi.fn().mockResolvedValue(undefined);
    const captureWindow = {
      isDestroyed: vi.fn(() => false),
      hide: vi.fn(),
      webContents: { id: 7 },
    };

    const pngBuffer = Buffer.from('png-data');
    createFromDataURLMock.mockReturnValue({
      toPNG: vi.fn(() => pngBuffer),
    });

    desktopCapturerGetSourcesMock.mockResolvedValue([
      {
        thumbnail: {
          toPNG: () => Buffer.from('abc'),
        },
      },
    ]);

    showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: 'C:/Pictures/s1.png',
    });

    registerCaptureIpcHandlers({
      getCaptureWindow: () => captureWindow as never,
      closeCaptureWindow,
      startRegionScreenshot,
    });

    await expect(handleHandlers.get('system:screenshot:region:start')?.(trustedEvent())).resolves.toBe(true);
    startRegionScreenshot.mockRejectedValueOnce(new Error('boom'));
    await expect(handleHandlers.get('system:screenshot:region:start')?.(trustedEvent())).resolves.toBe(false);

    await expect(handleHandlers.get('system:screenshot')?.(trustedEvent())).resolves.toBe(Buffer.from('abc').toString('base64'));

    onHandlers.get('capture-complete')?.(trustedEvent(), { dataURL: 'data:image/png;base64,AAA' });
    expect(createFromDataURLMock).toHaveBeenCalledWith('data:image/png;base64,AAA');
    expect(clipboardWriteImageMock).toHaveBeenCalled();
    expect(closeCaptureWindow).toHaveBeenCalledTimes(1);

    await onHandlers.get('capture-save')?.(trustedEvent(), { dataURL: 'data:image/png;base64,BBB' });
    expect(captureWindow.hide).toHaveBeenCalled();
    expect(writeFileSyncMock).toHaveBeenCalledWith('C:/Pictures/s1.png', pngBuffer);

    onHandlers.get('capture-cancel')?.(trustedEvent());
    expect(closeCaptureWindow).toHaveBeenCalledTimes(3);

    // 回归防护：本用例注册的 IPC channel 必须仍受 sender 门禁保护
    expect(handleHandlers.size).toBeGreaterThan(0);
    for (const [channel, handler] of handleHandlers) {
      expect(handler(untrustedEvent()), channel + ' 必须仍受 sender 门禁保护').toEqual(UNTRUSTED_SENDER_RESULT);
    }
    const untrustedWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(onHandlers.size).toBeGreaterThan(0);
    for (const [channel, handler] of onHandlers) {
      untrustedWarn.mockClear();
      handler(untrustedEvent());
      expect(untrustedWarn).toHaveBeenCalledWith(expect.stringContaining(channel));
    }
    untrustedWarn.mockRestore();
  });

  it('handles wallpaper open/load/clear/read-buffer branches', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(12345);
    const focusedWindow = { id: 1 };

    browserWindowFromWebContentsMock.mockReturnValue(null);
    browserWindowGetFocusedWindowMock.mockReturnValue(focusedWindow);

    showOpenDialogMock
      .mockResolvedValueOnce({
        canceled: false,
        filePaths: ['D:/wall/in.png'],
      })
      .mockResolvedValueOnce({
        canceled: false,
        filePaths: ['D:/wall/in.mp4'],
      });

    existsSyncMock.mockImplementation((p: string) => {
      if (p.includes('wallpapers')) return true;
      if (p === 'D:/wall/in.png') return true;
      if (p === 'C:/AppData/eIsland/wallpapers/custom-bg-abc.png') return true;
      return true;
    });
    readdirSyncMock.mockReturnValue(['custom-bg-abc.png', 'keep.txt']);
    readFileSyncMock.mockReturnValue(Buffer.from('img'));
    createThumbnailFromPathMock.mockResolvedValue({
      isEmpty: () => false,
      toJPEG: () => Buffer.from('thumb'),
    });

    registerWallpaperIpcHandlers();

    const openImage = handleHandlers.get('dialog:open-image');
    const openVideo = handleHandlers.get('dialog:open-video');
    const loadFile = handleHandlers.get('wallpaper:load-file');
    const loadThumbnail = handleHandlers.get('album:load-thumbnail');
    const clearCache = handleHandlers.get('wallpaper:clear-cache');
    const readBuffer = handleHandlers.get('wallpaper:read-file-buffer');

    const openImageResult = await openImage?.(trustedEvent());
    const openVideoResult = await openVideo?.(trustedEvent());

    expect(showOpenDialogMock).toHaveBeenCalledTimes(2);
    expect(openImageResult).toContain('custom-bg-12345.png');
    expect(openVideoResult).toContain('custom-bg-12345.mp4');
    expect(copyFileSyncMock).toHaveBeenCalled();
    expect(unlinkSyncMock).toHaveBeenCalledWith(expect.stringContaining('custom-bg-abc.png'));

    await expect(loadFile?.(trustedEvent(), 'D:/wall/in.png')).resolves.toBe(`data:image/png;base64,${Buffer.from('img').toString('base64')}`);
    await expect(loadThumbnail?.(trustedEvent(), 'D:/wall/in.png')).resolves.toBe(`data:image/jpeg;base64,${Buffer.from('thumb').toString('base64')}`);
    expect(createThumbnailFromPathMock).toHaveBeenCalledWith('D:/wall/in.png', { width: 320, height: 320 });
    await expect(readBuffer?.(trustedEvent(), 'C:/AppData/eIsland/wallpapers/test.png')).resolves.toEqual(new Uint8Array(Buffer.from('img')));

    await clearCache?.(trustedEvent());
    expect(unlinkSyncMock).toHaveBeenCalled();

    nowSpy.mockRestore();
  });

  it('handles wallpaper system:set clear and sourcePath set', async () => {
    registerWallpaperIpcHandlers();

    const systemSet = handleHandlers.get('wallpaper:system:set');

    if (process.platform !== 'win32') {
      await expect(systemSet?.(trustedEvent(), { clear: true })).resolves.toBe(false);
      await expect(systemSet?.(trustedEvent(), { sourcePath: 'D:/wall/in.png' })).resolves.toBe(false);
      return;
    }

    existsSyncMock.mockImplementation((p: string) => {
      if (p.includes('wallpapers')) return true;
      if (p.includes('desktop-sync-wallpaper-black.bmp')) return true;
      if (p === 'D:/wall/in.png') return true;
      return false;
    });

    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, callback: (err: Error | null, stdout: string) => void) => {
        callback(null, 'True');
      },
    );

    await expect(systemSet?.(trustedEvent(), { clear: true })).resolves.toBe(true);
    expect(writeFileSyncMock).toHaveBeenCalled();

    await expect(systemSet?.(trustedEvent(), { sourcePath: 'D:/wall/in.png' })).resolves.toBe(true);
    expect(execFileMock).toHaveBeenCalled();

    // 回归防护：本用例注册的 IPC channel 必须仍受 sender 门禁保护
    expect(handleHandlers.size).toBeGreaterThan(0);
    for (const [channel, handler] of handleHandlers) {
      expect(handler(untrustedEvent()), channel + ' 必须仍受 sender 门禁保护').toEqual(UNTRUSTED_SENDER_RESULT);
    }
  });
});
