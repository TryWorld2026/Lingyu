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
 * @file aiError.ts
 * @description 仅传递稳定错误码，避免模型服务错误泄漏 Key 或对话内容。
 * @author 灵屿
 */

import type { AiErrorCode } from '../../shared/ai';

export class AiError extends Error {
  /**
   * 创建不包含服务响应正文的 AI 错误。
   * @param code - 可翻译的错误码。
   * @param status - 可选 HTTP 状态。
   */
  constructor(public readonly code: AiErrorCode, public readonly status?: number) {
    super(code);
    this.name = 'AiError';
  }
}
