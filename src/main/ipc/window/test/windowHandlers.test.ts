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
 * @file windowHandlers.test.ts
 * @description 单元测试文件
 * @author 灵屿
 */

import { trustedEvent, untrustedEvent } from '../../../test-utils/trustedEvent';
import { UNTRUSTED_SENDER_RESULT } from '../../trustedSender';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { handleMock, onMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  onMock: vi.fn(),
}));

const { broadcastSettingChangeMock } = vi.hoisted(() => ({
  broadcastSettingChangeMock: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
    on: onMock,
  },
  screen: {
    getCursorScreenPoint: vi.fn(() => ({ x: 10, y: 20 })),
    getPrimaryDisplay: vi.fn(() => ({ id: 1, workArea: { y: 0, width: 1920, height: 1080 } })),
    getAllDisplays: vi.fn(() => [{ id: 1, workArea: { width: 1920, height: 1080 } }]),
    getDisplayNearestPoint: vi.fn(() => ({ id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } })),
  },
  BrowserWindow: class {},
}));

vi.mock('../../../utils/broadcast', () => ({
  broadcastSettingChange: broadcastSettingChangeMock,
}));

vi.mock('../../../config/storeConfig', () => ({
  readIslandShapeModeConfig: () => 'notch',
  PILL_ISLAND_HEIGHT: 52,
  PILL_EXPANDED_HEIGHT: 72,
  PILL_NOTIFICATION_HEIGHT: 100,
  PILL_LYRICS_HEIGHT: 52,
  PILL_LYRICS_TRANSLATION_HEIGHT: 72,
  PILL_EXPANDED_FULL_HEIGHT: 164,
  PILL_SETTINGS_HEIGHT: 416,
}));

import { registerWindowIpcHandlers, toggleMousePassthroughLock } from '../window';

