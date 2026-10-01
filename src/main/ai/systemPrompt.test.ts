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
 * @file systemPrompt.test.ts
 * @description Lingyu 本地提示词的品牌、免费能力与实际访问边界验证。
 * @author 灵屿
 */

import { describe, expect, it } from 'vitest';
import { buildLingyuSystemPrompt } from './systemPrompt';

describe('local Lingyu system prompt', () => {
  it('describes the free model choices and current capabilities consistently', () => {
    const prompt = buildLingyuSystemPrompt();
    expect(prompt).toContain('Lingyu');
    expect(prompt).toContain('Ollama');
    expect(prompt).toContain('API key');
    expect(prompt).toContain('streaming');
    expect(prompt).toContain('cancel');
    expect(prompt).toContain('no Lingyu account');
    expect(prompt).toContain('no tools');
    expect(prompt).toMatch(/never claim/i);
    expect(prompt).toContain('stops collecting when disabled');
    expect(prompt).toContain('conflicting edits keep the saved data');
    expect(prompt).toContain('Unicode paths');
  });
});
