/*
 * Lingyu - GPL-3.0-or-later; https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 JNTMTMTM; Copyright (C) 2026 pyisland.com
 * This program is free software under the GNU General Public License, version 3 or later.
 */
/**
 * @file electron-packaged-probe.cjs
 * @description 自有临时配置下的实际 Electron 功能验收探针，外部调用替代范围见本目录 README。
 * @author 灵屿
 */
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const repo=process.argv[2],packed=process.argv[3],resources=path.join(packed,'resources');
const archive=path.join(resources,'app.asar'),repoRequire=require('node:module').createRequire(path.join(repo,'package.json'));
const packedRequire=require('node:module').createRequire(path.join(archive,'package.json'));
const work=fs.mkdtempSync(path.join(__dirname,'packaged-native-'));
app.setPath('userData',path.join(work,'profile'));app.disableHardwareAcceleration();
Object.defineProperty(process,'resourcesPath',{value:resources});
const result={work,electronVersion:process.versions.electron,packed,loadsActualPackagedModules:true,launchesActualPackagedMain:false,changesHardwareSettings:false,plugins:[],helpers:[]};
app.whenReady().then(async()=>{
 const packageInfo=packedRequire('./package.json');
 for(const name of Object.keys(packageInfo.dependencies).filter(name=>name.startsWith('@lingyu/'))){
  try{const module=packedRequire(name);result.plugins.push({name,loaded:true,path:packedRequire.resolve(name),exports:Object.getOwnPropertyNames(module)});}
  catch(error){result.plugins.push({name,loaded:false,error:String(error)});}
 }
 for(const name of ['koffi','get-windows']){
  try{
   const module=packedRequire(name);result.plugins.push({name,loaded:true,path:packedRequire.resolve(name),exports:Object.getOwnPropertyNames(module)});
   if(name==='koffi')assert.ok(module.load('user32.dll'));
  }catch(error){result.plugins.push({name,loaded:false,error:String(error)});}
 }
 for(const [name,method] of [['@lingyu/windows-volume-helper','getVolume'],['@lingyu/windows-brightness-helper','getBrightness'],['@lingyu/windows-power-helper','getPowerInfo']]){
  try{const module=packedRequire(name),value=module[method]?.();result.plugins.find(plugin=>plugin.name===name).query={method,returnedValue:value!==null&&value!==undefined};}
  catch(error){result.plugins.find(plugin=>plugin.name===name).query={method,error:String(error)};}
 }
 for(const [folder,name] of [['volume','LingyuVolumeHelper'],['brightness','LingyuBrightnessReader'],['performance','LingyuTemperatureReader']]){
  const root=path.join(resources,'helpers',folder),config=JSON.parse(fs.readFileSync(path.join(root,name+'.runtimeconfig.json'),'utf8'));
  const files=[name+'.exe',name+'.dll',name+'.deps.json','coreclr.dll','hostfxr.dll','hostpolicy.dll','System.Private.CoreLib.dll'];
  result.helpers.push({folder,selfContained:Array.isArray(config.runtimeOptions?.includedFrameworks),requiredFilesPresent:files.every(file=>fs.existsSync(path.join(root,file)))});
 }
 result.assets={
  preloadPresent:fs.existsSync(path.join(archive,'out/preload/index.js')),
  rendererPresent:['DynamicIslandIndex','DynamicIslandStandalone','DynamicIslandSplash','DynamicIslandGuide','DynamicIslandAibackground'].every(name=>fs.existsSync(path.join(archive,'out/renderer',name+'.html'))),
  ffmpegPresent:fs.existsSync(path.join(resources,'ffmpeg/ffmpeg.exe')),
  iconPresent:fs.existsSync(path.join(resources,'icon/lingyu_256x256.ico')),
  capturePresent:['capture.html','capture.js','capture.css'].every(file=>fs.existsSync(path.join(resources,file))),
 };
 const outputFiles=[];
 const walk=(root)=>{for(const entry of fs.readdirSync(root,{withFileTypes:true})){if(entry.name==='.vite')continue;const file=path.join(root,entry.name);if(entry.isDirectory())walk(file);else if(entry.isFile())outputFiles.push(path.relative(repo,file));}};
 walk(path.join(repo,'out'));
 result.outputFileCount=outputFiles.length;
 result.outputMatchesBuild=outputFiles.every(file=>fs.existsSync(path.join(archive,file))&&fs.readFileSync(path.join(repo,file)).equals(fs.readFileSync(path.join(archive,file))));
 const resedit=repoRequire('resedit'),exe=resedit.NtExecutable.from(fs.readFileSync(path.join(packed,'Lingyu.exe')));
 const entries=resedit.NtExecutableResource.from(exe).entries,version=resedit.Resource.VersionInfo.fromEntries(entries)[0];
 result.version={package:packageInfo.version,fileVersionMS:version.fixedInfo.fileVersionMS,fileVersionLS:version.fixedInfo.fileVersionLS,strings:version.getStringValues(version.getAllLanguagesForStringValues()[0])};
 assert.equal(result.version.fileVersionMS,3);assert.equal(result.version.fileVersionLS,8<<16);
 assert.equal(result.version.strings.ProductName,'Lingyu');
 result.passed=result.outputMatchesBuild&&result.plugins.every(plugin=>plugin.loaded)&&result.helpers.every(helper=>helper.selfContained&&helper.requiredFilesPresent)&&Object.values(result.assets).every(Boolean);
 fs.writeFileSync(path.join(__dirname,'electron-packaged-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));app.exit(result.passed?0:1);
}).catch(error=>{result.passed=false;result.error=String(error);fs.writeFileSync(path.join(__dirname,'electron-packaged-results.json'),JSON.stringify(result,null,2));console.error(error);app.exit(1);});
