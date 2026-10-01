/*
 * 灵屿 Lingyu - 免费开源的 Windows 桌面灵动岛（基于 eIsland 二次开发）
 * https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3, or (at your option) any later version.
 */

/**
 * @file alarmAtomic.test.ts
 * @description 在独立文件目录验证一次性闹钟原子关闭与数据保留。
 * @author 灵屿
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trustedEvent, untrustedEvent } from '../../../test-utils/trustedEvent';
const { handlers, broadcast } = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(), broadcast: vi.fn(),
}));
vi.mock('electron', () => ({
  ipcMain: { handle: (key: string, handler: (...args: unknown[]) => unknown) => handlers.set(key, handler), on: vi.fn() },
  shell: {},
}));
vi.mock('../../../utils/broadcast', () => ({ broadcastSettingChange: broadcast }));
import { registerStoreIpcHandlers } from '../store';

let storeDir: string;
let alarmPath: string;
beforeEach(() => {
  storeDir = mkdtempSync(join(tmpdir(), 'lingyu-atomic-alarm-'));
  alarmPath = join(storeDir, 'alarms.json');
  handlers.clear();
  registerStoreIpcHandlers({ storeDir });
});
afterEach(() => { rmSync(storeDir, { recursive: true, force: true }); });

describe('alarm:set-enabled', () => {
  it('changes only enabled in the latest stored records', async () => {
    writeFileSync(alarmPath, JSON.stringify([{ id: 1, enabled: true }, { id: 2, enabled: true, label: 'concurrent edit' }]));
    expect(handlers.has('alarm:set-enabled')).toBe(true);
    expect(await handlers.get('alarm:set-enabled')!(trustedEvent(), [1], false)).toBe(true);
    expect(JSON.parse(readFileSync(alarmPath, 'utf8'))).toEqual([
      { id: 1, enabled: false }, { id: 2, enabled: true, label: 'concurrent edit' },
    ]);
  });
  it.each([[[NaN]], [[-1]], [['1']], [[]]])('rejects invalid ids %j without writing', async (ids) => {
    writeFileSync(alarmPath, '[{"id":1,"enabled":true}]');
    expect(handlers.has('alarm:set-enabled')).toBe(true);
    expect(await handlers.get('alarm:set-enabled')!(trustedEvent(), ids, false)).toBe(false);
    expect(readFileSync(alarmPath, 'utf8')).toBe('[{"id":1,"enabled":true}]');
  });
  it('preserves a damaged store rather than replacing it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    writeFileSync(alarmPath, 'broken');
    expect(handlers.has('alarm:set-enabled')).toBe(true);
    expect(await handlers.get('alarm:set-enabled')!(trustedEvent(), [1], false)).toBe(false);
    expect(readFileSync(alarmPath, 'utf8')).toBe('broken');
  });
  it('does not write for an untrusted sender', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    writeFileSync(alarmPath, '[{"id":1,"enabled":true}]');
    expect(handlers.has('alarm:set-enabled')).toBe(true);
    await handlers.get('alarm:set-enabled')!(untrustedEvent(), [1], false);
    expect(readFileSync(alarmPath, 'utf8')).toBe('[{"id":1,"enabled":true}]');
  });
});
