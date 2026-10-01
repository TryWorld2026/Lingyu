# Luma Bar 对照记录

2026-10-02，应用户要求阅读 [Luma Bar 仓库](https://github.com/Linus-Shyu/Luma-Bar)、原生窗口、悬停控制、材质、播放时钟及本地动作源码。此环境没有 macOS，未验证它的运行表现或资源占用。

灵屿保持独立 C# / WPF 工程；这一轮对照落实在原生体验上：

| 对照项 | 源码观察 | 灵屿实现与验证 |
| --- | --- | --- |
| 焦点 | 小岛与输入面板分别处理激活权限 | 小岛使用 `WS_EX_NOACTIVATE`，工作台是独立输入窗口 |
| 全屏 | 处理隐藏、恢复及状态保留 | Windows 前台/位置事件感知真实全屏，隐藏小岛，保留业务状态 |
| 悬停 | 合并悬停事件，离开后延迟收起 | 三形态状态机，离开延迟 300 ms，用户展开不会自动收起 |
| 绘制 | 系统材质和固定透明层承担表面，避免焦点引起灰色闪烁 | 矢量边缘/反光与真实控件，工作台使用 DWM 圆角，删除大面积软件阴影 |
| 播放进度 | 时间锚点插值并在暂停时停止 | Windows SMTC 事件更新快照，播放中插值，暂停和曲目长度约束有业务测试 |
| AI 行动 | 本地动作有明确边界 | 回复保存笔记、编辑任务草稿后添加；不开放任意 Shell 执行，不悄悄读取文件和笔记 |

没有导入其 Swift 源码、品牌、图标或产品素材。Windows 的交互和系统适配独立实现。语音、宠物和跨应用会话感知未加入本阶段范围。

参考入口：[窗口与界面](https://github.com/Linus-Shyu/Luma-Bar/blob/main/Sources/LumaBar/main.swift)、[播放时钟](https://github.com/Linus-Shyu/Luma-Bar/blob/main/Sources/LumaBar/PlaybackProgressClock.swift)、[本地动作](https://github.com/Linus-Shyu/Luma-Bar/blob/main/Sources/LumaBar/SafeAgentActions.swift)。
