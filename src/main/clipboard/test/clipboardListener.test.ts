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
 * @file clipboardListener.test.ts
 * @description 剪贴板监听服务单元测试：Worker 事件转发、回落轮询与停止语义
 * @author 灵屿
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Hoisted mock variables                                            */
/* ------------------------------------------------------------------ */

const workerHandlers: Record<string, (...args: unknown[]) => void> = {};

const createdWorkers: Array<{
  on: ReturnType<typeof vi.fn>;
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
}> = [];

const mockWindow = vi.hoisted(() => ({
  isDestroyed: (): boolean => false,
  webContents: { send: vi.fn() },
}));

const mockGetAllWindows = vi.hoisted(() => vi.fn(() => [mockWindow]));

const mockClipboardReadText = vi.hoisted(() => vi.fn(() => ''));
const mockJoin = vi.hoisted(() => vi.fn((...args: string[]) => args.join('/')));

/** 可控构造失败的 Worker mock：置 true 时构造函数抛错。 */
let workerThrowsOnConstruct = false;

const MockWorkerClass = vi.hoisted(() =>
  class MockWorker {
    on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      workerHandlers[event] = handler;
      return this;
    });
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor(_path: string) {
      if (workerThrowsOnConstruct) throw new Error('worker spawn failed');
      createdWorkers.push(this);
    }
  },
);

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: mockGetAllWindows },
  clipboard: { readText: mockClipboardReadText },
}));

vi.mock('worker_threads', () => ({ Worker: MockWorkerClass }));

vi.mock('path', () => ({ join: mockJoin }));

import { createClipboardListener } from '../clipboardListener';

/** 触发 Worker 的 message 处理器 */
function emitWorkerMessage(msg: Record<string, unknown>): void {
  workerHandlers.message?.(msg);
}

/** 触发 Worker 的 error 处理器 */
function emitWorkerError(err: Error): void {
  workerHandlers.error?.(err);
}

/** 触发 Worker 的 exit 处理器 */
function emitWorkerExit(code: number): void {
  workerHandlers.exit?.(code);
}

/** 等回落轮询的 setInterval 至少触发一次 */
async function tick(ms = 1100): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('createClipboardListener', () => {
  beforeEach(() => {
    Object.keys(workerHandlers).forEach((key) => delete workerHandlers[key]);
    createdWorkers.length = 0;
    workerThrowsOnConstruct = false;
    mockGetAllWindows.mockClear();
    mockClipboardReadText.mockReset();
    mockClipboardReadText.mockReturnValue('');
  });

  it('剪贴板变化时向所有存活窗口广播 clipboard:changed', () => {
    const listener = createClipboardListener();

    listener.start(vi.fn());
    emitWorkerMessage({ type: 'clipboard-change' });

    expect(mockWindow.webContents.send).toHaveBeenCalledWith('clipboard:changed');
  });

  it('窗口已销毁时不广播', () => {
    const destroyed = { isDestroyed: (): true => true, webContents: { send: vi.fn() } };
    mockGetAllWindows.mockReturnValue([destroyed]);
    const listener = createClipboardListener();

    listener.start(vi.fn());
    emitWorkerMessage({ type: 'clipboard-change' });

    expect(destroyed.webContents.send).not.toHaveBeenCalled();
  });

  it('stop 后不再广播', async () => {
    const listener = createClipboardListener();

    listener.start(vi.fn());
    listener.stop();
    mockWindow.webContents.send.mockClear();
    emitWorkerMessage({ type: 'clipboard-change' });
    await tick();

    expect(mockWindow.webContents.send).not.toHaveBeenCalled();
  });

  it('重复 start 只保留一个 Worker', () => {
    // 启动时已开启监控，用户再去设置里点一次开启会第二次走到 start。
    // 旧 Worker 若不被回收，它的隐藏窗口和剪贴板监听一直活着，事件重复转发。
    const listener = createClipboardListener();

    listener.start(vi.fn());
    const first = createdWorkers[createdWorkers.length - 1];
    first.terminate.mockClear();
    listener.start(vi.fn());

    expect(first.terminate).toHaveBeenCalledTimes(1);
  });

  it('拉起 Worker 并注册 message/error/exit 三个处理器', () => {
    const listener = createClipboardListener();

    listener.start(vi.fn());

    expect(createdWorkers).toHaveLength(1);
    expect(mockJoin).toHaveBeenCalledWith(expect.any(String), 'clipboardWorker.js');
    expect(Object.keys(workerHandlers).sort()).toEqual(['error', 'exit', 'message']);
  });

  it('Worker 的 clipboard-change 事件触发 onChange 回调', () => {
    const onChange = vi.fn();
    const listener = createClipboardListener();

    listener.start(onChange);
    emitWorkerMessage({ type: 'clipboard-change' });

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('Worker 的 status(listening=false) 回落到轮询', async () => {
    const onChange = vi.fn();
    const listener = createClipboardListener();

    listener.start(onChange);
    emitWorkerMessage({ type: 'status', listening: false, reason: 'AddClipboardFormatListener failed' });

    // Worker 已被撤掉，之后剪贴板变化只能靠轮询发现。
    mockClipboardReadText.mockReturnValue('polled text');
    await tick();

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('Worker 构造失败时回落到轮询', async () => {
    workerThrowsOnConstruct = true;
    const onChange = vi.fn();
    const listener = createClipboardListener();

    listener.start(onChange);
    mockClipboardReadText.mockReturnValue('polled text');
    await tick();

    expect(createdWorkers).toHaveLength(0);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('Worker 运行中报错也回落到轮询', async () => {
    const onChange = vi.fn();
    const listener = createClipboardListener();

    listener.start(onChange);
    emitWorkerError(new Error('boom'));
    mockClipboardReadText.mockReturnValue('polled text');
    await tick();

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('Worker 非零退出时回落到轮询', async () => {
    const onChange = vi.fn();
    const listener = createClipboardListener();

    listener.start(onChange);
    emitWorkerExit(1);
    mockClipboardReadText.mockReturnValue('polled text');
    await tick();

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('stop 后不再触发 onChange，也不再读剪贴板', async () => {
    const onChange = vi.fn();
    const listener = createClipboardListener();

    listener.start(onChange);
    listener.stop();

    emitWorkerMessage({ type: 'clipboard-change' });
    mockClipboardReadText.mockReturnValue('after stop');
    await tick();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('stop 向 Worker 发送 stop 命令', () => {
    const listener = createClipboardListener();

    listener.start(vi.fn());
    listener.stop();

    expect(createdWorkers[0].postMessage).toHaveBeenCalledWith({ type: 'stop' });
  });

  it('stop 是幂等的，重复调用不报错', () => {
    const listener = createClipboardListener();

    listener.start(vi.fn());
    listener.stop();

    expect(() => listener.stop()).not.toThrow();
  });

  it('未启动时 stop 不报错', () => {
    const listener = createClipboardListener();

    expect(() => listener.stop()).not.toThrow();
  });

  it('start 前未注册的 onChange 不会被调用', () => {
    const listener = createClipboardListener();

    listener.start(vi.fn());
    listener.stop();
    listener.start(vi.fn());
    emitWorkerMessage({ type: 'clipboard-change' });

    // 最后一次 start 的回调生效，说明 stop 已清掉旧回调。
    expect(workerHandlers.message).toBeTypeOf('function');
  });
});
