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
 * @file net.safety.test.ts
 * @description 网络代理的未知长度、虚假长度、异常关闭与超时资源边界。
 * @author 灵屿
 */

import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trustedEvent } from '../../test-utils/trustedEvent';
const { handlers, requestFactory } = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => Promise<unknown>>(), requestFactory: vi.fn(),
}));
vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => handlers.set(channel, handler) },
  net: { request: requestFactory },
}));
import { registerNetIpcHandlers } from './net';

let request: EventEmitter & { abort: ReturnType<typeof vi.fn>; setHeader: ReturnType<typeof vi.fn>; write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
let response: EventEmitter & { statusCode: number; headers: Record<string, string[]> };
beforeEach(() => {
  vi.useFakeTimers();
  request = Object.assign(new EventEmitter(), { abort: vi.fn(), setHeader: vi.fn(), write: vi.fn(), end: vi.fn() });
  response = Object.assign(new EventEmitter(), { statusCode: 200, headers: {} });
  requestFactory.mockReturnValue(request);
  handlers.clear();
  registerNetIpcHandlers({ writeMainLog: vi.fn() });
});
afterEach(() => { vi.useRealTimers(); });
const start = (): Promise<unknown> => handlers.get('net:fetch')!(trustedEvent(), 'https://owned.example.test/resource');

describe('bounded network proxy', () => {
  it.each([{}, { 'content-length': ['1'] }])('aborts a 17 MiB stream even with headers %j', async (headers) => {
    response.headers = headers as Record<string, string[]>;
    const pending = start();
    request.emit('response', response);
    for (let index = 0; index < 17; index += 1) response.emit('data', Buffer.alloc(1024 * 1024));
    response.emit('end');
    expect(await pending).toMatchObject({ ok: false, status: 413 });
    expect(request.abort).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('rejects an oversized declared Content-Length before reading data', async () => {
    response.headers = { 'content-length': ['20000000'] };
    const pending = start();
    request.emit('response', response);
    response.emit('end');
    expect(await pending).toMatchObject({ ok: false, status: 413 });
    expect(request.abort).toHaveBeenCalledOnce();
  });
  it('finishes an aborted response immediately and ignores subsequent bytes', async () => {
    const pending = start();
    request.emit('response', response);
    response.emit('data', 'partial');
    response.emit('aborted');
    response.emit('data', 'late');
    response.emit('end');
    expect(await pending).toEqual({ ok: false, status: 0, body: '' });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('finishes a response closed before end', async () => {
    const pending = start();
    request.emit('response', response);
    response.emit('close');
    response.emit('end');
    expect(await pending).toEqual({ ok: false, status: 0, body: '' });
  });
  it('returns a complete small response after clearing its timeout', async () => {
    const pending = start();
    request.emit('response', response);
    response.emit('data', '你好');
    response.emit('end');
    response.emit('close');
    expect(await pending).toEqual({ ok: true, status: 200, body: '你好' });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not let abort error events replace the timeout status', async () => {
    request.abort.mockImplementation(() => request.emit('error', new Error('aborted')));
    const pending = start();
    await vi.advanceTimersByTimeAsync(10000);
    expect(await pending).toEqual({ ok: false, status: 408, body: 'timeout' });
  });
});
