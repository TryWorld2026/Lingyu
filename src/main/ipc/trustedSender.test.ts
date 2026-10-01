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
 * @file trustedSender.test.ts
 * @description IPC sender 信任校验单元测试：入口 URL 精确匹配与 invoke/event 门禁
 * @author 灵屿
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { trustedEvent, untrustedEvent, TRUSTED_SENDER_URL } from '../test-utils/trustedEvent';

const { handleMock, onMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  onMock: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: { handle: handleMock, on: onMock },
}));

import { UNTRUSTED_SENDER_RESULT, handleTrusted, isTrustedSenderUrl, onTrusted } from './trustedSender';

describe('isTrustedSenderUrl', () => {
  it.each([
    ['file:///C:/lingyu/renderer/DynamicIslandIndex.html', TRUSTED_SENDER_URL, true],
    ['file:/C:/lingyu/renderer/DynamicIslandIndex.html', TRUSTED_SENDER_URL, true],
    ['file:///C:/lingyu/renderer/DynamicIslandIndex.html#settings', TRUSTED_SENDER_URL, true],
    ['file:///C:/Downloads/unrelated.html', TRUSTED_SENDER_URL, false],
    ['file://evil/renderer/DynamicIslandIndex.html', TRUSTED_SENDER_URL, false],
    ['https://evil.example.com/', TRUSTED_SENDER_URL, false],
    ['http://localhost:5173/index.html', 'http://localhost:5173/index.html', true],
    ['http://localhost:9999/index.html', 'http://localhost:5173/index.html', false],
    ['http://localhost:5173/other.html', 'http://localhost:5173/index.html', false],
    ['http://localhost:5173@evilhost/index.html', 'http://localhost:5173/index.html', false],
    ['app://./index.html', 'app://./index.html', false],
    ['javascript:alert(1)', TRUSTED_SENDER_URL, false],
    ['not a url', TRUSTED_SENDER_URL, false],
    ['', TRUSTED_SENDER_URL, false],
  ])('compares %s with the registered entry', (url, entry, expected) => {
    expect(isTrustedSenderUrl(url as string, entry as string)).toBe(expected);
  });
});

describe('handleTrusted / onTrusted', () => {
  beforeEach(() => {
    handleMock.mockReset();
    onMock.mockReset();
  });

  it('blocks untrusted invoke senders with the shared rejection result', () => {
    const handler = vi.fn(() => 'secret');
    handleTrusted('demo:invoke', handler);
    const registered = handleMock.mock.calls[0][1] as (event: IpcMainInvokeEvent) => unknown;
    expect(registered(untrustedEvent())).toEqual(UNTRUSTED_SENDER_RESULT);
    expect(handler).not.toHaveBeenCalled();
  });

  it('invokes the handler for a registered main entry', () => {
    const handler = vi.fn(() => 'ok');
    handleTrusted('demo:invoke', handler);
    const registered = handleMock.mock.calls[0][1] as (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;
    const event = trustedEvent();
    expect(registered(event, 'a', 'b')).toBe('ok');
    expect(handler).toHaveBeenCalledWith(event, 'a', 'b');
  });

  it('drops untrusted event messages without calling the listener', () => {
    const listener = vi.fn();
    onTrusted('demo:event', listener);
    const registered = onMock.mock.calls[0][1] as (event: IpcMainInvokeEvent, ...args: unknown[]) => void;
    registered(untrustedEvent(), 'payload');
    expect(listener).not.toHaveBeenCalled();
  });

  it('forwards event messages from a registered main entry', () => {
    const listener = vi.fn();
    onTrusted('demo:event', listener);
    const registered = onMock.mock.calls[0][1] as (event: IpcMainInvokeEvent, ...args: unknown[]) => void;
    const event = trustedEvent();
    registered(event, 'payload');
    expect(listener).toHaveBeenCalledWith(event, 'payload');
  });
});
