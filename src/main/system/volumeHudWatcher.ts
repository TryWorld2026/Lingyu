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
 * @file volumeHudWatcher.ts
 * @description 音量 HUD 监听：低频轮询系统音量/静音状态，变化时推送事件供渲染层显示 HUD
 * @author 灵屿
 */

import { BrowserWindow } from 'electron';
import { getVolume, getMute } from '@lingyu/windows-volume-helper';

interface VolumeHudWatcherOptions {
  getMainWindow: () => BrowserWindow | null;
  /** 是否启用（默认启用） */
  isEnabled?: () => boolean;
}

const POLL_INTERVAL_MS = 400;
const MIN_CHANGE_DELTA = 2;

export function createVolumeHudWatcher(options: VolumeHudWatcherOptions): {
  start: () => void;
  stop: () => void;
} {
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastVolume: number | null = null;
  let lastMuted: boolean | null = null;

  const poll = (): void => {
    if (options.isEnabled && !options.isEnabled()) return;
    let volume: number | null = null;
    let muted: boolean | null = null;
    try {
      volume = getVolume();
      muted = getMute();
    } catch {
      return;
    }
    if (volume === null) return;

    const changed = lastVolume === null
      || muted !== lastMuted
      || (lastVolume !== null && Math.abs(volume - lastVolume) >= MIN_CHANGE_DELTA);
    if (!changed) return;

    lastVolume = volume;
    lastMuted = muted;

    const win = options.getMainWindow();
    if (!win || win.isDestroyed()) return;
    win.webContents.send('system-volume-changed', { volume, muted: muted === true });
  };

  return {
    start: () => {
      if (timer) return;
      lastVolume = null;
      lastMuted = null;
      timer = setInterval(poll, POLL_INTERVAL_MS);
    },
    stop: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
