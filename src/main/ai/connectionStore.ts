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
 * @file connectionStore.ts
 * @description 免费 AI 连接配置服务。
 * @author 灵屿
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { safeStorage } from 'electron';
import { DEFAULT_AI_CONFIG } from '../../shared/ai';
import type { AiConnection, AiConnectionInput, AiPublicConfig } from '../../shared/ai';
import { AiError } from './aiError';

interface SavedConnection extends Omit<AiConnectionInput, 'apiKey'> {
  version: 1;
  encryptedKey: string;
}

function normalizeInput(raw: unknown): Omit<AiConnectionInput, 'apiKey'> {
  if (!raw || typeof raw !== 'object') throw new AiError('invalid-config');
  const input = raw as Partial<AiConnectionInput>;
  if (input.provider !== 'ollama' && input.provider !== 'openai') throw new AiError('invalid-config');
  if (typeof input.endpoint !== 'string' || input.endpoint.length > 2048
    || typeof input.model !== 'string' || input.model.length > 256 || /[\u0000-\u001f]/.test(input.model)) {
    throw new AiError('invalid-config');
  }
  let url: URL;
  try {
    url = new URL(input.endpoint.trim());
  } catch {
    throw new AiError('invalid-config');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash
    || (input.provider === 'openai' && url.protocol !== 'https:' && !loopback)) {
    throw new AiError('invalid-config');
  }
  return { provider: input.provider, endpoint: url.href.replace(/\/+$/, ''), model: input.model.trim() };
}

/**
 * 创建指定文件的连接配置服务。
 * @param configPath - 主进程私有配置文件，必须位于通用 renderer store 目录之外。
 * @returns 公开配置、加密保存及主进程连接读取方法。
 */
export function createAiConnectionStore(configPath: string) {
  const read = (): SavedConnection => {
    if (!existsSync(configPath)) {
      return { version: 1, provider: DEFAULT_AI_CONFIG.provider, endpoint: DEFAULT_AI_CONFIG.endpoint, model: '', encryptedKey: '' };
    }
    try {
      const saved = JSON.parse(readFileSync(configPath, 'utf8')) as SavedConnection;
      if (saved.version !== 1 || typeof saved.encryptedKey !== 'string' || saved.encryptedKey.length > 32768) {
        throw new AiError('storage');
      }
      return { ...normalizeInput(saved), version: 1, encryptedKey: saved.encryptedKey };
    } catch {
      throw new AiError('storage');
    }
  };

  const getPublicConfig = (): AiPublicConfig => {
    const saved = read();
    return { provider: saved.provider, endpoint: saved.endpoint, model: saved.model, hasApiKey: !!saved.encryptedKey };
  };

  const saveConfig = (raw: unknown): AiPublicConfig => {
    const input = normalizeInput(raw);
    const apiKey = (raw as AiConnectionInput).apiKey;
    if (apiKey !== undefined && (typeof apiKey !== 'string' || apiKey.length > 8192 || /[^\x20-\x7e]/.test(apiKey))) {
      throw new AiError('invalid-config');
    }
    const previous = read();
    // 更换目标地址时不能把旧 Key 自动交给新服务。
    let encryptedKey = previous.provider === input.provider && previous.endpoint === input.endpoint ? previous.encryptedKey : '';
    if (input.provider === 'ollama') {
      encryptedKey = '';
    } else if (apiKey !== undefined) {
      const key = apiKey.trim();
      encryptedKey = '';
      if (key) {
        if (!safeStorage.isEncryptionAvailable()) throw new AiError('credential-storage');
        try {
          encryptedKey = safeStorage.encryptString(key).toString('base64');
        } catch {
          throw new AiError('credential-storage');
        }
      }
    }
    try {
      mkdirSync(dirname(configPath), { recursive: true });
      writeFileSync(configPath + '.tmp', JSON.stringify({ ...input, version: 1, encryptedKey }), { encoding: 'utf8', mode: 0o600 });
      renameSync(configPath + '.tmp', configPath);
    } catch {
      throw new AiError('storage');
    }
    return getPublicConfig();
  };

  const getConnection = (): AiConnection => {
    const saved = read();
    let apiKey = '';
    if (saved.encryptedKey) {
      try {
        apiKey = safeStorage.decryptString(Buffer.from(saved.encryptedKey, 'base64'));
      } catch {
        throw new AiError('credential-unavailable');
      }
    }
    return { provider: saved.provider, endpoint: saved.endpoint, model: saved.model, apiKey };
  };

  return { getPublicConfig, saveConfig, getConnection };
}
