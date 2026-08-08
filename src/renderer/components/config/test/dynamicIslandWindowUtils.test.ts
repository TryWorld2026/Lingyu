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
 * @file dynamicIslandWindowUtils.test.ts
 * @description 单元测试 - dynamicIslandWindowUtils.ts
 * @author 灵屿
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

const { isMouseInWindowMock } = vi.hoisted(() => ({
  isMouseInWindowMock: vi.fn(),
}));

// Store original window.api so we can restore after each test
const originalApi = (globalThis as Record<string, unknown>).window
  ? (globalThis as unknown as { window: { api?: unknown } }).window.api
  : undefined;

beforeEach(() => {
  // Set up window.api in the node test environment
  (globalThis as unknown as { window: Record<string, unknown> }).window = globalThis.window ?? {};
  (globalThis as unknown as { window: { api: Record<string, unknown> } }).window.api = {
    isMouseInWindow: isMouseInWindowMock,
  };
});

describe('isMouseInWindow', () => {
  let isMouseInWindow: () => Promise<boolean>;

  beforeEach(async () => {
    const mod = await import('../dynamicIslandWindowUtils');
    isMouseInWindow = mod.isMouseInWindow;
  });

  describe('mouse inside window', () => {
    it('should return true when mouse is at the center of the window', async () => {
      isMouseInWindowMock.mockResolvedValue(true);

      expect(await isMouseInWindow()).toBe(true);
    });

    it('should return true when mouse is at the top-left corner of the window', async () => {
      isMouseInWindowMock.mockResolvedValue(true);

      expect(await isMouseInWindow()).toBe(true);
    });

    it('should return true when mouse is at the bottom-right corner of the window', async () => {
      isMouseInWindowMock.mockResolvedValue(true);

      expect(await isMouseInWindow()).toBe(true);
    });

    it('should return true when mouse is at the top-right corner of the window', async () => {
      isMouseInWindowMock.mockResolvedValue(true);

      expect(await isMouseInWindow()).toBe(true);
    });

    it('should return true when mouse is at the bottom-left corner of the window', async () => {
      isMouseInWindowMock.mockResolvedValue(true);

      expect(await isMouseInWindow()).toBe(true);
    });

    it('should return true when window is at origin (0,0)', async () => {
      isMouseInWindowMock.mockResolvedValue(true);

      expect(await isMouseInWindow()).toBe(true);
    });
  });

  describe('mouse outside window', () => {
    it('should return false when mouse is to the left of the window', async () => {
      isMouseInWindowMock.mockResolvedValue(false);

      expect(await isMouseInWindow()).toBe(false);
    });

    it('should return false when mouse is to the right of the window', async () => {
      isMouseInWindowMock.mockResolvedValue(false);

      expect(await isMouseInWindow()).toBe(false);
    });

    it('should return false when mouse is above the window', async () => {
      isMouseInWindowMock.mockResolvedValue(false);

      expect(await isMouseInWindow()).toBe(false);
    });

    it('should return false when mouse is below the window', async () => {
      isMouseInWindowMock.mockResolvedValue(false);

      expect(await isMouseInWindow()).toBe(false);
    });

    it('should return false when mouse is far away from the window', async () => {
      isMouseInWindowMock.mockResolvedValue(false);

      expect(await isMouseInWindow()).toBe(false);
    });
  });

  describe('null / undefined API responses', () => {
    it('should return false when getMousePosition returns null', async () => {
      isMouseInWindowMock.mockResolvedValue(false);

      expect(await isMouseInWindow()).toBe(false);
    });

    it('should return false when getWindowBounds returns null', async () => {
      isMouseInWindowMock.mockResolvedValue(false);

      expect(await isMouseInWindow()).toBe(false);
    });

    it('should return false when getMousePosition returns undefined', async () => {
      isMouseInWindowMock.mockResolvedValue(false);

      expect(await isMouseInWindow()).toBe(false);
    });

    it('should return false when getWindowBounds returns undefined', async () => {
      isMouseInWindowMock.mockResolvedValue(false);

      expect(await isMouseInWindow()).toBe(false);
    });

    it('should return false when both return null', async () => {
      isMouseInWindowMock.mockResolvedValue(false);

      expect(await isMouseInWindow()).toBe(false);
    });
  });

  describe('window.api is undefined', () => {
    it('should return false when window.api is undefined', async () => {
      (globalThis as unknown as { window: { api?: unknown } }).window.api = undefined;

      expect(await isMouseInWindow()).toBe(false);
    });
  });

  describe('API throws errors', () => {
    it('should return false when isMouseInWindow rejects', async () => {
      isMouseInWindowMock.mockRejectedValue(new Error('IPC failed'));

      expect(await isMouseInWindow()).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return true when isMouseInWindow returns true', async () => {
      isMouseInWindowMock.mockResolvedValue(true);

      expect(await isMouseInWindow()).toBe(true);
    });

    it('should return false when isMouseInWindow returns false', async () => {
      isMouseInWindowMock.mockResolvedValue(false);

      expect(await isMouseInWindow()).toBe(false);
    });
  });
});
