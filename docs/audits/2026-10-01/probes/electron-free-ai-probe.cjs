/*
 * Lingyu - GPL-3.0-or-later; https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 JNTMTMTM; Copyright (C) 2026 pyisland.com
 * This program is free software under the GNU General Public License, version 3 or later.
 */
/**
 * @file electron-free-ai-probe.cjs
 * @description 自有临时配置下的实际 Electron 功能验收探针，外部调用替代范围见本目录 README。
 * @author 灵屿
 */
const electron = require('electron');
const { app, BrowserWindow } = electron;
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const repo = process.argv[2];
const ts = require(path.join(repo, 'node_modules/typescript'));
const work = fs.mkdtempSync(path.join(__dirname, 'free-ai-native-'));
const configPath = path.join(work, 'lingyu_ai', 'connection.json');
const syntheticKey = 'LINGYU_SYNTHETIC_NATIVE_KEY';
app.setPath('userData', path.join(work, 'profile'));
app.commandLine.appendSwitch('no-proxy-server');
app.disableHardwareAcceleration();

const cache = new Map();
function loadSource(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (id) => {
    if (id === 'electron') return electron;
    if (!id.startsWith('.')) return require(id);
    const destination = path.resolve(path.dirname(filename), id);
    return loadSource(destination + '.ts');
  };
  vm.runInThisContext('(function(require,module,exports){' + compiled + '\n})', { filename })(localRequire, module, module.exports);
  return module.exports;
}
const trust = loadSource(path.join(repo, 'src/main/ipc/trustedSender.ts'));
const ai = loadSource(path.join(repo, 'src/main/ai/ipc.ts'));
const store = loadSource(path.join(repo, 'src/main/ai/connectionStore.ts')).createAiConnectionStore(configPath);
const observations = {
  electronVersion: process.versions.electron, work, requests: [],
  usesActualRenderer: true, usesActualPreload: true, usesActualMainAiSource: true,
  usesActualNetFetchAndSafeStorage: true, realModelInferenceTested: false,
};
let window;
let server;
let cancelSocketClosed = false;
let finished = false;
const deadline = setTimeout(() => finish(1, 'native probe timeout'), 45000);
function finish(code, error) {
  if (finished) return;
  finished = true;
  clearTimeout(deadline);
  if (error) observations.error = error;
  observations.passed = code === 0;
  fs.writeFileSync(path.join(__dirname, 'electron-free-ai-results.json'), JSON.stringify(observations, null, 2));
  console.log(JSON.stringify(observations, null, 2));
  window?.destroy();
  server?.closeAllConnections();
  server?.close();
  app.exit(code);
}
const evaluate = (source) => window.webContents.executeJavaScript(source);
async function waitFor(expression, label) {
  return evaluate('new Promise((resolve,reject)=>{const deadline=Date.now()+10000;const check=()=>{try{if(' + expression + '){resolve(true);return;}}catch{}if(Date.now()>deadline){reject(new Error(' + JSON.stringify(label) + '));return;}setTimeout(check,30);};check();})');
}
async function change(selector, value) {
  await evaluate('(()=>{const element=document.querySelector(' + JSON.stringify(selector) + ');if(!element)throw new Error("missing input");const prototype=element.tagName==="SELECT"?HTMLSelectElement.prototype:element.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,"value").set.call(element,' + JSON.stringify(value) + ');element.dispatchEvent(new Event("input",{bubbles:true}));element.dispatchEvent(new Event("change",{bubbles:true}));return new Promise(resolve=>setTimeout(resolve,40));})()');
}
async function click(selector) {
  await evaluate('document.querySelector(' + JSON.stringify(selector) + ').click()');
}
async function saveForm() {
  await click('.lingyu-ai-connection button[type="submit"]');
  await waitFor('!document.querySelector(".lingyu-ai-connection") && document.querySelector(".lingyu-ai-input") && !document.querySelector(".lingyu-ai-input").disabled', 'configuration save did not return to chat');
}
async function openSettings() {
  await click('.lingyu-ai-header button');
  await waitFor('document.querySelector(".lingyu-ai-fields") && !document.querySelector(".lingyu-ai-fields").disabled', 'configuration form did not load');
}
async function sendChat(text, endType = 'done') {
  const previous = await evaluate('window.auditEvents.length');
  await change('.lingyu-ai-input', text);
  await click('.lingyu-ai-composer button[type="submit"]');
  if (endType) await waitFor('window.auditEvents.slice(' + previous + ').some(event=>event.type===' + JSON.stringify(endType) + ')', 'chat did not finish');
}
async function capture(name) {
  await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,100))))');
  const file = path.join(work, name + '.png');
  fs.writeFileSync(file, (await window.webContents.capturePage()).toPNG());
  return file;
}

