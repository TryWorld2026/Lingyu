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
 * @file ipc.ts
 * @description Lingyu 本地 AI 服务：公开配置、模型列表、流式对话与按窗口取消。
 * @author 灵屿
 */

import type { IpcMainInvokeEvent } from 'electron';
import type { AiChatEvent, AiChatRequest, AiMessage, AiResult } from '../../shared/ai';
import { handleTrusted, isTrustedSender } from '../ipc/trustedSender';
import { broadcastSettingChange } from '../utils/broadcast';
import { AiError } from './aiError';
import { createAiConnectionStore } from './connectionStore';
import { listAiModels, streamAiChat } from './providerClient';
import { buildLingyuSystemPrompt } from './systemPrompt';

interface ChatJob {
  requestId: string;
  controller: AbortController;
}

const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const CHAT_TIMEOUT_MS = 180000;

function failure(error: unknown): AiResult<never> {
  if (error instanceof AiError) return { ok: false, error: error.code, status: error.status };
  return { ok: false, error: 'network' };
}

function safeResult<T>(operation: () => T): AiResult<T> {
  try {
    return { ok: true, value: operation() };
  } catch (error) {
    return failure(error);
  }
}

function parseChatRequest(raw: unknown): AiChatRequest {
  if (!raw || typeof raw !== 'object') throw new AiError('invalid-request');
  const input = raw as Partial<AiChatRequest>;
  if (typeof input.requestId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(input.requestId)
    || !Array.isArray(input.messages) || !input.messages.length || input.messages.length > 512) {
    throw new AiError('invalid-request');
  }
  const messages: AiMessage[] = input.messages.map((message) => {
    if (!message || (message.role !== 'user' && message.role !== 'assistant')
      || typeof message.content !== 'string' || message.content.length > 256 * 1024) {
      throw new AiError('invalid-request');
    }
    return { role: message.role, content: message.content };
  });
  const last = messages[messages.length - 1];
  if (last.role !== 'user' || !last.content.trim() || Buffer.byteLength(JSON.stringify(messages), 'utf8') > MAX_REQUEST_BYTES) {
    throw new AiError('invalid-request');
  }
  return { requestId: input.requestId, messages };
}

/**
 * 注册免费 AI IPC，凭据始终保留在主进程。
 * @param options - 主进程私有配置文件路径。
 */
export function registerAiIpcHandlers(options: { configPath: string }): void {
  const store = createAiConnectionStore(options.configPath);
  const jobs = new Map<number, ChatJob>();

  handleTrusted('ai:config:get', () => safeResult(store.getPublicConfig));
  handleTrusted('ai:config:set', (event, input: unknown) => safeResult(() => {
    const config = store.saveConfig(input);
    broadcastSettingChange(event.sender.id, 'ai:connection', config);
    return config;
  }));

  handleTrusted('ai:models:list', async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), 15000);
    try {
      return { ok: true, value: await listAiModels(store.getConnection(), controller.signal) };
    } catch (error) {
      if (controller.signal.aborted) return { ok: false, error: 'timeout' };
      return failure(error);
    } finally {
      clearTimeout(timeout);
    }
  });

  const startChat = (event: IpcMainInvokeEvent, raw: unknown): string => {
    const input = parseChatRequest(raw);
    if (jobs.has(event.sender.id)) throw new AiError('busy');
    const connection = store.getConnection();
    if (!connection.model) throw new AiError('missing-model');
    const controller = new AbortController();
    const job = { requestId: input.requestId, controller };
    const senderId = event.sender.id;
    jobs.set(senderId, job);
    const timeout = setTimeout(() => controller.abort('timeout'), CHAT_TIMEOUT_MS);
    const abort = (): void => { controller.abort('cancelled'); };
    event.sender.once('destroyed', abort);
    event.sender.once('did-navigate', abort);

    const emit = (message: AiChatEvent): void => {
      try {
        // 导航可能由主进程触发，因此发送每个片段前再次验证当前入口。
        if (event.sender.isDestroyed() || !isTrustedSender({ sender: event.sender, senderFrame: event.sender.mainFrame })) {
          abort();
          return;
        }
        event.sender.send('ai:chat:event', message);
      } catch {
        abort();
      }
    };

    const run = async (): Promise<void> => {
      try {
        await streamAiChat(connection, [
          { role: 'system', content: buildLingyuSystemPrompt() }, ...input.messages,
        ], controller.signal, (text) => {
          emit({ requestId: input.requestId, type: 'delta', text });
        });
        emit({ requestId: input.requestId, type: 'done', cancelled: controller.signal.aborted });
      } catch (error) {
        if (controller.signal.aborted && controller.signal.reason !== 'timeout') {
          emit({ requestId: input.requestId, type: 'done', cancelled: true });
          return;
        }
        const result = controller.signal.reason === 'timeout' ? { ok: false as const, error: 'timeout' as const } : failure(error);
        if (!result.ok) emit({ requestId: input.requestId, type: 'error', error: result.error, status: 'status' in result ? result.status : undefined });
      } finally {
        clearTimeout(timeout);
        event.sender.removeListener('destroyed', abort);
        event.sender.removeListener('did-navigate', abort);
        if (jobs.get(senderId) === job) jobs.delete(senderId);
      }
    };
    void run();
    return input.requestId;
  };

  handleTrusted('ai:chat:start', (event, raw: unknown) => safeResult(() => startChat(event, raw)));
  handleTrusted('ai:chat:abort', (event, requestId: unknown) => {
    const job = jobs.get(event.sender.id);
    if (!job || job.requestId !== requestId) return { ok: true, value: false };
    job.controller.abort('cancelled');
    return { ok: true, value: true };
  });
}
