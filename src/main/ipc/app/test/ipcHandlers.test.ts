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
 * @file ipcHandlers.test.ts
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

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
    on: onMock,
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

import { registerStoreIpcHandlers } from '../store';
import { registerLogIpcHandlers } from '../log';

describe('app ipc handlers', () => {
  const handleHandlers = new Map<string, (...args: unknown[]) => unknown>();
  const onHandlers = new Map<string, (...args: unknown[]) => unknown>();

  beforeEach(() => {
    handleHandlers.clear();
    onHandlers.clear();
    handleMock.mockReset();
    onMock.mockReset();
    existsSyncMock.mockReset();
    readFileSyncMock.mockReset();
    writeFileSyncMock.mockReset();
    broadcastSettingChangeMock.mockReset();

    handleMock.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
      handleHandlers.set(channel, handler);
    });
    onMock.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
      onHandlers.set(channel, handler);
    });
  });

  it('registers and handles store read/write', () => {
    registerStoreIpcHandlers({ storeDir: 'C:/store' });

    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue(JSON.stringify({ a: 1 }));

    const read = handleHandlers.get('store:read');
    const write = handleHandlers.get('store:write');
    expect(read?.(trustedEvent(), 'config')).toEqual({ a: 1 });

    const result = write?.(trustedEvent(9), 'config', { b: 2 });
    expect(result).toBe(true);
    expect(writeFileSyncMock).toHaveBeenCalled();
    expect(broadcastSettingChangeMock).toHaveBeenCalledWith(9, 'store:config', { b: 2 });

    // 回归防护：本用例注册的 IPC channel 必须仍受 sender 门禁保护
    expect(handleHandlers.size).toBeGreaterThan(0);
    for (const [channel, handler] of handleHandlers) {
      expect(handler(untrustedEvent()), channel + ' 必须仍受 sender 门禁保护').toEqual(UNTRUSTED_SENDER_RESULT);
    }
  });

  it('registers and normalizes log write levels', () => {
    const writeMainLog = vi.fn();
    registerLogIpcHandlers({ writeMainLog });

    const handler = onHandlers.get('log:write');
    handler?.(trustedEvent(), 'warn', 'w');
    handler?.(trustedEvent(), 'error', 'e');
    handler?.(trustedEvent(), 'other', 'i');

    expect(writeMainLog).toHaveBeenNthCalledWith(1, 'warn', 'w');
    expect(writeMainLog).toHaveBeenNthCalledWith(2, 'error', 'e');
    expect(writeMainLog).toHaveBeenNthCalledWith(3, 'info', 'i');

    // 回归防护：本用例注册的 IPC channel 必须仍受 sender 门禁保护
    const untrustedWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(onHandlers.size).toBeGreaterThan(0);
    for (const [channel, handler] of onHandlers) {
      untrustedWarn.mockClear();
      handler(untrustedEvent());
      expect(untrustedWarn).toHaveBeenCalledWith(expect.stringContaining(channel));
    }
    untrustedWarn.mockRestore();
  });
});
