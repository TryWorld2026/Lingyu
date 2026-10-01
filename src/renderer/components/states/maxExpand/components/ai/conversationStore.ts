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
 * @description 本次运行内的 AI 对话、历史切换和流式状态；不自动写入磁盘。
 * @author 灵屿
 */

import { create } from 'zustand';
import type { AiChatEvent, AiChatRequest, AiErrorCode, AiMessage } from '../../../../../../shared/ai';

export interface AiDisplayMessage extends AiMessage {
  id: string;
  state: 'streaming' | 'done' | 'cancelled' | 'error';
}

export interface AiConversation {
  id: string;
  title: string;
  messages: AiDisplayMessage[];
}

interface ConversationState {
  messages: AiDisplayMessage[];
  requestId: string | null;
  error: AiErrorCode | null;
  httpStatus: number | null;
  activeConversationId: string | null;
  history: AiConversation[];
  beginRequest: (content: string, requestId: string) => AiChatRequest | null;
  acceptEvent: (event: AiChatEvent) => void;
  clear: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
}

/** @param current - 当前会话状态。 @returns 保留最近二十段对话的内存历史。 */
function archive(current: ConversationState): AiConversation[] {
  if (!current.activeConversationId || !current.messages.length) return current.history;
  return [{
    id: current.activeConversationId,
    title: current.messages.find((message) => message.role === 'user')?.content.slice(0, 48) || '',
    messages: current.messages,
  }, ...current.history.filter((item) => item.id !== current.activeConversationId)].slice(0, 20);
}

/** 会话仅保存在内存中，切换页面保留正文，不自动写入磁盘。 */
export const useAiConversationStore = create<ConversationState>((set, get) => ({
  messages: [], requestId: null, error: null, httpStatus: null, activeConversationId: null, history: [],
  beginRequest: (content, requestId) => {
    const current = get();
    if (current.requestId || !content.trim()) return null;
    const userMessage: AiDisplayMessage = { id: requestId + '-user', role: 'user', content: content.trim(), state: 'done' };
    const context: AiMessage[] = [...current.messages, userMessage]
      .filter((message) => message.state === 'done' && !!message.content)
      .map(({ role, content: text }) => ({ role, content: text }));
    set({
      requestId, error: null, httpStatus: null,
      activeConversationId: current.activeConversationId || requestId,
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
    const current = get();
    if (!current.requestId) set({ messages: [], error: null, httpStatus: null, activeConversationId: null, history: archive(current) });
  },
  selectConversation: (id) => {
    const current = get();
    if (current.requestId || current.activeConversationId === id) return;
    const selected = current.history.find((item) => item.id === id);
    if (!selected) return;
    set({ messages: selected.messages, activeConversationId: id, history: archive(current), error: null, httpStatus: null });
  },
  deleteConversation: (id) => {
    const current = get();
    if (current.requestId) return;
    set({
      history: current.history.filter((item) => item.id !== id),
      ...(current.activeConversationId === id ? { messages: [], activeConversationId: null, error: null, httpStatus: null } : {}),
    });
  },
}));
