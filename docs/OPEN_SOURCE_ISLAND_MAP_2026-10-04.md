# 桌面灵动岛参考地图：2026-10-04 补充研究

## 范围和方法

合并仓库中 10 月 2–3 日的 16 个候选记录，本轮新增 14 个候选，共 30 个仓库。包含 Windows、macOS、Linux 及跨平台项目；包含 fork、同名但不同作者的项目，也包含只有发行资料或许可尚未确认的候选。数量不等于独立产品数量，更不代表全部项目都已运行或完整审计。

- A：既有固定提交与源码研究，本轮按需复读关键文件。旧记录称其中 15 个含选定源码，DynamicWin V2 为发行资料。
- B：本轮固定 HEAD，读取官方 README 与可找到的根许可证；功能为项目自身的描述，没有运行验证。
- C：在 B 的基础上，本轮另外读取选定实现文件；仍未运行第三方项目。

检索使用 Windows/WPF/动态岛、macOS/notch、Linux/Quickshell 和 Android 相关组合词，以官方仓库为证据。公开 GitHub API 在采集时限流，随后改用 `git ls-remote` 和固定提交的 raw 文件；没有依赖 API 星标/热度排序作质量结论。

旧快照缓存：`dist/research/desktop-islands-2026-10-02/`。新增缓存：`dist/research/native-iteration-2026-10-04/`；其中 `index.json`、`head.txt`、README、LICENSE 记录采集依据。原研究在 `docs/DESKTOP_ISLAND_RESEARCH_2026-10-03.md`。

## 1. 既有候选：保留价值，避免重复实现

