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
 * @file urlWatcher.test.ts
 * @description urlWatcher 单元测试
 * @author 灵屿
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockBrowserWindow, asBrowserWindow } from '../../test-utils/mockWindow';

/* ------------------------------------------------------------------ */
/*  Mock variables (hoisted so they exist before vi.mock is hoisted)  */
/* ------------------------------------------------------------------ */

const { mockClipboardReadText, mockNetFetch } = vi.hoisted(() => ({
  mockClipboardReadText: vi.fn(),
  mockNetFetch: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Module mocks - only mock electron (external); clipboardUrl is     */
/*  pure functions so we use the real implementation.                 */
/* ------------------------------------------------------------------ */

vi.mock('electron', () => ({
  clipboard: { readText: mockClipboardReadText },
  net: { fetch: mockNetFetch },
  BrowserWindow: class {},
}));

/* ------------------------------------------------------------------ */
/*  Import module under test (after mocks are registered)             */
/* ------------------------------------------------------------------ */

import { handleClipboardChange } from '../urlWatcher';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function createMockReader(chunks: Uint8Array[]) {
  let index = 0;
  return {
    read: vi.fn().mockImplementation(() => {
      if (index < chunks.length) {
        return Promise.resolve({ done: false, value: chunks[index++] });
      }
      return Promise.resolve({ done: true, value: undefined });
    }),
    cancel: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockResponse(options: {
  ok?: boolean;
  status?: number;
  contentType?: string | null;
  chunks?: Uint8Array[];
}) {
  const { ok = true, status = 200, contentType = 'text/html; charset=utf-8', chunks = [] } = options;
  const reader = createMockReader(chunks);
  return {
    ok,
    status,
    headers: { get: vi.fn().mockReturnValue(contentType) },
    body: { getReader: () => reader },
  };
}

function encodeHtml(html: string): Uint8Array {
  return new TextEncoder().encode(html);
}

/** Build default options, always providing a fresh window. */
function defaultOptions(overrides: Partial<{
  getWindow: () => import('electron').BrowserWindow | null;
  getDetectMode: () => 'https-only' | 'http-https' | 'domain-only';
  getBlacklist: () => string[];
}> = {}) {
  return {
    getWindow: overrides.getWindow ?? (() => asBrowserWindow(createMockBrowserWindow())),
    getDetectMode: overrides.getDetectMode ?? (() => 'http-https' as const),
    getBlacklist: overrides.getBlacklist ?? (() => [] as string[]),
  };
}

/**
 * 等取标题链路排空。
 * @description net.fetch 与 reader 均为已解析 Promise，若干轮微任务即可到达 .then。
 */
async function settled(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('urlWatcher', () => {
  beforeEach(() => {
    // 每个用例从空剪贴板开始；handleClipboardChange 依“上一次内容”去重，必须显式提供。
    mockClipboardReadText.mockReturnValue('');
  });

  describe('URL 检测与过滤', () => {
    it('检测到 URL 后获取页面标题并通过 IPC 发送到窗口', async () => {
      const win = createMockBrowserWindow();
      const titleHtml = '<html><head><title>Example Page</title></head></html>';
      mockNetFetch.mockResolvedValue(createMockResponse({ chunks: [encodeHtml(titleHtml)] }));
      mockClipboardReadText.mockReturnValue('visit https://example.com now');

      handleClipboardChange(defaultOptions({ getWindow: () => asBrowserWindow(win) }));
      await settled();

      expect(mockNetFetch).toHaveBeenCalledTimes(1);
      expect(win.webContents.send).toHaveBeenCalledWith('clipboard:urls-detected', {
        urls: expect.arrayContaining([expect.stringContaining('example.com')]),
        title: 'Example Page',
      });
    });

    it('所有 URL 被黑名单过滤后不发送 IPC', async () => {
      mockClipboardReadText.mockReturnValue('visit https://blocked.com now');
      const win = createMockBrowserWindow();

      handleClipboardChange(defaultOptions({
        getWindow: () => asBrowserWindow(win),
        getBlacklist: () => ['blocked.com'],
      }));
      await settled();

      expect(mockNetFetch).not.toHaveBeenCalled();
      expect(win.webContents.send).not.toHaveBeenCalled();
    });

    it('部分 URL 被黑名单过滤后仅发送未被阻止的 URL', async () => {
      const win = createMockBrowserWindow();
      mockNetFetch.mockResolvedValue(createMockResponse({ chunks: [encodeHtml('<title>OK</title>')] }));
      mockClipboardReadText.mockReturnValue('https://blocked.com and https://ok.com');

      handleClipboardChange(defaultOptions({
        getWindow: () => asBrowserWindow(win),
        getBlacklist: () => ['blocked.com'],
      }));
      await settled();

      expect(win.webContents.send).toHaveBeenCalledWith('clipboard:urls-detected', {
        urls: expect.not.arrayContaining([expect.stringContaining('blocked.com')]),
        title: 'OK',
      });
    });

    it('剪贴板无 URL 时不调用 net.fetch', () => {
      mockClipboardReadText.mockReturnValue('no urls here');
      const win = createMockBrowserWindow();

      handleClipboardChange(defaultOptions({ getWindow: () => asBrowserWindow(win) }));

      expect(mockNetFetch).not.toHaveBeenCalled();
      expect(win.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe('页面标题获取', () => {
    it('从 HTML 中提取 title 标签内容', async () => {
      const win = createMockBrowserWindow();
      mockClipboardReadText.mockReturnValue('https://test1.example.com');
      mockNetFetch.mockResolvedValue(
        createMockResponse({ chunks: [encodeHtml('<html><head><title>My Title</title></head></html>')] }),
      );

      handleClipboardChange(defaultOptions({ getWindow: () => asBrowserWindow(win) }));
      await settled();

      expect(win.webContents.send).toHaveBeenCalledWith(
        'clipboard:urls-detected',
        expect.objectContaining({ title: 'My Title' }),
      );
    });

    it('title 标签带属性时仍能提取', async () => {
      const win = createMockBrowserWindow();
      mockClipboardReadText.mockReturnValue('https://test2.example.com');
      mockNetFetch.mockResolvedValue(
        createMockResponse({ chunks: [encodeHtml('<title lang="en">With Attrs</title>')] }),
      );

      handleClipboardChange(defaultOptions({ getWindow: () => asBrowserWindow(win) }));
      await settled();

      expect(win.webContents.send).toHaveBeenCalledWith(
        'clipboard:urls-detected',
        expect.objectContaining({ title: 'With Attrs' }),
      );
    });

    it('HTML 无 title 标签时返回空标题', async () => {
      const win = createMockBrowserWindow();
      mockClipboardReadText.mockReturnValue('https://test3.example.com');
      mockNetFetch.mockResolvedValue(
        createMockResponse({ chunks: [encodeHtml('<html><body>No title here</body></html>')] }),
      );

      handleClipboardChange(defaultOptions({ getWindow: () => asBrowserWindow(win) }));
      await settled();

      expect(win.webContents.send).toHaveBeenCalledWith(
        'clipboard:urls-detected',
        expect.objectContaining({ title: '' }),
      );
    });

    it('title 内容含前后空格时会被 trim', async () => {
      const win = createMockBrowserWindow();
      mockClipboardReadText.mockReturnValue('https://test4.example.com');
      mockNetFetch.mockResolvedValue(
        createMockResponse({ chunks: [encodeHtml('<title>   padded   </title>')] }),
      );

      handleClipboardChange(defaultOptions({ getWindow: () => asBrowserWindow(win) }));
      await settled();

      expect(win.webContents.send).toHaveBeenCalledWith(
        'clipboard:urls-detected',
        expect.objectContaining({ title: 'padded' }),
      );
    });

    it('标题跨越多个 chunk 时正确拼接', async () => {
      const win = createMockBrowserWindow();
      mockClipboardReadText.mockReturnValue('https://test5.example.com');
      const part1 = encodeHtml('<html><ti');
      const part2 = encodeHtml('tle>Split Title</title></html>');
      mockNetFetch.mockResolvedValue(createMockResponse({ chunks: [part1, part2] }));

      handleClipboardChange(defaultOptions({ getWindow: () => asBrowserWindow(win) }));
      await settled();

      expect(win.webContents.send).toHaveBeenCalledWith(
        'clipboard:urls-detected',
        expect.objectContaining({ title: 'Split Title' }),
      );
    });
  });

  describe('fetchPageTitle 边界条件', () => {
    it('响应 status 不 ok 且非 206 时返回空标题', async () => {
      const win = createMockBrowserWindow();
      mockClipboardReadText.mockReturnValue('https://test6.example.com');
      mockNetFetch.mockResolvedValue(createMockResponse({ ok: false, status: 500 }));

      handleClipboardChange(defaultOptions({ getWindow: () => asBrowserWindow(win) }));
      await settled();

      expect(win.webContents.send).toHaveBeenCalledWith(
        'clipboard:urls-detected',
        expect.objectContaining({ title: '' }),
      );
    });

    it('status 206 (Partial Content) 视为有效响应', async () => {
      const win = createMockBrowserWindow();
      mockClipboardReadText.mockReturnValue('https://test7.example.com');
      mockNetFetch.mockResolvedValue(
        createMockResponse({ ok: false, status: 206, chunks: [encodeHtml('<title>Partial</title>')] }),
      );

      handleClipboardChange(defaultOptions({ getWindow: () => asBrowserWindow(win) }));
      await settled();

      expect(win.webContents.send).toHaveBeenCalledWith(
        'clipboard:urls-detected',
        expect.objectContaining({ title: 'Partial' }),
      );
    });

    it('content-type 非 HTML/text 时返回空标题', async () => {
      const win = createMockBrowserWindow();
      mockClipboardReadText.mockReturnValue('https://test8.example.com');
      mockNetFetch.mockResolvedValue(createMockResponse({ contentType: 'application/json' }));

      handleClipboardChange(defaultOptions({ getWindow: () => asBrowserWindow(win) }));
      await settled();

      expect(win.webContents.send).toHaveBeenCalledWith(
        'clipboard:urls-detected',
        expect.objectContaining({ title: '' }),
      );
    });

    it('content-type 为 text/plain 时仍尝试提取标题', async () => {
      const win = createMockBrowserWindow();
      mockClipboardReadText.mockReturnValue('https://test9.example.com');
      mockNetFetch.mockResolvedValue(
        createMockResponse({ contentType: 'text/plain', chunks: [encodeHtml('<title>Plain Title</title>')] }),
      );

      handleClipboardChange(defaultOptions({ getWindow: () => asBrowserWindow(win) }));
      await settled();

      expect(win.webContents.send).toHaveBeenCalledWith(
        'clipboard:urls-detected',
        expect.objectContaining({ title: 'Plain Title' }),
      );
    });

    it('响应 body 为 null 时返回空标题', async () => {
      const win = createMockBrowserWindow();
      mockClipboardReadText.mockReturnValue('https://test10.example.com');
      mockNetFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: vi.fn().mockReturnValue('text/html') },
        body: null,
      });

      handleClipboardChange(defaultOptions({ getWindow: () => asBrowserWindow(win) }));
      await settled();

      expect(win.webContents.send).toHaveBeenCalledWith(
        'clipboard:urls-detected',
        expect.objectContaining({ title: '' }),
      );
    });

    it('content-type header 为 null 时返回空标题', async () => {
      const win = createMockBrowserWindow();
      mockClipboardReadText.mockReturnValue('https://test11.example.com');
      mockNetFetch.mockResolvedValue(createMockResponse({ contentType: null }));

      handleClipboardChange(defaultOptions({ getWindow: () => asBrowserWindow(win) }));
      await settled();

      expect(win.webContents.send).toHaveBeenCalledWith(
        'clipboard:urls-detected',
        expect.objectContaining({ title: '' }),
      );
    });

    it('net.fetch 抛出异常时返回空标题', async () => {
      const win = createMockBrowserWindow();
      mockClipboardReadText.mockReturnValue('https://test12.example.com');
      mockNetFetch.mockRejectedValue(new Error('Network error'));

      handleClipboardChange(defaultOptions({ getWindow: () => asBrowserWindow(win) }));
      await settled();

      expect(win.webContents.send).toHaveBeenCalledWith(
        'clipboard:urls-detected',
        expect.objectContaining({ title: '' }),
      );
    });

    it('标题获取过程中窗口被销毁时不发送 IPC', async () => {
      const win = createMockBrowserWindow();
      mockClipboardReadText.mockReturnValue('https://test13.example.com');
      mockNetFetch.mockResolvedValue(createMockResponse({ chunks: [encodeHtml('<title>Gone</title>')] }));

      // 第一次 getWindow 返回正常窗口，第二次（在 .then 回调中）返回 null
      let callCount = 0;
      const opts = defaultOptions({
        getWindow: () => {
          callCount++;
          return callCount <= 1 ? asBrowserWindow(win) : null;
        },
      });

      handleClipboardChange(opts);
      await settled();

      expect(win.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe('调用前置条件', () => {
    it('窗口为 null 时不处理', () => {
      mockClipboardReadText.mockReturnValue('https://test14.example.com');

      handleClipboardChange(defaultOptions({ getWindow: () => null }));

      expect(mockNetFetch).not.toHaveBeenCalled();
    });

    it('窗口已销毁时不处理', () => {
      mockClipboardReadText.mockReturnValue('https://test15.example.com');

      handleClipboardChange(defaultOptions({
        getWindow: () => asBrowserWindow(createMockBrowserWindow({ isDestroyed: () => true })),
      }));

      expect(mockNetFetch).not.toHaveBeenCalled();
    });

    it('同一文本重复触发只发送一次', async () => {
      const win = createMockBrowserWindow();
      mockNetFetch.mockResolvedValue(createMockResponse({ chunks: [encodeHtml('<title>T</title>')] }));
      mockClipboardReadText.mockReturnValue('https://repeat.com');

      const opts = defaultOptions({ getWindow: () => asBrowserWindow(win) });
      handleClipboardChange(opts);
      await settled();
      handleClipboardChange(opts);
      await settled();

      expect(mockNetFetch).toHaveBeenCalledTimes(1);
      expect(win.webContents.send).toHaveBeenCalledTimes(1);
    });
  });
});