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
 * @file system.ts
 * @description 预加载脚本系统工具相关类型定义（蓝牙 / WiFi）
 * @author 灵屿
 */

/** 蓝牙设备信息 */
export interface BluetoothDeviceInfo {
  /** 设备 ID（Windows DeviceInformation ID） */
  deviceId: string;
  /** 设备友好名称 */
  name: string | null;
  /** 蓝牙地址（MAC，十六进制字符串） */
  bluetoothAddress: string | null;
  /** 是否已连接 */
  isConnected: boolean;
  /** 是否已配对 */
  isPaired: boolean;
  /** 信号强度 (RSSI dBm)，不可用时为 null */
  signalStrength: number | null;
  /** 设备类别（CoD） */
  deviceClass: number | null;
  /** 外观类别（BLE Appearance） */
  appearance: number | null;
  /** 设备支持的 GATT 服务 UUID 列表 */
  serviceUuids: string[];
  /** 设备类型（如 "HID"、"Watch"、"Headphones"、"Speaker"） */
  deviceType: string | null;
  /** 电池电量百分比 (0–100)，仅 BLE 设备可用，不可用时为 null */
  batteryLevel: number | null;
}

/** 网络连接级别枚举 */
export enum ConnectivityLevel {
  /** 无连接 */
  None = 0,
  /** 仅本地访问 */
  LocalAccess = 1,
  /** 受限互联网访问 */
  ConstrainedInternetAccess = 2,
  /** 完全互联网访问 */
  InternetAccess = 3,
}

/** WiFi 连接状态信息 */
export interface WifiInfo {
  /** 是否已连接 WiFi */
  isConnected: boolean;
  /** WiFi 网络名称 (SSID)，未连接时为 null */
  ssid: string | null;
  /** 信号强度 (0-5 bars)，-1 表示不可用 */
  signalBars: number;
  /** 网络连接级别 */
  connectivityLevel: ConnectivityLevel;
  /** 适配器 ID，无 WiFi 适配器时为 null */
  adapterName: string | null;
  /** 是否为 WiFi 适配器（IANA type 71） */
  isWifiAdapter: boolean;
}
