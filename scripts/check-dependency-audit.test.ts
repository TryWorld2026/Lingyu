/*
 * 灵屿 Lingyu - 免费开源的 Windows 桌面灵动岛（基于 eIsland 二次开发）
 * https://github.com/TryWorld2026/Lingyu
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 * Original author: JNTMTMTM (https://github.com/JNTMTMTM)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3, or (at your option) any later version.
 */

/**
 * @file check-dependency-audit.test.ts
 * @description 验证生产可达性分类：构建期边界切断、嵌套版本不串味、阻断判定。
 * @author 灵屿
 */

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { collectRuntimePaths, isRuntime, main, shouldBlock } from './check-dependency-audit';
import type { AuditVulnerability, LockFile } from './check-dependency-audit';

/**
 * 构造一份最小 lockfile。
 * 覆盖四类情况：普通传递依赖、构建期边界（@tailwindcss/vite 及其子树不可达）、
 * 同名包不同版本（shared 顶层是 dev 副本、updater 下嵌套版本才是生产依赖）、
 * file: 软链接插件（helper 指向 plugins/helper，其依赖要算进来）。
 * @returns lockfile 对象。
 */
function makeLock(): LockFile {
  return {
    packages: {
      '': {
        dependencies: {
          a: '^1.0.0',
          '@tailwindcss/vite': '^4.0.0',
          updater: '^1.0.0',
          helper: 'file:plugins/helper',
        },
      },
      'node_modules/a': { version: '1.0.0', dependencies: { bad: '^1.0.0' } },
      'node_modules/bad': { version: '1.0.0' },
      'node_modules/@tailwindcss/vite': { version: '4.0.0', dependencies: { postcss: '^8.0.0' } },
      'node_modules/postcss': { version: '8.0.0', dependencies: { hidden: '^1.0.0' } },
      'node_modules/hidden': { version: '1.0.0' },
      'node_modules/updater': { version: '1.0.0', dependencies: { shared: '^9.0.0' } },
      'node_modules/updater/node_modules/shared': { version: '9.7.0' },
      'node_modules/shared': { version: '9.5.1' },
      'node_modules/helper': { link: true, resolved: 'plugins/helper' },
      'plugins/helper': { version: '1.0.0', dependencies: { bad: '^1.0.0' } },
    },
  };
}

/**
 * 构造一条漏洞记录。
 * @param overrides 需要覆盖的字段。
 * @returns 漏洞条目。
 */
function makeVulnerability(overrides: Partial<AuditVulnerability>): AuditVulnerability {
  return {
    name: 'bad',
    severity: 'high',
    isDirect: false,
    nodes: ['node_modules/bad'],
    via: [],
    fixAvailable: true,
    ...overrides,
  };
}

describe('collectRuntimePaths', () => {
  it('从根 dependencies 出发，按路径走完整棵生产树', () => {
    const paths = collectRuntimePaths(makeLock());

    expect(paths.has('node_modules/a')).toBe(true);
    expect(paths.has('node_modules/bad')).toBe(true);
    expect(paths.has('node_modules/updater')).toBe(true);
  });

  it('在构建期边界处切断，不把其子树算成运行时依赖', () => {
    const paths = collectRuntimePaths(makeLock());

    expect(paths.has('node_modules/@tailwindcss/vite')).toBe(false);
    expect(paths.has('node_modules/postcss')).toBe(false);
    expect(paths.has('node_modules/hidden')).toBe(false);
  });

  it('同名包按版本区分：dev 树里的副本不进入生产树', () => {
    const paths = collectRuntimePaths(makeLock());

    expect(paths.has('node_modules/shared')).toBe(false);
    expect(paths.has('node_modules/updater/node_modules/shared')).toBe(true);
  });

  it('跟随 file: 软链接，把插件的生产依赖算进来', () => {
    const paths = collectRuntimePaths(makeLock());

    expect(paths.has('node_modules/helper')).toBe(true);
    expect(paths.has('plugins/helper')).toBe(true);
  });
});

describe('shouldBlock', () => {
  const paths = collectRuntimePaths(makeLock());

  it('运行时可达且达到阈值时阻断', () => {
    expect(shouldBlock(makeVulnerability({ severity: 'moderate' }), paths)).toBe(true);
    expect(shouldBlock(makeVulnerability({ severity: 'critical' }), paths)).toBe(true);
  });

  it('低于阈值的公告不阻断', () => {
    expect(shouldBlock(makeVulnerability({ severity: 'low' }), paths)).toBe(false);
    expect(shouldBlock(makeVulnerability({ severity: 'info' }), paths)).toBe(false);
  });

  it('同名包在 dev 树里时即使有漏洞也不阻断', () => {
    const devOnly = makeVulnerability({ name: 'shared', nodes: ['node_modules/shared'] });
    expect(shouldBlock(devOnly, paths)).toBe(false);
    expect(isRuntime(devOnly, paths)).toBe(false);
  });

  it('构建期子树里的公告不阻断', () => {
    const postcss = makeVulnerability({ name: 'postcss', nodes: ['node_modules/postcss'] });
    expect(shouldBlock(postcss, paths)).toBe(false);
  });

  it('登记在案的接受风险不阻断，但仍算运行时可达', () => {
    const risk = makeVulnerability({ name: 'systeminformation', nodes: ['node_modules/systeminformation'] });
    expect(isRuntime(risk, new Set([...paths, 'node_modules/systeminformation']))).toBe(true);
    expect(shouldBlock(risk, new Set([...paths, 'node_modules/systeminformation']))).toBe(false);
  });
});

describe('main', () => {
  /**
   * 把内容写成临时文件并返回路径。
   * @param content 文件内容。
   * @returns 临时文件路径。
   */
  function tempFile(content: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'lingyu-audit-'));
    const path = join(dir, 'fixture.json');
    writeFileSync(path, content, 'utf8');
    return path;
  }

  it('没有运行时可达公告时返回 0', () => {
    const audit = tempFile(
      JSON.stringify({
        vulnerabilities: {
          postcss: { name: 'postcss', severity: 'critical', nodes: ['node_modules/postcss'], via: [], fixAvailable: true },
        },
      }),
    );
    const lock = tempFile(JSON.stringify(makeLock()));

    expect(main(audit, lock)).toBe(0);
  });

  it('出现运行时可达公告时返回 1', () => {
    const audit = tempFile(
      JSON.stringify({
        vulnerabilities: {
          bad: { name: 'bad', severity: 'moderate', nodes: ['node_modules/bad'], via: [], fixAvailable: true },
        },
      }),
    );
    const lock = tempFile(JSON.stringify(makeLock()));

    expect(main(audit, lock)).toBe(1);
  });

  it('容忍带 BOM 的 audit 文件', () => {
    const audit = tempFile(`\uFEFF${JSON.stringify({ vulnerabilities: {} })}`);
    const lock = tempFile(JSON.stringify(makeLock()));

    expect(main(audit, lock)).toBe(0);
  });
});
