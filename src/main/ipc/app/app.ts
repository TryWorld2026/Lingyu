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
 * @file app.ts
 * @description 应用相关 IPC 处理模块
 * @description 处理应用退出、重启、日志管理和文件操作等 IPC 请求
 * @author 鸡哥
 */

import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { existsSync } from 'fs';
import { copyFile, stat } from 'fs/promises';
import { basename } from 'path';
import { createHash } from 'crypto';
import { clearLogsCacheFiles, ensureLogsDir } from '../../log/mainLog';
import { openStandaloneWindow, closeStandaloneWindow } from '../../window/standaloneWindow';
import { getIconByPath, getIconByShortcutPath } from '@lingyu/windows-application-icon-helper';
export function registerAppIpcHandlers(): void {
  ipcMain.handle('app:pick-feedback-screenshot-file', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow();
      if (!win) return null;
      const result = await dialog.showOpenDialog(win, {
        title: '选择截图文件',
        defaultPath: app.getPath('pictures'),
        filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
        properties: ['openFile'],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      return result.filePaths[0] || null;
    } catch (err) {
      console.error('[App] pick feedback screenshot file error:', err);
      return null;
    }
  });

  ipcMain.handle('app:pick-feedback-log-file', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow();
      if (!win) return null;
      const logDir = ensureLogsDir();
      const result = await dialog.showOpenDialog(win, {
        title: '选择日志文件',
        defaultPath: logDir,
        filters: [{ name: '日志文件', extensions: ['log'] }],
        properties: ['openFile'],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      const selectedPath = result.filePaths[0] || '';
      if (!selectedPath.toLowerCase().endsWith('.log')) {
        return null;
      }
      return selectedPath;
    } catch (err) {
      console.error('[App] pick feedback log file error:', err);
      return null;
    }
  });

  ipcMain.handle('app:restart', () => {
    try {
      app.relaunch();
      app.exit(0);
      return true;
    } catch (err) {
      console.error('[App] restart error:', err);
      return false;
    }
  });

  ipcMain.handle('app:open-logs-folder', async () => {
    try {
      const logDir = ensureLogsDir();
      const result = await shell.openPath(logDir);
      return result === '';
    } catch (err) {
      console.error('[App] open logs folder error:', err);
      return false;
    }
  });

  ipcMain.handle('app:clear-logs-cache', async () => {
    try {
      const result = clearLogsCacheFiles();
      if (!result.success) {
        return { success: false, freedBytes: 0 };
      }
      console.log(`[App] cleared logs cache: ${result.fileCount} files, ${(result.freedBytes / 1024).toFixed(1)} KB freed`);
      return { success: true, freedBytes: result.freedBytes };
    } catch (err) {
      console.error('[App] clear logs cache error:', err);
      return { success: false, freedBytes: 0 };
    }
  });

  ipcMain.handle('app:get-file-icon', (_event, filePath: string) => {
    try {
      const isLnk = filePath.toLowerCase().endsWith('.lnk');
      const result = isLnk ? getIconByShortcutPath(filePath) : getIconByPath(filePath);
      return result ? result.data.toString('base64') : null;
    } catch (err) {
      console.error('[App] get-file-icon error:', err);
      return null;
    }
  });

  ipcMain.handle('app:open-file', async (_event, filePath: string) => {
    try {
      await shell.openPath(filePath);
      return true;
    } catch (err) {
      console.error('[App] open-file error:', err);
      return false;
    }
  });

  ipcMain.handle('app:open-in-explorer', (_event, filePath: string) => {
    try {
      if (!filePath || typeof filePath !== 'string') return false;
      if (!existsSync(filePath)) return false;
      shell.showItemInFolder(filePath);
      return true;
    } catch (err) {
      console.error('[App] open-in-explorer error:', err);
      return false;
    }
  });

  ipcMain.handle('app:save-image-as', async (event, sourcePath: string) => {
    try {
      if (!sourcePath || typeof sourcePath !== 'string') {
        return { ok: false, canceled: false, filePath: null as string | null };
      }
      if (!existsSync(sourcePath)) {
        return { ok: false, canceled: false, filePath: null as string | null };
      }

      const win = BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow();
      if (!win) {
        return { ok: false, canceled: false, filePath: null as string | null };
      }

      const defaultName = basename(sourcePath);
      const saveDialogResult = await dialog.showSaveDialog(win, {
        title: '保存图片',
        defaultPath: defaultName,
        filters: [{ name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }],
      });

      if (saveDialogResult.canceled || !saveDialogResult.filePath) {
        return { ok: false, canceled: true, filePath: null as string | null };
      }

      await copyFile(sourcePath, saveDialogResult.filePath);
      shell.showItemInFolder(saveDialogResult.filePath);
      return { ok: true, canceled: false, filePath: saveDialogResult.filePath };
    } catch (err) {
      console.error('[App] save-image-as error:', err);
      return { ok: false, canceled: false, filePath: null as string | null };
    }
  });

  ipcMain.handle('app:resolve-shortcut', (_event, lnkPath: string) => {
    try {
      if (process.platform === 'win32') {
        const result = shell.readShortcutLink(lnkPath);
        return { target: result.target, name: basename(lnkPath, '.lnk') };
      }
      return null;
    } catch (err) {
      console.error('[App] resolve-shortcut error:', err);
      return null;
    }
  });

  ipcMain.handle('app:open-standalone-window', () => {
    try {
      openStandaloneWindow();
      return true;
    } catch (err) {
      console.error('[App] open-standalone-window error:', err);
      return false;
    }
  });

  ipcMain.handle('app:close-standalone-window', () => {
    try {
      closeStandaloneWindow();
      return true;
    } catch (err) {
      console.error('[App] close-standalone-window error:', err);
      return false;
    }
  });

  ipcMain.on('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) win.minimize();
  });

  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.on('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) win.close();
  });

  ipcMain.handle('app:pick-file-for-hash', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow();
      if (!win) return null;
      const result = await dialog.showOpenDialog(win, {
        title: '选择文件',
        properties: ['openFile'],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      return result.filePaths[0] || null;
    } catch (err) {
      console.error('[App] pick-file-for-hash error:', err);
      return null;
    }
  });

  ipcMain.handle('app:compute-file-hash', async (_event, filePath: string, algorithm: string) => {
    try {
      if (!filePath || typeof filePath !== 'string') return null;
      if (!existsSync(filePath)) return null;
      const algo = ['md5', 'sha1', 'sha256', 'sha512'].includes(algorithm) ? algorithm : 'sha256';
      const { createReadStream } = await import('fs');
      const hash = createHash(algo);
      const fileInfo = await stat(filePath);
      return new Promise<{ hash: string; algorithm: string; fileName: string; fileSize: number }>((resolvePromise, rejectPromise) => {
        const stream = createReadStream(filePath);
        stream.on('data', (chunk: string | Buffer) => hash.update(chunk));
        stream.on('end', () => {
          resolvePromise({
            hash: hash.digest('hex'),
            algorithm: algo,
            fileName: basename(filePath),
            fileSize: fileInfo.size,
          });
        });
        stream.on('error', (err) => rejectPromise(err));
      });
    } catch (err) {
      console.error('[App] compute-file-hash error:', err);
      return null;
    }
  });
}
