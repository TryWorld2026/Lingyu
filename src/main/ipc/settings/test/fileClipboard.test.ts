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
 * @file fileClipboard.test.ts
 * @description 文件剪贴板实际 IPC 的标准格式、Unicode、内存所有权与失败回归。
 * @author 灵屿
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trustedEvent, untrustedEvent } from '../../../test-utils/trustedEvent';
const { handlers, native, encode, legacy, owner } = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  native: Object.fromEntries(['OpenClipboard', 'CloseClipboard', 'EmptyClipboard', 'SetClipboardData', 'GetClipboardData',
    'IsClipboardFormatAvailable', 'GlobalAlloc', 'GlobalLock', 'GlobalUnlock', 'GlobalFree', 'DragQueryFileW'].map((name) => [name, vi.fn()])),
  encode: vi.fn(), legacy: vi.fn(), owner: { value: Buffer.alloc(8) as Buffer | null },
}));
vi.mock('electron', () => ({
  ipcMain: { handle: (key: string, handler: (...args: unknown[]) => unknown) => handlers.set(key, handler), on: vi.fn() },
  shell: {}, clipboard: { writeBuffer: legacy, readBuffer: vi.fn() },
  BrowserWindow: { fromWebContents: () => owner.value ? { getNativeWindowHandle: () => owner.value } : null },
}));
vi.mock('koffi', () => ({
  load: () => ({ func: (signature: string) => native[signature.match(/\b(\w+)\s*\(/)![1]] }),
  encode,
}));
vi.mock('../../../utils/broadcast', () => ({ broadcastSettingChange: vi.fn() }));
import { registerClipboardIpcHandlers } from '../clipboard';
const options = {
  storeDir: 'C:/owned', monitorEnabledStoreKey: 'm', detectModeStoreKey: 'd', blacklistStoreKey: 'b',
  defaultDetectMode: 'https-only' as const, getMonitorEnabled: () => false, setMonitorEnabled: vi.fn(),
  getDetectMode: () => 'https-only' as const, setDetectMode: vi.fn(), getBlacklist: () => [], setBlacklist: vi.fn(),
  startWatcher: vi.fn(), stopWatcher: vi.fn(),
};
beforeEach(() => {
  handlers.clear(); encode.mockClear(); legacy.mockClear();
  Object.values(native).forEach((fn) => fn.mockReset());
  owner.value = Buffer.alloc(8); owner.value.writeBigUInt64LE(123n);
  native.OpenClipboard.mockReturnValue(true); native.EmptyClipboard.mockReturnValue(true);
  native.GlobalAlloc.mockReturnValue(456n); native.GlobalLock.mockReturnValue(789n);
  native.SetClipboardData.mockReturnValue(456n); native.GetClipboardData.mockReturnValue(456n);
  native.IsClipboardFormatAvailable.mockReturnValue(true);
  registerClipboardIpcHandlers(options);
});
describe('Windows file clipboard', () => {
  it('writes standard numeric CF_HDROP with a Unicode header and double terminator', () => {
    const paths = ['C:\\测试\\文档.txt', 'D:\\two files\\other.pdf'];
    expect(handlers.get('clipboard:copy-files')!(trustedEvent(), paths)).toBe(true);
    expect(legacy).not.toHaveBeenCalled();
    expect(native.OpenClipboard).toHaveBeenCalledWith(123n);
    expect(native.SetClipboardData).toHaveBeenCalledWith(15, 456n);
    const data = encode.mock.calls[0][2] as Buffer;
    expect(data.readUInt32LE(0)).toBe(20);
    expect(data.readUInt32LE(16)).toBe(1);
    expect(data.subarray(20).toString('utf16le')).toBe(paths.join('\0') + '\0\0');
    expect(native.GlobalFree).not.toHaveBeenCalled();
    expect(native.CloseClipboard).toHaveBeenCalledOnce();
  });
  it('frees caller-owned memory when SetClipboardData fails', () => {
    native.SetClipboardData.mockReturnValue(null);
    expect(handlers.get('clipboard:copy-files')!(trustedEvent(), ['C:\\owned.txt'])).toBe(false);
    expect(native.GlobalFree).toHaveBeenCalledWith(456n);
    expect(native.CloseClipboard).toHaveBeenCalledOnce();
  });
  it('does not clear existing clipboard when allocation fails or owner is unavailable', () => {
    native.GlobalAlloc.mockReturnValue(null);
    expect(handlers.get('clipboard:copy-files')!(trustedEvent(), ['C:\\owned.txt'])).toBe(false);
    expect(native.EmptyClipboard).not.toHaveBeenCalled();
    owner.value = null;
    expect(handlers.get('clipboard:copy-files')!(trustedEvent(), ['C:\\owned.txt'])).toBe(false);
    expect(native.OpenClipboard).not.toHaveBeenCalled();
  });
  it.each([[['relative.txt']], [['C:\\bad\0path']], [[]]])('rejects unsafe paths without opening the clipboard %j', (paths) => {
    expect(handlers.get('clipboard:copy-files')!(trustedEvent(), paths)).toBe(false);
    expect(native.OpenClipboard).not.toHaveBeenCalled();
  });
  it('uses DragQueryFileW to read Unicode or ANSI-origin shell file lists', () => {
    const paths = ['C:\\测试\\中文.txt', 'D:\\owned.txt'];
    native.DragQueryFileW.mockImplementation((_handle, index, output) => {
      if (index === 0xffffffff) return paths.length;
      if (output) Buffer.from(paths[index] + '\0', 'utf16le').copy(output);
      return paths[index].length;
    });
    expect(handlers.get('clipboard:read-files')!(trustedEvent())).toEqual(paths);
    expect(native.GetClipboardData).toHaveBeenCalledWith(15);
    expect(native.CloseClipboard).toHaveBeenCalledOnce();
    expect(native.GlobalFree).not.toHaveBeenCalled();
  });
  it('blocks untrusted copying before calling native clipboard APIs', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    handlers.get('clipboard:copy-files')!(untrustedEvent(), ['C:\\owned.txt']);
    expect(native.OpenClipboard).not.toHaveBeenCalled();
  });
});
