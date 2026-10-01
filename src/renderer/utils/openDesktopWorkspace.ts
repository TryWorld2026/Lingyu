/*
 * Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026 · GPL-3.0-or-later
 */
/**
 * @file openDesktopWorkspace.ts
 * @description 先保存目标页，再打开受信任的独立工作台窗口。
 * @author 灵屿
 */

import { ACTIVE_TAB_STORE_KEY, type WindowTab } from '../components/config/standaloneWindowConfig';

/** @param tab - 工作台目标页。 @returns 是否成功打开窗口。 */
export async function openDesktopWorkspace(tab: WindowTab): Promise<boolean> {
  const saved = await window.api.storeWrite(ACTIVE_TAB_STORE_KEY, tab);
  if (!saved) return false;
  return window.api.openStandaloneWindow();
}
