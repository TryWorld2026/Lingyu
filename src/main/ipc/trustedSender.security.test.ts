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
 */

/**
 * @file trustedSender.security.test.ts
 * @description 真实 IPC 门禁与窗口导航的权限边界回归测试
 * @author 灵屿
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';

const { openExternalMock } = vi.hoisted(() => ({ openExternalMock: vi.fn(async () => undefined) }));
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  shell: { openExternal: openExternalMock },
}));

import { isTrustedSender, registerTrustedWindow } from './trustedSender';

const ENTRY_URL = 'file:///C:/lingyu/renderer/DynamicIslandIndex.html';
let nextId = 20000;

function createWindow() {
  const listeners = new Map<string, (event: { url: string; isMainFrame: boolean; preventDefault: () => void }) => void>();
  let closeListener = () => {};
  const window = {
    isDestroyed: () => false,
    once: (_event: string, listener: () => void) => { closeListener = listener; },
    webContents: {
      id: nextId++,
      on: (event: string, listener: (event: { url: string; isMainFrame: boolean; preventDefault: () => void }) => void) => {
        listeners.set(event, listener);
      },
      setWindowOpenHandler: vi.fn(),
    },
  };
  return { window, listeners, close: () => closeListener() };
}

function createEvent(id: number, url: string, subframe = false): IpcMainInvokeEvent {
  const mainFrame = { url };
  return {
    sender: { id, mainFrame, isDestroyed: () => false },
    senderFrame: subframe ? { url } : mainFrame,
  } as unknown as IpcMainInvokeEvent;
}

describe('registered window security boundary', () => {
  beforeEach(() => { openExternalMock.mockClear(); });

  it('rejects a remote page after navigation in a registered window', () => {
    const { window } = createWindow();
    registerTrustedWindow(window as unknown as BrowserWindow, ENTRY_URL);
    expect(isTrustedSender(createEvent(window.webContents.id, 'https://evil.example.com/'))).toBe(false);
  });

  it('rejects unknown windows even for local files and loopback servers', () => {
    expect(isTrustedSender(createEvent(-1, ENTRY_URL))).toBe(false);
    expect(isTrustedSender(createEvent(-1, 'http://localhost:5173/DynamicIslandIndex.html'))).toBe(false);
  });

  it('accepts its exact main entry and rejects other files and subframes', () => {
    const { window } = createWindow();
    registerTrustedWindow(window as unknown as BrowserWindow, ENTRY_URL);
    expect(isTrustedSender(createEvent(window.webContents.id, `${ENTRY_URL}#settings`))).toBe(true);
    expect(isTrustedSender(createEvent(window.webContents.id, 'file:///C:/Downloads/unrelated.html'))).toBe(false);
    expect(isTrustedSender(createEvent(window.webContents.id, ENTRY_URL, true))).toBe(false);
  });

  it('binds a development window to its configured port and entry', () => {
    const { window } = createWindow();
    const entry = 'http://localhost:5173/DynamicIslandIndex.html';
    registerTrustedWindow(window as unknown as BrowserWindow, entry);
    expect(isTrustedSender(createEvent(window.webContents.id, entry))).toBe(true);
    expect(isTrustedSender(createEvent(window.webContents.id, 'http://localhost:9999/DynamicIslandIndex.html'))).toBe(false);
    expect(isTrustedSender(createEvent(window.webContents.id, 'http://localhost:5173/other.html'))).toBe(false);
  });

  it('revokes the entry when the window closes and denies a missing frame', () => {
    const { window, close } = createWindow();
    registerTrustedWindow(window as unknown as BrowserWindow, ENTRY_URL);
    const event = createEvent(window.webContents.id, ENTRY_URL);
    expect(isTrustedSender({ ...event, senderFrame: null })).toBe(false);
    close();
    expect(isTrustedSender(event)).toBe(false);
  });

  it('revokes trust even when Electron has already destroyed the window object', () => {
    const { window, close } = createWindow();
    const event = createEvent(window.webContents.id, ENTRY_URL);
    registerTrustedWindow(window as unknown as BrowserWindow, ENTRY_URL);
    Object.defineProperty(window, 'webContents', {
      get: () => { throw new Error('Object has been destroyed'); },
    });
    expect(close).not.toThrow();
    expect(isTrustedSender(event)).toBe(false);
  });

  it('cancels remote navigation and opens a main-frame web link externally', () => {
    const { window, listeners } = createWindow();
    registerTrustedWindow(window as unknown as BrowserWindow, ENTRY_URL);
    const event = { url: 'https://example.com/', isMainFrame: true, preventDefault: vi.fn() };
    listeners.get('will-frame-navigate')?.(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(openExternalMock).toHaveBeenCalledWith(event.url);
  });

  it('cancels unsafe protocols and redirects without opening external applications', () => {
    const { window, listeners } = createWindow();
    registerTrustedWindow(window as unknown as BrowserWindow, ENTRY_URL);
    const event = { url: 'file:///C:/Downloads/payload.html', isMainFrame: true, preventDefault: vi.fn() };
    listeners.get('will-frame-navigate')?.(event);
    const redirect = { url: 'https://example.com/', isMainFrame: true, preventDefault: vi.fn() };
    listeners.get('will-redirect')?.(redirect);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(redirect.preventDefault).toHaveBeenCalledOnce();
    expect(openExternalMock).not.toHaveBeenCalled();
  });

  it('blocks child-frame navigation without opening a browser', () => {
    const { window, listeners } = createWindow();
    registerTrustedWindow(window as unknown as BrowserWindow, ENTRY_URL);
    const event = { url: 'https://example.com/', isMainFrame: false, preventDefault: vi.fn() };
    listeners.get('will-frame-navigate')?.(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(openExternalMock).not.toHaveBeenCalled();
  });

  it('allows only web URLs through new-window handling', () => {
    const { window } = createWindow();
    registerTrustedWindow(window as unknown as BrowserWindow, ENTRY_URL);
    const handler = window.webContents.setWindowOpenHandler.mock.calls[0]?.[0] as
      ((details: { url: string }) => { action: string }) | undefined;
    expect(handler?.({ url: 'ms-settings:privacy' })).toEqual({ action: 'deny' });
    expect(openExternalMock).not.toHaveBeenCalled();
    expect(handler?.({ url: 'https://example.com/' })).toEqual({ action: 'deny' });
    expect(openExternalMock).toHaveBeenCalledWith('https://example.com/');
  });
});
