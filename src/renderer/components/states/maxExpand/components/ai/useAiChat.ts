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
 * @file useAiChat.ts
 * @description 免费 AI 会话的 IPC 订阅、发送和取消；离开页面时停止生成。
 * @author 灵屿
 */

import { useCallback, useEffect } from 'react';
import { useAiConversationStore } from './conversationStore';

/**
 * 管理当前窗口的免费 AI 会话。
 * @returns 会话状态、发送与取消方法。
 */
export function useAiChat() {
  const state = useAiConversationStore();
  const { beginRequest, acceptEvent } = state;

  useEffect(() => {
    const unsubscribe = window.api.onAiChatEvent(acceptEvent);
    return () => {
      unsubscribe();
      const current = useAiConversationStore.getState();
      if (current.requestId) {
        void window.api.aiAbortChat(current.requestId).catch(() => {});
        current.acceptEvent({ requestId: current.requestId, type: 'done', cancelled: true });
      }
    };
  }, [acceptEvent]);

  const send = useCallback(async (text: string): Promise<boolean> => {
    const request = beginRequest(text, crypto.randomUUID());
    if (!request) return false;
    try {
      const result = await window.api.aiStartChat(request);
      if (!result.ok) acceptEvent({ requestId: request.requestId, type: 'error', error: result.error, status: result.status });
    } catch {
      acceptEvent({ requestId: request.requestId, type: 'error', error: 'network' });
    }
    return true;
  }, [beginRequest, acceptEvent]);

  const cancel = useCallback(async (): Promise<void> => {
    const requestId = useAiConversationStore.getState().requestId;
    if (!requestId) return;
    try {
      const result = await window.api.aiAbortChat(requestId);
      if (!result.ok) acceptEvent({ requestId, type: 'error', error: result.error, status: result.status });
      if (result.ok && !result.value) acceptEvent({ requestId, type: 'done', cancelled: true });
    } catch {
      acceptEvent({ requestId, type: 'error', error: 'network' });
    }
  }, [acceptEvent]);

  return { ...state, send, cancel };
}
