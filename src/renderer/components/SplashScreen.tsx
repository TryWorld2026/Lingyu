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
 * @file SplashScreen.tsx
 * @description 启动画面：品牌文字动画 + 波浪特效
 * @author 灵屿
 */

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useSplash } from './hooks/useSplash';
import { WaveEffect } from './components/DynamicIslandSharedWaveEffect';

/** 启动画面默认背景颜色 */
const DEFAULT_BG_COLOR = '#000000';

/** 启动画面组件 */
export function SplashScreen(): ReactElement {
  const { fadeOut } = useSplash();
  const [bgColor, setBgColor] = useState(DEFAULT_BG_COLOR);

  useEffect(() => {
    window.api.storeRead('splash-bg-color').then((v) => {
      if (typeof v === 'string') setBgColor(v);
    }).catch(() => {});
  }, []);

  return (
    <div
      className={`splash-container${fadeOut ? ' fade-out' : ''}`}
      style={{ background: bgColor }}
    >
      <WaveEffect />
      <div className="splash-brand">
        <span className="splash-brand-cn">灵屿</span>
        <span className="splash-brand-en">LINGYU</span>
      </div>
    </div>
  );
}
