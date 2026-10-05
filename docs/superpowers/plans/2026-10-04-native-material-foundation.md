# Native Material Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

执行环境说明：以上是规划技能的标准交接提示；本会话未提供这些子技能，也没有要求并行代理。用户继续指令后，已在当前会话使用现有编辑/验证工具实施。实测记录见 `docs/NATIVE_MATERIAL_VERIFICATION_2026-10-04.md`；未测试的环境仍保留未勾选状态。

**Goal:** 用一个可独立验收的最小改动，让现有原生音乐胶囊获得更接近用户图片的近黑表面、细边高光与抬升按钮。

**Architecture:** 保留 WPF、原生窗口区域和现有 IslandMotion，仅改共享画刷及现有控件资源引用。改动不添加后台采样、透明合成、窗口阴影宿主或新的组件框架。响应式布局、天气、活动调度分开实施，避免无法判断视觉收益来源。

**Tech Stack:** C# / .NET 10 / WPF XAML；现有原生业务测试、双语契约脚本及实窗验证。

---

## 文件边界

- 修改：`E:/CodingXM/灵屿Lingyu/native/Lingyu.App/Theme.xaml`，定义共用表面和轮廓画刷。
- 修改：`E:/CodingXM/灵屿Lingyu/native/Lingyu.App/Windows/IslandWindow.xaml`，为现有 Shell 使用新画刷。
- 修改：`E:/CodingXM/灵屿Lingyu/native/Lingyu.App/Windows/IslandWindow.xaml.cs`，防止进入/离开时用固定颜色覆盖主题。
- 修改验证：`E:/CodingXM/灵屿Lingyu/native/Lingyu.App/Verification/NativeChecks.cs`，新增真实指针切换回归和桌面合成截图；复用 `AnimationChecks.cs`。
- 输出：`E:/CodingXM/灵屿Lingyu/dist/native-material-review/`，使用独立 profile。

这是视觉路线的第一个切片，不等于整套七张图已实现。除这些资源与引用之外，不整理已有未提交代码。

## Task 1：建立可对照的真实窗口基线

- [x] 读取现有共享主题、窗口 XAML、运动与原生区域逻辑。
- [x] 以隔离样例运行现有 frame 验证：18 项通过，报告位于 `dist/research/native-iteration-2026-10-04/baseline/report.json`。
- [x] 人工查看展开、悬停和工作台截图；确认材质平、部分文字小和卡片提示裁切。后两项属于后续布局切片，不夹入本次画刷修改。
- [x] 执行代码前检查 diff，并将修改前源文件保存到本轮 `source-before/`，保留用户和前序工作的修改。

## Task 2：增加明确的材质资源

- [x] 在 Theme.xaml 替换现有 `IslandSurface`，并在其旁新增静止/悬停边缘与按钮资源。完整内容如下：

```xml
<LinearGradientBrush x:Key="IslandSurface" StartPoint="0,0" EndPoint="0,1">
  <GradientStop Color="#14161B" Offset="0" />
  <GradientStop Color="#090A0D" Offset="0.48" />
  <GradientStop Color="#0F1015" Offset="1" />
</LinearGradientBrush>
<LinearGradientBrush x:Key="IslandEdge" StartPoint="0,0" EndPoint="0,1">
  <GradientStop Color="#8B8C96" Offset="0" />
  <GradientStop Color="#42434D" Offset="0.18" />
  <GradientStop Color="#25262D" Offset="0.55" />
  <GradientStop Color="#454650" Offset="1" />
</LinearGradientBrush>
<LinearGradientBrush x:Key="IslandHoverEdge" StartPoint="0,0" EndPoint="0,1">
  <GradientStop Color="#B1ADBC" Offset="0" />
  <GradientStop Color="#63606E" Offset="0.18" />
  <GradientStop Color="#3B3944" Offset="0.55" />
  <GradientStop Color="#615B70" Offset="1" />
</LinearGradientBrush>
<LinearGradientBrush x:Key="RaisedControlSurface" StartPoint="0,0" EndPoint="0,1">
  <GradientStop Color="#25262D" Offset="0" />
  <GradientStop Color="#1B1C22" Offset="1" />
</LinearGradientBrush>
```

