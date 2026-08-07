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
 * @file DynamicIsland.tsx
 * @description 灵动岛主组件，使用状态模式管理 idle/hover/expanded 等状态
 * @author 灵屿
 */

import { useEffect, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../store/isLandStore';
import { DynamicIslandBackground } from './components/DynamicIslandBackground';
import { DynamicIslandStateContent } from './components/DynamicIslandStateContent';
import { useDynamicIslandCoordinator } from './hooks/useDynamicIslandCoordinator';

export type { IslandState } from './hooks/useDynamicIslandShell';
export { AI_CHAT_CLIPBOARD_URL_EVENT, getStateClassName, STATE_CONFIGS } from './config/dynamicIslandConfig';

/**
 * 灵动岛主组件
 * @description 使用状态模式管理不同状态的 UI 渲染
 */
function DynamicIsland(): JSX.Element {
  const { t, i18n } = useTranslation();
  // 只订阅 setGuide action（稳定引用，避免全量订阅 store 导致整个灵动岛树随任何状态变化重渲染）
  const setGuide = useIslandStore((s) => s.setGuide);

  // 监听"重置引导"事件：设置中触发后立即显示 5 页轻引导
  useEffect(() => {
    const unsub = window.api?.onGuideShow?.(() => {
      setGuide();
    });
    return () => {
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const {
    state,
    weather,
    timerData,
    notification,
    pomodoroRunning,
    pomodoroRemaining,
  } = store;

  const {
    handleIslandClick,
    shellClassName,
    shellStyle,
    timeStr,
    dayStr,
    fullTimeStr,
    lunarStr,
    bgMedia,
    bgVideoElementRef,
    bgVideoHwDecode,
    bgVideoMuted,
    bgVideoVolume,
    bgVideoFit,
    handleVideoLoadedMetadata,
    handleVideoCanPlay,
  } = useDynamicIslandCoordinator({
    store,
    t,
    language: i18n.resolvedLanguage,
  });

  return (
    <div
      className={shellClassName}
      onClick={handleIslandClick}
      style={shellStyle}
    >
      <DynamicIslandBackground
        bgMedia={bgMedia}
        bgVideoElementRef={bgVideoElementRef}
        bgVideoHwDecode={bgVideoHwDecode}
        bgVideoMuted={bgVideoMuted}
        bgVideoVolume={bgVideoVolume}
        bgVideoFit={bgVideoFit}
        onVideoLoadedMetadata={handleVideoLoadedMetadata}
        onVideoCanPlay={handleVideoCanPlay}
      />
      <DynamicIslandStateContent
        state={state}
        timeStr={timeStr}
        dayStr={dayStr}
        weather={weather}
        timerState={timerData?.state ?? 'idle'}
        remainingSeconds={timerData?.remainingSeconds ?? 0}
        pomodoroRunning={pomodoroRunning}
        pomodoroRemaining={pomodoroRemaining}
        fullTimeStr={fullTimeStr}
        lunarStr={lunarStr}
        notification={notification}
      />
    </div>
  );
}

export default DynamicIsland;
