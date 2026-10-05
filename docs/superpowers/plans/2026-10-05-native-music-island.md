# 灵屿原生音乐小岛 · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 将下一版原生预览的日常音乐体验收敛为精致、轻量、状态可靠的小岛，同时保留已有三栏总览和独立工作台。

**Architecture:** 延续 C# / WPF，复用 `IslandState`、`IslandMotion`、共享封面、SMTC 事件和现有媒体控制。把“收起／悬停／展开”的形态与“音乐详情／总览”的展开内容分开；新增代码仅负责音乐呈现策略、封面配色和播放状态动效，不引入另一套渲染框架或通用插件系统。

**Tech Stack:** .NET 10、WPF / XAML、Windows SMTC、现有纯 C# 业务测试与真实窗口验证、Python 契约检查。

**状态：** Task 0–5 已完成，`1.0.0-preview.5` 已作为预览版发布，官网同步上线并通过生产域名检查。实际结果、性能目标差距和未覆盖设备见[音乐小岛验收记录](../../NATIVE_MUSIC_ISLAND_VERIFICATION_2026-10-05.md)。

**基线：** 灵屿 `d80ba1e6c667b81ff3093e999cedee3bc6aa4b1a` / `1.0.0-preview.4`。参考项目为 **adityasrivastava5098/WinIsland** 的固定提交 `19ded91c74244117f98e54ab918d5ac80ee15f65`，不是同名的 WinIslandProject/Rust 项目。

**工作目录：** `E:\CodingXM\灵屿Lingyu`。下文源码路径均相对此根目录；命令在该目录执行。

**执行约定：** 当前可用技能目录没有上述两个 `superpowers` 执行技能。后续可在当前会话逐任务实施、检查和记录，不把缺少这些技能作为前置阻塞，也不默认调度子代理。执行前检查工作区，保留其他人的改动；每个切片验证通过后再进入下一项。

---

## 1. 本轮交付与后续边界

本轮只交付一条完整音乐路径：**空闲 → 音乐紧凑态 → 悬停信息 → 音乐详情 → 总览／工作台 → 收起**。

| 阶段 | 交付 | 进入条件 |
|---|---|---|
| 本轮：音乐小岛 | 紧凑形态、独立音乐详情、局部封面取色、播放动效、暂停缓冲、真实窗口验收 | 按本计划实施 |
| 后续一：活动调度 | 复用专注完成，增加临时反馈的合并、操作保护和恢复；复制提示为可关闭模块 | 音乐样板通过，再单独编写实施计划 |
| 后续二：位置与显示器 | 贴顶／留缝、指定显示器、显示器移除后的回退 | 单独核实显示器与 DPI 行为后规划 |
| 后续候选 | 日历、摄像头／麦克风状态、真实音频频谱 | 分别确认 Windows 能力与日常价值，不作为本轮交付条件 |

本轮不新增自动歌词搜索、后台录音、剪贴板读取、全局输入钩子、AI 工具执行、数据库迁移或自动更新。点击封面打开外部播放器另做能力验证，不把参考项目的 README 描述直接当作可移植实现。

