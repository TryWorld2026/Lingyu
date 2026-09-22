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
 * @file appLifecycle.ts
 * @description 应用生命周期管理模块
 * @description 处理应用实例、窗口事件和应用退出等生命周期事件
 * @author 灵屿
 */

import { app, BrowserWindow } from 'electron';

interface RegisterAppLifecycleHandlersOptions {
  getMainWindow: () => BrowserWindow | null;
  onSecondInstance: () => void;
  onWillQuit: () => void;
  onWindowAllClosed: () => void;
}

/**
 * window-all-closed 时是否应执行退出清理并退出应用
 * @description macOS 上窗口全部关闭后应用仍驻留 Dock（activate 会重建窗口），
 *   此时执行退出清理会停掉快捷键/托盘/各轮询却让进程继续运行，进入僵尸态，
 *   因此只有非 macOS 平台才在 window-all-closed 上收拢清理并退出
 * @param platform - 目标平台，默认取当前进程平台（抽出参数便于测试）
 * @returns 是否应当清理并退出
 */
export function shouldQuitOnWindowAllClosed(platform: string = process.platform): boolean {
  return platform !== 'darwin';
}

/**
 * 注册应用生命周期处理器
 * @description 注册多实例、应用退出和窗口关闭等生命周期事件处理器
 * @param options - 配置选项，包含窗口获取和回调函数
 */
export function registerAppLifecycleHandlers(options: RegisterAppLifecycleHandlersOptions): void {
  app.on('second-instance', () => {
    options.onSecondInstance();
  });

  app.on('will-quit', () => {
    options.onWillQuit();
  });

  app.on('window-all-closed', () => {
    options.onWindowAllClosed();
  });
}
