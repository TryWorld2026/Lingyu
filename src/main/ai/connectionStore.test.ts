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
 * @file connectionStore.test.ts
 * @description 免费 AI 连接配置与凭据保存的回归测试。
 * @author 灵屿
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve, sep } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { encryptionAvailable, encryptString, decryptString } = vi.hoisted(() => ({
  encryptionAvailable: vi.fn(() => true),
  encryptString: vi.fn(() => Buffer.from('synthetic-sealed-credential')),
  decryptString: vi.fn(() => 'test-user-api-key'),
}));
vi.mock('electron', () => ({ safeStorage: { isEncryptionAvailable: encryptionAvailable, encryptString, decryptString } }));
import { createAiConnectionStore } from './connectionStore';

let directory: string;
let configPath: string;
const cloudConfig = { provider: 'openai' as const, endpoint: 'https://models.example.test/v1', model: 'user-model' };

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'lingyu-ai-test-'));
  configPath = join(directory, 'connection.json');
  encryptionAvailable.mockReturnValue(true);
});
afterEach(() => {
  expect(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'lingyu-ai-test-')).toBe(true);
  rmSync(directory, { recursive: true, force: true });
});

describe('AI connection and credential store', () => {
  it('defaults to local Ollama without an account or API key', () => {
    expect(createAiConnectionStore(configPath).getPublicConfig()).toEqual({
      provider: 'ollama', endpoint: 'http://127.0.0.1:11434', model: '', hasApiKey: false,
    });
  });

  it('persists only the encrypted key and restores it only in the main process', () => {
    const store = createAiConnectionStore(configPath);
    store.saveConfig({ ...cloudConfig, apiKey: 'test-user-api-key' });
    const raw = readFileSync(configPath, 'utf8');
    expect(raw).not.toContain('test-user-api-key');
    expect(encryptString).toHaveBeenCalledWith('test-user-api-key');
    const restored = createAiConnectionStore(configPath);
    expect(restored.getPublicConfig()).toEqual({ ...cloudConfig, hasApiKey: true });
    expect(restored.getPublicConfig()).not.toHaveProperty('encryptedKey');
    expect(restored.getPublicConfig()).not.toHaveProperty('apiKey');
    expect(restored.getConnection()?.apiKey).toBe('test-user-api-key');
  });

  it('keeps the key for the same service and removes it when the destination changes', () => {
    const store = createAiConnectionStore(configPath);
    store.saveConfig({ ...cloudConfig, apiKey: 'test-user-api-key' });
    store.saveConfig({ ...cloudConfig, endpoint: cloudConfig.endpoint + '/', model: 'another-model' });
    expect(store.getPublicConfig()?.hasApiKey).toBe(true);
    store.saveConfig({ ...cloudConfig, endpoint: 'https://another.example.test/v1' });
    expect(store.getPublicConfig()?.hasApiKey).toBe(false);
    expect(store.getConnection()?.apiKey).toBe('');
  });

  it('removes a stored credential when an empty key is explicitly saved', () => {
    const store = createAiConnectionStore(configPath);
    store.saveConfig({ ...cloudConfig, apiKey: 'test-user-api-key' });
    store.saveConfig({ ...cloudConfig, apiKey: '' });
    expect(store.getPublicConfig()?.hasApiKey).toBe(false);
  });

  it('refuses plaintext fallback when encryption is unavailable', () => {
    const store = createAiConnectionStore(configPath);
    encryptionAvailable.mockReturnValue(false);
    expect(() => store.saveConfig({ ...cloudConfig, apiKey: 'test-user-api-key' })).toThrow('credential-storage');
    expect(store.getPublicConfig()?.hasApiKey).toBe(false);
  });

  it.each([
    'http://models.example.test/v1', 'file:///C:/models',
    'https://name:password@models.example.test/v1', 'https://models.example.test/v1?key=secret',
    'https://models.example.test/v1#fragment',
  ])('rejects an unsafe API endpoint %s', (endpoint) => {
    expect(() => createAiConnectionStore(configPath).saveConfig({ ...cloudConfig, endpoint })).toThrow('invalid-config');
  });

  it('allows a local OpenAI compatible service without a key', () => {
    const store = createAiConnectionStore(configPath);
    store.saveConfig({ provider: 'openai', endpoint: 'http://localhost:1234/v1', model: 'local-model' });
    expect(store.getConnection()?.apiKey).toBe('');
  });

  it('does not overwrite unreadable configuration with silent defaults', () => {
    writeFileSync(configPath, '{broken-json', 'utf8');
    const store = createAiConnectionStore(configPath);
    expect(() => store.getPublicConfig()).toThrow('storage');
    expect(() => store.saveConfig(cloudConfig)).toThrow('storage');
    expect(readFileSync(configPath, 'utf8')).toBe('{broken-json');
  });
});
