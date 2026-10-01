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
 * @file StandaloneWindow.tsx
 * @description Lingyu 独立桌面工作台：品牌侧栏、AI 对话与桌面工具。
 * @author 灵屿
 */

import { useEffect, useMemo } from 'react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { StandaloneWindowBackground } from './components/StandaloneWindowBackground';
import { StandaloneWindowChrome } from './components/StandaloneWindowChrome';
import { StandaloneWindowViewport } from './components/StandaloneWindowViewport';
import { useStandaloneWindowShell } from './hooks/useStandaloneWindowShell';
import { TAB_LIST } from './config/standaloneWindowConfig';
import useIslandStore from '../store/slices';
import { WorkspaceSidebar } from './components/WorkspaceSidebar';
import { SvgIcon } from '../utils/SvgIcon';
import windowIcon from '../public/svg/lingyu-mark.svg';
import { useNavLayout } from './states/maxExpand/hooks/useNavLayout';
import { emptyNotification } from '../store/constants/defaults';
import { useIslandNowPlayingSync } from './hooks/useIslandNowPlayingSync';

const TAB_ICONS = {
  ai: SvgIcon.AI, focus: SvgIcon.POMODORO, music: SvgIcon.MUSIC, system: SvgIcon.DIY, performance: SvgIcon.TASK_MANAGER,
  todo: SvgIcon.CHECKED, memo: SvgIcon.MEMO, shelf: SvgIcon.ATTACHMENT,
  countdown: SvgIcon.TIMER, urlFavorites: SvgIcon.BOOKMARK, album: SvgIcon.PHOTO_ALBUM,
  localFileSearch: SvgIcon.SEARCH, clipboardHistory: SvgIcon.COPY, alarm: SvgIcon.NOTIFICATION,
  settings: SvgIcon.SETTING,
};

/**
 * 独立窗口根组件
 * @description 提供独立于浮动胶囊的可调整大小桌面工作台。
 */
export function StandaloneWindow(): ReactElement {
  const { t } = useTranslation();
  useIslandNowPlayingSync(useIslandStore.getState());
  const state = useIslandStore((s) => s.state);
  const notification = useIslandStore((s) => s.notification);
  useEffect(() => {
    document.documentElement.dataset.lingyuSurface = 'workspace';
    return () => { delete document.documentElement.dataset.lingyuSurface; };
  }, []);
  useEffect(() => {
    if (!notification.title) return;
    const timeout = setTimeout(() => useIslandStore.setState({ notification: emptyNotification }), 6000);
    return () => clearTimeout(timeout);
  }, [notification]);
  const {
    activeTab,
    switchTab,
    bgMedia,
    bgVideoFit,
    bgVideoMuted,
    bgVideoVolume,
    bgVideoHwDecode,
    bgVideoElementRef,
    bgImageOpacity,
    bgImageBlur,
    standaloneMacControls,
    handleVideoLoadedMetadata,
    handleVideoCanPlay,
  } = useStandaloneWindowShell();
  const { navLayoutConfig, navLayoutLoaded } = useNavLayout();
  const visibleTabs = useMemo(() => [
    ...navLayoutConfig.filter((item) => item.visible).flatMap((item) => {
      const tab = TAB_LIST.find((candidate) => candidate.key === item.id);
      return tab ? [tab] : [];
    }), TAB_LIST.find((tab) => tab.key === 'settings')!,
  ], [navLayoutConfig]);
  useEffect(() => {
    if (navLayoutLoaded && !visibleTabs.some((tab) => tab.key === activeTab)) switchTab(visibleTabs[0].key);
  }, [navLayoutLoaded, visibleTabs, activeTab, switchTab]);

  return (
    <div className="cw-root">
      <StandaloneWindowBackground
        bgMedia={bgMedia}
        bgImageOpacity={bgImageOpacity}
        bgImageBlur={bgImageBlur}
        bgVideoHwDecode={bgVideoHwDecode}
        bgVideoElementRef={bgVideoElementRef}
        bgVideoMuted={bgVideoMuted}
        bgVideoVolume={bgVideoVolume}
        bgVideoFit={bgVideoFit}
        onVideoLoadedMetadata={handleVideoLoadedMetadata}
        onVideoCanPlay={handleVideoCanPlay}
      />
      <StandaloneWindowChrome
        windowIcon={windowIcon}
        title={t(TAB_LIST.find((tab) => tab.key === activeTab)?.labelKey || 'ai.title')}
        standaloneMacControls={standaloneMacControls}
        t={t}
      />

      <div className="cw-workspace workspace-layout">
        <WorkspaceSidebar activeTab={activeTab}
          tabs={visibleTabs.map((tab) => ({ id: tab.key, label: t(tab.labelKey), icon: TAB_ICONS[tab.key] }))}
          onSelect={switchTab} />
        <StandaloneWindowViewport activeTab={activeTab} state={state} />
      </div>
      {notification.title && <div className="workspace-toast" role="status">
        <div><strong>{notification.title}</strong><p>{notification.body}</p></div>
        <button type="button" aria-label={t('workspace.dismissNotification')} onClick={() => useIslandStore.setState({ notification: emptyNotification })}><span aria-hidden="true">×</span></button>
      </div>}
    </div>
  );
}
