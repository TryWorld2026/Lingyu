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
 * @file ToolboxTab.tsx
 * @description 最大展开模式工具箱 Tab
 * @author 鸡哥
 */

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../../../store/slices';
import { EncodingServiceToolSection } from './tools/components/EncodingServiceToolSection';
import { FileServiceToolSection } from './tools/components/FileServiceToolSection';
import { NetworkServiceToolSection } from './tools/components/NetworkServiceToolSection';
import { SoftwareToolSection } from './tools/components/SoftwareToolSection';
import { FormatFactoryToolSection } from './tools/components/FormatFactoryToolSection';
import type { FormatFactoryPageKey } from './tools/config/formatFactoryToolConfig';
import {
  DEFAULT_TOOLBOX_NAV_ORDER,
  TOOLBOX_HIDDEN_NAV_ORDER_STORE_KEY,
  TOOLBOX_NAV_CARD_MAP,
  TOOLBOX_NAV_CARDS,
  TOOLBOX_NAV_ORDER_STORE_KEY,
  type ToolboxIndexCardId,
  type ToolboxSidebarKey,
} from './tools/config/commonToolboxConfig';

const TOOLBOX_SIDEBAR_ITEMS: Array<{ key: ToolboxSidebarKey; labelKey: string; sidebarLabelKey?: string }> = [
  { key: 'index', labelKey: 'maxExpand.toolbox.sidebar.index' },
  { key: 'software', labelKey: 'maxExpand.toolbox.sidebar.software' },
  { key: 'fileService', labelKey: 'maxExpand.toolbox.sidebar.fileService' },
  { key: 'encodingService', labelKey: 'maxExpand.toolbox.sidebar.encodingService' },
  { key: 'networkService', labelKey: 'maxExpand.toolbox.sidebar.networkService' },
  { key: 'formatFactory', labelKey: 'maxExpand.toolbox.sidebar.formatFactory' },
];

