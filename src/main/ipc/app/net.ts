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
 * @file net.ts
 * @description 网络请求相关 IPC 处理模块
 * @description 代理渲染进程的网络请求，处理超时和日志记录
 * @author 灵屿
 */

import { ipcMain, net } from 'electron';
import type { RegisterNetIpcHandlersOptions } from './types';
import type { MainLogWriter } from './types';
import { SENSITIVE_HEADER_NAMES, SENSITIVE_BODY_KEYS } from './config/net';
import { isTrustedSender } from '../trustedSender';

const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

function ensureHttpUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function redactHeadersForLog(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(headers).forEach(([name, value]) => {
    if (SENSITIVE_HEADER_NAMES.has(name.toLowerCase())) {
      out[name] = '[REDACTED]';
      return;
    }
    out[name] = value;
  });
  return out;
}

function redactValueDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValueDeep(item));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      if (SENSITIVE_BODY_KEYS.has(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactValueDeep(val);
      }
    });
    return out;
  }
  return value;
}

function redactBodyForLog(body: string | undefined): string {
  if (!body) return '';
  try {
    const parsed = JSON.parse(body) as unknown;
    return JSON.stringify(redactValueDeep(parsed));
  } catch {
    return `[REDACTED_NON_JSON_BODY length=${body.length}]`;
  }
}

function sanitizeHeaderName(name: string): string {
  return name.trim();
}

function sanitizeHeaderValue(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 255) {
      out += value[i];
    }
  }
  return out;
}

function sanitizeRequestHeaders(headers: Record<string, string>, writeMainLog: MainLogWriter): Record<string, string> {
  const safeHeaders: Record<string, string> = {};
  Object.entries(headers).forEach(([rawName, rawValue]) => {
    if (typeof rawName !== 'string') return;
    const name = sanitizeHeaderName(rawName);
    if (!name) return;
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) {
      writeMainLog('warn', `[Net] drop invalid header name: ${rawName}`);
      return;
    }

    const value = sanitizeHeaderValue(String(rawValue ?? ''));
    if (value.length !== String(rawValue ?? '').length) {
      writeMainLog('warn', `[Net] sanitize non-ByteString header value for: ${name}`);
    }
    safeHeaders[name] = value;
  });
  return safeHeaders;
}

/**
 * 注册网络请求相关 IPC 处理器
 * @description 注册网络请求代理的 IPC 事件处理器，支持自定义方法和超时
 * @param options - 配置选项，包含日志写入函数
 */
export function registerNetIpcHandlers(options: RegisterNetIpcHandlersOptions): void {
  ipcMain.handle('net:fetch', async (event, url: string, requestOptions?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  }) => {
    const senderUrl = event.senderFrame?.url ?? '';
    if (!isTrustedSender(event)) {
      options.writeMainLog('warn', `[Net] blocked request from untrusted sender: ${senderUrl || 'unknown'}`);
      return { ok: false, status: 403, body: '' };
    }

    const parsedUrl = ensureHttpUrl(url);
    if (!parsedUrl) {
      options.writeMainLog('warn', `[Net] blocked non-http(s) url: ${url}`);
      return { ok: false, status: 400, body: '' };
    }

    const method = requestOptions?.method || 'GET';
    const headers = sanitizeRequestHeaders(requestOptions?.headers || {}, options.writeMainLog);
    const body = requestOptions?.body;
    const allowsBody = method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD';
    const timeoutMs = typeof requestOptions?.timeoutMs === 'number' && Number.isFinite(requestOptions.timeoutMs) && requestOptions.timeoutMs > 0
      ? Math.max(1, Math.min(Math.floor(requestOptions.timeoutMs), 60000)) : 10000;
    const safeLogUrl = `${parsedUrl.origin}${parsedUrl.pathname}`;
    const safeLogHeaders = redactHeadersForLog(headers);
    const safeLogBody = redactBodyForLog(body);
    options.writeMainLog('info', `[Net] request ${JSON.stringify({ method, url: safeLogUrl, headers: safeLogHeaders, body: safeLogBody, timeoutMs })}`);

    try {
      const result = await new Promise<{ ok: boolean; status: number; body: string }>((resolve) => {
        let settled = false;
        const chunks: Buffer[] = [];
        let responseBytes = 0;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const finish = (value: { ok: boolean; status: number; body: string }): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          chunks.length = 0;
          resolve(value);
        };

        const request = net.request({ method, url: parsedUrl.toString() });
        const abortWith = (value: { ok: boolean; status: number; body: string }): void => {
          // 先固定结果并释放缓存，abort 可能同步触发 error／close。
          finish(value);
          try { request.abort(); } catch {}
        };
        Object.entries(headers).forEach(([name, value]) => {
          try {
            request.setHeader(name, value);
          } catch (error) {
            options.writeMainLog('warn', `[Net] drop header on setHeader failure: ${name}, error=${String(error)}`);
          }
        });

        timeout = setTimeout(() => {
          options.writeMainLog('warn', `[Net] timeout ${JSON.stringify({ method, url: safeLogUrl, headers: safeLogHeaders, body: safeLogBody, timeoutMs })}`);
          abortWith({ ok: false, status: 408, body: 'timeout' });
        }, timeoutMs);

        request.on('response', (response) => {
          if (settled) return;
          const lengthHeader = response.headers?.['content-length'];
          const declaredLength = Number(Array.isArray(lengthHeader) ? lengthHeader[0] : lengthHeader);
          if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
            abortWith({ ok: false, status: 413, body: '' });
            return;
          }
          response.on('data', (chunk: Buffer | string) => {
            if (settled) return;
            const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            responseBytes += bytes.length;
            if (responseBytes > MAX_RESPONSE_BYTES) {
              abortWith({ ok: false, status: 413, body: '' });
              return;
            }
            chunks.push(bytes);
          });
          response.on('end', () => {
            if (settled) return;
            const text = Buffer.concat(chunks).toString('utf-8');
            const status = response.statusCode ?? 0;
            finish({ ok: status >= 200 && status < 300, status, body: text });
          });
          response.on('error', (error) => {
            if (settled) return;
            options.writeMainLog('error', `[Net] response stream error ${JSON.stringify({ method, url: safeLogUrl, error: String(error) })}`);
            finish({ ok: false, status: 0, body: '' });
          });
          response.on('aborted', () => { finish({ ok: false, status: 0, body: '' }); });
          (response as NodeJS.EventEmitter).on('close', () => { if (!settled) finish({ ok: false, status: 0, body: '' }); });
        });

        request.on('error', (error) => {
          if (settled) return;
          options.writeMainLog('error', `[Net] request error ${JSON.stringify({ method, url: safeLogUrl, error: String(error) })}`);
          finish({ ok: false, status: 0, body: '' });
        });
        request.on('abort', () => { finish({ ok: false, status: 0, body: '' }); });

        if (allowsBody && typeof body === 'string') {
          request.write(body);
        }
        request.end();
      });

      options.writeMainLog('info', `[Net] response ${JSON.stringify({ method, url: safeLogUrl, status: result.status, ok: result.ok, bodyLen: result.body?.length ?? 0 })}`);
      return result;
    } catch (err) {
      console.error('[Net] fetch proxy error:', err);
      options.writeMainLog('error', `[Net] error ${JSON.stringify({ method, url: safeLogUrl, headers: safeLogHeaders, body: safeLogBody, timeoutMs, error: String(err) })}`);
      return { ok: false, status: 0, body: '' };
    }
  });
}
