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
 * @file NotificationSettingsPage.tsx
 * @description 设置页面 - 软件设置通知子界面
 * @author 灵屿
 */

import { useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { NOTIFICATION_SOUND_ENABLED_STORE_KEY } from '../../../../../../../../utils/audio/notificationSound';
import { TOAST_LISTENER_ENABLED_STORE_KEY, resolveToastAccessPlan } from '../../../../../../../hooks/toastAccess';

/**
 * 渲染通知设置页面
 * @returns 通知设置页面
 */
export function NotificationSettingsPage(): ReactElement {
  const { t } = useTranslation();
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState<boolean>(true);
  const [toastListenerEnabled, setToastListenerEnabled] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    window.api.storeRead(NOTIFICATION_SOUND_ENABLED_STORE_KEY).then((value) => {
      if (cancelled) return;
      if (typeof value === 'boolean') setNotificationSoundEnabled(value);
    }).catch(() => {});
    window.api.storeRead(TOAST_LISTENER_ENABLED_STORE_KEY).then((value) => {
      if (cancelled) return;
      if (typeof value === 'boolean') setToastListenerEnabled(value);
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const handleChangeNotificationSoundEnabled = (next: boolean): void => {
    const prev = notificationSoundEnabled;
    setNotificationSoundEnabled(next);
    window.api.storeWrite(NOTIFICATION_SOUND_ENABLED_STORE_KEY, next).catch(() => {
      setNotificationSoundEnabled(prev);
    });
  };

  const handleChangeToastListenerEnabled = async (next: boolean): Promise<void> => {
    const prev = toastListenerEnabled;
    setToastListenerEnabled(next);
    try {
      if (next) {
        // 开启时复用授权决策流程：先查授权状态，需要则请求，denied 则不启动
        const status = await window.api?.toastGetAccessStatus?.() ?? '';
        const plan = resolveToastAccessPlan(status);
        if (plan.needRequest) {
          await window.api?.toastRequestAccess?.();
        }
        if (plan.shouldStart) {
          await window.api?.toastStart?.();
        } else {
          // denied：保持关闭并提示
          setToastListenerEnabled(false);
          await window.api?.storeWrite(TOAST_LISTENER_ENABLED_STORE_KEY, false).catch(() => {});
          return;
        }
      } else {
        await window.api?.toastStop?.();
      }
      await window.api?.storeWrite(TOAST_LISTENER_ENABLED_STORE_KEY, next).catch(() => {});
    } catch {
      setToastListenerEnabled(prev);
    }
  };

  return (
    <div className="max-expand-settings-section">
      <div className="settings-cards settings-notification-page-panel">
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title">{t('settings.notification.sound.title', { defaultValue: '通知音效' })}</div>
            <div className="settings-card-subtitle">{t('settings.notification.sound.hint', { defaultValue: '通知触发时播放一次提示音。' })}</div>
          </div>
          <div className="settings-card-inline-row">
            <label className="settings-card-check">
              <input
                type="checkbox"
                checked={notificationSoundEnabled}
                onChange={(e) => handleChangeNotificationSoundEnabled(e.target.checked)}
              />
              {t('settings.notification.sound.toggle', { defaultValue: '启用通知音效' })}
            </label>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title">{t('settings.notification.toast.title', { defaultValue: '系统通知接管' })}</div>
            <div className="settings-card-subtitle">{t('settings.notification.toast.hint', { defaultValue: '接管 Windows 应用通知，显示到灵动岛。开启后首次会请求系统授权。' })}</div>
          </div>
          <div className="settings-card-inline-row">
            <label className="settings-card-check">
              <input
                type="checkbox"
                checked={toastListenerEnabled}
                onChange={(e) => handleChangeToastListenerEnabled(e.target.checked)}
              />
              {t('settings.notification.toast.toggle', { defaultValue: '启用系统通知接管' })}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
