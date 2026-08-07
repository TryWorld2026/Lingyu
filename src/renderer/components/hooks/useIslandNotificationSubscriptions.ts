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
 * @file useIslandNotificationSubscriptions.ts
 * @description 灵动岛通知事件订阅 Hook。
 * @author 灵屿
 */

import { useEffect, useRef } from 'react';
import useIslandStore from '../../store/isLandStore';
import type { NotificationData } from '../../store/types';
import { SvgIcon } from '../../utils/SvgIcon';
import { fetchVersion, reportUpdateDownloadCount } from '../../api/update/versionApi';
import { getWebsiteFaviconUrl, getWebsiteHostname } from '../../api/site/siteMetaApi';
import { CLIPBOARD_URL_SUPPRESS_IN_FAVORITES_KEY, UPDATE_SOURCE_STORE_KEY, getUpdateSourceLabel } from '../config/dynamicIslandConfig';

interface UseIslandNotificationSubscriptionsOptions {
  language: string | undefined;
  t: (key: string, options?: Record<string, unknown>) => string;
  setNotificationRef: React.MutableRefObject<(data: NotificationData) => void>;
}

/**
 * @description 订阅更新、播放源与剪贴板通知事件。
 * @param options - 通知订阅配置。
 */
export function useIslandNotificationSubscriptions(options: UseIslandNotificationSubscriptionsOptions): void {
  const { language, t, setNotificationRef } = options;
  const updateNotifiedRef = useRef(false);

  useEffect(() => {
    const unsubSwitch = window.api?.onSourceSwitchRequest((data) => {
      setNotificationRef.current({
        title: t('notification.sourceSwitch.title', { defaultValue: '检测到其他播放源' }),
        body: `${data.title} - ${data.artist}（${data.sourceAppId}）`,
        icon: SvgIcon.MUSIC,
        type: 'source-switch',
        sourceAppId: data.sourceAppId,
      });
    });
    return () => {
      unsubSwitch?.();
    };
  }, [language, t, setNotificationRef]);

  useEffect(() => {
    const unsubAvailable = window.api?.onUpdaterAvailable?.((data) => {
      if (updateNotifiedRef.current) return;
      updateNotifiedRef.current = true;
      Promise.all([
        fetchVersion().catch(() => null),
        window.api?.storeRead?.(UPDATE_SOURCE_STORE_KEY).catch(() => null),
      ]).then(([info, source]) => {
        // 优先显示真实更新日志（releaseNotes），清洗 HTML 标签后截断为一行
        const rawNotes = data.releaseNotes ?? '';
        const cleanNotes = rawNotes
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const desc = cleanNotes || (info?.description ?? '').trim();
        const updateSourceLabel = getUpdateSourceLabel(source);
        setNotificationRef.current({
          title: t('notification.update.availableTitle', { defaultValue: '发现新版本' }),
          body: desc || t('notification.update.availableBody', { defaultValue: '是否立即下载？' }),
          icon: SvgIcon.UPDATE,
          type: 'update-available',
          updateVersion: data.version,
          updateSourceLabel,
        });
      });
    });
    return () => {
      unsubAvailable?.();
    };
  }, [language, t, setNotificationRef]);

  /** 启动自动检查：主进程发来请求后立即检查更新，无需用户点击。固定走 ghproxy 国内加速源，保证流畅 */
  useEffect(() => {
    const unsubAutoCheck = window.api?.onUpdaterStartupAutoCheckRequest?.(() => {
      window.api?.updaterCheck('ghproxy');
    });
    return () => {
      unsubAutoCheck?.();
    };
  }, []);

  useEffect(() => {
    const unsubUpdate = window.api?.onUpdaterDownloaded?.((data) => {
      reportUpdateDownloadCount(data.version).catch(() => {});
      setNotificationRef.current({
        title: t('notification.update.readyTitle', { defaultValue: '更新就绪' }),
        body: t('notification.update.readyBody', {
          defaultValue: '新版本 v{{version}} 已下载完成，是否立即安装？',
          version: data.version,
        }),
        icon: SvgIcon.UPDATE,
        type: 'update-ready',
        updateVersion: data.version,
      });
    });
    return () => {
      unsubUpdate?.();
    };
  }, [language, t, setNotificationRef]);


  useEffect(() => {
    const unsubClipboard = window.api?.onClipboardUrlsDetected?.(({ urls, title }) => {
      let suppressInFavorites = true;
      try {
        const raw = localStorage.getItem(CLIPBOARD_URL_SUPPRESS_IN_FAVORITES_KEY);
        if (raw === '0') suppressInFavorites = false;
        if (raw === '1') suppressInFavorites = true;
      } catch {
        // noop
      }

      const store = useIslandStore.getState();
      const isToolboxTab = store.state === 'maxExpand' && store.maxExpandTab === 'toolbox';
      const isSettingTab = store.state === 'maxExpand' && store.maxExpandTab === 'settings';
      if (isToolboxTab || isSettingTab) return;
      if (
        suppressInFavorites
        && store.state === 'maxExpand'
        && (store.maxExpandTab === 'urlFavorites' || store.maxExpandTab === 'clipboardHistory')
      ) return;

      const faviconUrl = getWebsiteFaviconUrl(urls[0]);
      const hostname = getWebsiteHostname(urls[0]);
      setNotificationRef.current({
        title: t('notification.clipboard.detectedTitle', { defaultValue: '检测到链接' }),
        body: title || hostname || urls[0],
        icon: faviconUrl || SvgIcon.LINK,
        type: 'clipboard-url',
        urls,
      });
    });
    return () => {
      unsubClipboard?.();
    };
  }, [language, t, setNotificationRef]);

  useEffect(() => {
    void window.api?.toastStart?.().catch(() => {});
    const unsubToast = window.api?.onSystemToast?.((data) => {
      if (!data || (!data.title && !data.body)) return;
      setNotificationRef.current({
        title: data.title || data.appName || t('notification.systemToast.title', { defaultValue: '系统通知' }),
        body: data.body || '',
        type: 'default',
      });
    });
    return () => {
      unsubToast?.();
      void window.api?.toastStop?.().catch(() => {});
    };
  }, [t, setNotificationRef]);

  useEffect(() => {
    // 音量 HUD 自动回落：音量停止变化 1.5s 后自动收起（否则音量条永久占住通知态）
    let volumeHudTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubVolume = window.api?.onSystemVolumeChanged?.((data) => {
      setNotificationRef.current({
        title: data.muted
          ? t('notification.volumeHud.muted', { defaultValue: '已静音' })
          : t('notification.volumeHud.title', { defaultValue: '音量' }),
        body: '',
        type: 'volume-hud',
        volume: data.volume,
        muted: data.muted,
      });
      // 连续调节音量时重置回落计时，停止后 1.5s 收起
      if (volumeHudTimer) clearTimeout(volumeHudTimer);
      volumeHudTimer = setTimeout(() => {
        volumeHudTimer = null;
        const store = useIslandStore.getState();
        if (store.state === 'notification' && store.notification?.type === 'volume-hud') {
          store.setIdle();
        }
      }, 1500);
    });
    return () => {
      unsubVolume?.();
      if (volumeHudTimer) clearTimeout(volumeHudTimer);
    };
  }, [t, setNotificationRef]);

  useEffect(() => {
    // 普通通知自动关闭：非持久类通知 6s 后自动回落 idle，避免通知永久驻留拦截鼠标。
    // 持久类（更新/重启/天气预警）需用户操作，不自动关闭。
    let autoDismissTimer: ReturnType<typeof setTimeout> | null = null;
    const persistentTypes = new Set(['update-available', 'update-downloading', 'update-ready', 'restart-required', 'weather-alert-startup', 'volume-hud']);
    const unsub = useIslandStore.subscribe((state, prev) => {
      // 进入 notification（或 notification 内 type 变化）时重排回落计时：
      // 持久通知驻留期间插入普通通知也必须能自动关闭，否则普通通知无限驻留。
      if (state.state !== 'notification') return;
      const prevType = prev.state === 'notification' ? prev.notification?.type : null;
      const curType = state.notification?.type ?? 'default';
      if (prevType === curType) return;
      if (persistentTypes.has(curType)) {
        // 持久类不自动关闭；若此前有挂起的普通通知计时器则取消（已被持久通知覆盖）
        if (autoDismissTimer) {
          clearTimeout(autoDismissTimer);
          autoDismissTimer = null;
        }
        return;
      }
      if (autoDismissTimer) clearTimeout(autoDismissTimer);
      autoDismissTimer = setTimeout(() => {
        autoDismissTimer = null;
        const store = useIslandStore.getState();
        if (store.state === 'notification' && !persistentTypes.has(store.notification?.type ?? '')) {
          store.setIdle();
        }
      }, 6000);
    });
    return () => {
      unsub?.();
      if (autoDismissTimer) clearTimeout(autoDismissTimer);
    };
  }, []);
}
