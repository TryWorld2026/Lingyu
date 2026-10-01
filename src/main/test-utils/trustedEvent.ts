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
 * the Free Software Foundation, either version 3, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

/**
 * @file trustedEvent.ts
 * @description 测试用 IPC sender 事件工厂：集中构造「受信任」与「不可信」两种
 *   IpcMainInvokeEvent，供主进程各 IPC 单测复用
 * @description 目的有两个：
 *   1. 让 handler 调用点不再手写 `{}` / `{ sender: { id } }` 字面量，
 *      从而在打开真实 sender 校验后依然能通过受信门禁；
 *   2. 让每个测试文件都能用同一个 untrustedEvent() 反向断言
 *      「本模块注册的每个 channel 都仍然受 handleTrusted/onTrusted 保护」，
 *      防止回归成裸 ipcMain.handle / ipcMain.on。
 * @author 灵屿
 */

import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { registerTrustedWindow } from '../ipc/trustedSender';

/** 受信任的渲染层来源：生产模式 loadFile 加载的本地 HTML */
export const TRUSTED_SENDER_URL = 'file:///C:/lingyu/renderer/DynamicIslandIndex.html';

/** 明确不可信的来源：外部 https 站点（id 也不在注册表中） */
export const UNTRUSTED_SENDER_URL = 'https://evil.example.com/index.html';

/**
 * 构造一个受信任的 IPC 事件
 * @description sender id 与 senderFrame.url 同时落在受信范围内，
 *   任意 handler 读取 event.sender.id 都能拿到稳定值
 * @param senderId - 模拟的 webContents id，默认 1
 * @returns 受信任的 IpcMainInvokeEvent
 */
export function trustedEvent(senderId = 1): IpcMainInvokeEvent {
  const mainFrame = { url: TRUSTED_SENDER_URL };
  const sender = {
    id: senderId,
    mainFrame,
    on: () => {},
    setWindowOpenHandler: () => {},
  };
  registerTrustedWindow({
    webContents: sender,
    isDestroyed: () => false,
    once: () => {},
  } as unknown as BrowserWindow, TRUSTED_SENDER_URL);
  return {
    sender,
    senderFrame: mainFrame,
  } as unknown as IpcMainInvokeEvent;
}

/**
 * 构造一个不可信的 IPC 事件
 * @description id 不在注册表、url 也不在白名单，用于断言门禁拒绝
 * @param senderId - 模拟的 webContents id，默认 9999（未注册）
 * @returns 不可信的 IpcMainInvokeEvent
 */
export function untrustedEvent(senderId = 9999): IpcMainInvokeEvent {
  return {
    sender: { id: senderId },
    senderFrame: { url: UNTRUSTED_SENDER_URL },
  } as unknown as IpcMainInvokeEvent;
}
