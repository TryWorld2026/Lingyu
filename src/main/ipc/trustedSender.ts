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
 * @file trustedSender.ts
 * @description IPC 信任sender 校验：维护本仓创建的窗口 webContents 注册表，
 * @description 所有 ipcMain handler 经 handleTrusted/onTrusted 注册，拒绝非本仓窗口的调用
 * @author 灵屿
 */

import type { IpcMainInvokeEvent } from 'electron';
import type { BrowserWindow } from 'electron';
import { ipcMain, shell } from 'electron';

/** 窗口身份必须与创建时指定的入口绑定，导航后不能继承原页面权限。 */
const trustedWindows = new Map<number, { window: BrowserWindow; entryUrl: string }>();

/** 非信任 sender 的统一拒绝返回（与 net:fetch 既有拒绝形态一致，避免渲染层未捕获异常） */
export const UNTRUSTED_SENDER_RESULT = { ok: false, status: 403, error: 'untrusted-sender' } as const;

/**
 * 检查页面是否为窗口创建时绑定的入口。
 * @param url - 当前 frame 的地址。
 * @param entryUrl - 窗口明确指定的生产文件或开发页面地址。
 * @returns 除页面锚点外地址是否完全匹配。
 */
export function isTrustedSenderUrl(url: string, entryUrl: string): boolean {
  try {
    const current = new URL(url);
    const expected = new URL(entryUrl);
    if (!['file:', 'http:', 'https:'].includes(expected.protocol)) return false;
    if (current.username || current.password || expected.username || expected.password) return false;
    if (expected.protocol === 'file:' && expected.hostname !== '') return false;
    current.hash = '';
    expected.hash = '';
    return current.href === expected.href;
  } catch {
    return false;
  }
}

function openWebLink(url: string): void {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return;
    void shell.openExternal(parsed.href).catch(() => {
      console.warn('[Window] failed to open external web link');
    });
  } catch {
    // 无效地址和系统协议不交给操作系统执行。
  }
}

/**
 * 将本仓创建的窗口注册为受信任 sender
 * @description 绑定入口与导航限制；窗口关闭时自动撤销信任。
 * @param win - 需要注册的窗口
 * @param entryUrl - 此窗口即将加载的完整入口 URL。
 */
export function registerTrustedWindow(win: BrowserWindow, entryUrl: string): void {
  if (!win || win.isDestroyed()) return;
  if (!isTrustedSenderUrl(entryUrl, entryUrl)) return;
  const senderId = win.webContents.id;
  trustedWindows.set(senderId, { window: win, entryUrl });
  win.once('closed', () => {
    trustedWindows.delete(senderId);
  });
  win.webContents.on('will-frame-navigate', (event) => {
    if (isTrustedSenderUrl(event.url, entryUrl)) return;
    event.preventDefault();
    if (event.isMainFrame) openWebLink(event.url);
  });
  win.webContents.on('will-redirect', (event) => {
    if (!isTrustedSenderUrl(event.url, entryUrl)) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    openWebLink(url);
    return { action: 'deny' };
  });
}

/**
 * 判断 IPC 事件的 sender 是否受信任
 * @description 未注册窗口、非主 frame 与离开指定入口的页面均拒绝。
 * @param event - ipcMain 事件对象
 * @returns sender 是否受信任
 */
export function isTrustedSender(event: Pick<IpcMainInvokeEvent, 'sender' | 'senderFrame'>): boolean {
  const registration = trustedWindows.get(event.sender?.id);
  if (!registration || registration.window.isDestroyed() || !event.senderFrame) return false;
  if (event.senderFrame !== event.sender.mainFrame) return false;
  return isTrustedSenderUrl(event.senderFrame.url, registration.entryUrl);
}

/**
 * 注册带 sender 校验的 invoke 处理器
 * @description 非信任 sender 返回 UNTRUSTED_SENDER_RESULT 并记录警告，不抛异常
 * @param channel - IPC channel 名称
 * @param handler - 原处理器（仅在 sender 受信任时执行）
 */
export function handleTrusted<P extends unknown[], R>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: P) => R | Promise<R>,
): void {
  ipcMain.handle(channel, (event, ...args: P) => {
    if (!isTrustedSender(event)) {
      console.warn(`[IPC] blocked untrusted sender for channel: ${channel}`);
      return UNTRUSTED_SENDER_RESULT as unknown as R;
    }
    return handler(event, ...args);
  });
}

/**
 * 注册带 sender 校验的事件监听器
 * @description 非信任 sender 的消息被丢弃并记录警告
 * @param channel - IPC channel 名称
 * @param listener - 原监听器（仅在 sender 受信任时执行）
 */
export function onTrusted<P extends unknown[]>(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: P) => void,
): void {
  ipcMain.on(channel, (event, ...args: P) => {
    if (!isTrustedSender(event)) {
      console.warn(`[IPC] blocked untrusted sender for channel: ${channel}`);
      return;
    }
    listener(event, ...args);
  });
}
