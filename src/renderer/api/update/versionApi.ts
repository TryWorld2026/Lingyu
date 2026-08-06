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
 * @file versionApi.ts
 * @description 版本信息与更新计数（灵屿：版本描述由本地提供，无远端服务）
 * @author 灵屿
 */

import type { VersionInfo } from './types/VersionInfo';

export type { VersionInfo };

/** 灵屿版本描述（跟随主版本更新） */
const VERSION_DESCRIPTION = '免费开源的 Windows 桌面灵动岛：实时天气、同步歌词、音乐控制、文件暂存架、系统通知接管、音量 HUD 与电量胶囊。';

/**
 * 获取当前版本信息（本地返回，无需远端服务）
 */
export async function fetchVersion(): Promise<Pick<VersionInfo, 'description'> | null> {
  return { description: VERSION_DESCRIPTION };
}

/**
 * 上报更新下载计数（灵屿为本地免费应用，无需上报）
 */
export async function reportUpdateDownloadCount(_version: string): Promise<boolean> {
  return true;
}
