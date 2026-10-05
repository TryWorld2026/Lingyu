# 灵屿：桌面灵动岛项目源码研究与交互设计决策

研究日期：2026-10-02 至 2026-10-03。目标：为独立的 C# / .NET 10 / WPF 灵屿确定可落地的功能组织、连续形变和性能验收方案。视觉沿用用户确认的八张 GPT 原型：石墨黑、银白、低饱和紫、胶囊标志，以及“灵动岛＋独立工作台”。

## 1. 研究范围与证据边界

筛选了 16 个 GitHub 候选，抓取其中 15 个项目的选定源码；DynamicWin 当前分支仅提供发行资料。核对了源码提交、许可证、近期 Release 和公开 issue / PR 样本。15 份源码的 HEAD 均与抓取索引中的 SHA 一致，研究工作树没有修改。完整提交索引见附录。

源码缓存位于仓库忽略目录 `dist/research/desktop-islands-2026-10-02/`。每个项目保留 repo-metadata.json、tree.json、releases.json、issues.json；有源码的项目另有 source/。这是浅克隆和选择性检出，未下载全部历史、依赖和大型素材。公开问题样本含 PR，不能用条目数量判断产品质量。

本轮完成静态源码审查、官方演示素材抽帧观察和独立数学模拟。未运行第三方应用，未运行其测试，未在 macOS 测量帧率、内存或交互延迟。报告中的“借鉴”是灵屿的设计推导；项目声称的性能、用户 issue 的测量和灵屿未来的验收指标分别注明。

## 2. 应当落地的五个决定

1. **形状与内容同步过渡。** 宽高、圆角、封面位置、内容透明度由一个过渡驱动；快速反向操作从当前画面继续。取消过时的延迟任务和完成回调。
2. **小岛表达正在发生的事。** 音乐、专注、AI 和提醒各有紧凑与展开布局；长期编辑、历史、设置进入工作台。
3. **用户操作优先。** 悬停预览不抢焦点；手动展开、拖拽、调节滑杆、确认 AI 时保护当前操作。后台事件合并并排队，结束后恢复用户选择的内容。
4. **动画按需运行。** 动画结束即解除逐帧订阅；隐藏时停止可视化。音乐进度采用本地时间插值，系统事件负责校准；封面解码与缓存有上限。
5. **先验证三个完整样板。** 音乐展开态、专注态、AI 工作台分别完成真实操作、连续切换、异常状态、截图和性能检查，再扩展全部页面。

## 3. 候选项目与实际价值

