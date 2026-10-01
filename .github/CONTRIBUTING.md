# 为灵屿 Lingyu 做贡献

Lingyu 由 TryWorld2026 维护，基于 [eIsland](https://github.com/JNTMTMTM/eIsland) 二次开发，使用 Electron、React、TypeScript 与 Windows 原生辅助插件。

问题与建议请提交到 [Lingyu Issues](https://github.com/TryWorld2026/Lingyu/issues)。请附软件版本、Windows 版本、复现步骤和预期行为；日志与截图中移除 API Key 和私人内容。上游来源署名与许可证继续保留。

开发前先阅读根目录 [AGENTS.md](../AGENTS.md)、[注释规范](../docs/COMMENT_STANDARDS.md) 和 [前端规范](../docs/FRONTEND_STANDARDS.md)。使用 `npm install` 安装依赖，`npm run dev` 启动开发环境；原生插件按各插件目录的说明构建。

新功能或修复应包含针对行为的验证。提交前运行 `npm run test`、`npm run typecheck`、`npm run build`、`npm run i18n:check` 和 `npm run comment:check`，说明尚未关闭的基线问题。

新增 UI 文案同时维护 zh-CN 与 en-US；设置项注册到 SEARCHABLE_SETTINGS。AI 能力变化同步维护 [本地提示词](../src/main/ai/systemPrompt.ts) 和对应测试。软件侧功能不以账号或会员资格限制，第三方模型费用的说明须准确。
