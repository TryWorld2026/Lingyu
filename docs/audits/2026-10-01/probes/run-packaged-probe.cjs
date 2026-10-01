/*
 * Lingyu - GPL-3.0-or-later; https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 JNTMTMTM; Copyright (C) 2026 pyisland.com
 * This program is free software under the GNU General Public License, version 3 or later.
 */
/**
 * @file run-packaged-probe.cjs
 * @description 自有临时配置下的实际 Electron 功能验收探针，外部调用替代范围见本目录 README。
 * @author 灵屿
 */
const path=require('node:path'),fs=require('node:fs'),{spawn}=require('node:child_process');
const repo=process.argv[2],packed=process.argv[3],env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const log=fs.openSync(path.join(__dirname,'electron-packaged-probe.log'),'w');
const child=spawn(require(path.join(repo,'node_modules/electron')),[path.join(__dirname,'electron-packaged-probe.cjs'),repo,packed],{env,windowsHide:true,stdio:['ignore',log,log]});
const timer=setTimeout(()=>child.kill(),30000);
child.on('error',error=>{console.error(error);process.exitCode=1;});
child.on('exit',(code,signal)=>{clearTimeout(timer);fs.closeSync(log);console.log(JSON.stringify({code,signal}));console.log(fs.readFileSync(path.join(__dirname,'electron-packaged-probe.log'),'utf8'));process.exitCode=code===0&&!signal?0:1;});
