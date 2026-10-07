/*
 * 灵屿 Lingyu - 免费开源的 Windows 桌面灵动岛（基于 eIsland 二次开发）
 * https://github.com/TryWorld2026/Lingyu
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 * Original author: JNTMTMTM (https://github.com/JNTMTMTM)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3, or (at your option) any later version.
 */

/**
 * @file useUrlFavoritesPersistence.ts
 * @description URL 收藏持久化 hook：跨窗口原子保存、localStorage 镜像、标题自动解析、焦点恢复。
 * @author 灵屿
 */

import { useEffect, useRef } from 'react';
import { fetchWebsiteTitle } from '../../../../../../api/site/siteMetaApi';
import { STORE_KEY, FOCUS_KEY } from '../config/urlFavoritesConfig';
import type { UrlFavoriteItem } from '../types/urlFavoritesTypes';
import { normalizeUrl, sanitizeFavorites, readLegacyFavorites, mirrorFavoritesLocally } from '../utils/urlFavoritesUtils';
import { useStoredList } from '../../../../../hooks/useStoredList';

/** useUrlFavoritesPersistence 返回值 */
export interface UseUrlFavoritesPersistenceReturn {
  favorites: UrlFavoriteItem[];
  setFavorites: React.Dispatch<React.SetStateAction<UrlFavoriteItem[]>>;
  loaded: boolean;
}

/**
 * URL 收藏持久化 hook
 * @description 收藏列表由 useStoredList 走 store:update-list 的条目级合并：通知窗口与工作台
 *   窗口都能新增收藏，整表覆盖会互相冲掉，合并后只保留各自的条目。store 文件不存在时读
 *   localStorage 旧缓存并原子迁入。
 * @param onExpand - 展开某项回调（焦点恢复用）
 * @param onFocused - 设置焦点回调（焦点恢复用）
 * @returns favorites、setFavorites、loaded
 */
export function useUrlFavoritesPersistence(
  onExpand: (item: UrlFavoriteItem) => void,
  onFocused: (id: number) => void,
): UseUrlFavoritesPersistenceReturn {
  const { items: favorites, setItems: setFavorites, loaded } =
    useStoredList<UrlFavoriteItem>(STORE_KEY, sanitizeFavorites, readLegacyFavorites);
  const titleResolvingIdsRef = useRef<Set<number>>(new Set());

  /* 镜像到 localStorage：保留离线缓存，并作为 store 缺失时的迁移来源 */
  useEffect(() => {
    if (!loaded) return;
    mirrorFavoritesLocally(favorites);
  }, [favorites, loaded]);

  /* 标题自动解析：获取缺少标题的收藏项 */
  useEffect(() => {
    if (!loaded || favorites.length === 0) return;

    const pendingItems = favorites.filter((item) => {
      const hasResolvedTitle = item.title.trim() && item.title.trim() !== item.url;
      return !hasResolvedTitle && !titleResolvingIdsRef.current.has(item.id);
    });

    if (pendingItems.length === 0) return;

    pendingItems.forEach((item) => {
      titleResolvingIdsRef.current.add(item.id);
      fetchWebsiteTitle(item.url)
        .then((title) => {
          const nextTitle = title.trim();
          if (!nextTitle) return;
          setFavorites((prev) => prev.map((row) => (
            row.id === item.id
              ? { ...row, title: nextTitle }
              : row
          )));
        })
        .finally(() => {
          titleResolvingIdsRef.current.delete(item.id);
        });
    });
  }, [favorites, loaded, setFavorites]);

  /* 焦点恢复：从 localStorage 读取焦点 URL 并滚动到对应项 */
  useEffect(() => {
    if (!loaded || favorites.length === 0) return;
    let targetUrl = '';
    try {
      const raw = localStorage.getItem(FOCUS_KEY) ?? '';
      targetUrl = normalizeUrl(raw);
    } catch {
      targetUrl = '';
    }

    if (!targetUrl) return;

    const matched = favorites.find((item) => item.url.toLowerCase() === targetUrl.toLowerCase());
    if (!matched) return;

    onExpand(matched);
    onFocused(matched.id);

    try {
      localStorage.removeItem(FOCUS_KEY);
    } catch { /* noop */ }

    window.requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-url-favorite-id="${matched.id}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [loaded, favorites, onExpand, onFocused]);

  return { favorites, setFavorites, loaded };
}
