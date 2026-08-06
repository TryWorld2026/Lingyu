/*
 * 灵屿 Lingyu - 免费开源的 Windows 桌面灵动岛（基于 eIsland 二次开发）
 * https://github.com/JNTMTMTM/eIsland
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 *
 * Original author: JNTMTMTM
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @file useBatteryStatus.ts
 * @description 电池电量状态 Hook：低频轮询电量与充电状态，供 idle 态显示电量胶囊
 * @author 灵屿
 */

import { useCallback, useEffect, useState } from 'react';

export interface BatteryStatus {
  percent: number;
  isCharging: boolean;
  hasBattery: boolean;
}

const POLL_INTERVAL_MS = 30000;

/**
 * 订阅电池状态（桌面设备通常无电池时返回 null，自动隐藏）
 * @returns 电池状态与手动刷新函数
 */
export function useBatteryStatus(): { battery: BatteryStatus | null; refresh: () => void } {
  const [battery, setBattery] = useState<BatteryStatus | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const data = await window.api.systemBatteryGet();
      if (!data || data.hasBattery === false) {
        setBattery(null);
        return;
      }
      setBattery({ percent: data.percent, isCharging: data.isCharging, hasBattery: true });
    } catch {
      setBattery(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { battery, refresh };
}
