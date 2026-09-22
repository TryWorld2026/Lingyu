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
 * @file capture.ts
 * @description 截图窗口专用 preload：以最小能力面桥接 capture.html/capture.js 与主进程
 * @description 截图窗口运行在 contextIsolation + sandbox 下，页面不接触 Node，
 *   仅通过本模块暴露的 window.captureApi 接收截图数据与回传框选结果
 * @author 灵屿
 */

import { contextBridge, ipcRenderer } from 'electron';

/** 主进程推送的截图数据（imageBytes 经结构化克隆后为 Uint8Array） */
export interface CaptureImagePayload {
  imageBytes: Uint8Array;
  virtualScreen: unknown;
  displays: unknown[];
  physicalScreen: unknown;
  scaleFactor: number;
  captureSource: string;
  visibleWindows: unknown;
}

/** 截图页可用的最小 API 面 */
const captureApi = {
  /** 订阅主进程推送的截图数据 */
  onCaptureImage: (cb: (data: CaptureImagePayload) => void): void => {
    ipcRenderer.on('capture-image', (_e, data) => cb(data as CaptureImagePayload));
  },
  /** 框选完成，回传 dataURL */
  complete: (dataURL: string): void => {
    ipcRenderer.send('capture-complete', { dataURL });
  },
  /** 保存截图，回传 dataURL */
  save: (dataURL: string): void => {
    ipcRenderer.send('capture-save', { dataURL });
  },
  /** 取消截图 */
  cancel: (): void => {
    ipcRenderer.send('capture-cancel');
  },
  /** 读取主进程 store 配置（如界面语言） */
  readStore: (key: string): Promise<unknown> => ipcRenderer.invoke('store:read', key),
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('captureApi', captureApi);
} else {
  // @ts-expect-error 全局暴露兼容非隔离上下文（理论上截图窗口始终开启隔离）
  window.captureApi = captureApi;
}
