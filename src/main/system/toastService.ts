/*
 * 灵屿 Lingyu - 免费开源的 Windows 桌面灵动岛（基于 eIsland 二次开发）
 * https://github.com/JNTMTMTM/eIsland
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 *
 * Original author: JNTMTMTM
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @file toastService.ts
 * @description 系统 Toast 通知接管服务：监听 Windows 通知中心，把系统应用通知转发到灵动岛显示
 * @author 灵屿
 */

import { BrowserWindow } from 'electron';
import {
  requestAccess,
  getAccessStatus,
  getNotifications,
  startListening,
  stopListening,
  type ToastNotificationChangedEvent,
  type ToastNotificationSnapshot,
} from '@lingyu/windows-toast-listener';

interface ToastServiceOptions {
  getMainWindow: () => BrowserWindow | null;
  /** 是否启用的持久化读取函数 */
  isEnabled?: () => boolean;
}

const MIN_INTERVAL_MS = 800;

export function createToastService(options: ToastServiceOptions): {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
  requestAccess: () => string;
  getAccessStatus: () => string;
} {
  let running = false;
  let lastEventAt = 0;

  const sendToast = (toast: ToastNotificationSnapshot): void => {
    const win = options.getMainWindow();
    if (!win || win.isDestroyed()) return;
    if (options.isEnabled && !options.isEnabled()) return;
    win.webContents.send('system-toast:received', {
      appName: toast.appDisplayName || toast.appUserModelId || '',
      title: toast.title || '',
      body: toast.body || '',
      createdAt: toast.createdAt || Date.now(),
    });
  };

  const handleChange = (event: ToastNotificationChangedEvent): void => {
    if (event.kind !== 'added') return;
    const now = Date.now();
    if (now - lastEventAt < MIN_INTERVAL_MS) return;
    lastEventAt = now;
    try {
      const toasts = getNotifications();
      const latest = toasts
        .filter((t) => t.title || t.body)
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      if (latest) {
        sendToast(latest);
      }
    } catch {
      // 读取通知失败时忽略
    }
  };

  return {
    start: () => {
      if (running) return;
      running = startListening(handleChange);
    },
    stop: () => {
      if (!running) return;
      stopListening();
      running = false;
    },
    isRunning: () => running,
    requestAccess: () => requestAccess(),
    getAccessStatus: () => getAccessStatus(),
  };
}
