# 原生 Electron 验收探针

本目录保存 2026-10-01 功能修复阶段使用的实际脚本。先复制到自有临时目录，再运行；会在脚本所在目录创建测试页面、临时 profile、JSON 结果、日志与截图。测试需要本项目已安装的开发依赖、构建后的 preload 及 Windows 原生模块。

从项目根目录运行以下 PowerShell 命令：

```powershell
$lingyuRepo = (Get-Location).Path
$lingyuProbeDir = Join-Path ([IO.Path]::GetTempPath()) ('lingyu-verification-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $lingyuProbeDir | Out-Null
Copy-Item -Path 'docs/audits/2026-10-01/probes/*.cjs' -Destination $lingyuProbeDir
Copy-Item -Path 'docs/audits/2026-10-01/probes/*.mjs' -Destination $lingyuProbeDir
npm run build
node (Join-Path $lingyuProbeDir 'build-functional-fixture.mjs') $lingyuRepo
node (Join-Path $lingyuProbeDir 'run-functional-probe.cjs') $lingyuRepo
node (Join-Path $lingyuProbeDir 'build-free-ai-fixture.mjs') $lingyuRepo
node (Join-Path $lingyuProbeDir 'run-free-ai-probe.cjs') $lingyuRepo
```

包内模块检查使用自己的打包目录：

```powershell
$lingyuPackageDir = Join-Path $lingyuProbeDir 'package'
npx electron-builder --win --x64 --dir --publish never "--config.directories.output=$lingyuPackageDir"
node (Join-Path $lingyuProbeDir 'run-packaged-probe.cjs') $lingyuRepo (Join-Path $lingyuPackageDir 'win-unpacked')
```

包内检查的 PE 版本断言固定为本次 0.3.8；后续版本应同步预期。运行包装脚本会启动隐藏的 Electron 子进程，并在有界期限后终止自有子进程；只有正常 exit code 0 才算通过。

- 功能探针用实际 React 页面、构建后 preload、主进程存储／网络／搜索源码。所有配置和文件属于本次临时目录；剪贴板 IPC 只返回自有测试文本，不访问用户系统剪贴板。外部网络被拦截，真实网络边界测试只访问自有回环服务。其他硬件及服务 IPC 使用受控结果。
- AI 探针运行实际 AiTab、主进程 AI 源码、net.fetch 和 Windows safeStorage。连接自有 Ollama／OpenAI 兼容模拟接口，只使用测试 Key，不进行真实推理或付费调用。
- 包内探针用同版本开发 Electron 从真实 app.asar 加载模块，并将资源目录指向真实打包目录。不会执行打包应用的 main，不调用杀进程、不请求通知访问、不修改硬件设置；只对音量／亮度／电源进行查询。

这些脚本不能代替真实设备、模型、Explorer 文件粘贴和安装／升级验收。完成后的证据文件需保留外部替代标记，不应将页面 smoke 检查写成完整业务功能认证。