/** 最大展开模式工具箱页面 */
export function ToolboxTab(): ReactElement {
  const { t, i18n } = useTranslation();
  const { setMaxExpandTab } = useIslandStore();
  const [activeSidebar, setActiveSidebar] = useState<ToolboxSidebarKey>('index');
  const [formatFactoryPage, setFormatFactoryPage] = useState<FormatFactoryPageKey>('image');
  const [navOrder, setNavOrder] = useState<ToolboxIndexCardId[]>(DEFAULT_TOOLBOX_NAV_ORDER);
  const [hiddenNavOrder, setHiddenNavOrder] = useState<ToolboxIndexCardId[]>([]);
  const [navEditMode, setNavEditMode] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const visibleCards = useMemo(() => {
    const seen = new Set<ToolboxIndexCardId>();
    return navOrder.reduce<typeof TOOLBOX_NAV_CARDS>((ordered, id) => {
      if (seen.has(id)) return ordered;
      const card = TOOLBOX_NAV_CARD_MAP.get(id);
      if (card) {
        ordered.push(card);
        seen.add(id);
      }
      return ordered;
    }, []);
  }, [navOrder]);

  const hiddenCards = useMemo(() => {
    const visibleSet = new Set(visibleCards.map((card) => card.id));
    const seen = new Set<ToolboxIndexCardId>();

    const fromHidden = hiddenNavOrder.reduce<typeof TOOLBOX_NAV_CARDS>((acc, id) => {
      if (seen.has(id) || visibleSet.has(id)) return acc;
      const card = TOOLBOX_NAV_CARD_MAP.get(id);
      if (card) {
        acc.push(card);
        seen.add(id);
      }
      return acc;
    }, []);

    const remaining = TOOLBOX_NAV_CARDS.filter((card) => !visibleSet.has(card.id) && !seen.has(card.id));
    return [...fromHidden, ...remaining];
  }, [hiddenNavOrder, visibleCards]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return TOOLBOX_NAV_CARDS
      .map((card) => {
        const localizedLabel = t(card.labelKey);
        const localizedDesc = t(card.descKey);
        return { ...card, localizedLabel, localizedDesc };
      })
      .filter((card) => card.localizedLabel.toLowerCase().includes(q) || card.localizedDesc.toLowerCase().includes(q));
  }, [searchQuery, i18n.language, t]);

  const persistToolboxNavConfig = (visibleOrder: ToolboxIndexCardId[], hiddenOrder: ToolboxIndexCardId[]): void => {
    window.api.storeWrite(TOOLBOX_NAV_ORDER_STORE_KEY, visibleOrder).catch(() => {});
    window.api.storeWrite(TOOLBOX_HIDDEN_NAV_ORDER_STORE_KEY, hiddenOrder).catch(() => {});
  };

  const resetToolboxNavConfig = (): void => {
    const nextVisible = [...DEFAULT_TOOLBOX_NAV_ORDER];
    const nextHidden: ToolboxIndexCardId[] = [];
    setNavOrder(nextVisible);
    setHiddenNavOrder(nextHidden);
    persistToolboxNavConfig(nextVisible, nextHidden);
  };

  const navigateByCard = (cardId: ToolboxIndexCardId): void => {
    const card = TOOLBOX_NAV_CARD_MAP.get(cardId);
    if (!card) return;
    setActiveSidebar(card.sidebar);
    if (card.formatFactoryPage) setFormatFactoryPage(card.formatFactoryPage);
  };

  useEffect(() => {
    let cancelled = false;
    window.api.storeRead(TOOLBOX_NAV_ORDER_STORE_KEY).then((savedVisible) => {
      if (cancelled) return;
      const visibleRaw = Array.isArray(savedVisible) ? savedVisible : [];
      window.api.storeRead(TOOLBOX_HIDDEN_NAV_ORDER_STORE_KEY).then((savedHidden) => {
        if (cancelled) return;
        const hiddenRaw = Array.isArray(savedHidden) ? savedHidden : [];
        const validVisible = visibleRaw
          .filter((id): id is ToolboxIndexCardId => typeof id === 'string' && TOOLBOX_NAV_CARD_MAP.has(id as ToolboxIndexCardId))
          .filter((id, idx, arr) => arr.indexOf(id) === idx);
        const mergedVisible = validVisible.length > 0
          ? [...validVisible, ...DEFAULT_TOOLBOX_NAV_ORDER.filter((id) => !validVisible.includes(id))]
          : [...DEFAULT_TOOLBOX_NAV_ORDER];
        const validHidden = hiddenRaw
          .filter((id): id is ToolboxIndexCardId => typeof id === 'string' && TOOLBOX_NAV_CARD_MAP.has(id as ToolboxIndexCardId))
          .filter((id, idx, arr) => arr.indexOf(id) === idx)
          .filter((id) => !mergedVisible.includes(id));
        setNavOrder(mergedVisible);
        setHiddenNavOrder(validHidden);
      }).catch(() => {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const formatFactoryPageLabel = activeSidebar === 'formatFactory'
    ? t(`maxExpand.toolbox.formatFactory.pages.${formatFactoryPage}`)
    : '';
  const activeSidebarItem = TOOLBOX_SIDEBAR_ITEMS.find((item) => item.key === activeSidebar);
  const handleSoftwareFeedbackNavigate = (): void => {
    setMaxExpandTab('settings');
    window.dispatchEvent(new CustomEvent('standalone-tab-switch', { detail: 'settings' }));
    window.dispatchEvent(new CustomEvent('settings-open-tab-intent', { detail: 'about-feedback' }));
  };

  return (
    <div className="max-expand-settings toolbox-tab-container">
      <div className="max-expand-settings-layout">
        <div className="max-expand-settings-sidebar">
          {TOOLBOX_SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`max-expand-settings-sidebar-item ${activeSidebar === item.key ? 'active' : ''}`}
              onClick={() => setActiveSidebar(item.key)}
              type="button"
            >
              <span className="sidebar-dot" />
              {item.sidebarLabelKey
                ? t(item.sidebarLabelKey, { defaultValue: t(item.labelKey) })
                : t(item.labelKey)}
            </button>
          ))}
        </div>

        <div className="max-expand-settings-panel settings-scrollbar-thin">
          {activeSidebar !== 'index' && (
            <div className="max-expand-settings-title toolbox-panel-title settings-app-title-line">
              <span>{activeSidebarItem ? t(activeSidebarItem.labelKey) : ''}</span>
              {activeSidebar === 'formatFactory' && formatFactoryPageLabel && (
                <span className="settings-app-title-sub">- {formatFactoryPageLabel}</span>
              )}
            </div>
          )}
          {activeSidebar === 'index' && (
            <div className="max-expand-settings-section settings-index-section">
              <div className="settings-index-header">
                <div className="max-expand-settings-title">
                  {t('maxExpand.toolbox.index.title')}
                  <button className="settings-nav-edit-btn" type="button" onClick={resetToolboxNavConfig}>
                    {t('maxExpand.toolbox.index.reset')}
                  </button>
                  <button
                    className={`settings-nav-edit-btn ${navEditMode ? 'active' : ''}`}
                    type="button"
                    onClick={() => {
                      if (navEditMode) {
                        persistToolboxNavConfig(navOrder, hiddenNavOrder);
                      }
                      setNavEditMode(!navEditMode);
                    }}
                  >
                    {navEditMode ? t('maxExpand.toolbox.index.done') : t('maxExpand.toolbox.index.edit')}
                  </button>
                  <div className="settings-index-search-wrap">
                    <span className="settings-index-search-icon" aria-hidden="true">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </span>
                    <input
                      className="settings-index-search-input"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('maxExpand.toolbox.index.searchPlaceholder')}
                    />
                    {searchQuery && (
                      <button
                        className="settings-index-search-clear"
                        type="button"
                        onClick={() => setSearchQuery('')}
                        aria-label={t('maxExpand.toolbox.index.searchClear')}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                    {searchResults && (
                      <div className="settings-index-search-dropdown">
                        {searchResults.length === 0 ? (
                          <div className="settings-index-search-dropdown-empty">{t('maxExpand.toolbox.index.searchEmpty')}</div>
                        ) : (
                          searchResults.map((card) => (
                            <button
                              key={card.id}
                              className="settings-index-search-dropdown-item"
                              type="button"
                              onClick={() => {
                                navigateByCard(card.id);
                                setSearchQuery('');
                              }}
                            >
                              <div className="settings-index-search-dropdown-text">
                                <span className="settings-index-search-dropdown-title">{card.localizedLabel}</span>
                                <span className="settings-index-search-dropdown-desc">{card.localizedDesc}</span>
                              </div>
                              {card.icon && (
                                <img className="settings-index-search-dropdown-icon" src={card.icon} alt="" aria-hidden="true" />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="settings-music-hint settings-index-hint">
                  {navEditMode
                    ? t('maxExpand.toolbox.index.hintEdit')
                    : t('maxExpand.toolbox.index.hintView')}
                </div>
              </div>
              <div className="settings-index-cards" aria-label={t('maxExpand.toolbox.index.ariaNav')}>
                {visibleCards.map((card, idx) => (
                  navEditMode ? (
                    <div
                      key={card.id}
                      className={`settings-index-card editing${dragOverIdx === idx ? ' drag-over' : ''}`}
                      draggable
                      onDragStart={(e) => {
                        dragIdxRef.current = idx;
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverIdx(idx);
                      }}
                      onDragLeave={() => setDragOverIdx(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverIdx(null);
                        const from = dragIdxRef.current;
                        if (from === null || from === idx) return;
                        const nextOrder = visibleCards.map((item) => item.id);
                        const [moved] = nextOrder.splice(from, 1);
                        nextOrder.splice(idx, 0, moved);
                        setNavOrder(nextOrder);
                      }}
                      onDragEnd={() => {
                        dragIdxRef.current = null;
                        setDragOverIdx(null);
                      }}
                    >
                      <span className="settings-index-card-drag-handle">⠿</span>
                      <button
                        className="settings-index-card-remove"
                        type="button"
                        onClick={() => {
                          const nextVisible = navOrder.filter((id) => id !== card.id);
                          const nextHidden = hiddenNavOrder.includes(card.id)
                            ? hiddenNavOrder
                            : [...hiddenNavOrder, card.id];
                          setNavOrder(nextVisible);
                          setHiddenNavOrder(nextHidden);
                        }}
                        aria-label={t('maxExpand.toolbox.index.removeCard', { label: t(card.labelKey) })}
                      >
                        −
                      </button>
                      <span className="settings-index-card-title">{t(card.labelKey)}</span>
                      <span className="settings-index-card-desc">{t(card.descKey)}</span>
                      {card.icon && <img className="settings-index-card-layout-icon" src={card.icon} alt="" aria-hidden="true" />}
                    </div>
                  ) : (
                    <button
                      key={card.id}
                      className="settings-index-card"
                      type="button"
                      onClick={() => navigateByCard(card.id)}
                    >
                      <span className="settings-index-card-title">{t(card.labelKey)}</span>
                      <span className="settings-index-card-desc">{t(card.descKey)}</span>
                      {card.icon && <img className="settings-index-card-layout-icon" src={card.icon} alt="" aria-hidden="true" />}
                    </button>
                  )
                ))}
              </div>
              {navEditMode && (
                <div className="settings-nav-add-panel" aria-label={t('maxExpand.toolbox.index.ariaAddPanel')}>
                  <div className="settings-music-label">{t('maxExpand.toolbox.index.addableTitle')}</div>
                  {hiddenCards.length === 0 ? (
                    <div className="settings-music-hint">{t('maxExpand.toolbox.index.emptyAddable')}</div>
                  ) : (
                    <div className="settings-nav-add-list">
                      {hiddenCards.map((card) => (
                        <button
                          key={card.id}
                          className="settings-nav-add-item"
                          type="button"
                          onClick={() => {
                            const nextVisible = navOrder.includes(card.id)
                              ? navOrder
                              : [...navOrder, card.id];
                            const nextHidden = hiddenNavOrder.filter((id) => id !== card.id);
                            setNavOrder(nextVisible);
                            setHiddenNavOrder(nextHidden);
                          }}
                        >
                          <span>{t(card.labelKey)}</span>
                          <span className="settings-nav-add-plus">+</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {activeSidebar === 'software' && (
            <SoftwareToolSection onFeedbackNavigate={handleSoftwareFeedbackNavigate} />
          )}
          {activeSidebar === 'fileService' && <FileServiceToolSection />}
          {activeSidebar === 'encodingService' && <EncodingServiceToolSection />}
          {activeSidebar === 'networkService' && <NetworkServiceToolSection />}
          {activeSidebar === 'formatFactory' && (
            <FormatFactoryToolSection
              formatFactoryPage={formatFactoryPage}
              setFormatFactoryPage={setFormatFactoryPage}
            />
          )}
        </div>
      </div>
    </div>
  );
}
