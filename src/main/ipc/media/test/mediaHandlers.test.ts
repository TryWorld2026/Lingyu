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
 * @file mediaHandlers.test.ts
 * @description media IPC handlers 单元测试。
 * @author 灵屿
 */

import { trustedEvent, untrustedEvent } from '../../../test-utils/trustedEvent';
import { UNTRUSTED_SENDER_RESULT } from '../../trustedSender';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { handleMock, getAllWindowsMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  getAllWindowsMock: vi.fn(),
}));

const {
  existsSyncMock,
  readFileSyncMock,
  writeFileSyncMock,
  broadcastSettingChangeMock,
} = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
  readFileSyncMock: vi.fn(),
  writeFileSyncMock: vi.fn(),
  broadcastSettingChangeMock: vi.fn(),
}));

const {
  playMock,
  pauseMock,
  nextMock,
  previousMock,
  seekMock,
} = vi.hoisted(() => ({
  playMock: vi.fn(),
  pauseMock: vi.fn(),
  nextMock: vi.fn(),
  previousMock: vi.fn(),
  seekMock: vi.fn(),
}));

const {
  getMuteMock,
  setMuteMock,
} = vi.hoisted(() => ({
  getMuteMock: vi.fn(),
  setMuteMock: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
  },
  BrowserWindow: {
    getAllWindows: getAllWindowsMock,
  },
}));

vi.mock('fs', () => ({
  existsSync: existsSyncMock,
  readFileSync: readFileSyncMock,
  writeFileSync: writeFileSyncMock,
}));

vi.mock('../../../utils/broadcast', () => ({
  broadcastSettingChange: broadcastSettingChangeMock,
}));

vi.mock('@lingyu/windows-volume-helper', () => ({
  getMute: getMuteMock,
  setMute: setMuteMock,
}));

vi.mock('@lingyu/windows-smtc-helper', () => ({
  play: playMock,
  pause: pauseMock,
  next: nextMock,
  previous: previousMock,
  seek: seekMock,
}));

import { registerMediaIpcHandlers } from '../media';
import { registerMusicIpcHandlers } from '../music';

