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

import { clipboard, ipcMain, shell } from 'electron';
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
  ipcMain.handle('clipboard:read-text', () => {
    try {
      return clipboard.readText() || '';
    } catch {
      return '';
    }
  });

  ipcMain.handle('clipboard:write-text', (_event, text: string) => {
    try {
      clipboard.writeText(typeof text === 'string' ? text : '');
      return true;
    } catch {
      return false;
    }
  });

  /**
   * 将文件路径以 CF_HDROP 格式写入剪贴板（供暂存架取回后在资源管理器中 Ctrl+V 复制）
   * @param _event - IPC 事件
   * @param paths - 文件绝对路径数组
   * @returns 是否写入成功
   */
  ipcMain.handle('clipboard:copy-files', (_event, paths: string[]) => {
    try {
      const fileList = Array.isArray(paths)
        ? paths.filter((p): p is string => typeof p === 'string' && p.length > 0)
        : [];
      if (fileList.length === 0) return false;
      // CF_HDROP：DROPFILES 结构 + UTF-16LE 文件路径列表（双 null 结尾）
      const headerSize = 20;
      const pathBuffers = fileList.map((p) => Buffer.from(`${p}\0`, 'utf16le'));
      const totalSize = headerSize + pathBuffers.reduce((sum, b) => sum + b.length, 0) + 2;
      const buffer = Buffer.alloc(totalSize);
      buffer.writeUInt32LE(headerSize, 0); // pFiles: 文件列表相对结构起始的偏移
      let offset = headerSize;
      for (const b of pathBuffers) {
        b.copy(buffer, offset);
        offset += b.length;
      }
      buffer.writeUInt16LE(0, offset); // 列表终止的双 null
      clipboard.writeBuffer('CF_HDROP', buffer);
      return true;
    } catch {
      return false;
    }
  });

  /**
   * 读取剪贴板中的文件路径列表（供暂存架"从剪贴板添加"）
   * @returns 文件绝对路径数组
   */
  ipcMain.handle('clipboard:read-files', () => {
    try {
      const buffer = clipboard.readBuffer('CF_HDROP');
      if (!buffer || buffer.length < 20) return [];
      const paths: string[] = [];
      let offset = buffer.readUInt32LE(0); // pFiles 偏移
      const end = buffer.length - 1;
      let current = Buffer.alloc(0);
      while (offset < end) {
        const char = buffer.readUInt16LE(offset);
        offset += 2;
        if (char === 0) {
          if (current.length > 0) {
            paths.push(current.toString('utf16le'));
            current = Buffer.alloc(0);
          }
        } else {
          current = Buffer.concat([current, Buffer.from([char & 0xff, char >> 8])]);
        }
        if (paths.length > 500) break;
      }
      return paths;
    } catch {
      return [];
    }
  });

  ipcMain.handle('clipboard:url-blacklist:get', () => {
    return options.getBlacklist();
  });

  ipcMain.handle('clipboard:url-blacklist:set', (event, list: string[]) => {
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

  ipcMain.handle('clipboard:url-blacklist:add-domain', (_event, domain: string) => {
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

  ipcMain.handle('clipboard:url-detect-mode:get', () => {
    return options.getDetectMode();
  });

  ipcMain.handle('clipboard:url-detect-mode:set', (event, mode: ClipboardUrlDetectMode) => {
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

  ipcMain.handle('clipboard:url-monitor:get', () => {
    return options.getMonitorEnabled();
  });

  ipcMain.handle('clipboard:url-monitor:set', (event, enabled: boolean) => {
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

  ipcMain.handle('clipboard:open-url', async (_event, url: string) => {
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
