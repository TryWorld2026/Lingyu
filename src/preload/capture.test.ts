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
 * @file capture.test.ts
 * @description 截图窗口 preload 的单元测试：验证最小 API 面与隔离/非隔离两种暴露路径
 * @author 灵屿
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

type CaptureSetup = {
  sendMock: ReturnType<typeof vi.fn>;
  invokeMock: ReturnType<typeof vi.fn>;
  onMock: ReturnType<typeof vi.fn>;
  exposeInMainWorldMock: ReturnType<typeof vi.fn>;
  captureApi: CaptureApi;
  handlerMap: Map<string, (...args: unknown[]) => void>;
};

type CaptureApi = {
  onCaptureImage: (cb: (data: unknown) => void) => void;
  complete: (dataURL: string) => void;
  save: (dataURL: string) => void;
  cancel: () => void;
  readStore: (key: string) => Promise<unknown>;
};

type TestWindow = {
  captureApi?: CaptureApi;
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

async function loadCapturePreload(contextIsolated: boolean): Promise<CaptureSetup> {
  vi.resetModules();

  const handlerMap = new Map<string, (...args: unknown[]) => void>();
  const sendMock = vi.fn();
  const invokeMock = vi.fn();
  const onMock = vi.fn((channel: string, handler: (...args: unknown[]) => void) => {
    handlerMap.set(channel, handler);
  });
  const exposeInMainWorldMock = vi.fn();

  vi.doMock('electron', () => ({
    contextBridge: { exposeInMainWorld: exposeInMainWorldMock },
    ipcRenderer: {
      send: sendMock,
      invoke: invokeMock,
      on: onMock,
    },
  }));

  Object.defineProperty(process, 'contextIsolated', {
    value: contextIsolated,
    configurable: true,
  });

  installTestWindow();

  await import('./capture');

  const call = exposeInMainWorldMock.mock.calls.find(([name]) => name === 'captureApi');
  const captureApi = (call?.[1] ?? installTestWindow().captureApi) as CaptureApi;

  return { sendMock, invokeMock, onMock, exposeInMainWorldMock, captureApi, handlerMap };
}

describe('capture preload', () => {
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

  it('exposes only captureApi through the context bridge', async () => {
    const setup = await loadCapturePreload(true);

    expect(setup.exposeInMainWorldMock).toHaveBeenCalledTimes(1);
    expect(setup.exposeInMainWorldMock).toHaveBeenCalledWith('captureApi', expect.any(Object));
  });

  it('assigns captureApi to window in non-isolated mode', async () => {
    await loadCapturePreload(false);

    expect(typeof installTestWindow().captureApi).toBe('object');
  });

  it('forwards capture-image subscription and callback payload', async () => {
    const setup = await loadCapturePreload(true);

    const callback = vi.fn();
    setup.captureApi.onCaptureImage(callback);

    expect(setup.onMock).toHaveBeenCalledWith('capture-image', expect.any(Function));

    const handler = setup.handlerMap.get('capture-image');
    const payload = { imageBytes: new Uint8Array([1, 2, 3]), scaleFactor: 1.5 };
    handler?.({}, payload);

    expect(callback).toHaveBeenCalledWith(payload);
  });

  it('forwards complete / save / cancel as ipc sends', async () => {
    const setup = await loadCapturePreload(true);

    setup.captureApi.complete('data:image/png;base64,AAA');
    expect(setup.sendMock).toHaveBeenCalledWith('capture-complete', {
      dataURL: 'data:image/png;base64,AAA',
    });

    setup.captureApi.save('data:image/png;base64,BBB');
    expect(setup.sendMock).toHaveBeenCalledWith('capture-save', { dataURL: 'data:image/png;base64,BBB' });

    setup.captureApi.cancel();
    expect(setup.sendMock).toHaveBeenCalledWith('capture-cancel');
    expect(setup.sendMock).toHaveBeenCalledTimes(3);
  });

  it('forwards readStore as an invoke', async () => {
    const setup = await loadCapturePreload(true);
    setup.invokeMock.mockResolvedValue('zh-CN');

    await expect(setup.captureApi.readStore('language')).resolves.toBe('zh-CN');
    expect(setup.invokeMock).toHaveBeenCalledWith('store:read', 'language');
  });
});