describe('window ipc handlers', () => {
  const handleHandlers = new Map<string, (...args: unknown[]) => unknown>();
  const onHandlers = new Map<string, (...args: unknown[]) => unknown>();
  const win = {
    isDestroyed: vi.fn(() => false),
    setIgnoreMouseEvents: vi.fn(),
    setFocusable: vi.fn(),
    getBounds: vi.fn(() => ({ x: 100, y: 200, width: 300, height: 100 })),
    setBounds: vi.fn(),
    hide: vi.fn(),
    webContents: { send: vi.fn() },
  };

  beforeEach(() => {
    handleHandlers.clear();
    onHandlers.clear();
    handleMock.mockReset();
    onMock.mockReset();
    broadcastSettingChangeMock.mockReset();
    win.isDestroyed.mockReset();
    win.isDestroyed.mockReturnValue(false);
    win.setIgnoreMouseEvents.mockReset();
    win.setFocusable.mockReset();
    win.getBounds.mockReset();
    win.getBounds.mockReturnValue({ x: 100, y: 200, width: 300, height: 100 });
    win.setBounds.mockReset();
    win.hide.mockReset();
    win.webContents.send.mockReset();

    handleMock.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
      handleHandlers.set(channel, handler);
    });
    onMock.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
      onHandlers.set(channel, handler);
    });
  });

  it('toggles passthrough lock state', () => {
    toggleMousePassthroughLock(() => win as never);
    expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });

    toggleMousePassthroughLock(() => win as never);
    expect(win.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false);
  });

  it('registers handlers and resizes window on expand/collapse', () => {
    registerWindowIpcHandlers({
      getMainWindow: () => win as never,
      getInitialCenterX: () => 500,
      setHiddenByAutoHideProcess: vi.fn(),
      getIslandPositionOffset: () => ({ x: 1, y: 2 }),
      getIslandDisplaySelection: () => 'primary',
      sanitizeIslandDisplaySelection: () => 'primary',
      setIslandDisplaySelection: vi.fn(),
      sanitizeIslandPositionOffset: () => ({ x: 3, y: 4 }),
      applyIslandPositionOffset: vi.fn(),
      writeIslandPositionOffsetConfig: vi.fn(() => true),
      writeIslandDisplaySelectionConfig: vi.fn(() => true),
      sizes: {
        expandedWidth: 600,
        expandedHeight: 200,
        notificationWidth: 500,
        notificationHeight: 200,
        lyricsWidth: 700,
        lyricsHeight: 240,
        lyricsTranslationHeight: 300,
        expandedFullWidth: 900,
        expandedFullHeight: 400,
        settingsWidth: 1000,
        settingsHeight: 600,
        islandWidth: 300,
        islandHeight: 100,
      },
    });

    onHandlers.get('window:expand')?.(trustedEvent());
    onHandlers.get('window:collapse')?.(trustedEvent());
    expect(win.setBounds).toHaveBeenCalledTimes(2);

    // 灵动岛铁律：收起回 idle 时不可聚焦，展开成交互形态时才可聚焦。
    // 否则自动唤出（鼠标划过屏幕边缘）会把用户正在输入的焦点抢走。
    expect(win.setFocusable).toHaveBeenLastCalledWith(false);
    onHandlers.get('window:expand')?.(trustedEvent());
    expect(win.setFocusable).toHaveBeenLastCalledWith(true);

    const notify = onHandlers.get('window:notify')!;
    notify(trustedEvent(), { title: 'Focus complete', body: 'Take a break', icon: './svg/TIMER.svg' });
    expect(broadcastSettingChangeMock).toHaveBeenLastCalledWith(-1, 'notification:show', {
      title: 'Focus complete', body: 'Take a break', icon: './svg/TIMER.svg', type: 'workspace',
    });
    broadcastSettingChangeMock.mockClear();
    notify(untrustedEvent(), { title: 'Blocked', body: 'Untrusted frame' });
    notify(trustedEvent(), { title: 'x'.repeat(201), body: 'Too long' });
    notify(trustedEvent(), { title: 'Invalid', body: 3 });
    expect(broadcastSettingChangeMock).not.toHaveBeenCalled();
    notify(trustedEvent(), { title: 'Safe text', body: 'No remote icon', icon: 'https://example.com/icon.svg' });
    expect(broadcastSettingChangeMock).toHaveBeenLastCalledWith(-1, 'notification:show', {
      title: 'Safe text', body: 'No remote icon', icon: undefined, type: 'workspace',
    });

    expect(handleHandlers.get('window:get-mouse-position')?.(trustedEvent())).toEqual({ x: 10, y: 20 });
    expect(handleHandlers.get('window:get-bounds')?.(trustedEvent())).toEqual({ x: 100, y: 200, width: 300, height: 100 });
    expect(handleHandlers.get('window:island-displays:list')?.(trustedEvent())).toEqual([{ id: '1', width: 1920, height: 1080, isPrimary: true }]);

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

  it('broadcasts island display and position updates', () => {
    const setIslandDisplaySelection = vi.fn();
    const applyIslandPositionOffset = vi.fn();

    registerWindowIpcHandlers({
      getMainWindow: () => win as never,
      getInitialCenterX: () => 500,
      setHiddenByAutoHideProcess: vi.fn(),
      getIslandPositionOffset: () => ({ x: 1, y: 2 }),
      getIslandDisplaySelection: () => 'primary',
      sanitizeIslandDisplaySelection: () => 'display-2',
      setIslandDisplaySelection,
      sanitizeIslandPositionOffset: () => ({ x: 8, y: 9 }),
      applyIslandPositionOffset,
      writeIslandPositionOffsetConfig: vi.fn(() => true),
      writeIslandDisplaySelectionConfig: vi.fn(() => true),
      sizes: {
        expandedWidth: 600,
        expandedHeight: 200,
        notificationWidth: 500,
        notificationHeight: 200,
        lyricsWidth: 700,
        lyricsHeight: 240,
        lyricsTranslationHeight: 300,
        expandedFullWidth: 900,
        expandedFullHeight: 400,
        settingsWidth: 1000,
        settingsHeight: 600,
        islandWidth: 300,
        islandHeight: 100,
      },
    });

    const setDisplay = handleHandlers.get('window:island-display:set');
    const setPosition = handleHandlers.get('window:island-position:set');

    expect(setDisplay?.(trustedEvent(1), 'x')).toBe(true);
    expect(setPosition?.(trustedEvent(2), { x: 1 })).toBe(true);

    expect(setIslandDisplaySelection).toHaveBeenCalledWith('display-2');
    expect(applyIslandPositionOffset).toHaveBeenCalledWith({ x: 8, y: 9 });
    expect(broadcastSettingChangeMock).toHaveBeenCalledWith(1, 'island:display', 'display-2');
    expect(broadcastSettingChangeMock).toHaveBeenCalledWith(2, 'island:position', { x: 8, y: 9 });

    // 回归防护：本用例注册的 IPC channel 必须仍受 sender 门禁保护
    expect(handleHandlers.size).toBeGreaterThan(0);
    for (const [channel, handler] of handleHandlers) {
      expect(handler(untrustedEvent()), channel + ' 必须仍受 sender 门禁保护').toEqual(UNTRUSTED_SENDER_RESULT);
    }
  });

  it('clamps a drag inside the work area and persists the position on drag end', () => {
    const applyIslandPositionOffset = vi.fn();
    const writeIslandPositionOffsetConfig = vi.fn(() => true);

    registerWindowIpcHandlers({
      getMainWindow: () => win as never,
      getInitialCenterX: () => 500,
      setHiddenByAutoHideProcess: vi.fn(),
      getIslandPositionOffset: () => ({ x: 0, y: 0 }),
      getIslandDisplaySelection: () => 'primary',
      sanitizeIslandDisplaySelection: () => 'primary',
      setIslandDisplaySelection: vi.fn(),
      // 用真实语义的 sanitize：把偏移夹在 [-2000,2000] / [-1200,1200] 内。
      sanitizeIslandPositionOffset: (offset: { x?: number; y?: number }) => ({
        x: Math.max(-2000, Math.min(2000, Math.round(offset.x ?? 0))),
        y: Math.max(-1200, Math.min(1200, Math.round(offset.y ?? 0))),
      }),
      applyIslandPositionOffset,
      writeIslandPositionOffsetConfig,
      writeIslandDisplaySelectionConfig: vi.fn(() => true),
      sizes: {
        expandedWidth: 600, expandedHeight: 200,
        notificationWidth: 500, notificationHeight: 200,
        lyricsWidth: 700, lyricsHeight: 240, lyricsTranslationHeight: 300,
        expandedFullWidth: 900, expandedFullHeight: 400,
        settingsWidth: 1000, settingsHeight: 600,
        islandWidth: 260, islandHeight: 42,
      },
    });

    // 岛当前贴着左边缘（x=0），继续向左拖 500px 必须被钳制在工作区内而不是跑出屏幕。
    win.getBounds.mockReturnValue({ x: 0, y: 0, width: 260, height: 42 });
    onHandlers.get('window:move-delta')?.(trustedEvent(), -500, 0);
    expect(win.setBounds).toHaveBeenLastCalledWith(
      expect.objectContaining({ x: expect.any(Number) }),
    );
    const clampedX = (win.setBounds.mock.calls.at(-1)?.[0] as { x: number }).x;
    expect(clampedX).toBeGreaterThanOrEqual(0);
    expect(clampedX).toBeLessThanOrEqual(1920 - 260);

    // 垂直方向同样不许移出工作区：从 y=0 向上拖 300px 仍应留在屏幕内。
    win.setBounds.mockClear();
    onHandlers.get('window:move-delta')?.(trustedEvent(), 0, -300);
    expect((win.setBounds.mock.calls.at(-1)?.[0] as { y: number }).y).toBeGreaterThanOrEqual(0);

    // 拖动结束必须把当前位置折算成偏移并持久化，重启后小岛留在用户放的地方。
    win.getBounds.mockReturnValue({ x: 900, y: 46, width: 260, height: 42 });
    onHandlers.get('window:move-end')?.(trustedEvent());
    expect(applyIslandPositionOffset).toHaveBeenCalledTimes(1);
    expect(writeIslandPositionOffsetConfig).toHaveBeenCalledTimes(1);
    const persisted = applyIslandPositionOffset.mock.calls[0]?.[0] as { x: number; y: number };
    // notch 模式基准 x 为居中：(900+130) - (830+130) = 70
    expect(persisted.x).toBe(70);
    expect(persisted.y).toBe(46);
  });
});
