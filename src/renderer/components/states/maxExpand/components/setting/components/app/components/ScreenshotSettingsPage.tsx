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
 * @file ScreenshotSettingsPage.tsx
 * @description 设置页面 - 软件设置截图设置子界面
 * @author 鸡哥
 */

import { useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SCREENSHOT_ENGINE_STORE_KEY,
} from '../../../config/settingsTabConfig';

/**
 * 翻译语言下拉选择器
 * @param options - 可选语言列表
 * @param value - 当前选中的语言代码
 * @param onChange - 语言变更回调
 */
/**
 * 渲染截图设置页面
 * @returns 截图设置页面
 */
export function ScreenshotSettingsPage(): ReactElement {
  const { t } = useTranslation();
  const [screenshotEngine, setScreenshotEngine] = useState<'plugin' | 'js'>('plugin');

  useEffect(() => {
    let cancelled = false;
    window.api.storeRead(SCREENSHOT_ENGINE_STORE_KEY).then((value) => {
      if (cancelled) return;
      setScreenshotEngine(value === 'js' ? 'js' : 'plugin');
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleScreenshotEngineChange = (engine: 'plugin' | 'js'): void => {
    setScreenshotEngine(engine);
    void window.api.storeWrite(SCREENSHOT_ENGINE_STORE_KEY, engine);
  };

  return (
    <div className="settings-screenshot-page-panel">
      <div className="settings-cards">
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title">
              {t('settings.app.screenshotSettings.engineTitle', { defaultValue: '截图引擎' })}
            </div>
            <div className="settings-card-subtitle">
              {t('settings.app.screenshotSettings.engineHint', { defaultValue: '选择截图使用的引擎。插件模式支持多显示器截图，JS 模式兼容性更好。' })}
            </div>
          </div>
          <div className="settings-card-inline-row">
            <label className="settings-card-check">
              <input
                type="radio"
                name="screenshot-engine"
                checked={screenshotEngine === 'plugin'}
                onChange={() => { handleScreenshotEngineChange('plugin'); }}
              />
              {t('settings.app.screenshotSettings.enginePlugin', { defaultValue: '插件模式' })}
            </label>
            <label className="settings-card-check">
              <input
                type="radio"
                name="screenshot-engine"
                checked={screenshotEngine === 'js'}
                onChange={() => { handleScreenshotEngineChange('js'); }}
              />
              {t('settings.app.screenshotSettings.engineJs', { defaultValue: 'JS 模式' })}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
