/*
 * Lingyu - GPL-3.0-or-later; https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 JNTMTMTM; Copyright (C) 2026 pyisland.com
 * This program is free software under the GNU General Public License, version 3 or later.
 */
/**
 * @file build-free-ai-fixture.mjs
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
const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'free-ai-ui-fixture');
fs.mkdirSync(fixture, { recursive: true });
const source = repo.replaceAll('\\', '/');
fs.writeFileSync(path.join(fixture, 'index.html'), '<!doctype html><html><head><meta charset="UTF-8"><title>Lingyu owned AI fixture</title></head><body><div id="root"></div><script type="module" src="/fixture.tsx"></script></body></html>');
fs.writeFileSync(path.join(fixture, 'fixture.tsx'), [
  "import React from 'react';",
  "import { createRoot } from 'react-dom/client';",
  "import i18next from 'i18next';",
  "import { I18nextProvider } from 'react-i18next';",
  "import { AiTab } from '" + source + "/src/renderer/components/states/maxExpand/components/ai/AiTab.tsx';",
  "import zh from '" + source + "/i18n/zh-CN.json';",
  "import en from '" + source + "/i18n/en-US.json';",
  "import './fixture.css';",
  "await i18next.init({ lng: 'zh-CN', fallbackLng: 'en-US', resources: { 'zh-CN': { translation: zh }, 'en-US': { translation: en } }, interpolation: { escapeValue: false } });",
  "window.auditLocale = (language) => i18next.changeLanguage(language);",
  "createRoot(document.getElementById('root')).render(<I18nextProvider i18n={i18next}><AiTab /></I18nextProvider>);",
].join('\n'));
fs.writeFileSync(path.join(fixture, 'fixture.css'), [
  '* { box-sizing: border-box; }',
  'html, body, #root { width: 100%; height: 100%; margin: 0; }',
  'body { font-family: "Segoe UI", "Microsoft YaHei", sans-serif; background: #1d1e20; --color-text: #ededed; --color-text-rgb: 237,237,237; --color-bg: #1d1e20; color: var(--color-text); }',
  'body.light { background: #f6f6f6; --color-text: #252525; --color-text-rgb: 37,37,37; --color-bg: #f6f6f6; }',
  '#root { display: flex; }',
  '.settings-card-header { display: flex; flex-direction: column; gap: 7px; }',
  '.settings-card-subtitle { margin: 0; font-size: 12px; opacity: .6; line-height: 1.6; }',
].join('\n'));
await build({
  configFile: false, root: fixture, base: './', publicDir: false,
  plugins: [react.default ? react.default() : react()],
  resolve: { dedupe: ['react', 'react-dom'], alias: [
    { find: /^react$/, replacement: resolve.resolve('react') },
    { find: /^react\/jsx-runtime$/, replacement: resolve.resolve('react/jsx-runtime') },
    { find: /^react\/jsx-dev-runtime$/, replacement: resolve.resolve('react/jsx-dev-runtime') },
    { find: /^react-dom\/client$/, replacement: resolve.resolve('react-dom/client') },
    { find: /^react-dom$/, replacement: resolve.resolve('react-dom') },
    { find: /^i18next$/, replacement: resolve.resolve('i18next') },
    { find: /^react-i18next$/, replacement: resolve.resolve('react-i18next') },
  ] },
  build: { target: 'esnext', outDir: path.join(fixture, 'output'), emptyOutDir: false },
});
