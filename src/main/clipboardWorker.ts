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
 * @file clipboardWorker.ts
 * @description 剪贴板监听 Worker 线程：用 WM_CLIPBOARDUPDATE 替代轮询，剪贴板变化即时通知主进程
 * @description 消息循环必须跑在独立线程——同步 GetMessageW 会阻塞 Node 事件循环，导致整个进程无响应
 * @author 灵屿
 */

import { parentPort } from 'worker_threads';

if (!parentPort) throw new Error('clipboardWorker must be run as a Worker thread');

/** WM_CLIPBOARDUPDATE：剪贴板内容变化时发给已注册监听者的消息 */
const WM_CLIPBOARDUPDATE = 0x031d;
/** 消息泵轮询窗口队列的间隔（ms） */
const PUMP_INTERVAL_MS = 50;
/** ERROR_CLASS_ALREADY_EXISTS：窗口类已注册，可继续复用 */
const ERROR_CLASS_ALREADY_EXISTS = 1410;

interface ClipboardWorkerStatus {
  type: 'status';
  listening: boolean;
  /** 注册或建窗失败的原因，供主进程决定是否回落到轮询 */
  reason?: string;
}

/**
 * 注册 Win32 剪贴板监听并驱动消息循环。
 * @description 两个 koffi 2.x 的坑：koffi.register 需要 callback 类型，而 koffi.proto 返回的是
 *   prototype，必须再包一层 koffi.pointer()；koffi.struct 返回的不是构造器，结构体内存要用
 *   koffi.alloc(type, 1) 分配、用 koffi.encode/decode 读写字段。
 * @returns 监听是否成功建立；失败时主进程回落到轮询。
 */
function startListening(): ClipboardWorkerStatus {
  // 动态 require：koffi 是 Windows 专用原生模块，静态 import 会影响非 Windows 的类型检查。
  const koffi = require('koffi') as typeof import('koffi');
  const user = koffi.load('user32.dll');
  const kernel = koffi.load('kernel32.dll');

  const defWindowProc = user.func('long __stdcall DefWindowProcW(void *, unsigned int, void *, void *)');
  const dispatchMessage = user.func('long __stdcall DispatchMessageW(void *)');
  const peekMessage = user.func('bool __stdcall PeekMessageW(void *, void *, unsigned int, unsigned int, uint32)');
  const translateMessage = user.func('bool __stdcall TranslateMessage(void *)');

  const wndProcType = koffi.proto('__stdcall', 'long', ['void *', 'unsigned int', 'void *', 'void *']);
  const wndProc = koffi.register((_hwnd: unknown, msg: number): number => {
    if (msg === WM_CLIPBOARDUPDATE) parentPort!.postMessage({ type: 'clipboard-change' });
    return defWindowProc(_hwnd, msg, null, null);
  }, koffi.pointer(wndProcType));

  const wndClassType = koffi.struct({
    style: 'uint32_t',
    lpfnWndProc: koffi.pointer(wndProcType),
    cbClsExtra: 'int',
    cbWndExtra: 'int',
    hInstance: 'void *',
    hIcon: 'void *',
    hCursor: 'void *',
    hbrBackground: 'void *',
    lpszMenuName: 'void *',
    lpszClassName: 'void *',
  });
  const className = 'LingyuClipboardListener';
  const nameRef = koffi.as(Buffer.from(`${className}\0`, 'utf16le'), 'void *');
  const wndClass = koffi.alloc(wndClassType, 1);
  koffi.encode(wndClass, wndClassType, { lpfnWndProc: wndProc, lpszClassName: nameRef });

  const registerClass = user.func('uint16 __stdcall RegisterClassW(void *)');
  const atom = registerClass(wndClass);
  const lastError = kernel.func('uint32 __stdcall GetLastError()')();
  if (atom === 0 && lastError !== ERROR_CLASS_ALREADY_EXISTS) {
    return { type: 'status', listening: false, reason: `RegisterClassW failed (${lastError})` };
  }

  const createWindow = user.func('void *__stdcall CreateWindowExW(uint32, void *, void *, uint32, int, int, int, int, void *, void *, void *, void *)');
  const hwnd = createWindow(0, nameRef, null, 0, 0, 0, 0, 0, null, null, null, null);
  if (!hwnd) return { type: 'status', listening: false, reason: 'CreateWindowExW failed' };

  const addListener = user.func('bool __stdcall AddClipboardFormatListener(void *)');
  if (!addListener(hwnd)) {
    return { type: 'status', listening: false, reason: 'AddClipboardFormatListener failed' };
  }

  const msgType = koffi.struct({
    hwnd: 'void *',
    message: 'uint32_t',
    wParam: 'void *',
    lParam: 'void *',
    time: 'uint32_t',
    pt_x: 'int32_t',
    pt_y: 'int32_t',
  });
  const msg = koffi.alloc(msgType, 1);
  const pump = setInterval(() => {
    // PM_REMOVE(1)：只取走本窗口队列里的消息并分发，不阻塞线程。
    while (peekMessage(msg, null, 0, 0, 1)) {
      translateMessage(msg);
      dispatchMessage(msg);
    }
  }, PUMP_INTERVAL_MS);

  parentPort!.on('message', (command: { type: string }) => {
    if (command.type !== 'stop') return;
    clearInterval(pump);
    user.func('bool __stdcall RemoveClipboardFormatListener(void *)')(hwnd);
    user.func('bool __stdcall DestroyWindow(void *)')(hwnd);
    koffi.unregister(wndProc);
    parentPort!.postMessage({ type: 'stopped' });
    process.exit(0);
  });

  return { type: 'status', listening: true };
}

parentPort!.postMessage(startListening());
