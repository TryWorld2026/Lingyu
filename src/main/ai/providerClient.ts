/*
 * 灵屿 Lingyu - 免费开源的 Windows 桌面灵动岛（基于 eIsland 二次开发）
 * https://github.com/TryWorld2026/Lingyu
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 * Original author: JNTMTMTM (https://github.com/JNTMTMTM)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3, or (at your option) any later version.
 */

/**
 * @file providerClient.ts
 * @description Ollama 与 OpenAI 兼容协议；直接连接用户选定服务并限制响应资源。
 * @author 灵屿
 */

import { net } from 'electron';
import type { AiConnection, AiMessage } from '../../shared/ai';
import { AiError } from './aiError';

interface ProviderMessage {
  role: AiMessage['role'] | 'system';
  content: string;
}

interface ProviderPayload {
  error?: unknown;
  models?: Array<{ name?: unknown }>;
  data?: Array<{ id?: unknown }>;
  message?: { content?: unknown };
  choices?: Array<{ message?: { content?: unknown }; delta?: { content?: unknown }; finish_reason?: unknown }>;
  done?: boolean;
}

const MODEL_LIST_LIMIT = 1024 * 1024;
const CHAT_RESPONSE_LIMIT = 8 * 1024 * 1024;
const EVENT_LIMIT = 1024 * 1024;

function parsePayload(text: string): ProviderPayload {
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AiError('invalid-response');
    const payload = value as ProviderPayload;
    if (payload.choices !== undefined && (!Array.isArray(payload.choices)
      || payload.choices.some((choice) => !choice || typeof choice !== 'object' || Array.isArray(choice)))) {
      throw new AiError('invalid-response');
    }
    if (payload.done !== undefined && typeof payload.done !== 'boolean') throw new AiError('invalid-response');
    return payload;
  } catch {
    throw new AiError('invalid-response');
  }
}

async function request(connection: AiConnection, path: string, signal: AbortSignal, body?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (connection.provider === 'openai') {
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(connection.endpoint).hostname);
    if (!connection.apiKey && !loopback) throw new AiError('missing-key');
    if (connection.apiKey) headers.Authorization = 'Bearer ' + connection.apiKey;
  }
  let response: Response;
  try {
    response = await net.fetch(connection.endpoint + path, {
      method: body === undefined ? 'GET' : 'POST', headers, body, signal, redirect: 'error',
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new AiError('network');
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new AiError('http-error', response.status);
  }
  return response;
}

async function readBoundedText(response: Response, limit: number): Promise<string> {
  if (!response.body) throw new AiError('invalid-response');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) return text + decoder.decode();
      bytes += result.value.byteLength;
      if (bytes > limit) throw new AiError('response-too-large');
      text += decoder.decode(result.value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/**
 * 获取所选服务的模型列表，不依赖账号或会员资格。
 * @param connection - 主进程连接配置。
 * @param signal - 取消信号。
 * @returns 去重后的模型名称列表。
 */
export async function listAiModels(connection: AiConnection, signal: AbortSignal): Promise<string[]> {
  const path = connection.provider === 'ollama' ? '/api/tags' : '/models';
  const payload = parsePayload(await readBoundedText(await request(connection, path, signal), MODEL_LIST_LIMIT));
  if (payload.error !== undefined) throw new AiError('invalid-response');
  const models = connection.provider === 'ollama' ? payload.models : payload.data;
  if (!Array.isArray(models)) throw new AiError('invalid-response');
  const names = models.map((item) => connection.provider === 'ollama' ? item?.name : item?.id)
    .filter((name): name is string => typeof name === 'string' && name.length > 0 && name.length <= 256);
  return [...new Set(names)].slice(0, 500);
}

/**
 * 接收所选服务的流式对话；不向其他来源转发 Key、提示词或消息。
 * @param connection - 主进程连接配置。
 * @param messages - 系统提示词与经过校验的会话消息。
 * @param signal - 取消或超时信号。
 * @param onDelta - 新增正文片段回调。
 * @returns 响应完整结束后完成，异常时抛出稳定错误码。
 */
export async function streamAiChat(
  connection: AiConnection,
  messages: readonly ProviderMessage[],
  signal: AbortSignal,
  onDelta: (text: string) => void,
): Promise<void> {
  const path = connection.provider === 'ollama' ? '/api/chat' : '/chat/completions';
  const body = JSON.stringify({ model: connection.model, messages, stream: true });
  const response = await request(connection, path, signal, body);
  const sse = connection.provider === 'openai';
  if (sse && !response.headers.get('content-type')?.includes('text/event-stream')) {
    const payload = parsePayload(await readBoundedText(response, CHAT_RESPONSE_LIMIT));
    const text = payload.choices?.[0]?.message?.content;
    if (payload.error !== undefined || typeof text !== 'string' || !text) throw new AiError('invalid-response');
    onDelta(text);
    return;
  }
  if (!response.body) throw new AiError('invalid-response');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let bytes = 0;
  let completed = false;
  let emitted = false;

  const consume = (frame: string): void => {
    const text = sse
      ? frame.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n')
      : frame.trim();
    if (!text) return;
    if (sse && text.trim() === '[DONE]') {
      completed = true;
      return;
    }
    const payload = parsePayload(text);
    if (payload.error !== undefined) throw new AiError('invalid-response');
    const content = sse ? payload.choices?.[0]?.delta?.content : payload.message?.content;
    if (typeof content === 'string' && content) {
      emitted = true;
      onDelta(content);
    }
    if (!sse && payload.done) completed = true;
    if (sse && payload.choices?.some((choice) => typeof choice.finish_reason === 'string' && !!choice.finish_reason)) completed = true;
  };

  const consumePending = (): void => {
    let boundary = sse ? /\r?\n\r?\n/.exec(pending) : /\n/.exec(pending);
    while (boundary) {
      consume(pending.slice(0, boundary.index));
      pending = pending.slice(boundary.index + boundary[0].length);
      boundary = sse ? /\r?\n\r?\n/.exec(pending) : /\n/.exec(pending);
    }
    if (pending.length > EVENT_LIMIT) throw new AiError('response-too-large');
  };

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        pending += decoder.decode();
        consumePending();
        if (pending.trim()) consume(pending);
        break;
      }
      bytes += result.value.byteLength;
      if (bytes > CHAT_RESPONSE_LIMIT) throw new AiError('response-too-large');
      pending += decoder.decode(result.value, { stream: true });
      consumePending();
      if (completed) break;
    }
    if (!completed) throw new AiError('incomplete-response');
    if (!emitted) throw new AiError('invalid-response');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
