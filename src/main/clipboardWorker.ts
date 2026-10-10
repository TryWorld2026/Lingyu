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
interface ClipboardWorkerStatus {
  type: 'status';
  listening: boolean;
  /** 注册或建窗失败的原因，供主进程决定是否回落到轮询 */
  reason?: string;
}

/**
 * 注册 Win32 剪贴板监听并驱动消息循环。
 * @description 复用系统窗口类 Static，不注册自定义类、不装 koffi 回调窗口过程。
 *   本机实测：自定义窗口类 + koffi.register 回调时，RegisterClassW 返回 atom 成功但
 *   CreateWindowExW 必然失败（ERROR_MOD_NOT_FOUND 126 / ERROR_CANNOT_FIND_WND_CLASS 1407），
 *   因为 Windows 建窗时要按 lpfnWndProc 反查所属模块，而 koffi 生成的 thunk 没有模块元数据。
 *   改用 Static 后建窗与 AddClipboardFormatListener 均正常。剪贴板消息直接从 PeekMessageW
 *   取到的 MSG.message 上判断，无需自定义窗口过程参与。
 * @returns 监听是否成功建立；失败时主进程回落到轮询。
 */
function startListening(): ClipboardWorkerStatus {
  // 动态 require：koffi 是 Windows 专用原生模块，静态 import 会影响非 Windows 的类型检查。
  const koffi = require('koffi') as typeof import('koffi');
  const user = koffi.load('user32.dll');
  const kernel = koffi.load('kernel32.dll');

  const dispatchMessage = user.func('long __stdcall DispatchMessageW(void *)');
  const peekMessage = user.func('bool __stdcall PeekMessageW(void *, void *, unsigned int, unsigned int, uint32)');
  const translateMessage = user.func('bool __stdcall TranslateMessage(void *)');
  const hInstance = kernel.func('intptr_t __stdcall GetModuleHandleW(void *)')(null);
  const createWindow = user.func('void *__stdcall CreateWindowExW(uint32, char16_t *, char16_t *, uint32, int, int, int, int, void *, void *, void *, void *)');
  const hwnd = createWindow(0, 'Static', 'lingyu-clipboard-listener', 0, 0, 0, 0, 0, null, null, hInstance, null);
  // koffi 返回的指针对象恒为 truthy，失败时 address() 才是 0，不能直接用 !hwnd 判断
  if (koffi.address(hwnd) === 0n) return { type: 'status', listening: false, reason: 'CreateWindowExW failed' };

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
      // 复用系统窗口类，没有自定义窗口过程可拦截，剪贴板消息只能在这里判。
      // WM_CLIPBOARDUPDATE 是发给本窗口的队列消息，PeekMessageW 取到的 MSG.message 即携带它。
      if (koffi.decode(msg, msgType).message === WM_CLIPBOARDUPDATE) {
        parentPort!.postMessage({ type: 'clipboard-change' });
      }
      translateMessage(msg);
      dispatchMessage(msg);
    }
  }, PUMP_INTERVAL_MS);

  parentPort!.on('message', (command: { type: string }) => {
    if (command.type !== 'stop') return;
    clearInterval(pump);
    user.func('bool __stdcall RemoveClipboardFormatListener(void *)')(hwnd);
    user.func('bool __stdcall DestroyWindow(void *)')(hwnd);
    parentPort!.postMessage({ type: 'stopped' });
    process.exit(0);
  });

  return { type: 'status', listening: true };
}

parentPort!.postMessage(startListening());
