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
 * @file WifiServiceToolSection.tsx
 * @description 工具箱 WiFi 服务模块（连接状态与信号强度）
 * @author 灵屿
 */

import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ConnectivityLevel, type WifiInfo } from '../../../../../../../preload/types';

/**
 * WiFi 服务模块主视图
 * @description 展示当前 WiFi 连接状态、SSID 与信号强度
 * @returns WiFi 状态面板元素
 */
export function WifiServiceToolSection(): ReactElement {
  const { t } = useTranslation();
  const [info, setInfo] = useState<WifiInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadWifiInfo = useCallback(async (): Promise<void> => {
    setLoading(true);
    setErrorMessage('');
    try {
      setInfo(await window.api.getWifiInfo());
    } catch {
      setErrorMessage(t('maxExpand.toolbox.wifiService.error'));
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadWifiInfo();
  }, [loadWifiInfo]);

  const connectivityLabel = (level: ConnectivityLevel | undefined): string => {
    switch (level) {
      case ConnectivityLevel.InternetAccess:
        return t('maxExpand.toolbox.wifiService.level.internet');
      case ConnectivityLevel.ConstrainedInternetAccess:
        return t('maxExpand.toolbox.wifiService.level.constrained');
      case ConnectivityLevel.LocalAccess:
        return t('maxExpand.toolbox.wifiService.level.local');
      case ConnectivityLevel.None:
        return t('maxExpand.toolbox.wifiService.level.none');
      default:
        return '-';
    }
  };

  const signalBars = (bars: number | undefined): number => {
    if (typeof bars !== 'number' || bars < 0) return 0;
    return Math.min(5, Math.floor(bars));
  };

  return (
    <div className="settings-cards">
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-title">{t('maxExpand.toolbox.wifiService.title')}</div>
          <div className="settings-card-subtitle">{t('maxExpand.toolbox.wifiService.subtitle')}</div>
        </div>
        <div className="settings-card-body">
          <div className="bt-service-toolbar">
            <span className="bt-service-count">
              {info?.isConnected
                ? t('maxExpand.toolbox.wifiService.connected')
                : t('maxExpand.toolbox.wifiService.notConnected')}
            </span>
            <button
              className="ipinfo-btn ipinfo-btn-query"
              type="button"
              disabled={loading}
              onClick={loadWifiInfo}
            >
              {loading
                ? t('maxExpand.toolbox.wifiService.loading')
                : t('maxExpand.toolbox.wifiService.refresh')}
            </button>
          </div>

          {errorMessage && <div className="ipinfo-error">{errorMessage}</div>}

          {!loading && !errorMessage && info === null && (
            <div className="settings-music-hint">{t('maxExpand.toolbox.wifiService.noAdapter')}</div>
          )}

          {!loading && !errorMessage && info !== null && (
            <div className="wifi-info-card">
              <div className="wifi-info-item">
                <span className="ipinfo-result-label">{t('maxExpand.toolbox.wifiService.ssid')}</span>
                <span className="ipinfo-result-value">{info.ssid || t('maxExpand.toolbox.wifiService.ssidNone')}</span>
              </div>
              <div className="wifi-info-item">
                <span className="ipinfo-result-label">{t('maxExpand.toolbox.wifiService.signal')}</span>
                <span className="wifi-info-value">
                  <span className="wifi-signal-bars" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, index) => (
                      <span key={index} className={`wifi-signal-bar ${index < signalBars(info.signalBars) ? 'on' : ''}`} />
                    ))}
                  </span>
                  <span className="ipinfo-result-value">{info.signalBars >= 0 ? `${info.signalBars}/5` : '-'}</span>
                </span>
              </div>
              <div className="wifi-info-item">
                <span className="ipinfo-result-label">{t('maxExpand.toolbox.wifiService.levelLabel')}</span>
                <span className="ipinfo-result-value">{connectivityLabel(info.connectivityLevel)}</span>
              </div>
              <div className="wifi-info-item">
                <span className="ipinfo-result-label">{t('maxExpand.toolbox.wifiService.adapter')}</span>
                <span className="ipinfo-result-value">{info.adapterName || '-'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
