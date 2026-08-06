/*
 * 灵屿 Lingyu - 免费开源的 Windows 桌面灵动岛（基于 Lingyu 二次开发）
 * https://github.com/JNTMTMTM/Lingyu
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

if (process.platform !== 'win32') {
  throw new Error('@lingyu/windows-screenshot-helper only supports Windows.');
}

const { callPng, callJson, getLastError } = require('./ffi-loader');

function capturePrimaryDisplayPng() {
  return callPng('sc_capture_primary_display_png');
}

function captureAllDisplaysPng() {
  return callPng('sc_capture_all_displays_png');
}

function getVisibleWindows() {
  return callJson('sc_get_visible_windows') || [];
}

module.exports = {
  capturePrimaryDisplayPng,
  captureAllDisplaysPng,
  getVisibleWindows,
  getLastError,
};