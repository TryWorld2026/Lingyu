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
 * @file dynamicIslandUpdateSource.ts
 * @description 更新源相关类型与工具函数。
 * @author 灵屿
 */

export type UpdateSourceKey = 'cloudflare-r2' | 'esa-cdn' | 'tencent-cos' | 'aliyun-oss' | 'github' | 'ghproxy' | 'cf-dl';

/**
 * @description 归一化更新源值。
 * @param value - 待归一化的更新源值。
 * @returns 归一化后的更新源键值。
 */
export function normalizeUpdateSource(value: unknown): UpdateSourceKey {
  if (value === 'github') return 'github';
  if (value === 'ghproxy') return 'ghproxy';
  if (value === 'cf-dl') return 'cf-dl';
  if (value === 'tencent-cos') return 'tencent-cos';
  if (value === 'aliyun-oss') return 'aliyun-oss';
  if (value === 'esa-cdn') return 'esa-cdn';
  return 'cloudflare-r2';
}

/**
 * @description 判断更新源是否为 Pro 专属。
 * @param source - 更新源键值。
 * @returns 是否为 Pro 专属更新源。
 */
export function isProOnlyUpdateSource(_source: UpdateSourceKey): boolean {
  // 产品全功能免费，无 Pro 专属更新源
  return false;
}

const normalizeRoleValue = (value: string): string => {
  return value.trim().toLowerCase().replace(/^role_/, '');
};

export const getRoleFromToken = (token: string | null | undefined): string | null => {
  if (!token) return null;
  const rawToken = token.trim().replace(/^bearer\s+/i, '');
  const parts = rawToken.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const normalizedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
    const decoded = JSON.parse(atob(normalizedPayload)) as { role?: unknown };
    return typeof decoded.role === 'string' ? normalizeRoleValue(decoded.role) : null;
  } catch {
    return null;
  }
};

/**
 * @description 获取更新源显示标签。
 * @param value - 更新源键值。
 * @returns 更新源展示标签文本。
 */
export function getUpdateSourceLabel(value: unknown): string {
  if (value === 'github') return 'GitHub Releases';
  if (value === 'tencent-cos') return 'Tencent COS';
  if (value === 'aliyun-oss') return 'Aliyun OSS';
  if (value === 'esa-cdn') return 'ESA CDN';
  if (value === 'ghproxy') return 'ghproxy 加速';
  return 'Cloudflare R2';
}
