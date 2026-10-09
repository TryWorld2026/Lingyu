/*
 * 灵屿 Lingyu - 免费开源的 Windows 桌面灵动岛（基于 eIsland 二次开发）
 * https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3, or (at your option) any later version.
 */

/**
 * @file listStore.ts
 * @description 待办、备忘录、闹钟和倒数日存储的跨窗口同步契约。
 * @author 灵屿
 */

export type StoredListKey = 'alarms' | 'countdown-dates' | 'todos' | 'memos' | 'url-favorites' | 'shelf';
export interface StoredListResult {
  success: boolean;
  revision: number;
  data: unknown[];
  exists?: boolean;
  error?: 'invalid' | 'conflict' | 'failed';
}
