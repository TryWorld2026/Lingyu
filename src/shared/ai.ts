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
 * @file ai.ts
 * @description 免费 AI 连接与对话的共享类型；公开配置不包含凭据。
 * @author 灵屿
 */

export type AiProvider = 'ollama' | 'openai';
export type AiErrorCode = 'invalid-config' | 'storage' | 'credential-storage' | 'credential-unavailable'
  | 'missing-key' | 'missing-model' | 'invalid-request' | 'busy' | 'network' | 'http-error'
  | 'invalid-response' | 'incomplete-response' | 'response-too-large' | 'timeout' | 'untrusted-sender';

export interface AiConnectionInput {
  provider: AiProvider;
  endpoint: string;
  model: string;
  apiKey?: string;
}

export interface AiPublicConfig {
  provider: AiProvider;
  endpoint: string;
  model: string;
  hasApiKey: boolean;
}

/** 此类型仅在主进程使用，不可返回给渲染层。 */
export interface AiConnection extends AiConnectionInput {
  apiKey: string;
}

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatRequest {
  requestId: string;
  messages: AiMessage[];
}

export type AiResult<T> = { ok: true; value: T } | { ok: false; error: AiErrorCode; status?: number };

export type AiChatEvent =
  | { requestId: string; type: 'delta'; text: string }
  | { requestId: string; type: 'done'; cancelled: boolean }
  | { requestId: string; type: 'error'; error: AiErrorCode; status?: number };

export const DEFAULT_AI_CONFIG: AiPublicConfig = {
  provider: 'ollama', endpoint: 'http://127.0.0.1:11434', model: '', hasApiKey: false,
};
