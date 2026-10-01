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
 * @file useTodos.ts
 * @description Todo 模块状态管理 hook：加载、持久化、增删改查等全部逻辑。
 * @author 灵屿
 */

import { useState, useRef, useCallback } from 'react';
import { STORE_KEY } from '../config/todoConfig';
import type { Priority, Size, TodoItem, UseTodosReturn } from '../types/todoTypes';
import { normalizeTodos, readLegacyTodos } from '../utils/todoUtils';
import { useStoredList } from '../../../../../hooks/useStoredList';

/**
 * Todo 模块状态管理 hook
 * @description 封装 TodoTab 的全部状态与操作逻辑
 */
export function useTodos(): UseTodosReturn {
  const { items: todos, setItems: setTodos } = useStoredList<TodoItem>(STORE_KEY, normalizeTodos, readLegacyTodos);
  const [input, setInput] = useState('');
  const [priority, setPriority] = useState<Priority | undefined>(undefined);
  const [size, setSize] = useState<Size | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [subInput, setSubInput] = useState('');
  const [subPriority, setSubPriority] = useState<Priority | undefined>(undefined);
  const [subSize, setSubSize] = useState<Size | undefined>(undefined);
  const [editingDescId, setEditingDescId] = useState<number | null>(null);
  const [descDraft, setDescDraft] = useState('');
  const descRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const subInputRef = useRef<HTMLInputElement>(null);

  /** 更新状态的便捷方法 */
  const update = useCallback((updater: (prev: TodoItem[]) => TodoItem[]): void => {
    setTodos(updater);
  }, [setTodos]);

  /** 添加待办 */
  const handleAdd = (): void => {
    const text = input.trim();
    if (!text) return;
    const now = Date.now();
    update(prev => [...prev, { id: now, text, done: false, createdAt: now, priority, size, description: '', subTodos: [] }]);
    setInput('');
    setPriority(undefined);
    setSize(undefined);
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  /** 回车添加 */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
  };

  /** 切换完成 */
  const toggleDone = (id: number): void => {
    update(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  /** 删除 */
  const removeTodo = (id: number): void => {
    update(prev => prev.filter(t => t.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  /** 展开/收起 */
  const toggleExpand = (id: number): void => {
    setExpandedId(prev => prev === id ? null : id);
    setSubInput('');
    setSubPriority(undefined);
    setSubSize(undefined);
  };

  /** 进入描述编辑模式 */
  const startEditDesc = (todo: TodoItem): void => {
    setEditingDescId(todo.id);
    setDescDraft(todo.description ?? '');
    requestAnimationFrame(() => descRef.current?.focus());
  };

  /** 保存描述 */
  const saveDesc = (id: number): void => {
    update(prev => prev.map(t => t.id === id ? { ...t, description: descDraft } : t));
    setEditingDescId(null);
  };

  /** 添加子待办 */
  const addSubTodo = (parentId: number): void => {
    const text = subInput.trim();
    if (!text) return;
    update(prev => prev.map(t => {
      if (t.id !== parentId) return t;
      const subs = t.subTodos ?? [];
      return { ...t, subTodos: [...subs, { id: Date.now(), text, done: false, priority: subPriority, size: subSize }] };
    }));
    setSubInput('');
    setSubPriority(undefined);
    setSubSize(undefined);
    requestAnimationFrame(() => subInputRef.current?.focus());
  };

  /** 切换子待办完成 */
  const toggleSubDone = (parentId: number, subId: number): void => {
    update(prev => prev.map(t => {
      if (t.id !== parentId) return t;
      return { ...t, subTodos: (t.subTodos ?? []).map(s => s.id === subId ? { ...s, done: !s.done } : s) };
    }));
  };

  /** 删除子待办 */
  const removeSubTodo = (parentId: number, subId: number): void => {
    update(prev => prev.map(t => {
      if (t.id !== parentId) return t;
      return { ...t, subTodos: (t.subTodos ?? []).filter(s => s.id !== subId) };
    }));
  };

  const doneCount = todos.filter(t => t.done).length;
  const undoneCount = todos.length - doneCount;
  const p0Count = todos.filter(t => !t.done && t.priority === 'P0').length;
  const p1Count = todos.filter(t => !t.done && t.priority === 'P1').length;
  const p2Count = todos.filter(t => !t.done && t.priority === 'P2').length;

  return {
    todos,
    input, setInput,
    priority, setPriority,
    size, setSize,
    expandedId,
    subInput, setSubInput,
    subPriority, setSubPriority,
    subSize, setSubSize,
    editingDescId,
    descDraft, setDescDraft,
    descRef, inputRef, listRef, subInputRef,
    doneCount, undoneCount,
    p0Count, p1Count, p2Count,
    handleAdd, handleKeyDown,
    toggleDone, removeTodo, toggleExpand,
    startEditDesc, saveDesc,
    addSubTodo, toggleSubDone, removeSubTodo,
  };
}
