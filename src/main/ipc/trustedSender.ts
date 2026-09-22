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
import { BrowserWindow, ipcMain } from 'electron';

/** 本仓创建的窗口 webContents id 注册表 */
const trustedWebContentsIds = new Set<number>();

/** 非信任 sender 的统一拒绝返回（与 net:fetch 既有拒绝形态一致，避免渲染层未捕获异常） */
export const UNTRUSTED_SENDER_RESULT = { ok: false, status: 403, error: 'untrusted-sender' } as const;

/** 受信任的主机名：本机回环地址（开发服务器 / file:// 本地源） */
const TRUSTED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * 判断 URL 是否属于受信任的渲染层来源
 * @description 作为 ID 注册表的兜底。按协议+主机名解析后比对，不做前缀匹配：
 *              前缀匹配会被 `file://evil`、`app://任意主机`、`http://localhost:PORT@evilhost` 这类
 *              「userinfo 伪装主机名 / 远端主机名」绕过
 * @param url - senderFrame.url
 * @returns 是否为受信任来源
 */
export function isTrustedSenderUrl(url: string): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // userinfo 段（http://localhost:PORT@evilhost）是经典的前缀绕过，一律拒绝
  if (parsed.username !== '' || parsed.password !== '') return false;
  const loopback = TRUSTED_HOSTNAMES.has(parsed.hostname);
  switch (parsed.protocol) {
    case 'file:':
      // 生产形态 file:///C:/...（hostname 为空）；不允许带远端主机名（file://evil/...）
      return parsed.hostname === '' || loopback;
    case 'app:':
      // 自定义协议：仅允许无主机 / 相对主机（app://./index.html）或本机回环
      return parsed.hostname === '' || parsed.hostname === '.' || loopback;
    case 'http:':
    case 'https:':
      // 开发服务器：必须显式携带端口号（与既有策略一致），且主机名是本机回环
      return parsed.port !== '' && loopback;
    default:
      return false;
  }
}

/**
 * 将本仓创建的窗口注册为受信任 sender
 * @description 应在 BrowserWindow 创建成功后立即调用；窗口关闭时自动从注册表移除
 * @param win - 需要注册的窗口
 */
export function registerTrustedWindow(win: BrowserWindow): void {
  if (!win || win.isDestroyed()) return;
  trustedWebContentsIds.add(win.webContents.id);
  win.once('closed', () => {
    trustedWebContentsIds.delete(win.webContents.id);
  });
}

/**
 * 判断 IPC 事件的 sender 是否受信任
 * @description 优先匹配 webContents id 注册表，未命中时回退 URL 白名单
 * @param event - ipcMain 事件对象
 * @returns sender 是否受信任
 */
export function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const id = event.sender?.id;
  if (typeof id === 'number' && trustedWebContentsIds.has(id)) return true;
  return isTrustedSenderUrl(event.senderFrame?.url ?? '');
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
