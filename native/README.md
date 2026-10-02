# 灵屿原生预览

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

工作台和弹窗交给 Windows 11 绘制系统圆角、单层边框与阴影；小岛用 Win32 窗口区域形成胶囊。按钮、输入框和内容面采用统一的原生控件圆角，移除叠加的自绘窗口壳。

数据位于 `%LOCALAPPDATA%/Lingyu/NativePreview`。Key 使用当前 Windows 用户的 DPAPI 加密。此预览不迁移旧版数据，不覆盖旧安装目录。

验证和打包：

```powershell
dotnet run --project native/Lingyu.Tests -c Release
dotnet build native/Lingyu.App -c Release
pwsh -File native/scripts/build-preview.ps1
```

打包结果为 `dist/native-preview/app/Lingyu.Native.exe`，包含运行时。测试入口 `--verify --output <目录> --data-dir <测试目录>` 会检查真实窗口、双语页面、任务/笔记/文件引用、关闭后释放，以及生成程序截图和资源报告。`--verify-frame --showcase` 可单独复核窗口边缘、实际鼠标悬停和弹窗内容；验收过程会短暂将预览带到前台。`--no-capture` 用于单独采集资源占用。内容采用静态矢量与软件绘制，外框由 Windows 处理；`--hardware-render` 仅用于诊断对比。

解压预览后双击 `Open-workspace.cmd` 打开正常工作台；`Open-visual-sample.cmd` 打开明确标注的视觉样例。两种模式共用单实例，切换前从托盘退出当前预览。点击岛空白处展开；音乐和音量按钮操作真实系统。托盘双击打开工作台，右键可退出。实测结果见 [2026-10-02 验证记录](../docs/NATIVE_PREVIEW_VERIFICATION_2026-10-02.md)。

未包含正式迁移、定时提醒、跨应用通知和自动更新。完整功能、正式安装包和官网同步在首阶段预览验收后继续。

字体本地托管：Manrope 与 Noto Sans SC，保留各自 OFL。静态 400/600 字重；Noto 包含界面及 GB2312 常用字，其他字由 Windows 字体回退显示。客户端新代码 GPL-3.0；原仓库与第三方素材保留原有许可。
