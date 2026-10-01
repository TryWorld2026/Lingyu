# 灵屿 Lingyu 安全政策

本政策适用于 [TryWorld2026/Lingyu](https://github.com/TryWorld2026/Lingyu)。请从本项目的 [Releases](https://github.com/TryWorld2026/Lingyu/releases) 获取发行版本。

如项目 Security 页面提供“Report a vulnerability”，请通过该入口私下报告。若入口尚未启用，可在 [Lingyu Issues](https://github.com/TryWorld2026/Lingyu/issues) 仅申请私下联系渠道，不要公开漏洞利用细节或凭据。没有另行约定的响应时限承诺。

报告请包含受影响版本、Windows 版本、漏洞位置、最小复现步骤与影响。只使用你自己的测试数据，不发送 API Key、私人聊天记录或其他用户数据。

AI 对话直接发送到用户配置的模型服务。Key 由主进程加密保存在本机，公开配置不返回 Key，服务地址变更不会自动沿用旧凭据。当前聊天记录只保留在运行内存中；模型服务自身的数据使用政策由用户选择的服务决定。

维护者应保留窗口入口与主 frame 校验、专用 IPC 和网络响应边界。不要在持有写权限或凭据的工作流中执行不可信 PR 代码。AI 功能调整同步维护本地提示词与中英文说明。

当前工程审查与尚未关闭的问题见 [对抗式审查报告](../docs/ADVERSARIAL_REVIEW_2026-10-01.md)。
