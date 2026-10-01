# CHANGE LOG

> 基于 Git 提交记录自动生成，按版本号顺序排列（含哈希与贡献者）。
> 生成时间：2026-08-07T06:09:48.875Z

## v0.4.1 · 2026-10-01

- 全新石墨、银白与低饱和紫界面；白色胶囊品牌图标与本地 Manrope / Noto Sans SC 字体。
- 桌面胶囊展开为音乐、天气与时间三栏，播放、拖动进度、系统音量与工作台入口连接实际功能。
- 设置和完整工具移入可调整大小的独立工作台；AI 会话侧栏、专注计时、待办、文件暂存与系统控制统一视觉。
- 工作台关闭时收回到后台，保留本次运行的会话及专注时钟；退出时清除内存会话。
- 修复媒体初始状态同步、工作台提醒上岛、延迟计时、旧窗口模式导致设置快捷键不生效和退出 API 缺失处理器的问题。
- 免费软件、本地 Ollama 与自带 API Key 的费用边界保持一致，官网使用真实产品界面展示。

## v0.4.0 · 2026-10-01

- 独立的免费 AI 配置、流式多轮对话、取消生成与本机加密保存用户密钥。
- 修复剪贴板启动与禁用、列表并发保存、计时与闹钟、原生模块与打包资源。
- 详细核对见 [功能验证](FUNCTIONAL_VERIFICATION_2026-10-01.md) 和 [免费 AI](LINGYU_FREE_AI_2026-10-01.md)。

## 历史提交

- 2026-08-07 | 6103677 | TryWorld | chore: bump version to 0.2.0
- 2026-08-07 | 116a588 | TryWorld | feat: README 增加产品截图预览（灵动岛形态）
- 2026-08-06 | b852879 | TryWorld | feat: 官网 https://lingyu.tryworld.com.cn/ 加入 README 与产品信息
- 2026-08-06 | 37fdb73 | TryWorld | fix: hover 切换按钮改为右上角小胶囊（绝对定位），不再遮挡时间/天气内容
- 2026-08-06 | 508b5d1 | TryWorld | fix: 导航标签条挤压内容区——expanded 紧凑化、maxExpand 滚动修复、hover 布局调整
- 2026-08-06 | 8f56011 | TryWorld | feat: 交互优化——底部导航图标+文字标签、hover 简化、轻引导接线、设置子页导航可读化
- 2026-08-06 | 01a94ce | TryWorld | fix: 打包后 exe 内嵌灵屿产品图标与版本信息（afterPack 钩子）
- 2026-08-06 | 0096503 | TryWorld | feat: 关于页头像换成用户头像，slogan 改为『尝试，即世界 Explore by Trying』
- 2026-08-06 | 7087229 | TryWorld | feat: 产品信息页全面品牌化为灵屿，移除原项目作者与 pyisland 服务残留
- 2026-08-06 | 6fa4efa | TryWorld | refactor: 插件与全部文件彻底品牌化为 Lingyu，删除 eIsland 残留
- 2026-08-06 | c054d5a | TryWorld | feat: 启动画面品牌化为灵屿，移除赞助商引导步骤
- 2026-08-06 | 3170704 | TryWorld | chore: 彻底清除 eIsland 品牌痕迹，全面品牌化为灵屿 Lingyu
- 2026-08-06 | c5884c4 | TryWorld | docs: 替换 states.md 中的微信 AppID 示例值，避免秘密扫描误报
- 2026-08-06 | 11e7e9c | TryWorld | chore: 移除引用 eIsland 私有服务的 workflow（frpc-deploy/release-build-upload）
- 2026-08-06 | b9f9f9a | TryWorld2026 | 灵屿 Lingyu v0.1.0：免费开源的 Windows 桌面灵动岛
