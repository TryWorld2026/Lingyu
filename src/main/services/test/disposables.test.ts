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
 * @file disposables.test.ts
 * @description 主进程退出清理注册表单元测试：去重、幂等、异常隔离、迟到注册
 * @author 灵屿
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DisposablesModule from '../disposables';

/**
 * 载入全新的注册表实例
 * @description disposables 的 disposed 标记为模块级状态，无重置入口，
 *   故每个用例都通过重置模块缓存获得干净的注册表
 * @returns 新载入的 disposables 模块
 */
async function loadDisposables(): Promise<typeof DisposablesModule> {
  vi.resetModules();
  return import('../disposables');
}

describe('disposables registry', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('runs every registered callback on disposeAll', async () => {
    const { addDisposable, disposeAll } = await loadDisposables();
    const first = vi.fn();
    const second = vi.fn();

    addDisposable(first);
    addDisposable(second);
    disposeAll();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('deduplicates the same callback registered twice', async () => {
    const { addDisposable, disposeAll } = await loadDisposables();
    const stop = vi.fn();

    addDisposable(stop);
    addDisposable(stop);
    disposeAll();

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('only disposes once across repeated will-quit / window-all-closed triggers', async () => {
    const { addDisposable, disposeAll } = await loadDisposables();
    const stop = vi.fn();
    addDisposable(stop);

    disposeAll();
    disposeAll();

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('keeps disposing the remaining callbacks when one throws', async () => {
    const { addDisposable, disposeAll } = await loadDisposables();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom = vi.fn(() => {
      throw new Error('cleanup failed');
    });
    const after = vi.fn();

    addDisposable(boom);
    addDisposable(after);

    expect(() => disposeAll()).not.toThrow();
    expect(boom).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('immediately runs a callback registered after disposal', async () => {
    const { addDisposable, disposeAll } = await loadDisposables();
    disposeAll();

    const late = vi.fn();
    addDisposable(late);

    expect(late).toHaveBeenCalledTimes(1);
  });
});
