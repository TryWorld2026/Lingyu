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
 * @file workflowSecurity.test.ts
 * @description CI 权限与实际 Bash 正文生成的分支名命令注入回归。
 * @author 灵屿
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('PR workflow safety', () => {
  it.each([['build-size-report.yml', 2], ['test.yml', 1], ['i18n-check.yml', 1]])('runs PR checks with read-only tokens in %s', (filename, checkouts) => {
    const source = readFileSync(join('.github/workflows', filename), 'utf8');
    expect(source).toMatch(/\n  pull_request:/);
    expect(source).not.toContain('pull_request_target:');
    expect(source).not.toContain('pull-requests: write');
    expect(source).not.toContain('BOT_PAT');
    expect(source.match(/persist-credentials: false/g)).toHaveLength(checkouts as number);
  });
  it.each(['pr-comment-report.yml', 'pr-code-quality-review.yml'])('treats branch names as data in %s', (filename) => {
    const source = readFileSync(join('.github/workflows', filename), 'utf8').replace(/\r\n/g, '\n');
    const match = source.match(/- name: Compose[^\n]*\n[\s\S]*?run: \|\n([\s\S]*?)(?=\n      - name:)/);
    expect(match).not.toBeNull();
    const directory = mkdtempSync(join(tmpdir(), 'lingyu-workflow-injection-'));
    const branch = 'fix/$(touch${IFS}injected)';
    try {
      for (const file of ['pr-change-notes.md', 'pr-changed-files.md', 'quality-checked-files.md']) writeFileSync(join(directory, file), 'owned fixture');
      const script = match![1].replace(/^          /gm, '')
        .replace(/\$\{\{\s*github.event.pull_request.head.ref\s*\}\}/g, branch)
        .replace(/\$\{\{\s*github.event.pull_request.base.ref\s*\}\}/g, 'main')
        .replace(/\$\{\{[\s\S]*?\}\}/g, '1');
      const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
      const result = spawnSync(bash, ['--noprofile', '--norc', '-c', script], {
        cwd: directory, encoding: 'utf8', env: { ...process.env, PR_HEAD_REF: branch, PR_BASE_REF: 'main' },
      });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(existsSync(join(directory, 'injected'))).toBe(false);
      const output = filename.includes('code-quality') ? 'pr-quality-comment.md' : 'pr-comment.md';
      expect(readFileSync(join(directory, output), 'utf8')).toContain(branch);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
