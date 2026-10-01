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
 * @file standaloneWindow.ts
 * @description 倒数日/TODOs/设置 独立窗口服务模块
 * @author 灵屿
 */

import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import { registerTrustedWindow } from '../ipc/trustedSender';
import { pathToFileURL } from 'url';

let standaloneWindow: BrowserWindow | null = null;
let quitting = false;
app.on('before-quit', () => { quitting = true; });

/**
 * 打开独立窗口（若已打开则聚焦）
 */
function openStandaloneWindow(): void {
  if (standaloneWindow && !standaloneWindow.isDestroyed()) {
    standaloneWindow.show();
    standaloneWindow.focus();
    return;
  }

  standaloneWindow = new BrowserWindow({
    width: 1120,
    height: 740,
    minWidth: 880,
    minHeight: 600,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#0B0C10',
    resizable: true,
    icon: is.dev
      ? join(__dirname, '../../resources/icon/lingyu_256x256.ico')
      : join(process.resourcesPath, 'icon/lingyu_256x256.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  standaloneWindow.on('ready-to-show', () => {
    standaloneWindow?.show();
  });

  /** 注册为受信任 sender：独立窗口的 IPC 调用需通过 sender 校验 */
  registerTrustedWindow(standaloneWindow, is.dev && process.env['ELECTRON_RENDERER_URL']
    ? process.env['ELECTRON_RENDERER_URL'] + '/DynamicIslandStandalone.html'
    : pathToFileURL(join(__dirname, '../renderer/DynamicIslandStandalone.html')).href);

  standaloneWindow.on('closed', () => {
    standaloneWindow = null;
  });

  standaloneWindow.on('close', (event) => {
    if (quitting) return;
    // 关闭工作台收回到后台，保留本次运行的对话及专注计时。
    event.preventDefault();
    standaloneWindow?.hide();
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    standaloneWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/DynamicIslandStandalone.html');
  } else {
    standaloneWindow.loadFile(join(__dirname, '../renderer/DynamicIslandStandalone.html'));
  }
}

/**
 * 关闭独立窗口
 */
function closeStandaloneWindow(): void {
  if (standaloneWindow && !standaloneWindow.isDestroyed()) {
    standaloneWindow.close();
  }
}

/**
 * 获取独立窗口实例
 */
function getStandaloneWindow(): BrowserWindow | null {
  return standaloneWindow;
}

export { openStandaloneWindow, closeStandaloneWindow, getStandaloneWindow };
