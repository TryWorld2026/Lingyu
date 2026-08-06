/*
 * eIsland - A sleek, Apple Dynamic Island inspired floating widget for Windows, built with Electron.
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
 * @file MaxExpandContentLazy.tsx
 * @description MaxExpand 性能模式懒加载内容实现。
 * @author 鸡哥
 */

import { Suspense, lazy } from 'react';
import type { ReactElement } from 'react';
import type { MaxExpandTab } from '../../../store/types';
import { MaxExpandContentShell } from './MaxExpandContentShell';

const TodoTab = lazy(() => import('./components/todo/components/TodoTab').then((module) => ({ default: module.TodoTab })));
const UrlFavoritesTab = lazy(() => import('./components/urlFavorites').then((module) => ({ default: module.UrlFavoritesTab })));
const LocalFileSearchTab = lazy(() => import('./components/localFileSearch/components/LocalFileSearchTab').then((module) => ({ default: module.LocalFileSearchTab })));
const ClipboardHistoryTab = lazy(() => import('./components/clipBoardHistory').then((module) => ({ default: module.ClipboardHistoryTab })));
const AlbumTab = lazy(() => import('./components/album/components/AlbumTab').then((module) => ({ default: module.AlbumTab })));
const SettingsTab = lazy(() => import('./components/SettingsTab').then((module) => ({ default: module.SettingsTab })));
const CountdownTab = lazy(() => import('./components/countdown').then((module) => ({ default: module.CountdownTab })));
const MemoTab = lazy(() => import('./components/memo/components/MemoTab').then((module) => ({ default: module.MemoTab })));
const AlarmTab = lazy(() => import('./components/alarm/components/AlarmTab').then((module) => ({ default: module.AlarmTab })));
const ToolboxTab = lazy(() => import('./components/ToolboxTab').then((module) => ({ default: module.ToolboxTab })));
const ShelfTab = lazy(() => import('./components/shelf/components/ShelfTab').then((module) => ({ default: module.ShelfTab })));

function renderLazyActiveTab(activeTab: MaxExpandTab, loadingFallback: ReactElement, contentReady: boolean): ReactElement | null {
  if (!contentReady) return loadingFallback;
  let content: ReactElement | null = null;
  if (activeTab === 'todo') content = <TodoTab />;
  if (activeTab === 'urlFavorites') content = <UrlFavoritesTab />;
  if (activeTab === 'localFileSearch') content = <LocalFileSearchTab />;
  if (activeTab === 'clipboardHistory') content = <ClipboardHistoryTab />;
  if (activeTab === 'album') content = <AlbumTab />;
  if (activeTab === 'memo') content = <MemoTab />;
  if (activeTab === 'countdown') content = <CountdownTab />;
  if (activeTab === 'alarm') content = <AlarmTab />;
  if (activeTab === 'toolbox') content = <ToolboxTab />;
  if (activeTab === 'shelf') content = <ShelfTab />;
  if (activeTab === 'settings') content = <SettingsTab />;
  return <Suspense fallback={loadingFallback}>{content}</Suspense>;
}

/**
 * 渲染 MaxExpand 的懒加载内容（性能模式）。
 */
export function MaxExpandContentLazy(): ReactElement {
  return <MaxExpandContentShell renderActiveTab={renderLazyActiveTab} />;
}
