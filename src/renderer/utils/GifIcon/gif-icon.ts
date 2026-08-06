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
 * @file gif-icon.ts
 * @description GIF 动图路径枚举
 * @author 灵屿
 */

export const GifIcon = {
  CLAWD_IDLE: './gif/clawd-idle.gif',
  CLAWD_REVIEW: './gif/clawd-review.gif',
  CLAWD_WAITING: './gif/clawd-waiting.gif',
  CLAWD_WAVING: './gif/clawd-waving.gif',
} as const;

export type GifIconKey = keyof typeof GifIcon;
