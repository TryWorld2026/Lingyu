/*
 * eIsland - A sleek, Apple Dynamic Island inspired floating widget for Windows, built with Electron.
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
 * @author 鸡哥
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
    window.api?.expandWindowNotification();
    playNotificationSoundOnce();
    return { state: 'notification', notification: data };
  }),

  setGuide: () => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'guide') return prev;
    window.api?.expandWindowSettings();
    window.api?.disableMousePassthrough();
    return { state: 'guide' as const };
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