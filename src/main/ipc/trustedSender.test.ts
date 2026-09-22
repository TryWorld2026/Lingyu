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
 * @description IPC sender 信任校验单元测试：注册表优先 + URL 白名单兜底
 * @author 灵屿
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { handleMock, onMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  onMock: vi.fn(),
}));

vi.mock('electron', () => ({
  BrowserWindow: {},
  ipcMain: {
    handle: handleMock,
    on: onMock,
  },
}));

import {
  UNTRUSTED_SENDER_RESULT,
  handleTrusted,
  isTrustedSender,
  isTrustedSenderUrl,
  onTrusted,
  registerTrustedWindow,
} from './trustedSender';
import type { IpcMainInvokeEvent } from 'electron';

/** 构造最小可用的 IpcMainInvokeEvent 形态 */
function makeEvent(senderId?: number, senderUrl = ''): IpcMainInvokeEvent {
  return {
    sender: senderId === undefined ? undefined : { id: senderId },
    senderFrame: { url: senderUrl },
  } as unknown as IpcMainInvokeEvent;
}

/** 构造最小可用的 BrowserWindow 形态（仅 registerTrustedWindow 所需成员） */
function makeWindow(id: number) {
  const closedHandlers: Array<() => void> = [];
  return {
    webContents: { id },
    isDestroyed: () => false,
    once: (event: string, handler: () => void) => {
      if (event === 'closed') closedHandlers.push(handler);
    },
    emitClosed: () => closedHandlers.forEach((h) => h()),
  };
}

describe('isTrustedSenderUrl', () => {
  it('accepts production, dev and app scheme origins', () => {
    expect(isTrustedSenderUrl('file:///C:/app/index.html')).toBe(true);
    /** file: 协议下的 localhost 主机名会被规范化成空主机，同样属于本地文件源 */
    expect(isTrustedSenderUrl('file://localhost/foo.html')).toBe(true);
    expect(isTrustedSenderUrl('http://localhost:5173/index.html')).toBe(true);
    expect(isTrustedSenderUrl('http://127.0.0.1:5173/index.html')).toBe(true);
    expect(isTrustedSenderUrl('http://[::1]:5173/index.html')).toBe(true);
    expect(isTrustedSenderUrl('https://localhost:5173/index.html')).toBe(true);
    expect(isTrustedSenderUrl('app://./index.html')).toBe(true);
    expect(isTrustedSenderUrl('app://')).toBe(true);
  });

  it('rejects empty and untrusted origins', () => {
    expect(isTrustedSenderUrl('')).toBe(false);
    expect(isTrustedSenderUrl('https://evil.example.com')).toBe(false);
    expect(isTrustedSenderUrl('http://localhost.evil.com/')).toBe(false);
    expect(isTrustedSenderUrl('file-evil:///index.html')).toBe(false);
    /** 未显式携带端口号的 localhost 源同样拒绝，避免误放行 */
    expect(isTrustedSenderUrl('https://localhost/index.html')).toBe(false);
    expect(isTrustedSenderUrl('http://localhost/index.html')).toBe(false);
  });

  it('rejects prefix-spoofing origins that a naive startsWith would let through', () => {
    /** file: 带远端主机名：前缀匹配会误判为 file:// */
    expect(isTrustedSenderUrl('file://evil/../../secrets.html')).toBe(false);
    /** app: 带远端主机名 */
    expect(isTrustedSenderUrl('app://evil.example.com/index.html')).toBe(false);
    /** userinfo 伪装主机名：真实主机是 evilhost */
    expect(isTrustedSenderUrl('http://localhost:9999@evilhost/')).toBe(false);
    expect(isTrustedSenderUrl('https://localhost:5173@evilhost/')).toBe(false);
    /** 完全不是 URL */
    expect(isTrustedSenderUrl('not a url')).toBe(false);
    /** 危险协议 */
    expect(isTrustedSenderUrl('javascript:alert(1)')).toBe(false);
    /** 去掉双斜杠的 file: 仍然是本地文件源，应放行 */
    expect(isTrustedSenderUrl('file:/C:/app/index.html')).toBe(true);
  });
});

describe('isTrustedSender', () => {
  beforeEach(() => {
    handleMock.mockReset();
    onMock.mockReset();
  });

  it('prefers the registered webContents id over the url', () => {
    const win = makeWindow(4242);
    registerTrustedWindow(win as never);

    expect(isTrustedSender(makeEvent(4242, 'https://evil.example.com'))).toBe(true);
  });

  it('falls back to the url whitelist when the id is unknown', () => {
    expect(isTrustedSender(makeEvent(9999, 'file:///index.html'))).toBe(true);
    expect(isTrustedSender(makeEvent(9999, 'https://evil.example.com'))).toBe(false);
  });

  it('drops the id from the registry once the window closes', () => {
    const win = makeWindow(777);
    registerTrustedWindow(win as never);
    expect(isTrustedSender(makeEvent(777, 'https://evil.example.com'))).toBe(true);

    win.emitClosed();
    expect(isTrustedSender(makeEvent(777, 'https://evil.example.com'))).toBe(false);
  });

  it('ignores destroyed windows', () => {
    const win = { ...makeWindow(555), isDestroyed: () => true };
    registerTrustedWindow(win as never);
    expect(isTrustedSender(makeEvent(555, 'file:///index.html'))).toBe(true);
  });
});

describe('handleTrusted / onTrusted', () => {
  beforeEach(() => {
    handleMock.mockReset();
    onMock.mockReset();
  });

  it('blocks untrusted invoke senders with the shared rejection result', () => {
    handleTrusted('demo:invoke', () => 'secret');
    const registered = handleMock.mock.calls[0][1] as (event: IpcMainInvokeEvent) => unknown;

    expect(registered(makeEvent(1, 'https://evil.example.com'))).toEqual(UNTRUSTED_SENDER_RESULT);
  });

  it('invokes the handler for trusted invoke senders', () => {
    const handler = vi.fn(() => 'ok');
    handleTrusted('demo:invoke', handler);
    const registered = handleMock.mock.calls[0][1] as (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

    const event = makeEvent(1, 'file:///index.html');
    expect(registered(event, 'a', 'b')).toBe('ok');
    expect(handler).toHaveBeenCalledWith(event, 'a', 'b');
  });

  it('drops untrusted event messages without calling the listener', () => {
    const listener = vi.fn();
    onTrusted('demo:event', listener);
    const registered = onMock.mock.calls[0][1] as (event: IpcMainInvokeEvent, ...args: unknown[]) => void;

    registered(makeEvent(1, 'https://evil.example.com'), 'payload');
    expect(listener).not.toHaveBeenCalled();
  });

  it('forwards trusted event messages to the listener', () => {
    const listener = vi.fn();
    onTrusted('demo:event', listener);
    const registered = onMock.mock.calls[0][1] as (event: IpcMainInvokeEvent, ...args: unknown[]) => void;

    const event = makeEvent(1, 'app://./index.html');
    registered(event, 'payload');
    expect(listener).toHaveBeenCalledWith(event, 'payload');
  });
});
