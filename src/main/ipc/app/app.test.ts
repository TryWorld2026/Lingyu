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
 * @file app.test.ts
 * @description 文件打开真实 IPC 的成功、错误返回与拒绝分支。
 * @author 灵屿
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trustedEvent, untrustedEvent } from '../../test-utils/trustedEvent';
import { UNTRUSTED_SENDER_RESULT } from '../trustedSender';
const { handlers, openPath } = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(), openPath: vi.fn(),
}));
vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => unknown) => handlers.set(channel, handler), on: vi.fn() },
  shell: { openPath }, app: {}, BrowserWindow: {}, dialog: {},
}));
vi.mock('../../window/standaloneWindow', () => ({ openStandaloneWindow: vi.fn(), closeStandaloneWindow: vi.fn() }));
vi.mock('../../log/mainLog', () => ({ clearLogsCacheFiles: vi.fn(), ensureLogsDir: vi.fn() }));
vi.mock('@lingyu/windows-application-icon-helper', () => ({ getIconByPath: vi.fn(), getIconByShortcutPath: vi.fn() }));
import { registerAppIpcHandlers } from './app';

beforeEach(() => { handlers.clear(); openPath.mockReset(); registerAppIpcHandlers(); });

describe('app:open-file result', () => {
  it.each([['', true], ['Failed to open path', false]])('handles a resolved result %s', async (result, expected) => {
    openPath.mockResolvedValue(result);
    await expect(handlers.get('app:open-file')!(trustedEvent(), 'C:/owned.txt')).resolves.toBe(expected);
  });
  it('returns false on rejection', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    openPath.mockRejectedValue(new Error('owned failure'));
    await expect(handlers.get('app:open-file')!(trustedEvent(), 'C:/owned.txt')).resolves.toBe(false);
  });
  it('does not open a path for an untrusted page', async () => {
    expect(handlers.get('app:open-file')!(untrustedEvent(), 'C:/owned.txt')).toEqual(UNTRUSTED_SENDER_RESULT);
    expect(openPath).not.toHaveBeenCalled();
  });
});
