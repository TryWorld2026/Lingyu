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
 * @file index.d.ts
 * @description 进程控制原生插件的目标参数与结果类型。
 * @author 灵屿
 */

export interface ProcessCloseResult {
  target: string | number;
  matchedCount: number;
  terminatedCount: number;
  failedCount: number;
  failures: Array<{ pid: number; name: string; errorCode: number }>;
}
/**
 * 关闭指定进程。
 * @param target - 进程名或 PID。
 * @returns 匹配、关闭与失败记录。
 */
export function closeProcess(target: string | number): ProcessCloseResult;
/**
 * 逐项关闭指定进程。
 * @param targets - 进程名或 PID 列表。
 * @returns 每个目标的处理结果。
 */
export function closeProcesses(targets: Array<string | number>): ProcessCloseResult[];
