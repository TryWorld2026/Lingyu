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
 */

/**
 * @file toastAccess.ts
 * @description 系统 Toast 授权决策工具：根据授权状态决定是否请求授权并启动监听
 * @author 灵屿
 */

/** 系统通知访问授权状态（与原生模块 toast_listener_helpers.cpp 返回值一致） */
export const TOAST_ACCESS_STATUS = {
  /** 用户已授权（原生返回 allowed） */
  AUTHORIZED: 'allowed',
  DENIED: 'denied',
  UNSPECIFIED: 'unspecified',
} as const;

export interface ToastAccessPlan {
  /** 是否需要先请求授权 */
  needRequest: boolean;
  /** 是否应启动监听 */
  shouldStart: boolean;
}

/**
 * 根据授权状态决策 Toast 监听启动计划
 * @param accessStatus - 系统返回的访问授权状态
 * @returns 启动计划：被拒绝时不启动（避免静默空转），其余状态请求授权后启动
 */
export function resolveToastAccessPlan(accessStatus: string): ToastAccessPlan {
  if (accessStatus === TOAST_ACCESS_STATUS.DENIED) {
    return { needRequest: false, shouldStart: false };
  }
  if (accessStatus === TOAST_ACCESS_STATUS.AUTHORIZED) {
    return { needRequest: false, shouldStart: true };
  }
  // unspecified 或未知状态：首次请求授权并启动
  return { needRequest: true, shouldStart: true };
}
