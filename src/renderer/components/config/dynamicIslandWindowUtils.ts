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
 * @file dynamicIslandWindowUtils.ts
 * @description 灵动岛窗口相关工具函数。
 * @author 灵屿
 */

/**
 * @description 判断鼠标是否位于当前窗口范围内。
 * @returns 鼠标在窗口内返回 true，否则返回 false。
 */
export async function isMouseInWindow(): Promise<boolean> {
  try {
    // 单次 IPC 由主进程计算命中，避免每帧两次 invoke（getMousePosition + getWindowBounds）
    return (await window.api?.isMouseInWindow?.()) === true;
  } catch {
    return false;
  }
}
