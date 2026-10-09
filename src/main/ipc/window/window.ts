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
 * @file window.ts
 * @description 窗口控制相关 IPC 处理模块
 * @description 处理窗口尺寸调整、位置调整和鼠标穿透等 IPC 请求
 * @author 灵屿
 */

import { BrowserWindow, screen } from 'electron';
import { handleTrusted, onTrusted } from '../trustedSender';
import { broadcastSettingChange } from '../../utils/broadcast';
import {
  readIslandShapeModeConfig,
  PILL_ISLAND_HEIGHT,
  PILL_EXPANDED_HEIGHT,
  PILL_NOTIFICATION_HEIGHT,
  PILL_LYRICS_HEIGHT,
  PILL_LYRICS_TRANSLATION_HEIGHT,
  PILL_EXPANDED_FULL_HEIGHT,
  PILL_SETTINGS_HEIGHT,
} from '../../config/storeConfig';

interface WindowIpcSizeOptions {
  expandedWidth: number;
  expandedHeight: number;
  notificationWidth: number;
  notificationHeight: number;
  lyricsWidth: number;
  lyricsHeight: number;
  lyricsTranslationHeight: number;
  expandedFullWidth: number;
  expandedFullHeight: number;
  settingsWidth: number;
  settingsHeight: number;
  islandWidth: number;
  islandHeight: number;
}

interface RegisterWindowIpcHandlersOptions {
  getMainWindow: () => BrowserWindow | null;
  getInitialCenterX: () => number;
  setHiddenByAutoHideProcess: (hidden: boolean) => void;
  getIslandPositionOffset: () => { x: number; y: number };
  getIslandDisplaySelection: () => string;
  sanitizeIslandDisplaySelection: (selection: unknown) => string;
  setIslandDisplaySelection: (selection: string) => void;
  sanitizeIslandPositionOffset: (offset: { x?: number; y?: number }) => { x: number; y: number };
  applyIslandPositionOffset: (offset: { x: number; y: number }) => void;
  writeIslandPositionOffsetConfig: (offset: { x: number; y: number }) => boolean;
  writeIslandDisplaySelectionConfig: (selection: string) => boolean;
  sizes: WindowIpcSizeOptions;
}

/**
 * 注册窗口控制相关 IPC 处理器
 * @description 注册窗口尺寸调整、位置调整和鼠标穿透的 IPC 事件处理器
 * @param options - 配置选项，包含窗口获取和位置管理函数
 */
/** 鼠标穿透锁定状态 */
let mousePassthroughLocked = false;

/**
 * 把窗口中心钳制在最近显示器的工作区内，避免小岛被拖出可见范围后无法找回。
 * @description 以窗口当前中心所在的显示器为基准，两侧各留 32px（窄屏按宽度 1/8 收紧），
 *   保证任何形态下都有一段可点击的岛身留在屏幕里。
 * @param win - 主窗口。
 * @returns 钳制后的窗口 x 坐标。
 */
function clampCenterToWorkArea(win: BrowserWindow): number {
  const bounds = win.getBounds();
  const area = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y }).workArea;
  const margin = Math.max(0, Math.min(32, Math.floor(area.width / 8)));
  const minX = area.x + margin;
  const maxX = area.x + area.width - bounds.width - margin;
  if (maxX <= minX) return Math.round(area.x + (area.width - bounds.width) / 2);
  return Math.round(Math.min(Math.max(bounds.x, minX), maxX));
}

/**
 * 切换鼠标穿透锁定状态
 * @description 锁定时窗口始终穿透鼠标事件，解锁后恢复正常行为
 * @param getMainWindow - 获取主窗口函数
 */
export function toggleMousePassthroughLock(getMainWindow: () => BrowserWindow | null): void {
  mousePassthroughLocked = !mousePassthroughLocked;
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return;
  if (mousePassthroughLocked) {
    win.setIgnoreMouseEvents(true, { forward: true });
  } else {
    win.setIgnoreMouseEvents(false);
  }
  win.webContents.send('window:passthrough-lock-changed', mousePassthroughLocked);
}

/**
 * 注册窗口控制相关 IPC 处理器
 * @description 注册窗口尺寸调整、位置调整和鼠标穿透的 IPC 事件处理器
 * @param options - 配置选项，包含窗口获取和位置管理函数
 */
