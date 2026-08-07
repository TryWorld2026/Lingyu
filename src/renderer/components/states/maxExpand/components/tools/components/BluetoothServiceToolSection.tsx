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
 * @file BluetoothServiceToolSection.tsx
 * @description 工具箱蓝牙服务模块（已配对设备列表与连接状态）
 * @author 灵屿
 */

import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { BluetoothDeviceInfo } from '../../../../../../../preload/types';

/**
 * 蓝牙服务模块主视图
 * @description 展示已配对蓝牙设备列表、连接状态与电池电量
 * @returns 蓝牙设备面板元素
 */
export function BluetoothServiceToolSection(): ReactElement {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<BluetoothDeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadDevices = useCallback(async (): Promise<void> => {
    setLoading(true);
    setErrorMessage('');
    try {
      const list = await window.api.getBluetoothDevices();
      setDevices(Array.isArray(list) ? list : []);
    } catch {
      setErrorMessage(t('maxExpand.toolbox.bluetoothService.error'));
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  return (
    <div className="settings-cards">
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-title">{t('maxExpand.toolbox.bluetoothService.title')}</div>
          <div className="settings-card-subtitle">{t('maxExpand.toolbox.bluetoothService.subtitle')}</div>
        </div>
        <div className="settings-card-body">
          <div className="bt-service-toolbar">
            <span className="bt-service-count">
              {t('maxExpand.toolbox.bluetoothService.count', { count: devices.length })}
            </span>
            <button
              className="ipinfo-btn ipinfo-btn-query"
              type="button"
              disabled={loading}
              onClick={loadDevices}
            >
              {loading
                ? t('maxExpand.toolbox.bluetoothService.loading')
                : t('maxExpand.toolbox.bluetoothService.refresh')}
            </button>
          </div>

          {errorMessage && <div className="ipinfo-error">{errorMessage}</div>}

          {!loading && !errorMessage && devices.length === 0 && (
            <div className="settings-music-hint">{t('maxExpand.toolbox.bluetoothService.empty')}</div>
          )}

          {devices.length > 0 && (
            <div className="bt-device-list">
              {devices.map((device) => (
                <div key={device.deviceId} className="bt-device-row">
                  <span className={`bt-device-status ${device.isConnected ? 'connected' : ''}`} aria-hidden="true" />
                  <span className="bt-device-name" title={device.deviceId}>
                    {device.name || device.bluetoothAddress || t('maxExpand.toolbox.bluetoothService.unknownDevice')}
                  </span>
                  {device.deviceType && <span className="bt-device-type">{device.deviceType}</span>}
                  {device.batteryLevel !== null && device.batteryLevel !== undefined && (
                    <span className="bt-device-battery">{t('maxExpand.toolbox.bluetoothService.battery', { percent: device.batteryLevel })}</span>
                  )}
                  <span className={`bt-device-state ${device.isConnected ? 'connected' : ''}`}>
                    {device.isConnected
                      ? t('maxExpand.toolbox.bluetoothService.connected')
                      : t('maxExpand.toolbox.bluetoothService.disconnected')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
