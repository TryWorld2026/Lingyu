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
 */

/**
 * @file localFileSearch.ts
 * @description 本地文件搜索工具：按名称/路径匹配递归搜索目录
 * @author 灵屿
 */

import { promises as fsPromises } from 'node:fs';
import { join } from 'node:path';
import type { LocalFileSearchItem, LocalFileSearchOptions } from './types';

const readdirAsync = fsPromises.readdir;
const statAsync = fsPromises.stat;

/** 默认搜索限制 */
const DEFAULT_LIMIT = 200;
/** 默认最大深度 */
const DEFAULT_MAX_DEPTH = 6;
/** 默认排除目录 */
const DEFAULT_EXCLUDE_DIRS = new Set(['node_modules', '.git', '.hg', '.svn', 'dist', 'out', 'build']);

/**
 * 判断文件/目录是否匹配搜索关键字
 * @param item - 文件或目录
 * @param keyword - 搜索关键字
 * @param options - 搜索选项
 * @returns 是否匹配
 */
export function matchesSearchQuery(
  item: Pick<LocalFileSearchItem, 'name' | 'path'>,
  keyword: string,
  options: LocalFileSearchOptions = {}
): boolean {
  if (!keyword) return true;
  const { matchMode = 'contains', matchScope = 'name', caseSensitive = false } = options;
  const target = matchScope === 'path' ? item.path : item.name;
  const source = caseSensitive ? target : target.toLowerCase();
  const query = caseSensitive ? keyword : keyword.toLowerCase();

  switch (matchMode) {
    case 'startsWith':
      return source.startsWith(query);
    case 'endsWith':
      return source.endsWith(query);
    case 'exact':
      return source === query;
    case 'contains':
    default:
      return source.includes(query);
  }
}

/**
 * 判断扩展名是否在过滤列表内
 * @param name - 文件名
 * @param extensions - 扩展名列表（含点，如 .pdf）
 * @returns 是否匹配
 */
function matchesExtensions(name: string, extensions?: string[]): boolean {
  if (!extensions || extensions.length === 0) return true;
  const lower = name.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext.toLowerCase()));
}

/**
 * 递归搜索目录下的文件（异步，避免阻塞主进程）
 * @param rootDir - 起始目录
 * @param keyword - 搜索关键字
 * @param options - 搜索选项
 * @returns 搜索结果列表
 */
export async function searchLocalFiles(
  rootDir: string,
  keyword: string,
  options: LocalFileSearchOptions = {}
): Promise<LocalFileSearchItem[]> {
  const {
    // 服务端钳制：避免 renderer 传超大参数导致主进程卡死
    limit = Math.min(options.limit ?? DEFAULT_LIMIT, 500),
    maxDepth = Math.min(options.maxDepth ?? DEFAULT_MAX_DEPTH, 12),
    includeDirectories = true,
    includeFiles = true,
    includeHidden = false,
  } = options;

  // 合并默认排除目录与调用方传入的排除目录（调用方传空数组也不应绕过默认排除）
  const excludeSet = new Set<string>([
    ...DEFAULT_EXCLUDE_DIRS,
    ...(options.excludeDirs ?? []),
  ]);

  const results: LocalFileSearchItem[] = [];

  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > maxDepth || results.length >= limit) return;
    let entries;
    try {
      entries = await readdirAsync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= limit) return;
      const name = entry.name;
      // 隐藏文件过滤
      if (!includeHidden && name.startsWith('.')) continue;
      if (entry.isDirectory() && excludeSet.has(name)) continue;

      const fullPath = join(dir, name);
      const item: LocalFileSearchItem = {
        name,
        path: fullPath,
        isDirectory: entry.isDirectory(),
      };

      if (entry.isDirectory()) {
        if (includeDirectories && matchesSearchQuery(item, keyword, options)) {
          results.push(item);
        }
        await walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        if (includeFiles
          && matchesExtensions(name, options.extensions)
          && matchesSearchQuery(item, keyword, options)) {
          results.push(item);
        }
      }
    }
  };

  try {
    if (!(await statAsync(rootDir)).isDirectory()) return results;
  } catch {
    return results;
  }

  await walk(rootDir, 0);
  return results.slice(0, limit);
}
