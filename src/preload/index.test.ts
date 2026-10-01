/*
 * 灵屿 Lingyu - 免费开源的 Windows 桌面灵动岛（基于 eIsland 二次开发）
 * https://github.com/JNTMTMTM/eIsland
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 *
 * Original author: JNTMTMTM[](https://github.com/JNTMTMTM)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

/**
 * @file index.test.ts
 * @description 单元测试文件
 * @author 灵屿
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

type PreloadSetup = {
  sendMock: ReturnType<typeof vi.fn>;
  invokeMock: ReturnType<typeof vi.fn>;
  onMock: ReturnType<typeof vi.fn>;
  removeListenerMock: ReturnType<typeof vi.fn>;
  exposeInMainWorldMock: ReturnType<typeof vi.fn>;
  getPathForFileMock: ReturnType<typeof vi.fn>;
  handlerMap: Map<string, (...args: unknown[]) => void>;
};

type TestWindow = {
  electron?: unknown;
  api?: ExposedApi;
};

type ExposedApi = {
  enableMousePassthrough: () => void;
  getMousePosition: () => Promise<unknown>;
  mediaGetMuted: () => Promise<boolean | null>;
  mediaToggleMuted: () => Promise<boolean | null>;
  onNowPlayingInfo: (callback: (payload: unknown) => void) => () => void;
  getPathForFile: (file: File) => string;
  windowClose: () => void;
};

const installTestWindow = (): TestWindow => {
  const current = (globalThis as { window?: unknown }).window;
  if (current && typeof current === 'object') return current as TestWindow;
  Object.defineProperty(globalThis, 'window', {
    value: {},
    configurable: true,
    writable: true,
  });
  return (globalThis as { window: unknown }).window as TestWindow;
};

const originalContextIsolated = Object.getOwnPropertyDescriptor(process, 'contextIsolated');

async function loadPreloadWithContextIsolation(contextIsolated: boolean): Promise<PreloadSetup> {
  vi.resetModules();

  const handlerMap = new Map<string, (...args: unknown[]) => void>();
  const sendMock = vi.fn();
  const invokeMock = vi.fn();
  const onMock = vi.fn((channel: string, handler: (...args: unknown[]) => void) => {
    handlerMap.set(channel, handler);
  });
  const removeListenerMock = vi.fn();
  const exposeInMainWorldMock = vi.fn();
  const getPathForFileMock = vi.fn(() => 'C:/mock/file.txt');
  const electronAPI = {
    platform: 'mock',
    ipcRenderer: { send: sendMock, invoke: invokeMock, on: onMock },
    process: { env: { LINGYU_AUDIT_SENTINEL: 'synthetic-only' } },
  };

  vi.doMock('electron', () => ({
    contextBridge: { exposeInMainWorld: exposeInMainWorldMock },
    ipcRenderer: {
      send: sendMock,
      invoke: invokeMock,
      on: onMock,
      removeListener: removeListenerMock,
    },
    webUtils: {
      getPathForFile: getPathForFileMock,
    },
  }));

  vi.doMock('@electron-toolkit/preload', () => ({
    electronAPI,
  }));

  Object.defineProperty(process, 'contextIsolated', {
    value: contextIsolated,
    configurable: true,
  });

  installTestWindow();

  await import('./index');

  return {
    sendMock,
    invokeMock,
    onMock,
    removeListenerMock,
    exposeInMainWorldMock,
    getPathForFileMock,
    handlerMap,
  };
}

describe('preload bridge', () => {
  it('provides dedicated free AI methods and strips the Electron event from chat callbacks', async () => {
    const setup = await loadPreloadWithContextIsolation(true);
    const api = setup.exposeInMainWorldMock.mock.calls.find(([name]) => name === 'api')?.[1] as {
      aiGetConfig: () => Promise<unknown>;
      aiSaveConfig: (input: unknown) => Promise<unknown>;
      aiListModels: () => Promise<unknown>;
      aiStartChat: (request: unknown) => Promise<unknown>;
      aiAbortChat: (requestId: string) => Promise<unknown>;
      onAiChatEvent: (callback: (data: unknown) => void) => () => void;
    };
    expect(typeof api.aiGetConfig).toBe('function');
    await api.aiGetConfig();
    expect(setup.invokeMock).toHaveBeenCalledWith('ai:config:get');
    const config = { provider: 'ollama', endpoint: 'http://127.0.0.1:11434', model: 'local-model' };
    await api.aiSaveConfig(config);
    expect(setup.invokeMock).toHaveBeenCalledWith('ai:config:set', config);
    await api.aiListModels();
    expect(setup.invokeMock).toHaveBeenCalledWith('ai:models:list');
    const request = { requestId: 'owned-request', messages: [{ role: 'user', content: 'hello' }] };
    await api.aiStartChat(request);
    expect(setup.invokeMock).toHaveBeenCalledWith('ai:chat:start', request);
    await api.aiAbortChat('owned-request');
    expect(setup.invokeMock).toHaveBeenCalledWith('ai:chat:abort', 'owned-request');
    const callback = vi.fn();
    const unsubscribe = api.onAiChatEvent(callback);
    const event = { requestId: 'owned-request', type: 'delta', text: 'response' };
    setup.handlerMap.get('ai:chat:event')?.({ privileged: true }, event);
    expect(callback).toHaveBeenCalledWith(event);
    unsubscribe();
    expect(setup.removeListenerMock).toHaveBeenCalledWith('ai:chat:event', expect.any(Function));
  });

  beforeEach(() => {
    installTestWindow();
  });

  afterAll(() => {
    if (originalContextIsolated) {
      Object.defineProperty(process, 'contextIsolated', originalContextIsolated);
      return;
    }
    Reflect.deleteProperty(process, 'contextIsolated');
  });

  it('does not expose environment variables or generic IPC invoke', async () => {
    const setup = await loadPreloadWithContextIsolation(true);
    const bridge = setup.exposeInMainWorldMock.mock.calls.find(([name]) => name === 'electron')?.[1] as {
      process?: unknown;
      ipcRenderer: { invoke?: unknown };
    };
    expect(bridge.process).toBeUndefined();
    expect(bridge.ipcRenderer.invoke).toBeUndefined();
  });

  it('allows only lifecycle send channels and subscribes only to splash fade-out', async () => {
    const setup = await loadPreloadWithContextIsolation(true);
    const bridge = setup.exposeInMainWorldMock.mock.calls.find(([name]) => name === 'electron')?.[1] as {
      ipcRenderer: {
        send: (channel: string) => void;
        on: (channel: string, callback: () => void) => () => void;
      };
    };
    bridge.ipcRenderer.send('app:quit');
    bridge.ipcRenderer.on('settings:changed', vi.fn());
    expect(setup.sendMock).not.toHaveBeenCalled();
    expect(setup.onMock).not.toHaveBeenCalledWith('settings:changed', expect.any(Function));

    bridge.ipcRenderer.send('guide:complete');
    expect(setup.sendMock).toHaveBeenCalledWith('guide:complete');
    const callback = vi.fn();
    const unsubscribe = bridge.ipcRenderer.on('splash:fade-out', callback);
    setup.handlerMap.get('splash:fade-out')?.({}, 'ignored event payload');
    expect(callback).toHaveBeenCalledWith();
    unsubscribe();
    expect(setup.removeListenerMock).toHaveBeenCalledWith('splash:fade-out', expect.any(Function));
  });

  it('exposes electron and api in context isolated mode and proxies ipc calls', async () => {
    const setup = await loadPreloadWithContextIsolation(true);

    expect(setup.exposeInMainWorldMock).toHaveBeenCalledWith('electron', {
      ipcRenderer: { send: expect.any(Function), on: expect.any(Function) },
    });

    const apiCall = setup.exposeInMainWorldMock.mock.calls.find(([name]) => name === 'api');
    expect(apiCall).toBeTruthy();

    const api = apiCall?.[1] as ExposedApi;

    api.enableMousePassthrough();
    expect(setup.sendMock).toHaveBeenCalledWith('window:enable-mouse-passthrough');

    setup.invokeMock.mockResolvedValue({ x: 100, y: 200 });
    await api.getMousePosition();
    expect(setup.invokeMock).toHaveBeenCalledWith('window:get-mouse-position');

    await api.mediaGetMuted();
    expect(setup.invokeMock).toHaveBeenCalledWith('media:get-muted');

    await api.mediaToggleMuted();
    expect(setup.invokeMock).toHaveBeenCalledWith('media:toggle-muted');

    const callback = vi.fn();
    const unsubscribe = api.onNowPlayingInfo(callback);
    const handler = setup.handlerMap.get('nowplaying:info');
    handler?.({}, { title: 't' });
    expect(callback).toHaveBeenCalledWith({ title: 't' });

    unsubscribe();
    expect(setup.removeListenerMock).toHaveBeenCalledWith('nowplaying:info', expect.any(Function));

    api.getPathForFile({} as File);
    expect(setup.getPathForFileMock).toHaveBeenCalledTimes(1);
  });

  it('assigns electron and api to window in non-isolated mode', async () => {
    const setup = await loadPreloadWithContextIsolation(false);
    const exposedWindow = installTestWindow();

    expect(exposedWindow.electron).toEqual({
      ipcRenderer: { send: expect.any(Function), on: expect.any(Function) },
    });
    expect(typeof exposedWindow.api).toBe('object');

    exposedWindow.api?.windowClose();
    expect(setup.sendMock).toHaveBeenCalledWith('window:close');
    expect(setup.exposeInMainWorldMock).not.toHaveBeenCalled();
  });
});
