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
 * @file conversationStore.ts
 * @description 本次运行中保留的免费 AI 对话状态。
 * @author 灵屿
 */

import { create } from 'zustand';
import type { AiChatEvent, AiChatRequest, AiErrorCode, AiMessage } from '../../../../../../shared/ai';

export interface AiDisplayMessage extends AiMessage {
  id: string;
  state: 'streaming' | 'done' | 'cancelled' | 'error';
}

interface ConversationState {
  messages: AiDisplayMessage[];
  requestId: string | null;
  error: AiErrorCode | null;
  httpStatus: number | null;
  beginRequest: (content: string, requestId: string) => AiChatRequest | null;
  acceptEvent: (event: AiChatEvent) => void;
  clear: () => void;
}

/** 会话仅保存在内存中，切换页面保留正文，不自动写入磁盘。 */
export const useAiConversationStore = create<ConversationState>((set, get) => ({
  messages: [], requestId: null, error: null, httpStatus: null,
  beginRequest: (content, requestId) => {
    const current = get();
    if (current.requestId || !content.trim()) return null;
    const userMessage: AiDisplayMessage = { id: requestId + '-user', role: 'user', content: content.trim(), state: 'done' };
    const context: AiMessage[] = [...current.messages, userMessage]
      .filter((message) => message.state === 'done' && !!message.content)
      .map(({ role, content: text }) => ({ role, content: text }));
    set({
      requestId, error: null, httpStatus: null,
      messages: [...current.messages, userMessage, { id: requestId + '-assistant', role: 'assistant', content: '', state: 'streaming' }],
    });
    return { requestId, messages: context };
  },
  acceptEvent: (event) => {
    const current = get();
    if (event.requestId !== current.requestId) return;
    if (event.type === 'delta') {
      set({ messages: current.messages.map((message) => message.id === event.requestId + '-assistant'
        ? { ...message, content: message.content + event.text } : message) });
      return;
    }
    let state: AiDisplayMessage['state'] = 'done';
    if (event.type === 'error') state = 'error';
    if (event.type === 'done' && event.cancelled) state = 'cancelled';
    set({
      requestId: null,
      error: event.type === 'error' ? event.error : null,
      httpStatus: event.type === 'error' ? event.status ?? null : null,
      messages: current.messages.map((message) => message.id === event.requestId + '-assistant' ? { ...message, state } : message),
    });
  },
  clear: () => {
    if (!get().requestId) set({ messages: [], error: null, httpStatus: null });
  },
}));
