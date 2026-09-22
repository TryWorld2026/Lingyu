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
 * @file media.ts
 * @description 媒体控制相关 IPC 处理模块
 * @description 处理播放控制、音源切换等媒体相关的 IPC 请求
 * @author 灵屿
 */

import { BrowserWindow } from 'electron';
import { handleTrusted } from '../trustedSender';
import { play, pause, next, previous, seek, getTimestamp } from '@lingyu/windows-smtc-helper';
import { getMute, setMute } from '@lingyu/windows-volume-helper';

interface MediaSessionRuntimeEntry {
  payload: unknown;
  hasTitle: boolean;
}

interface RegisterMediaIpcHandlersOptions {
  getMainWindow: () => BrowserWindow | null;
  isWhitelisted: () => boolean;
  getPendingSourceSwitchId: () => string;
  setPendingSourceSwitchId: (id: string) => void;
  getPendingSourceSwitchEntry: () => unknown;
  clearPendingSourceSwitchEntry: () => void;
  getCurrentDeviceId: () => string;
  setCurrentDeviceId: (id: string) => void;
  getSmtcSessionRuntime: () => Map<string, MediaSessionRuntimeEntry> | null;
}

/**
 * 注册媒体控制相关 IPC 处理器
 * @description 注册播放、暂停、切歌、音源切换等媒体控制的 IPC 事件处理器
 * @param options - 配置选项，包含窗口获取和媒体控制函数
 */
export function registerMediaIpcHandlers(options: RegisterMediaIpcHandlersOptions): void {
  handleTrusted('media:current-info:get', () => {
    const entry = options.getSmtcSessionRuntime()?.get(options.getCurrentDeviceId());
    return entry?.hasTitle ? entry.payload : null;
  });

  handleTrusted('media:play-pause', () => {
    const entry = options.getSmtcSessionRuntime()?.get(options.getCurrentDeviceId());
    const isPlaying = Boolean(entry && (entry.payload as Record<string, unknown>)?.isPlaying);
    if (isPlaying) pause(); else play();
  });

  handleTrusted('media:next', () => {
    if (!options.isWhitelisted()) return;
    next();
  });

  handleTrusted('media:prev', () => {
    if (!options.isWhitelisted()) return;
    previous();
  });

  handleTrusted('media:accept-source-switch', () => {
    const pendingSourceSwitchId = options.getPendingSourceSwitchId();
    const pendingSourceSwitchEntry = options.getPendingSourceSwitchEntry();
    if (pendingSourceSwitchId && pendingSourceSwitchEntry) {
      options.setCurrentDeviceId(pendingSourceSwitchId);
      options.setPendingSourceSwitchId('');
      options.clearPendingSourceSwitchEntry();
      const entry = options.getSmtcSessionRuntime()?.get(options.getCurrentDeviceId());
      const payload = entry?.hasTitle ? entry.payload : null;
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('nowplaying:info', payload);
        }
      });
    }
  });

  handleTrusted('media:reject-source-switch', () => {
    options.setPendingSourceSwitchId('');
    options.clearPendingSourceSwitchEntry();
  });

  handleTrusted('media:seek', (_event, positionMs: number) => {
    if (!options.isWhitelisted()) return;
    seek(positionMs / 1000);
  });

  handleTrusted('media:get-volume', () => 0.5);

  handleTrusted('media:set-volume', (_event, _volume: number) => {
    // SMTC 不支持应用级音量控制
  });

  handleTrusted('media:get-muted', () => getMute());

  handleTrusted('media:toggle-muted', () => {
    const muted = getMute();
    if (muted === null) return null;

    const nextMuted = !muted;
    return setMute(nextMuted) ? nextMuted : null;
  });

  handleTrusted('smtc:get-timestamp', () => {
    return getTimestamp();
  });
}