app.whenReady().then(async () => {
  server = http.createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      const route = request.url;
      const compatible = route.startsWith('/v1/');
      const authMatches = request.headers.authorization === 'Bearer ' + syntheticKey;
      observations.requests.push({ route, method: request.method, authenticatedWithSyntheticKey: authMatches });
      if (compatible && !authMatches) { response.writeHead(401); response.end('unauthorized synthetic fixture'); return; }
      if (route === '/api/tags') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ models: [{ name: 'native-local-model' }] }));
        return;
      }
      if (route === '/v1/models') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ data: [{ id: 'native-byok-model' }] }));
        return;
      }
      if (route !== '/api/chat' && route !== '/v1/chat/completions') {
        response.writeHead(404); response.end(); return;
      }
      const payload = JSON.parse(body);
      assert.equal(payload.stream, true);
      assert.equal(payload.messages[0].role, 'system');
      assert.match(payload.messages[0].content, /Lingyu AI/);
      assert.equal(payload.messages.some(message => message.content.includes(syntheticKey)), false);
      observations.promptBundledAndKeyExcluded = true;
      const last = payload.messages.at(-1).content;
      const local = route === '/api/chat';
      response.writeHead(200, { 'Content-Type': local ? 'application/x-ndjson; charset=utf-8' : 'text/event-stream; charset=utf-8' });
      if (last === 'cancel-test') {
        response.write('data: ' + JSON.stringify({ choices: [{ delta: { content: '正在生成，可取消' } }] }) + '\r\n\r\n');
        response.on('close', () => { cancelSocketClosed = true; });
        return;
      }
      if (local) {
        response.write(JSON.stringify({ message: { content: '本地中文回复：' }, done: false }) + '\n');
        setTimeout(() => { if (!response.destroyed) response.end(JSON.stringify({ message: { content: '**Lingyu 免费 AI**' }, done: true }) + '\n'); }, 60);
      } else {
        response.write('data: ' + JSON.stringify({ choices: [{ delta: { content: '自带 Key 中文回复：' } }] }) + '\r\n\r\n');
        setTimeout(() => { if (!response.destroyed) response.end('data: ' + JSON.stringify({ choices: [{ delta: { content: '**Lingyu BYOK**' }, finish_reason: 'stop' }] }) + '\r\n\r\ndata: [DONE]\r\n\r\n'); }, 60);
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const fixture = path.join(__dirname, 'free-ai-ui-fixture/output/index.html');
  window = new BrowserWindow({
    show: false, width: 820, height: 680, useContentSize: true,
    webPreferences: { preload: path.join(repo, 'out/preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  window.webContents.on('preload-error', (_event, _path, error) => { observations.preloadError = error.message; });
  window.webContents.on('console-message', (_event, level, message) => { if (level >= 3) observations.rendererError = message; });
  trust.registerTrustedWindow(window, pathToFileURL(fixture).href);
  ai.registerAiIpcHandlers({ configPath });
  await window.loadFile(fixture);
  await waitFor('document.querySelector(".lingyu-ai-fields") && !document.querySelector(".lingyu-ai-fields").disabled', 'initial AI settings did not load');
  await evaluate('window.auditEvents=[];window.api.onAiChatEvent(event=>window.auditEvents.push(event));true;');
  observations.localBridgeOnlyDedicatedMethods = await evaluate('typeof window.api.aiStartChat==="function" && !window.electron.process && !window.electron.ipcRenderer.invoke');
  assert.equal(observations.localBridgeOnlyDedicatedMethods, true);
  await change('#lingyu-ai-endpoint', base);
  await click('.lingyu-ai-connection button[type="button"]');
  await waitFor('document.querySelector("#lingyu-ai-model").value==="native-local-model" && !document.querySelector(".lingyu-ai-fields").disabled', 'Ollama model list did not load');
  await saveForm();
  await sendChat('你好，本地模型');
  observations.localChineseAndMarkdown = await evaluate('document.body.textContent.includes("本地中文回复：") && document.querySelector(".lingyu-ai-message--assistant strong")?.textContent==="Lingyu 免费 AI"');
  assert.equal(observations.localChineseAndMarkdown, true);

  await openSettings();
  await change('#lingyu-ai-provider', 'openai');
  await change('#lingyu-ai-endpoint', base + '/v1');
  await change('#lingyu-ai-key', syntheticKey);
  await change('#lingyu-ai-model', 'native-byok-model');
  await click('.lingyu-ai-connection button[type="button"]');
  await waitFor('document.querySelector("#lingyu-ai-model-list option")?.value==="native-byok-model" && !document.querySelector(".lingyu-ai-fields").disabled', 'BYOK model list did not load');
  await saveForm();
  const publicConfig = await evaluate('window.api.aiGetConfig()');
  const saved = fs.readFileSync(configPath, 'utf8');
  observations.keyEncryptedOnDisk = !saved.includes(syntheticKey) && !!JSON.parse(saved).encryptedKey;
  observations.publicConfigurationOmitsKey = publicConfig.ok && publicConfig.value.hasApiKey && !JSON.stringify(publicConfig).includes(syntheticKey) && !Object.hasOwn(publicConfig.value, 'apiKey');
  observations.mainProcessCanDecryptSyntheticKey = store.getConnection().apiKey === syntheticKey;
  assert.equal(observations.keyEncryptedOnDisk, true);
  assert.equal(observations.publicConfigurationOmitsKey, true);
  assert.equal(observations.mainProcessCanDecryptSyntheticKey, true);
  await sendChat('你好，自带 Key 模型');
  observations.byokChineseAndMarkdown = await evaluate('document.body.textContent.includes("自带 Key 中文回复：") && [...document.querySelectorAll(".lingyu-ai-message--assistant strong")].some(node=>node.textContent==="Lingyu BYOK")');
  assert.equal(observations.byokChineseAndMarkdown, true);
  observations.darkScreenshot = await capture('ai-chat-dark-zh');
  const previous = await evaluate('window.auditEvents.length');
  await sendChat('cancel-test', null);
  await waitFor('window.auditEvents.slice(' + previous + ').some(event=>event.type==="delta")', 'cancel fixture did not stream');
  await click('.lingyu-ai-composer button[type="button"]');
  await waitFor('window.auditEvents.slice(' + previous + ').some(event=>event.type==="done" && event.cancelled)', 'actual cancel did not finish');
  await new Promise((resolve, reject) => {
    const until = Date.now() + 3000;
    const check = () => { if (cancelSocketClosed) resolve(); else if (Date.now() > until) reject(new Error('network stream remained open after cancel')); else setTimeout(check, 30); };
    check();
  });
  observations.cancelClosesActualHttpStream = cancelSocketClosed;
  observations.cancelVisibleInUi = await evaluate('document.body.textContent.includes("已停止") && !document.querySelector(".lingyu-ai-input").disabled');
  assert.equal(observations.cancelVisibleInUi, true);
  await evaluate('window.auditLocale("en-US");document.body.classList.add("light");document.documentElement.dataset.theme="light";');
  await waitFor('document.querySelector(".lingyu-ai-composer button").textContent==="Send"', 'English locale did not update');
  observations.englishLightScreenshot = await capture('ai-chat-light-en');
  observations.noHorizontalOverflow = await evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth && document.querySelector(".lingyu-ai").scrollWidth<=document.querySelector(".lingyu-ai").clientWidth');
  assert.equal(observations.noHorizontalOverflow, true);
  window.setContentSize(420, 650);
  await evaluate('new Promise(resolve=>setTimeout(resolve,80))');
  observations.narrowLayoutFits = await evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth && document.querySelector(".lingyu-ai").scrollWidth<=document.querySelector(".lingyu-ai").clientWidth && document.querySelector(".lingyu-ai-composer button").getBoundingClientRect().right<=innerWidth');
  assert.equal(observations.narrowLayoutFits, true);
  await openSettings();
  observations.narrowSettingsScreenshot = await capture('ai-settings-light-en-narrow');
  await change('#lingyu-ai-endpoint', base + '/another-destination');
  await saveForm();
  const changed = await evaluate('window.api.aiGetConfig()');
  observations.destinationChangeDropsStoredKey = changed.ok && !changed.value.hasApiKey && !store.getConnection().apiKey;
  assert.equal(observations.destinationChangeDropsStoredKey, true);
  assert.equal(observations.preloadError, undefined);
  assert.equal(observations.rendererError, undefined);
  finish(0);
}).catch(error => finish(1, error.stack));
