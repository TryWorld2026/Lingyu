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
 * @file check-dependency-audit.ts
 * @description 把 npm audit 结果分成"生产运行时可达"和"构建期"，只对运行时可达的公告设门禁。
 * @author 灵屿
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

type LockPackage = {
  version?: string;
  link?: boolean;
  resolved?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

type LockFile = {
  packages: Record<string, LockPackage>;
};

type AuditAdvisory = {
  title: string;
  url: string;
  severity: string;
};

type AuditVulnerability = {
  name: string;
  severity: string;
  isDirect: boolean;
  nodes: string[];
  via: Array<string | AuditAdvisory>;
  fixAvailable: boolean | { name: string; version: string; isSemVerMajor: boolean };
};

type AuditReport = {
  vulnerabilities?: Record<string, AuditVulnerability>;
};

const ROOT = join(import.meta.dirname, '..');
const LOCK_PATH = join(ROOT, 'package-lock.json');
const ROOT_PATH = '';

const SEVERITY_ORDER = ['info', 'low', 'moderate', 'high', 'critical'] as const;
type Severity = (typeof SEVERITY_ORDER)[number];

/** 达到该严重度且运行时可达的公告让检查失败。 */
const BLOCK_THRESHOLD: Severity = 'moderate';

/**
 * 装在 `dependencies` 里但只在安装或构建期执行的边界包。
 * 走到这些包就停止向下扩散：它们的整棵子树都不进入安装包运行时代码。
 */
const BUILD_TIME_BOUNDARIES = new Map<string, string>([
  ['@tailwindcss/vite', '构建期 Vite 插件，运行时由打包产物提供样式'],
  ['tailwindcss', '构建期样式编译'],
  ['postcss', '构建期样式编译'],
  ['node-gyp', '安装期编译原生模块'],
  ['@mapbox/node-pre-gyp', '安装期下载预编译二进制'],
  ['electron-builder', '安装期打包'],
  ['app-builder-lib', '安装期打包'],
]);

/**
 * 运行时可达但经评估当前不能简单修掉的公告。
 * 每一条都必须写清理由；没有理由的条目不从这里放行，而是去修依赖或替换依赖。
 * 新增豁免前先确认：公告的利用路径在本项目的运行时代码里确实不可达。
 */
const ACCEPTED_RISKS = new Map<string, string>([
  [
    'systeminformation',
    '公告限定 Linux 的 interfaces(5) source-directive 路径；灵屿是 Windows 专用客户端，不调用该代码路径',
  ],
  [
    'get-windows',
    '公告来自 node-gyp 安装期链（node-gyp → make-fetch-happen → cacache → tar），不在运行时代码路径；替代方案目前无修复版本',
  ],
]);

/**
 * 读取 JSON 文件，容忍 shell 重定向可能写入的 UTF-8 BOM。
 * @param path 文件路径。
 * @returns 解析后的内容。
 */
function readJson<T>(path: string): T {
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(text) as T;
}

/**
 * 取 lockfile 路径的上一级，用于 Node 模块解析的向上查找。
 * @param lockPath lockfile 的 packages 键。
 * @returns 上一级路径；根条目返回空串。
 */
function parentPath(lockPath: string): string {
  const nested = lockPath.lastIndexOf('/node_modules/');
  if (nested !== -1) return lockPath.slice(0, nested);
  if (lockPath.startsWith('node_modules/')) return ROOT_PATH;
  const slash = lockPath.lastIndexOf('/');
  return slash === -1 ? ROOT_PATH : lockPath.slice(0, slash);
}

/**
 * 从某个 lockfile 路径解析一个依赖名对应的 lockfile 路径。
 * 遵循 Node 的向上查找：先看 `<path>/node_modules/<name>`，再逐级向上。
 * @param lock 解析后的 package-lock.json。
 * @param fromPath 起始 lockfile 路径。
 * @param name 依赖名。
 * @returns 命中的 lockfile 路径；找不到返回 undefined。
 */
function resolveDependency(lock: LockFile, fromPath: string, name: string): string | undefined {
  const prefix = fromPath === ROOT_PATH ? '' : fromPath;
  let current = prefix;

  for (;;) {
    const candidate = current === ROOT_PATH ? `node_modules/${name}` : `${current}/node_modules/${name}`;
    if (lock.packages[candidate]) return candidate;
    const parent = parentPath(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

/**
 * 收集运行时可达的 lockfile 路径（含构建期边界判定）。
 * @param lock 解析后的 package-lock.json。
 * @returns 可达的 lockfile 路径集合。
 */
function collectRuntimePaths(lock: LockFile): Set<string> {
  const reachable = new Set<string>();
  const queue: Array<{ path: string; name: string }> = [];

  for (const name of Object.keys(lock.packages[ROOT_PATH]?.dependencies ?? {})) {
    const path = resolveDependency(lock, ROOT_PATH, name);
    if (path) queue.push({ path, name });
  }

  while (queue.length > 0) {
    const entry = queue.shift() as { path: string; name: string };
    if (reachable.has(entry.path)) continue;

    // 边界包本身也算构建期，不进入运行时可及集合，否则 vite、postcss 这类会被当成运行时依赖。
    if (BUILD_TIME_BOUNDARIES.has(entry.name)) continue;
    reachable.add(entry.path);

    const meta = lock.packages[entry.path];

    if (meta?.link && meta.resolved && lock.packages[meta.resolved]) {
      queue.push({ path: meta.resolved, name: entry.name });
    }

    for (const dep of Object.keys({ ...meta?.dependencies, ...meta?.optionalDependencies })) {
      const depPath = resolveDependency(lock, entry.path, dep);
      if (depPath) queue.push({ path: depPath, name: dep });
    }
  }

  return reachable;
}

/**
 * 读取 audit 报告。
 * @param auditPath audit JSON 路径。
 * @returns 漏洞条目列表。
 */
function readAudit(auditPath: string): AuditVulnerability[] {
  const report = readJson<AuditReport>(auditPath);
  return Object.values(report.vulnerabilities ?? {});
}

/**
 * 判断漏洞是否达到阻断阈值且运行时可达。
 * 用 audit 自己报告的 `nodes`（lockfile 路径）去比对可达集合：同名包在 dev 树里可能是另一个有漏洞的版本。
 * @param vulnerability 单条漏洞。
 * @param runtimePaths 运行时可达的 lockfile 路径集合。
 * @returns 是否需要阻断。
 */
function shouldBlock(vulnerability: AuditVulnerability, runtimePaths: Set<string>): boolean {
  const reachesThreshold =
    SEVERITY_ORDER.indexOf(vulnerability.severity as Severity) >= SEVERITY_ORDER.indexOf(BLOCK_THRESHOLD);
  const runtimeReachable = vulnerability.nodes.some((node) => runtimePaths.has(node));
  return reachesThreshold && runtimeReachable && !ACCEPTED_RISKS.has(vulnerability.name);
}

/**
 * 判断漏洞是否运行时可达。
 * @param vulnerability 单条漏洞。
 * @param runtimePaths 运行时可达的 lockfile 路径集合。
 * @returns 是否运行时可达。
 */
function isRuntime(vulnerability: AuditVulnerability, runtimePaths: Set<string>): boolean {
  return vulnerability.nodes.some((node) => runtimePaths.has(node));
}

/**
 * 打印分级结果。
 * @param vulnerabilities 全部漏洞。
 * @param runtimePaths 运行时可达的 lockfile 路径集合。
 */
function report(vulnerabilities: AuditVulnerability[], runtimePaths: Set<string>): void {
  const runtime = vulnerabilities.filter((item) => isRuntime(item, runtimePaths));
  const other = vulnerabilities.filter((item) => !isRuntime(item, runtimePaths));
  const blocked = vulnerabilities.filter((item) => shouldBlock(item, runtimePaths));

  console.log(`[AUDIT] runtime-reachable: ${runtime.length}`);
  for (const item of runtime) {
    const accepted = ACCEPTED_RISKS.get(item.name);
    const marker = accepted ? `accepted risk — ${accepted}` : 'blocking';
    console.log(`  [${item.severity}] ${item.name} (${item.nodes.join(', ')}) — ${marker}`);
    for (const via of item.via) {
      if (typeof via !== 'string') console.log(`    ${via.title} ${via.url}`);
    }
    if (!item.fixAvailable) console.log('    fixAvailable: false（需要人工判断）');
  }

  console.log(`[AUDIT] dev/build-only: ${other.length}`);
  for (const item of other) {
    console.log(`  [${item.severity}] ${item.name}`);
  }

  if (blocked.length > 0) {
    console.error(`[FAIL] ${blocked.length} 个运行时可达的依赖公告达到 ${BLOCK_THRESHOLD} 及以上，必须处理后才能合入。`);
    return;
  }

  console.log('[PASS] 没有运行时可达的依赖公告达到阻断阈值。');
}

/**
 * 入口。
 * @param auditPath audit JSON 路径。
 * @param lockPath lockfile 路径，测试可注入。
 * @returns 进程退出码。
 */
function main(auditPath: string, lockPath: string = LOCK_PATH): number {
  const lock = readJson<LockFile>(lockPath);
  const runtimePaths = collectRuntimePaths(lock);
  const vulnerabilities = readAudit(auditPath);

  console.log(`[AUDIT] runtime paths: ${runtimePaths.size}`);
  console.log(`[AUDIT] build-time boundaries cut: ${BUILD_TIME_BOUNDARIES.size}`);
  for (const [name, reason] of BUILD_TIME_BOUNDARIES) {
    console.log(`  ${name} — ${reason}`);
  }
  report(vulnerabilities, runtimePaths);

  return vulnerabilities.some((item) => shouldBlock(item, runtimePaths)) ? 1 : 0;
}

/**
 * 生成 audit JSON 文件。
 * npm audit 只要发现漏洞就以非 0 退出，输出仍然有效，所以这里不用它的退出码。
 * 用 shell 重定向落盘而不是 Node 读管道，避免受限环境里管道被禁。
 * @param auditPath 输出路径。
 */
function generateAudit(auditPath: string): void {
  try {
    execSync(`npm audit --json > "${auditPath}"`, { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  } catch {
    // 有漏洞时 npm audit 返回非 0，此时 audit.json 已经写好。
  }
}

// 只在直接执行时退出；被测试 import 时保持纯导出。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const auditPath = process.argv[2] ?? join(ROOT, 'audit.json');
  const lockPath = process.argv[3] ?? LOCK_PATH;

  if (!process.argv[2]) generateAudit(auditPath);

  process.exit(main(auditPath, lockPath));
}

export { collectRuntimePaths, isRuntime, main, shouldBlock };
export type { AuditReport, AuditVulnerability, LockFile };
