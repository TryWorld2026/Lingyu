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
 * @file index.js
 * @description 加载进程控制原生插件；加载本身不会关闭任何进程。
 * @author 灵屿
 */

const path = require('node:path');
if (process.platform !== 'win32') throw new Error('@lingyu/windows-processes-attacker only supports Windows.');
module.exports = require(path.join(__dirname, 'build', 'Release', 'lingyu_windows_processes_attacker.node'));
