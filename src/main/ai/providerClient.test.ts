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
 * @file providerClient.test.ts
 * @description 模型列表、流式解码、取消和资源边界的回归测试。
 * @author 灵屿
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock('electron', () => ({ net: { fetch: fetchMock } }));
import { listAiModels, streamAiChat } from './providerClient';

const local = { provider: 'ollama' as const, endpoint: 'http://127.0.0.1:11434', model: 'local-model', apiKey: '' };
const cloud = { provider: 'openai' as const, endpoint: 'https://models.example.test/v1', model: 'user-model', apiKey: 'synthetic-key' };
const messages = [{ role: 'user' as const, content: 'hello' }];
const signal = new AbortController().signal;

function chunkedResponse(text: string, type: string) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({
    start(controller) {
      bytes.forEach((byte) => controller.enqueue(new Uint8Array([byte])));
      controller.close();
    },
  }), { headers: { 'content-type': type } });
}

beforeEach(() => { fetchMock.mockReset(); });

describe('free AI provider protocols', () => {
  it('lists Ollama models without login, tokens or a Pro check', async () => {
    fetchMock.mockResolvedValue(Response.json({ models: [{ name: 'local-model' }] }));
    expect(await listAiModels(local, signal)).toEqual(['local-model']);
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:11434/api/tags');
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });

  it('lists compatible models with the key sent only to the selected service', async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [{ id: 'user-model' }, { id: 'another-model' }] }));
    expect(await listAiModels(cloud, signal)).toEqual(['user-model', 'another-model']);
    expect(fetchMock).toHaveBeenCalledWith(cloud.endpoint + '/models', expect.objectContaining({
      redirect: 'error', signal, headers: expect.objectContaining({ Authorization: 'Bearer synthetic-key' }),
    }));
  });

  it('decodes Ollama NDJSON across split UTF-8 bytes and a final line without newline', async () => {
    fetchMock.mockResolvedValue(chunkedResponse(
      '{"message":{"content":"你好"},"done":false}\n{"message":{"content":"！"},"done":true}',
      'application/x-ndjson',
    ));
    const chunks: string[] = [];
    await streamAiChat(local, messages, signal, (text) => { chunks.push(text); });
    expect(chunks.join('')).toBe('你好！');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ model: 'local-model', messages, stream: true });
  });

  it('decodes compatible SSE with CRLF, comments and finish chunks', async () => {
    fetchMock.mockResolvedValue(chunkedResponse(
      ': heartbeat\r\n\r\ndata: {"choices":[{"delta":{"role":"assistant"}}]}\r\n\r\n'
      + 'data: {"choices":[{"delta":{"content":"你好"}}]}\r\n\r\n'
      + 'data: {"choices":[{"delta":{"content":"！"},"finish_reason":"stop"}]}\r\n\r\ndata: [DONE]\r\n\r\n',
      'text/event-stream',
    ));
    const chunks: string[] = [];
    await streamAiChat(cloud, messages, signal, (text) => { chunks.push(text); });
    expect(chunks.join('')).toBe('你好！');
  });

  it('accepts a non-streaming JSON reply from a compatible service', async () => {
    fetchMock.mockResolvedValue(Response.json({ choices: [{ message: { content: 'complete reply' } }] }));
    const onDelta = vi.fn();
    await streamAiChat(cloud, messages, signal, onDelta);
    expect(onDelta).toHaveBeenCalledWith('complete reply');
  });

  it('rejects a truncated stream instead of reporting success', async () => {
    fetchMock.mockResolvedValue(chunkedResponse('{"message":{"content":"partial"},"done":false}\n', 'application/x-ndjson'));
    await expect(streamAiChat(local, messages, signal, vi.fn())).rejects.toThrow('incomplete-response');
  });

  it('rejects invalid JSON and model error events', async () => {
    fetchMock.mockResolvedValue(chunkedResponse('not-json\n', 'application/x-ndjson'));
    await expect(streamAiChat(local, messages, signal, vi.fn())).rejects.toThrow('invalid-response');
    fetchMock.mockResolvedValue(chunkedResponse('{"error":"synthetic-key"}\n', 'application/x-ndjson'));
    await expect(streamAiChat(local, messages, signal, vi.fn())).rejects.toThrow('invalid-response');
  });

  it.each([{ choices: {} }, { choices: null }, { choices: [null] }])('rejects malformed compatible choices: %j', async ({ choices }) => {
    fetchMock.mockResolvedValue(chunkedResponse(
      'data: ' + JSON.stringify({ choices }) + '\n\ndata: [DONE]\n\n', 'text/event-stream',
    ));
    await expect(streamAiChat(cloud, messages, signal, vi.fn())).rejects.toThrow('invalid-response');
  });

  it('rejects a non-boolean Ollama completion marker', async () => {
    fetchMock.mockResolvedValue(chunkedResponse(
      '{"message":{"content":"partial"},"done":"false"}\n', 'application/x-ndjson',
    ));
    await expect(streamAiChat(local, messages, signal, vi.fn())).rejects.toThrow('invalid-response');
  });

  it('bounds chat responses before rendering or parsing an oversized event', async () => {
    fetchMock.mockResolvedValue(new Response(' '.repeat(8 * 1024 * 1024 + 1), {
      headers: { 'content-type': 'application/x-ndjson' },
    }));
    await expect(streamAiChat(local, messages, signal, vi.fn())).rejects.toThrow('response-too-large');
  });

  it('does not expose a service error body containing credentials', async () => {
    fetchMock.mockResolvedValue(new Response('echoed synthetic-key', { status: 401 }));
    await expect(listAiModels(cloud, signal)).rejects.toMatchObject({ message: 'http-error', status: 401 });
  });

  it('requires a key for a remote compatible service', async () => {
    await expect(listAiModels({ ...cloud, apiKey: '' }, signal)).rejects.toThrow('missing-key');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propagates cancellation and disables redirects', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
    }));
    const request = streamAiChat(local, messages, controller.signal, vi.fn());
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock.mock.calls[0][1].redirect).toBe('error');
  });

  it('bounds model list responses before parsing JSON', async () => {
    fetchMock.mockResolvedValue(new Response(' '.repeat(1024 * 1024 + 1)));
    await expect(listAiModels(local, signal)).rejects.toThrow('response-too-large');
  });
});
