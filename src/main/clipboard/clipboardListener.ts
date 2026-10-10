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
 * @file clipboardListener.ts
 * @description 剪贴板变化监听服务：优先用 Worker 里的 WM_CLIPBOARDUPDATE，失败回落到轮询
 * @author 灵屿
 */

import { BrowserWindow, clipboard } from 'electron';
import { Worker } from 'worker_threads';
import { join } from 'path';

/** 剪贴板变化监听器 */
export type ClipboardChangeListener = () => void;

/** 剪贴板内容变化广播频道 */
const CLIPBOARD_CHANGED_CHANNEL = 'clipboard:changed';

/** 回落到轮询时的间隔（ms）；仅在 Win32 钩子不可用时使用 */
const FALLBACK_POLL_INTERVAL_MS = 1000;
/** 等待 Worker 优雅退出的最长时间（ms） */
const WORKER_STOP_TIMEOUT_MS = 1000;

interface ClipboardWorkerMessage {
  type: string;
  listening?: boolean;
  reason?: string;
}

/**
 * 向所有存活窗口广播剪贴板变化。
 * @description 渲染层的剪贴板历史采集改为订阅本频道，不再各自 1 秒轮询。
 */
function broadcastChange(): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send(CLIPBOARD_CHANGED_CHANNEL);
  });
}

/**
 * 创建剪贴板变化监听服务。
 * @description 剪贴板写入由外部进程发起，无法用 Electron 自身事件感知；Win32 的
 *   AddClipboardFormatListener 是唯一的事件驱动入口，而它要求线程有消息循环，因此放在
 *   Worker 里。Worker 拉不起来或注册失败时回落到轮询，行为与改造前一致。
 * @returns 启动与停止监听的方法。
 */
export function createClipboardListener(): {
  start: (onChange: ClipboardChangeListener) => void;
  stop: () => void;
} {
  let worker: Worker | null = null;
  let pollTimer: NodeJS.Timeout | null = null;
  let lastText = '';
  let onChange: ClipboardChangeListener | null = null;

  function stopPolling(): void {
    if (pollTimer === null) return;
    clearInterval(pollTimer);
    pollTimer = null;
  }

  /** 钩子不可用时退回到 1 秒轮询，保证功能不中断。 */
  function startPolling(reason: string): void {
    console.warn(`[Clipboard] falling back to polling: ${reason}`);
    if (pollTimer !== null) return;
    pollTimer = setInterval(() => {
      const current = clipboard.readText() || '';
      if (current === lastText) return;
      lastText = current;
      broadcastChange();
      onChange?.();
    }, FALLBACK_POLL_INTERVAL_MS);
  }

  function terminateWorker(): void {
    if (!worker) return;
    const target = worker;
    worker = null;
    target.postMessage({ type: 'stop' });
    // 等 stopped 回执，超时后强制结束，避免退出时挂住。
    const force = setTimeout(() => target.terminate(), WORKER_STOP_TIMEOUT_MS);
    target.on('message', (msg: ClipboardWorkerMessage) => {
      if (msg.type !== 'stopped') return;
      clearTimeout(force);
      target.terminate();
    });
  }

  return {
    start: (listener) => {
      onChange = listener;
      lastText = clipboard.readText() || '';
      stopPolling();

      try {
        worker = new Worker(join(__dirname, 'clipboardWorker.js'));
      } catch (err) {
        worker = null;
        startPolling(String(err));
        return;
      }

      const target = worker;
      target.on('message', (msg: ClipboardWorkerMessage) => {
        if (msg.type === 'status' && msg.listening === false) {
          // 注册失败：撤掉 Worker 改走轮询。
          terminateWorker();
          startPolling(msg.reason ?? 'unknown');
          return;
        }
        if (msg.type === 'clipboard-change') {
          broadcastChange();
          onChange?.();
        }
      });
      target.on('error', (err) => {
        terminateWorker();
        startPolling(String(err));
      });
      target.on('exit', (code) => {
        // 只有非主动停止的退出才需要补回落盘。
        if (worker === null) return;
        worker = null;
        if (code !== 0) startPolling(`worker exited with code ${code}`);
      });
    },
    stop: () => {
      onChange = null;
      stopPolling();
      terminateWorker();
    },
  };
}
