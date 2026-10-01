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
 * @file fileClipboard.ts
 * @description Windows 标准文件剪贴板，使用 Unicode DROPFILES 和系统管理的共享内存。
 * @author 灵屿
 */

import * as koffi from 'koffi';

const CF_HDROP = 15;
const MAX_FILES = 500;
const MAX_PATH_LENGTH = 32767;
let native: ReturnType<typeof loadNative> | undefined;

function loadNative() {
  const user = koffi.load('user32.dll');
  const kernel = koffi.load('kernel32.dll');
  const shell = koffi.load('shell32.dll');
  return {
    open: user.func('bool __stdcall OpenClipboard(void* owner)'),
    close: user.func('bool __stdcall CloseClipboard()'),
    empty: user.func('bool __stdcall EmptyClipboard()'),
    set: user.func('void* __stdcall SetClipboardData(uint32_t format, void* memory)'),
    get: user.func('void* __stdcall GetClipboardData(uint32_t format)'),
    available: user.func('bool __stdcall IsClipboardFormatAvailable(uint32_t format)'),
    alloc: kernel.func('void* __stdcall GlobalAlloc(uint32_t flags, size_t bytes)'),
    lock: kernel.func('void* __stdcall GlobalLock(void* memory)'),
    unlock: kernel.func('bool __stdcall GlobalUnlock(void* memory)'),
    free: kernel.func('void* __stdcall GlobalFree(void* memory)'),
    query: shell.func('uint32_t __stdcall DragQueryFileW(void* drop, uint32_t index, void* output, uint32_t length)'),
  };
}

function validPath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_PATH_LENGTH
    && !/[\x00-\x1f]/.test(value)
    && /^(?:[a-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+(?:[\\/]|$))/i.test(value);
}

/**
 * 构造带 Unicode 标识和双终止符的标准 DROPFILES 数据。
 * @param paths - 最多 500 个 Windows 绝对路径。
 * @returns 有效数据；路径或总大小不合法时返回 null。
 */
export function buildFileDropBuffer(paths: unknown): Buffer | null {
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_FILES || !paths.every(validPath)) return null;
  const list = Buffer.from(paths.join('\0') + '\0\0', 'utf16le');
  if (list.length > 16 * 1024 * 1024) return null;
  const header = Buffer.alloc(20);
  header.writeUInt32LE(20, 0);
  header.writeUInt32LE(1, 16);
  return Buffer.concat([header, list]);
}

/**
 * 将文件路径交给系统标准 CF_HDROP，成功后内存所有权转移给 Windows。
 * @param paths - Windows 绝对路径列表。
 * @param ownerHandle - 发起复制的 Electron 窗口句柄。
 * @returns 是否成功写入。
 */
export function copyFilesToClipboard(paths: unknown, ownerHandle: Buffer | null): boolean {
  if (process.platform !== 'win32' || !ownerHandle || ![4, 8].includes(ownerHandle.length)) return false;
  const data = buildFileDropBuffer(paths);
  if (!data) return false;
  const owner = ownerHandle.length === 8 ? ownerHandle.readBigUInt64LE() : BigInt(ownerHandle.readUInt32LE());
  if (owner === 0n) return false;
  const api = native ?? (native = loadNative());
  let memory: unknown = null;
  let opened = false;
  let transferred = false;
  try {
    // 先准备内存，再打开并清空剪贴板，减少失败时对已有内容的影响。
    memory = api.alloc(0x42, data.length);
    if (!memory) return false;
    const pointer = api.lock(memory);
    if (!pointer) return false;
    try { koffi.encode(pointer, 'uint8_t', data, data.length); } finally { api.unlock(memory); }
    if (!api.open(owner)) return false;
    opened = true;
    if (!api.empty()) return false;
    transferred = Boolean(api.set(CF_HDROP, memory));
    return transferred;
  } catch {
    return false;
  } finally {
    if (opened) api.close();
    if (memory && !transferred) api.free(memory);
  }
}

/**
 * 读取 Windows 文件剪贴板；DragQueryFileW 同时支持 Unicode 和 ANSI 来源。
 * @returns 文件路径列表；格式不可用、占用或非法时返回空列表。
 */
export function readClipboardFiles(): string[] {
  if (process.platform !== 'win32') return [];
  const api = native ?? (native = loadNative());
  let opened = false;
  try {
    if (!api.available(CF_HDROP) || !api.open(null)) return [];
    opened = true;
    const memory = api.get(CF_HDROP);
    if (!memory) return [];
    const count = api.query(memory, 0xffffffff, null, 0);
    if (count > MAX_FILES) return [];
    const paths: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const length = api.query(memory, index, null, 0);
      if (length < 1 || length > MAX_PATH_LENGTH) return [];
      const output = Buffer.alloc((length + 1) * 2);
      if (api.query(memory, index, output, length + 1) !== length) return [];
      const value = output.subarray(0, length * 2).toString('utf16le');
      if (!validPath(value)) return [];
      paths.push(value);
    }
    return paths;
  } catch {
    return [];
  } finally {
    if (opened) api.close();
  }
}