参考项目 `v1.1.0` 对应 `aaf815b9e4f946d5e41b7a667aa5f2cae102628b`；复制提示在其后的主分支新增，不混写为已发布能力。其包元数据声明 MIT，但当前快照没有独立 LICENSE；本轮独立实现视觉与交互规则，不复制其代码或品牌素材。[许可讨论](https://github.com/adityasrivastava5098/WinIsland/issues/16)

## 2. 体验规格

### 2.1 形态、内容与操作

以下尺寸是 **DIP 设计起点**，需要在实窗验证；不将参考截图像素直接当作 Windows 布局尺寸。

| 状态 | 初始尺寸 | 显示内容 | 用户操作 |
|---|---|---|---|
| 无主活动的空闲态 | 64 × 40 | 灵屿标志 | 悬停显示入口，点击打开音乐空状态，可进入总览 |
| 音乐紧凑态 | 192 × 44 | 28 DIP 封面、五条播放状态动效 | 悬停显示曲名，点击展开音乐详情 |
| 音乐悬停态 | 340 × 64 | 封面、曲名、歌手、播放／暂停、工作台入口 | 离开按现有延迟收起；按钮操作不触发展开 |
| 音乐详情 | 420 × 248 | 封面、曲名、歌手、当前歌词、进度、前后曲、播放／暂停、总览与收起入口 | 从同一岛展开；手动展开后鼠标离开不自动关闭 |
| 三栏总览 | 保留当前最大 1000 × 280 及窄窗布局 | 音乐、天气、时间与现有快捷操作 | 明确的“返回音乐”入口，继续使用同一个 HWND |
| 专注、AI、固定待办 | 保留当前规则 | 当前活动自身的信息和动作 | 音乐收敛逻辑不能覆盖这些状态 |

- 可见宽度不得超过宿主可用宽度。音乐详情在可用宽度小于 360 DIP 时使用 280–359 DIP 单栏重排，高度可增加到 284 DIP；文字不整体缩小。主动作命中区至少 40 × 40 DIP。
- 曲名最多两行，歌手一行，溢出省略并提供完整提示；中英文都使用现有本地字体与资源。无本地歌词时不新增长期占位说明，完整歌词操作仍在音乐工作台。
- 总览不是第四种 `IslandShape`：三种形态保持不变，展开后通过独立内容选择切换音乐详情与总览。
- 同一次展开中的音乐／总览选择保持到用户显式切换；收起后下次从音乐详情打开。专注或 AI 暂时占用岛时保留该选择，不因此清除音乐数据。
- 小岛继续不主动夺取输入焦点。收起提供真实按钮；Esc 只沿用当前确实能接收到键盘输入的路径，不新增全局键盘监听。

### 2.2 暂停、消失与操作保护

1. 正在播放时保留音乐紧凑态；暂停后保留 60 秒，五条动效立即停止。
2. 60 秒从首次进入暂停状态开始；重复收到同一歌曲的暂停快照不能不断延期。新歌曲或不同来源的暂停快照重新开始缓冲。
3. 无媒体会话时清除旧曲目的封面与取色，回到真实空状态，不复用上一首封面冒充当前歌曲。
4. 只有 **收起态、无固定待办、当前活动为音乐** 时，缓冲到期才缩为小空闲态。悬停、手动展开、菜单打开及滑杆捕获期间保持当前操作界面。
5. 恢复播放撤销到期收敛；睡眠恢复后按单调时钟重新判定，不补播过时的展开动画。
6. 沿用现有 `Protected` 条件。新音乐进度条拖动中，专注完成先记录到模型；释放鼠标后刷新活动，不丢完成提醒，也不切断正在进行的跳转。
7. 本轮不创建新的活动队列。继续使用当前专注、AI、音乐的活动优先关系，以及固定待办仅占收起态的规则。

### 2.3 材质、颜色和动效

- 保留原来的近黑表面、克制细边、Manrope / Noto Sans SC 和紫色品牌色；不增加常驻大面积外发光。
- 专辑色仅作用于音乐进度填充和播放动效。文字、焦点边框、专注、AI、天气及设置页仍使用原主题。
- 从已解码封面采样 16 × 16 BGRA 像素，忽略透明、近黑与近白像素，以饱和度加权选色；没有可用颜色时使用现有紫色 `#C3AAFF`。这是强调色采样，不承诺提取某种语义上的“正确主色”。
- 取色随封面变化执行一次，不按播放进度重算；沿用当前迟到结果保护。A→B 快速切歌时，A 的延迟结果不得覆盖 B。
- 五条动效表达 **正在播放**，不是音频采集或实时频谱。暂停、无媒体、非音乐活动、不可见、卸载和减少动效时都停止计时。
- 轮廓继续使用可反向弹簧，共享封面持续移动；正文的淡入晚于形变开始。先保持现有运动参数，再通过录像调整；不直接移植 Framer Motion 的 `380/28` 数值。
- 内容淡入以 120–180ms、颜色过渡以 300–450ms 为调试起点；播放装饰动效最多 30 次／秒。减少动效时直接落定并显示静态播放标记。
- 现有 Win32 窗口区域随轮廓同步。阴影被区域裁切时先调整表面内部明暗，不为装饰引入第二个透明窗口。

## 3. 文件职责

| 文件 | 本轮职责 |
|---|---|
| `native/Lingyu.Core/IslandState.cs` | 新增展开内容枚举，保留既有形态与悬停意图 |
| `native/Lingyu.Core/IslandMotion.cs` | 增加总览的内容透明度通道，保留原位置和速度 |
| 新建 `native/Lingyu.Core/MusicPresence.cs` | 纯逻辑的暂停缓冲，不引用 Dispatcher 或 WPF |
| 新建 `native/Lingyu.Core/MediaPalette.cs` | BGRA 输入到强调色的纯算法，便于合成像素测试 |
| `native/Lingyu.App/Windows/IslandWindow.xaml` | 音乐详情、紧凑音乐层、总览入口；保留现有总览树 |
| `native/Lingyu.App/Windows/IslandWindow.xaml.cs` | 几何目标、总览切换、拖动保护、缓冲到期的一次性刷新 |
| `native/Lingyu.App/Models/SessionModel.cs` | 封面解码与颜色结果同步，发出对应属性通知 |
| `native/Lingyu.App/Models/SessionModel.Music.cs` | 明确的播放状态和曲目身份属性，不重复实现媒体服务 |
| 新建 `native/Lingyu.App/Controls/PlaybackPulse.cs` | 五条轻量绘制、可见性和计时器生命周期 |
| `native/Lingyu.App/Theme.xaml` | 让媒体滑杆使用自己的 Foreground；其他滑杆默认外观保持一致 |
| `native/Lingyu.Tests/Program.cs` | 暂停缓冲、取色、反向运动和提示词契约 |
| 新建 `native/Lingyu.App/Verification/MusicIslandChecks.cs` | 新体验的实窗、竞态、命中、生命周期验证 |
| `native/Lingyu.App/App.xaml.cs` | 注册隔离验收参数 `--verify-music-island` |
| `native/Lingyu.App/Verification/LayoutChecks.cs` | 保留总览原验收，增加音乐详情宽度场景 |
| `native/Lingyu.App/Verification/AnimationChecks.cs` | 分别测量音乐详情与总览，不混淆装饰动效与形变 |
| `native/Lingyu.App/i18n/zh-CN.json`、`en-US.json` | 同一任务同步新增可见文字 |
| `native/Lingyu.Core/NativePrompt.cs` | 只在实现完成时说明新音乐布局和状态动效边界 |
| `native/scripts/check-contracts.py`、`.github/workflows/native.yml` | 复用现有检查；只有新增契约确有必要时才调整 |
| `native/README.md`、`native/Directory.Build.props` | 验收通过后记录能力与目标预览版本 |
| 新建 `docs/NATIVE_MUSIC_ISLAND_VERIFICATION_2026-10-05.md` | 留存实际执行日期、实窗截图、结果与未覆盖项目 |

不拆分整个 `SessionModel`，不整体重排已有 XAML，不修改旧 Electron 客户端功能。每一项修改都应对应上表中的职责。

## 4. 实施任务

### Task 0：记录可比较的基线

**读取：** `native/README.md`、现有布局／媒体／专注验收、`docs/COMMENT_STANDARDS.md`、`docs/FRONTEND_STANDARDS.md`。

- [x] 记录当前 HEAD、工作区变更和实际 SDK；只将本计划所需改动纳入后续提交。

```powershell
git status --short
git rev-parse HEAD
dotnet --version
```

- [x] 执行已有业务、构建和契约检查，结果写入 `dist/native-music-review/preview5/baseline/`。预期退出码均为 0；有基线失败先定位，不把它归为新 UI 的结果。

```powershell
dotnet run --project native/Lingyu.Tests -c Release
dotnet build native/Lingyu.App -c Release --nologo
python native/scripts/check-contracts.py
```

- [x] 使用已有隔离窗口入口保存中英文收起／悬停／总览截图。每个窗口进程完成后再运行下一个，避免单实例和鼠标事件互相干扰。

```powershell
dotnet run --project native/Lingyu.App -c Release --no-build -- --verify-layout --showcase --output dist/native-music-review/preview5/baseline/layout --data-dir dist/native-music-review/preview5/baseline/layout-data
```

**交付：** 基线检查结果与真实截图。此项不改变产品代码。

### Task 1：建立音乐暂停缓冲与展开内容契约

**新建：** `native/Lingyu.Core/MusicPresence.cs`。
**修改：** `native/Lingyu.Core/IslandState.cs`、`native/Lingyu.Tests/Program.cs`。

- [x] 在现有 `Check` / `Assert` 测试程序内增加以下行为测试并运行。首次预期因 `MusicPresence` 尚未定义而失败；实现后必须全部通过。

```csharp
Check("music pause expires without repeated snapshots extending it", () => {
  var presence = new MusicPresence();
  presence.Update("player|track-a", true, 0);
  presence.Update("player|track-a", false, 10);
  presence.Update("player|track-a", false, 50);
  Assert(presence.IsVisible(69.9), "paused song disappeared too early");
  Assert(!presence.IsVisible(70), "duplicate snapshot extended pause");
});
Check("music resume and session removal replace the pending deadline", () => {
  var presence = new MusicPresence();
  presence.Update("player|track-a", false, 0);
  presence.Update("player|track-a", true, 59);
  Assert(presence.IsVisible(120), "resumed song expired");
  presence.Update("", false, 121);
  Assert(!presence.IsVisible(121), "removed session retained artwork state");
});
Check("a different paused song receives its own grace period", () => {
  var presence = new MusicPresence();
  presence.Update("player|track-a", false, 0);
  presence.Update("player|track-b", false, 50);
  Assert(presence.IsVisible(109.9) && !presence.IsVisible(110), "new song inherited old deadline");
});
```

- [x] 添加纯逻辑实现，时间参数统一为调用方的单调秒数。保留以下接口，不在类内部启动计时器：

```csharp
namespace Lingyu.Core;

/// <summary>音乐收起态的短暂停留；不负责覆盖其他活动或用户操作。</summary>
public sealed class MusicPresence
{
  private string key = "";
  private bool playing;
  private double? pausedUntil;

  /// <summary>空身份代表没有媒体会话；同一暂停快照不会续期。</summary>
  public void Update(string mediaKey, bool isPlaying, double seconds)
  {
    if (mediaKey.Length == 0) { key = ""; playing = false; pausedUntil = null; return; }
    if (isPlaying) pausedUntil = null;
    else if (mediaKey != key || playing) pausedUntil = seconds + 60;
    key = mediaKey;
    playing = isPlaying;
  }

  /// <summary>仅表示音乐是否仍值得占据收起态，界面另行保护悬停和展开。</summary>
  public bool IsVisible(double seconds) => key.Length > 0 && (playing || pausedUntil is { } end && seconds < end);

  /// <summary>供窗口安排一次性唤醒；暂停缓冲不需要逐帧驱动。</summary>
  public double? Deadline => pausedUntil;
}
```

- [x] 在 `IslandState.cs` 增加 `public enum IslandExpandedView { Music, Overview }`。它表达展开内容，不改变原来的三种 `IslandShape`。
- [x] 运行 `dotnet run --project native/Lingyu.Tests -c Release`，确认新测试和已有专注／悬停测试都通过。
- [x] 按原生注释规范补文件头，形成独立提交：`feat(native): define compact music presence policy`。

### Task 2：交付音乐详情与总览分离的实窗

**修改：** `IslandWindow.xaml`、`IslandWindow.xaml.cs`、`IslandMotion.cs`、`SessionModel.Music.cs`、`App.xaml.cs`、`LayoutChecks.cs`、双语文件、`NativePrompt.cs`。
**新建：** `Verification/MusicIslandChecks.cs`。

- [x] 先建立 `MusicIslandChecks.RunAsync(App app, string output)` 验收入口，方式沿用 `MediaChecks.RunAsync`：隔离数据、受控媒体快照、实际窗口、JSON 结果与截图、失败退出码。App 增加 `--verify-music-island` 分支，禁止把测试状态存入用户目录。
- [x] 验收先检查以下尚未实现的结果，预期失败：音乐展开可见宽度 420 DIP；总览入口确实显示原三栏；收起后再次展开回音乐；固定待办仍在收起态；新滑杆捕获期间到期的专注提醒在释放后出现且未丢失。
- [x] 新增模型只读属性 `bool IsPlaying` 与 `string MediaIdentity`：真实播放状态来自 `snapshot.Playing`；身份来自有效快照的来源、标题、歌手。`Showcase` 的样例只在明确样例模式呈现，不让控件调用真实播放命令。媒体快照变化时同步发属性通知。
- [x] 新增 `Grid x:Name="MusicDetails"`，保留现有 `Expanded` 作为总览，不复制天气或媒体服务。控件绑定复用 `TrackTitle`、`TrackArtist`、`CurrentLyric`、`MediaProgress`、`MediaTime`、`MediaDuration` 和 `CanPlay/CanPrevious/CanNext/CanSeek`。
- [x] 为新控件指定稳定 AutomationId：`MusicDetails`、`MusicDetailsSeek`、`MusicOverview`、`MusicBack`、`MusicCollapse`。新增动作使用真实 Button 和既有样式；每个可见按钮有本地化可访问名称。

关键 XAML 动作接线使用现有处理器或下面明确新增的处理器：

```xml
<Button Click="ShowOverview" Style="{StaticResource IconButton}"
        ToolTip="{l:L islandOverview}" AutomationProperties.Name="{l:L islandOverview}"
        AutomationProperties.AutomationId="MusicOverview"><c:Glyph Kind="monitor" /></Button>
<Button Click="ShowMusic" Style="{StaticResource IconButton}"
        ToolTip="{l:L islandBackToMusic}" AutomationProperties.Name="{l:L islandBackToMusic}"
        AutomationProperties.AutomationId="MusicBack"><c:Glyph Kind="music" /></Button>
<Button Click="CollapseMusic" Style="{StaticResource IconButton}"
        ToolTip="{l:L islandCollapse}" AutomationProperties.Name="{l:L islandCollapse}"
        AutomationProperties.AutomationId="MusicCollapse"><c:Glyph Kind="close" /></Button>
```

`MusicOverview` 放入音乐详情，`MusicBack` 放入总览；`Glyph.cs` 已有 `monitor`、`music`、`close` 图形，直接复用。

```csharp
private IslandExpandedView expandedView = IslandExpandedView.Music;
public void SetExpandedView(IslandExpandedView view)
{
  expandedView = view;
  if (island.Shape != IslandShape.Expanded) island.Toggle();
  RenderShape();
}
private void ShowOverview(object sender, RoutedEventArgs e) => SetExpandedView(IslandExpandedView.Overview);
private void ShowMusic(object sender, RoutedEventArgs e) => SetExpandedView(IslandExpandedView.Music);
private void CollapseMusic(object sender, RoutedEventArgs e) => Collapse();
```

- [x] 让所有显式收起路径重置 `expandedView`；鼠标离开已展开窗口继续沿用原规则。`SetShape(Expanded)` 的默认语义为音乐，验收旧总览前显式调用 `SetExpandedView(Overview)`。
- [x] 为 `IslandGeometry` 末尾增加可选 `double Overview = 0`，`IslandMotion` 的位置、速度、目标和 `Current` 同步扩展为 13 个通道。保留原 `Music` 通道给 `MusicDetails`；`Expanded` 使用新 `Overview` 通道，保留现有共享封面的同一视觉实例。样例标记在音乐详情与总览都保持可见，正常模式不显示。给新增通道补反向途中不跳变和最终收敛的断言。
- [x] `RenderShape` 按第 2 节选择几何，`ApplyFrame` 增加新层并按实际可见轮廓更新命中区域。总览原响应式布局仍由 `ArrangeContent` 负责，音乐详情使用自身宽度安排，不能把宿主 1000 DIP 误当作详情宽度。
- [x] 进度拖动处理由写死 `MediaSeek` 改为从 `sender` 取得当前 Slider，并持有正在拖动的实例；释放时只提交该实例的值，随后恢复它的绑定。两个滑杆不能互相改写拖动值。沿用 `Protected` 屏蔽活动切换。
- [x] 窗口以自己的 `clock.Elapsed.TotalSeconds` 更新 `MusicPresence`；构造时读取初始状态，`OnModelChanged` 增加对 `IsPlaying`、`MediaIdentity` 的处理。仅为 `Deadline` 安排一次性到期刷新；窗口隐藏或关闭时停止，到再次可见时重新计算。暂停到期只能影响收起态的音乐可见性，不能改变活动优先关系。
- [x] 在 `LayoutChecks` 显式保留原总览测试，增加音乐详情 420／360／320／280 DIP、中英文与长曲名场景。仅修改断言的目标选择，不删除原来暴露裁切或焦点问题的断言。
- [x] 同任务完成第 5 节中的新文案与原生提示词同步，再运行业务、构建、契约和新窗口验收。通过后提交：`feat(native): separate music detail from island overview`。

### Task 3：让专辑色安全地跟随当前歌曲

**新建：** `Lingyu.Core/MediaPalette.cs`。
**修改：** `Lingyu.Tests/Program.cs`、`SessionModel.cs`、`IslandWindow.xaml.cs`、`IslandWindow.xaml`、`Theme.xaml`、`MusicIslandChecks.cs`、`NativePrompt.cs`。

- [x] 为合成 BGRA 输入增加测试：空样本、透明样本、全黑／全白都返回紫色；单色样本保留该色倾向；同一输入反复调用结果一致；输出字节始终在合法范围。核心接口固定如下：

```csharp
namespace Lingyu.Core;

/// <summary>不依赖 WPF 的 RGB 强调色。</summary>
public readonly record struct MediaAccent(byte R, byte G, byte B);
/// <summary>从小尺寸封面样本提取适合暗色表面的强调色。</summary>
public static class MediaPalette
{
  /// <summary>无有效封面时保持灵屿紫色。</summary>
  public static readonly MediaAccent Fallback = new(195, 170, 255);
  /// <summary>读取完整的 BGRA 像素样本，不缓存图像或创建后台任务。</summary>
  public static MediaAccent Extract(ReadOnlySpan<byte> bgra)
  {
    if (bgra.Length % 4 != 0) throw new ArgumentException("Incomplete BGRA sample", nameof(bgra));
    double red = 0, green = 0, blue = 0, weightSum = 0;
    for (int i = 0; i < bgra.Length; i += 4)
    {
      double b = bgra[i], g = bgra[i + 1], r = bgra[i + 2];
      double brightness = (r + g + b) / 3;
      if (bgra[i + 3] < 128 || brightness < 30 || brightness > 240) continue;
      double high = Math.Max(r, Math.Max(g, b)), low = Math.Min(r, Math.Min(g, b));
      double weight = 1 + 2 * (high - low) / high;
      red += r * weight; green += g * weight; blue += b * weight; weightSum += weight;
    }
    if (weightSum == 0) return Fallback;
    red /= weightSum; green /= weightSum; blue /= weightSum;
    double luminance = .299 * red + .587 * green + .114 * blue;
    if (luminance < 100)
    {
      double blend = (100 - luminance) / (255 - luminance);
      red += (255 - red) * blend; green += (255 - green) * blend; blue += (255 - blue) * blend;
    }
    return new(Channel(red), Channel(green), Channel(blue));
  }
  private static byte Channel(double value) => (byte)Math.Clamp(Math.Round(value), 0, 255);
}
```

此算法独立于图像解码；实施时补原生文件头。坏图像由现有解码路径处理，合法但没有有效颜色的图像回退为品牌色。

核心测试使用现有测试程序，例如：

```csharp
Check("album accent ignores non-informative pixels", () => {
  Assert(MediaPalette.Extract([]) == MediaPalette.Fallback, "empty art has an arbitrary color");
  Assert(MediaPalette.Extract(new byte[] { 0, 0, 0, 255, 255, 255, 255, 255 }) == MediaPalette.Fallback,
    "black and white pixels replaced the brand fallback");
  Assert(MediaPalette.Extract(new byte[] { 0, 0, 255, 0 }) == MediaPalette.Fallback,
    "transparent pixel contributed color");
});
Check("album accent keeps the dominant hue and is deterministic", () => {
  byte[] red = [0, 0, 220, 255];
  var accent = MediaPalette.Extract(red);
  Assert(accent.R > accent.G && accent.R > accent.B, "red cover lost its hue");
  Assert(accent == MediaPalette.Extract(red), "same artwork produced different accents");
});
```

- [x] 扩展 `ApplyMedia` 当前后台解码任务：使用已解码封面转换为 16 × 16 BGRA 再取色，一次返回冻结的图像和颜色。UI 提供 `Color MediaAccentColor`；设置前沿用 `disposed` 与 `decodedArtwork` 身份检查。相同封面引用不重新取色。
- [x] 新建窗口本地可动画的 `SolidColorBrush` 资源 `MusicAccent`。只给音乐进度和播放动效引用，不覆盖应用级 `Accent`。没有封面、解码失败或会话消失时复位为紫色。
- [x] 当前 Slider 模板的已播放填充写死了 `Accent`。只将该填充改为绑定所属 Slider 的 `Foreground`；原 Style 的 Foreground 默认仍为 Accent。新音乐进度实例设置 `Foreground="{DynamicResource MusicAccent}"`，其他滑杆不改色。

```xml
<Border Height="4" CornerRadius="2"
        Background="{Binding Foreground, RelativeSource={RelativeSource AncestorType={x:Type Slider}}}" />
```

- [x] 当前窗口对 `MediaAccentColor` 的变化做颜色过渡；新结果到来时从当前显示色继续，减少动效时直接赋值。颜色过渡完成后移除动画时钟，再保留最终基础值。
- [x] 在 `MusicIslandChecks` 以两次受控、反向完成的解码模拟 A→B 切歌，检查最终图像和颜色同属 B；再验证损坏封面、相同封面重复快照、无封面歌曲和关闭窗口后的迟到结果。
- [x] 同步已实现的提示词描述，运行核心／契约／窗口检查。通过后提交：`feat(native): derive music accents from current artwork`。

### Task 4：添加可停止的播放状态动效，校准内容节奏

**新建：** `Controls/PlaybackPulse.cs`。
**修改：** `IslandWindow.xaml`、`IslandWindow.xaml.cs`、`AnimationChecks.cs`、`MusicIslandChecks.cs`、`NativePrompt.cs`。

- [x] 先在窗口验收中定义五个状态：播放可见时有变化；暂停后静止；隐藏后不再调度；减少动效时静止；关闭后实例可释放。验证计时是否停止和实际绘制变化，不只检查 `IsPlaying` 属性。
- [x] `PlaybackPulse` 继承 `FrameworkElement`，声明 `IsPlaying`、`ReduceMotion`、`Accent` 三个依赖属性；绘制五条圆头柱，避免五个独立 Storyboard。控件 Loaded／Unloaded、IsVisibleChanged 和依赖属性变更统一更新调度开关。
- [x] 柱高使用有界的确定性变化，全部输入来自单调时钟，不使用录音或音频捕获。计算约定如下，结果乘以控件实际可用高度：

```csharp
private static double Level(int index, double seconds)
{
  double phase = seconds * (5.2 + index * .65) + index * 1.1;
  return .22 + .68 * (.5 + .5 * Math.Sin(phase));
}
```

- [x] 唯一的 DispatcherTimer 间隔不短于 33.4ms。启动条件为 Loaded、IsVisible、真实播放或明确样例播放、当前层可见、未减少动效；任何条件失效立即 Stop。Unloaded 时解除 Tick，重新 Loaded 时只订阅一次。静止状态画固定高度，不能留下逐帧回调。
- [x] 动效仅放在音乐紧凑层；悬停层呈现文字与控制。轮廓、封面和内容继续走已有运动驱动。对内容透明度做顺序校准时保留可反向连续性，不用无法取消的延时回调硬切层。
- [x] 分别测量音乐详情与总览的 36 次形态切换，再录像检查快速展开中收起、悬停扫过、窗口外滑杆释放。WPF 呈现回调间隔与屏幕实际帧率分开记录。
- [x] 同步状态动画的中英文能力边界，验证后提交：`feat(native): add lifecycle-bound playback motion`。

### Task 5：完成回归、实窗评审和预览包

**修改：** `native/README.md`、`native/Directory.Build.props`、对应验收文档；如需留存少量截图，放入 `docs/assets/native/`。

- [x] 运行第 6 节中的自动检查，逐个查看报告。失败项定位修复后只重跑受影响范围及最终必要回归，不用增加重复测试掩盖未解决的问题。
- [x] 查看实际窗口截图和交互录像，对照本计划第 2 节逐项确认；不能仅凭 PNG 文件存在或构建成功判断视觉完成。
- [x] 完成颜色切换、空状态、两个滑杆、专注完成和关闭释放的验证；保存已执行与未执行的真实设备清单。
- [x] 验收通过后，将版本更新到 `1.0.0-preview.5`，同步 README、NativePrompt 中的版本与能力。发布文案明确“播放状态动效”，不写“实时频谱”。旧版提示词只核对其边界，不替换成原生能力。
- [x] 生成独立 ZIP、SHA-256 和中英文发行说明；从全新解压目录启动，复核资源、离线字体、隔离数据、语言和至少一次音乐新入口。
- [x] 形成 `feat(native): finalize preview 5 music experience` 提交。仓库推送、预览 Release 和官网更新作为验收后的发布动作执行；官网图片只取此包的实际窗口，不先发布规划功能。

## 5. 双语与提示词同步清单

下面是本轮确定的新语义。实施时先检查是否已有同义键，存在则复用；新增键必须在两个原生 JSON 中同任务落地。

| 键 | zh-CN | en-US |
|---|---|---|
| `islandOverview` | 总览 | Overview |
| `islandBackToMusic` | 返回音乐 | Back to music |
| `islandCollapse` | 收起灵屿 | Collapse island |
| `islandIdleHint` | 打开灵屿 | Open Lingyu |
| `musicCompactHint` | 展开音乐控制 | Open music controls |
| `musicPlaybackStatus` | 正在播放 | Playing |

已有 `playPause`、`previous`、`next`、`mediaSeek`、`openWorkspace`、`reduceMotion` 继续复用。正常无会话、时间轴缺失和操作失败沿用现有真实能力提示。

`NativePrompt.Build("zh-CN")` 与 `Build("en-US")` 在每个用户可见切片完成时同步；最终应准确包含：

> 中文：小岛支持紧凑音乐、悬停控制和独立音乐详情，可切换到音乐、天气与时间总览。音乐进度与播放状态动效可跟随专辑配色；动效只表示播放状态，不是音频采集或实时频谱。暂停后短暂保留音乐入口，手动展开和正在拖动的控件不会因到期自动关闭。
>
> English: The island supports compact music, hover controls and a dedicated music detail view, with a separate music, weather and time overview. Music progress and playback activity animation can follow album colors. The animation indicates playback state; it does not capture audio or display a real audio spectrum. Paused music remains briefly, while a manually expanded view or active drag is not closed by that timeout.

这段描述按对应功能完成情况逐项加入，不能在 Task 2 提前写入尚未完成的配色与动效。原有无 AI 工具、无通用提醒、无跨应用通知等边界继续保留。

## 6. 验证命令与交付门槛

以下命令供实施后复核；`--verify-music-island` 已由 Task 2 新增。所有真实窗口验收顺序运行，使用彼此独立的数据目录。

```powershell
dotnet run --project native/Lingyu.Tests -c Release
dotnet build native/Lingyu.App -c Release --nologo
python native/scripts/check-contracts.py

dotnet run --project native/Lingyu.App -c Release --no-build -- --verify-music-island --showcase --output dist/native-music-review/preview5/music --data-dir dist/native-music-review/preview5/music-data
dotnet run --project native/Lingyu.App -c Release --no-build -- --verify-layout --showcase --output dist/native-music-review/preview5/layout --data-dir dist/native-music-review/preview5/layout-data
dotnet run --project native/Lingyu.App -c Release --no-build -- --verify-media --showcase --output dist/native-music-review/preview5/media --data-dir dist/native-music-review/preview5/media-data
dotnet run --project native/Lingyu.App -c Release --no-build -- --verify-focus --showcase --output dist/native-music-review/preview5/focus --data-dir dist/native-music-review/preview5/focus-data
dotnet run --project native/Lingyu.App -c Release --no-build -- --verify-animation --showcase --output dist/native-music-review/preview5/animation --data-dir dist/native-music-review/preview5/animation-data
dotnet run --project native/Lingyu.App -c Release --no-build -- --verify --showcase --output dist/native-music-review/preview5/full --data-dir dist/native-music-review/preview5/full-data

pwsh -File native/scripts/build-preview.ps1
```

打包脚本成功后，在仓库根目录生成发行资产；避免覆盖已经审查过的同名包：

```powershell
$previewVersion = ([xml](Get-Content -LiteralPath native/Directory.Build.props -Raw)).Project.PropertyGroup.Version
$previewApp = Join-Path 'dist/native-preview' "$previewVersion/app"
$previewZip = Join-Path 'dist/native-preview' "Lingyu-$previewVersion-win-x64.zip"
if (Test-Path -LiteralPath $previewZip) { throw 'The preview archive already exists; inspect it before replacing it.' }
Compress-Archive -Path (Join-Path $previewApp '*') -DestinationPath $previewZip -CompressionLevel Optimal
$previewHash = (Get-FileHash -LiteralPath $previewZip -Algorithm SHA256).Hash.ToLowerInvariant()
$checksumLine = $previewHash + '  ' + [IO.Path]::GetFileName($previewZip) + "`n"
[IO.File]::WriteAllText([IO.Path]::GetFullPath($previewZip + '.sha256'), $checksumLine, [Text.UTF8Encoding]::new($false))
```

| 维度 | 通过标准 |
|---|---|
| 构建与契约 | 构建成功；新增警告为 0；所有新 UI 键双语齐全；两个 NativePrompt 分支准确 |
| 形态 | 音乐详情与总览各有真实入口；反向切换连续；点击透明外部区域不被岛拦截；专注与 AI 不串内容 |
| 文字 | 中英文、长标题、无歌手、无封面、无歌词、缺失时间轴都可读，按钮不被挤出 |
| 播放 | 播放／暂停／前后曲遵循能力标志；不能跳转时明确不可用；拖动过程中不被新快照拉回 |
| 缓冲 | 首次暂停起算 60 秒；重复事件不续期；继续播放取消收敛；手动展开和固定任务受保护 |
| 配色 | 旧歌曲迟到结果不覆盖新歌；无封面复位；纯黑／白回退；专注和 AI 强调色不变 |
| 动效与资源 | 减少动效、暂停、隐藏、非音乐层、Unloaded 后均无动效计时；关闭重开 100 次订阅与内存无持续增长趋势 |
| 实际显示 | 记录 100／125／150／200% DPI、浅／深桌面背景的实际覆盖；窗口改宽不冒充 DPI 实测 |
| 真实播放器 | 以受控 SMTC 会话验证链路，再对可用真实播放器记录控制与时间轴能力；不作所有播放器通用承诺 |
| 打包 | 独立解压运行；运行时、字体和许可随包；数据仍在 NativePreview；校验和与发行包一致 |

资源预算沿用已有路线：常驻 Private Bytes 目标 ≤120 MiB、工作台 ≤240 MiB、空闲平均整机 CPU ≤0.5%；60Hz 形变回调 P95 目标 ≤20ms。分别记录空闲、播放动效、展开和工作台场景，使用预热后同环境基线比较。以上为目标，不是已达到的结果；不使用强制 GC 或工作集裁剪制造达标数字。

原生截图和录像应显示真实版本与样例标记；测试模拟时间推进不记为物理睡眠唤醒。没有覆盖的硬件、显示器或播放器明确记为未验证。

## 7. 执行顺序与完成定义

依赖顺序：**Task 0 基线 → Task 1 状态契约 → Task 2 音乐详情 → Task 3 配色 → Task 4 动效 → Task 5 验收打包**。

首个可评审成果是 Task 2 的中英文实窗：能够切歌、拖进度、进入总览、收起，并保留专注完成提醒。随后配色与动效分别作为可回退的小提交加入，不把它们与媒体服务重写混在一起。

本轮完成需要同时交付：可运行预览包、实际 UI 与交互证据、通过的业务／契约／窗口回归、准确的双语文案和提示词、已知限制记录。只有计划文档、漂亮截图或构建成功均不等同于产品完成。

本计划调整的是原有路线中的音乐样板；天气、专注恢复和媒体设备恢复已经实现，继续回归，不重新列为待开发。原路线见 [原生迭代方向](../../NATIVE_ITERATION_DIRECTION_2026-10-04.md)。

## 8. 固定参考

- [WinIsland 形态与内容切换](https://github.com/adityasrivastava5098/WinIsland/blob/19ded91c74244117f98e54ab918d5ac80ee15f65/src/components/DynamicIsland.jsx)：空闲／音乐尺寸、悬停信息、暂停缓冲、分离内容过渡。
- [封面取色](https://github.com/adityasrivastava5098/WinIsland/blob/19ded91c74244117f98e54ab918d5ac80ee15f65/src/utils/colorExtractor.js)：小尺寸采样与暗色界面的可读性处理。
- [播放动效](https://github.com/adityasrivastava5098/WinIsland/blob/19ded91c74244117f98e54ab918d5ac80ee15f65/src/components/SoundWave.jsx)：状态动画的产品表达，不是实时频谱。
- [参考项目媒体服务](https://github.com/adityasrivastava5098/WinIsland/blob/19ded91c74244117f98e54ab918d5ac80ee15f65/electron/mediaManager.js)：其 500ms PowerShell 查询不进入灵屿实现。
- [灵屿现有运动驱动](../../../native/Lingyu.Core/IslandMotion.cs)、[媒体服务](../../../native/Lingyu.Platform.Windows/MediaService.cs)、[原生目录约定](../../../native/AGENTS.md)。

研究边界：参考项目截图与选定源码已经阅读；没有安装其发行 EXE，未把它的性能、所有功能或全部兼容性当作实测事实。
