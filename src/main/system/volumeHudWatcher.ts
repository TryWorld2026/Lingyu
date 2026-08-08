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
 * @file volumeHudWatcher.ts
 * @description 音量 HUD 监听：订阅系统音量/静音变化事件，推送变化供渲染层显示 HUD
 * @author 灵屿
 */

import { BrowserWindow } from 'electron';
import { VolumeMonitor, getMute } from '@lingyu/windows-volume-helper';

interface VolumeHudWatcherOptions {
  getMainWindow: () => BrowserWindow | null;
  /** 是否启用（默认启用） */
  isEnabled?: () => boolean;
}

const MIN_CHANGE_DELTA = 2;

/**
 * 创建音量 HUD 监听服务
 * @description 基于插件的常驻 VolumeMonitor（异步事件推送），仅在音量/静音变化时触发，
 * 避免高频 spawnSync 轮询阻塞主进程
 * @param options - 服务配置选项
 * @returns 音量 HUD 监听服务对象
 */
export function createVolumeHudWatcher(options: VolumeHudWatcherOptions): {
  start: () => void;
  stop: () => void;
} {
  let monitor: VolumeMonitor | null = null;
  let lastVolume: number | null = null;
  let lastMuted: boolean | null = null;

  const pushChange = (volume: number | null, muted: boolean | null): void => {
    const win = options.getMainWindow();
    if (!win || win.isDestroyed()) return;
    win.webContents.send('system-volume-changed', { volume, muted: muted === true });
  };

  const handleVolumeChanged = (level: number): void => {
    if (options.isEnabled && !options.isEnabled()) return;

    let muted: boolean | null = null;
    try {
      muted = getMute();
    } catch {
      muted = null;
    }

    const changed = lastVolume === null
      || muted !== lastMuted
      || (lastVolume !== null && Math.abs(level - lastVolume) >= MIN_CHANGE_DELTA);
    if (!changed) return;

    lastVolume = level;
    lastMuted = muted;
    pushChange(level, muted);
  };

  return {
    start: () => {
      if (monitor) return;
      monitor = new VolumeMonitor();
      monitor.on('volume-changed', handleVolumeChanged);
      monitor.on('error', () => {
        // 插件异常时静默降级：保留上次状态，等待下一次事件
      });
      try {
        monitor.start();
      } catch {
        // helper EXE 缺失（如开发环境未编译插件）时静默降级
        monitor = null;
      }
    },
    stop: () => {
      if (monitor) {
        monitor.removeListener('volume-changed', handleVolumeChanged);
        monitor.stop();
        monitor = null;
      }
    },
  };
}