export function registerWindowIpcHandlers(options: RegisterWindowIpcHandlersOptions): void {
  const withWindow = (fn: (win: BrowserWindow) => void): void => {
    const win = options.getMainWindow();
    if (!win || win.isDestroyed()) return;
    try {
      fn(win);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('Object has been destroyed')) {
        console.error('[WindowIPC] handler error:', err);
      }
    }
  };

  /** 获取当前窗口水平中心点（pill 模式用当前窗口中心，notch 模式用初始中心） */
  const getEffectiveCenterX = (win: BrowserWindow): number => {
    const shapeMode = readIslandShapeModeConfig();
    if (shapeMode === 'pill') {
      const bounds = win.getBounds();
      return bounds.x + bounds.width / 2;
    }
    return options.getInitialCenterX();
  };

  /** 获取当前窗口 y 坐标（notch 模式始终贴顶，pill 模式保持当前 y） */
  const getEffectiveY = (win: BrowserWindow): number => {
    const shapeMode = readIslandShapeModeConfig();
    if (shapeMode === 'notch') {
      const selection = options.getIslandDisplaySelection();
      let targetDisplay = screen.getPrimaryDisplay();
      if (selection !== 'primary') {
        const targetId = Number(selection);
        if (Number.isFinite(targetId)) {
          const found = screen.getAllDisplays().find((d) => d.id === targetId);
          if (found) targetDisplay = found;
        }
      }
      return targetDisplay.workArea.y;
    }
    return win.getBounds().y;
  };

  /** 根据当前形态模式返回对应高度（pill 模式各状态加高） */
  const getHeight = (notchHeight: number, pillHeight: number): number => {
    return readIslandShapeModeConfig() === 'pill' ? pillHeight : notchHeight;
  };

  onTrusted('window:notify', (_event, data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const { title, body, icon } = data as { title?: unknown; body?: unknown; icon?: unknown };
    if (typeof title !== 'string' || !title.trim() || title.length > 200
      || typeof body !== 'string' || body.length > 2000) return;
    const safeIcon = typeof icon === 'string' && /^\.\/svg\/[a-zA-Z0-9_-]+\.svg$/.test(icon) ? icon : undefined;
    broadcastSettingChange(-1, 'notification:show', { title, body, icon: safeIcon, type: 'workspace' });
  });

  onTrusted('window:enable-mouse-passthrough', () => {
    withWindow((win) => {
      win.setIgnoreMouseEvents(true, { forward: true });
    });
  });

  onTrusted('window:disable-mouse-passthrough', () => {
    if (mousePassthroughLocked) return;
    withWindow((win) => {
      win.setIgnoreMouseEvents(false);
    });
  });

  onTrusted('window:expand', () => {
    withWindow((win) => {
      const centerX = getEffectiveCenterX(win);
      win.setBounds({
        x: Math.round(centerX - options.sizes.expandedWidth / 2),
        y: getEffectiveY(win),
        width: options.sizes.expandedWidth,
        height: getHeight(options.sizes.expandedHeight, PILL_EXPANDED_HEIGHT),
      });
    });
  });

  onTrusted('window:expand-notification', () => {
    withWindow((win) => {
      const centerX = getEffectiveCenterX(win);
      win.setBounds({
        x: Math.round(centerX - options.sizes.notificationWidth / 2),
        y: getEffectiveY(win),
        width: options.sizes.notificationWidth,
        height: getHeight(options.sizes.notificationHeight, PILL_NOTIFICATION_HEIGHT),
      });
    });
  });

  onTrusted('window:expand-lyrics', () => {
    withWindow((win) => {
      const centerX = getEffectiveCenterX(win);
      win.setBounds({
        x: Math.round(centerX - options.sizes.lyricsWidth / 2),
        y: getEffectiveY(win),
        width: options.sizes.lyricsWidth,
        height: getHeight(options.sizes.lyricsHeight, PILL_LYRICS_HEIGHT),
      });
    });
  });

  onTrusted('window:expand-lyrics-translation', () => {
    withWindow((win) => {
      const centerX = getEffectiveCenterX(win);
      win.setBounds({
        x: Math.round(centerX - options.sizes.lyricsWidth / 2),
        y: getEffectiveY(win),
        width: options.sizes.lyricsWidth,
        height: getHeight(options.sizes.lyricsTranslationHeight, PILL_LYRICS_TRANSLATION_HEIGHT),
      });
    });
  });

  onTrusted('window:expand-full', () => {
    withWindow((win) => {
      const centerX = getEffectiveCenterX(win);
      win.setBounds({
        x: Math.round(centerX - options.sizes.expandedFullWidth / 2),
        y: getEffectiveY(win),
        width: options.sizes.expandedFullWidth,
        height: getHeight(options.sizes.expandedFullHeight, PILL_EXPANDED_FULL_HEIGHT),
      });
    });
  });

  onTrusted('window:expand-settings', () => {
    withWindow((win) => {
      const centerX = getEffectiveCenterX(win);
      win.setBounds({
        x: Math.round(centerX - options.sizes.settingsWidth / 2),
        y: getEffectiveY(win),
        width: options.sizes.settingsWidth,
        height: getHeight(options.sizes.settingsHeight, PILL_SETTINGS_HEIGHT),
      });
    });
  });

  onTrusted('window:collapse', () => {
    withWindow((win) => {
      const centerX = getEffectiveCenterX(win);
      win.setBounds({
        x: Math.round(centerX - options.sizes.islandWidth / 2),
        y: getEffectiveY(win),
        width: options.sizes.islandWidth,
        height: getHeight(options.sizes.islandHeight, PILL_ISLAND_HEIGHT),
      });
    });
  });

  onTrusted('window:hide', () => {
    withWindow((win) => {
      options.setHiddenByAutoHideProcess(false);
      win.hide();
    });
  });

  handleTrusted('window:get-mouse-position', () => {
    const point = screen.getCursorScreenPoint();
    return { x: point.x, y: point.y };
  });

  onTrusted('window:move-delta', (_event, dx: number, dy: number) => {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    withWindow((win) => {
      const bounds = win.getBounds();
      // 水平方向钳制在工作区内；垂直方向保留用户拖动，但同样不许移出工作区。
      const area = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y }).workArea;
      const clampedX = clampCenterToWorkArea(win);
      const nextY = Math.round(Math.min(Math.max(bounds.y + dy, area.y), area.y + area.height - bounds.height));
      win.setBounds({
        x: clampedX,
        y: nextY,
        width: bounds.width,
        height: bounds.height,
      });
    });
  });

  onTrusted('window:move-end', () => {
    withWindow((win) => {
      // 拖动结束后把当前位置折算成偏移量持久化，重启后小岛留在用户放的地方。
      const bounds = win.getBounds();
      const shapeMode = readIslandShapeModeConfig();
      const area = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y }).workArea;
      const baseY = shapeMode === 'pill' ? area.y + 46 : area.y;
      const baseX = Math.round(area.x + (area.width - options.sizes.islandWidth) / 2);
      const offset = options.sanitizeIslandPositionOffset({
        x: bounds.x + bounds.width / 2 - (baseX + options.sizes.islandWidth / 2),
        y: bounds.y - baseY,
      });
      options.applyIslandPositionOffset(offset);
      options.writeIslandPositionOffsetConfig(offset);
    });
  });

  handleTrusted('window:get-bounds', () => {
    const win = options.getMainWindow();
    if (win && !win.isDestroyed()) {
      return win.getBounds();
    }
    return null;
  });

  // 合并鼠标位置 + 窗口边界为单次 IPC：rAF 高频轮询时避免每帧 2 次往返
  handleTrusted('window:is-mouse-in-window', () => {
    const win = options.getMainWindow();
    if (!win || win.isDestroyed()) return false;
    const point = screen.getCursorScreenPoint();
    const bounds = win.getBounds();
    return (
      point.x >= bounds.x
      && point.x <= bounds.x + bounds.width
      && point.y >= bounds.y
      && point.y <= bounds.y + bounds.height
    );
  });

  handleTrusted('window:island-displays:list', () => {
    const primaryId = screen.getPrimaryDisplay().id;
    return screen.getAllDisplays().map((display) => ({
      id: String(display.id),
      width: display.workArea.width,
      height: display.workArea.height,
      isPrimary: display.id === primaryId,
    }));
  });

  handleTrusted('window:island-display:get', () => {
    return options.getIslandDisplaySelection();
  });

  handleTrusted('window:island-display:set', (event, selection: unknown) => {
    const nextSelection = options.sanitizeIslandDisplaySelection(selection);
    options.setIslandDisplaySelection(nextSelection);
    const result = options.writeIslandDisplaySelectionConfig(nextSelection);
    broadcastSettingChange(event.sender.id, 'island:display', nextSelection);
    return result;
  });

  handleTrusted('window:island-position:get', () => {
    return { ...options.getIslandPositionOffset() };
  });

  handleTrusted('window:island-position:set', (event, offset: { x?: number; y?: number }) => {
    const nextOffset = options.sanitizeIslandPositionOffset(offset);
    options.applyIslandPositionOffset(nextOffset);
    const result = options.writeIslandPositionOffsetConfig(nextOffset);
    broadcastSettingChange(event.sender.id, 'island:position', nextOffset);
    return result;
  });
}
