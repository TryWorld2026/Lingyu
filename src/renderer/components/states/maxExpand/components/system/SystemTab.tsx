/*
 * Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026 · GPL-3.0-or-later
 */
/**
 * @file SystemTab.tsx
 * @description 工作台中的系统音量、屏幕亮度与应用快捷启动。
 * @author 灵屿
 */

import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { BrightnessControl } from '../../../hover/pages/time/components/BrightnessControl';
import { VolumeControl } from '../../../hover/pages/time/components/VolumeControl';
import { ToolsTab } from '../../../expand/components/ToolsTab';

/** @returns 复用受信任系统控制和应用启动能力的桌面工具页。 */
export function SystemTab(): ReactElement {
  const { t } = useTranslation();
  return (
    <section className="lingyu-system" aria-label={t('system.title')}>
      <header className="lingyu-system-heading"><h1>{t('system.title')}</h1><p>{t('system.hint')}</p></header>
      <div className="lingyu-system-controls"><VolumeControl /><BrightnessControl /></div>
      <ToolsTab />
    </section>
  );
}
