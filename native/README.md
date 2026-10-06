# 灵屿原生预览 · 1.0.0-preview.6

独立 C# / .NET 10 / WPF 工程。一个即时状态岛，加一张随时打开的桌面工作台。软件免费；模型服务由用户自行选择与连接。

从源码启动：

```powershell
dotnet run --project native/Lingyu.App -- --workspace
```

实际界面样例：

```powershell
dotnet run --project native/Lingyu.App -- --showcase --workspace
```

样例只用于视觉和操作验收，不保存虚构的歌曲、天气、对话或任务。正常模式只显示真实系统状态和用户输入。

当前包含：系统音乐控制/音量、天气城市选择、专注计时、任务完成/固定到岛、自动保存纯文本笔记、文件拖放/打开/定位/复制/移除引用、Ollama/OpenAI 兼容协议多轮流式对话/停止/历史、回复保存笔记或编辑待办草稿。天气由 Open-Meteo 提供，使用模型前需要自行运行本地服务或填入自己的 API Key。

小岛不会夺取输入焦点；大任务在工作台完成。前台应用全屏时隐藏岛，退出后恢复。语言可切换和记忆，支持减少动效。

专注会保存运行状态、截止时间和暂停剩余时间。重启继续本轮；退出期间到期，下次启动补记完成提醒而不补播声音。完成卡片保留到主动关闭或开始下一轮，已关闭的提醒不会在重启后返回。只在状态变化时原子保存，计时显示不每秒写盘。本轮还将专注岛收成圆头胶囊，统一完成圆环、双语说明与关闭入口。

音乐从 192 × 44 的紧凑岛进入悬停和 420 × 248 的独立详情，详情可切换三栏总览；窄于 360 DIP 时重排为 284 DIP 高。暂停保留 60 秒，重复快照不续期，无会话时回到 64 × 40 的标志。封面取色仅改变音乐进度与五柱播放状态动效，坏图或无封面回退为紫色。五柱不是实时频谱，不读取麦克风或系统音频；暂停、隐藏和减少动效时停止。拖进度时保留操作，专注完成等释放后再呈现。

总览按可用宽度显示三栏、双栏或单栏；窄工作台使用图标导航和纵向卡片，缩放窗口保留正在编辑的内容。固定待办使用收起态，音乐悬停区保持歌曲、歌手和控制一致。

工作台和弹窗交给 Windows 11 绘制系统圆角、单层边框与阴影；小岛用 Win32 窗口区域形成胶囊。按钮、输入框和内容面采用统一的原生控件圆角，移除叠加的自绘窗口壳。

数据位于 `%LOCALAPPDATA%/Lingyu/NativePreview`。Key 使用当前 Windows 用户的 DPAPI 加密。此预览不迁移旧版数据，不覆盖旧安装目录。

验证和打包：

```powershell
dotnet run --project native/Lingyu.Tests -c Release
dotnet build native/Lingyu.App -c Release
pwsh -File native/scripts/build-preview.ps1
```

打包结果为 `dist/native-preview/1.0.0-preview.6/app/Lingyu.Native.exe`，包含运行时。测试入口 `--verify --output <目录> --data-dir <测试目录>` 会检查真实窗口、双语页面、任务/笔记/文件引用、关闭后释放，以及生成程序截图和资源报告。`--verify-frame --showcase` 可单独复核窗口边缘、实际鼠标悬停和弹窗内容；验收过程会短暂将预览带到前台。`--no-capture` 用于单独采集资源占用。内容采用静态矢量与软件绘制，外框由 Windows 处理；`--hardware-render` 仅用于诊断对比。

`--verify-layout --showcase --output <目录> --data-dir <测试目录>` 验证中英文窄窗布局、卡片文本、编辑状态和岛上活动信息，并保存截图。该检查改变窗口尺寸，不代表已切换和验证所有系统 DPI。验收记录见 [布局验证](../docs/NATIVE_LAYOUT_VERIFICATION_2026-10-04.md)。窗口验证应依次运行。

天气页面显示时自动检查 30 分钟缓存，隐藏或最小化后暂停自动刷新。切城清空旧数据，同城刷新失败保留上次数据并显示时间，支持手动重试。`--verify-weather --showcase` 使用隔离响应验证这些行为；追加 `--live-weather` 可核实真实服务与原生显示。记录见 [天气验证](../docs/NATIVE_WEATHER_VERIFICATION_2026-10-05.md)。

音量与静音跟随 Windows 默认多媒体输出，设备失效时禁用控制，恢复后重新连接。手动选择的播放器退出后保留“未运行”状态，返回后恢复原选择。`--verify-media --showcase --output <目录> --data-dir <测试目录>` 验证受控设备事件、原生控件和经过 Windows 的自建 SMTC 测试会话；不更改真实音量或默认设备。物理设备切换仍需实际硬件验收，记录见 [媒体与音频验证](../docs/NATIVE_MEDIA_VERIFICATION_2026-10-05.md)。

解压预览后双击 `Open-workspace.cmd` 打开正常工作台；`Open-visual-sample.cmd` 打开明确标注的视觉样例。两种模式共用单实例，切换前从托盘退出当前预览。点击岛空白处展开；音乐和音量按钮操作真实系统。托盘双击打开工作台，右键可退出。实测结果见 [2026-10-02 验证记录](../docs/NATIVE_PREVIEW_VERIFICATION_2026-10-02.md)。

`--verify-focus --showcase --output <目录> --data-dir <测试目录>` 使用隔离存储、可控时钟和真实窗口，验证专注重启恢复、到期去重、关闭确认、不抢输入焦点及中英文窄窗。时间推进不代表物理睡眠/唤醒实测，记录见 [专注恢复与完成提醒验收](../docs/NATIVE_FOCUS_VERIFICATION_2026-10-05.md)。

`--verify-music-island --showcase --output <目录> --data-dir <测试目录>` 验证音乐详情、暂停缓冲、取色竞态、拖动保护与 100 次窗口释放。追加 `--record-music` 可驱动实鼠标路径，配合外部录屏；`--measure-music` 分场景采样资源且不强制 GC。见 [音乐小岛验收](../docs/NATIVE_MUSIC_ISLAND_VERIFICATION_2026-10-05.md)。

未包含正式迁移、通用定时提醒、跨应用通知和自动更新。原生版作为独立预览发布，旧版稳定安装包继续提供；不承诺所有播放器和显示器均已兼容。

字体本地托管：Manrope 与 Noto Sans SC，保留各自 OFL。静态 400/600 字重；Noto 包含界面及 GB2312 常用字，其他字由 Windows 字体回退显示。客户端新代码 GPL-3.0；原仓库与第三方素材保留原有许可。
