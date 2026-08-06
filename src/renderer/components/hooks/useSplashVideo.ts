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
 * @file useSplashVideo.ts
 * @description 启动画面展示 Hook：品牌动画结束后通知主进程关闭启动画面
 * @author 灵屿
 */

import { useCallback, useEffect } from 'react';

/** 品牌动画展示时长（毫秒），结束后通知主进程关闭启动画面 */
const SPLASH_ANIM_DURATION_MS = 2600;

export function useSplashVideo() {
  const handleVideoEnded = useCallback(() => {
    window.electron.ipcRenderer.send('splash:video-ended');
  }, []);

  useEffect(() => {
    window.electron.ipcRenderer.send('splash:renderer-ready');
    const timer = setTimeout(() => {
      window.electron.ipcRenderer.send('splash:video-ended');
    }, SPLASH_ANIM_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  return { handleVideoEnded };
}
