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
 * @file HoverForm.tsx
 * @description Hover 状态表单组件
 * @author 灵屿
 */

import type { ReactElement } from 'react';
import type { useHover } from '../hooks/useHover';
import { NAV_DOTS } from '../config/hoverConfig';
import { TimeTab } from '../pages/time';
import { LyricsTab } from '../pages/lyric';
import { WeatherTab } from '../pages/weather';

type HoverFormProps = ReturnType<typeof useHover>;

/** Hover 状态表单组件 */
export function HoverForm(props: HoverFormProps): ReactElement {
  const {
    fullTimeStr,
    lunarStr,
    t,
    hoverTab,
    setHoverTab,
    setExpanded,
    contentRef,
    getDotLabel,
  } = props;

  return (
    <div className="hover-content" ref={contentRef}>
      <div className="hover-nav-current">
        <button
          type="button"
          className="hover-nav-current-label"
          onClick={(e) => {
            e.stopPropagation();
            if (hoverTab === 'expand') { setExpanded(); return; }
            const idx = NAV_DOTS.findIndex((d) => d === hoverTab);
            const next = NAV_DOTS[(idx + 1) % (NAV_DOTS.length - 1)]; // 排除 expand，循环 time/lyrics/weather
            setHoverTab(next);
          }}
          title={t('hover.nav.switchTip', { defaultValue: '点击切换页面' })}
          aria-label={t('hover.nav.switchToPage', { defaultValue: '切换到{{label}}页面', label: getDotLabel(hoverTab) })}
        >
          <span className="hover-nav-current-text">{getDotLabel(hoverTab)}</span>
          <span className="hover-nav-expand-icon" onClick={(e) => { e.stopPropagation(); setExpanded(); }} title={getDotLabel('expand')} aria-hidden="true">▸</span>
        </button>
      </div>

      <div className="hover-tab-content" onClick={(e) => e.stopPropagation()}>
        {hoverTab === 'time' && (
          <TimeTab
            fullTimeStr={fullTimeStr}
            lunarStr={lunarStr}
          />
        )}
        {hoverTab === 'lyrics' && <LyricsTab />}
        {hoverTab === 'weather' && <WeatherTab />}
      </div>
    </div>
  );
}
