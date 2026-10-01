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
 * @file ExpandedContent.tsx
 * @description 新版胶囊只承载音乐与总览，复杂功能转入独立工作台。
 * @author 灵屿
 */

import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../../store/slices';
import { OverviewTab } from './components/OverviewTab';
import { DailyCapsule } from './components/DailyCapsule';
import { useExpandNavLayout } from './hooks/useExpandNavLayout';
import { SvgIcon } from '../../../utils/SvgIcon';
import '../../../styles/expanded/expanded.css';

/** @returns 紧凑胶囊面板与桌面工作台入口。 */
export function ExpandedContent(): ReactElement {
  const { t } = useTranslation();
  const { expandTab, setExpandTab, setHover, setMaxExpand, setMaxExpandTab } = useIslandStore();
  const { navLayoutConfig } = useExpandNavLayout();
  const visible = navLayoutConfig.filter((item) => item.visible && ['overview', 'song'].includes(item.id));
  useEffect(() => {
    if (!visible.some((item) => item.id === expandTab)) setExpandTab('overview');
  }, [expandTab, navLayoutConfig, setExpandTab]);
  const openWorkspace = (): void => { setMaxExpandTab('ai'); setMaxExpand(); };
  return <div className="expanded-content lingyu-capsule-expanded">
    <header className="lingyu-capsule-toolbar" onClick={(event) => event.stopPropagation()}>
      <div className="lingyu-capsule-brand"><img className="lingyu-brand-icon" src="./svg/lingyu-mark.svg" alt="" /><span>{t('workspace.brand')}</span></div>
      <nav aria-label={t('workspace.capsuleNavigation')}>
        {visible.map((tab) => <button className={'lingyu-capsule-tab' + (expandTab === tab.id ? ' active' : '')} key={tab.id} type="button"
          aria-pressed={expandTab === tab.id} onClick={() => setExpandTab(tab.id === 'song' ? 'song' : 'overview')}>{t(tab.id === 'song' ? 'expanded.nav.song' : 'expanded.nav.overview')}</button>)}
      </nav>
      <button className="lingyu-capsule-workspace" type="button" onClick={openWorkspace}><img className="workspace-icon" src={SvgIcon.EXPAND} alt="" />{t('workspace.desktop')}</button>
      <button className="lingyu-capsule-close" type="button" aria-label={t('workspace.collapse')} onClick={setHover}><span aria-hidden="true">−</span></button>
    </header>
    <div className="lingyu-capsule-body" onClick={(event) => event.stopPropagation()}>{expandTab === 'song' ? <DailyCapsule /> : <OverviewTab />}</div>
  </div>;
}
