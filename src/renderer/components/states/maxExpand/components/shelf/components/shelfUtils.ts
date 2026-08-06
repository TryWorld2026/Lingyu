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
 * @file shelfUtils.ts
 * @description 暂存架文件操作工具（打开 / 资源管理器定位）
 * @author 灵屿
 */

/**
 * 使用系统默认程序打开文件
 * @param path - 文件绝对路径
 */
export async function openPathWithDefaultApp(path: string): Promise<void> {
  try {
    await window.api.openFile(path);
  } catch {
    // ignore
  }
}

/**
 * 在资源管理器中定位文件
 * @param path - 文件绝对路径
 */
export async function openPathInExplorer(path: string): Promise<void> {
  try {
    await window.api.openInExplorer(path);
  } catch {
    // ignore
  }
}