| 候选 | 证据 | 主要用途 | 灵屿取舍 |
|---|---|---|---|
| [boring.notch](https://github.com/TheBoredTeam/boring.notch) | A | 悬停、共享封面、临时反馈 | 保留空间连续性；不移植整个页面体系 |
| [Ebullioscopic/Atoll](https://github.com/Ebullioscopic/Atoll) | A | 专注、日历、设备/隐私状态、持续活动 | 提醒/专注优先；其余按 Windows 能力确认 |
| [Luma-Bar](https://github.com/Linus-Shyu/Luma-Bar) | A | 焦点、音乐进度、本地 AI 动作 | 即时反馈与长输入分开；不沿用巨型入口文件 |
| [DynamicNotchKit](https://github.com/mrkai77/DynamicNotchKit) | A | 形态与宿主窗口分离 | 参考边界，不替换现有 WPF 驱动 |
| [OpenNook](https://github.com/twinkling-reality/opennook) | A，本轮复读队列 | 优先级、合并、等待用户操作结束 | 下一阶段活动调度的重要参考 |
| [NotchDrop](https://github.com/Lakr233/NotchDrop) | A | 文件投放、卡片、拖出 | 灵屿保留引用语义，不照搬复制/过期删除 |
| [WinIsland](https://github.com/WinIslandProject/WinIsland) | A | 自绘轮廓、活动优先级、分级调度 | 借鉴调度；不把工作集裁剪当内存优化证据 |
| [WinIslands](https://github.com/JudeKwong/WinIslands) | A | WPF 媒体事件、封面缓存、动画起点 | 借鉴 Windows 适配问题及回归场景 |
| [DropSpace](https://github.com/airanluo-dot/DropSpace) | A，本轮复读运动 | 保留速度、长暂停、区域同步 | 原生版已吸收同类机制，继续验证即可 |
| [NoraBar](https://github.com/mtmtyu/NoraBar) | A | 音乐优先、薄边入口、设置分离 | 借鉴信息收敛 |
| [LyricIsland](https://github.com/BochengYao/LyricIsland) | A | 播放能力、时间补偿、歌词匹配 | 本地歌词之后再扩展自动匹配 |
| [WinLand](https://github.com/luolangaga/WinLand) | A | 有限活动卡片、文件目标、命中区域 | 旧快照未找到许可；仅设计观察 |
| [PILLAR](https://github.com/warpirate/pillar-dynamic-island-for-windows) | A | 混音、专注、系统状态、AI/任务入口 | 参考功能组织，真实操作结果必须检查 |
| [onlytrisdev/dynamic-island-windows](https://github.com/onlytrisdev/dynamic-island-windows) | A | 媒体、计时器、OSD 后恢复 | 不把宣传帧率与包体当作实测资源结果 |
| [Dynamic Island Notifier](https://github.com/sadeeshasathsara/dynamic-island-on-windows) | A | 通知卡片、悬停动作 | 通知单独试验，不抑制全局系统通知 |
| [FlorianButz/DynamicWin](https://github.com/FlorianButz/DynamicWin) | A，发行资料 | 文件托盘、活动、DPI/鼠标问题 | V2 资料不能作为已审查应用源码 |

这些项目的固定 SHA 与分目录许可在原研究附录中。这里不把两天前快照描述为当前所有默认分支的状态。

## 2. 新增候选和固定提交

| 候选 / 固定提交 | 证据 | 官方材料呈现的功能 | 取舍与许可记录 |
|---|---|---|---|
| [eIsland · 68d26bbcbe97](https://github.com/JNTMTMTM/eIsland/tree/68d26bbcbe97eddd7d533cfd2b81632cf7ffe3df) | B | 总览、天气、歌词、工具和 Agent | 灵屿的既有来源；记录 GPL 文本及附加条款，不简化为无条件代码复用 |
| [ShoreHue · 8a8a8fb45b65](https://github.com/timecolors/ShoreHue/tree/8a8a8fb45b65b8bc9f38e18b005609975ce35c4e) | B | WPF 边缘面板、剪贴板、系统开关、AI、自定义组件 | 借鉴设置分组与设备操作；不扩成任务栏替代品；MIT |
| [Lost Island · 09a2e9f68ebb](https://github.com/MarcoZorn/lost-island/tree/09a2e9f68ebb39cfbb73a69f343b4df92641b201) | C | Linux 主体的音乐/OSD/设备/天气；Windows/macOS/Android 配套 | 按平台区分成熟度；关注按可见性采样；MIT |
| [cyrus-cai/notchi · deb27a354684](https://github.com/cyrus-cai/notchi/tree/deb27a354684309ff2383cc0fa8adfd4a825169c) | C | AI、笔记、提醒、BYOK、CLI Agent | 借鉴输入到动作的流程；不照搬全部工具权限；MIT |
| [rutmehta/Atoll · 537ad7d6e300](https://github.com/rutmehta/Atoll/tree/537ad7d6e30007bb55efea3960f00938164d6c10) | B | 媒体、文件、日历、计时、Agent 会话状态 | 与 Ebullioscopic/Atoll 分开记录；Agent 状态为远期候选；MIT |
| [Open Agent Island · 0c6cadca431f](https://github.com/patheonsceo/openagentisland/tree/0c6cadca431fe781bbad1d2621a1e83192d13bba) | B | Hyprland 状态岛、会话、终端定位、批准交互 | 只借鉴事件表达；其 Linux socket/hook 路线不直接迁移；GPL-3.0 文本 |
| [Ukishima · 60170762e703](https://github.com/amanhex/ukishima/tree/60170762e703915cd266d47fd61246c749d7535c) | B | 多屏表面、混音、文件/剪贴板、录屏、通知、系统控制 | 功能池参考；完整桌面 shell 超出灵屿当前范围；MIT，README 另记录 Ricelin 来源 |
| [Quickshell Dynamic Island · eb8e65056b60](https://github.com/lunanoir21/quickshell-dynamic-island/tree/eb8e65056b6073ff490bf4b09a47c1c89c0924da) | B | cava 频谱、歌词、计时、混音、设备指示 | 借鉴音乐/完成事件；MPRIS/PipeWire 能力不能直接等同 SMTC；MIT |
| [gh-notch · 8d91edaebe75](https://github.com/aymandakirgh/ghnotch/tree/8d91edaebe75308e3575a3306b587990efcb9e45) | B | AI 命令栏、电池、日历、文件架 | README 明示媒体/部分 HUD 尚为计划，不列为已实现样板；MIT |
| [NotchApp · f6ab5deed8b1](https://github.com/erwinzhang7/NotchApp/tree/f6ab5deed8b18f4d8e600ca27f2b68dbeccaad11) | B | 文件架、剪贴板、媒体、日历/提醒、文件转换 | 借鉴能力检查与内存态数据说明；不增加转换器作为首版负担；GPL-3.0 文本 |
| [Vibe Island · 4c6897766828](https://github.com/NetVar1337/vibe-island/tree/4c6897766828ef903f9dae886c8b2b1e912820eb) | B | 跨平台 Agent 会话、等待批准、跳回终端 | 后续状态桥接参考；未测试其列举的 CLI 集成；GPL-3.0 文本 |
| [dynamic-island-v2 · bc44d5a5f936](https://github.com/F0rger123/dynamic-island-v2/tree/bc44d5a5f936092c5f4ceacdea13c55b1ca11a97) | B | Windhawk 覆盖层、.NET 桥接、日历与 Agent | 探索性资料；常用根许可文件未找到，未做全树许可审查 |
| [manuelsawade/dynamic-win · f1edb9a800ac](https://github.com/manuelsawade/dynamic-win/tree/f1edb9a800ac267df449caeaed5671d28740d620) | B | 媒体、天气、计时、文件托盘、主题、扩展 | 明确为 FlorianButz 项目的 fork；根文件 CC-BY-SA-4.0，逐文件再核查 |
| [JXTDEVELOPER/DynamicWin · 28debbcdf9ce](https://github.com/JXTDEVELOPER/DynamicWin/tree/28debbcdf9ce0a4a2d21c7d04d4718d17bc992f2) | B | WPF/Skia 悬停/展开和媒体原型 | README 列出未接 UI 的控制、封面泄漏等限制；常用根许可文件未找到 |

许可证栏是采集文件的记录，不是兼容性法律判断；本次未向产品移植第三方代码。没有明确授权的候选仅作设计观察。闭源商业 notch 产品不加入“开源源码已参考”的统计。

## 3. 新源码带来的具体结论

### 可见性就是采样生命周期

Lost Island 的 Linux 系统监控服务启动时开启 3 秒采样，停止时移除计时器；展开面板 map/unmap 分别启动/停止它，播放进度也检查播放和可见状态。其 Windows 配套时钟按分钟边界唤醒。这些是读到的实现，不是本轮性能测量。

灵屿应让每个系统模块有明确的观察者和释放时机：没有可见消费者就停止性能采样、声纹、无必要的播放进度 UI 更新。不要将 README 的“事件驱动”理解成项目没有任何计时器。

来源：[system.py](https://github.com/MarcoZorn/lost-island/blob/09a2e9f68ebb39cfbb73a69f343b4df92641b201/lostisland/services/system.py)、[expanded.py](https://github.com/MarcoZorn/lost-island/blob/09a2e9f68ebb39cfbb73a69f343b4df92641b201/lostisland/ui/expanded.py)、[Windows 时钟](https://github.com/MarcoZorn/lost-island/blob/09a2e9f68ebb39cfbb73a69f343b4df92641b201/windows/MainWindow.xaml.cs)。

### AI 的输入分类与操作执行分开

Notchi 的 IntentEngine 对 ask/note 给出分类和置信度；工具实现独立处理笔记、提醒、设置和命令。其部分写操作直接执行，不能把它描述为“所有操作都有确认”。灵屿借鉴业务入口的组织方式，继续采用适合本项目的四类可编辑提议与确认流程。

来源：[IntentEngine.swift](https://github.com/cyrus-cai/notchi/blob/deb27a354684309ff2383cc0fa8adfd4a825169c/NotchGlass/Sources/IntentEngine.swift)、[AgentTools.swift](https://github.com/cyrus-cai/notchi/blob/deb27a354684309ff2383cc0fa8adfd4a825169c/NotchGlass/Sources/AgentTools.swift)。

### 聚合功能不等于堆叠常驻界面

OpenNook 的队列按优先级/FIFO 选等待项，同键合并并让出用户操作；DropSpace 的运动通道保留速度。灵屿已经有连续运动，下一步更值得投入的是内容活动调度和取消/恢复规则。

来源：[NookActivityQueue.swift](https://github.com/twinkling-reality/opennook/blob/3e97de90a2d569f39f1cf7221d0d4bd1f1ca748c/Sources/NookComponents/Activities/NookActivityQueue.swift)、[OverlayMotionController.cs](https://github.com/airanluo-dot/DropSpace/blob/5c9e014ecb160b8280baab02f5fae1edf84ccd8c/src/DropSpace.Core/Overlay/OverlayMotionController.cs)。

## 4. 功能池的归并

| 功能族 | 代表来源 | 灵屿安排 |
|---|---|---|
| 三态、形变、悬停、命中、全屏、多屏 | boring.notch、DropSpace、WinIslands、DynamicNotchKit | M1 继续精修已有基础 |
| 媒体、歌词、声纹、播放器能力 | LyricIsland、Luma-Bar、Quickshell Dynamic Island | M1 音乐样板；自动歌词/声纹分项推进 |
| 专注、计时器、提醒、任务、笔记 | Atoll、eIsland、Notchi | M2 可靠闭环 |
| 活动优先级、合并、OSD、恢复 | OpenNook、WinIsland、PILLAR | M2 公共活动调度 |
| 文件暂存、预览、拖出 | NotchDrop、NotchApp、DynamicWin | M3 引用式文件架 |
| 音频/亮度/电池/性能/快捷键 | ShoreHue、PILLAR、Lost Island | M3 独立可关闭模块 |
| 系统通知/通知历史 | Notifier、Atoll、Ukishima | 自身提醒之后，先验证 Windows 路径 |
| AI 对话、可编辑动作、模型选择 | Luma-Bar、Notchi、eIsland、gh-notch | M4；连接和流式可靠性在 M1 先修 |
| 外部 Agent 状态与跳回会话 | Vibe Island、Open Agent Island、rutmehta/Atoll | 长期可选方向，先状态再交互 |
| 剪贴板、日历订阅、设备指示 | NotchApp、ShoreHue、Atoll | 核心稳定后逐项评估 |
| 文件转换、桌面替换、镜头预览、宠物、插件市场 | 部分扩展项目 | 记录需求池，不作为原生 1.0 前置条件 |

最终规格及模块交付顺序见 `docs/NATIVE_ITERATION_DIRECTION_2026-10-04.md`。选择依据是日常价值、图片匹配、Windows 可实现性和维护成本，没有按星标或功能数量给项目排名。
