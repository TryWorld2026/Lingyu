/*
 * Lingyu - GPL-3.0-or-later; https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 JNTMTMTM; Copyright (C) 2026 pyisland.com
 * This program is free software under the GNU General Public License, version 3 or later.
 */
/**
 * @file run-free-ai-probe.cjs
 * @description 自有临时配置下的实际 Electron 功能验收探针，外部调用替代范围见本目录 README。
 * @author 灵屿
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const repo = process.argv[2];
const electron = require(path.join(repo, 'node_modules/electron'));
const log = fs.openSync(path.join(__dirname, 'electron-free-ai-probe.log'), 'w');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [path.join(__dirname, 'electron-free-ai-probe.cjs'), repo], { env, windowsHide: true, stdio: ['ignore', log, log] });
const timeout = setTimeout(() => { child.kill(); console.error('Owned native probe was force-terminated after deadline'); }, 55000);
child.on('error', error => { clearTimeout(timeout); fs.closeSync(log); console.error(error); process.exitCode = 1; });
child.on('exit', (code, signal) => {
  clearTimeout(timeout);
  fs.closeSync(log);
  console.log(JSON.stringify({ exitCode: code, signal }));
  console.log(fs.readFileSync(path.join(__dirname, 'electron-free-ai-probe.log'), 'utf8'));
  process.exitCode = code === 0 && !signal ? 0 : 1;
});
