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
 * @file breakReminderConfig.ts
 * @description 休息提醒的共享常量与类型：设置页、小岛调度器、总览小组件三处此前各自复制了一份。
 * @author 灵屿
 */

import type { StoredListKey } from '../../../../../../../../../../shared/listStore';

/** 原子列表键（store 侧按 id 合并，跨窗口写入不再整表覆盖） */
export const BREAK_REMINDER_LIST_KEY: StoredListKey = 'break-reminder-items';
/** 每个条目上次触发的时间戳，按 id 索引 */
export const BREAK_REMINDER_LAST_FIRED_KEY = 'break-reminder-last-fired';

/** 休息提醒条目 */
export interface BreakReminderItem {
  id: number;
  name: string;
  intervalMinutes: number;
  enabled: boolean;
  icon?: string;
}
