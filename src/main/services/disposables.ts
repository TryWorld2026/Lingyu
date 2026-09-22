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
 * @file disposables.ts
 * @description 主进程退出清理注册表，统一收拢各服务的 stop/cleanup 回调
 * @description 避免退出时遗漏某个定时器/监听器（如剪贴板轮询）导致进程残留
 * @author 灵屿
 */

/** 已注册的清理回调集合（Set 天然去重，同一回调重复注册只执行一次） */
const disposables = new Set<() => void>();

/** 是否已执行过清理（保证 will-quit 与 window-all-closed 重复触发时只清理一次） */
let disposed = false;

/**
 * 注册一个退出清理回调
 * @description 应在服务创建后立即调用；清理已执行后新注册的回包会被立即执行
 * @param dispose - 无参清理函数，需自身保证幂等（重复调用无副作用）
 */
export function addDisposable(dispose: () => void): void {
  if (disposed) {
    safeRun(dispose);
    return;
  }
  disposables.add(dispose);
}

/**
 * 执行全部已注册的清理回调
 * @description 单个回调抛错不影响其余回调执行；执行后清空注册表
 */
export function disposeAll(): void {
  if (disposed) return;
  disposed = true;
  disposables.forEach((dispose) => {
    safeRun(dispose);
  });
  disposables.clear();
}

/**
 * 安全执行单个清理回调
 * @description 捕获并记录异常，避免中断清理流程
 * @param dispose - 清理函数
 */
function safeRun(dispose: () => void): void {
  try {
    dispose();
  } catch (err) {
    console.error('[Dispose] cleanup callback failed:', err);
  }
}
