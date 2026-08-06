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
 * @file useSplashFadeOut.ts
 * @description 启动画面淡出状态 Hook，监听主进程淡出指令
 * @author 灵屿
 */

import { useEffect, useState } from 'react';

/** 启动画面淡出状态 Hook */
export function useSplashFadeOut() {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const removeListener = window.electron.ipcRenderer.on('splash:fade-out', () => {
      setFadeOut(true);
    });
    return removeListener;
  }, []);

  return { fadeOut };
}
