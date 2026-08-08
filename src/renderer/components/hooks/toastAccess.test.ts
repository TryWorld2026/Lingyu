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
 * @file toastAccess.test.ts
 * @description 系统 Toast 授权决策逻辑单元测试
 * @author 灵屿
 */

import { describe, expect, it } from 'vitest';
import { resolveToastAccessPlan, TOAST_ACCESS_STATUS } from './toastAccess';

describe('resolveToastAccessPlan', () => {
  it('已授权时启动监听', () => {
    const plan = resolveToastAccessPlan(TOAST_ACCESS_STATUS.AUTHORIZED);
    expect(plan.shouldStart).toBe(true);
    expect(plan.needRequest).toBe(false);
  });

  it('未指定（首次）时请求授权并启动', () => {
    const plan = resolveToastAccessPlan(TOAST_ACCESS_STATUS.UNSPECIFIED);
    expect(plan.shouldStart).toBe(true);
    expect(plan.needRequest).toBe(true);
  });

  it('被拒绝时不启动（避免空转）', () => {
    const plan = resolveToastAccessPlan(TOAST_ACCESS_STATUS.DENIED);
    expect(plan.shouldStart).toBe(false);
    expect(plan.needRequest).toBe(false);
  });

  it('未知状态按需请求并启动', () => {
    const plan = resolveToastAccessPlan('some-other-status');
    expect(plan.shouldStart).toBe(true);
    expect(plan.needRequest).toBe(true);
  });
});
