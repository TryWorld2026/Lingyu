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
 * @file AiTab.tsx
 * @description Lingyu 免费 AI 对话入口：本地模型、自带 Key、流式 Markdown 与取消。
 * @author 灵屿
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DEFAULT_AI_CONFIG } from '../../../../../../shared/ai';
import type { AiPublicConfig } from '../../../../../../shared/ai';
import { AiConnectionForm } from './AiConnectionForm';
import { useAiChat } from './useAiChat';
import '../../../../../styles/ai.css';

const MARKDOWN_PLUGINS = [remarkGfm];
const DISALLOWED_MARKDOWN = ['img'];

/**
 * 渲染无需会员或上游账号的 Lingyu AI 页面。
 * @returns 当前窗口的免费 AI 对话界面。
 */
export function AiTab(): ReactElement {
  const { t } = useTranslation();
  const chat = useAiChat();
  const [config, setConfig] = useState<AiPublicConfig>(DEFAULT_AI_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const firstConfigLoad = useRef(true);
  const busy = !!chat.requestId;

  useEffect(() => {
    let cancelled = false;
    const refresh = (): void => {
      window.api.aiGetConfig().then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setConfig(result.value);
          if (firstConfigLoad.current && !result.value.model) setShowSettings(true);
        } else {
          setShowSettings(true);
        }
        firstConfigLoad.current = false;
        setLoaded(true);
      }).catch(() => { if (!cancelled) { setShowSettings(true); setLoaded(true); } });
    };
    refresh();
    const unsubscribe = window.api.onSettingsChanged((channel) => { if (channel === 'ai:connection') refresh(); });
    return () => { cancelled = true; unsubscribe(); };
  }, [showSettings]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [chat.messages]);

  const handleSaved = useCallback((value: AiPublicConfig): void => {
    setConfig(value);
    if (value.model) setShowSettings(false);
  }, []);

  const handleSend = useCallback(async (): Promise<void> => {
    if (!draft.trim() || busy || !config.model) return;
    if (await chat.send(draft)) setDraft('');
  }, [draft, busy, config.model, chat.send]);

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void handleSend();
  }, [handleSend]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void handleSend();
    }
  }, [handleSend]);

  return (
    <section className="lingyu-ai" aria-label={t('ai.title')}>
      <header className="lingyu-ai-header">
        <div>
          <span className="lingyu-ai-wordmark">{t('ai.brand')}</span>
          <h1>{t('ai.title')}</h1>
          <p>{config.model || t('ai.notConfigured')}</p>
        </div>
        <div className="lingyu-ai-actions">
          <button className="lingyu-ai-button" type="button" disabled={busy}
            aria-expanded={showSettings} onClick={() => setShowSettings((previous) => !previous)}>
            {t(showSettings ? 'ai.backToChat' : 'ai.configure')}
          </button>
          <button className="lingyu-ai-button" type="button" disabled={busy || !chat.messages.length} onClick={chat.clear}>
            {t('ai.newConversation')}
          </button>
        </div>
      </header>
      {showSettings ? (
        <div className="lingyu-ai-settings"><AiConnectionForm onSaved={handleSaved} /></div>
      ) : (
        <>
          <div className="lingyu-ai-messages" role="log" aria-label={t('ai.messages')} aria-busy={busy}>
            {!chat.messages.length && (
              <div className="lingyu-ai-empty">
                <div className="lingyu-ai-empty-mark" aria-hidden="true">{t('ai.brand')}</div>
                <h2>{t('ai.emptyTitle')}</h2>
                <p>{t('ai.emptyHint')}</p>
              </div>
            )}
            {chat.messages.map((message) => (
              <article className={'lingyu-ai-message lingyu-ai-message--' + message.role} key={message.id}>
                <div className="lingyu-ai-message-label">{t(message.role === 'user' ? 'ai.you' : 'ai.assistant')}</div>
                <div className="lingyu-ai-message-content">
                  {message.content ? (
                    <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS} disallowedElements={DISALLOWED_MARKDOWN}>{message.content}</ReactMarkdown>
                  ) : <p>{t(message.state === 'streaming' ? 'ai.waiting' : 'ai.noReply')}</p>}
                </div>
                {message.state === 'cancelled' && <span className="lingyu-ai-note">{t('ai.stopped')}</span>}
                {message.state === 'error' && <span className="lingyu-ai-note">{t('ai.failed')}</span>}
              </article>
            ))}
            <div ref={bottomRef} />
          </div>
          {chat.error && <p className="lingyu-ai-feedback lingyu-ai-feedback--error" role="alert">{t(`ai.errors.${chat.error}`, { status: chat.httpStatus })}</p>}
          <form className="lingyu-ai-composer" onSubmit={handleSubmit}>
            <label className="lingyu-ai-input-label" htmlFor="lingyu-ai-input">{t('ai.inputLabel')}</label>
            <textarea id="lingyu-ai-input" className="lingyu-ai-input" value={draft} disabled={!loaded || !config.model || busy}
              onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown}
              placeholder={t('ai.inputPlaceholder')} rows={3} maxLength={256 * 1024} />
            <div className="lingyu-ai-composer-footer">
              <span className="lingyu-ai-note">{t('ai.sessionHint')}</span>
              {busy ? (
                <button className="lingyu-ai-button" type="button" onClick={chat.cancel}>{t('ai.stop')}</button>
              ) : (
                <button className="lingyu-ai-button lingyu-ai-button--primary" type="submit"
                  disabled={!loaded || !config.model || !draft.trim()}>{t('ai.send')}</button>
              )}
            </div>
          </form>
          <p className="lingyu-ai-cost">{t('ai.costHint')}</p>
        </>
      )}
    </section>
  );
}
