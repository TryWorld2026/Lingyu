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
 * @file BreakReminderSettingsPage.tsx
 * @description 设置页面 - 软件设置/休息提醒子界面
 * @author 灵屿
 */

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { SvgIcon } from '../../../../../../../../utils/SvgIcon';
import { useStoredList } from '../../../../../../../hooks/useStoredList';
import { BREAK_REMINDER_LIST_KEY, type BreakReminderItem } from './breakReminder/breakReminderConfig';
import { nextBreakReminderId, sanitizeBreakReminderItems } from './breakReminder/breakReminderUtils';

const BREAK_REMINDER_ICON_OPTIONS: { key: string; src: string }[] = [
  { key: 'PROLONGED_SITTING', src: SvgIcon.PROLONGED_SITTING },
  { key: 'DRINKING_WATER', src: SvgIcon.DRINKING_WATER },
];

function getDefaultReminders(t: (key: string, opts?: Record<string, string>) => string): BreakReminderItem[] {
  // 默认两条的 id 也要互不相同：旧实现靠随机后缀区分，现在用递增分配。
  const sedentary: BreakReminderItem = { id: 0, name: t('settings.breakReminder.defaultSedentary', { defaultValue: '起来动动' }), intervalMinutes: 30, enabled: true, icon: SvgIcon.PROLONGED_SITTING };
  const hydration: BreakReminderItem = { id: 0, name: t('settings.breakReminder.defaultHydration', { defaultValue: '喝水' }), intervalMinutes: 60, enabled: true, icon: SvgIcon.DRINKING_WATER };
  sedentary.id = nextBreakReminderId([]);
  hydration.id = nextBreakReminderId([sedentary]);
  return [
    sedentary,
    hydration,
  ];
}

/**
 * 渲染软件设置中的休息提醒配置区块
 * @returns 休息提醒配置区块
 */
export function BreakReminderSettingsPage(): ReactElement {
  const { t } = useTranslation();
  // 小岛调度器也会写这个列表且分属不同窗口，必须走原子合并而不是整表覆盖。
  const { items, setItems, loaded } = useStoredList<BreakReminderItem>(BREAK_REMINDER_LIST_KEY, sanitizeBreakReminderItems);
  const [openPickerId, setOpenPickerId] = useState<number | null>(null);

  /** 首次进入且列表为空时写入默认提醒，避免用户面对空页面 */
  useEffect(() => {
    if (!loaded || items.length > 0) return;
    setItems(getDefaultReminders(t));
  }, [loaded, items.length, setItems, t]);

  const handleAdd = (): void => {
    setItems(prev => [...prev, { id: nextBreakReminderId(prev), name: '', intervalMinutes: 30, enabled: true, icon: SvgIcon.PROLONGED_SITTING }]);
  };

  const handleDelete = (id: number): void => {
    setItems(prev => prev.filter((item) => item.id !== id));
  };

  const handleChange = (id: number, field: keyof BreakReminderItem, value: string | number | boolean): void => {
    setItems(prev => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleResetDefaults = (): void => {
    setItems(getDefaultReminders(t));
  };

  if (!loaded) return <div className="max-expand-settings-section" />;

  return (
    <div className="max-expand-settings-section">
      <div className="settings-cards">
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title">{t('settings.breakReminder.listTitle', { defaultValue: '提醒事项' })}</div>
            <div className="settings-card-subtitle">{t('settings.breakReminder.listHint', { defaultValue: '开启后，到达设定的间隔时间将弹出休息提醒通知。' })}</div>
          </div>

          <div className="settings-card-inline-row">
            <button type="button" className="settings-lyrics-source-btn active" onClick={handleAdd}>
              {t('settings.breakReminder.addBtn', { defaultValue: '新建提醒' })}
            </button>
            <button type="button" className="settings-lyrics-source-btn" onClick={handleResetDefaults}>
              {t('settings.breakReminder.resetBtn', { defaultValue: '恢复默认' })}
            </button>
          </div>

          {items.length === 0 ? (
            <div className="settings-card-subtitle" style={{ textAlign: 'center', padding: '12px 0' }}>
              {t('settings.breakReminder.emptyHint', { defaultValue: '暂无提醒事项，点击上方按钮新建。' })}
            </div>
          ) : (
            <div className="break-reminder-list">
              {items.map((item) => (
                <div key={item.id} className="break-reminder-item">
                  <div className="break-reminder-row">
                    <button
                      type="button"
                      className="break-reminder-icon-current"
                      onClick={() => setOpenPickerId(openPickerId === item.id ? null : item.id)}
                    >
                      <img src={item.icon || SvgIcon.BREAK} alt="" width={18} height={18} className="break-reminder-icon-img" />
                    </button>
                    <input
                      className="break-reminder-name"
                      type="text"
                      value={item.name}
                      placeholder={t('settings.breakReminder.nameLabel', { defaultValue: '提醒名称' })}
                      onChange={(e) => handleChange(item.id, 'name', e.target.value)}
                    />
                    <input
                      className="break-reminder-interval"
                      type="number"
                      min={1}
                      max={1440}
                      value={item.intervalMinutes}
                      title={t('settings.breakReminder.intervalLabel', { defaultValue: '间隔（分钟）' })}
                      onChange={(e) => {
                        const v = Math.max(1, Math.min(1440, Math.round(Number(e.target.value) || 1)));
                        handleChange(item.id, 'intervalMinutes', v);
                      }}
                    />
                    <span className="break-reminder-unit">min</span>
                    <label className="break-reminder-capsule">
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={(e) => handleChange(item.id, 'enabled', e.target.checked)}
                      />
                      <span className="break-reminder-capsule-track" />
                    </label>
                    <button
                      type="button"
                      className="break-reminder-delete"
                      title={t('settings.breakReminder.deleteBtn', { defaultValue: '删除' })}
                      onClick={() => handleDelete(item.id)}
                    >
                      <img src={SvgIcon.DELETE} alt="" width={14} height={14} className="break-reminder-icon-img" />
                    </button>
                  </div>
                  <div className={`break-reminder-icon-dropdown-wrap${openPickerId === item.id ? ' open' : ''}`}>
                    <div className="break-reminder-icon-dropdown">
                      {BREAK_REMINDER_ICON_OPTIONS.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          className={`break-reminder-icon-btn${item.icon === opt.src ? ' active' : ''}`}
                          onClick={() => { handleChange(item.id, 'icon', opt.src); setOpenPickerId(null); }}
                        >
                          <img src={opt.src} alt="" width={20} height={20} className="break-reminder-icon-img" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
