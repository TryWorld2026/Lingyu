/*
 * 灵屿 Lingyu - 免费开源的 Windows 桌面灵动岛（基于 eIsland 二次开发）
 * https://github.com/JNTMTMTM/eIsland
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 *
 * Original author: JNTMTMTM
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @file versionApi.test.ts
 * @description 版本信息 API 单元测试（灵屿本地逻辑，无远端服务依赖）
 * @author 灵屿
 */

import { describe, expect, it } from 'vitest';
import { fetchVersion, reportUpdateDownloadCount } from '../update/versionApi';

describe('versionApi', () => {
  it('returns local version description', async () => {
    const info = await fetchVersion();
    expect(info).not.toBeNull();
    expect(typeof info?.description).toBe('string');
    expect(info?.description.length ?? 0).toBeGreaterThan(0);
  });

  it('reportUpdateDownloadCount is a no-op that returns true', async () => {
    await expect(reportUpdateDownloadCount('1.2.3')).resolves.toBe(true);
    await expect(reportUpdateDownloadCount('')).resolves.toBe(true);
  });
});
