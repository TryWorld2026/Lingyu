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
 * @file MaxExpandContentShell.tsx
 * @description MaxExpand 内容壳组件，承载导航、滚轮切换与通用加载态。
 * @author 灵屿
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../../store/slices';
import type { MaxExpandTab } from '../../../store/types';
import {
  getStartupMode,
  getStartupModeReady,
  isStartupModeResolved,
  type NavDotId,
} from './config/shellConstants';
import { useNavLayout } from './hooks/useNavLayout';
import { useTabAnimation } from './hooks/useTabAnimation';
import { useContentReady } from './hooks/useContentReady';
import { shouldIgnoreWheelEvent } from './hooks/useWheelNavigation';
import { getDefaultNavLabel } from './utils/getNavLabel';
import { SvgIcon } from '../../../utils/SvgIcon';
import { getAdjacentNavDotId } from './utils/tabNavigation';
import '../../../styles/settings/settings.css';

export interface MaxExpandContentShellProps {
  renderActiveTab: (activeTab: MaxExpandTab, loadingFallback: React.ReactElement, contentReady: boolean) => React.ReactElement | null;
  deferContent?: boolean;
}

/** 各导航 tab 对应的图标 */
const NAV_ICON_MAP: Partial<Record<NavDotId, string>> = {
  expanded: SvgIcon.RETURN,
  todo: SvgIcon.CHECKED,
  urlFavorites: SvgIcon.BOOKMARK,
  album: SvgIcon.PHOTO_ALBUM,
  localFileSearch: SvgIcon.SEARCH,
  clipboardHistory: SvgIcon.COPY,
  memo: SvgIcon.MEMO,
  countdown: SvgIcon.TIMER,
  alarm: SvgIcon.NOTIFICATION,
  shelf: SvgIcon.ATTACHMENT,
  settings: SvgIcon.SETTING,
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

/**
 * 渲染 MaxExpand 通用壳层，负责导航与内容切换控制。
 */
export function MaxExpandContentShell({ renderActiveTab, deferContent = true }: MaxExpandContentShellProps): React.ReactElement {
  const { t } = useTranslation();
  const { setExpanded, maxExpandTab: activeTab, setMaxExpandTab: setActiveTab } = useIslandStore();
  const contentRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const [slideDir, setSlideDir] = useState<'left' | 'right'>('right');
  const [startupMode, setStartupMode] = useState<'integrated' | 'standalone'>(isStartupModeResolved() ? getStartupMode() : 'integrated');
  const { navLayoutConfig, navLayoutLoaded } = useNavLayout();
  const tabAnimation = useTabAnimation();
  const contentReady = useContentReady(deferContent);

  useEffect(() => {
    let cancelled = false;
    getStartupModeReady().then(() => {
      if (!cancelled) setStartupMode(getStartupMode());
    });
    return () => { cancelled = true; };
  }, []);

  const NAV_DOTS: NavDotId[] = useMemo(() => {
    const visibleTabs = navLayoutConfig
      .filter((item: { visible: boolean }) => item.visible)
      .map((item: { id: string }) => item.id as NavDotId);
    return startupMode === 'standalone'
      ? ['expanded' as NavDotId, ...visibleTabs]
      : ['expanded' as NavDotId, ...visibleTabs, 'settings' as NavDotId];
  }, [navLayoutConfig, startupMode]);
  const navDotsRef = useRef(NAV_DOTS);
  navDotsRef.current = NAV_DOTS;

  useEffect(() => {
    // navLayout 异步加载完成前 NAV_DOTS 不含真实功能 tab（仅 expanded/settings），
    // 此时校正会把默认 tab（如 todo）误改为 settings；等加载完成后再校正。
    if (!navLayoutLoaded) return;

    if (startupMode === 'standalone' && NAV_DOTS.length === 1) {
      setExpanded();
      return;
    }

    const isVisible = NAV_DOTS.includes(activeTab);
    if (!isVisible && NAV_DOTS.length > 1) {
      setActiveTab(NAV_DOTS[1] as MaxExpandTab);
    }
  }, [NAV_DOTS, activeTab, navLayoutLoaded, setActiveTab, setExpanded, startupMode]);

  const filteredNavDots = useMemo(() => {
    const getNavLabel = (id: NavDotId): string => t(`maxExpand.nav.${id}`, {
      defaultValue: getDefaultNavLabel(id),
    });
    return NAV_DOTS.map((id) => ({ id, label: getNavLabel(id), icon: NAV_ICON_MAP[id] }));
  }, [t, NAV_DOTS]);
  const filteredNavDotsRef = useRef(filteredNavDots);
  filteredNavDotsRef.current = filteredNavDots;

  const navigateTab = useCallback((id: NavDotId): void => {
    if (id === 'expanded') { setExpanded(); return; }
    const dots = navDotsRef.current;
    const curIdx = dots.indexOf(activeTabRef.current);
    const nextIdx = dots.indexOf(id as NavDotId);
    setSlideDir(nextIdx >= curIdx ? 'right' : 'left');
    setActiveTab(id);
  }, [setExpanded, setActiveTab]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent): void => {
      const target = e.target as HTMLElement;
      if (shouldIgnoreWheelEvent(target)) return;
      e.preventDefault();

      const dots = filteredNavDotsRef.current;
      const cur = activeTabRef.current;
      const currentIndex = dots.findIndex(d => d.id === cur);
      let nextId: NavDotId;
      if (e.deltaY > 0) {
        nextId = dots[(currentIndex + 1) % dots.length].id;
      } else {
        nextId = dots[(currentIndex - 1 + dots.length) % dots.length].id;
      }
      navigateTab(nextId);
    };

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab' || e.repeat || e.defaultPrevented) return;
      if (isEditableTarget(e.target)) return;

      const tabIds = filteredNavDotsRef.current
        .map((dot) => dot.id)
        .filter((id): id is MaxExpandTab => id !== 'expanded');
      const nextId = getAdjacentNavDotId(tabIds, activeTabRef.current, e.shiftKey ? -1 : 1);
      if (nextId === null) return;

      e.preventDefault();
      navigateTab(nextId);
    };

    window.addEventListener('keydown', handleKeyDown);
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigateTab]);

  const handleNavClick = (id: NavDotId): void => {
    navigateTab(id);
  };

  const loadingFallback = (
    <div className="max-expand-tab-loading">
      <span className="max-expand-tab-loading-spinner" aria-hidden="true" />
      <span className="max-expand-tab-loading-text">
        {t('maxExpand.loading', { defaultValue: '正在加载最大展开界面...' })}
      </span>
    </div>
  );

  return (
    <div className="settings-content" ref={contentRef}>
      <div className="max-expand-tab-content" onClick={(e) => e.stopPropagation()}>
        <div className={`max-expand-tab-transition${tabAnimation ? ` max-expand-tab-slide-${slideDir}` : ''}`} key={activeTab}>
          {renderActiveTab(activeTab, loadingFallback, contentReady)}
        </div>
      </div>

      <div className="lingyu-nav-bar" onClick={(e) => e.stopPropagation()} style={navLayoutLoaded ? undefined : { visibility: 'hidden' }}>
        {filteredNavDots.map(({ id, label, icon }) => (
          <button
            key={id}
            className={`lingyu-nav-item ${activeTab === id ? 'active' : ''}`}
            onClick={() => handleNavClick(id)}
            title={label}
            aria-label={t('maxExpand.nav.switchTo', { defaultValue: '切换到{{label}}', label })}
          >
            {icon && <img className="lingyu-nav-icon" src={icon} alt="" draggable={false} />}
            <span className="lingyu-nav-label">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
