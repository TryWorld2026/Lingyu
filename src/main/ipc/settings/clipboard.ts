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
 * @file clipboard.ts
 * @description 剪贴板 URL 相关 IPC 处理模块
 * @description 处理剪贴板 URL 黑名单、检测模式和监听开关的 IPC 请求
 * @author 灵屿
 */

import { BrowserWindow, clipboard, shell } from 'electron';
import { copyFilesToClipboard, readClipboardFiles } from '../../clipboard/fileClipboard';
import { handleTrusted } from '../trustedSender';
import { join } from 'path';
import { writeFileSync } from 'fs';
import { broadcastSettingChange } from '../../utils/broadcast';
import {
  normalizeClipboardUrlBlacklistDomain,
  normalizeClipboardUrlDetectMode,
  sanitizeClipboardUrlBlacklist,
  type ClipboardUrlDetectMode,
} from '../../utils/clipboardUrl';

interface RegisterClipboardIpcHandlersOptions {
  storeDir: string;
  monitorEnabledStoreKey: string;
  detectModeStoreKey: string;
  blacklistStoreKey: string;
  defaultDetectMode: ClipboardUrlDetectMode;
  getMonitorEnabled: () => boolean;
  setMonitorEnabled: (enabled: boolean) => void;
  getDetectMode: () => ClipboardUrlDetectMode;
  setDetectMode: (mode: ClipboardUrlDetectMode) => void;
  getBlacklist: () => string[];
  setBlacklist: (list: string[]) => void;
  startWatcher: () => void;
  stopWatcher: () => void;
}

/**
 * 注册剪贴板 URL 相关 IPC 处理器
 * @description 注册剪贴板 URL 黑名单、检测模式、监听开关的 IPC 事件处理器
 * @param options - 配置选项，包含存储目录、键名和状态管理函数
 */
export function registerClipboardIpcHandlers(options: RegisterClipboardIpcHandlersOptions): void {
  handleTrusted('clipboard:read-text', () => {
    try {
      return clipboard.readText() || '';
    } catch {
      return '';
    }
  });

  handleTrusted('clipboard:write-text', (_event, text: string) => {
    try {
      clipboard.writeText(typeof text === 'string' ? text : '');
      return true;
    } catch {
      return false;
    }
  });

  /**
   * 将文件路径以 CF_HDROP 格式写入剪贴板（供暂存架取回后在资源管理器中 Ctrl+V 复制）
   * @param event - 受信任的 IPC 事件，用于取得非空窗口所有者句柄。
   * @param paths - 文件绝对路径数组
   * @returns 是否写入成功
   */
  handleTrusted('clipboard:copy-files', (event, paths: string[]) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      return copyFilesToClipboard(paths, window?.getNativeWindowHandle() ?? null);
    } catch {
      return false;
    }
  });

  /**
   * 读取剪贴板中的文件路径列表（供暂存架"从剪贴板添加"）
   * @returns 文件绝对路径数组
   */
  handleTrusted('clipboard:read-files', () => {
    try {
      return readClipboardFiles();
    } catch {
      return [];
    }
  });

  handleTrusted('clipboard:url-blacklist:get', () => {
    return options.getBlacklist();
  });

  handleTrusted('clipboard:url-blacklist:set', (event, list: string[]) => {
    try {
      const next = sanitizeClipboardUrlBlacklist(list);
      const filePath = join(options.storeDir, `${options.blacklistStoreKey}.json`);
      options.setBlacklist(next);
      writeFileSync(filePath, JSON.stringify(next, null, 2), 'utf-8');
      broadcastSettingChange(event.sender.id, 'clipboard:url-blacklist', next);
      return true;
    } catch (err) {
      console.error('[ClipboardUrlBlacklist] persist error:', err);
      return false;
    }
  });

  handleTrusted('clipboard:url-blacklist:add-domain', (_event, domain: string) => {
    try {
      const normalized = normalizeClipboardUrlBlacklistDomain(domain);
      if (!normalized) return false;
      const current = options.getBlacklist();
      const alreadyExists = current.some((item) => item === normalized);
      const next = alreadyExists ? current : [...current, normalized];
      const filePath = join(options.storeDir, `${options.blacklistStoreKey}.json`);
      options.setBlacklist(next);
      writeFileSync(filePath, JSON.stringify(next, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('[ClipboardUrlBlacklist] add domain error:', err);
      return false;
    }
  });

  handleTrusted('clipboard:url-detect-mode:get', () => {
    return options.getDetectMode();
  });

  handleTrusted('clipboard:url-detect-mode:set', (event, mode: ClipboardUrlDetectMode) => {
    try {
      const filePath = join(options.storeDir, `${options.detectModeStoreKey}.json`);
      const normalized = normalizeClipboardUrlDetectMode(mode) || options.defaultDetectMode;
      options.setDetectMode(normalized);
      writeFileSync(filePath, JSON.stringify(normalized, null, 2), 'utf-8');
      broadcastSettingChange(event.sender.id, 'clipboard:url-detect-mode', normalized);
      return true;
    } catch (err) {
      console.error('[ClipboardUrlDetectMode] persist error:', err);
      return false;
    }
  });

  handleTrusted('clipboard:url-monitor:get', () => {
    return options.getMonitorEnabled();
  });

  handleTrusted('clipboard:url-monitor:set', (event, enabled: boolean) => {
    try {
      const next = Boolean(enabled);
      const filePath = join(options.storeDir, `${options.monitorEnabledStoreKey}.json`);
      options.setMonitorEnabled(next);
      writeFileSync(filePath, JSON.stringify(next, null, 2), 'utf-8');
      if (next) {
        options.startWatcher();
      } else {
        options.stopWatcher();
      }
      broadcastSettingChange(event.sender.id, 'clipboard:url-monitor', next);
      return true;
    } catch (err) {
      console.error('[ClipboardUrlMonitor] persist error:', err);
      return false;
    }
  });

  handleTrusted('clipboard:open-url', async (_event, url: string) => {
    try {
      if (typeof url !== 'string') {
        return false;
      }
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return false;
      }
      await shell.openExternal(parsedUrl.toString());
      return true;
    } catch {
      return false;
    }
  });
}