- [x] 在现有 `RoundButton` 样式加入两个 Setter，保留其模板、悬停、按压、键盘焦点和禁用 Trigger。

```xml
<Setter Property="Background" Value="{StaticResource RaisedControlSurface}" />
<Setter Property="BorderBrush" Value="{StaticResource Line}" />
```

- [x] 编译验证资源名和类型：

```powershell
dotnet build native/Lingyu.App -c Release
```

预期：退出码 0，无新的错误/警告。画刷颜色是第一轮候选，实窗比较后可在这三个资源内部微调；不能把样例中的禁用按钮强制启用以获得更亮截图。

## Task 3：接到现有原生外壳

- [x] 为 IslandWindow.xaml 中唯一的 Shell 使用以下资源；未增加第二层窗口外框。

```xml
<Border x:Name="Shell" Width="280" Height="44"
        Background="{StaticResource IslandSurface}"
        BorderBrush="{StaticResource IslandEdge}" BorderThickness="1"
        CornerRadius="22" IsHitTestVisible="False" />
```

- [x] 确认大小和圆角仍由 `IslandMotion` 驱动；区域计算、命中、窗口焦点和帧调度保持原有行为。
- [x] 实窗发现旧事件处理会覆盖主题；先增加指针进入/离开后的回归检查，确认三态均失败，再将两个处理器改为下列完整实现：

```csharp
private void OnEnter(object sender, MouseEventArgs e) { island.PointerEnter(clock.Elapsed.TotalSeconds); intent.Start(); Shell.SetResourceReference(Border.BorderBrushProperty, "IslandHoverEdge"); }
private void OnLeave(object sender, MouseEventArgs e) { island.PointerLeave(clock.Elapsed.TotalSeconds); intent.Start(); Shell.SetResourceReference(Border.BorderBrushProperty, "IslandEdge"); }
```

- [x] 运行实际窗口验证：

```powershell
dotnet run --project native/Lingyu.Tests -c Release
python native/scripts/check-contracts.py
dotnet run --project native/Lingyu.App -c Release -- --verify-frame --showcase --output dist/native-material-review/frames --data-dir dist/native-material-review/profile
```

预期：业务测试和契约检查通过；frame 报告 errors 为空。新增资源不引入可见文字；仍核对双语键和原生提示词边界。纯画刷变化不向提示词添加尚不存在的能力。

## Task 4：视觉、输入与资源验收

- [x] 对照基线检查三态截图：边缘单层、上缘轻亮、深色内容保持对比；检查了实际桌面合成的展开态轮廓。
- [x] 记录当前 Windows 11、150% DPI、Intel Iris Xe、60Hz 下的结果；保存实际桌面截图。样例模式没有启用虚构播放能力。
- [ ] 用实际桌面合成截图验证浅/深背景；RenderTargetBitmap 截图不能单独证明系统边界效果。需要明确记录 OS、DPI、显示器和渲染模式。
- [ ] 人工验证键盘焦点、真实媒体控件的悬停/按压/禁用；样例模式的播放器按钮禁用属于正确行为。
- [ ] 在目标机器具备的缩放比例下测试 100/125/150/200%；无法测试的项目记为未验证，不填“通过”。
- [x] 执行软件渲染前后诊断与默认渲染对照；软件回调 P95 约 33.7ms，默认渲染约 18.4ms，但后者进程 Private Bytes 更高。默认策略未因单次实验改动。

```powershell
dotnet run --project native/Lingyu.App -c Release --no-build -- --verify-animation --showcase --output dist/native-material-review/motion --data-dir dist/native-material-review/motion-profile
```

预期：动画收敛、逐帧订阅释放，回调间隔没有明显退化。该报告是 WPF 回调诊断，不是实际呈现帧率。

- [x] 与保存的工作区基线逐文件比较，仅增加主题资源/引用、必要的悬停修复与验证；未暂存其他既有修改。
- [x] 保存前后截图、回归/性能报告和环境边界。其余缩放比例、浅色桌面背景及真实媒体键盘操作尚未验证。

后续独立切片按主路线实施：响应式三栏与卡片裁切 → 音乐/专注/AI 样板 → 活动调度与可靠提醒。完整范围见 `E:/CodingXM/灵屿Lingyu/docs/NATIVE_ITERATION_DIRECTION_2026-10-04.md`。