describe('media ipc handlers', () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();

  beforeEach(() => {
    handlers.clear();
    handleMock.mockReset();
    getAllWindowsMock.mockReset();
    existsSyncMock.mockReset();
    readFileSyncMock.mockReset();
    writeFileSyncMock.mockReset();
    broadcastSettingChangeMock.mockReset();
    getMuteMock.mockReset();
    setMuteMock.mockReset();

    handleMock.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    });
  });

  it('handles media keys with whitelist guard', () => {
    playMock.mockClear();
    pauseMock.mockClear();
    nextMock.mockClear();
    previousMock.mockClear();

    registerMediaIpcHandlers({
      getMainWindow: () => null,
      isWhitelisted: () => false,
      getPendingSourceSwitchId: () => '',
      setPendingSourceSwitchId: vi.fn(),
      getPendingSourceSwitchEntry: () => null,
      clearPendingSourceSwitchEntry: vi.fn(),
      getCurrentDeviceId: () => 'device-1',
      setCurrentDeviceId: vi.fn(),
      getSmtcSessionRuntime: () => new Map(),
    });

    handlers.get('media:play-pause')?.(trustedEvent());
    handlers.get('media:next')?.(trustedEvent());
    handlers.get('media:prev')?.(trustedEvent());

    // 无播放会话时 isPlaying=false，应调用 play()
    expect(playMock).toHaveBeenCalledTimes(1);
    expect(nextMock).not.toHaveBeenCalled();
    expect(previousMock).not.toHaveBeenCalled();

    // 回归防护：本用例注册的 IPC channel 必须仍受 sender 门禁保护
    expect(handlers.size).toBeGreaterThan(0);
    for (const [channel, handler] of handlers) {
      expect(handler(untrustedEvent()), channel + ' 必须仍受 sender 门禁保护').toEqual(UNTRUSTED_SENDER_RESULT);
    }
  });

  it('reads and toggles the default playback device mute state', () => {
    getMuteMock
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(null);
    setMuteMock
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    registerMediaIpcHandlers({
      getMainWindow: () => null,
      isWhitelisted: () => true,
      getPendingSourceSwitchId: () => '',
      setPendingSourceSwitchId: vi.fn(),
      getPendingSourceSwitchEntry: () => null,
      clearPendingSourceSwitchEntry: vi.fn(),
      getCurrentDeviceId: () => 'device-1',
      setCurrentDeviceId: vi.fn(),
      getSmtcSessionRuntime: () => new Map(),
    });

    expect(handlers.get('media:get-muted')?.(trustedEvent())).toBe(false);
    expect(handlers.get('media:toggle-muted')?.(trustedEvent())).toBe(true);
    expect(setMuteMock).toHaveBeenNthCalledWith(1, true);
    expect(handlers.get('media:toggle-muted')?.(trustedEvent())).toBeNull();
    expect(setMuteMock).toHaveBeenNthCalledWith(2, false);
    expect(handlers.get('media:toggle-muted')?.(trustedEvent())).toBeNull();
  });

  it('returns current info and applies source switch updates', () => {
    const setPendingSourceSwitchId = vi.fn();
    const clearPendingSourceSwitchEntry = vi.fn();
    let currentDeviceId = 'device-1';
    const setCurrentDeviceId = vi.fn((id: string) => {
      currentDeviceId = id;
    });
    const sessionRuntime = new Map<string, { payload: unknown; hasTitle: boolean }>([
      ['device-2', { payload: { title: 'Hello' }, hasTitle: true }],
      ['device-1', { payload: { title: 'NoTitle' }, hasTitle: false }],
    ]);

    const aliveWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: { send: vi.fn() },
    };
    const deadWindow = {
      isDestroyed: vi.fn(() => true),
      webContents: { send: vi.fn() },
    };
    getAllWindowsMock.mockReturnValue([aliveWindow, deadWindow]);

    registerMediaIpcHandlers({
      getMainWindow: () => null,
      isWhitelisted: () => true,
      getPendingSourceSwitchId: () => 'device-2',
      setPendingSourceSwitchId,
      getPendingSourceSwitchEntry: () => ({ some: 'entry' }),
      clearPendingSourceSwitchEntry,
      getCurrentDeviceId: () => currentDeviceId,
      setCurrentDeviceId,
      getSmtcSessionRuntime: () => sessionRuntime,
    });

    expect(handlers.get('media:current-info:get')?.(trustedEvent())).toBeNull();

    handlers.get('media:accept-source-switch')?.(trustedEvent());

    expect(setCurrentDeviceId).toHaveBeenCalledWith('device-2');
    expect(setPendingSourceSwitchId).toHaveBeenCalledWith('');
    expect(clearPendingSourceSwitchEntry).toHaveBeenCalled();
    expect(aliveWindow.webContents.send).toHaveBeenCalledWith('nowplaying:info', { title: 'Hello' });
    expect(deadWindow.webContents.send).not.toHaveBeenCalled();

    handlers.get('media:reject-source-switch')?.(trustedEvent());
    expect(setPendingSourceSwitchId).toHaveBeenCalledTimes(2);
    expect(clearPendingSourceSwitchEntry).toHaveBeenCalledTimes(2);
  });

  it('handles music persistence and fallback branches', async () => {
    const setWhitelist = vi.fn();
    const setSmtcUnsubscribeMs = vi.fn();
    const sanitizeSmtcUnsubscribeMs = vi.fn((v: unknown) => Number(v) || 3000);

    registerMusicIpcHandlers({
      storeDir: 'C:/store',
      whitelistStoreKey: 'whitelist',
      lyricsSourceStoreKey: 'lyricsSource',
      lyricsKaraokeStoreKey: 'lyricsKaraoke',
      lyricsClockStoreKey: 'lyricsClock',
      lyricsCalibrateEnabledStoreKey: 'lyricsCalibrateEnabled',
      lyricsCalibrateDelayStoreKey: 'lyricsCalibrateDelay',
      lyricsEnabledStoreKey: 'lyricsEnabled',
      lyricsTranslationEnabledStoreKey: 'lyricsTranslationEnabled',
      smtcUnsubscribeStoreKey: 'smtcUnsubscribe',
      defaultLyricsKaraoke: true,
      defaultLyricsClock: false,
      defaultLyricsCalibrateEnabled: true,
      defaultLyricsCalibrateDelay: 20,
      getWhitelist: () => ['A', 'B'],
      setWhitelist,
      readLyricsSourceConfig: () => 'netease',
      getSmtcUnsubscribeMs: () => 2500,
      setSmtcUnsubscribeMs,
      sanitizeSmtcUnsubscribeMs,
      detectAllSources: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ sourceAppId: 'spotify', isPlaying: true, hasTitle: true, thumbnail: null }])
        .mockRejectedValueOnce(new Error('boom')),
    });

    const event = trustedEvent(42);
    expect(handlers.get('music:whitelist:get')?.(event)).toEqual(['A', 'B']);
    expect(handlers.get('music:whitelist:set')?.(event, ['C'])).toBe(true);
    expect(setWhitelist).toHaveBeenCalledWith(['C']);
    expect(writeFileSyncMock).toHaveBeenCalled();
    expect(broadcastSettingChangeMock).toHaveBeenCalledWith(
      event.sender.id,
      'store:music-whitelist',
      ['C'],
    );

    writeFileSyncMock.mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    expect(handlers.get('music:lyrics-source:set')?.(trustedEvent(), 'qqmusic')).toBe(false);

    existsSyncMock.mockReturnValue(false);
    expect(handlers.get('music:lyrics-karaoke:get')?.(trustedEvent())).toBe(true);

    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue('false');
    expect(handlers.get('music:lyrics-clock:get')?.(trustedEvent())).toBe(false);

    expect(handlers.get('music:smtc-unsubscribe-ms:get')?.(trustedEvent())).toBe(2500);
    expect(handlers.get('music:smtc-unsubscribe-ms:set')?.(trustedEvent(), 1234)).toBe(true);
    expect(sanitizeSmtcUnsubscribeMs).toHaveBeenCalledWith(1234);
    expect(setSmtcUnsubscribeMs).toHaveBeenCalledWith(1234);

    const detect = handlers.get('music:detect-source-app-id');
    await expect(detect?.(trustedEvent())).resolves.toEqual({ ok: false, sources: [], message: '当前无播放程序' });
    await expect(detect?.(trustedEvent())).resolves.toEqual({
      ok: true,
      sources: [{ sourceAppId: 'spotify', isPlaying: true, hasTitle: true, thumbnail: null }],
      message: '',
    });
    await expect(detect?.(trustedEvent())).resolves.toEqual({ ok: false, sources: [], message: '读取会话异常' });

    // 回归防护：本用例注册的 IPC channel 必须仍受 sender 门禁保护
    expect(handlers.size).toBeGreaterThan(0);
    for (const [channel, handler] of handlers) {
      expect(handler(untrustedEvent()), channel + ' 必须仍受 sender 门禁保护').toEqual(UNTRUSTED_SENDER_RESULT);
    }
  });
});
