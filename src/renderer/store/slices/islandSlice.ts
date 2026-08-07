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
 * @file islandSlice.ts
 * @description 灵动岛 UI 状态相关逻辑
 * @author 灵屿
 */

import type { StateCreator } from 'zustand';
import type { IslandSlice } from '../types';
import { emptyNotification } from '../constants/defaults';
import { playNotificationSoundOnce } from '../../utils/audio/notificationSound';

export const createIslandSlice: StateCreator<
  IslandSlice,
  [],
  [],
  IslandSlice
> = (set, get) => ({
  state: 'idle',
  uiStateLocked: false,
  hoverTab: 'time',
  expandTab: 'overview',
  maxExpandTab: 'todo',
  notification: emptyNotification,
  springAnimation: true,
  animationSpeed: 'medium' as const,
  shapeMode: 'notch' as const,

  setIdle: (force?: boolean) => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'idle') return prev;
    if (!force && (prev.state === 'expanded' || prev.state === 'maxExpand' || prev.state === 'guide' )) return prev;
    window.api?.collapseWindow();
    window.api?.enableMousePassthrough();
    return { state: 'idle' as const };
  }),

  setHover: () => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'hover') return prev;
    window.api?.expandWindow();
    window.api?.disableMousePassthrough();
    return { state: 'hover' };
  }),

  setExpanded: () => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'expanded') return prev;
    window.api?.expandWindowFull();
    window.api?.disableMousePassthrough();
    return { state: 'expanded' };
  }),

  setMaxExpand: () => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'maxExpand') return prev;
    window.api?.expandWindowSettings();
    window.api?.disableMousePassthrough();
    return { state: 'maxExpand' };
  }),

  setLyrics: () => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'lyrics') return prev;
    window.api?.expandWindowLyrics();
    window.api?.enableMousePassthrough();
    return { state: 'lyrics' };
  }),

  setLyricsTranslation: () => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'lyricsTranslation') return prev;
    window.api?.expandWindowLyricsTranslation();
    window.api?.enableMousePassthrough();
    return { state: 'lyricsTranslation' };
  }),

  setNotification: (data) => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'notification') return prev;
    // 引导进行中不抢占：引导被通知打断会导致轻引导"闪没"
    if (prev.state === 'guide') return prev;
    // 用户在设置/展开面板操作时不因普通通知（音量/系统 Toast/剪贴板）被打断；
    // 仅更新/重启等关键通知允许打断
    const persistentTypes = new Set(['update-available', 'update-downloading', 'update-ready', 'restart-required', 'weather-alert-startup']);
    if ((prev.state === 'maxExpand' || prev.state === 'expanded') && !persistentTypes.has(data.type ?? '')) {
      return prev;
    }
    window.api?.expandWindowNotification();
    // 音量 HUD 等瞬时反馈不播通知音，避免调音量"叮叮叮"
    if (data.type !== 'volume-hud') {
      playNotificationSoundOnce();
    }
    return { state: 'notification', notification: data };
  }),

  setGuide: () => set((prev) => {
    // 用户显式重置引导时强制进入（UI 锁定状态下也允许，避免"重置引导"静默失败）
    window.api?.expandWindowSettings();
    window.api?.disableMousePassthrough();
    return { state: 'guide' as const, uiStateLocked: false };
  }),


  toggleUiStateLock: () => {
    const next = !get().uiStateLocked;
    set({ uiStateLocked: next });
    return next;
  },

  setHoverTab: (tab) => set({ hoverTab: tab }),
  setExpandTab: (tab) => set({ expandTab: tab }),
  setMaxExpandTab: (tab) => set({ maxExpandTab: tab }),
  setSpringAnimation: (enabled) => set({ springAnimation: enabled }),
  setAnimationSpeed: (speed) => set({ animationSpeed: speed }),
  setShapeMode: (mode) => set({ shapeMode: mode }),
});