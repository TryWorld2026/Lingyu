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
 * @file useCountdownItems.ts
 * @description 倒数日条目管理 hook：加载、持久化、删除。
 * @author 灵屿
 */

import { useCallback } from 'react';
import { useStoredList } from '../../../../../hooks/useStoredList';
import { STORE_KEY } from '../config/countdownConfig';
import { normalizeImageSource } from '../utils/countdownUtils';
import type { CountdownItem, UseCountdownItemsReturn } from '../types/countdownTypes';

const normalizeItems = async (items: CountdownItem[]): Promise<CountdownItem[]> => Promise.all(items.map(async (item) => ({
  ...item,
  backgroundImage: await normalizeImageSource(item.backgroundImage),
})));

/** 管理倒数日条目的加载、持久化与删除 */
export function useCountdownItems(): UseCountdownItemsReturn & { removeItem: (id: number) => void } {
  const { items, setItems, loaded } = useStoredList<CountdownItem>(STORE_KEY, normalizeItems);

  /** 删除 */
  const removeItem = useCallback((id: number) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, [setItems]);

  return { items, setItems, loaded, removeItem };
}
