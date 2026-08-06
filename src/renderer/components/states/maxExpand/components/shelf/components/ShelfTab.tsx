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
 * @file ShelfTab.tsx
 * @description 文件暂存架（Yoink 式）：拖入文件暂存、复制取回；只存路径引用，不复制/删除文件本体
 * @author 灵屿
 */

import { useCallback, useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../../../../../store/slices';
import { openPathInExplorer, openPathWithDefaultApp } from './shelfUtils';

/**
 * 文件暂存架标签页
 * @returns 暂存架界面
 */
export function ShelfTab(): ReactElement {
  const { t } = useTranslation();
  const shelfItems = useIslandStore((state) => state.shelfItems);
  const shelfLoaded = useIslandStore((state) => state.shelfLoaded);
  const shelfDragActive = useIslandStore((state) => state.shelfDragActive);
  const loadShelfItems = useIslandStore((state) => state.loadShelfItems);
  const addShelfItems = useIslandStore((state) => state.addShelfItems);
  const removeShelfItem = useIslandStore((state) => state.removeShelfItem);
  const clearShelfItems = useIslandStore((state) => state.clearShelfItems);
  const setShelfDragActive = useIslandStore((state) => state.setShelfDragActive);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    if (!shelfLoaded) {
      void loadShelfItems();
    }
  }, [shelfLoaded, loadShelfItems]);

  const handleDragEnter = useCallback((event: React.DragEvent): void => {
    event.preventDefault();
    dragDepthRef.current += 1;
    setShelfDragActive(true);
  }, [setShelfDragActive]);

  const handleDragOver = useCallback((event: React.DragEvent): void => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent): void => {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setShelfDragActive(false);
    }
  }, [setShelfDragActive]);

  const handleDrop = useCallback((event: React.DragEvent): void => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setShelfDragActive(false);
    const paths: string[] = [];
    const files = Array.from(event.dataTransfer.files ?? []);
    for (const file of files) {
      const p = (file as File & { path?: string }).path;
      if (p) paths.push(p);
    }
    if (paths.length > 0) {
      addShelfItems(paths);
    }
  }, [addShelfItems, setShelfDragActive]);

  const handleAddFromClipboard = useCallback(async (): Promise<void> => {
    try {
      const paths = await window.api.clipboardReadFiles();
      if (paths.length > 0) {
        addShelfItems(paths);
      }
    } catch {
      // ignore
    }
  }, [addShelfItems]);

  const handleCopyAll = useCallback(async (): Promise<void> => {
    if (shelfItems.length === 0) return;
    await window.api.clipboardCopyFiles(shelfItems.map((item) => item.path));
  }, [shelfItems]);

  const handleCopyItem = useCallback(async (path: string): Promise<void> => {
    await window.api.clipboardCopyFiles([path]);
  }, []);

  const handleOpenItem = useCallback((path: string): void => {
    void openPathWithDefaultApp(path);
  }, []);

  const handleRevealItem = useCallback((path: string): void => {
    void openPathInExplorer(path);
  }, []);

  return (
    <div
      className={`lingyu-shelf ${shelfDragActive ? 'lingyu-shelf--drag-active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="lingyu-shelf-header">
        <span className="lingyu-shelf-title">
          {t('maxExpand.shelf.title', { defaultValue: '文件暂存架' })}
        </span>
        <div className="lingyu-shelf-actions">
          <button
            type="button"
            className="lingyu-shelf-btn"
            onClick={() => void handleAddFromClipboard()}
            title={t('maxExpand.shelf.addFromClipboard', { defaultValue: '从剪贴板添加' })}
          >
            {t('maxExpand.shelf.addClipboard', { defaultValue: '📋 剪贴板' })}
          </button>
          {shelfItems.length > 0 && (
            <button
              type="button"
              className="lingyu-shelf-btn"
              onClick={() => void handleCopyAll()}
              title={t('maxExpand.shelf.copyAllHint', { defaultValue: '复制全部到剪贴板，可到文件夹 Ctrl+V' })}
            >
              {t('maxExpand.shelf.copyAll', { defaultValue: '⧉ 全部复制' })}
            </button>
          )}
          {shelfItems.length > 0 && (
            <button
              type="button"
              className="lingyu-shelf-btn lingyu-shelf-btn--danger"
              onClick={clearShelfItems}
            >
              {t('maxExpand.shelf.clear', { defaultValue: '清空' })}
            </button>
          )}
        </div>
      </div>

      {shelfDragActive && (
        <div className="lingyu-shelf-drop-mask">
          <span>{t('maxExpand.shelf.dropHint', { defaultValue: '📎 松开鼠标放入暂存架' })}</span>
        </div>
      )}

      {shelfItems.length === 0 && !shelfDragActive && (
        <div className="lingyu-shelf-empty">
          <div className="lingyu-shelf-empty-icon">📎</div>
          <div className="lingyu-shelf-empty-text">
            {t('maxExpand.shelf.emptyHint', { defaultValue: '把文件拖到这里临时存放\n取回后可复制到任意文件夹' })}
          </div>
        </div>
      )}

      {shelfItems.length > 0 && !shelfDragActive && (
        <ul className="lingyu-shelf-list">
          {shelfItems.map((item) => (
            <li key={item.path} className="lingyu-shelf-item">
              <span className="lingyu-shelf-item-name" title={item.path}>{item.name}</span>
              <span className="lingyu-shelf-item-actions">
                <button
                  type="button"
                  className="lingyu-shelf-item-btn"
                  title={t('maxExpand.shelf.copyItem', { defaultValue: '复制（Ctrl+V 到文件夹）' })}
                  onClick={() => void handleCopyItem(item.path)}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  className="lingyu-shelf-item-btn"
                  title={t('maxExpand.shelf.openItem', { defaultValue: '打开' })}
                  onClick={() => handleOpenItem(item.path)}
                >
                  ↗
                </button>
                <button
                  type="button"
                  className="lingyu-shelf-item-btn"
                  title={t('maxExpand.shelf.revealItem', { defaultValue: '在资源管理器中定位' })}
                  onClick={() => handleRevealItem(item.path)}
                >
                  📁
                </button>
                <button
                  type="button"
                  className="lingyu-shelf-item-btn lingyu-shelf-item-btn--danger"
                  title={t('maxExpand.shelf.removeItem', { defaultValue: '移出暂存架（不删除原文件）' })}
                  onClick={() => removeShelfItem(item.path)}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
