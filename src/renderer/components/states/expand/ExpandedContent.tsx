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
 * @file ExpandedContent.tsx
 * @description Expanded 状态内容组件，单击灵动岛后展开的快捷操作面板
 * @author 灵屿
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../../store/slices';
import type { ExpandTab, MaxExpandTab } from '../../../store/types';
import '../../../styles/expanded/expanded.css';
import { OverviewTab } from './components/OverviewTab';
import { PerformanceMonitorTab } from './components/PerformanceMonitorTab';
import { SongTab } from './components/SongTab';
import { ToolsTab } from './components/ToolsTab';
import { getStartupMode, getStartupModeReady, isStartupModeResolved } from '../maxExpand/config/shellConstants';
import type { NavDotId } from './config/types';
import { useExpandNavLayout } from './hooks/useExpandNavLayout';
import { useExpandTabAnimation } from './hooks/useExpandTabAnimation';
import { useExpandWheelNav } from './hooks/useExpandWheelNav';
import { getNavLabel } from './utils/getNavLabel';
import { SvgIcon } from '../../../utils/SvgIcon';

/**
 * Expanded 状态内容组件
 * @description 扩展状态下的完整功能面板，底部正中间导航点切换 Tab
 */
export function ExpandedContent(): React.ReactElement {
  const { t } = useTranslation();
  const { expandTab, setExpandTab, setHover, setMaxExpand, maxExpandTab, setMaxExpandTab } = useIslandStore();
  const contentRef = useRef<HTMLDivElement>(null);
  const expandTabRef = useRef(expandTab);
  expandTabRef.current = expandTab;

  const [slideDir, setSlideDir] = useState<'left' | 'right'>('right');
  const [startupMode, setStartupMode] = useState<'integrated' | 'standalone'>(isStartupModeResolved() ? getStartupMode() : 'integrated');

  const { navLayoutConfig, maxExpandNavLayoutConfig, preloadEagerWhenPerformanceModeDisabled } = useExpandNavLayout();
  const tabAnimation = useExpandTabAnimation();

  /** 各导航 tab 对应的图标 */
const NAV_ICON_MAP: Partial<Record<NavDotId, string>> = {
  hover: SvgIcon.RETURN,
  overview: SvgIcon.LAYOUT,
  song: SvgIcon.MUSIC,
  tools: SvgIcon.DIY,
  performanceMonitor: SvgIcon.TASK_MANAGER,
  maxExpand: SvgIcon.EXPAND,
};

const firstVisibleMaxExpandTab = maxExpandNavLayoutConfig.find((item) => item.visible)?.id as MaxExpandTab | undefined;
  const hasAvailableMaxExpandTab = startupMode === 'standalone'
    ? firstVisibleMaxExpandTab !== undefined
    : true;

  useEffect(() => {
    let cancelled = false;
    getStartupModeReady().then(() => {
      if (!cancelled) setStartupMode(getStartupMode());
    });
    return () => { cancelled = true; };
  }, []);

  const NAV_DOTS: NavDotId[] = useMemo(() => {
    const visibleTabs = navLayoutConfig
      .filter((item) => item.visible)
      .map((item) => item.id as ExpandTab);
    const maxExpandDots = hasAvailableMaxExpandTab ? ['maxExpand' as NavDotId] : [];
    return ['hover' as ExpandTab, ...visibleTabs, ...maxExpandDots];
  }, [hasAvailableMaxExpandTab, navLayoutConfig]);

  const navDotsRef = useRef(NAV_DOTS);
  navDotsRef.current = NAV_DOTS;

  const handleSetMaxExpand = useCallback((): void => {
    if (!hasAvailableMaxExpandTab) return;
    const targetMaxExpandTab = firstVisibleMaxExpandTab ?? 'settings';
    if (!targetMaxExpandTab) return;
    const activeTabVisible = maxExpandTab === 'settings'
      ? startupMode !== 'standalone'
      : maxExpandNavLayoutConfig.some((item) => item.id === maxExpandTab && item.visible);
    if (!activeTabVisible) {
      setMaxExpandTab(targetMaxExpandTab);
    }
    preloadEagerWhenPerformanceModeDisabled();
    setMaxExpand();
  }, [firstVisibleMaxExpandTab, hasAvailableMaxExpandTab, maxExpandNavLayoutConfig, maxExpandTab, preloadEagerWhenPerformanceModeDisabled, setMaxExpand, setMaxExpandTab, startupMode]);

  useEffect(() => {
    const visibleExpandTabs = NAV_DOTS.filter((tab): tab is ExpandTab => tab !== 'hover' && tab !== 'maxExpand');
    const isVisible = NAV_DOTS.includes(expandTab);
    if (!isVisible && visibleExpandTabs.length > 0) {
      setExpandTab(visibleExpandTabs[0]);
    }
  }, [NAV_DOTS, expandTab, setExpandTab]);

  useExpandWheelNav({
    contentRef,
    expandTabRef,
    navDotsRef,
    setExpandTab,
    setHover,
    handleSetMaxExpand,
    setSlideDir,
  });

  return (
    <div className="expanded-content" ref={contentRef}>
      {/* Tab 内容区域 */}
      <div className="expand-tab-content" onClick={(e) => e.stopPropagation()}>
        <div className={`expand-tab-transition${tabAnimation ? ` expand-tab-slide-${slideDir}` : ''}`} key={expandTab}>
          {expandTab === 'overview' && <OverviewTab />}
          {expandTab === 'song' && <SongTab />}
          {expandTab === 'tools' && <ToolsTab />}
          {expandTab === 'performanceMonitor' && <PerformanceMonitorTab />}
        </div>
      </div>

      {/* 底部导航标签条 */}
      <div className="lingyu-nav-bar" onClick={(e) => e.stopPropagation()}>
        {NAV_DOTS.map((tab) => (
          <button
            key={tab}
            className={`lingyu-nav-item ${expandTab === tab ? 'active' : ''}`}
            onClick={() => {
              if (tab === 'hover') { setHover(); }
              else if (tab === 'maxExpand') { handleSetMaxExpand(); }
              else {
                const curIdx = navDotsRef.current.indexOf(expandTabRef.current);
                const nextIdx = navDotsRef.current.indexOf(tab);
                setSlideDir(nextIdx >= curIdx ? 'right' : 'left');
                setExpandTab(tab);
              }
            }}
            title={getNavLabel(tab, t)}
            aria-label={t('expanded.nav.switchToPage', { defaultValue: '切换到{{label}}页面', label: getNavLabel(tab, t) })}
          >
            {NAV_ICON_MAP[tab] && <img className="lingyu-nav-icon" src={NAV_ICON_MAP[tab]} alt="" draggable={false} />}
            <span className="lingyu-nav-label">{getNavLabel(tab, t)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
