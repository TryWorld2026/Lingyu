/*
 * Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026 · GPL-3.0-or-later
 */
/**
 * @file FocusTab.tsx
 * @description 全新的专注工作台，组合真实番茄钟和可编辑待办。
 * @author 灵屿
 */

import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { PomodoroWidget } from '../../../expand/components/OverviewTab/components/widgets/PomodoroWidget';
import { TodoTab } from '../todo/components/TodoTab';
import { ShelfTab } from '../shelf/components/ShelfTab';

/** @returns 可暂停、重置和跳过阶段的专注时钟及今日待办。 */
export function FocusTab(): ReactElement {
  const { t } = useTranslation();
  return (
    <section className="lingyu-focus" aria-label={t('focus.title')}>
      <header className="lingyu-focus-heading"><p>{t('focus.eyebrow')}</p><h1>{t('focus.title')}</h1><p>{t('focus.hint')}</p></header>
      <div className="lingyu-focus-panels">
        <div className="lingyu-focus-timer"><PomodoroWidget /></div>
        <div className="lingyu-focus-tasks"><TodoTab /></div>
        <div className="lingyu-focus-shelf"><ShelfTab /></div>
      </div>
    </section>
  );
}
