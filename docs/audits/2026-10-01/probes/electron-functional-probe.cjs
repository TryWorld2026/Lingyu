/*
 * Lingyu - GPL-3.0-or-later; https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 JNTMTMTM; Copyright (C) 2026 pyisland.com
 * This program is free software under the GNU General Public License, version 3 or later.
 */
/**
 * @file electron-functional-probe.cjs
 * @description 自有临时配置下的实际 Electron 功能验收探针，外部调用替代范围见本目录 README。
 * @author 灵屿
 */
const electron = require('electron');
const {app,BrowserWindow,ipcMain}=electron;
const http=require('node:http');
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const repo=process.argv[2];
const ts=require(path.join(repo,'node_modules/typescript'));
const repoRequire=require('node:module').createRequire(path.join(repo,'package.json'));
const work=fs.mkdtempSync(path.join(__dirname,'functional-native-'));
const storeDir=path.join(work,'store');fs.mkdirSync(storeDir);
app.setPath('userData',path.join(work,'profile'));
app.disableHardwareAcceleration();
const cache=new Map();
function load(filename){
 filename=path.resolve(filename);if(cache.has(filename))return cache.get(filename).exports;
 const module={exports:{}};cache.set(filename,module);
 const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const localRequire=(id)=>id==='electron'?electron:id.startsWith('.')?load(path.resolve(path.dirname(filename),id)+'.ts'):repoRequire(id);
 vm.runInThisContext('(function(require,module,exports){'+compiled+'\n})',{filename})(localRequire,module,module.exports);
 return module.exports;
}
const trust=load(path.join(repo,'src/main/ipc/trustedSender.ts'));
let windows=[], reads=0, holdClipboard=false, pendingClipboard=[];
let server;
const registered=new Set();
const handle=ipcMain.handle.bind(ipcMain);
ipcMain.handle=(channel,listener)=>{registered.add(channel);handle(channel,listener);};
const result={work,electronVersion:process.versions.electron,checks:[],actualReact:true,actualPreload:true,actualMainStore:true};
let finished=false;
const deadline=setTimeout(()=>finish(1,'timeout'),50000);
function finish(code,error){
 if(finished)return;finished=true;clearTimeout(deadline);if(error)result.error=String(error);result.passed=code===0;
 fs.writeFileSync(path.join(__dirname,'electron-functional-results.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));windows.forEach(w=>{if(!w.isDestroyed())w.destroy();});server?.closeAllConnections();server?.close();app.exit(code);
}
const evaluate=(w,source)=>w.webContents.executeJavaScript(source);
const delay=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(w,expression){
 const until=Date.now()+5000;while(Date.now()<until){if(await evaluate(w,expression))return;await delay(35);}throw new Error('Condition not reached: '+expression);
}
async function create(){
 const w=new BrowserWindow({show:false,width:900,height:600,webPreferences:{preload:path.join(repo,'out/preload/index.js'),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 windows.push(w);w.webContents.on('console-message',(_e,level,message)=>{if(level>=3)console.log('renderer: '+message);});
 const entry=path.join(__dirname,'functional-ui-fixture/output/index.html');
 trust.registerTrustedWindow(w,pathToFileURL(entry).href);
 await w.loadFile(entry);await wait(w,'window.auditState && window.auditState.loaded');return w;
}
async function mount(w,mode){await evaluate(w,'window.auditMount('+JSON.stringify(mode)+')');await wait(w,mode==='timer'?'window.auditState && window.auditState.state==="running"':'window.auditState && window.auditState.loaded');await delay(100);}
const save=(key,value)=>fs.writeFileSync(path.join(storeDir,key+'.json'),JSON.stringify(value));
app.whenReady().then(async()=>{
 electron.session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(details,callback)=>{
  callback({cancel:!details.url.startsWith('http://127.0.0.1:')});
 });
 save('clipboard-history-enabled',false);save('clipboard-history-recent',[]);save('alarm-sound-enabled',false);save('alarm-notification-enabled',true);save('alarms',[]);save('countdown-dates',[]);
 load(path.join(repo,'src/main/ipc/app/store.ts')).registerStoreIpcHandlers({storeDir});
 load(path.join(repo,'src/main/ipc/app/net.ts')).registerNetIpcHandlers({writeMainLog:()=>{}});
 const search=load(path.join(repo,'src/main/ipc/app/localFileSearch.ts'));
 trust.handleTrusted('app:search-local-files',(_event,...args)=>search.searchLocalFiles(...args));
 const preloadSource=fs.readFileSync(path.join(repo,'src/preload/index.ts'),'utf8');
 for(const [,channel] of preloadSource.matchAll(/ipcRenderer\.invoke\('([^']+)'/g)){
  if(registered.has(channel)||channel==='clipboard:read-text'||channel==='clipboard:write-text')continue;
  trust.handleTrusted(channel,()=>{
   if(channel==='ai:config:get')return {ok:true,value:{provider:'ollama',endpoint:'http://127.0.0.1:11434',model:'',hasApiKey:false}};
   if(channel==='updater:version')return repoRequire('./package.json').version;
   if(channel.includes('platform'))return 'win32';
   if(channel.includes('bounds'))return {x:0,y:0,width:900,height:600};
   if(channel.includes('running')||channel.includes('devices')||channel.includes('list')||channel.includes('displays')||channel.includes('roots'))return [];
   if(channel.endsWith(':get')||channel.includes('read'))return null;
   return true;
  });
 }
 trust.handleTrusted('clipboard:read-text',()=>{reads++;return holdClipboard?new Promise(resolve=>pendingClipboard.push(resolve)):'Owned clipboard fixture text';});
 trust.handleTrusted('clipboard:write-text',()=>false);
 const one=await create();
 await delay(200);
 assert.equal(reads,0,'history page must not read clipboard before disabled setting has loaded');
 result.checks.push('history-page-disabled-startup-no-clipboard-read');
 await evaluate(one,`window.api.storeWrite('clipboard-history-enabled',true).then(()=>window.dispatchEvent(new CustomEvent('island:setting-changed',{detail:{channel:'clipboard-history-enabled',value:true}})))`);
 await wait(one,'window.auditState.items.some(item=>item.text==="Owned clipboard fixture text")');
 result.checks.push('history-page-enable-records-only-owned-fixture-text');
 holdClipboard=true;
 const pendingUntil=Date.now()+2500;while(!pendingClipboard.length&&Date.now()<pendingUntil)await delay(40);
 assert.ok(pendingClipboard.length,'must hold an actual in-flight IPC');
 await evaluate(one,`window.api.storeWrite('clipboard-history-enabled',false).then(()=>window.dispatchEvent(new CustomEvent('island:setting-changed',{detail:{channel:'clipboard-history-enabled',value:false}})))`);
 pendingClipboard.splice(0).forEach(resolve=>resolve('Owned pending text should be discarded'));
 await delay(1200);
 assert.ok(!JSON.parse(fs.readFileSync(path.join(storeDir,'clipboard-history-recent.json'),'utf8')).some(item=>item.text.includes('pending text')));
 result.checks.push('history-page-disabling-discards-in-flight-IPC');
 await evaluate(one,'window.auditState.handleCopy(window.auditState.items[0])');
 await wait(one,'window.auditFeedback.some(item=>item[0]==="error")');
 result.checks.push('clipboard-write-false-reports-localized-failure');
 await evaluate(one,`window.api.storeWrite('clipboard-history-recent',[]).then(()=>localStorage.setItem('lingyu_clipboard_history_recent','[{"id":7,"text":"Owned stale cached text","createdAt":7}]'))`);
 await evaluate(one,'window.auditMount("none")');await delay(50);await mount(one,'clipboard');
 assert.equal(await evaluate(one,'window.auditState.items.length'),0);
 result.checks.push('cleared-history-is-not-restored-from-stale-cache');
 await mount(one,'alarm');
 await evaluate(one,'window.auditState.setNewLabel("Native alarm");window.auditState.setNewHour(10);');
 await delay(60);await evaluate(one,'window.auditState.addAlarm()');
 await wait(one,'window.auditState.alarms.length===1 && window.auditState.alarms[0].label==="Native alarm"');
 await delay(100);
 const two=await create();await mount(two,'alarm');
 await wait(two,'window.auditState.alarms.length===1');
 await evaluate(two,'window.auditState.startEdit(window.auditState.alarms[0])');await delay(50);
 await evaluate(two,'window.auditState.setEditLabel("Changed from second window")');await delay(50);
 await evaluate(two,'window.auditState.saveEdit()');
 await wait(one,'window.auditState.alarms[0].label==="Changed from second window"');
 result.checks.push('alarm-add-edit-broadcast-between-real-windows');
 await evaluate(one,'window.auditState.toggleEnabled(window.auditState.alarms[0].id)');
 await wait(two,'window.auditState.alarms[0].enabled===false');
 result.checks.push('alarm-toggle-broadcast-between-real-windows');
 await mount(one,'countdown');await mount(two,'countdown');
 await evaluate(one,'window.auditState.setItems([{id:100,title:"A",date:"2026-10-02"}])');
 await wait(two,'window.auditState.items.length===1');
 await evaluate(two,'window.auditState.setItems(previous=>[...previous,{id:200,title:"B",date:"2026-10-03"}])');
 await wait(one,'window.auditState.items.length===2');
 await evaluate(one,'window.auditState.removeItem(100)');
 await wait(two,'window.auditState.items.length===1 && window.auditState.items[0].id===200');
 result.checks.push('countdown-add-delete-broadcast-between-real-windows');
 await evaluate(one,'window.auditState.setItems(previous=>[...previous,{id:300,title:"Queued C",date:"2026-10-04"}]);window.auditState.setItems(previous=>[...previous,{id:400,title:"Queued D",date:"2026-10-05"}]);');
 await wait(two,'window.auditState.items.length===3');
 result.checks.push('rapid-react-list-edits-are-serialized-without-loss');
 await mount(one,'todo');await evaluate(one,'window.auditState.setInput("Owned task with 中文")');await delay(50);
 await evaluate(one,'window.auditState.handleAdd()');await wait(one,'window.auditState.todos.length===1');
 await mount(two,'todo');await wait(two,'window.auditState.todos.length===1');
 await evaluate(two,'window.auditState.toggleDone(window.auditState.todos[0].id)');
 await wait(one,'window.auditState.todos[0].done===true');
 await evaluate(one,'window.auditState.setSubInput("Owned subtask")');await delay(50);
 await evaluate(one,'window.auditState.addSubTodo(window.auditState.todos[0].id)');
 await wait(two,'window.auditState.todos[0].subTodos.length===1');
 await evaluate(two,'window.auditState.removeTodo(window.auditState.todos[0].id)');await wait(one,'window.auditState.todos.length===0');
 result.checks.push('todo-add-complete-subtask-delete-and-broadcast');
 await evaluate(one,`localStorage.setItem('lingyu_todos','[{"id":7,"text":"Owned stale task","done":false,"createdAt":7}]');window.auditMount("none")`);
 await delay(50);await mount(one,'todo');assert.equal(await evaluate(one,'window.auditState.todos.length'),0,'cleared todo list must not resurrect a stale cache');
 result.checks.push('cleared-todos-not-restored-from-stale-cache');
 await evaluate(one,'window.auditMount("page:overview")');await delay(200);
 assert.equal(await evaluate(one,'document.querySelectorAll(".ov-dash-todo-text").length'),0,'overview must not resurrect a cleared task list');
 result.checks.push('overview-cleared-todos-not-restored-from-stale-cache');
 await evaluate(one,'window.auditMount("none")');await evaluate(two,'window.auditMount("none")');await delay(50);
 fs.unlinkSync(path.join(storeDir,'todos.json'));
 await mount(one,'todo');await wait(one,'window.auditState.todos.length===1 && window.auditState.todos[0].id===7');
 assert.equal(JSON.parse(fs.readFileSync(path.join(storeDir,'todos.json'),'utf8'))[0].id,7);
 result.checks.push('missing-todo-file-migrates-owned-legacy-cache');
 await mount(one,'memo');await evaluate(one,'window.auditState.handleAdd()');
 await wait(one,'window.auditState.memos.length===1');
 await evaluate(one,'window.auditState.handleTitleChange(window.auditState.memos[0].id,"Owned memo 中文");window.auditState.handleContentChange(window.auditState.memos[0].id,"# Markdown\\n\\nOwned memo content");');
 await mount(two,'memo');await wait(two,'window.auditState.memos.length===1 && window.auditState.memos[0].title==="Owned memo 中文"');
 await evaluate(two,'window.auditState.handleToggleBookmark(window.auditState.memos[0].id)');await wait(one,'window.auditState.memos[0].bookmarked');
 await evaluate(one,'window.auditState.handleDelete(window.auditState.memos[0].id)');await wait(two,'window.auditState.memos.length===0');
 result.checks.push('memo-create-title-Markdown-bookmark-delete-and-broadcast');
 const koffi=repoRequire('koffi');
 const kernel=koffi.load('kernel32.dll'),shell=koffi.load('shell32.dll');
 const alloc=kernel.func('void* __stdcall GlobalAlloc(uint32_t,size_t)');
 const lock=kernel.func('void* __stdcall GlobalLock(void*)');
 const unlock=kernel.func('bool __stdcall GlobalUnlock(void*)');
 const free=kernel.func('void* __stdcall GlobalFree(void*)');
 const query=shell.func('uint32_t __stdcall DragQueryFileW(void*,uint32_t,void*,uint32_t)');
 const drop=load(path.join(repo,'src/main/clipboard/fileClipboard.ts'));
 const pathCases=[['C:\\测试\\中文 文件.txt','D:\\owned\\two.pdf'],['C:\\owned\\ANSI.txt','D:\\owned\\second.txt']];
 for(let caseIndex=0;caseIndex<pathCases.length;caseIndex++){
  const expected=pathCases[caseIndex];
  const data=caseIndex===0?drop.buildFileDropBuffer(expected):Buffer.concat([Buffer.from([20,0,0,0,...Array(16).fill(0)]),Buffer.from(expected.join('\0')+'\0\0','ascii')]);
  const memory=alloc(0x42,data.length);assert.ok(memory);
  try{
   const ptr=lock(memory);assert.ok(ptr);koffi.encode(ptr,'uint8_t',data,data.length);unlock(memory);
   assert.equal(query(memory,0xffffffff,null,0),expected.length);
   for(let index=0;index<expected.length;index++){
    const length=query(memory,index,null,0),out=Buffer.alloc((length+1)*2);
    assert.equal(query(memory,index,out,length+1),length);assert.equal(out.subarray(0,length*2).toString('utf16le'),expected[index]);
   }
  }finally{free(memory);}
 }
 result.checks.push('real-Win32-DragQueryFileW-decodes-Unicode-and-ANSI-owned-memory');
 result.systemClipboardReadOrOverwritten=false;
 server=http.createServer((request,response)=>{
  if(request.url==='/small'){response.end('中文 network fixture');return;}
  if(request.url==='/large'){response.writeHead(200);for(let i=0;i<17;i++)response.write(Buffer.alloc(1024*1024));response.end();return;}
  if(request.url==='/declared'){response.writeHead(200,{'Content-Length':'20000000','Content-Type':'application/octet-stream'});response.write(Buffer.alloc(65536));return;}
  if(request.url==='/broken'){response.writeHead(200,{'Content-Length':'5000'});response.write('partial');setTimeout(()=>response.destroy(),10);return;}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const endpoint='http://127.0.0.1:'+server.address().port;
 for(const [route,status] of [['/small',200],['/large',413],['/declared',413],['/broken',0],['/timeout',408]]){
  const fetched=await evaluate(one,'window.api.netFetch('+JSON.stringify(endpoint+route)+',{timeoutMs:500})');
  assert.equal(fetched.status,status,'actual Electron network response for '+route);
  if(route==='/small')assert.equal(fetched.body,'中文 network fixture');
 }
 result.checks.push('real-Electron-net-Unicode-size-limit-aborted-stream-and-timeout');
 const files=path.join(work,'owned-files');fs.mkdirSync(files);
 fs.writeFileSync(path.join(files,'中文搜索.txt'),'fixture');fs.writeFileSync(path.join(files,'ignored.tmp'),'fixture');
 const matches=await evaluate(one,'window.api.searchLocalFiles('+JSON.stringify(files)+',"中文",{limit:99999,maxDepth:99999})');
 assert.equal(matches.length,1);assert.equal(matches[0].name,'中文搜索.txt');
 result.checks.push('real-preload-main-file-search-owned-Unicode-path');
 result.pages=[];
 for(const page of ['todo','memo','alarm','countdown','urlFavorites','album','localFileSearch','clipboardHistory','shelf','settings','ai','overview','song','tools','performanceMonitor']){
  await evaluate(one,'window.auditErrors=[];window.auditMount('+JSON.stringify('page:'+page)+')');
  await delay(250);
  const observation=await evaluate(one,'({text:document.getElementById("root").textContent,errors:window.auditErrors,failed:!!document.querySelector("[data-failed]")})');
  assert.equal(observation.failed,false,page+' rendering failed: '+observation.errors.join(';'));
  assert.equal(observation.errors.length,0,page+' asynchronous errors: '+observation.errors.join(';'));
  assert.ok(observation.text.trim().length>0,page+' rendered empty');
  result.pages.push({page,rendered:true});
 }
 result.checks.push('fifteen-actual-tab-components-render-in-real-Electron-with-owned-fixture-IPC');
 result.settingsSections=[];
 await evaluate(one,'window.auditMount("page:settings")');await delay(200);
 for(const locale of ['zh-CN','en-US']){
  await evaluate(one,'window.auditLocale('+JSON.stringify(locale)+').then(()=>true)');await delay(100);
  const count=await evaluate(one,'document.querySelectorAll(".max-expand-settings-sidebar-item").length');
  assert.equal(count,9);
  for(let index=0;index<count;index++){
   const title=await evaluate(one,'document.querySelectorAll(".max-expand-settings-sidebar-item")['+index+'].textContent.trim()');
   await evaluate(one,'document.querySelectorAll(".max-expand-settings-sidebar-item")['+index+'].click()');await delay(100);
   assert.equal(await evaluate(one,'document.querySelectorAll(".max-expand-settings-sidebar-item")['+index+'].classList.contains("active")'),true);
   assert.deepEqual(await evaluate(one,'window.auditErrors'),[],'settings '+locale+' '+title);
   result.settingsSections.push({locale,title,rendered:true});
   const hasSubpages=await evaluate(one,'!!document.querySelector(".settings-page-navigation-toggle")');
   if(hasSubpages){
    await evaluate(one,'document.querySelector(".settings-page-navigation-toggle").getAttribute("aria-expanded")==="true" || document.querySelector(".settings-page-navigation-toggle").click()');await delay(50);
    const subpages=await evaluate(one,'document.querySelectorAll(".settings-page-navigation-item").length');
    if(index===1)assert.equal(subpages,20);else assert.ok(subpages>0);
    result.appSettingsPages??=[];result.settingsSubpages??=[];
    for(let pageIndex=0;pageIndex<subpages;pageIndex++){
     const pageTitle=await evaluate(one,'document.querySelectorAll(".settings-page-navigation-item")['+pageIndex+'].textContent.trim()');
     await evaluate(one,'document.querySelectorAll(".settings-page-navigation-item")['+pageIndex+'].click()');await delay(80);
     assert.deepEqual(await evaluate(one,'window.auditErrors'),[],'app settings '+locale+' '+pageTitle);
     const record={locale,section:title,title:pageTitle,rendered:true};
     result.settingsSubpages.push(record);if(index===1)result.appSettingsPages.push(record);
    }
   }
  }
 }
 result.checks.push('all-nine-settings-sidebar-sections-render-in-Chinese-and-English');
 result.navigation=[];
 for(const mode of ['maxExpandEager','maxExpandLazy']){
  await evaluate(one,'window.auditStore.getState().setMaxExpandTab("todo");window.auditMount("page:'+mode+'");true');
  await wait(one,'document.querySelectorAll(".lingyu-nav-item").length>2');
  await evaluate(one,'Array.from(document.querySelectorAll(".lingyu-nav-item")).find(button=>/AI/.test(button.title)).click();true');
  await wait(one,'!!document.querySelector(".lingyu-ai")');
  assert.equal(await evaluate(one,'window.auditStore.getState().maxExpandTab'),'ai');
  assert.deepEqual(await evaluate(one,'window.auditErrors'),[]);
  await evaluate(one,'Array.from(document.querySelectorAll(".lingyu-nav-item")).find(button=>/Settings/.test(button.title)).click();true');
  await wait(one,'document.querySelectorAll(".max-expand-settings-sidebar-item").length===9');
  result.navigation.push({mode,aiAndSettingsReachedByClick:true});
 }
 result.checks.push('actual-eager-and-lazy-MaxExpand-navigation-reaches-free-AI-and-settings');
 result.externalHardwareAndServicesStubbedInPageSmoke=true;
 await evaluate(one,'window.auditMount("none")');await delay(100);
 await evaluate(one,`(()=>{
 window.auditRealDate=Date;window.auditNow=Date.now();window.auditIntervals=new Map();let nextId=1;
 window.Date=class extends window.auditRealDate{constructor(...args){if(args.length)super(...args);else super(window.auditNow);}static now(){return window.auditNow;}};
 window.auditRealSetInterval=window.setInterval;window.auditRealClearInterval=window.clearInterval;
 window.setInterval=(callback)=>{window.auditIntervals.set(nextId,callback);return nextId++;};
 window.clearInterval=(id)=>window.auditIntervals.delete(id);
 window.auditTick=async(seconds)=>{window.auditNow+=seconds*1000;for(const callback of [...window.auditIntervals.values()])await callback();};
 })()`);
 await mount(one,'timer');
 await evaluate(one,'window.auditTick(2)');await wait(one,'window.auditState.remainingSeconds===58');
 await evaluate(one,'window.auditTick(3)');await wait(one,'window.auditState.remainingSeconds===55');
 await evaluate(one,'window.auditTimerUpdate({state:"paused"})');await wait(one,'window.auditState.state==="paused"');
 await evaluate(one,'window.auditTick(30)');assert.equal(await evaluate(one,'window.auditState.remainingSeconds'),55);
 await evaluate(one,'window.auditTimerUpdate({state:"running"})');await wait(one,'window.auditState.state==="running"');await delay(60);
 await evaluate(one,'window.auditTick(300)');await wait(one,'window.auditState.state==="idle" && window.auditState.remainingSeconds===0');
 assert.equal(await evaluate(one,'window.auditFeedback.filter(item=>item.title).length'),1);
 result.checks.push('timer-real-react-rerender-pause-resume-delayed-finish-once');
 finish(0);
}).catch(error=>finish(1,error.stack));
