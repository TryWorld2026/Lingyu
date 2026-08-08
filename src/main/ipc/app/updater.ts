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
 * @file updater.ts
 * @description 自动更新相关 IPC 处理模块
 * @description 处理检查更新、下载更新和安装更新的 IPC 请求
 * @author 灵屿
 */

import { BrowserWindow, ipcMain } from 'electron';
import type { AppUpdater } from 'electron-updater';
import type { UpdateSourceKey, RegisterUpdaterIpcHandlersOptions } from './types';
import { deleteFirstLaunchConfig } from '../../config/storeConfig';
import { DEFAULT_UPDATE_SOURCE, GITHUB_OWNER, GITHUB_REPO } from './config/updater';

function normalizeUpdateSource(value: unknown): UpdateSourceKey {
  if (value === 'github') return 'github';
  if (value === 'ghproxy') return 'ghproxy';
  if (value === 'cf-dl') return 'cf-dl';
  if (value === 'tencent-cos') return 'tencent-cos';
  if (value === 'aliyun-oss') return 'aliyun-oss';
  if (value === 'esa-cdn') return 'esa-cdn';
  return DEFAULT_UPDATE_SOURCE;
}

/** 简单的 x.y.z 版本号比较：a > b 返回 1，相等返回 0，a < b 返回 -1（容忍前缀 v） */
function compareVersions(a: string, b: string): number {
  const norm = (v: string): number[] =>
    v.replace(/^v/i, '').split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const va = norm(a);
  const vb = norm(b);
  const len = Math.max(va.length, vb.length);
  for (let i = 0; i < len; i += 1) {
    const x = va[i] ?? 0;
    const y = vb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

function applyUpdateSource(updater: AppUpdater, source: UpdateSourceKey): void {
  if (source === 'github') {
    updater.setFeedURL({
      provider: 'github',
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      private: false,
    });
    return;
  }
  if (source === 'ghproxy') {
    // 通过 gh-proxy.com 代理 GitHub Releases，解决国内下载慢问题（ghproxy.com 已失效返回拦截页）
    updater.setFeedURL({
      provider: 'generic',
      url: `https://gh-proxy.com/https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download/`,
    });
    return;
  }
  if (source === 'cf-dl') {
    // 自建 Cloudflare Worker 反代（dl.lingyu.tryworld.com.cn），国内走 CF 网络，免费自主可控
    updater.setFeedURL({
      provider: 'generic',
      url: 'https://dl.lingyu.tryworld.com.cn/',
    });
    return;
  }
  // 其它更新源暂不支持（免费版仅使用 GitHub Releases）
  updater.setFeedURL({
    provider: 'github',
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    private: false,
  });
}

/**
 * 注册自动更新相关 IPC 处理器
 * @description 注册检查更新、下载更新、安装更新和版本查询的 IPC 事件处理器
 * @param options - 配置选项，包含更新器和版本信息获取函数
 */
export function registerUpdaterIpcHandlers(options: RegisterUpdaterIpcHandlersOptions): void {
  ipcMain.handle('updater:check', async (_event, sourceRaw?: string) => {
    const source = normalizeUpdateSource(sourceRaw);
    try {
      applyUpdateSource(options.updater, source);
      const current = options.getVersion();
      console.log('[Updater:check] currentVersion:', current);
      console.log('[Updater:check] app.isPackaged:', options.isPackaged());
      console.log('[Updater:check] source:', source);
      console.log('[Updater:check] calling checkForUpdates...');
      const result = await options.updater.checkForUpdates();
      console.log('[Updater:check] result:', JSON.stringify(result?.updateInfo ?? null));
      if (!result || !result.updateInfo) {
        console.log('[Updater:check] no updateInfo returned');
        return { available: false };
      }
      const latest = result.updateInfo.version;
      const isNewer = compareVersions(latest, current) > 0;
      console.log(`[Updater:check] latest=${latest} current=${current} available=${isNewer}`);
      return {
        available: isNewer,
        version: latest,
        releaseNotes: result.updateInfo.releaseNotes || '',
        currentVersion: current,
      };
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('[Updater:check] ERROR:', e.message);
      console.error('[Updater:check] stack:', e.stack);
      // cf-dl（Cloudflare 反代）失败时自动回退 GitHub 直连，保证至少能检查到更新
      if (source === 'cf-dl') {
        try {
          console.log('[Updater:check] cf-dl failed, falling back to GitHub...');
          applyUpdateSource(options.updater, 'github');
          const result = await options.updater.checkForUpdates();
          if (result && result.updateInfo) {
            const latest = result.updateInfo.version;
            const isNewer = compareVersions(latest, options.getVersion()) > 0;
            return {
              available: isNewer,
              version: latest,
              releaseNotes: result.updateInfo.releaseNotes || '',
              currentVersion: options.getVersion(),
            };
          }
          return { available: false };
        } catch (fallbackErr: unknown) {
          const fe = fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr));
          console.error('[Updater:check] GitHub fallback ERROR:', fe.message);
          return { available: false, error: fe.message };
        }
      }
      return { available: false, error: e.message };
    }
  });

  ipcMain.handle('updater:download', async (_event, sourceRaw?: string) => {
    const source = normalizeUpdateSource(sourceRaw);

    const tryDownload = async (useSource: UpdateSourceKey): Promise<boolean> => {
      applyUpdateSource(options.updater, useSource);
      console.log('[Updater:download] source:', useSource);
      console.log('[Updater:download] step 1 - checkForUpdates...');
      const checkResult = await options.updater.checkForUpdates();
      console.log('[Updater:download] checkResult:', JSON.stringify(checkResult?.updateInfo ?? null));
      if (!checkResult || !checkResult.updateInfo) {
        console.error('[Updater:download] checkForUpdates returned no info, aborting download');
        return false;
      }
      console.log('[Updater:download] step 2 - downloadUpdate...');
      await options.updater.downloadUpdate();
      console.log('[Updater:download] download finished successfully');
      return true;
    };

    try {
      return await tryDownload(source);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('[Updater:download] ERROR:', e.message);
      console.error('[Updater:download] stack:', e.stack);
      // cf-dl（Cloudflare 反代）失败时自动回退 GitHub 直连，与检查阶段的回退策略保持一致
      if (source === 'cf-dl') {
        try {
          console.log('[Updater:download] cf-dl failed, falling back to GitHub...');
          return await tryDownload('github');
        } catch (fallbackErr: unknown) {
          const fe = fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr));
          console.error('[Updater:download] GitHub fallback ERROR:', fe.message);
          return false;
        }
      }
      return false;
    }
  });

  ipcMain.handle('updater:install', () => {
    options.updater.quitAndInstall(false, true);
    return true;
  });

  ipcMain.handle('updater:version', () => {
    return options.getVersion();
  });

  ipcMain.handle('guide:reset', () => {
    // 重置引导：删除首次启动标记（下次启动显示 9 步完整引导），并立即在主窗口显示 5 页轻引导
    deleteFirstLaunchConfig();
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('guide:show');
      }
    });
    return true;
  });
}
