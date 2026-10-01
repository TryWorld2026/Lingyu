/*
 * 灵屿 Lingyu - 免费开源的 Windows 桌面灵动岛
 * https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026
 * GPL-3.0-or-later; distributed without warranty.
 */

/**
 * @file WorkspaceSidebar.tsx
 * @description 独立桌面工作台的品牌导航、工具入口与本次运行对话历史。
 * @author 灵屿
 */

import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useAiConversationStore } from '../states/maxExpand/components/ai/conversationStore';
import type { MaxExpandTab } from '../../store/types';
import { SvgIcon } from '../../utils/SvgIcon';

interface WorkspaceSidebarProps {
  activeTab: MaxExpandTab;
  tabs: { id: MaxExpandTab; label: string; icon?: string }[];
  onSelect: (id: MaxExpandTab) => void;
}

/**
 * 渲染侧栏；工具导航与对话历史分别滚动，窗口操作始终可达。
 * @param props - 当前页面、可见导航和窗口操作。
 * @returns 带主题适配图标的工作台侧栏。
 */
export function WorkspaceSidebar({ activeTab, tabs, onSelect }: WorkspaceSidebarProps): ReactElement {
  const { t } = useTranslation();
  const chat = useAiConversationStore();
  const currentTitle = chat.messages.find((message) => message.role === 'user')?.content.slice(0, 48);
  const conversations = chat.activeConversationId && currentTitle
    ? [{ id: chat.activeConversationId, title: currentTitle }, ...chat.history.filter((item) => item.id !== chat.activeConversationId)].slice(0, 20)
    : chat.history;
  const tools = tabs.filter((tab) => tab.id !== 'ai' && tab.id !== 'settings');
  const ai = tabs.find((tab) => tab.id === 'ai');
  const settings = tabs.find((tab) => tab.id === 'settings');

  return (
    <aside className="workspace-sidebar" aria-label={t('workspace.navigation')} onClick={(event) => event.stopPropagation()}>
      <div className="workspace-brand">
        <img className="lingyu-brand-icon" src="./svg/lingyu-mark.svg" alt="" />
        <span>{t('workspace.brand')}</span>
      </div>
      {ai && <button className={'workspace-nav-item' + (activeTab === 'ai' ? ' active' : '')}
        type="button" aria-current={activeTab === 'ai' ? 'page' : undefined} onClick={() => onSelect('ai')}>
        <img className="workspace-icon" src={SvgIcon.AI} alt="" /><span>{ai.label}</span>
      </button>}
      {activeTab === 'ai' && <>
        <button className="workspace-new-chat" type="button" disabled={!!chat.requestId} onClick={chat.clear}>
          <span aria-hidden="true">＋</span>{t('ai.newConversation')}
        </button>
        <div className="workspace-history-heading">{t('ai.history')}</div>
        <p className="workspace-session-hint">{t('ai.sessionHint')}</p>
        <div className="workspace-history">
          {!conversations.length && <p className="workspace-empty-history">{t('ai.historyEmpty')}</p>}
          {conversations.map((item) => <div className={'workspace-conversation' + (chat.activeConversationId === item.id ? ' active' : '')} key={item.id}>
            <button type="button" disabled={!!chat.requestId} title={item.title}
              aria-pressed={chat.activeConversationId === item.id} onClick={() => chat.selectConversation(item.id)}>{item.title}</button>
            <button className="workspace-delete-chat" type="button" disabled={!!chat.requestId}
              aria-label={t('ai.deleteConversation', { title: item.title })} onClick={() => chat.deleteConversation(item.id)}><span aria-hidden="true">×</span></button>
          </div>)}
        </div>
      </>}
      <details className="workspace-tools" open={activeTab !== 'ai'}>
        <summary>{t('workspace.tools')}</summary>
        <nav className="workspace-tool-list">
          {tools.map((tab) => <button className={'workspace-nav-item' + (activeTab === tab.id ? ' active' : '')}
            key={tab.id} type="button" aria-current={activeTab === tab.id ? 'page' : undefined} onClick={() => onSelect(tab.id)}>
            {tab.icon && <img className="workspace-icon" src={tab.icon} alt="" />}<span>{tab.label}</span>
          </button>)}
        </nav>
      </details>
      <div className="workspace-sidebar-footer">
        {settings && <button className={'workspace-nav-item' + (activeTab === 'settings' ? ' active' : '')} type="button" onClick={() => onSelect('settings')}>
          <img className="workspace-icon" src={SvgIcon.SETTING} alt="" /><span>{settings.label}</span>
        </button>}
      </div>
    </aside>
  );
}
