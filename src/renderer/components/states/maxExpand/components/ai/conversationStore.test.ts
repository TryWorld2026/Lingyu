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
 * @file conversationStore.test.ts
 * @description 流式会话状态、过期事件与取消后的上下文回归测试。
 * @author 灵屿
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useAiConversationStore } from './conversationStore';

beforeEach(() => { useAiConversationStore.setState({ messages: [], requestId: null, error: null, httpStatus: null, history: [], activeConversationId: null }); });

describe('free AI conversation state', () => {
  it('records the user turn before a synchronous first stream event', () => {
    const request = useAiConversationStore.getState().beginRequest('hello', 'first');
    expect(request).toEqual({ requestId: 'first', messages: [{ role: 'user', content: 'hello' }] });
    useAiConversationStore.getState().acceptEvent({ requestId: 'first', type: 'delta', text: '你好' });
    expect(useAiConversationStore.getState().messages.at(-1)?.content).toBe('你好');
  });

  it('rejects an overlapping request and ignores events from another request', () => {
    useAiConversationStore.getState().beginRequest('hello', 'first');
    expect(useAiConversationStore.getState().beginRequest('another', 'second')).toBeNull();
    useAiConversationStore.getState().acceptEvent({ requestId: 'stale', type: 'delta', text: 'wrong window' });
    useAiConversationStore.getState().acceptEvent({ requestId: 'stale', type: 'done', cancelled: false });
    expect(useAiConversationStore.getState().requestId).toBe('first');
    expect(useAiConversationStore.getState().messages.at(-1)?.content).toBe('');
  });

  it('keeps completed replies as multi-turn context', () => {
    useAiConversationStore.getState().beginRequest('question', 'first');
    useAiConversationStore.getState().acceptEvent({ requestId: 'first', type: 'delta', text: 'answer' });
    useAiConversationStore.getState().acceptEvent({ requestId: 'first', type: 'done', cancelled: false });
    const next = useAiConversationStore.getState().beginRequest('follow-up', 'second');
    expect(next?.messages).toEqual([
      { role: 'user', content: 'question' }, { role: 'assistant', content: 'answer' }, { role: 'user', content: 'follow-up' },
    ]);
  });

  it('keeps an interrupted reply visible but does not resend it as completed context', () => {
    useAiConversationStore.getState().beginRequest('question', 'first');
    useAiConversationStore.getState().acceptEvent({ requestId: 'first', type: 'delta', text: 'partial' });
    useAiConversationStore.getState().acceptEvent({ requestId: 'first', type: 'done', cancelled: true });
    expect(useAiConversationStore.getState().messages.at(-1)?.state).toBe('cancelled');
    const next = useAiConversationStore.getState().beginRequest('follow-up', 'second');
    expect(next?.messages.some((message) => message.content === 'partial')).toBe(false);
  });

  it('releases a failed request and records its safe error code', () => {
    useAiConversationStore.getState().beginRequest('question', 'first');
    useAiConversationStore.getState().acceptEvent({ requestId: 'first', type: 'error', error: 'http-error', status: 401 });
    expect(useAiConversationStore.getState().requestId).toBeNull();
    expect(useAiConversationStore.getState().error).toBe('http-error');
    expect(useAiConversationStore.getState().httpStatus).toBe(401);
  });

  it('restores an earlier conversation with its own context', () => {
    const chat = useAiConversationStore.getState();
    chat.beginRequest('first topic', 'first');
    chat.acceptEvent({ requestId: 'first', type: 'delta', text: 'first answer' });
    chat.acceptEvent({ requestId: 'first', type: 'done', cancelled: false });
    chat.clear();
    chat.beginRequest('second topic', 'second');
    chat.acceptEvent({ requestId: 'second', type: 'done', cancelled: false });
    chat.selectConversation('first');
    const request = chat.beginRequest('continue first', 'third');
    expect(request?.messages).toEqual([
      { role: 'user', content: 'first topic' }, { role: 'assistant', content: 'first answer' },
      { role: 'user', content: 'continue first' },
    ]);
    expect(useAiConversationStore.getState().history.some((item) => item.id === 'second')).toBe(true);
  });

  it('prevents switching or deleting the current conversation during a stream', () => {
    const chat = useAiConversationStore.getState();
    chat.beginRequest('keep this stream', 'first');
    chat.clear();
    chat.selectConversation('other');
    chat.deleteConversation('first');
    expect(useAiConversationStore.getState().requestId).toBe('first');
    expect(useAiConversationStore.getState().messages[0].content).toBe('keep this stream');
  });

  it('deletes an archived conversation without affecting the active one', () => {
    const chat = useAiConversationStore.getState();
    chat.beginRequest('archive me', 'first');
    chat.acceptEvent({ requestId: 'first', type: 'done', cancelled: false });
    chat.clear();
    chat.beginRequest('keep me', 'second');
    chat.acceptEvent({ requestId: 'second', type: 'done', cancelled: false });
    chat.deleteConversation('first');
    expect(useAiConversationStore.getState().history).toEqual([]);
    expect(useAiConversationStore.getState().messages[0].content).toBe('keep me');
  });
});
