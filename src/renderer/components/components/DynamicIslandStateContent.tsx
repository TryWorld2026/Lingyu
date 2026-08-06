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
 * @file DynamicIslandStateContent.tsx
 * @description 灵动岛状态内容路由组件。
 * @author 灵屿
 */

import type { JSX } from 'react';
import type { NotificationData, WeatherData } from '../../store/types';
import { IdleContent } from '../states/idle';
import { HoverContent } from '../states/hover';
import { NotificationContent } from '../states/notification/NotificationContent';
import { ExpandedContent } from '../states/expand/ExpandedContent';
import { MaxExpandContent } from '../states/maxExpand/MaxExpandContent';
import { LyricsContent } from '../states/lyrics/LyricsContent';
import { LyricsTranslationContent } from '../states/lyricsTranslation/LyricsTranslationContent';
import { GuideContent } from '../states/guide/GuideContent';
import type { IslandState } from '../hooks/useDynamicIslandShell';

interface DynamicIslandStateContentProps {
  state: IslandState;
  timeStr: string;
  dayStr: string;
  weather: WeatherData;
  timerState: 'idle' | 'running' | 'paused';
  remainingSeconds: number;
  pomodoroRunning: boolean;
  pomodoroRemaining: number;
  fullTimeStr: string;
  lunarStr: string;
  notification: NotificationData;
}

/**
 * @description 根据当前状态渲染对应的内容组件。
 * @param props - 状态内容渲染参数。
 * @returns 对应状态的内容节点；无匹配时返回 null。
 */
export function DynamicIslandStateContent({
  state,
  timeStr,
  dayStr,
  weather,
  timerState,
  remainingSeconds,
  pomodoroRunning,
  pomodoroRemaining,
  fullTimeStr,
  lunarStr,
  notification,
}: DynamicIslandStateContentProps): JSX.Element | null {
  if (state === 'idle') {
    return (
      <IdleContent
        timeStr={timeStr}
        dayStr={dayStr}
        weather={weather}
        timerState={timerState}
        remainingSeconds={remainingSeconds}
        pomodoroRunning={pomodoroRunning}
        pomodoroRemaining={pomodoroRemaining}
      />
    );
  }

  if (state === 'hover') {
    return (
      <HoverContent
        fullTimeStr={fullTimeStr}
        lunarStr={lunarStr}
      />
    );
  }

  if (state === 'expanded') return <ExpandedContent />;

  if (state === 'notification') {
    return (
      <NotificationContent
        title={notification.title}
        body={notification.body}
        icon={notification.icon}
        type={notification.type}
        sourceAppId={notification.sourceAppId}
        updateVersion={notification.updateVersion}
        updateSourceLabel={notification.updateSourceLabel}
        weatherAlertTime={notification.weatherAlertTime}
        startupUpdateSource={notification.startupUpdateSource}
        startupUpdateResolvedUrl={notification.startupUpdateResolvedUrl}
        urls={notification.urls}
        breakReminderItemId={notification.breakReminderItemId}
      />
    );
  }

  if (state === 'maxExpand') return <MaxExpandContent />;
  if (state === 'lyrics') return <LyricsContent />;
  if (state === 'lyricsTranslation') return <LyricsTranslationContent />;
  if (state === 'guide') return <GuideContent />;

  return null;
}
