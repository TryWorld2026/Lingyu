# 灵屿原生工程

本目录是独立 C# / .NET / WPF 客户端。使用根目录的注释和前端规范中原生章节；网页、React 和旧插件专项规范不适用于此目录。根目录 [AGENTS.md](../AGENTS.md) 第 5 节的双提示词入口同样适用。

- 对外文字使用 `TextCatalog.T()` 或 XAML `L`；同时维护 `Lingyu.App/i18n/zh-CN.json` 与 `en-US.json`。
- 当前原生 AI 提示词入口为 `Lingyu.Core/NativePrompt.cs`。功能范围变化必须同步这个入口；旧客户端提示词仍位于 `src/main/ai/systemPrompt.ts`，描述已发布的旧版能力。
- `README.md`、`README.zh-CN.md`、`native/README.md` 与 `NativePrompt.cs` 中声明的预览版本必须与 `Directory.Build.props` 的 `<Version>` 一致；发布前执行 `python native/scripts/check-prompt-version.py`，该检查已并入 `check-contracts.py`。
- 预览数据只使用 `%LOCALAPPDATA%/Lingyu/NativePreview`，不能覆盖旧客户端的配置、数据或安装目录。
- 不把视觉样例混入正常用户状态。`--showcase` 必须明确标记，不能保存样例或冒充真实播放、天气与模型回复。
- 工作台关闭要解除订阅；异步网络不能持有关闭窗口的视觉树。系统接口直接调用，不启动常驻辅助进程。
- 先执行 `dotnet run --project native/Lingyu.Tests -c Release`、原生构建和可运行窗口验收，再生成预览包。完整发布/迁移/官网同步在第一阶段预览验收后继续。
