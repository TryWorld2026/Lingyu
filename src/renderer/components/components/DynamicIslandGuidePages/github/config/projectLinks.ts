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
 * @file projectLinks.ts
 * @description 引导开源信息步骤 — 项目链接配置
 * @author 鸡哥
 */

import { SvgIcon } from '../../../../../utils/SvgIcon';
import type { ProjectLink } from '../types';

/** 项目链接配置 */
export const PROJECT_LINKS: ProjectLink[] = [
  { key: 'repo', url: 'https://github.com/TryWorld2026/Lingyu', icon: SvgIcon.GITHUB },
  { key: 'docs', url: 'https://github.com/TryWorld2026/Lingyu#readme', icon: SvgIcon.DOCS },
];

