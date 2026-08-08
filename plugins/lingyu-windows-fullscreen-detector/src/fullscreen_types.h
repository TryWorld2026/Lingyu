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
 * @file fullscreen_types.h
 * @description 全屏检测器公共类型定义
 * @description 包含全屏窗口信息结构体及检测配置参数
 * @author 灵屿
 */

#ifndef FULLSCREEN_TYPES_H
#define FULLSCREEN_TYPES_H

#include <windows.h>
#include <stddef.h>

// 容差 8px：兼容无边框游戏在 DPI 缩放下与显示器边界的 1-8px 偏差，
// 同时普通窗口最大化（通常完全贴边，偏差 0-1px）不会被误判
#define FULLSCREEN_TOLERANCE_PX 8
#define TITLE_BUFFER_LENGTH 512

typedef struct FullscreenWindowInfo {
  HWND hwnd;
  DWORD process_id;
  RECT bounds;
  MONITORINFO monitor_info;
  WCHAR title[TITLE_BUFFER_LENGTH];
} FullscreenWindowInfo;

typedef struct WindowList {
  FullscreenWindowInfo* items;
  size_t length;
  size_t capacity;
} WindowList;

/* fullscreen_core.c */
LONG rect_width(const RECT* rect);
LONG rect_height(const RECT* rect);
BOOL get_fullscreen_info(HWND hwnd, FullscreenWindowInfo* info);
BOOL CALLBACK enum_windows_callback(HWND hwnd, LPARAM lparam);

#endif
