/*
 * 灵屿 Lingyu - 免费开源的 Windows 桌面灵动岛（基于 eIsland 二次开发）
 * https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3, or (at your option) any later version.
 */

/**
 * @file fileClipboard.win32.test.ts
 * @description 用真实 Win32 DragQueryFileW 解析 buildFileDropBuffer 的产出字节，
 *              补齐 LY-05 缺的「与资源管理器互通」验证；全程不碰真实剪贴板。
 * @author 灵屿
 */

import koffi from 'koffi';
import { describe, expect, it } from 'vitest';

import { buildFileDropBuffer } from './fileClipboard';

type Win32 = {
  alloc: (flags: number, bytes: number) => bigint | null;
  lock: (memory: unknown) => unknown;
  unlock: (memory: unknown) => boolean;
  free: (memory: unknown) => boolean;
  query: (drop: unknown, index: number, output: Buffer | null, length: number) => number;
};

const GMEM_MOVEABLE = 0x42;
const COUNT_MARKER = 0xffffffff;

let cached: Win32 | undefined;

/** 只在首次调用时加载真实 Win32 函数，避免每个用例重复 load。 */
function win32(): Win32 {
  if (cached) return cached;
  const user = koffi.load('user32.dll');
  const kernel = koffi.load('kernel32.dll');
  const shell = koffi.load('shell32.dll');
  cached = {
    alloc: kernel.func('void* __stdcall GlobalAlloc(uint32_t flags, size_t bytes)'),
    lock: kernel.func('void* __stdcall GlobalLock(void* memory)'),
    unlock: kernel.func('bool __stdcall GlobalUnlock(void* memory)'),
    free: kernel.func('bool __stdcall GlobalFree(void* memory)'),
    query: shell.func('uint32_t __stdcall DragQueryFileW(void* drop, uint32_t index, void* output, uint32_t length)'),
  };
  // user32 一并加载，确保缺失 DLL 时在这里就失败而不是在用例里。
  user.func('bool __stdcall OpenClipboard(void* owner)');
  return cached;
}

/**
 * 把 DROPFILES 字节装进可移动全局内存，交给系统 API 解析后释放。
 * @param data - DROPFILES 字节。
 * @returns DragQueryFileW 返回的文件路径列表。
 */
function parseWithSystem(data: Buffer): string[] {
  const api = win32();
  const memory = api.alloc(GMEM_MOVEABLE, data.length);
  expect(memory).toBeTruthy();
  const pointer = api.lock(memory);
  expect(pointer).toBeTruthy();
  try {
    koffi.encode(pointer, 'uint8_t', data, data.length);
  } finally {
    api.unlock(memory);
  }

  try {
    const count = api.query(memory, COUNT_MARKER, null, 0);
    const paths: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const length = api.query(memory, index, null, 0);
      const output = Buffer.alloc((length + 1) * 2);
      expect(api.query(memory, index, output, length + 1)).toBe(length);
      paths.push(output.subarray(0, length * 2).toString('utf16le'));
    }
    return paths;
  } finally {
    api.free(memory);
  }
}

// 依赖真实 Win32，非 Windows 平台没有可比对象。
const platform = process.platform === 'win32' ? describe : describe.skip;

platform('buildFileDropBuffer 与真实 DragQueryFileW 的互通', () => {
  it('单个与多个中文路径都能被解析成完整路径', () => {
    const paths = ['C:\\测试\\文档.txt', 'D:\\two files\\other.pdf'];
    const data = buildFileDropBuffer(paths);
    expect(data).not.toBeNull();
    expect(parseWithSystem(data as Buffer)).toEqual(paths);
  });

  it('Unicode 头部标记为 fWide=1，所以解析不会把一条路径拆成多个文件', () => {
    const paths = ['C:\\测试\\文档.txt'];
    const data = buildFileDropBuffer(paths) as Buffer;
    expect(data.readUInt32LE(0)).toBe(20);
    // offset 16 的 fWide 必须是 1；当年漏掉它时一条路径被解析成 22 个文件、首项为 "C"。
    expect(data.readUInt32LE(16)).toBe(1);
    expect(parseWithSystem(data)).toEqual(paths);
  });

  it('路径列表以双终止符结束，所以文件数不会多算一个空项', () => {
    const data = buildFileDropBuffer(['C:\\owned.txt']) as Buffer;
    const parsed = parseWithSystem(data);
    expect(parsed).toHaveLength(1);
    expect(data.subarray(20).toString('utf16le').endsWith('\0\0')).toBe(true);
  });

  it('外部 ANSI 来源的 DROPFILES 同样能被解析', () => {
    // fWide=0 表示路径按 ANSI 存放，这是其它应用写入的情况；DragQueryFileW 仍应给出可用路径。
    // 这里用 ASCII 路径：ANSI 代码页随系统变化（中文 Windows 是 GBK），非 ASCII 的互通属于
    // 写入方编码问题，Unicode 路径的互通由上一条 fWide=1 用例覆盖。
    const paths = ['C:\\legacy\\ansi.txt', 'D:\\second.txt'];
    const list = Buffer.from(paths.join('\0') + '\0\0', 'latin1');
    const header = Buffer.alloc(20);
    header.writeUInt32LE(20, 0);
    header.writeUInt32LE(0, 16);
    expect(parseWithSystem(Buffer.concat([header, list]))).toEqual(paths);
  });

  it('路径超限或非法时不出可用数据', () => {
    expect(buildFileDropBuffer(['relative.txt'])).toBeNull();
    expect(buildFileDropBuffer(['C:\\bad\0path'])).toBeNull();
    expect(buildFileDropBuffer([])).toBeNull();
    const tooLong = ['C:', 'x'.repeat(32768), '.txt'].join('');
    expect(buildFileDropBuffer([tooLong])).toBeNull();
  });
});
