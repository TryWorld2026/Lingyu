/*
 * Lingyu - GPL-3.0-or-later; https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 JNTMTMTM; Copyright (C) 2026 pyisland.com
 * This program is free software under the GNU General Public License, version 3 or later.
 */
/**
 * @file build-functional-fixture.mjs
 * @description 自有临时配置下的实际 Electron 功能验收探针，外部调用替代范围见本目录 README。
 * @author 灵屿
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const repo = process.argv[2];
const resolve = createRequire(path.join(repo, 'package.json'));
const { build } = await import(pathToFileURL(resolve.resolve('vite')).href);
const react = resolve('@vitejs/plugin-react');
const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'functional-ui-fixture');
fs.mkdirSync(fixture, { recursive: true });
const source = repo.replaceAll('\\', '/');
fs.writeFileSync(path.join(fixture, 'index.html'), '<!doctype html><html><head><meta charset="UTF-8"></head><body><div id="root"></div><script type="module" src="/fixture.tsx"></script></body></html>');
fs.writeFileSync(path.join(fixture, 'fixture.tsx'), `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import i18next from 'i18next';
import {I18nextProvider} from 'react-i18next';
import zh from '${source}/i18n/zh-CN.json';
import en from '${source}/i18n/en-US.json';
import {useClipboardHistoryItems} from '${source}/src/renderer/components/states/maxExpand/components/clipBoardHistory/hooks/useClipboardHistoryItems.ts';
import {useAlarmState} from '${source}/src/renderer/components/states/maxExpand/components/alarm/hooks/useAlarmState.ts';
import {useCountdownItems} from '${source}/src/renderer/components/states/maxExpand/components/countdown/hooks/useCountdownItems.ts';
import {useIslandTimerAndAlarm} from '${source}/src/renderer/components/hooks/useIslandTimerAndAlarm.ts';
import useIslandStore from '${source}/src/renderer/store/slices/index.ts';
import {TodoTab} from '${source}/src/renderer/components/states/maxExpand/components/todo/components/TodoTab.tsx';
import {MemoTab} from '${source}/src/renderer/components/states/maxExpand/components/memo/components/MemoTab.tsx';
import {AlarmTab} from '${source}/src/renderer/components/states/maxExpand/components/alarm/components/AlarmTab.tsx';
import {CountdownTab} from '${source}/src/renderer/components/states/maxExpand/components/countdown/index.ts';
import {UrlFavoritesTab} from '${source}/src/renderer/components/states/maxExpand/components/urlFavorites/index.ts';
import {AlbumTab} from '${source}/src/renderer/components/states/maxExpand/components/album/components/AlbumTab.tsx';
import {LocalFileSearchTab} from '${source}/src/renderer/components/states/maxExpand/components/localFileSearch/components/LocalFileSearchTab.tsx';
import {ClipboardHistoryTab} from '${source}/src/renderer/components/states/maxExpand/components/clipBoardHistory/index.ts';
import {ShelfTab} from '${source}/src/renderer/components/states/maxExpand/components/shelf/components/ShelfTab.tsx';
import {SettingsTab} from '${source}/src/renderer/components/states/maxExpand/components/SettingsTab.tsx';
import {AiTab} from '${source}/src/renderer/components/states/maxExpand/components/ai/AiTab.tsx';
import {useTodos} from '${source}/src/renderer/components/states/maxExpand/components/todo/hooks/useTodos.ts';
import {useMemoTab} from '${source}/src/renderer/components/states/maxExpand/components/memo/hooks/useMemoTab.ts';
import {OverviewTab} from '${source}/src/renderer/components/states/expand/components/OverviewTab.tsx';
import {SongTab} from '${source}/src/renderer/components/states/expand/components/SongTab.tsx';
import {ToolsTab} from '${source}/src/renderer/components/states/expand/components/ToolsTab.tsx';
import {PerformanceMonitorTab} from '${source}/src/renderer/components/states/expand/components/PerformanceMonitorTab.tsx';
import {MaxExpandContentEager} from '${source}/src/renderer/components/states/maxExpand/MaxExpandContentEager.tsx';
import {MaxExpandContentLazy} from '${source}/src/renderer/components/states/maxExpand/MaxExpandContentLazy.tsx';
await i18next.init({lng:'zh-CN', fallbackLng:'en-US', resources:{'zh-CN':{translation:zh},'en-US':{translation:en}}});
const root = createRoot(document.getElementById('root'));
window.auditFeedback=[];
window.auditStore=useIslandStore;
window.auditErrors=[];
window.addEventListener('unhandledrejection',event=>{window.auditErrors.push(String(event.reason));event.preventDefault();});
const pages={todo:TodoTab,memo:MemoTab,alarm:AlarmTab,countdown:CountdownTab,urlFavorites:UrlFavoritesTab,album:AlbumTab,localFileSearch:LocalFileSearchTab,clipboardHistory:ClipboardHistoryTab,shelf:ShelfTab,settings:SettingsTab,ai:AiTab,overview:OverviewTab,song:SongTab,tools:ToolsTab,performanceMonitor:PerformanceMonitorTab,maxExpandEager:MaxExpandContentEager,maxExpandLazy:MaxExpandContentLazy};
class Boundary extends React.Component{
 constructor(props){super(props);this.state={failed:false};}
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(error){window.auditErrors.push(String(error));}
 render(){return this.state.failed?<div data-failed="true">owned render failure</div>:this.props.children;}
}
function Clipboard(){const state=useClipboardHistoryItems((...args)=>window.auditFeedback.push(args));window.auditState=state;return <div data-ready={state.loaded}>{state.items.length}</div>;}
function Alarm(){const state=useAlarmState();window.auditState=state;return <div data-ready={state.loaded}>{state.alarms.length}</div>;}
function Countdown(){const state=useCountdownItems();window.auditState=state;return <div data-ready={state.loaded}>{state.items.length}</div>;}
function Todo(){const state=useTodos();window.auditState={...state,loaded:true};return <div data-ready="true">{state.todos.length}</div>;}
function Memo(){const state=useMemoTab();window.auditState=state;return <div data-ready={state.loaded}>{state.filteredMemos.length}</div>;}
function Timer(){
 const [timerData,setData]=useState({state:'running',remainingSeconds:60,inputHours:'00',inputMinutes:'01',inputSeconds:'00'});
 const [notificationRef]=useState(()=>({current:(notice)=>window.auditFeedback.push(notice)}));
 const [update]=useState(()=>(patch)=>setData(previous=>({...previous,...patch})));
 const [translate]=useState(()=>(key)=>i18next.t(key));
 useIslandTimerAndAlarm({language:'zh-CN',timerData,setTimerData:update,setNotificationRef:notificationRef,t:translate});
 window.auditState=timerData;window.auditTimerUpdate=update;
 return <div data-ready="true">{timerData.remainingSeconds}</div>;
}
window.auditMount=(mode)=>{window.auditState=null;const Page=pages[mode.slice(5)];root.render(<I18nextProvider i18n={i18next}><Boundary key={mode}>{mode.startsWith('page:')&&Page?<Page key={mode}/>:mode==='clipboard'?<Clipboard key={mode}/>:mode==='alarm'?<Alarm key={mode}/>:mode==='countdown'?<Countdown key={mode}/>:mode==='todo'?<Todo key={mode}/>:mode==='memo'?<Memo key={mode}/>:mode==='timer'?<Timer key={mode}/>:null}</Boundary></I18nextProvider>);};
window.auditLocale=(locale)=>i18next.changeLanguage(locale);
window.auditMount('clipboard');
`);
await build({
 configFile:false,root:fixture,base:'./',publicDir:false,
 plugins:[react.default?react.default():react()],
 resolve:{dedupe:['react','react-dom'],alias:[
  {find:/^react$/,replacement:resolve.resolve('react')},
  {find:/^react\/jsx-runtime$/,replacement:resolve.resolve('react/jsx-runtime')},
  {find:/^react-dom\/client$/,replacement:resolve.resolve('react-dom/client')},
  {find:/^react-dom$/,replacement:resolve.resolve('react-dom')},
  {find:/^i18next$/,replacement:resolve.resolve('i18next')},
  {find:/^react-i18next$/,replacement:resolve.resolve('react-i18next')},
 ]},
 build:{target:'esnext',outDir:path.join(fixture,'output'),emptyOutDir:false}
});
