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
 * @file updater.ts
 * @description 更新模块常量配置
 * @author 灵屿
 */

import type { UpdateSourceKey } from '../types';

/** 默认更新源：GitHub 直连（支持 Range 差分更新，国内实测可用且速度快；cf-dl 反代仅 302 跳转且 CF IP 在国内常被干扰） */
export const DEFAULT_UPDATE_SOURCE: UpdateSourceKey = 'github';

/** GitHub 仓库所有者（灵屿仓库创建后修改） */
export const GITHUB_OWNER = 'TryWorld2026';

/** GitHub 仓库名 */
export const GITHUB_REPO = 'Lingyu';