| 项目 | 实现路线 | 值得借鉴的重点 | 取舍与边界 |
|---|---|---|---|
| [boring.notch](https://github.com/TheBoredTeam/boring.notch) | macOS / SwiftUI、AppKit | 悬停防抖、顶部锚定、共享封面过渡、临时反馈 | 主分支含新功能，稳定版与 RC 要分别看；已有 CPU 修复记录 |
| [Atoll](https://github.com/Ebullioscopic/Atoll) | macOS / SwiftUI、AppKit | 专注与提醒的持续活动、定时器生命周期标识、顶边悬停处理 | 功能范围很大；存在封面回退引发内存尖峰的公开问题 |
| [Luma-Bar](https://github.com/Linus-Shyu/Luma-Bar) | macOS / SwiftUI、AppKit | 悬停与主动输入的焦点区分、播放进度校准、本地 AI 操作体验 | main.swift 约 2.4 万行，不照搬组织方式；macOS 系统能力需重新实现 |
| [DynamicNotchKit](https://github.com/mrkai77/DynamicNotchKit) | macOS / SwiftUI、NSPanel | 紧凑／展开／隐藏、无刘海显示器回退、内容形状与窗口分离 | 默认转换可以先隐藏；灵屿需要连续形变，不能直接复制这一行为 |
| [OpenNook](https://github.com/twinkling-reality/opennook) | macOS / Swift 模块 | 临时活动队列、同类事件合并、让出用户操作、过渡代次 | 可借鉴机制；首版无需引入完整插件／模块框架 |
| [NotchDrop](https://github.com/Lakr233/NotchDrop) | macOS / SwiftUI、AppKit | 拖入时出现文件入口、文件卡片、拖出和分享 | 项目会复制文件至自身存储；灵屿首版保存位置，删除语义要独立设计 |
| [WinIsland](https://github.com/WinIslandProject/WinIsland) | Windows / Rust、Win32、自绘渲染 | 宽高圆角弹簧、动画／交互／空闲分级调度、活动优先级 | 仍有周期轮询和工作集裁剪，不能据此认定空闲零开销 |
| [WinIslands](https://github.com/JudeKwong/WinIslands) | Windows / C#、WPF | 当前尺寸作为动画起点、过时回调保护、媒体事件、封面缓存 | 设置动画帧率上限不等于实际帧率；强制 GC 与工作集裁剪不能作为内存达标依据 |
| [DropSpace](https://github.com/airanluo-dot/DropSpace) | Windows / C#、WinUI 3 | 保留速度的弹簧、掉帧与睡眠处理、区域去重、停止帧循环 | 抓取的近期版本为 beta；16ms 定时器不等同显示器同步，也不证明 120 FPS |
| [NoraBar](https://github.com/mtmtyu/NoraBar) | Windows / C#、WPF | 音乐优先、薄顶边入口、按需展开、独立设置 | 400ms CubicEase 和立即悬停开关较简单，需要补连续反向与防误触 |
| [LyricIsland / LyricHover](https://github.com/BochengYao/LyricIsland) | Windows / C#、WPF | 时间轴补偿、播放器能力、歌词候选评分、缓存 | 自动匹配可用于后续版本；首版先完成网易云和本地 LRC |
| [WinLand](https://github.com/luolangaga/WinLand) | Windows / C#、WinUI 3 | 当前活动＋有限队列卡片、拖入时显示可用目标、形状级命中 | 抓取提交的递归树未找到许可证文件，API 也未识别许可证；只观察设计 |
| [PILLAR](https://github.com/warpirate/pillar-dynamic-island-for-windows) | Windows / Rust、Tauri、React | hover peek / click expand、动作状态、减少动画、轮询退避 | 不能把安装包约 3MB 当成运行内存；静态审查发现媒体 seek 的 bool 结果被忽略 |
| [onlytrisdev/dynamic-island-windows](https://github.com/onlytrisdev/dynamic-island-windows) | Windows / Rust、Tauri、React | 紧凑音乐＋独立倒计时、系统反馈后恢复内容、原生窗口配合前端形变 | 多组 500–2500ms 轮询与后台线程；120 FPS 宣传尚无本轮实测支持 |
| [Dynamic Island Notifier](https://github.com/sadeeshasathsara/dynamic-island-on-windows) | Windows / C#、WPF、WinRT | 通知卡片、悬停操作、自动收起 | 实际以 500ms 轮询通知；修改通知注册表的方式不纳入灵屿首版 |
| [DynamicWin](https://github.com/FlorianButz/DynamicWin) | Windows / 当前仓库为发行资料 | 活动／文件托盘设计，以及发行与问题记录 | 当前 V2 分支只有 README、LICENSE、预览素材等，无法审查当前实现 |

## 4. 深度结论：怎样获得 macOS 灵动岛的交互感

### 4.1 悬停应有即时反馈和可取消的意图判断

boring.notch 在进入时先更新悬停反馈，等待 minimumHoverDuration 后再次确认指针和状态；离开延迟 100ms，返回时取消旧任务。分享操作期间也会阻止自动收起。Atoll 另处理指针停在屏幕最上方像素时的错误离开事件。[boring 悬停实现](https://github.com/TheBoredTeam/boring.notch/blob/d58240cc160d5e54da1a8a5925e095d067a8e1e0/boringNotch/ContentView.swift#L513)、[Atoll 悬停实现](https://github.com/Ebullioscopic/Atoll/blob/9ff6a548a6da84b2e8011a0b27d42abd3700e18e/DynamicIsland/ContentView.swift#L2303)。

灵屿设计推导：指针进入立即有轻微反馈，停留后进入悬停态；点击进入固定展开态。离开延迟允许指针穿越圆角边缘。手动展开、鼠标捕获、菜单或操作确认存在时，不执行自动收起。全屏隐藏和显示器变更撤销旧悬停任务。

### 4.2 外壳、封面与内容必须保持空间连续性

boring 的 ContentView 使用 interactiveSpring，并为打开和关闭设置不同参数；NotchHomeView 的封面使用 matchedGeometryEffect。官方 GIF 的抽帧可观察到：封面先出现在紧凑刘海侧边，再进入展开播放器，展开期间音乐控制保持稳定布局。[共享运动与形状](https://github.com/TheBoredTeam/boring.notch/blob/d58240cc160d5e54da1a8a5925e095d067a8e1e0/boringNotch/ContentView.swift#L40)、[封面与播放器](https://github.com/TheBoredTeam/boring.notch/blob/d58240cc160d5e54da1a8a5925e095d067a8e1e0/boringNotch/components/Notch/NotchHomeView.swift#L88)、[官方演示](https://github.com/user-attachments/assets/2d5f69c1-6e7b-4bc2-a6f1-bb9e27cf88a8)。

灵屿设计推导：以顶部中心为锚点向两侧、向下展开；封面从当前矩形迁移到展开位置，文字保持正常字形和最终清晰度。切歌只替换封面和歌曲数据，播放按钮、进度条不重新入场。天气刷新只更新天气区域。

SwiftUI 的 response、dampingFraction 和 WPF 的 Duration 含义不同。不能把参考项目的 0.42 直接当成灵屿统一的 420ms，也不能把 Storyboard 设置为 120 当成流畅度证明。

### 4.3 反向操作必须保留当前画面，并处理过期异步工作

DropSpace 的 SetTarget 修改目标，保留各通道当前值和速度；Step 使用有界子步推进，对长时间暂停直接落到目标。源码有反向、100 次循环、1000 次形态切换、普通掉帧和睡眠恢复的测试用例，本轮只审查了测试内容。[弹簧控制器](https://github.com/airanluo-dot/DropSpace/blob/5c9e014ecb160b8280baab02f5fae1edf84ccd8c/src/DropSpace.Core/Overlay/OverlayMotionController.cs#L131)、[连续切换用例](https://github.com/airanluo-dot/DropSpace/blob/5c9e014ecb160b8280baab02f5fae1edf84ccd8c/tests/DropSpace.Core.Tests/OverlayMotionControllerTests.cs#L24)。

OpenNook 用 transitionGeneration 和取消任务防止旧展开／隐藏任务操纵已被新操作替换的窗口，并处理显示器变化中断过渡后的恢复。[过渡代次](https://github.com/twinkling-reality/opennook/blob/3e97de90a2d569f39f1cf7221d0d4bd1f1ca748c/Sources/NookSurface/Nook.swift#L612)。

灵屿设计推导：几何参数保留位置和速度，内容透明度保留当前进度；旧操作的完成回调必须检查代次。打开 80ms 后收起、收起时再次进入、切歌过程中拖动，都继续当前过渡。只增加应用实际需要的单一驱动，不引入通用动效插件框架。

### 4.4 紧凑态和输入态有不同的焦点职责

Luma-Bar 的 IslandPanel 仅在允许键盘输入时成为 key window；悬停音乐面板保持 nonactivating，主动操作和 Agent 输入再启用焦点。其代码还明确避免在周期可见性检查中反复处理整个视图树。[窗口与焦点](https://github.com/Linus-Shyu/Luma-Bar/blob/d40b54c09c976b1857ace36c57022b970ae44f6f/Sources/LumaBar/main.swift#L6301)、[主动交互](https://github.com/Linus-Shyu/Luma-Bar/blob/d40b54c09c976b1857ace36c57022b970ae44f6f/Sources/LumaBar/main.swift#L9336)。

已查看仓库中的音乐和 Agent 实际截图；它们体现了紧凑反馈与操作面板的层次。灵屿继续采用已确定的深色原型和独立工作台：岛上的 AI 表达生成中、可停止、待确认；输入、长文和提议编辑在工作台进行。Windows 普通悬停使用不激活窗口，显式快捷键打开工作台后才获取输入焦点。

### 4.5 活动调度必须保护用户当前正在做的事

OpenNook 的 NookActivityQueue 按优先级和入队次序选择待处理活动，用 coalescingKey 合并同类待处理项；用户悬停或主动打开时暂停接管。它不打断已经展示的活动，高优先级只影响尚未展示的队列。[活动队列](https://github.com/twinkling-reality/opennook/blob/3e97de90a2d569f39f1cf7221d0d4bd1f1ca748c/Sources/NookComponents/Activities/NookActivityQueue.swift#L12)。WinIsland 也把音乐、计时器和带过期时间的上下文分开，由优先级选择紧凑内容。[上下文模型](https://github.com/WinIslandProject/WinIsland/blob/a79877fa09953e5fdb87f8a190a4bfa9d2f81806/crates/winisland-core/src/context/types.rs#L3)。

灵屿设计推导：将“形态”“当前活动”“用户操作保护”分开处理。音乐播放时出现任务到期提醒，可以短暂展示提醒；用户完成或稍后提醒后恢复原来音乐／专注内容。用户正在拖动音乐进度时，新提醒进入待处理列表与 Windows 通知，不替换正在操作的控件。AI 流式片段合并为状态更新，不让每个 token 驱动一次形变。

## 5. 功能设计如何进入灵屿 1.0

| 场景 | 小岛里的操作 | 工作台里的后续操作 | 验收要点 |
|---|---|---|---|
| 正在听网易云 | 真实封面、歌曲、进度；展开后播放／暂停、切歌和按能力启用的 seek | 播放器选择、本地 LRC、时间偏移 | 暂停立即冻结，播放器退出有空状态；失败不能显示成功 |
| 开始专注 | 紧凑态剩余时间；专注展开布局里暂停、继续、结束 | 自定义时长、休息阶段、关联待办、历史 | 完成有持久记录；睡眠／重启不丢计时会话，不重复提醒 |
| 灵屿提醒到期 | 显示实际标题与时间，完成／稍后提醒 | 修改、重复规则、待处理过期提醒 | 修改与取消立即生效，发生标识防重复；勿扰期间有可恢复记录 |
| AI 回复与操作 | 生成状态、停止、待确认入口 | 输入、历史、Markdown、可编辑操作提议、确认与结果 | 动作限创建待办、创建提醒、保存笔记、开始专注；服务返回成功后才报告完成 |
| 文件拖入 | 进入明确的暂存投放状态，松手后反馈实际数量 | 打开、定位、拖出复制、移除、丢失后重新定位 | 保存文件位置；移除条目不会删除用户源文件；拖动不能被自动收起打断 |
| 多个活动并存 | 主内容保持用户固定选择，次要活动以少量状态提示出现 | 今日页查看待处理事项 | 提醒结束后恢复先前内容；不堆叠大量卡片覆盖桌面 |

音乐进度可以参考 Luma 的“系统采样＋本地插值＋暂停冻结＋跳转重新锚定”。其实现使用 Date；灵屿运行中的插值应使用单调时钟，睡眠恢复后重新向系统校准。[PlaybackProgressClock](https://github.com/Linus-Shyu/Luma-Bar/blob/d40b54c09c976b1857ace36c57022b970ae44f6f/Sources/LumaBar/PlaybackProgressClock.swift#L18)。

LyricHover 的 SMTC 快照记录播放／暂停／前后切歌能力并补偿时间轴。它的网易云歌词候选同时比较曲名、歌手、专辑和时长，别名匹配还有额外阈值和候选差距要求。这证明自动歌词需要匹配质量和回退设计；首版保持本地 LRC 范围。[媒体快照](https://github.com/BochengYao/LyricIsland/blob/626d13ff7cf1201755a978577ec1627e9884e993/LyricHover.App/Media/SmTcMediaSessionService.cs#L210)、[歌词匹配](https://github.com/BochengYao/LyricIsland/blob/626d13ff7cf1201755a978577ec1627e9884e993/LyricHover.Core/NetEaseLyricsClient.cs#L82)。

NotchDrop 的文件暂存会建立自身存储副本，并有清理期限。灵屿按已确认的“保存位置”契约实现，借鉴拖入／拖出反馈和卡片组织；不复制它的删除、过期清理或 AirDrop 能力描述。[文件存储行为](https://github.com/Lakr233/NotchDrop/blob/e70b3d715a99e47de6eb823540282eafc7401a3a/NotchDrop/TrayDrop%2BDropItem.swift)。

跨应用通知、亮度、性能仪表、全盘搜索、桌面宠物、插件市场和视频背景保持在首版已确定范围之外。它们不构成完成音乐、专注、提醒、文件和 AI 日常任务的前提。

## 6. Windows 的原生圆角和形变实现

### 6.1 工作台与胶囊有不同的窗口几何要求

Windows 11 的 DWM 圆角 API 是系统提示，不能保证所有自定义窗口都被圆角化；使用逐像素透明或窗口区域的窗口不适用系统自动圆角。最大化／贴靠时系统也有自己的方角策略。因此，工作台优先走系统边框、圆角和阴影；胶囊按真实可见轮廓采用 Win32 区域或明确的合成方案。不能只画一个圆角 Border，却留下可见／可点击的矩形窗体。[微软圆角说明](https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/ui/apply-rounded-corners)。

DropSpace 使用固定宿主表面，将当前可见几何应用为原生区域，物理几何未变化时跳过重复区域更新。灵屿可以试验这种方式，避免每帧调整整个 HWND 尺寸；须同步裁切、命中区域、DPI 和表面背景，防止黑板／白边／裁切不同步。[表面与区域](https://github.com/airanluo-dot/DropSpace/blob/5c9e014ecb160b8280baab02f5fae1edf84ccd8c/src/DropSpace.App/OverlayWindow.xaml.cs#L935)、[区域去重](https://github.com/airanluo-dot/DropSpace/blob/5c9e014ecb160b8280baab02f5fae1edf84ccd8c/src/DropSpace.App/Services/OverlayNativeRegionController.cs#L5)。

这一方案必须先在 WPF、Windows 10/11、目标 GPU 和缩放比例下做小样验证。备用路径是有界的实际窗口尺寸动画；选择以帧时间、输入正确性和视觉证据为依据，保持 C# / WPF 技术路线。

### 6.2 避免用整页重排支付动画成本

WPF 的 Width／Height 等布局属性会影响测量与排列；更新现有 RenderTransform 可避免额外布局工作。缩略图应按显示需要的尺寸解码，缩放时的高质量重采样也可能增加开销。[微软布局建议](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/advanced/optimizing-performance-layout-and-design)、[微软图像建议](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/advanced/optimizing-performance-2d-graphics-and-imaging)。

灵屿的实现方向：外壳几何在有限大小表面更新，内容复用控件与变换；稳态恢复像素对齐和清晰文字。封面按显示尺寸乘 DPI 解码，用有字节上限的 LRU；同一首歌不重复解码。数据库、歌词读取、网络请求和图像准备留在后台，UI 只接收最新有效结果。硬件与软件渲染分别测量，不按渲染 Tier 猜测屏幕刷新率。

## 7. 灵屿动效契约与实测门槛

以下是灵屿的拟定参数和验收标准，尚未代表现有程序已实现或通过。

| 项目 | 拟定行为／目标 |
|---|---|
| 输入反馈 | 按钮和悬停先反馈，目标在 50ms 内；不包含有意设置的悬停等待 |
| 悬停意图 | 起点约 120–160ms；离开等待约 120–180ms，可被重新进入取消 |
| 主形变 | 延续已确认的约 180–240ms；以顶部中心锚定，过渡中可反向 |
| 内容切换 | 约 140–180ms，小幅位移和交叉透明度；不重播整个页面入场 |
| 按压反馈 | 约 80–120ms，缩放约 0.985；实际控件命中范围保持可靠 |
| 回弹 | 几何以高阻尼为主，默认克制；最大越界幅度目标不超过行程 1%，不穿越屏幕边界 |
| 减少动画 | 跟随系统，并可在应用设置覆盖；短透明度过渡或直接落定，停止回弹和持续装饰动画 |
| 60Hz | 对有效动画帧记录间隔，目标 P95 ≤20ms；连续超过 50ms 的停顿作为失败检查 |
| 高刷新屏 | 按实机实际刷新率测试 120Hz；目标 P95 ≤12ms，不以请求回调次数代替呈现证据 |
| 静止 | 没有待完成的形变时无该驱动的逐帧订阅；不可见页面不运行装饰动画 |
| 资源 | 沿用常驻私有内存 ≤120MiB、工作台 ≤240MiB、空闲平均整机 CPU ≤0.5% 的目标 |

几何驱动应保存当前值、速度、目标和单调时间。普通掉帧按实际经过时间有界推进；长时间睡眠后取消过时动画并恢复当前业务状态，不能补播成千上万帧。没有数据变化时，不重启同一目标动画。

独立的一维弹簧研究模拟采用 280→1000 DIP、每步不超过 1/240 秒、质量 1、角频率 55 rad/s、阻尼比 0.9。位置误差 <0.15 DIP 且速度 <2 DIP/s 时判定收敛，在 60Hz 与 120Hz 模拟均约 217ms。模型不含 WPF 布局、原生区域、GPU、图像、文本和输入成本；它只给调参起点，不能证明客户端帧率。复现脚本与结果放在研究缓存 motion-model-experiment.py 和 motion-model-results.json。

验收必须覆盖：打开中收起、收起中进入、短时间反复扫过顶边、滑杆拖出窗口后松手、拖入文件时提醒到期、全屏中收到提醒、动画中改变 DPI／拔掉显示器、AI 生成中关闭重开工作台。每种场景检查业务状态、可见轮廓、实际命中区域与焦点，不能只检查截图。

## 8. 性能与可靠性：参考项目也暴露了问题

- boring.notch 的 v2.8-rc.1 发行说明记录了部分用户高 CPU 和音频输出选择器悬停的修复。当前研究快照列出的稳定发行是 v2.7.3；RC 和 nightly 不冒充稳定版。[发行记录](https://github.com/TheBoredTeam/boring.notch/releases/tag/v2.8-rc.1)。
- Atoll 的公开 issue #866 报告了缺封面时应用图标回退引发超过 1GiB 的内存尖峰。抓取源码确实包含 tiffRepresentation、图像指纹编码及 PNG 编码路径；具体内存数值是报告者的测量，本轮没有重现。灵屿需测试缺封面、迟到封面和大图回退，并限制解码与缓存。[问题报告](https://github.com/Ebullioscopic/Atoll/issues/866)、[编码路径](https://github.com/Ebullioscopic/Atoll/blob/9ff6a548a6da84b2e8011a0b27d42abd3700e18e/DynamicIsland/managers/FullScreenArtworkWindowManager.swift#L809)。
- WinIslands 的内存优化器含 blocking / compacting GC 和 EmptyWorkingSet；WinIsland 也有周期工作集裁剪。工作集减少不能证明对象已释放、私有提交已下降或再次操作不会发生页面错误。[WinIslands 优化器](https://github.com/JudeKwong/WinIslands/blob/036533f7624a0d1884330885a34681e794c23fc9/src/WinIslands/Services/MemoryOptimizer.cs#L21)、[WinIsland 调度](https://github.com/WinIslandProject/WinIsland/blob/a79877fa09953e5fdb87f8a190a4bfa9d2f81806/src/window/app/frame.rs#L1081)。
- DynamicWin v2.0.3 记录了高 DPI、滑杆拖出客户区、文件托盘拖出的修复；另有透明保留空间遮挡浏览器页签、独占全屏仍显示和切歌崩溃的用户反馈。它们直接转化为灵屿验收用例，不能仅凭用户报告认定所有机器都会触发。[发行说明](https://github.com/FlorianButz/DynamicWin/releases/tag/v2.0.3)、[命中区域问题](https://github.com/FlorianButz/DynamicWin/issues/87)、[全屏问题](https://github.com/FlorianButz/DynamicWin/issues/89)、[切歌问题](https://github.com/FlorianButz/DynamicWin/issues/95)。
- PILLAR 的 seek_media 调用取得 bool 后忽略其值并返回 Ok。灵屿媒体和 AI 动作都要检查真实结果，失败有反馈，不能把“调用未抛异常”当成“操作成功”。[媒体结果处理](https://github.com/warpirate/pillar-dynamic-island-for-windows/blob/4017de9ee1c83d156952771a9f685175bbb27e9f/src-tauri/src/lib.rs#L1144)。
- Dynamic Island Notifier 的 ToastSuppressor 写入全局通知和应用横幅注册表值；其恢复实现也没有保存原始值。灵屿首版继续处理自身提醒，避免把接管全系统通知作为依赖。[抑制实现](https://github.com/sadeeshasathsara/dynamic-island-on-windows/blob/e7cea0d84eed1ae5926601af0f5a970a06015b9f/Services/ToastSuppressor.cs)。

性能记录要包含版本提交、OS、GPU／虚拟显示适配器、刷新率、DPI、渲染模式和功能开关；分别记录 Private Bytes、Working Set、CPU、分配／GC、句柄、线程和 UI 响应。帧回调时间与实际屏幕呈现分开；真实录像、ETW 等证据需要注明采集方法与采集开销。

八小时运行和一百次工作台开关测试按既定 1.0 门槛执行，比较预热后与结束时的趋势。AI 本地模型进程单列，Tauri 对照若运行则合计 WebView 等子进程。本轮没有这些运行数据，不能填写“通过”。

## 9. 对当前灵屿代码的具体影响

| 已核实的位置 | 当前行为 | 下一轮修改目的 |
|---|---|---|
| [IslandWindow.xaml.cs](../native/Lingyu.App/Windows/IslandWindow.xaml.cs) 第 75–99 行 | Width / Height 直接落定，再对 Shell 播放透明度和缩放；各形态立即切换可见性 | 连续外壳形变，保留当前过渡，复用封面和控件 |
| 同文件第 46–47 行 | 进入立即切换；只有离开计时器 | 增加可取消悬停意图，区分手动展开和被动预览 |
| 同文件第 80–83 行 | 展开大小和位置按主屏 WorkArea 计算 | 按选定显示器、DPI 和有效工作区定位，保存位置并恢复可见区域 |
| [WorkspaceWindow.xaml.cs](../native/Lingyu.App/Windows/WorkspaceWindow.xaml.cs) 第 33、42–57 行 | StructureChanged 触发 Navigate，创建当前页面的新视觉树 | 页面数据精确通知；输入草稿、光标和滚动不受后台刷新影响 |
| [SessionModel.Weather.cs](../native/Lingyu.App/Models/SessionModel.Weather.cs) 第 72–73 行 | 天气更新发出 StructureChanged | 将天气变化限于对应绑定与天气控件 |
| [App.xaml.cs](../native/Lingyu.App/App.xaml.cs) 第 29 行 | 默认 SoftwareOnly，已有 --hardware-render 开关 | 先比较实际适配器下的正确性与帧时间，再确定渲染策略和回退 |

当前代码已经有原生区域、基本播放控制和工作台，但这些源码位置说明连续形变与编辑状态保护仍需实施。此前构建或业务测试通过不能替代本次视觉、交互和性能门槛。

## 10. 实施顺序和交付证据

1. **运动与窗口小样：** 一个驱动协调形状、内容和原生区域；完成进入／离开取消、连续反向、透明区域命中、显式焦点。验证 Windows 10/11 的圆角与 DPI 路径。
2. **音乐展开样板：** 网易云真实封面／能力／时间轴／控制；连续封面迁移；本地 LRC 与偏移；切歌、暂停、seek 失败、播放器退出和迟到封面均可见且可恢复。
3. **专注样板：** 紧凑剩余时间、圆环展开、暂停／继续／结束，完成回到之前内容；会话与提醒结合持久化，不重播完成事件。
4. **AI 工作台样板：** 流式历史、停止／重试、Markdown、可编辑确认卡；只执行已确定的四种动作，并展示服务实际结果。生成状态映射到小岛。
5. **样板复核后扩展与产品化：** 精确绑定、SQLite、提醒与迁移、安装更新、长期测试，再采集正式截图同步官网。沿用原 1.0 发布顺序与门槛。

每个样板交付真实客户端截图、连续操作录屏、异常状态和内存／帧时间记录。用户确认的原型承担视觉基准，运行中的控件和数据承担实际使用；官网展示对应版本实际完成的能力。任何用户可见能力改变都同步原生与旧客户端各自的提示词，并完成中英文键验证。

## 11. 许可与品牌记录

本轮未向灵屿应用移植任何第三方实现或品牌素材。参考项目的功能机制与交互观察记录在本报告；未来直接使用代码或素材时，单独登记来源、提交、许可证和所需归因。

- MIT：WinIslands、DynamicNotchKit、NotchDrop、两个 Tauri 候选、Dynamic Island Notifier。
- Apache-2.0：Luma-Bar、DropSpace；各自的 NOTICE／品牌文件需要一起核对。
- OpenNook：主体 Apache-2.0，Sources/NookSurface 为 MIT，NOTICE.md 明确记录了 DynamicNotchKit 的派生来源。[许可地图](https://github.com/twinkling-reality/opennook/blob/3e97de90a2d569f39f1cf7221d0d4bd1f1ca748c/NOTICE.md)。
- GPL-3.0：boring.notch、Atoll、WinIsland、LyricIsland；NoraBar 为 AGPL-3.0。分别保留项目实际许可与版权记录，不混用品牌资产许可。
- WinLand：该提交未找到许可证，保留为设计观察来源，不纳入可直接复用代码清单。
- DynamicWin：API 识别当前资料许可证为 CC-BY-SA-4.0；V2 的实际应用实现没有提供，资料许可证不能当成不可见实现的代码授权。

## 12. 提交索引

下表固定本轮抓取版本，避免后续默认分支更新造成研究证据漂移。许可证列按抓取文件及仓库识别结果记录；源文件或子目录另有许可时以实际文件为准。

| 仓库 | 分支 | 固定提交 | 许可记录 |
|---|---|---|---|
| FlorianButz/DynamicWin | V2 | [b8a874b0c629](https://github.com/FlorianButz/DynamicWin/commit/b8a874b0c629dc60660277113fb132dd933e7f54) | CC-BY-SA-4.0，发行资料 |
| WinIslandProject/WinIsland | master | [a79877fa0995](https://github.com/WinIslandProject/WinIsland/commit/a79877fa09953e5fdb87f8a190a4bfa9d2f81806) | GPL-3.0 |
| JudeKwong/WinIslands | main | [036533f7624a](https://github.com/JudeKwong/WinIslands/commit/036533f7624a0d1884330885a34681e794c23fc9) | MIT |
| luolangaga/WinLand | main | [724f1fd641b3](https://github.com/luolangaga/WinLand/commit/724f1fd641b303af89b8a417c9d1f9a882c8d47b) | 未找到许可证 |
| airanluo-dot/DropSpace | main | [5c9e014ecb16](https://github.com/airanluo-dot/DropSpace/commit/5c9e014ecb160b8280baab02f5fae1edf84ccd8c) | Apache-2.0、NOTICE／品牌文件 |
| mtmtyu/NoraBar | master | [441230afb8db](https://github.com/mtmtyu/NoraBar/commit/441230afb8db49f36556df3e08356b83858c59ae) | AGPL-3.0 |
| BochengYao/LyricIsland | main | [626d13ff7cf1](https://github.com/BochengYao/LyricIsland/commit/626d13ff7cf1201755a978577ec1627e9884e993) | GPL-3.0 |
| Linus-Shyu/Luma-Bar | main | [d40b54c09c97](https://github.com/Linus-Shyu/Luma-Bar/commit/d40b54c09c976b1857ace36c57022b970ae44f6f) | Apache-2.0、NOTICE |
| TheBoredTeam/boring.notch | main | [d58240cc160d](https://github.com/TheBoredTeam/boring.notch/commit/d58240cc160d5e54da1a8a5925e095d067a8e1e0) | GPL-3.0 |
| Ebullioscopic/Atoll | dev | [9ff6a548a6da](https://github.com/Ebullioscopic/Atoll/commit/9ff6a548a6da84b2e8011a0b27d42abd3700e18e) | GPL-3.0、NOTICE／品牌文件 |
| Lakr233/NotchDrop | main | [e70b3d715a99](https://github.com/Lakr233/NotchDrop/commit/e70b3d715a99e47de6eb823540282eafc7401a3a) | MIT |
| mrkai77/DynamicNotchKit | main | [cd0b3e52d537](https://github.com/mrkai77/DynamicNotchKit/commit/cd0b3e52d537db115ad3a9d89601f20e0bee8d27) | MIT |
| twinkling-reality/opennook | main | [3e97de90a2d5](https://github.com/twinkling-reality/opennook/commit/3e97de90a2d569f39f1cf7221d0d4bd1f1ca748c) | 主体 Apache-2.0，NookSurface 为 MIT |
| onlytrisdev/dynamic-island-windows | main | [85b290152842](https://github.com/onlytrisdev/dynamic-island-windows/commit/85b29015284287536fc21068a3d04185bfe2a89c) | MIT |
| warpirate/pillar-dynamic-island-for-windows | main | [4017de9ee1c8](https://github.com/warpirate/pillar-dynamic-island-for-windows/commit/4017de9ee1c83d156952771a9f685175bbb27e9f) | MIT |
| sadeeshasathsara/dynamic-island-on-windows | main | [e7cea0d84eed](https://github.com/sadeeshasathsara/dynamic-island-on-windows/commit/e7cea0d84eed1ae5926601af0f5a970a06015b9f) | MIT |
