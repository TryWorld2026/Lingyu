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
 * @file fullscreen_core.c
 * @description 全屏检测器核心实现
 * @description 使用 Win32 API 和 DWM 实现全屏窗口的枚举与检测逻辑
 * @author 灵屿
 */

#include "fullscreen_types.h"
#include <dwmapi.h>
#include <stdlib.h>
#include <string.h>

/*
 * 获取窗口矩形。
 * 注意：不使用 DwmGetWindowAttribute(DWMWA_EXTENDED_FRAME_BOUNDS) ——
 * 它返回物理像素，而 GetMonitorInfoW 返回逻辑像素，非 100% DPI 缩放下
 * 两者混用会导致全屏判定永远失败。GetWindowRect 与 GetMonitorInfoW
 * 处于同一坐标系（均受进程 DPI 感知影响），可直接比较。
 * 最大化窗口的 -8px 溢出由 is_candidate_window 中的 IsZoomed 排除兜底。
 */
static BOOL get_window_bounds(HWND hwnd, RECT* bounds) {
  return GetWindowRect(hwnd, bounds);
}

LONG rect_width(const RECT* rect) {
  return rect->right - rect->left;
}

LONG rect_height(const RECT* rect) {
  return rect->bottom - rect->top;
}

static BOOL is_rect_close_to_monitor(const RECT* window_rect, const RECT* monitor_rect) {
  return abs(window_rect->left - monitor_rect->left) <= FULLSCREEN_TOLERANCE_PX &&
    abs(window_rect->top - monitor_rect->top) <= FULLSCREEN_TOLERANCE_PX &&
    abs(window_rect->right - monitor_rect->right) <= FULLSCREEN_TOLERANCE_PX &&
    abs(window_rect->bottom - monitor_rect->bottom) <= FULLSCREEN_TOLERANCE_PX;
}

static BOOL is_candidate_window(HWND hwnd) {
  LONG_PTR style;
  LONG_PTR ex_style;

  if (!IsWindow(hwnd) || !IsWindowVisible(hwnd) || IsIconic(hwnd)) {
    return FALSE;
  }

  style = GetWindowLongPtrW(hwnd, GWL_STYLE);
  ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);

  if ((style & WS_DISABLED) != 0) {
    return FALSE;
  }

  if ((ex_style & WS_EX_TOOLWINDOW) != 0) {
    return FALSE;
  }

  /*
   * 排除普通最大化窗口：最大化状态且保留标准窗口装饰（标题栏/可调边框）
   * 的窗口是用户日常使用的普通窗口，任务栏自动隐藏时其矩形与显示器完全
   * 重合，仅凭矩形判定会被误判为全屏，导致灵动岛被错误隐藏。
   * 真正的全屏窗口（游戏/视频/浏览器 F11）均为无边框 WS_POPUP，
   * 不含 WS_CAPTION/WS_THICKFRAME，不受影响。
   * 权衡：漏判（真全屏未被识别）代价小，误判（普通窗口被隐藏）代价大。
   */
  if (IsZoomed(hwnd) && (style & (WS_CAPTION | WS_THICKFRAME)) != 0) {
    return FALSE;
  }

  return TRUE;
}

BOOL get_fullscreen_info(HWND hwnd, FullscreenWindowInfo* info) {
  RECT bounds;
  HMONITOR monitor;
  MONITORINFO monitor_info;

  if (!is_candidate_window(hwnd)) {
    return FALSE;
  }

  if (!get_window_bounds(hwnd, &bounds)) {
    return FALSE;
  }

  if (rect_width(&bounds) <= 0 || rect_height(&bounds) <= 0) {
    return FALSE;
  }

  monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
  if (monitor == NULL) {
    return FALSE;
  }

  memset(&monitor_info, 0, sizeof(monitor_info));
  monitor_info.cbSize = sizeof(monitor_info);
  if (!GetMonitorInfoW(monitor, &monitor_info)) {
    return FALSE;
  }

  if (!is_rect_close_to_monitor(&bounds, &monitor_info.rcMonitor)) {
    return FALSE;
  }

  memset(info, 0, sizeof(*info));
  info->hwnd = hwnd;
  info->bounds = bounds;
  info->monitor_info = monitor_info;
  GetWindowThreadProcessId(hwnd, &info->process_id);
  GetWindowTextW(hwnd, info->title, TITLE_BUFFER_LENGTH);
  return TRUE;
}

static BOOL append_window(WindowList* list, const FullscreenWindowInfo* info) {
  FullscreenWindowInfo* next_items;
  size_t next_capacity;

  if (list->length == list->capacity) {
    next_capacity = list->capacity == 0 ? 8 : list->capacity * 2;
    next_items = (FullscreenWindowInfo*)realloc(list->items, next_capacity * sizeof(FullscreenWindowInfo));
    if (next_items == NULL) {
      return FALSE;
    }
    list->items = next_items;
    list->capacity = next_capacity;
  }

  list->items[list->length] = *info;
  list->length += 1;
  return TRUE;
}

BOOL CALLBACK enum_windows_callback(HWND hwnd, LPARAM lparam) {
  WindowList* list = (WindowList*)lparam;
  FullscreenWindowInfo info;

  if (get_fullscreen_info(hwnd, &info)) {
    if (!append_window(list, &info)) {
      return FALSE;
    }
  }

  return TRUE;
}
