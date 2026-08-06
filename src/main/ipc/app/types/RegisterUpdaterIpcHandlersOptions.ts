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
 * @file RegisterUpdaterIpcHandlersOptions.ts
 * @description 更新模块 IPC 处理器注册选项类型定义
 * @author 灵屿
 */

import type { AppUpdater } from 'electron-updater';

/** 更新模块 IPC 处理器注册选项 */
export interface RegisterUpdaterIpcHandlersOptions {
  /** Electron Updater 实例 */
  updater: AppUpdater;
  /** 获取当前版本号 */
  getVersion: () => string;
  /** 是否为打包环境 */
  isPackaged: () => boolean;
}
